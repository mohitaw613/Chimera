"""
Application configuration for CHIMERA.
Loads from environment variables or .env file with safe defaults.
"""

import os
from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    APP_NAME: str = "CHIMERA"
    # Render sets DATABASE_URL for Postgres; default falls back to SQLite for local dev
    DATABASE_URL: str = "sqlite:///./chimera.db"
    UPLOAD_DIR: str = "./data/uploads"
    MAX_UPLOAD_MB: int = 25
    # In production set this to your Vercel frontend URL, e.g. https://chimera.vercel.app
    CORS_ORIGINS: str = (
        "http://localhost:5173,http://localhost:5174,http://localhost:3000,"
        "http://127.0.0.1:5173,http://127.0.0.1:5174,http://127.0.0.1:3000"
    )
    ENABLE_LLM: bool = False
    LLM_API_KEY: str = ""

    DELAY_THRESHOLD_SECONDS: int = 300
    CLOCK_SKEW_TOLERANCE_SECONDS: int = 2
    CORRELATION_WINDOW_SECONDS: int = 900
    BUSINESS_HOURS_START: int = 7
    BUSINESS_HOURS_END: int = 19

    @property
    def cors_origins_list(self) -> List[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]


settings = Settings()

# Ensure upload directory exists
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
