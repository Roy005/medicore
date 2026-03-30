"""
MediCore AI Service — Health Trends Router (Day 11)
GET /ai/patients/{id}/trends — Patient health trends analysis
"""

import logging
from typing import Any

from fastapi import APIRouter, Depends  # type: ignore

from database import get_db  # type: ignore
from models.schemas import TrendsResponse, TrendInsight  # type: ignore
from services.trends_service import TrendsService  # type: ignore
from services.patient_context import PatientContextService  # type: ignore

logger = logging.getLogger("medicore-ai.trends")

router = APIRouter(prefix="/ai/patients", tags=["Health Trends"])

# ── Singletons ────────────────────────────────────────────────────────────────
_trends_service = TrendsService()
_patient_context_service = PatientContextService()


@router.get("/{patient_id}/trends", response_model=TrendsResponse)
async def get_health_trends(
    patient_id: str,
    db: Any = Depends(get_db),
) -> TrendsResponse:
    """
    Analyze patient health trends over time.
    Returns:
      - Per-metric trend reports (direction, averages, change percentage, volatility)
      - Condition-specific health insights
      - Sorted by severity (warnings first)
    """
    # 1. Fetch patient context
    patient_context = await _patient_context_service.get_patient_context(
        patient_id, db
    )

    # 2. Run trends analysis
    result = _trends_service.analyze_trends(patient_context)

    # 3. Build response
    insights = [
        TrendInsight(severity=i["severity"], message=i["message"])
        for i in result.get("insights", [])
    ]

    logger.info(
        "Trends for %s: %d metrics, %d insights",
        patient_id, result.get("totalMetrics", 0), len(insights),
    )

    return TrendsResponse(
        patientId=result["patientId"],
        metrics=result.get("metrics", {}),
        insights=insights,
        totalMetrics=result.get("totalMetrics", 0),
        totalInsights=len(insights),
        analyzedAt=result.get("analyzedAt", ""),
    )
