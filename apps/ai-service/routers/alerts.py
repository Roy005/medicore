"""
MediCore AI Service — Patient Alerts Router (Day 14)
GET  /ai/patients/{id}/alerts                   — Get alerts (with auto-generation)
GET  /ai/patients/{id}/alerts/summary            — Alert summary stats
POST /ai/patients/{id}/alerts/{id}/acknowledge   — Acknowledge an alert
POST /ai/patients/{id}/alerts/{id}/dismiss       — Dismiss an alert
"""

import logging
from typing import Any

from fastapi import APIRouter, Depends, HTTPException  # type: ignore

from database import get_db  # type: ignore
from models.schemas import (  # type: ignore
    AlertResponse, AlertsSummaryResponse, AlertActionResponse,
)
from services.alerts_service import PatientAlertsService  # type: ignore
from services.patient_context import PatientContextService  # type: ignore

logger = logging.getLogger("medicore-ai.alerts")

router = APIRouter(prefix="/ai/patients", tags=["Patient Alerts"])

_alerts_service = PatientAlertsService()
_patient_context_service = PatientContextService()


@router.get("/{patient_id}/alerts", response_model=list[AlertResponse])
async def get_patient_alerts(
    patient_id: str,
    severity: str | None = None,
    db: Any = Depends(get_db),
) -> list[AlertResponse]:
    """
    Get alerts for a patient. Auto-generates alerts from current health data
    on first call, then returns stored alerts.
    """
    # Auto-generate alerts if none exist
    existing = _alerts_service.get_alerts(patient_id)
    if not existing:
        patient_context = await _patient_context_service.get_patient_context(patient_id, db)
        await _alerts_service.generate_alerts(patient_id, patient_context)

    alerts = _alerts_service.get_alerts(patient_id, severity=severity)
    return [AlertResponse(**a) for a in alerts]


@router.get("/{patient_id}/alerts/summary", response_model=AlertsSummaryResponse)
async def get_alerts_summary(
    patient_id: str,
) -> AlertsSummaryResponse:
    """Get summary statistics for a patient's alerts."""
    summary = _alerts_service.get_summary(patient_id)
    return AlertsSummaryResponse(**summary)


@router.post("/{patient_id}/alerts/{alert_id}/acknowledge", response_model=AlertActionResponse)
async def acknowledge_alert(
    patient_id: str,
    alert_id: str,
) -> AlertActionResponse:
    """Mark an alert as acknowledged."""
    result = _alerts_service.acknowledge_alert(patient_id, alert_id)
    if result is None:
        raise HTTPException(status_code=404, detail=f"Alert {alert_id} not found")
    return AlertActionResponse(
        success=True, alertId=alert_id,
        newStatus="acknowledged", message="Alert acknowledged successfully.",
    )


@router.post("/{patient_id}/alerts/{alert_id}/dismiss", response_model=AlertActionResponse)
async def dismiss_alert(
    patient_id: str,
    alert_id: str,
) -> AlertActionResponse:
    """Dismiss (resolve) an alert."""
    result = _alerts_service.dismiss_alert(patient_id, alert_id)
    if result is None:
        raise HTTPException(status_code=404, detail=f"Alert {alert_id} not found")
    return AlertActionResponse(
        success=True, alertId=alert_id,
        newStatus="dismissed", message="Alert dismissed successfully.",
    )
