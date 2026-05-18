"""
MediCore AI Service — Advisor Router
POST /ai/advisor/chat — RAG Health Advisor powered by OpenRouter API.
GET  /ai/patients/{id}/conversations — Conversation history
GET  /ai/patients/{id}/summary — Full patient AI summary
"""

import logging
from datetime import datetime, timezone
from typing import Any, Dict, List

from fastapi import APIRouter, Depends, Query  # type: ignore

from database import get_db  # type: ignore
from models.schemas import (  # type: ignore
    AdvisorChatRequest, AdvisorChatResponse, AdvisorSource,
    ConversationHistoryResponse,
    ConversationEntry as ConversationEntrySchema,
    PatientSummaryResponse,
    RiskScoreResponse, RiskDetail, EmergencyFlag,
)
from services.llm_service import LLMService  # type: ignore
from services.patient_context import PatientContextService  # type: ignore
from services.conversation_service import ConversationHistoryService  # type: ignore
from services.risk_service import RiskService  # type: ignore
from services.emergency_service import EmergencyService  # type: ignore

logger = logging.getLogger("medicore-ai.advisor")

router = APIRouter(tags=["Advisor"])

# ── Singletons ────────────────────────────────────────────────────────────────
_llm_service = LLMService()
_patient_context_service = PatientContextService()
_conversation_service = ConversationHistoryService()
_risk_service = RiskService()
_emergency_service = EmergencyService()


# ══════════════════════════════════════════════════════════════════════════════
# POST /ai/advisor/chat
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/ai/advisor/chat", response_model=AdvisorChatResponse)
async def advisor_chat(
    request: AdvisorChatRequest,
    db: Any = Depends(get_db),
) -> AdvisorChatResponse:
    """
    AI-powered medical advisor chat.
    1. Fetches patient context from DB (or mock)
    2. Loads recent conversation history for multi-turn context
    3. Sends message + context to OpenRouter LLM
    4. Logs the interaction
    5. Returns AI reply with safety flag
    """

    # 1. Fetch patient context
    patient_context = await _patient_context_service.get_patient_context(
        request.patientId, db
    )
    logger.info("Patient context fetched for %s", request.patientId)

    # 2. Build conversation history — merge stored + request-provided
    stored_history = _conversation_service.get_recent_messages_for_context(
        request.patientId, max_turns=5
    )
    request_history: List[Dict[str, str]] = []
    for entry in request.conversationHistory:
        if isinstance(entry, dict) and "role" in entry and "content" in entry:
            request_history.append({"role": entry["role"], "content": entry["content"]})

    # Use request history if provided, otherwise use stored history
    history = request_history if request_history else stored_history

    # 3. Call the LLM service
    reply, safety_flag = await _llm_service.ask_advisor(
        message=request.message,
        patient_context=patient_context,
        conversation_history=history if history else None,
    )

    # 4. Log the interaction
    _conversation_service.add_entry(
        patient_id=request.patientId,
        message=request.message,
        reply=reply,
        safety_flag=safety_flag,
    )
    logger.info(
        "Advisor chat logged (patient=%s, safety=%s)",
        request.patientId, safety_flag,
    )

    # 5. Return structured response
    return AdvisorChatResponse(
        reply=reply,
        sources=[AdvisorSource(title="Patient Records")] if not safety_flag else [],
        safetyFlag=safety_flag,
    )


# ══════════════════════════════════════════════════════════════════════════════
# GET /ai/patients/{id}/conversations
# ══════════════════════════════════════════════════════════════════════════════

@router.get(
    "/ai/patients/{patient_id}/conversations",
    response_model=ConversationHistoryResponse,
    tags=["Conversations"],
)
async def get_conversations(
    patient_id: str,
    limit: int = Query(default=10, ge=1, le=50),
    offset: int = Query(default=0, ge=0),
) -> ConversationHistoryResponse:
    """
    Retrieve conversation history for a patient (newest first).
    Supports pagination with limit and offset query parameters.
    """
    entries = _conversation_service.get_history(patient_id, limit=limit, offset=offset)
    all_entries = _conversation_service.get_history(patient_id, limit=999, offset=0)

    return ConversationHistoryResponse(
        patientId=patient_id,
        conversations=[
            ConversationEntrySchema(
                message=e["message"],
                reply=e["reply"],
                safetyFlag=e["safetyFlag"],
                timestamp=e["timestamp"],
            )
            for e in entries
        ],
        total=len(all_entries),
    )


# ══════════════════════════════════════════════════════════════════════════════
# GET /ai/patients/{id}/summary
# ══════════════════════════════════════════════════════════════════════════════

@router.get(
    "/ai/patients/{patient_id}/summary",
    response_model=PatientSummaryResponse,
    tags=["Patient Summary"],
)
async def get_patient_summary(
    patient_id: str,
    db: Any = Depends(get_db),
) -> PatientSummaryResponse:
    """
    Get a comprehensive AI-generated patient summary combining:
    - Demographics
    - Risk scores (cardiovascular + diabetes)
    - Emergency flags
    - Recent conversations
    """
    # Fetch all data in parallel
    patient_context = await _patient_context_service.get_patient_context(
        patient_id, db
    )

    cv_risk = await _risk_service.compute_cardiovascular_risk(patient_context)
    t2d_risk = await _risk_service.compute_diabetes_risk(patient_context)
    raw_flags = await _emergency_service.evaluate(patient_context)
    recent_convos = _conversation_service.get_history(patient_id, limit=5)

    return PatientSummaryResponse(
        patientId=patient_id,
        demographics=patient_context.get("demographics", {}),
        riskScores=RiskScoreResponse(
            cardiovascular=RiskDetail(
                score=cv_risk["score"],
                level=cv_risk["level"],
                topFactors=cv_risk["topFactors"],
            ),
            diabetes=RiskDetail(
                score=t2d_risk["score"],
                level=t2d_risk["level"],
                topFactors=t2d_risk["topFactors"],
            ),
        ),
        emergencyFlags=[
            EmergencyFlag(severity=f["severity"], message=f["message"])  # type: ignore[arg-type]
            for f in raw_flags
        ],
        recentConversations=[
            ConversationEntrySchema(
                message=e["message"],
                reply=e["reply"],
                safetyFlag=e["safetyFlag"],
                timestamp=e["timestamp"],
            )
            for e in recent_convos
        ],
        generatedAt=datetime.now(timezone.utc).isoformat(),
    )
