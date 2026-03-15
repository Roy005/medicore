"""
MediCore AI Service — Emergency Flags Router
GET /ai/patients/{id}/emergency-flags
"""

from fastapi import APIRouter, Depends
import asyncpg

from database import get_db
from models.schemas import EmergencyFlagResponse

router = APIRouter(prefix="/ai/patients", tags=["Emergency Flags"])


@router.get("/{patient_id}/emergency-flags", response_model=EmergencyFlagResponse)
async def get_emergency_flags(
    patient_id: str,
    db: asyncpg.Pool = Depends(get_db),
):
    """
    Return any active emergency flags for a patient.
    """
    # Stub — will be wired to risk/vitals services later
    return EmergencyFlagResponse(flags=[])
