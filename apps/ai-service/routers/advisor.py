"""
MediCore AI Service — Advisor Router
POST /ai/advisor/chat
"""

from fastapi import APIRouter, Depends
import asyncpg

from database import get_db
from models.schemas import AdvisorChatRequest, AdvisorChatResponse

router = APIRouter(prefix="/ai/advisor", tags=["Advisor"])


@router.post("/chat", response_model=AdvisorChatResponse)
async def advisor_chat(
    request: AdvisorChatRequest,
    db: asyncpg.Pool = Depends(get_db),
):
    """
    AI-powered medical advisor chat.
    Accepts a patient message and returns an AI-generated reply
    with optional sources and safety flags.
    """
    # Stub — will be wired to LLM service in Day 2+
    return AdvisorChatResponse(
        reply=f"Thank you for your message. This is a placeholder response for patient {request.patientId}.",
        sources=[],
        safetyFlag=False,
    )
