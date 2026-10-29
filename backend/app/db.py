import logging

from motor.motor_asyncio import AsyncIOMotorClient

from app.config import settings

logger = logging.getLogger(__name__)


class Database:
    client: AsyncIOMotorClient | None = None
    db = None
    error: str | None = None


async def connect() -> None:
    Database.client = None
    Database.db = None
    Database.error = None
    if not settings.mongodb_uri.strip():
        Database.error = "MongoDB URI is missing."
        return
    try:
        client = AsyncIOMotorClient(settings.mongodb_uri, serverSelectionTimeoutMS=4000)
        await client.admin.command("ping")
        db = client[settings.mongodb_db]
        await db.documents.create_index("created_at")
        await db.chunks.create_index("document_id")
        await db.messages.create_index([("conversation_id", 1), ("created_at", 1)])
        await db.conversations.create_index("updated_at")
        Database.client = client
        Database.db = db
    except Exception:
        logger.exception("MongoDB connection failed")
        Database.error = "MongoDB is not reachable."


async def disconnect() -> None:
    if Database.client is not None:
        Database.client.close()
    Database.client = None
    Database.db = None


def get_db():
    if Database.db is None:
        raise RuntimeError(Database.error or "MongoDB is not connected.")
    return Database.db
