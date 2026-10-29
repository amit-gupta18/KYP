from datetime import datetime, timezone


def iso(value: datetime | None) -> str | None:
    if value is None:
        return None
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.isoformat()


def document_out(doc: dict, preview: str | None = None) -> dict:
    payload = {
        "id": doc["_id"],
        "filename": doc["filename"],
        "extension": doc.get("extension") or "",
        "size_bytes": doc.get("size_bytes") or 0,
        "status": doc.get("status") or "processing",
        "error": doc.get("error"),
        "chunk_count": doc.get("chunk_count") or 0,
        "page_count": doc.get("page_count"),
        "created_at": iso(doc.get("created_at")),
        "updated_at": iso(doc.get("updated_at")),
    }
    if preview is not None:
        payload["preview"] = preview
    return payload


def conversation_out(doc: dict) -> dict:
    return {
        "id": doc["_id"],
        "title": doc.get("title") or "New question",
        "created_at": iso(doc.get("created_at")),
        "updated_at": iso(doc.get("updated_at")),
        "message_count": doc.get("message_count") or 0,
    }


def message_out(doc: dict) -> dict:
    return {
        "id": doc["_id"],
        "role": doc["role"],
        "content": doc.get("content") or "",
        "sources": doc.get("sources") or [],
        "created_at": iso(doc.get("created_at")),
    }
