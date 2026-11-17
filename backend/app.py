import os
import uuid
import time
import shutil
import sqlite3
import base64
import binascii
import hashlib
from fastapi import (
    FastAPI,
    UploadFile,
    File,
    Form,
    HTTPException,
    Request,
)
from fastapi.responses import FileResponse, Response
from starlette.middleware.cors import CORSMiddleware
import json
from pathlib import Path
from typing import Optional, List, Dict, Any, Union
from pydantic import BaseModel, Field


from importers import makerworld, printables

DB_PATH = os.getenv("DB_PATH", "data.db")
UPLOAD_DIR = Path(os.getenv("FILE_STORAGE", "./app/uploads"))
MANUAL_DIR = Path(os.getenv("MANUAL_STORAGE", UPLOAD_DIR / "manuals"))
MANUAL_DIR.mkdir(parents=True, exist_ok=True)
WEBUI_URL = os.getenv("WEBUI_URL", "http://localhost:8989")


class FolderData(BaseModel):
    name: str
    parentId: Union[str, None] = None


class ModelGroupCreate(BaseModel):
    name: str = Field(min_length=1)
    modelIds: List[str] = Field(min_length=1)


class ModelGroupUpdate(BaseModel):
    name: str = Field(min_length=1)


class ModelGroupMembers(BaseModel):
    modelIds: List[str] = Field(min_length=1)


class ModelVersionUpdate(BaseModel):
    isDefault: Optional[bool] = None
    isFinal: Optional[bool] = None
    notes: Optional[str] = None


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
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def find_legacy_filename(model_id: str) -> Optional[str]:
    """Locate the pre-versioning file for a model: ``{modelId}{ext}``."""
    try:
        for fname in os.listdir(UPLOAD_DIR):
            stem, ext = os.path.splitext(fname)
            if stem == model_id and ext:
                return fname
    except FileNotFoundError:
        pass
    return None


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
            thumbnail TEXT,
            manual TEXT
        )
        """
    )
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT
        )
        """
    )
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS model_groups (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            dateAdded INTEGER NOT NULL
        )
        """
    )
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS model_group_members (
            modelId TEXT PRIMARY KEY,
            groupId TEXT NOT NULL,
            position INTEGER NOT NULL DEFAULT 0,
            FOREIGN KEY(modelId) REFERENCES models(id) ON DELETE CASCADE,
            FOREIGN KEY(groupId) REFERENCES model_groups(id) ON DELETE CASCADE
        )
        """
    )
    cur.execute(
        "CREATE INDEX IF NOT EXISTS idx_model_group_members_group ON model_group_members(groupId, position)"
    )
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS model_versions (
            id TEXT PRIMARY KEY,
            modelId TEXT NOT NULL,
            versionNumber INTEGER NOT NULL,
            filename TEXT,
            originalName TEXT,
            size INTEGER,
            dateAdded INTEGER NOT NULL,
            notes TEXT,
            thumbnail TEXT,
            isDefault INTEGER NOT NULL DEFAULT 0,
            isFinal INTEGER NOT NULL DEFAULT 0,
            isDeprecated INTEGER NOT NULL DEFAULT 0,
            FOREIGN KEY(modelId) REFERENCES models(id) ON DELETE CASCADE,
            UNIQUE(modelId, versionNumber)
        )
        """
    )
    cur.execute(
        "CREATE INDEX IF NOT EXISTS idx_model_versions_model ON model_versions(modelId, versionNumber DESC)"
    )
    cur.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS idx_model_versions_default ON model_versions(modelId) WHERE isDefault=1"
    )
    cur.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS idx_model_versions_final ON model_versions(modelId) WHERE isFinal=1"
    )
    try:
        cur.execute("ALTER TABLE models ADD COLUMN manual TEXT")
    except sqlite3.OperationalError:
        pass
    if os.getenv("MAKERWORLD_BAMBU_TOKEN"):
        cur.execute(
            "INSERT OR IGNORE INTO settings(key,value) VALUES (?,?)",
            ("makerworld_bambu_token", os.getenv("MAKERWORLD_BAMBU_TOKEN")),
        )
    conn.commit()

    # Backfill v1 for existing models created before versioning existed.
    legacy_models = cur.execute(
        """
        SELECT m.* FROM models m
        WHERE NOT EXISTS (
            SELECT 1 FROM model_versions v WHERE v.modelId = m.id
        )
        """
    ).fetchall()
    for model in legacy_models:
        cur.execute(
            """
            INSERT INTO model_versions(
                id, modelId, versionNumber, filename, originalName, size,
                dateAdded, notes, thumbnail, isDefault, isFinal, isDeprecated
            ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
            """,
            (
                str(uuid.uuid4()),
                model["id"],
                1,
                find_legacy_filename(model["id"]),
                model["name"],
                model["size"],
                model["dateAdded"] or int(time.time() * 1000),
                "Initial version",
                model["thumbnail"],
                1,
                0,
                0,
            ),
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


MODEL_VERSION_COLUMNS = """
        COALESCE((SELECT v.versionNumber FROM model_versions v
                  WHERE v.modelId = m.id AND v.isDefault = 1), 1) AS versionNumber,
        (SELECT COUNT(*) FROM model_versions v WHERE v.modelId = m.id) AS versionCount,
        COALESCE((SELECT v.isFinal FROM model_versions v
                  WHERE v.modelId = m.id AND v.isDefault = 1), 0) AS versionIsFinal,
        (SELECT v.id FROM model_versions v
         WHERE v.modelId = m.id AND v.isDefault = 1) AS defaultVersionId,
        (SELECT v.filename FROM model_versions v
         WHERE v.modelId = m.id AND v.isDefault = 1) AS defaultVersionFilename,
        (SELECT v.originalName FROM model_versions v
         WHERE v.modelId = m.id AND v.isDefault = 1) AS defaultVersionOriginalName
"""


def extension_of(filename: Optional[str]) -> str:
    if not filename:
        return ""
    return os.path.splitext(filename)[1].lstrip(".").lower()


def row_to_model(row: sqlite3.Row) -> Dict[str, Any]:
    tags = []
    if row["tags"]:
        try:
            tags = json.loads(row["tags"])
        except Exception:
            tags = []
    keys = row.keys()
    default_filename = row["defaultVersionFilename"] if "defaultVersionFilename" in keys else None
    default_name = row["defaultVersionOriginalName"] if "defaultVersionOriginalName" in keys else None
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
        "manual": row["manual"] if "manual" in keys else None,
        "groupId": row["groupId"] if "groupId" in keys else None,
        "groupName": row["groupName"] if "groupName" in keys else None,
        "versionNumber": int(row["versionNumber"]) if "versionNumber" in keys and row["versionNumber"] else 1,
        "versionCount": int(row["versionCount"] or 1) if "versionCount" in keys else 1,
        "versionIsFinal": bool(row["versionIsFinal"]) if "versionIsFinal" in keys else False,
        "defaultVersionId": row["defaultVersionId"] if "defaultVersionId" in keys else None,
        "fileExtension": extension_of(default_filename) or extension_of(row["name"]),
        "fileName": default_name or row["name"],
    }


def get_model_with_group(
    conn: sqlite3.Connection, model_id: str
) -> Optional[sqlite3.Row]:
    return conn.execute(
        f"""
        SELECT m.*, {MODEL_VERSION_COLUMNS}, mgm.groupId, mg.name AS groupName
        FROM models m
        LEFT JOIN model_group_members mgm ON mgm.modelId = m.id
        LEFT JOIN model_groups mg ON mg.id = mgm.groupId
        WHERE m.id=?
        """,
        (model_id,),
    ).fetchone()


def row_to_model_list_item(row: sqlite3.Row, request: Request) -> Dict[str, Any]:
    model = row_to_model(row)
    if row["thumbnailSignature"]:
        version = hashlib.sha256(row["thumbnailSignature"].encode()).hexdigest()[:12]
        url = request.url_for("get_model_thumbnail", model_id=model["id"])
        model["thumbnail"] = f"{url}?v={version}"
    return model


def thumbnail_media_type(content: bytes) -> str:
    if content.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if content.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if content.startswith((b"GIF87a", b"GIF89a")):
        return "image/gif"
    if content.startswith(b"RIFF") and content[8:12] == b"WEBP":
        return "image/webp"
    raise HTTPException(status_code=415, detail="Unsupported thumbnail image")


def save_upload_file(upload_file: UploadFile, dest_path: str) -> int:
    with open(dest_path, "wb") as buffer:
        shutil.copyfileobj(upload_file.file, buffer)
    size = os.path.getsize(dest_path)
    return size


# --- Model version helpers ---

def insert_model_version(
    conn: sqlite3.Connection,
    model_id: str,
    *,
    filename: Optional[str],
    original_name: str,
    size: Optional[int],
    thumbnail: Optional[str],
    notes: str = "",
    date_added: Optional[int] = None,
    is_default: bool = True,
    version_id: Optional[str] = None,
) -> str:
    version_id = version_id or str(uuid.uuid4())
    number = conn.execute(
        "SELECT COALESCE(MAX(versionNumber), 0) + 1 FROM model_versions WHERE modelId=?",
        (model_id,),
    ).fetchone()[0]
    if is_default:
        conn.execute("UPDATE model_versions SET isDefault=0 WHERE modelId=?", (model_id,))
    conn.execute(
        f"""
        INSERT INTO model_versions(
            id, modelId, versionNumber, filename, originalName, size,
            dateAdded, notes, thumbnail, isDefault, isFinal, isDeprecated
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
        """,
        (
            version_id,
            model_id,
            number,
            filename,
            original_name,
            size,
            date_added or now_ms(),
            notes or "",
            thumbnail,
            1 if is_default else 0,
            0,
            0,
        ),
    )
    return version_id


def ensure_model_version(conn: sqlite3.Connection, model: sqlite3.Row) -> None:
    """Give legacy models a v1 entry before any version operation runs."""
    count = conn.execute(
        "SELECT COUNT(*) FROM model_versions WHERE modelId=?", (model["id"],)
    ).fetchone()[0]
    if count:
        return
    insert_model_version(
        conn,
        model["id"],
        filename=find_legacy_filename(model["id"]),
        original_name=model["name"],
        size=model["size"],
        thumbnail=model["thumbnail"],
        notes="Initial version",
        date_added=model["dateAdded"],
    )


def sync_model_with_default_version(conn: sqlite3.Connection, model_id: str) -> None:
    version = conn.execute(
        "SELECT * FROM model_versions WHERE modelId=? AND isDefault=1", (model_id,)
    ).fetchone()
    if not version:
        return
    if version["size"] is not None:
        conn.execute("UPDATE models SET size=? WHERE id=?", (version["size"], model_id))
    if version["thumbnail"]:
        conn.execute(
            "UPDATE models SET thumbnail=? WHERE id=?", (version["thumbnail"], model_id)
        )


def add_model_version(
    conn: sqlite3.Connection,
    model: sqlite3.Row,
    upload_file: UploadFile,
    thumbnail: Optional[str] = None,
    notes: Optional[str] = None,
) -> str:
    """Store a new revision file and make it the model's default version."""
    ensure_model_version(conn, model)
    version_id = str(uuid.uuid4())
    original_name = upload_file.filename or model["name"]
    ext = os.path.splitext(original_name)[1] or os.path.splitext(model["name"])[1] or ".stl"
    filename = f"{version_id}{ext}"
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    size = save_upload_file(upload_file, str(UPLOAD_DIR / filename))

    insert_model_version(
        conn,
        model["id"],
        filename=filename,
        original_name=original_name,
        size=size,
        thumbnail=thumbnail if thumbnail is not None else model["thumbnail"],
        notes=(notes or "").strip(),
        version_id=version_id,
    )
    sync_model_with_default_version(conn, model["id"])
    return version_id


def row_to_model_version(row: sqlite3.Row, request: Request) -> Dict[str, Any]:
    has_thumbnail = bool(row["thumbnail"])
    thumbnail_url = None
    if has_thumbnail:
        signature = hashlib.sha256(row["thumbnail"].encode()).hexdigest()[:12]
        url = request.url_for(
            "get_model_version_thumbnail",
            model_id=row["modelId"],
            version_id=row["id"],
        )
        thumbnail_url = f"{url}?v={signature}"
    return {
        "id": row["id"],
        "modelId": row["modelId"],
        "versionNumber": row["versionNumber"],
        "originalName": row["originalName"] or "",
        "size": row["size"] or 0,
        "dateAdded": row["dateAdded"],
        "notes": row["notes"] or "",
        "isDefault": bool(row["isDefault"]),
        "isFinal": bool(row["isFinal"]),
        "isDeprecated": bool(row["isDeprecated"]),
        "hasThumbnail": has_thumbnail,
        "thumbnailUrl": thumbnail_url,
        "downloadUrl": f"/api/models/{row['modelId']}/versions/{row['id']}/download",
    }


def decode_thumbnail(thumbnail: str) -> bytes:
    metadata, separator, payload = thumbnail.partition(",")
    if (
        not separator
        or not metadata.startswith("data:")
        or not metadata.endswith(";base64")
    ):
        raise HTTPException(status_code=415, detail="Invalid thumbnail format")
    try:
        return base64.b64decode(payload, validate=True)
    except (binascii.Error, ValueError):
        raise HTTPException(status_code=415, detail="Invalid thumbnail data")


def delete_model_files(conn: sqlite3.Connection, model_id: str) -> None:
    filenames = {
        row["filename"]
        for row in conn.execute(
            "SELECT filename FROM model_versions WHERE modelId=?", (model_id,)
        ).fetchall()
        if row["filename"]
    }
    try:
        for fname in os.listdir(UPLOAD_DIR):
            if os.path.splitext(fname)[0] == model_id:
                filenames.add(fname)
    except FileNotFoundError:
        pass
    for fname in filenames:
        try:
            (UPLOAD_DIR / os.path.basename(fname)).unlink()
        except (FileNotFoundError, OSError):
            pass


def get_setting(key: str) -> Optional[str]:
    conn = get_db_conn()
    row = conn.execute("SELECT value FROM settings WHERE key=?", (key,)).fetchone()
    conn.close()
    return row["value"] if row else None


def set_setting(key: str, value: str):
    conn = get_db_conn()
    conn.execute(
        "INSERT INTO settings(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
        (key, value),
    )
    conn.commit()
    conn.close()


def clear_setting(key: str):
    conn = get_db_conn()
    conn.execute("DELETE FROM settings WHERE key=?", (key,))
    conn.commit()
    conn.close()


def row_to_model_group(row: sqlite3.Row, model_ids: List[str]) -> Dict[str, Any]:
    return {
        "id": row["id"],
        "name": row["name"],
        "dateAdded": row["dateAdded"],
        "modelIds": model_ids,
    }


def get_model_group(conn: sqlite3.Connection, group_id: str) -> Dict[str, Any]:
    row = conn.execute(
        "SELECT id, name, dateAdded FROM model_groups WHERE id=?", (group_id,)
    ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Model group not found")
    members = conn.execute(
        "SELECT modelId FROM model_group_members WHERE groupId=? ORDER BY position, rowid",
        (group_id,),
    ).fetchall()
    return row_to_model_group(row, [member["modelId"] for member in members])


def validate_model_ids(conn: sqlite3.Connection, model_ids: List[str]):
    if not model_ids:
        return
    placeholders = ",".join("?" for _ in model_ids)
    found = {
        row["id"]
        for row in conn.execute(
            f"SELECT id FROM models WHERE id IN ({placeholders})", model_ids
        ).fetchall()
    }
    missing = [model_id for model_id in model_ids if model_id not in found]
    if missing:
        raise HTTPException(
            status_code=404, detail=f"Models not found: {', '.join(missing)}"
        )


def delete_group_if_empty(conn: sqlite3.Connection, group_id: Optional[str]):
    if not group_id:
        return
    conn.execute(
        """
        DELETE FROM model_groups
        WHERE id=?
          AND NOT EXISTS (
            SELECT 1 FROM model_group_members WHERE groupId=model_groups.id
          )
        """,
        (group_id,),
    )


def add_group_members(
    conn: sqlite3.Connection, group_id: str, model_ids: List[str]
):
    model_ids = list(dict.fromkeys(model_ids))
    validate_model_ids(conn, model_ids)
    if not model_ids:
        return

    placeholders = ",".join("?" for _ in model_ids)
    assigned = conn.execute(
        f"SELECT modelId, groupId FROM model_group_members WHERE modelId IN ({placeholders})",
        model_ids,
    ).fetchall()
    conflicting = [
        row["modelId"] for row in assigned if row["groupId"] != group_id
    ]
    if conflicting:
        raise HTTPException(
            status_code=409,
            detail="One or more models already belong to another model group",
        )

    assigned_to_target = {
        row["modelId"] for row in assigned if row["groupId"] == group_id
    }
    model_ids = [
        model_id for model_id in model_ids if model_id not in assigned_to_target
    ]
    if not model_ids:
        return

    next_position = conn.execute(
        "SELECT COALESCE(MAX(position), -1) + 1 FROM model_group_members WHERE groupId=?",
        (group_id,),
    ).fetchone()[0]
    conn.executemany(
        "INSERT INTO model_group_members(modelId, groupId, position) VALUES (?,?,?)",
        [
            (model_id, group_id, next_position + offset)
            for offset, model_id in enumerate(model_ids)
        ],
    )


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


# --- Model group endpoints ---
@app.get("/api/model-groups")
def get_model_groups():
    conn = get_db_conn()
    rows = conn.execute(
        "SELECT id, name, dateAdded FROM model_groups ORDER BY name COLLATE NOCASE"
    ).fetchall()
    groups = [get_model_group(conn, row["id"]) for row in rows]
    conn.close()
    return groups


@app.post("/api/model-groups")
def create_model_group(payload: ModelGroupCreate):
    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Group name is required")

    model_ids = list(dict.fromkeys(payload.modelIds))
    group_id = str(uuid.uuid4())
    conn = get_db_conn()
    try:
        conn.execute(
            "INSERT INTO model_groups(id, name, dateAdded) VALUES (?,?,?)",
            (group_id, name, now_ms()),
        )
        add_group_members(conn, group_id, model_ids)
        conn.commit()
        return get_model_group(conn, group_id)
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


@app.patch("/api/model-groups/{group_id}")
def update_model_group(group_id: str, payload: ModelGroupUpdate):
    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Group name is required")

    conn = get_db_conn()
    try:
        get_model_group(conn, group_id)
        conn.execute("UPDATE model_groups SET name=? WHERE id=?", (name, group_id))
        conn.commit()
        return get_model_group(conn, group_id)
    finally:
        conn.close()


@app.delete("/api/model-groups/{group_id}")
def delete_model_group(group_id: str):
    conn = get_db_conn()
    try:
        get_model_group(conn, group_id)
        conn.execute("DELETE FROM model_groups WHERE id=?", (group_id,))
        conn.commit()
        return {"ok": True}
    finally:
        conn.close()


@app.post("/api/model-groups/{group_id}/models")
def add_models_to_group(group_id: str, payload: ModelGroupMembers):
    model_ids = list(dict.fromkeys(payload.modelIds))
    conn = get_db_conn()
    try:
        get_model_group(conn, group_id)
        add_group_members(conn, group_id, model_ids)
        conn.commit()
        return get_model_group(conn, group_id)
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


@app.delete("/api/model-groups/{group_id}/models/{model_id}")
def remove_model_from_group(group_id: str, model_id: str):
    conn = get_db_conn()
    try:
        get_model_group(conn, group_id)
        cursor = conn.execute(
            "DELETE FROM model_group_members WHERE groupId=? AND modelId=?",
            (group_id, model_id),
        )
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Model is not in this group")
        remaining = conn.execute(
            "SELECT COUNT(*) FROM model_group_members WHERE groupId=?", (group_id,)
        ).fetchone()[0]
        if remaining == 0:
            delete_group_if_empty(conn, group_id)
            conn.commit()
            return {"ok": True, "groupDeleted": True}
        conn.commit()
        return get_model_group(conn, group_id)
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


# --- Model endpoints ---
@app.get("/api/models")
def get_models(request: Request, folderId: Optional[str] = None):
    conn = get_db_conn()
    cur = conn.cursor()
    columns = f"""
        m.id, m.name, m.folderId, m.url, m.size, m.dateAdded, m.tags, m.description,
        NULL AS thumbnail, m.manual, mgm.groupId, mg.name AS groupName,
        CASE WHEN m.thumbnail IS NOT NULL AND m.thumbnail != '' THEN
            length(CAST(m.thumbnail AS BLOB)) || ':' ||
            hex(substr(CAST(m.thumbnail AS BLOB), 33, 16)) || ':' ||
            hex(substr(CAST(m.thumbnail AS BLOB), -16))
        END AS thumbnailSignature,
        {MODEL_VERSION_COLUMNS}
    """
    source = """
        models m
        LEFT JOIN model_group_members mgm ON mgm.modelId = m.id
        LEFT JOIN model_groups mg ON mg.id = mgm.groupId
    """
    if folderId and folderId != "all":
        cur.execute(f"SELECT {columns} FROM {source} WHERE m.folderId=?", (folderId,))
    else:
        cur.execute(f"SELECT {columns} FROM {source}")
    rows = cur.fetchall()
    conn.close()
    return [row_to_model_list_item(r, request) for r in rows]

def get_model_info(modelId):
    conn = get_db_conn()
    if modelId is not None:
        m = get_model_with_group(conn, modelId)
    else:
        return None
    conn.close()
    return row_to_model(m)

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
        "groupId": None,
        "groupName": None,
    }

    conn = get_db_conn()
    try:
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
        version_id = insert_model_version(
            conn,
            mid,
            filename=filename,
            original_name=filename_str,
            size=size,
            thumbnail=thumbnail,
            notes="Initial version",
            date_added=model["dateAdded"],
        )
        conn.commit()
        model.update(
            {
                "versionNumber": 1,
                "versionCount": 1,
                "versionIsFinal": False,
                "defaultVersionId": version_id,
                "fileExtension": ext.lstrip(".").lower(),
                "fileName": filename_str,
            }
        )
        return model
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


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
        if "thumbnail" in updates:
            cur.execute(
                "UPDATE model_versions SET thumbnail=? WHERE modelId=? AND isDefault=1",
                (updates["thumbnail"], model_id),
            )
        conn.commit()

    row = get_model_with_group(conn, model_id)
    conn.close()
    return row_to_model(row)


@app.delete("/api/models/{model_id}")
def delete_model(model_id: str):
    conn = get_db_conn()
    cur = conn.cursor()
    m = get_model_with_group(conn, model_id)
    if not m:
        conn.close()
        raise HTTPException(status_code=404, detail="Model not found")
    # Delete every revision file plus the legacy file if present
    delete_model_files(conn, model_id)
    manual_path = MANUAL_DIR / f"{model_id}.md"
    if manual_path.exists():
        try:
            manual_path.unlink()
        except Exception:
            pass
    cur.execute("DELETE FROM models WHERE id=?", (model_id,))
    delete_group_if_empty(conn, m["groupId"])
    conn.commit()
    conn.close()
    return {"ok": True}


@app.get("/api/models/{model_id}/download")
def download_model(model_id: str):
    m_info = get_model_info(model_id)
    if not m_info:
        raise HTTPException(status_code=404, detail="Model not found")

    conn = get_db_conn()
    version = conn.execute(
        """
        SELECT filename FROM model_versions
        WHERE modelId=? AND isDefault=1 AND isDeprecated=0
        """,
        (model_id,),
    ).fetchone()
    conn.close()

    candidates = []
    if version and version["filename"]:
        candidates.append(os.path.basename(version["filename"]))
    try:
        candidates.extend(
            fname
            for fname in os.listdir(UPLOAD_DIR)
            if os.path.splitext(fname)[0] == model_id
        )
    except FileNotFoundError:
        pass

    for fname in candidates:
        path = UPLOAD_DIR / fname
        if path.is_file():
            return FileResponse(
                path,
                media_type="application/octet-stream",
                filename=m_info["fileName"] or m_info["name"],
            )
    raise HTTPException(status_code=404, detail="File not found")


@app.post("/api/models/bulk-delete")
def bulk_delete(payload: dict):
    ids = payload.get("ids", [])
    conn = get_db_conn()
    cur = conn.cursor()
    affected_group_ids = set()
    for mid in ids:
        membership = cur.execute(
            "SELECT groupId FROM model_group_members WHERE modelId=?", (mid,)
        ).fetchone()
        if membership:
            affected_group_ids.add(membership["groupId"])
        # delete every revision file plus the legacy file
        delete_model_files(conn, mid)
        manual_path = MANUAL_DIR / f"{mid}.md"
        if manual_path.exists():
            try:
                manual_path.unlink()
            except Exception:
                pass
        cur.execute("DELETE FROM models WHERE id=?", (mid,))
    for group_id in affected_group_ids:
        delete_group_if_empty(conn, group_id)
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


@app.put("/api/models/{model_id}/file")
def replace_model_file(
    model_id: str,
    file: UploadFile = File(...),
    thumbnail: Optional[str] = Form(None),
    notes: Optional[str] = Form(None),
):
    """Upload a new revision. The previous revision and its file are kept."""
    conn = get_db_conn()
    try:
        m = conn.execute("SELECT * FROM models WHERE id=?", (model_id,)).fetchone()
        if not m:
            raise HTTPException(status_code=404, detail="Model not found")
        add_model_version(conn, m, file, thumbnail, notes)
        conn.commit()
        row = get_model_with_group(conn, model_id)
        return row_to_model(row)
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


@app.get("/api/models/{model_id}/thumbnail", name="get_model_thumbnail")
def get_model_thumbnail(model_id: str):
    conn = get_db_conn()
    row = conn.execute(
        "SELECT thumbnail FROM models WHERE id=?", (model_id,)
    ).fetchone()
    conn.close()
    if not row or not row["thumbnail"]:
        raise HTTPException(status_code=404, detail="Thumbnail not found")

    content = decode_thumbnail(row["thumbnail"])
    return Response(
        content=content,
        media_type=thumbnail_media_type(content),
        headers={"Cache-Control": "public, max-age=31536000, immutable"},
    )


@app.put("/api/models/{model_id}/thumbnail")
def replace_model_thumbnail(
    model_id: str, file: UploadFile = File(...)
):
    filename_str = file.filename
    ext = os.path.splitext(filename_str)[-1]
    if not ext:
        raise HTTPException(status_code=429, detail="File not Valid, Extension not found")
    
    filebytes = file.file.read()
    encoded_string = base64.b64encode(filebytes)
    baseext = ext[1:]
    thumbnail =  "data:image/" + baseext + ";base64," + encoded_string.decode()
    
    conn = get_db_conn()
    cur = conn.cursor()
    
    m = cur.execute("SELECT * FROM models WHERE id=?", (model_id,)).fetchone()
    if not m:
        conn.close()
        raise HTTPException(status_code=404, detail="Model not found")

    cur.execute(
        "UPDATE models SET thumbnail=? WHERE id=?",
        (thumbnail, model_id),
    )
    cur.execute(
        "UPDATE model_versions SET thumbnail=? WHERE modelId=? AND isDefault=1",
        (thumbnail, model_id),
    )
    conn.commit()
    row = get_model_with_group(conn, model_id)
    conn.close()
    return row_to_model(row)


# --- Model version endpoints ---
@app.get("/api/models/{model_id}/versions")
def get_model_versions(model_id: str, request: Request):
    conn = get_db_conn()
    try:
        model = conn.execute("SELECT * FROM models WHERE id=?", (model_id,)).fetchone()
        if not model:
            raise HTTPException(status_code=404, detail="Model not found")
        ensure_model_version(conn, model)
        conn.commit()
        rows = conn.execute(
            "SELECT * FROM model_versions WHERE modelId=? ORDER BY versionNumber DESC",
            (model_id,),
        ).fetchall()
        return [row_to_model_version(row, request) for row in rows]
    finally:
        conn.close()


@app.post("/api/models/{model_id}/versions")
def upload_model_version(
    model_id: str,
    file: UploadFile = File(...),
    thumbnail: Optional[str] = Form(None),
    notes: Optional[str] = Form(None),
):
    conn = get_db_conn()
    try:
        model = conn.execute("SELECT * FROM models WHERE id=?", (model_id,)).fetchone()
        if not model:
            raise HTTPException(status_code=404, detail="Model not found")
        add_model_version(conn, model, file, thumbnail, notes)
        conn.commit()
        row = get_model_with_group(conn, model_id)
        return row_to_model(row)
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


@app.get("/api/models/{model_id}/versions/{version_id}/download")
def download_model_version(model_id: str, version_id: str):
    conn = get_db_conn()
    row = conn.execute(
        """
        SELECT v.*, m.name AS modelName
        FROM model_versions v
        JOIN models m ON m.id = v.modelId
        WHERE v.id=? AND v.modelId=?
        """,
        (version_id, model_id),
    ).fetchone()
    conn.close()
    if not row:
        raise HTTPException(status_code=404, detail="Version not found")
    if row["isDeprecated"] or not row["filename"]:
        raise HTTPException(status_code=410, detail="Revision file is no longer available")
    path = UPLOAD_DIR / os.path.basename(row["filename"])
    if not path.is_file():
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(
        path,
        media_type="application/octet-stream",
        filename=row["originalName"] or row["modelName"],
    )


@app.get(
    "/api/models/{model_id}/versions/{version_id}/thumbnail",
    name="get_model_version_thumbnail",
)
def get_model_version_thumbnail(model_id: str, version_id: str):
    conn = get_db_conn()
    row = conn.execute(
        """
        SELECT thumbnail FROM model_versions
        WHERE id=? AND modelId=?
        """,
        (version_id, model_id),
    ).fetchone()
    conn.close()
    if not row or not row["thumbnail"]:
        raise HTTPException(status_code=404, detail="Thumbnail not found")
    content = decode_thumbnail(row["thumbnail"])
    return Response(
        content=content,
        media_type=thumbnail_media_type(content),
        headers={"Cache-Control": "public, max-age=31536000, immutable"},
    )


@app.patch("/api/models/{model_id}/versions/{version_id}")
def update_model_version(
    model_id: str, version_id: str, payload: ModelVersionUpdate
):
    conn = get_db_conn()
    try:
        version = conn.execute(
            "SELECT * FROM model_versions WHERE id=? AND modelId=?",
            (version_id, model_id),
        ).fetchone()
        if not version:
            raise HTTPException(status_code=404, detail="Version not found")

        if payload.notes is not None:
            conn.execute(
                "UPDATE model_versions SET notes=? WHERE id=?",
                (payload.notes, version_id),
            )

        if payload.isDefault is True:
            if version["isDeprecated"]:
                raise HTTPException(
                    status_code=400, detail="A deprecated revision cannot be the default"
                )
            conn.execute(
                "UPDATE model_versions SET isDefault=0 WHERE modelId=?", (model_id,)
            )
            conn.execute(
                "UPDATE model_versions SET isDefault=1 WHERE id=?", (version_id,)
            )
            sync_model_with_default_version(conn, model_id)
        elif payload.isDefault is False:
            raise HTTPException(
                status_code=400, detail="A model must always have a default revision"
            )

        if payload.isFinal is not None:
            if payload.isFinal and version["isDeprecated"]:
                raise HTTPException(
                    status_code=400, detail="A deprecated revision cannot be final"
                )
            if payload.isFinal:
                conn.execute(
                    "UPDATE model_versions SET isFinal=0 WHERE modelId=?", (model_id,)
                )
            conn.execute(
                "UPDATE model_versions SET isFinal=? WHERE id=?",
                (1 if payload.isFinal else 0, version_id),
            )

        conn.commit()
        row = get_model_with_group(conn, model_id)
        return row_to_model(row)
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


@app.delete("/api/models/{model_id}/versions/{version_id}")
def deprecate_model_version(model_id: str, version_id: str):
    """Keep the history entry but remove its file from disk."""
    conn = get_db_conn()
    try:
        version = conn.execute(
            "SELECT * FROM model_versions WHERE id=? AND modelId=?",
            (version_id, model_id),
        ).fetchone()
        if not version:
            raise HTTPException(status_code=404, detail="Version not found")
        if version["isDeprecated"]:
            row = get_model_with_group(conn, model_id)
            return row_to_model(row)
        if version["isDefault"]:
            raise HTTPException(
                status_code=400,
                detail="Set another revision as default before deprecating this one",
            )
        if version["isFinal"]:
            raise HTTPException(
                status_code=400,
                detail="Remove the final mark before deprecating this revision",
            )
        if version["filename"]:
            try:
                (UPLOAD_DIR / os.path.basename(version["filename"])).unlink()
            except (FileNotFoundError, OSError):
                pass
        conn.execute(
            "UPDATE model_versions SET isDeprecated=1, filename=NULL WHERE id=?",
            (version_id,),
        )
        conn.commit()
        row = get_model_with_group(conn, model_id)
        return row_to_model(row)
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


@app.get("/api/models/{model_id}/manual")
def get_model_manual(model_id: str):
    path = MANUAL_DIR / f"{model_id}.md"
    if not path.exists():
        raise HTTPException(status_code=404, detail="Manual not found")
    return FileResponse(path, media_type="text/markdown")


@app.put("/api/models/{model_id}/manual")
def upload_model_manual(model_id: str, file: UploadFile = File(...)):
    conn = get_db_conn()
    cur = conn.cursor()
    m = cur.execute("SELECT * FROM models WHERE id=?", (model_id,)).fetchone()
    if not m:
        conn.close()
        raise HTTPException(status_code=404, detail="Model not found")

    path = MANUAL_DIR / f"{model_id}.md"
    save_upload_file(file, str(path))

    cur.execute(
        "UPDATE models SET manual=? WHERE id=?",
        (file.filename, model_id),
    )
    conn.commit()
    row = get_model_with_group(conn, model_id)
    conn.close()
    return row_to_model(row)


@app.delete("/api/models/{model_id}/manual")
def delete_model_manual(model_id: str):
    conn = get_db_conn()
    cur = conn.cursor()
    m = cur.execute("SELECT * FROM models WHERE id=?", (model_id,)).fetchone()
    if not m:
        conn.close()
        raise HTTPException(status_code=404, detail="Model not found")

    path = MANUAL_DIR / f"{model_id}.md"
    if path.exists():
        try:
            path.unlink()
        except Exception:
            pass

    cur.execute("UPDATE models SET manual=NULL WHERE id=?", (model_id,))
    conn.commit()
    row = get_model_with_group(conn, model_id)
    conn.close()
    return row_to_model(row)


@app.get("/api/storage-stats")
def storage_stats():
    used = 0
    for root, _dirs, files in os.walk(UPLOAD_DIR):
        for fname in files:
            used += os.path.getsize(os.path.join(root, fname))
    total = 5 * 1024 * 1024 * 1024
    return {"used": used, "total": total}


def importer_for_url(url: str):
    if "makerworld.com" in url.lower():
        return makerworld.MakerWorldImporter(), "makerworld"
    return printables.PrintablesImporter(), "printables"


def importer_for_source(source: str):
    if source == "makerworld":
        return makerworld.MakerWorldImporter(get_setting("makerworld_bambu_token")), "MakerWorld"
    return printables.PrintablesImporter(), "Printables"


@app.get("/api/settings/makerworld-token")
def makerworld_token_status():
    return {"configured": bool(get_setting("makerworld_bambu_token"))}


@app.put("/api/settings/makerworld-token")
def update_makerworld_token(payload: dict):
    if payload.get("clear") is True:
        clear_setting("makerworld_bambu_token")
        return {"configured": False}

    token = str(payload.get("token", "")).strip()
    if not token:
        raise HTTPException(status_code=400, detail="Token is required")

    set_setting("makerworld_bambu_token", token)
    return {"configured": True}


## MODEL IMPORTS
@app.post("/api/import/importid")
def import_model_by_id(payload: dict):
    source = payload.get("source", "printables")
    importer, source_label = importer_for_source(source)
    modelId = payload.get("id")
    modelName = payload.get("name")
    parentId = payload.get("parentId")
    previewPath = payload.get("previewPath")
    folderId = payload.get("folderId", "1")
    typeName = payload.get("typeName")
    mid = str(uuid.uuid4())
    
    # we only save stl for now
    ext = typeName if typeName is not None else ".stl"
    
    filename = f"{mid}.{ext}"
    path = os.path.join(UPLOAD_DIR, filename)

    # Check if url is not None before calling importer
    try:
        if modelId is not None:
            file, thumbnail = importer.importfromId(modelId, parentId, previewPath)
            if file is not None:
                with open(path, "wb") as fh:
                    fh.write(file.content)
                size = os.path.getsize(path)
            else:
                raise ValueError("File Is Empty")
        else:
            raise ValueError("URL is None")
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    model = {
        "id": mid,
        "name": modelName,
        "folderId": folderId if folderId != "all" else "1",
        "url": f"/api/models/{mid}/download",
        "size": size,
        "dateAdded": now_ms(),
        "tags": ["imported"],
        "description": f"Imported from {source_label}",
        "thumbnail": thumbnail
    }

    conn = get_db_conn()
    try:
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
        version_id = insert_model_version(
            conn,
            mid,
            filename=filename,
            original_name=modelName or filename,
            size=size,
            thumbnail=thumbnail,
            notes="Initial version",
            date_added=model["dateAdded"],
        )
        conn.commit()
        model.update(
            {
                "versionNumber": 1,
                "versionCount": 1,
                "versionIsFinal": False,
                "defaultVersionId": version_id,
                "fileExtension": str(ext).lstrip(".").lower(),
                "fileName": modelName or filename,
            }
        )
        return model
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


@app.post("/api/import/options")
def import_model_options(payload: dict):
    url = payload.get("url")

    # Check if url is not None before calling importer
    try:
        if url is not None:
            importer, _source_label = importer_for_url(url)
            modelData = importer.getModelOptions(url)
            if modelData is not None:
                return modelData
            raise ValueError("Collection Is Empty")
        raise ValueError("URL is None")
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


## PRINTABLES IMPORTS - compatibility aliases
@app.post("/api/printables/importid")
def import_printables_model_by_id(payload: dict):
    payload["source"] = "printables"
    return import_model_by_id(payload)


@app.post("/api/printables/options")
def import_printables_model_options(payload: dict):
    return import_model_options(payload)


if __name__ == "__main__":
    import uvicorn
    
    # Ensure upload directory exists
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    
    port = int(os.getenv("PORT", "5173"))
    
    uvicorn.run(
        "app:app",
        host="0.0.0.0",
        port=port,
        reload=True,
        log_level="info"
    )
