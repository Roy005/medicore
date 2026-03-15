"""
MediCore AI Service — Vitals Router
POST /ai/vitals/analyze
"""

from fastapi import APIRouter, Depends
import asyncpg

from database import get_db
from models.schemas import VitalsAnalyzeRequest, VitalsAnalyzeResponse

router = APIRouter(prefix="/ai/vitals", tags=["Vitals"])


@router.post("/analyze", response_model=VitalsAnalyzeResponse)
async def analyze_vitals(
    request: VitalsAnalyzeRequest,
    db: asyncpg.Pool = Depends(get_db),
):
    """
    Analyze recent vitals and return detected anomalies.
    """
    # Stub — will be wired to vitals service in Day 7+
    return VitalsAnalyzeResponse(anomalies=[])
