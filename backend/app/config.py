from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parents[1]
ROOT_DIR = BACKEND_DIR.parent


class Settings(BaseSettings):
    openai_api_key: str = ""
    openai_chat_model: str = "gpt-4o-mini"
    openai_embedding_model: str = "text-embedding-3-small"
    embedding_dimension: int = 1536

    mongodb_uri: str = ""
    mongodb_db: str = "policy_qa"

    pinecone_api_key: str = ""
    pinecone_index: str = "policy-qa"
    pinecone_cloud: str = "aws"
    pinecone_region: str = "us-east-1"
    pinecone_namespace: str = "policies"

    company_name: str = "Policy workspace"
    max_upload_mb: int = 20
    rag_top_k: int = 6
    chunk_size: int = 1200
    chunk_overlap: int = 200
    cors_origins: str = "*"

    model_config = SettingsConfigDict(
        env_file=(BACKEND_DIR / ".env", ROOT_DIR / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def cors_origin_list(self) -> list[str]:
        raw = [item.strip() for item in self.cors_origins.split(",") if item.strip()]
        return raw or ["*"]


settings = Settings()
