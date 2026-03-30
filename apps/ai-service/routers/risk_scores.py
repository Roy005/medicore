"""
MediCore AI Service — Risk Scores Router
GET /ai/patients/{patient_id}/risk-scores
Returns cardiovascular and Type 2 Diabetes risk scores for a patient.
"""

import logging
from typing import Any

from fastapi import APIRouter, Depends  # type: ignore
import asyncpg  # type: ignore

from database import get_db  # type: ignore
from models.schemas import RiskScoreResponse, RiskDetail  # type: ignore
from services.risk_service import RiskService  # type: ignore
from services.patient_context import PatientContextService  # type: ignore

logger = logging.getLogger("medicore-ai.risk-scores")

router = APIRouter(prefix="/ai/patients", tags=["Risk Scores"])

# ── Singletons ────────────────────────────────────────────────────────────────
_risk_service = RiskService()
_patient_context_service = PatientContextService()


@router.get("/{patient_id}/risk-scores", response_model=RiskScoreResponse)
async def get_risk_scores(
    patient_id: str,
    db: Any = Depends(get_db),
) -> RiskScoreResponse:
    """
    Return cardiovascular and diabetes risk scores for a patient.
    1. Fetches patient context (demographics, vitals, conditions, meds)
    2. Runs both scoring algorithms
    3. Returns scores with top contributing factors
    """

    # 1. Fetch patient context
    patient_context = await _patient_context_service.get_patient_context(
        patient_id, db
    )
    logger.info("Risk scoring for patient %s", patient_id)

    # 2. Compute both risk scores
    cv_risk = await _risk_service.compute_cardiovascular_risk(patient_context)
    t2d_risk = await _risk_service.compute_diabetes_risk(patient_context)

    # 3. Build response
    return RiskScoreResponse(
        cardiovascular=RiskDetail(
            score=cv_risk["score"],
            level=cv_risk["level"],
            topFactors=cv_risk["topFactors"],
        ),
        diabetes=RiskDetail(
            score=t2d_risk["score"],
            level=t2d_risk["level"],
            topFactors=t2d_risk["topFactors"],
        ),
    )
