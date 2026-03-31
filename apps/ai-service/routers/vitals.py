"""
MediCore AI Service — Vitals Router
POST /ai/vitals/analyze — Detect anomalies in patient vital signs.
"""

import logging
from typing import Any

from fastapi import APIRouter, Depends  # type: ignore
import asyncpg  # type: ignore

from database import get_db  # type: ignore
from models.schemas import (  # type: ignore
    VitalsAnalyzeRequest, VitalsAnalyzeResponse, VitalsAnomaly,
)
from services.vitals_service import VitalsService  # type: ignore

logger = logging.getLogger("medicore-ai.vitals")

router = APIRouter(prefix="/ai/vitals", tags=["Vitals"])

# ── Singleton ─────────────────────────────────────────────────────────────────
_vitals_service = VitalsService()


@router.post("/analyze", response_model=VitalsAnalyzeResponse)
async def analyze_vitals(
    request: VitalsAnalyzeRequest,
    db: Any = Depends(get_db),
) -> VitalsAnalyzeResponse:
    """
    Analyze recent patient vitals and return detected anomalies.
    1. Parses incoming vital records
    2. Compares against personalized thresholds
    3. Returns anomalies sorted by severity (critical first)
    """

    # Convert Pydantic VitalRecord models to dicts for the service
    vitals_dicts = [
        {
            "metric": v.metric,
            "value": v.value,
            "timestamp": v.timestamp.isoformat() if v.timestamp else None,
        }
        for v in request.recentVitals
    ]

    # Run anomaly detection
    anomalies_raw = await _vitals_service.analyze(
        recent_vitals=vitals_dicts,
        baseline=request.patientBaseline,
    )

    # Convert to response model
    anomalies = [
        VitalsAnomaly(
            metric=a["metric"],
            value=a["value"],
            threshold=a["threshold"],
            severity=a["severity"],
            message=a["message"],
        )
        for a in anomalies_raw
    ]

    logger.info(
        "Vitals analysis for patient %s: %d anomalies found",
        request.patientId, len(anomalies),
    )

    return VitalsAnalyzeResponse(anomalies=anomalies)
