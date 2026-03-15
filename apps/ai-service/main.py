"""
MediCore AI Service — Entry Point
FastAPI application with CORS, health check, and all routers.
"""

import logging
from contextlib import asynccontextmanager
from datetime import datetime, timezone

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import get_settings
from database import create_pool, close_pool
from models.schemas import HealthResponse

from routers import advisor, risk_scores, emergency, vitals

# ── Logging ───────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s — %(message)s",
)
logger = logging.getLogger("medicore-ai")


# ── Lifespan (startup / shutdown) ─────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application startup and shutdown events."""
    settings = get_settings()
    logger.info("Starting MediCore AI Service on port %s", settings.PORT)

    # Startup — connect to the database
    try:
        pool = await create_pool()
        logger.info("Connected to PostgreSQL (%s)", settings.DATABASE_URL.split("@")[-1])
    except Exception as exc:
        logger.warning("Could not connect to PostgreSQL — running without DB: %s", exc)

    yield

    # Shutdown — release the pool
    logger.info("Shutting down MediCore AI Service …")
    await close_pool()


# ── FastAPI App ───────────────────────────────────────────────────────────────
app = FastAPI(
    title="MediCore AI Service",
    description="AI-powered medical advisor, risk scoring, and vitals analysis.",
    version="0.1.0",
    lifespan=lifespan,
)

# ── CORS (allow all for local dev) ────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Mount Routers ─────────────────────────────────────────────────────────────
app.include_router(advisor.router)
app.include_router(risk_scores.router)
app.include_router(emergency.router)
app.include_router(vitals.router)


# ── Health Check ──────────────────────────────────────────────────────────────
@app.get("/health", response_model=HealthResponse, tags=["Health"])
async def health_check():
    """Return service health status."""
    return HealthResponse(
        status="ok",
        timestamp=datetime.now(timezone.utc),
    )
