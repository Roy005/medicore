"""
MediCore AI Service — Health Benchmarks Router (Day 15)
GET /ai/patients/{id}/benchmarks — Compare against healthy population ranges
GET /ai/benchmarks/ranges        — List all reference ranges
"""

import logging
from typing import Any

from fastapi import APIRouter, Depends  # type: ignore

from database import get_db  # type: ignore
from models.schemas import BenchmarkResponse, BenchmarkComparison, BenchmarkSummary  # type: ignore
from services.benchmark_service import BenchmarkService  # type: ignore
from services.patient_context import PatientContextService  # type: ignore

logger = logging.getLogger("medicore-ai.benchmarks")

router = APIRouter(tags=["Health Benchmarks"])

_benchmark_service = BenchmarkService()
_patient_context_service = PatientContextService()


@router.get("/ai/patients/{patient_id}/benchmarks", response_model=BenchmarkResponse)
async def get_health_benchmarks(
    patient_id: str,
    db: Any = Depends(get_db),
) -> BenchmarkResponse:
    """
    Compare patient health metrics against healthy population ranges.
    Returns color-coded status, percentile positioning, and improvement tips.
    """
    patient_context = await _patient_context_service.get_patient_context(patient_id, db)
    result = _benchmark_service.analyze(patient_context)

    comparisons = [
        BenchmarkComparison(**c) for c in result.get("comparisons", [])
    ]

    summary_data = result.get("summary", {})
    summary = BenchmarkSummary(
        optimal=summary_data.get("optimal", 0),
        normal=summary_data.get("normal", 0),
        elevated=summary_data.get("elevated", 0),
        high=summary_data.get("high", 0),
        critical=summary_data.get("critical", 0),
        low=summary_data.get("low", 0),
    )

    return BenchmarkResponse(
        patientId=result["patientId"],
        comparisons=comparisons,
        totalCompared=result.get("totalCompared", 0),
        summary=summary,
        recommendations=result.get("recommendations", []),
        analyzedAt=result.get("analyzedAt", ""),
    )


@router.get("/ai/benchmarks/ranges")
async def get_reference_ranges() -> dict:
    """List all available health reference ranges."""
    return {"ranges": _benchmark_service.get_reference_ranges()}
