from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    app_name: str = "Check Pilot Web"
    debug: bool = False

    # PostgreSQL
    database_url: str = "postgresql://pilot:pilot123@db:5432/checkpilot"

    # Security
    secret_key: str = "change-me-in-production-please"
    encryption_key: str = ""  # Fernet key, auto-generated if empty

    # CORS
    cors_origins: list[str] = ["http://localhost:3000", "http://localhost:5173"]

    class Config:
        env_file = ".env"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
