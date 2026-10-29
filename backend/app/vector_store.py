import logging

from fastapi import HTTPException

from app.config import settings

logger = logging.getLogger(__name__)

_index = None


def _pinecone():
    from pinecone import Pinecone

    if not settings.pinecone_api_key.strip():
        raise HTTPException(status_code=503, detail="Pinecone API key is missing.")
    return Pinecone(api_key=settings.pinecone_api_key)


def _index_names(client) -> list[str]:
    listed = client.list_indexes()
    if hasattr(listed, "names"):
        return list(listed.names())
    names = []
    for item in listed:
        name = getattr(item, "name", None) or (item.get("name") if isinstance(item, dict) else None)
        if name:
            names.append(name)
    return names


def get_index():
    global _index
    if _index is not None:
        return _index

    from pinecone import ServerlessSpec

    client = _pinecone()
    name = settings.pinecone_index
    names = _index_names(client)
    if name not in names:
        logger.info("Creating Pinecone index %s", name)
        client.create_index(
            name=name,
            dimension=settings.embedding_dimension,
            metric="cosine",
            spec=ServerlessSpec(cloud=settings.pinecone_cloud, region=settings.pinecone_region),
        )
    else:
        info = client.describe_index(name)
        dimension = getattr(info, "dimension", None)
        if dimension and dimension != settings.embedding_dimension:
            raise HTTPException(
                status_code=500,
                detail=(
                    f"Pinecone index '{name}' uses dimension {dimension}, "
                    f"but {settings.openai_embedding_model} expects {settings.embedding_dimension}. "
                    "Set a new PINECONE_INDEX name and restart the API."
                ),
            )
    _index = client.Index(name)
    return _index


def upsert_vectors(vectors: list[dict]) -> None:
    index = get_index()
    namespace = settings.pinecone_namespace
    for start in range(0, len(vectors), 100):
        index.upsert(vectors=vectors[start : start + 100], namespace=namespace)


def query_vectors(vector: list[float], top_k: int, document_ids: list[str] | None) -> list[dict]:
    index = get_index()
    kwargs = {
        "vector": vector,
        "top_k": top_k,
        "include_metadata": True,
        "namespace": settings.pinecone_namespace,
    }
    if document_ids:
        kwargs["filter"] = {"document_id": {"$in": document_ids}}
    result = index.query(**kwargs)
    matches = getattr(result, "matches", None)
    if matches is None and isinstance(result, dict):
        matches = result.get("matches", [])
    rows = []
    for match in matches or []:
        metadata = getattr(match, "metadata", None)
        if metadata is None and isinstance(match, dict):
            metadata = match.get("metadata") or {}
        score = getattr(match, "score", None)
        if score is None and isinstance(match, dict):
            score = match.get("score")
        match_id = getattr(match, "id", None)
        if match_id is None and isinstance(match, dict):
            match_id = match.get("id")
        rows.append(
            {
                "id": match_id,
                "score": float(score or 0),
                "metadata": dict(metadata or {}),
            }
        )
    return rows


def delete_vectors(ids: list[str]) -> None:
    if not ids or not settings.pinecone_api_key.strip():
        return
    index = get_index()
    namespace = settings.pinecone_namespace
    for start in range(0, len(ids), 1000):
        index.delete(ids=ids[start : start + 1000], namespace=namespace)
