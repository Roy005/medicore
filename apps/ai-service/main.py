"""
MediCore AI Service — Entry Point (v1.0.0)
FastAPI application with CORS, request logging, error handling, and all routers.
"""

import logging
import time
import traceback
from contextlib import asynccontextmanager
from datetime import datetime, timezone

from fastapi import FastAPI, Request  # type: ignore
from fastapi.middleware.cors import CORSMiddleware  # type: ignore
from fastapi.responses import JSONResponse  # type: ignore
from pydantic import ValidationError  # type: ignore

from config import get_settings  # type: ignore
from database import create_pool, close_pool  # type: ignore
from models.schemas import HealthResponse, ServiceStatsResponse  # type: ignore

from routers import advisor, risk_scores, emergency, vitals, medications, trends, symptoms, careplan, wellness, report, goals, alerts, timeline, benchmarks  # type: ignore

# ── Logging ───────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s — %(message)s",
)
logger = logging.getLogger("medicore-ai")

# ── Startup time tracker ─────────────────────────────────────────────────────
_start_time: float = time.time()


# ── Lifespan (startup / shutdown) ─────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):  # type: ignore
    """Manage application startup and shutdown events."""
    global _start_time
    _start_time = time.time()

    settings = get_settings()
    logger.info("Starting MediCore AI Service v1.0.0 on port %s", settings.PORT)

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
    description=(
        "AI-powered medical advisor, risk scoring, vitals anomaly detection, "
        "and emergency flag generation. Built for the MediCore health platform.\n\n"
        "## Endpoints\n"
        "- **POST /ai/advisor/chat** — RAG health advisor with crisis detection\n"
        "- **GET /ai/patients/{id}/risk-scores** — Cardiovascular & T2D risk scores\n"
        "- **GET /ai/patients/{id}/emergency-flags** — Real-time emergency alerts\n"
        "- **POST /ai/vitals/analyze** — Vitals anomaly detection\n"
        "- **GET /ai/patients/{id}/conversations** — Conversation history\n"
        "- **GET /ai/patients/{id}/summary** — Full patient AI summary\n"
        "- **GET /ai/stats** — Service statistics & uptime\n"
    ),
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# ── CORS ──────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Global Error Handlers ────────────────────────────────────────────────────

@app.exception_handler(ValidationError)
async def validation_error_handler(request: Request, exc: ValidationError):  # type: ignore
    """Return structured 422 errors for Pydantic validation failures."""
    logger.warning("Validation error on %s %s: %s", request.method, request.url.path, exc.error_count())
    return JSONResponse(
        status_code=422,
        content={
            "error": "Validation Error",
            "detail": exc.errors(),
            "path": str(request.url.path),
        },
    )


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):  # type: ignore
    """Catch-all handler to prevent 500 stack traces from leaking to clients."""
    logger.error(
        "Unhandled exception on %s %s: %s\n%s",
        request.method, request.url.path, exc,
        traceback.format_exc(),
    )
    return JSONResponse(
        status_code=500,
        content={
            "error": "Internal Server Error",
            "message": "An unexpected error occurred. Please try again later.",
            "path": str(request.url.path),
        },
    )


# ── Request Logging Middleware ────────────────────────────────────────────────
@app.middleware("http")
async def request_logging_middleware(request: Request, call_next):  # type: ignore
    """Log every incoming request with method, path, and response time."""
    start = time.time()
    response = await call_next(request)
    duration_ms = (time.time() - start) * 1000

    # Skip logging for health checks (too noisy)
    if request.url.path != "/health":
        logger.info(
            "%s %s → %d (%.1fms)",
            request.method, request.url.path,
            response.status_code, duration_ms,
        )

    return response


# ── Mount Routers ─────────────────────────────────────────────────────────────
app.include_router(advisor.router)
app.include_router(risk_scores.router)
app.include_router(emergency.router)
app.include_router(vitals.router)
app.include_router(medications.router)
app.include_router(trends.router)
app.include_router(symptoms.router)
app.include_router(careplan.router)
app.include_router(wellness.router)
app.include_router(report.router)
app.include_router(goals.router)
app.include_router(alerts.router)
app.include_router(timeline.router)
app.include_router(benchmarks.router)


# ── Health Check ──────────────────────────────────────────────────────────────
@app.get("/health", response_model=HealthResponse, tags=["Health"])
async def health_check():
    """Return service health status."""
    return HealthResponse(
        status="ok",
        timestamp=datetime.now(timezone.utc),
    )


# ── Service Stats ────────────────────────────────────────────────────────────
@app.get("/ai/stats", response_model=ServiceStatsResponse, tags=["Admin"])
async def get_service_stats():
    """Return overall service statistics including uptime and conversation counts."""
    # Access the singleton from the advisor router
    conv_svc = advisor._conversation_service
    stats = conv_svc.get_stats()

    elapsed = time.time() - _start_time
    hours = int(elapsed // 3600)
    minutes = int((elapsed % 3600) // 60)
    seconds = int(elapsed % 60)

    return ServiceStatsResponse(
        status="ok",
        totalPatients=stats["totalPatients"],
        totalConversations=stats["totalConversations"],
        safetyTriggers=stats["safetyTriggers"],
        uptime=f"{hours}h {minutes}m {seconds}s",
    )
