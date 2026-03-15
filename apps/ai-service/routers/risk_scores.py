"""
MediCore AI Service — Risk Scores Router
GET /ai/patients/{id}/risk-scores
"""

from fastapi import APIRouter, Depends
import asyncpg

from database import get_db
from models.schemas import RiskScoreResponse, RiskDetail

router = APIRouter(prefix="/ai/patients", tags=["Risk Scores"])


@router.get("/{patient_id}/risk-scores", response_model=RiskScoreResponse)
async def get_risk_scores(
    patient_id: str,
    db: asyncpg.Pool = Depends(get_db),
):
    """
    Return cardiovascular and diabetes risk scores for a patient.
    """
    # Stub — will be wired to risk service in Day 5+
    return RiskScoreResponse(
        cardiovascular=RiskDetail(score=0.0, level="low", topFactors=[]),
        diabetes=RiskDetail(score=0.0, level="low", topFactors=[]),
    )
