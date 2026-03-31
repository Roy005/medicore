"""
MediCore AI Service — Health Report Router (Day 13)
GET /ai/patients/{id}/health-report — Comprehensive health report
"""

import logging
from typing import Any

from fastapi import APIRouter, Depends  # type: ignore

from database import get_db  # type: ignore
from models.schemas import HealthReportResponse  # type: ignore
from services.report_service import HealthReportService  # type: ignore
from services.patient_context import PatientContextService  # type: ignore
from routers.advisor import _conversation_service  # type: ignore

logger = logging.getLogger("medicore-ai.report")

router = APIRouter(prefix="/ai/patients", tags=["Health Report"])

_patient_context_service = PatientContextService()
_report_service = HealthReportService(_conversation_service)


@router.get("/{patient_id}/health-report", response_model=HealthReportResponse)
async def get_health_report(
    patient_id: str,
    db: Any = Depends(get_db),
) -> HealthReportResponse:
    """
    Generate a comprehensive health report aggregating ALL AI services:
      - Wellness score & breakdown
      - Risk scores (cardiovascular + diabetes)
      - Vitals analysis & anomalies
      - Emergency flags
      - Medication safety check
      - Health trends & insights
      - Care plan highlights
      - Recent conversation history
      - Executive summary
    """
    patient_context = await _patient_context_service.get_patient_context(
        patient_id, db
    )

    result = await _report_service.generate(patient_context)

    return HealthReportResponse(**result)
