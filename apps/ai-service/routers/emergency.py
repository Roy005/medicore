"""
MediCore AI Service — Emergency Flags Router
GET /ai/patients/{patient_id}/emergency-flags
Returns active emergency flags for a patient by analyzing vitals, risks, and medications.
"""

import logging
from typing import Any

from fastapi import APIRouter, Depends  # type: ignore

from database import get_db  # type: ignore
from models.schemas import EmergencyFlagResponse, EmergencyFlag  # type: ignore
from services.emergency_service import EmergencyService  # type: ignore
from services.patient_context import PatientContextService  # type: ignore

logger = logging.getLogger("medicore-ai.emergency")

router = APIRouter(prefix="/ai/patients", tags=["Emergency Flags"])

# ── Singletons ────────────────────────────────────────────────────────────────
_emergency_service = EmergencyService()
_patient_context_service = PatientContextService()


@router.get("/{patient_id}/emergency-flags", response_model=EmergencyFlagResponse)
async def get_emergency_flags(
    patient_id: str,
    db: Any = Depends(get_db),
) -> EmergencyFlagResponse:
    """
    Return any active emergency flags for a patient.
    Combines analysis from:
      1. Critical vitals anomalies
      2. High/critical risk scores
      3. Dangerous medication interactions
      4. Missing critical medications for known conditions
    """

    # 1. Fetch patient context
    patient_context = await _patient_context_service.get_patient_context(
        patient_id, db
    )
    logger.info("Emergency evaluation for patient %s", patient_id)

    # 2. Run emergency evaluation
    raw_flags = await _emergency_service.evaluate(patient_context)

    # 3. Build response
    flags = [
        EmergencyFlag(
            severity=f["severity"],  # type: ignore[arg-type]
            message=f["message"],
        )
        for f in raw_flags
    ]

    logger.info(
        "Emergency flags for patient %s: %d flags (%d critical)",
        patient_id,
        len(flags),
        sum(1 for f in flags if f.severity == "critical"),
    )

    return EmergencyFlagResponse(flags=flags)
