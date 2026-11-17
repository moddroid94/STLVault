import io
import os
import sqlite3
import tempfile
import unittest
from pathlib import Path

from fastapi import HTTPException, UploadFile
from starlette.requests import Request


_env_dir = tempfile.TemporaryDirectory()
os.environ["DB_PATH"] = os.path.join(_env_dir.name, "data.db")
os.environ["FILE_STORAGE"] = _env_dir.name

import app  # noqa: E402  (env must be set before importing the app)


class ModelVersionTest(unittest.TestCase):
    def setUp(self):
        self._original = (app.DB_PATH, app.UPLOAD_DIR, app.MANUAL_DIR)
        self.tmp = tempfile.TemporaryDirectory()
        app.DB_PATH = os.path.join(self.tmp.name, "data.db")
        app.UPLOAD_DIR = Path(self.tmp.name)
        app.MANUAL_DIR = app.UPLOAD_DIR / "manuals"
        app.MANUAL_DIR.mkdir(parents=True, exist_ok=True)
        app.init_db()

    def tearDown(self):
        app.DB_PATH = os.environ.get("DB_PATH", self._original[0])
        storage = os.environ.get("FILE_STORAGE")
        if storage:
            app.UPLOAD_DIR = Path(storage)
            app.MANUAL_DIR = Path(
                os.environ.get("MANUAL_STORAGE", str(app.UPLOAD_DIR / "manuals"))
            )
        else:
            app.UPLOAD_DIR, app.MANUAL_DIR = self._original[1], self._original[2]
        app.MANUAL_DIR.mkdir(parents=True, exist_ok=True)
        app.init_db()
        self.tmp.cleanup()

    def request(self):
        return Request(
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

    def create_legacy_model(self, model_id="model-1", name="part.stl"):
        conn = sqlite3.connect(app.DB_PATH)
        conn.execute("PRAGMA foreign_keys = ON")
        conn.execute(
            """
            INSERT INTO models(
                id, name, folderId, url, size, dateAdded, tags,
                description, thumbnail, manual
            ) VALUES (?,?,?,?,?,?,?,?,?,?)
            """,
            (
                model_id,
                name,
                "1",
                f"/api/models/{model_id}/download",
                3,
                1000,
                "[]",
                "",
                None,
                None,
            ),
        )
        conn.commit()
        conn.close()
        (app.UPLOAD_DIR / f"{model_id}.stl").write_bytes(b"old")
        app.init_db()

    def versions(self, model_id="model-1"):
        return app.get_model_versions(model_id, self.request())

    def version_filename(self, version_id):
        conn = sqlite3.connect(app.DB_PATH)
        row = conn.execute(
            "SELECT filename FROM model_versions WHERE id=?", (version_id,)
        ).fetchone()
        conn.close()
        return row[0] if row else None

    def upload_file(self, filename="part_v2.stl", content=b"new", notes="refined"):
        return app.upload_model_version(
            "model-1",
            UploadFile(filename=filename, file=io.BytesIO(content)),
            thumbnail=None,
            notes=notes,
        )

    def test_migration_backfills_legacy_model_as_default_v1(self):
        self.create_legacy_model()
        versions = self.versions()

        self.assertEqual(len(versions), 1)
        self.assertEqual(versions[0]["versionNumber"], 1)
        self.assertTrue(versions[0]["isDefault"])
        self.assertFalse(versions[0]["isFinal"])
        self.assertEqual(versions[0]["originalName"], "part.stl")
        self.assertTrue(versions[0]["downloadUrl"].endswith("/download"))

        app.init_db()
        self.assertEqual(len(self.versions()), 1)

    def test_uploading_a_revision_keeps_the_old_file_and_becomes_default(self):
        self.create_legacy_model()
        old_v1 = self.versions()[0]
        model = self.upload_file()

        versions = self.versions()
        self.assertEqual(len(versions), 2)
        new_v2 = next(v for v in versions if v["versionNumber"] == 2)
        self.assertTrue(new_v2["isDefault"])
        self.assertFalse(
            next(v for v in versions if v["versionNumber"] == 1)["isDefault"]
        )
        self.assertEqual(new_v2["notes"], "refined")
        self.assertEqual(model["versionNumber"], 2)
        self.assertEqual(model["versionCount"], 2)
        self.assertEqual(model["size"], 3)
        self.assertEqual(model["fileExtension"], "stl")

        self.assertEqual((app.UPLOAD_DIR / "model-1.stl").read_bytes(), b"old")
        new_filename = self.version_filename(new_v2["id"])
        self.assertEqual((app.UPLOAD_DIR / new_filename).read_bytes(), b"new")
        self.assertEqual(Path(app.download_model("model-1").path).name, new_filename)
        self.assertEqual(
            Path(app.download_model_version("model-1", old_v1["id"]).path).name,
            "model-1.stl",
        )

    def test_set_default_switches_the_served_file(self):
        self.create_legacy_model()
        v1 = self.versions()[0]
        self.upload_file()
        v2 = next(v for v in self.versions() if v["versionNumber"] == 2)

        model = app.update_model_version(
            "model-1", v1["id"], app.ModelVersionUpdate(isDefault=True)
        )
        self.assertEqual(model["versionNumber"], 1)
        self.assertEqual(Path(app.download_model("model-1").path).name, "model-1.stl")
        self.assertFalse(
            next(v for v in self.versions() if v["id"] == v2["id"])["isDefault"]
        )

        with self.assertRaises(HTTPException) as raised:
            app.update_model_version(
                "model-1", v2["id"], app.ModelVersionUpdate(isDefault=False)
            )
        self.assertEqual(raised.exception.status_code, 400)

    def test_final_is_exclusive_and_independent_from_default(self):
        self.create_legacy_model()
        v1 = self.versions()[0]
        self.upload_file()
        v2 = next(v for v in self.versions() if v["versionNumber"] == 2)

        app.update_model_version(
            "model-1", v1["id"], app.ModelVersionUpdate(isFinal=True)
        )
        app.update_model_version(
            "model-1", v2["id"], app.ModelVersionUpdate(isFinal=True)
        )

        versions = {v["versionNumber"]: v for v in self.versions()}
        self.assertFalse(versions[1]["isFinal"])
        self.assertTrue(versions[2]["isFinal"])
        self.assertTrue(versions[2]["isDefault"])

        app.update_model_version(
            "model-1", v2["id"], app.ModelVersionUpdate(isFinal=False)
        )
        self.assertFalse(any(v["isFinal"] for v in self.versions()))

    def test_deprecate_keeps_history_but_removes_the_file(self):
        self.create_legacy_model()
        v1 = self.versions()[0]
        self.upload_file()
        v2 = next(v for v in self.versions() if v["versionNumber"] == 2)

        with self.assertRaises(HTTPException) as raised:
            app.deprecate_model_version("model-1", v2["id"])
        self.assertEqual(raised.exception.status_code, 400)

        app.update_model_version(
            "model-1", v1["id"], app.ModelVersionUpdate(isFinal=True)
        )
        with self.assertRaises(HTTPException) as raised:
            app.deprecate_model_version("model-1", v1["id"])
        self.assertEqual(raised.exception.status_code, 400)

        app.update_model_version(
            "model-1", v1["id"], app.ModelVersionUpdate(isFinal=False)
        )
        app.deprecate_model_version("model-1", v1["id"])

        versions = self.versions()
        self.assertEqual(len(versions), 2)
        deprecated = next(v for v in versions if v["id"] == v1["id"])
        self.assertTrue(deprecated["isDeprecated"])
        self.assertEqual(deprecated["versionNumber"], 1)
        self.assertFalse((app.UPLOAD_DIR / "model-1.stl").exists())
        with self.assertRaises(HTTPException) as raised:
            app.download_model_version("model-1", v1["id"])
        self.assertEqual(raised.exception.status_code, 410)

        self.upload_file(filename="part_v3.stl")
        self.assertEqual(max(v["versionNumber"] for v in self.versions()), 3)

    def test_model_list_exposes_version_summary(self):
        self.create_legacy_model()
        self.upload_file()
        model = next(m for m in app.get_models(self.request()) if m["id"] == "model-1")
        self.assertEqual(model["versionNumber"], 2)
        self.assertEqual(model["versionCount"], 2)
        self.assertFalse(model["versionIsFinal"])
        self.assertEqual(model["fileName"], "part_v2.stl")

    def test_delete_model_removes_all_revision_files(self):
        self.create_legacy_model()
        self.upload_file()
        version_ids = [v["id"] for v in self.versions()]

        app.delete_model("model-1")

        self.assertEqual(list(app.UPLOAD_DIR.glob("*.stl")), [])
        conn = sqlite3.connect(app.DB_PATH)
        remaining = conn.execute(
            "SELECT COUNT(*) FROM model_versions WHERE id IN (?,?)", version_ids
        ).fetchone()[0]
        conn.close()
        self.assertEqual(remaining, 0)


if __name__ == "__main__":
    unittest.main()
