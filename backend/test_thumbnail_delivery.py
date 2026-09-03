import base64
import io
import os
import sqlite3
import tempfile
import unittest

from fastapi import UploadFile
from pydantic import ValidationError
from starlette.requests import Request


temp_dir = tempfile.TemporaryDirectory()
os.environ["DB_PATH"] = os.path.join(temp_dir.name, "data.db")
os.environ["FILE_STORAGE"] = temp_dir.name

import app


class ThumbnailDeliveryTest(unittest.TestCase):
    def setUp(self):
        self.thumbnail_bytes = b"\x89PNG\r\n\x1a\nthumb"
        thumbnail = "data:application/octet-stream;base64," + base64.b64encode(
            self.thumbnail_bytes
        ).decode()
        conn = sqlite3.connect(os.environ["DB_PATH"])
        conn.execute(
            """
            INSERT INTO models(
                id, name, folderId, url, size, dateAdded, tags,
                description, thumbnail, manual
            ) VALUES (?,?,?,?,?,?,?,?,?,?)
            """,
            (
                "model-1",
                "test.stl",
                "1",
                "/download",
                1,
                1,
                "[]",
                "",
                thumbnail,
                None,
            ),
        )
        conn.commit()
        conn.close()

    def tearDown(self):
        conn = sqlite3.connect(os.environ["DB_PATH"])
        conn.execute("DELETE FROM models")
        conn.commit()
        conn.close()

    def test_list_uses_cached_thumbnail_endpoint(self):
        request = Request(
            {
                "type": "http",
                "method": "GET",
                "scheme": "http",
                "server": ("testserver", 80),
                "path": "/api/models",
                "root_path": "",
                "query_string": b"",
                "headers": [(b"host", b"testserver")],
                "router": app.app.router,
            }
        )

        model = app.get_models(request)[0]
        self.assertRegex(
            model["thumbnail"],
            r"^http://testserver/api/models/model-1/thumbnail\?v=[0-9a-f]{12}$",
        )

        response = app.get_model_thumbnail("model-1")
        self.assertEqual(response.body, self.thumbnail_bytes)
        self.assertEqual(response.media_type, "image/png")
        self.assertIn("immutable", response.headers["cache-control"])


class ModelGroupTest(unittest.TestCase):
    def setUp(self):
        conn = sqlite3.connect(os.environ["DB_PATH"])
        conn.executemany(
            """
            INSERT INTO models(
                id, name, folderId, url, size, dateAdded, tags,
                description, thumbnail, manual
            ) VALUES (?,?,?,?,?,?,?,?,?,?)
            """,
            [
                ("part-1", "body.stl", "1", "/part-1", 1, 1, "[]", "", None, None),
                ("part-2", "lid.stl", "1", "/part-2", 1, 2, "[]", "", None, None),
                ("part-3", "handle.stl", "1", "/part-3", 1, 3, "[]", "", None, None),
            ],
        )
        conn.commit()
        conn.close()

    def tearDown(self):
        conn = sqlite3.connect(os.environ["DB_PATH"])
        conn.execute("DELETE FROM model_group_members")
        conn.execute("DELETE FROM model_groups")
        conn.execute("DELETE FROM models")
        conn.commit()
        conn.close()

    def test_schema_migration_is_repeatable(self):
        app.init_db()
        app.init_db()
        conn = sqlite3.connect(os.environ["DB_PATH"])
        tables = {
            row[0]
            for row in conn.execute(
                "SELECT name FROM sqlite_master WHERE type='table'"
            ).fetchall()
        }
        conn.close()
        self.assertIn("model_groups", tables)
        self.assertIn("model_group_members", tables)

    def test_create_group_and_expose_membership_on_models(self):
        group = app.create_model_group(
            app.ModelGroupCreate(
                name="Desk organizer", modelIds=["part-1", "part-2"]
            )
        )

        self.assertEqual(group["name"], "Desk organizer")
        self.assertEqual(group["modelIds"], ["part-1", "part-2"])

        request = Request(
            {
                "type": "http",
                "method": "GET",
                "scheme": "http",
                "server": ("testserver", 80),
                "path": "/api/models",
                "root_path": "",
                "query_string": b"",
                "headers": [(b"host", b"testserver")],
                "router": app.app.router,
            }
        )
        models = {model["id"]: model for model in app.get_models(request)}
        self.assertEqual(models["part-1"]["groupId"], group["id"])
        self.assertEqual(models["part-1"]["groupName"], "Desk organizer")
        self.assertIsNone(models["part-3"]["groupId"])

    def test_model_cannot_belong_to_two_groups(self):
        app.create_model_group(
            app.ModelGroupCreate(name="First", modelIds=["part-1"])
        )
        second = app.create_model_group(
            app.ModelGroupCreate(name="Second", modelIds=["part-2"])
        )

        with self.assertRaises(app.HTTPException) as raised:
            app.add_models_to_group(
                second["id"], app.ModelGroupMembers(modelIds=["part-1"])
            )

        self.assertEqual(raised.exception.status_code, 409)

    def test_group_requires_at_least_one_model(self):
        with self.assertRaises(ValidationError):
            app.ModelGroupCreate(name="Empty", modelIds=[])

    def test_adding_existing_members_to_same_group_is_idempotent(self):
        group = app.create_model_group(
            app.ModelGroupCreate(name="Parts", modelIds=["part-1"])
        )

        updated = app.add_models_to_group(
            group["id"],
            app.ModelGroupMembers(modelIds=["part-1", "part-2"]),
        )

        self.assertEqual(updated["modelIds"], ["part-1", "part-2"])

    def test_removing_last_member_dissolves_group(self):
        group = app.create_model_group(
            app.ModelGroupCreate(name="Temporary", modelIds=["part-1"])
        )

        result = app.remove_model_from_group(group["id"], "part-1")

        self.assertEqual(result, {"ok": True, "groupDeleted": True})
        conn = sqlite3.connect(os.environ["DB_PATH"])
        group_count = conn.execute(
            "SELECT COUNT(*) FROM model_groups WHERE id=?", (group["id"],)
        ).fetchone()[0]
        conn.close()
        self.assertEqual(group_count, 0)

    def test_deleting_last_model_dissolves_group(self):
        group = app.create_model_group(
            app.ModelGroupCreate(name="Temporary", modelIds=["part-1"])
        )

        app.delete_model("part-1")

        conn = sqlite3.connect(os.environ["DB_PATH"])
        group_count = conn.execute(
            "SELECT COUNT(*) FROM model_groups WHERE id=?", (group["id"],)
        ).fetchone()[0]
        conn.close()
        self.assertEqual(group_count, 0)

    def test_manual_update_response_keeps_group_fields(self):
        group = app.create_model_group(
            app.ModelGroupCreate(name="Parts", modelIds=["part-1"])
        )
        upload = UploadFile(filename="instructions.md", file=io.BytesIO(b"Print it"))

        model = app.upload_model_manual("part-1", upload)

        self.assertEqual(model["groupId"], group["id"])
        self.assertEqual(model["groupName"], "Parts")

    def test_delete_group_keeps_models(self):
        group = app.create_model_group(
            app.ModelGroupCreate(
                name="Keep parts", modelIds=["part-1", "part-2"]
            )
        )

        app.delete_model_group(group["id"])

        conn = sqlite3.connect(os.environ["DB_PATH"])
        model_count = conn.execute(
            "SELECT COUNT(*) FROM models WHERE id IN ('part-1', 'part-2')"
        ).fetchone()[0]
        membership_count = conn.execute(
            "SELECT COUNT(*) FROM model_group_members WHERE groupId=?",
            (group["id"],),
        ).fetchone()[0]
        conn.close()
        self.assertEqual(model_count, 2)
        self.assertEqual(membership_count, 0)

    def test_delete_model_removes_membership(self):
        group = app.create_model_group(
            app.ModelGroupCreate(name="Parts", modelIds=["part-1"])
        )

        app.delete_model("part-1")

        conn = sqlite3.connect(os.environ["DB_PATH"])
        membership_count = conn.execute(
            "SELECT COUNT(*) FROM model_group_members WHERE groupId=?",
            (group["id"],),
        ).fetchone()[0]
        conn.close()
        self.assertEqual(membership_count, 0)


if __name__ == "__main__":
    unittest.main()
