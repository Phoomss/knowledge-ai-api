from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "KnowledgeAI Engine"
    app_env: str = "development"
    database_url: str
    gemini_api_key: str
    gemini_model: str = "gemini-2.5-flash"
    embedding_model: str = "BAAI/bge-m3"
    embedding_dimension: int = 1024
    rag_top_k: int = 5
    rag_score_threshold: float = 0.45
    rag_max_context_tokens: int = 6000
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()
