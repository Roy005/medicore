"""
MediCore AI Service — Database
Asyncpg connection pool management with FastAPI dependency injection.
"""

import asyncpg
from config import get_settings

# Global connection pool reference
_pool: asyncpg.Pool | None = None


async def create_pool() -> asyncpg.Pool:
    """Create and return an asyncpg connection pool."""
    global _pool
    settings = get_settings()
    _pool = await asyncpg.create_pool(
        dsn=settings.DATABASE_URL,
        min_size=2,
        max_size=10,
        command_timeout=30,
    )
    return _pool


async def close_pool() -> None:
    """Close the connection pool gracefully."""
    global _pool
    if _pool:
        await _pool.close()
        _pool = None


async def get_db() -> asyncpg.Pool | None:
    """
    FastAPI dependency — yields the connection pool.
    Returns None if the pool hasn't been created (e.g. DB unavailable).
    Usage:
        @router.get("/example")
        async def example(db = Depends(get_db)):
            ...
    """
    return _pool
