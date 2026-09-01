import base64
import os
import sqlite3
import tempfile
import unittest

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


if __name__ == "__main__":
    unittest.main()
