"""
MediCore AI Service — Medication Safety Router (Day 11)
POST /ai/medications/check — Standalone medication safety checker
"""

import logging
from typing import Any

from fastapi import APIRouter  # type: ignore

from models.schemas import (  # type: ignore
    MedicationCheckRequest, MedicationCheckResponse,
)
from services.medication_service import MedicationSafetyService  # type: ignore

logger = logging.getLogger("medicore-ai.medications")

router = APIRouter(prefix="/ai/medications", tags=["Medication Safety"])

# ── Singleton ─────────────────────────────────────────────────────────────────
_med_service = MedicationSafetyService()


@router.post("/check", response_model=MedicationCheckResponse)
async def check_medications(
    request: MedicationCheckRequest,
) -> MedicationCheckResponse:
    """
    Check a list of medications for safety issues:
      1. Drug-drug interactions (14 known dangerous pairs)
      2. Drug-allergy conflicts (12 drug-allergen maps)
      3. Duplicate therapy detection (8 drug classes)
      4. Condition contraindications (8 rules)

    Returns a safety report with all detected issues.
    """
    result = _med_service.check_all(
        medications=request.medications,
        allergies=request.allergies,
        conditions=request.conditions,
    )

    logger.info(
        "Med safety check for %s: %d meds → %d issues (safe=%s)",
        request.patientId, len(request.medications),
        result["totalIssues"], result["safe"],
    )

    return MedicationCheckResponse(**result)
