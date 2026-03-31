"""
MediCore AI Service — Symptom Checker Router (Day 12)
POST /ai/symptoms/analyze — AI-powered symptom analysis
"""

import logging

from fastapi import APIRouter  # type: ignore

from models.schemas import (  # type: ignore
    SymptomAnalyzeRequest, SymptomAnalyzeResponse,
    RedFlag, PossibleCondition,
)
from services.symptom_service import SymptomCheckerService  # type: ignore

logger = logging.getLogger("medicore-ai.symptoms")

router = APIRouter(prefix="/ai/symptoms", tags=["Symptom Checker"])

_symptom_service = SymptomCheckerService()


@router.post("/analyze", response_model=SymptomAnalyzeResponse)
async def analyze_symptoms(
    request: SymptomAnalyzeRequest,
) -> SymptomAnalyzeResponse:
    """
    Analyze reported symptoms and return:
      - Urgency level (emergency / urgent / soon / routine)
      - Red flag warnings for life-threatening symptoms
      - Possible conditions with confidence scores
      - Actionable recommendations
      - Medical disclaimer
    """
    result = _symptom_service.analyze(
        symptoms=request.symptoms,
        patient_age=request.age,
        patient_gender=request.gender,
        existing_conditions=request.existingConditions,
    )

    logger.info(
        "Symptom analysis for %s: %d symptoms → urgency=%s, %d red flags, %d conditions",
        request.patientId, len(request.symptoms),
        result["urgency"], len(result["redFlags"]), len(result["possibleConditions"]),
    )

    return SymptomAnalyzeResponse(
        urgency=result["urgency"],
        redFlags=[
            RedFlag(symptom=f["symptom"], warning=f["warning"], severity=f["severity"])
            for f in result["redFlags"]
        ],
        possibleConditions=[
            PossibleCondition(**c) for c in result["possibleConditions"]
        ],
        recommendations=result["recommendations"],
        disclaimer=result["disclaimer"],
        analyzedAt=result["analyzedAt"],
    )
