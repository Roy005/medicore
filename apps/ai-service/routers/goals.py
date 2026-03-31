"""
MediCore AI Service — Health Goals Router (Day 14)
POST  /ai/patients/{id}/goals              — Create a goal
GET   /ai/patients/{id}/goals              — List goals + summary
PATCH /ai/patients/{id}/goals/{goal_id}    — Update progress
GET   /ai/goals/templates                  — List available templates
"""

import logging
from typing import Any

from fastapi import APIRouter, Depends, HTTPException  # type: ignore

from database import get_db  # type: ignore
from models.schemas import (  # type: ignore
    CreateGoalRequest, GoalResponse, GoalsSummaryResponse, UpdateProgressRequest,
)
from services.goals_service import HealthGoalsService  # type: ignore
from services.patient_context import PatientContextService  # type: ignore

logger = logging.getLogger("medicore-ai.goals")

router = APIRouter(tags=["Health Goals"])

_goals_service = HealthGoalsService()
_patient_context_service = PatientContextService()


@router.post("/ai/patients/{patient_id}/goals", response_model=GoalResponse, status_code=201)
async def create_goal(
    patient_id: str,
    request: CreateGoalRequest,
) -> GoalResponse:
    """Create a new health goal for a patient."""
    goal = _goals_service.create_goal(
        patient_id=patient_id,
        goal_type=request.goalType,
        target_value=request.targetValue,
        current_value=request.currentValue,
        deadline=request.deadline,
        notes=request.notes,
    )
    return GoalResponse(**goal)


@router.get("/ai/patients/{patient_id}/goals", response_model=GoalsSummaryResponse)
async def get_goals(
    patient_id: str,
    db: Any = Depends(get_db),
) -> GoalsSummaryResponse:
    """Get all health goals with summary for a patient. Auto-updates from vitals."""
    # Auto-update from patient vitals
    patient_context = await _patient_context_service.get_patient_context(patient_id, db)
    _goals_service.update_goal_from_vitals(patient_id, patient_context)

    summary = _goals_service.get_summary(patient_id)
    return GoalsSummaryResponse(**summary)


@router.patch("/ai/patients/{patient_id}/goals/{goal_id}", response_model=GoalResponse)
async def update_goal_progress(
    patient_id: str,
    goal_id: str,
    request: UpdateProgressRequest,
) -> GoalResponse:
    """Update a goal's current value and recalculate progress."""
    result = _goals_service.update_progress(patient_id, goal_id, request.currentValue)
    if result is None:
        raise HTTPException(status_code=404, detail=f"Goal {goal_id} not found for patient {patient_id}")
    return GoalResponse(**result)


@router.get("/ai/goals/templates")
async def get_goal_templates() -> dict:
    """List all available goal templates."""
    return {"templates": _goals_service.get_templates()}
