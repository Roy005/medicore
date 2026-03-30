"""
MediCore AI Service — Patient Timeline Router (Day 15)
GET /ai/patients/{id}/timeline — Chronological health event timeline
"""

import logging
from typing import Any

from fastapi import APIRouter, Depends  # type: ignore

from database import get_db  # type: ignore
from models.schemas import TimelineResponse, TimelineEvent  # type: ignore
from services.timeline_service import TimelineService  # type: ignore
from services.patient_context import PatientContextService  # type: ignore
from routers.advisor import _conversation_service  # type: ignore
from routers.goals import _goals_service  # type: ignore
from routers.alerts import _alerts_service  # type: ignore

logger = logging.getLogger("medicore-ai.timeline")

router = APIRouter(prefix="/ai/patients", tags=["Patient Timeline"])

_patient_context_service = PatientContextService()
_timeline_service = TimelineService(_conversation_service, _goals_service, _alerts_service)


@router.get("/{patient_id}/timeline", response_model=TimelineResponse)
async def get_patient_timeline(
    patient_id: str,
    limit: int = 50,
    db: Any = Depends(get_db),
) -> TimelineResponse:
    """
    Get a chronological timeline of all health events for a patient:
      - Vital sign readings
      - Emergency flags
      - Alerts (auto-generated)
      - Goals (created, updated, completed)
      - Advisor conversations
      - Risk assessments
    """
    patient_context = await _patient_context_service.get_patient_context(patient_id, db)
    result = await _timeline_service.generate_timeline(patient_id, patient_context, limit=limit)

    events = [
        TimelineEvent(
            type=e["type"],
            icon=e.get("icon", ""),
            title=e["title"],
            description=e.get("description", ""),
            severity=e.get("severity", "info"),
            timestamp=e.get("timestamp", ""),
            status=e.get("status"),
            metadata=e.get("metadata"),
        )
        for e in result.get("events", [])
    ]

    return TimelineResponse(
        patientId=result["patientId"],
        events=events,
        totalEvents=result["totalEvents"],
        shownEvents=result["shownEvents"],
        categories=result.get("categories", {}),
        generatedAt=result["generatedAt"],
    )
