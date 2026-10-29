import logging
from datetime import datetime, timezone

from fastapi import HTTPException
from openai import APIConnectionError, APIStatusError, AuthenticationError, RateLimitError

from app.config import settings
from app.db import get_db
from app.text import chunk_text, extract_text, for_embedding
from app.vector_store import delete_vectors, query_vectors, upsert_vectors

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You answer questions about company policy for employees and HR.

Rules:
- Use only the numbered policy excerpts in the latest user message. Do not use outside knowledge.
- Conversation history only clarifies what the person is asking. Policy facts must come from the excerpts.
- If the excerpts do not contain the answer, say exactly: "I couldn't find that in the uploaded policy documents." Do not guess.
- Write in clear, professional language. Use short paragraphs and bullet lists for rules, eligibility, or steps.
- Cite excerpts you use with their numbers, like [1] or [2].
- Do not invent policy names, dates, amounts, or approval steps.
"""

_openai = None


def openai_client():
    global _openai
    if not settings.openai_api_key.strip():
        raise HTTPException(status_code=503, detail="OpenAI API key is missing.")
    if _openai is None:
        from openai import AsyncOpenAI

        _openai = AsyncOpenAI(api_key=settings.openai_api_key)
    return _openai


def friendly_openai_error(exc: Exception) -> str:
    if isinstance(exc, AuthenticationError):
        return "OpenAI rejected the API key. Check OPENAI_API_KEY and restart the API."
    if isinstance(exc, RateLimitError):
        return "OpenAI rate limit reached. Wait a moment and try again."
    if isinstance(exc, APIConnectionError):
        return "Could not reach OpenAI. Check the network and try again."
    if isinstance(exc, APIStatusError):
        return "OpenAI could not complete that request. Try again in a moment."
    return "The language model request failed."


async def embed_texts(texts: list[str]) -> list[list[float]]:
    if not texts:
        return []
    client = openai_client()
    vectors: list[list[float]] = []
    try:
        for start in range(0, len(texts), 32):
            batch = texts[start : start + 32]
            response = await client.embeddings.create(model=settings.openai_embedding_model, input=batch)
            ordered = sorted(response.data, key=lambda item: item.index)
            vectors.extend(item.embedding for item in ordered)
    except Exception as exc:
        logger.exception("Embedding request failed")
        raise HTTPException(status_code=502, detail=friendly_openai_error(exc)) from exc
    return vectors


def build_context(excerpts: list[dict]) -> str:
    blocks = []
    for index, excerpt in enumerate(excerpts, start=1):
        blocks.append(f"[{index}] Document: {excerpt['filename']}\n{excerpt['text']}")
    return "\n\n".join(blocks)


def build_messages(question: str, excerpts: list[dict], history: list[dict]) -> list[dict]:
    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    for item in history[-8:]:
        if item.get("role") in {"user", "assistant"} and item.get("content"):
            messages.append({"role": item["role"], "content": item["content"]})
    messages.append(
        {
            "role": "user",
            "content": f"Policy excerpts:\n\n{build_context(excerpts)}\n\nQuestion: {question}",
        }
    )
    return messages


async def ingest_document(document_id: str, filename: str, data: bytes) -> None:
    db = get_db()
    try:
        text = extract_text(filename, data)
        chunks = chunk_text(text, size=settings.chunk_size, overlap=settings.chunk_overlap)
        if not chunks:
            await _mark_failed(document_id, "No readable text was found in that file.")
            return
        if not await _exists(document_id):
            return

        vectors = await embed_texts([for_embedding(chunk["text"]) for chunk in chunks])
        if not await _exists(document_id):
            return

        chunk_docs = []
        pinecone_vectors = []
        for chunk, vector in zip(chunks, vectors):
            vector_id = f"{document_id}_{chunk['index']}"
            chunk_docs.append(
                {
                    "_id": vector_id,
                    "document_id": document_id,
                    "index": chunk["index"],
                    "text": chunk["text"],
                    "filename": filename,
                }
            )
            pinecone_vectors.append(
                {
                    "id": vector_id,
                    "values": vector,
                    "metadata": {
                        "document_id": document_id,
                        "filename": filename[:180],
                        "chunk_index": chunk["index"],
                        "text": chunk["text"][:1000],
                    },
                }
            )

        await db.chunks.insert_many(chunk_docs)
        upsert_vectors(pinecone_vectors)
        if not await _exists(document_id):
            delete_vectors([item["id"] for item in pinecone_vectors])
            await db.chunks.delete_many({"document_id": document_id})
            return

        page_count = text.count("[Page ")
        await db.documents.update_one(
            {"_id": document_id},
            {
                "$set": {
                    "status": "ready",
                    "error": None,
                    "chunk_count": len(chunk_docs),
                    "page_count": page_count or None,
                    "updated_at": _now(),
                }
            },
        )
    except ValueError as exc:
        await _mark_failed(document_id, str(exc))
    except HTTPException as exc:
        detail = exc.detail if isinstance(exc.detail, str) else "Indexing failed."
        await _mark_failed(document_id, detail)
        await _cleanup_partial(document_id)
    except Exception:
        logger.exception("Document ingest failed for %s", document_id)
        await _mark_failed(document_id, "Indexing failed. Check the API logs, then upload the file again.")
        await _cleanup_partial(document_id)


async def remove_document_vectors(document_id: str) -> None:
    db = get_db()
    cursor = db.chunks.find({"document_id": document_id}, {"_id": 1})
    ids = [item["_id"] async for item in cursor]
    await db.chunks.delete_many({"document_id": document_id})
    if not ids:
        return
    try:
        delete_vectors(ids)
    except Exception:
        logger.exception("Pinecone delete failed for %s", document_id)


async def answer_question(
    question: str,
    document_ids: list[str] | None,
    history: list[dict],
) -> tuple[str, list[dict]]:
    db = get_db()
    query = {"status": "ready"}
    if document_ids:
        query["_id"] = {"$in": document_ids}
    ready = await db.documents.find(query, {"_id": 1, "filename": 1}).to_list(length=500)
    if not ready:
        raise HTTPException(
            status_code=400,
            detail="Upload a policy and wait until it is ready before asking a question.",
        )

    allowed = {item["_id"] for item in ready}
    embedded = await embed_texts([for_embedding(question)])
    matches = query_vectors(embedded[0], settings.rag_top_k, list(allowed) if document_ids else None)

    seen = set()
    excerpts = []
    for match in matches:
        metadata = match["metadata"]
        document_id = metadata.get("document_id")
        if document_id not in allowed or match["id"] in seen:
            continue
        seen.add(match["id"])
        stored = await db.chunks.find_one({"_id": match["id"]})
        text = (stored or {}).get("text") or metadata.get("text") or ""
        if not text:
            continue
        filename = (stored or {}).get("filename") or metadata.get("filename") or "Policy"
        excerpts.append(
            {
                "document_id": document_id,
                "filename": filename,
                "excerpt": text,
                "score": round(match["score"], 3),
            }
        )

    if not excerpts:
        return (
            "I couldn't find that in the uploaded policy documents.",
            [],
        )

    messages = build_messages(question, excerpts, history)
    client = openai_client()
    try:
        completion = await client.chat.completions.create(
            model=settings.openai_chat_model,
            temperature=0.1,
            messages=messages,
        )
    except Exception as exc:
        logger.exception("Chat completion failed")
        raise HTTPException(status_code=502, detail=friendly_openai_error(exc)) from exc

    content = (completion.choices[0].message.content or "").strip()
    if not content:
        content = "I couldn't find that in the uploaded policy documents."

    sources = []
    for index, excerpt in enumerate(excerpts, start=1):
        sources.append(
            {
                "index": index,
                "document_id": excerpt["document_id"],
                "filename": excerpt["filename"],
                "excerpt": excerpt["excerpt"],
                "score": excerpt["score"],
            }
        )
    return content, sources


async def _exists(document_id: str) -> bool:
    db = get_db()
    return await db.documents.find_one({"_id": document_id}, {"_id": 1}) is not None


async def _mark_failed(document_id: str, message: str) -> None:
    db = get_db()
    await db.documents.update_one(
        {"_id": document_id},
        {"$set": {"status": "failed", "error": message, "updated_at": _now()}},
    )


async def _cleanup_partial(document_id: str) -> None:
    try:
        await remove_document_vectors(document_id)
    except Exception:
        logger.exception("Cleanup failed for %s", document_id)


def _now() -> datetime:
    return datetime.now(timezone.utc)
