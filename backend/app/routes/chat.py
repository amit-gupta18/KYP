from datetime import datetime, timezone
from uuid import uuid4

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.db import get_db
from app.rag import answer_question
from app.routes.system import ensure_services
from app.serializers import conversation_out, message_out

router = APIRouter(prefix="/api", tags=["chat"])


def _now() -> datetime:
    return datetime.now(timezone.utc)


class QuestionIn(BaseModel):
    question: str = Field(min_length=1, max_length=2000)
    conversation_id: str | None = None
    document_ids: list[str] | None = None


@router.get("/conversations")
async def list_conversations():
    ensure_services()
    db = get_db()
    cursor = db.conversations.find({}).sort("updated_at", -1).limit(100)
    items = [conversation_out(doc) async for doc in cursor]
    return {"conversations": items}


@router.get("/conversations/{conversation_id}")
async def get_conversation(conversation_id: str):
    ensure_services()
    db = get_db()
    conversation = await db.conversations.find_one({"_id": conversation_id})
    if not conversation:
        raise HTTPException(status_code=404, detail="That conversation is no longer available.")
    cursor = db.messages.find({"conversation_id": conversation_id}).sort("created_at", 1)
    messages = [message_out(doc) async for doc in cursor]
    payload = conversation_out(conversation)
    payload["messages"] = messages
    return payload


@router.delete("/conversations/{conversation_id}")
async def delete_conversation(conversation_id: str):
    ensure_services()
    db = get_db()
    result = await db.conversations.delete_one({"_id": conversation_id})
    await db.messages.delete_many({"conversation_id": conversation_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="That conversation is no longer available.")
    return {"ok": True}


@router.post("/questions")
async def ask(body: QuestionIn):
    question = " ".join(body.question.split())
    if len(question) < 2:
        raise HTTPException(status_code=400, detail="Ask a question of at least a few words.")
    ensure_services()
    db = get_db()
    now = _now()
    conversation_id = body.conversation_id
    history: list[dict] = []

    if conversation_id:
        conversation = await db.conversations.find_one({"_id": conversation_id})
        if not conversation:
            raise HTTPException(status_code=404, detail="That conversation is no longer available.")
        history = await db.messages.find({"conversation_id": conversation_id}).sort("created_at", 1).to_list(length=40)
    else:
        conversation_id = uuid4().hex
        title = question if len(question) <= 80 else question[:77].rstrip() + "…"
        await db.conversations.insert_one(
            {
                "_id": conversation_id,
                "title": title,
                "message_count": 0,
                "created_at": now,
                "updated_at": now,
            }
        )

    document_ids = [item for item in (body.document_ids or []) if item]
    answer, sources = await answer_question(question, document_ids or None, history)

    user_id = uuid4().hex
    assistant_id = uuid4().hex
    user_doc = {
        "_id": user_id,
        "conversation_id": conversation_id,
        "role": "user",
        "content": question,
        "sources": [],
        "document_ids": document_ids,
        "created_at": now,
    }
    assistant_doc = {
        "_id": assistant_id,
        "conversation_id": conversation_id,
        "role": "assistant",
        "content": answer,
        "sources": sources,
        "created_at": _now(),
    }
    await db.messages.insert_many([user_doc, assistant_doc])
    await db.conversations.update_one(
        {"_id": conversation_id},
        {"$set": {"updated_at": assistant_doc["created_at"]}, "$inc": {"message_count": 2}},
    )
    return {
        "conversation_id": conversation_id,
        "user_message": message_out(user_doc),
        "assistant_message": message_out(assistant_doc),
    }
