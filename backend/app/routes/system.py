from fastapi import APIRouter, HTTPException

from app.config import settings
from app.db import Database, get_db

router = APIRouter(prefix="/api", tags=["system"])


def service_problems() -> list[str]:
    problems = []
    if not settings.openai_api_key.strip():
        problems.append("OpenAI API key is missing")
    if not settings.mongodb_uri.strip():
        problems.append("MongoDB URI is missing")
    elif Database.db is None:
        problems.append(Database.error or "MongoDB is not reachable")
    if not settings.pinecone_api_key.strip():
        problems.append("Pinecone API key is missing")
    return problems


def ensure_services() -> None:
    problems = service_problems()
    if problems:
        raise HTTPException(status_code=503, detail=". ".join(problems) + ".")


@router.get("/health")
async def health():
    problems = service_problems()
    return {
        "status": "ok" if not problems else "setup_required",
        "company": settings.company_name,
        "ready": not problems,
        "problems": problems,
        "services": {
            "openai": {"configured": bool(settings.openai_api_key.strip()), "model": settings.openai_chat_model},
            "embeddings": {
                "configured": bool(settings.openai_api_key.strip()),
                "model": settings.openai_embedding_model,
                "dimension": settings.embedding_dimension,
            },
            "mongodb": {
                "configured": bool(settings.mongodb_uri.strip()),
                "connected": Database.db is not None,
                "database": settings.mongodb_db,
            },
            "pinecone": {
                "configured": bool(settings.pinecone_api_key.strip()),
                "index": settings.pinecone_index,
                "namespace": settings.pinecone_namespace,
            },
        },
    }


@router.get("/stats")
async def stats():
    ensure_services()
    db = get_db()
    documents = await db.documents.count_documents({})
    ready = await db.documents.count_documents({"status": "ready"})
    chunks = await db.chunks.count_documents({})
    conversations = await db.conversations.count_documents({})
    questions = await db.messages.count_documents({"role": "user"})
    return {
        "documents": documents,
        "ready_documents": ready,
        "chunks": chunks,
        "conversations": conversations,
        "questions": questions,
    }
