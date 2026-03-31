"""
MediCore AI Service — Care Plan Router (Day 12)
GET /ai/patients/{id}/care-plan — Personalized care plan generation
"""

import logging
from typing import Any

from fastapi import APIRouter, Depends  # type: ignore

from database import get_db  # type: ignore
from models.schemas import (  # type: ignore
    CarePlanResponse, ConditionCarePlan, RiskAction, MedicationReminder,
)
from services.careplan_service import CarePlanService  # type: ignore
from services.patient_context import PatientContextService  # type: ignore

logger = logging.getLogger("medicore-ai.careplan")

router = APIRouter(prefix="/ai/patients", tags=["Care Plan"])

_careplan_service = CarePlanService()
_patient_context_service = PatientContextService()


@router.get("/{patient_id}/care-plan", response_model=CarePlanResponse)
async def get_care_plan(
    patient_id: str,
    db: Any = Depends(get_db),
) -> CarePlanResponse:
    """
    Generate a personalized care plan combining:
      - Condition-specific monitoring and lifestyle guidelines
      - Risk-based actions from cardiovascular and diabetes scores
      - Medication-specific reminders and advice
      - Age-appropriate general health recommendations
    """
    patient_context = await _patient_context_service.get_patient_context(
        patient_id, db
    )

    result = await _careplan_service.generate(patient_context)

    logger.info(
        "Care plan for %s: %d total items",
        patient_id, result.get("totalItems", 0),
    )

    return CarePlanResponse(
        patientId=result["patientId"],
        conditions=[
            ConditionCarePlan(**c) for c in result.get("conditions", [])
        ],
        generalRecommendations=result.get("generalRecommendations", []),
        riskBasedActions=[
            RiskAction(**a) for a in result.get("riskBasedActions", [])
        ],
        medicationReminders=[
            MedicationReminder(**m) for m in result.get("medicationReminders", [])
        ],
        totalItems=result.get("totalItems", 0),
        generatedAt=result.get("generatedAt", ""),
        disclaimer=result.get("disclaimer", ""),
    )
