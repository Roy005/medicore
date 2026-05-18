"""
MediCore AI Service — Configuration
Loads environment variables via python-dotenv and exposes them as typed settings.
"""

import os
from functools import lru_cache
from dotenv import load_dotenv # type: ignore

load_dotenv()


class Settings:
    """Application settings loaded from environment variables."""

    # Primary LLM — Google Gemini
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")

    # Fallback LLM — OpenRouter (used when Gemini fails)
    OPENROUTER_API_KEY: str = os.getenv("OPENROUTER_API_KEY", "")
    OPENROUTER_MODEL: str = os.getenv("OPENROUTER_MODEL", "nvidia/nemotron-3-nano-30b-a3b:free")
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL",
        "postgresql://medicore:medicore_secret@localhost:5432/medicore",
    )
    PORT: int = int(os.getenv("PORT", "8001"))
    DEBUG: bool = os.getenv("DEBUG", "false").lower() == "true"


@lru_cache()
def get_settings() -> Settings:
    """Return cached settings singleton."""
    return Settings()
