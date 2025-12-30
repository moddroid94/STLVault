import os
import uuid
import time
import shutil
import sqlite3
from fastapi import (
    FastAPI,
    UploadFile,
    File,
    Form,
    HTTPException,
)
from fastapi.responses import FileResponse
from starlette.middleware.cors import CORSMiddleware
import json
from pathlib import Path
from typing import Optional, List, Dict, Any, Union
from pydantic import BaseModel


from importers import printables

DB_PATH = os.getenv("DB_PATH", "data.db")
UPLOAD_DIR = Path(os.getenv("FILE_STORAGE", "./app/uploads"))
WEBUI_URL = os.getenv("WEBUI_URL", "http://localhost:8989")


class FolderData(BaseModel):
    name: str
    parentId: Union[str, None] = None


app = FastAPI(title="STLVault API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for development, or use [WEBUI_URL] for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_db_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_db_conn()
    cur = conn.cursor()
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS folders (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            parentId TEXT
        )
        """
    )
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS models (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            folderId TEXT NOT NULL,
            url TEXT NOT NULL,
            size INTEGER,
            dateAdded INTEGER,
            tags TEXT,
            description TEXT,
            thumbnail TEXT
        )
        """
    )
    conn.commit()

    # seed folders if empty
    cur.execute("SELECT COUNT(*) as c FROM folders")
    if cur.fetchone()[0] == 0:
        seed = [
            ("1", "Characters", None),
            ("2", "Vehicles", None),
            ("3", "Terrain", None),
            ("4", "Tanks", "2"),
        ]
        cur.executemany("INSERT INTO folders(id,name,parentId) VALUES (?,?,?)", seed)
        conn.commit()

    conn.close()


init_db()


def now_ms() -> int:
    return int(time.time() * 1000)


def row_to_folder(row: sqlite3.Row) -> Dict[str, Any]:
    return {"id": row["id"], "name": row["name"], "parentId": row["parentId"]}


def row_to_model(row: sqlite3.Row) -> Dict[str, Any]:
    tags = []
    if row["tags"]:
        try:
            tags = json.loads(row["tags"])
        except Exception:
            tags = []
    return {
        "id": row["id"],
        "name": row["name"],
        "folderId": row["folderId"],
        "url": row["url"],
        "size": row["size"],
        "dateAdded": row["dateAdded"],
        "tags": tags,
        "description": row["description"] or "",
        "thumbnail": row["thumbnail"],
    }


def save_upload_file(upload_file: UploadFile, dest_path: str) -> int:
    with open(dest_path, "wb") as buffer:
        shutil.copyfileobj(upload_file.file, buffer)
    size = os.path.getsize(dest_path)
    return size


# --- Folder endpoints ---
@app.get("/api/folders")
def get_folders():
    conn = get_db_conn()
    cur = conn.cursor()
    cur.execute("SELECT id,name,parentId FROM folders")
    rows = cur.fetchall()
    conn.close()
    return [row_to_folder(r) for r in rows]


@app.post("/api/folders")
def create_folder(item: FolderData):
    fid = str(uuid.uuid4())
    conn = get_db_conn()
    cur = conn.cursor()
    cur.execute(
        "INSERT INTO folders(id,name,parentId) VALUES (?,?,?)",
        (fid, item.name, item.parentId),
    )
    conn.commit()
    conn.close()
    return {"id": fid, "name": item.name, "parentId": item.parentId}


@app.patch("/api/folders/{folder_id}")
def update_folder(folder_id: str, item: FolderData):
    conn = get_db_conn()
    cur = conn.cursor()
    cur.execute("UPDATE folders SET name=? WHERE id=?", (item.name, folder_id))
    if cur.rowcount == 0:
        conn.close()
        raise HTTPException(status_code=404, detail="Folder not found")
    conn.commit()
    cur.execute("SELECT id,name,parentId FROM folders WHERE id=?", (folder_id,))
    row = cur.fetchone()
    conn.close()
    return row_to_folder(row)


@app.delete("/api/folders/{folder_id}")
def delete_folder(folder_id: str):
    conn = get_db_conn()
    cur = conn.cursor()
    cur.execute("SELECT 1 FROM models WHERE folderId=? LIMIT 1", (folder_id,))
    if cur.fetchone():
        conn.close()
        raise HTTPException(status_code=400, detail="Folder must be empty to delete")
    cur.execute("SELECT 1 FROM folders WHERE parentId=? LIMIT 1", (folder_id,))
    if cur.fetchone():
        conn.close()
        raise HTTPException(status_code=400, detail="Folder must be empty to delete")
    cur.execute("DELETE FROM folders WHERE id=?", (folder_id,))
    conn.commit()
    conn.close()
    return {"ok": True}


# --- Model endpoints ---
@app.get("/api/models")
def get_models(folderId: Optional[str] = None):
    conn = get_db_conn()
    cur = conn.cursor()
    if folderId and folderId != "all":
        cur.execute("SELECT * FROM models WHERE folderId=?", (folderId,))
    else:
        cur.execute("SELECT * FROM models")
    rows = cur.fetchall()
    conn.close()
    return [row_to_model(r) for r in rows]


@app.post("/api/models/upload")
def upload_model(
    file: UploadFile = File(...),
    folderId: str = Form("1"),
    thumbnail: Optional[str] = Form(None),
    tags: Optional[str] = Form(None),
):
    mid = str(uuid.uuid4())
    
    # Ensure that file.filename is a string before passing it to os.path.splitext, providing a default value if it is None
    filename_str = file.filename or ".stl"
    ext = os.path.splitext(filename_str)[1] or ".stl"
    
    filename = f"{mid}{ext}"
    path = os.path.join(UPLOAD_DIR, filename)
    size = save_upload_file(file, path)

    tag_list: List[str] = []
    if tags:
        try:
            tag_list = json.loads(tags)
        except Exception:
            tag_list = [t.strip() for t in (tags or "").split(",") if t.strip()]

    model = {
        "id": mid,
        "name": file.filename,
        "folderId": folderId if folderId != "all" else "1",
        "url": f"/api/models/{mid}/download",
        "size": size,
        "dateAdded": now_ms(),
        "tags": tag_list,
        "description": "",
        "thumbnail": thumbnail,
    }

    conn = get_db_conn()
    cur = conn.cursor()
    cur.execute(
        "INSERT INTO models(id,name,folderId,url,size,dateAdded,tags,description,thumbnail) VALUES (?,?,?,?,?,?,?,?,?)",
        (
            model["id"],
            model["name"],
            model["folderId"],
            model["url"],
            model["size"],
            model["dateAdded"],
            json.dumps(model["tags"]),
            model["description"],
            model["thumbnail"],
        ),
    )
    conn.commit()
    conn.close()
    return model


@app.patch("/api/models/{model_id}")
def update_model(model_id: str, updates: dict):
    conn = get_db_conn()
    cur = conn.cursor()
    m = cur.execute("SELECT * FROM models WHERE id=?", (model_id,)).fetchone()
    if not m:
        conn.close()
        raise HTTPException(status_code=404, detail="Model not found")

    # Build update statement
    allowed = ["name", "folderId", "tags", "description", "thumbnail"]
    fields = []
    values = []
    for k in allowed:
        if k in updates:
            if k == "tags":
                values.append(json.dumps(updates[k] or []))
            else:
                values.append(updates[k])
            fields.append(f"{k}=?")

    if fields:
        sql = f"UPDATE models SET {', '.join(fields)} WHERE id=?"
        cur.execute(sql, (*values, model_id))
        conn.commit()

    row = cur.execute("SELECT * FROM models WHERE id=?", (model_id,)).fetchone()
    conn.close()
    return row_to_model(row)


@app.delete("/api/models/{model_id}")
def delete_model(model_id: str):
    conn = get_db_conn()
    cur = conn.cursor()
    m = cur.execute("SELECT * FROM models WHERE id=?", (model_id,)).fetchone()
    if not m:
        conn.close()
        raise HTTPException(status_code=404, detail="Model not found")
    # Delete file if exists
    for fname in os.listdir(UPLOAD_DIR):
        if fname.startswith(model_id):
            try:
                os.remove(os.path.join(UPLOAD_DIR, fname))
            except Exception:
                pass
    cur.execute("DELETE FROM models WHERE id=?", (model_id,))
    conn.commit()
    conn.close()
    return {"ok": True}


@app.get("/api/models/{model_id}/download")
def download_model(model_id: str):
    # Find file matching id
    for fname in os.listdir(UPLOAD_DIR):
        if fname.startswith(model_id):
            return FileResponse(
                os.path.join(UPLOAD_DIR, fname),
                media_type="application/octet-stream",
                filename=fname,
            )
    raise HTTPException(status_code=404, detail="File not found")


@app.post("/api/models/bulk-delete")
def bulk_delete(payload: dict):
    ids = payload.get("ids", [])
    conn = get_db_conn()
    cur = conn.cursor()
    for mid in ids:
        # delete files
        for fname in os.listdir(UPLOAD_DIR):
            if fname.startswith(mid):
                try:
                    os.remove(os.path.join(UPLOAD_DIR, fname))
                except Exception:
                    pass
        cur.execute("DELETE FROM models WHERE id=?", (mid,))
    conn.commit()
    conn.close()
    return {"ok": True}


@app.post("/api/models/bulk-move")
def bulk_move(payload: dict):
    ids = payload.get("ids", [])
    folderId = payload.get("folderId")
    conn = get_db_conn()
    cur = conn.cursor()
    for mid in ids:
        cur.execute("UPDATE models SET folderId=? WHERE id=?", (folderId, mid))
    conn.commit()
    conn.close()
    return {"ok": True}


@app.post("/api/models/bulk-tag")
def bulk_tag(payload: dict):
    ids = payload.get("ids", [])
    tags = payload.get("tags", [])
    conn = get_db_conn()
    cur = conn.cursor()
    for mid in ids:
        row = cur.execute("SELECT tags FROM models WHERE id=?", (mid,)).fetchone()
        if not row:
            continue
        existing = []
        if row["tags"]:
            try:
                existing = json.loads(row["tags"])
            except Exception:
                existing = []
        merged = list(dict.fromkeys(existing + tags))
        cur.execute("UPDATE models SET tags=? WHERE id=?", (json.dumps(merged), mid))
    conn.commit()
    conn.close()
    return {"ok": True}


@app.post("/api/models/import")
def import_model(payload: dict):
    importer = printables.PrintablesImporter()
    url = payload.get("url")
    folderId = payload.get("folderId", "1")
    mid = str(uuid.uuid4())
    
    # we only save stl for now
    ext = ".stl"
    
    filename = f"{mid}{ext}"
    path = os.path.join(UPLOAD_DIR, filename)

    # Check if url is not None before calling requests.get(url, ...)
    try:
        if url is not None:
            file = importer.importfromURL(url)
            if file is not None:
                with open(path, "wb") as fh:
                    fh.write(file.content)
                size = os.path.getsize(path)
            else:
                raise ValueError("File Is Empty")
        else:
            raise ValueError("URL is None")
    except Exception as e:
        raise e

    model = {
        "id": mid,
        "name": os.path.basename(filename),
        "folderId": folderId if folderId != "all" else "1",
        "url": f"/api/models/{mid}/download",
        "size": size,
        "dateAdded": now_ms(),
        "tags": ["imported"],
        "description": f"Imported from {url}",
    }

    conn = get_db_conn()
    cur = conn.cursor()
    cur.execute(
        "INSERT INTO models(id,name,folderId,url,size,dateAdded,tags,description,thumbnail) VALUES (?,?,?,?,?,?,?,?,?)",
        (
            model["id"],
            model["name"],
            model["folderId"],
            model["url"],
            model["size"],
            model["dateAdded"],
            json.dumps(model["tags"]),
            model["description"],
            None,
        ),
    )
    conn.commit()
    conn.close()
    return model


@app.put("/api/models/{model_id}/file")
def replace_model_file(
    model_id: str, file: UploadFile = File(...), thumbnail: Optional[str] = Form(None)
):
    conn = get_db_conn()
    cur = conn.cursor()
    m = cur.execute("SELECT * FROM models WHERE id=?", (model_id,)).fetchone()
    if not m:
        conn.close()
        raise HTTPException(status_code=404, detail="Model not found")
    # remove existing files that start with model_id
    for fname in os.listdir(UPLOAD_DIR):
        if fname.startswith(model_id):
            try:
                os.remove(os.path.join(UPLOAD_DIR, fname))
            except Exception:
                pass

    filename_str = file.filename or ".stl"
    ext = os.path.splitext(filename_str)[1] or ".stl"
    filename = f"{model_id}{ext}"
    path = os.path.join(UPLOAD_DIR, filename)
    size = save_upload_file(file, path)

    cur.execute(
        "UPDATE models SET url=?, size=?, thumbnail=? WHERE id=?",
        (f"/api/models/{model_id}/download", size, thumbnail, model_id),
    )
    conn.commit()
    row = cur.execute("SELECT * FROM models WHERE id=?", (model_id,)).fetchone()
    conn.close()
    return row_to_model(row)


@app.get("/api/storage-stats")
def storage_stats():
    used = 0
    for fname in os.listdir(UPLOAD_DIR):
        used += os.path.getsize(os.path.join(UPLOAD_DIR, fname))
    total = 5 * 1024 * 1024 * 1024
    return {"used": used, "total": total}


if __name__ == "__main__":
    import uvicorn
    
    # Ensure upload directory exists
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    
    port = int(os.getenv("PORT", "8080"))
    
    uvicorn.run(
        "app:app",
        host="0.0.0.0",
        port=port,
        reload=True,
        log_level="info"
    )
