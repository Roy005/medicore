"""
MediCore AI Service — Wellness Score Router (Day 13)
GET /ai/patients/{id}/wellness-score — Composite wellness score
"""

import logging
from typing import Any

from fastapi import APIRouter, Depends  # type: ignore

from database import get_db  # type: ignore
from models.schemas import WellnessScoreResponse  # type: ignore
from services.wellness_service import WellnessScoreService  # type: ignore
from services.patient_context import PatientContextService  # type: ignore

logger = logging.getLogger("medicore-ai.wellness")

router = APIRouter(prefix="/ai/patients", tags=["Wellness Score"])

_wellness_service = WellnessScoreService()
_patient_context_service = PatientContextService()


@router.get("/{patient_id}/wellness-score", response_model=WellnessScoreResponse)
async def get_wellness_score(
    patient_id: str,
    db: Any = Depends(get_db),
) -> WellnessScoreResponse:
    """
    Calculate composite wellness score (0-100) combining:
      - Cardiovascular risk (25%)
      - Diabetes risk (20%)
      - Vitals stability (25%)
      - Medication safety (15%)
      - Emergency flag status (15%)
    """
    patient_context = await _patient_context_service.get_patient_context(
        patient_id, db
    )

    result = await _wellness_service.compute(patient_context)

    return WellnessScoreResponse(
        overallScore=result["overallScore"],
        level=result["level"],
        label=result["label"],
        breakdown=result["breakdown"],
        improvementTips=result["improvementTips"],
        calculatedAt=result["calculatedAt"],
    )
