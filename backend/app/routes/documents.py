from datetime import datetime, timezone
from uuid import uuid4

from fastapi import APIRouter, BackgroundTasks, File, HTTPException, UploadFile

from app.config import settings
from app.db import get_db
from app.rag import ingest_document, remove_document_vectors
from app.routes.system import ensure_services
from app.serializers import document_out
from app.text import ALLOWED_EXTENSIONS, extension_of, safe_filename

router = APIRouter(prefix="/api/documents", tags=["documents"])


def _now() -> datetime:
    return datetime.now(timezone.utc)


@router.get("")
async def list_documents():
    ensure_services()
    db = get_db()
    cursor = db.documents.find({}).sort("created_at", -1).limit(200)
    items = [document_out(doc) async for doc in cursor]
    return {"documents": items}


@router.get("/{document_id}")
async def get_document(document_id: str):
    ensure_services()
    db = get_db()
    doc = await db.documents.find_one({"_id": document_id})
    if not doc:
        raise HTTPException(status_code=404, detail="That policy is no longer in the library.")
    chunks = (
        await db.chunks.find({"document_id": document_id}).sort("index", 1).limit(3).to_list(length=3)
    )
    preview = "\n\n".join(chunk["text"] for chunk in chunks)[:1800]
    return document_out(doc, preview=preview)


@router.post("")
async def upload_document(background_tasks: BackgroundTasks, file: UploadFile = File(...)):
    filename = safe_filename(file.filename)
    extension = extension_of(filename)
    if extension not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail="Upload a PDF, Word (.docx), Markdown, or plain text file.",
        )
    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="That file is empty.")
    limit = settings.max_upload_mb * 1024 * 1024
    if len(data) > limit:
        raise HTTPException(
            status_code=400,
            detail=f"Files must be {settings.max_upload_mb} MB or smaller.",
        )
    ensure_services()
    db = get_db()
    document_id = uuid4().hex
    now = _now()
    await db.documents.insert_one(
        {
            "_id": document_id,
            "filename": filename,
            "extension": extension,
            "size_bytes": len(data),
            "status": "processing",
            "error": None,
            "chunk_count": 0,
            "page_count": None,
            "created_at": now,
            "updated_at": now,
        }
    )
    background_tasks.add_task(ingest_document, document_id, filename, data)
    saved = await db.documents.find_one({"_id": document_id})
    return document_out(saved)


@router.delete("/{document_id}")
async def delete_document(document_id: str):
    ensure_services()
    db = get_db()
    doc = await db.documents.find_one({"_id": document_id})
    if not doc:
        raise HTTPException(status_code=404, detail="That policy is no longer in the library.")
    await db.documents.delete_one({"_id": document_id})
    await remove_document_vectors(document_id)
    return {"ok": True}
