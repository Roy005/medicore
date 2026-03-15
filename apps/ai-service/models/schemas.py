"""
MediCore AI Service — Pydantic v2 Schemas
Request/response models matching the interface contract.
"""

from __future__ import annotations
from datetime import datetime
from pydantic import BaseModel, Field


# ── Health ────────────────────────────────────────────────────────────────────

class HealthResponse(BaseModel):
    status: str = "ok"
    timestamp: datetime


# ── Advisor Chat  POST /ai/advisor/chat ───────────────────────────────────────

class AdvisorChatRequest(BaseModel):
    patientId: str
    message: str
    conversationHistory: list[dict] = Field(default_factory=list)
    patientContext: dict = Field(default_factory=dict)


class AdvisorSource(BaseModel):
    title: str
    url: str | None = None


class AdvisorChatResponse(BaseModel):
    reply: str
    sources: list[AdvisorSource] = Field(default_factory=list)
    safetyFlag: bool = False


# ── Risk Scores  GET /ai/patients/{id}/risk-scores ────────────────────────────

class RiskDetail(BaseModel):
    score: float = 0.0
    level: str = "low"
    topFactors: list[str] = Field(default_factory=list)


class RiskScoreResponse(BaseModel):
    cardiovascular: RiskDetail = Field(default_factory=RiskDetail)
    diabetes: RiskDetail = Field(default_factory=RiskDetail)


# ── Emergency Flags  GET /ai/patients/{id}/emergency-flags ────────────────────

class EmergencyFlag(BaseModel):
    severity: str
    message: str


class EmergencyFlagResponse(BaseModel):
    flags: list[EmergencyFlag] = Field(default_factory=list)


# ── Vitals Analysis  POST /ai/vitals/analyze ──────────────────────────────────

class VitalRecord(BaseModel):
    metric: str
    value: float
    timestamp: datetime | None = None


class VitalsAnalyzeRequest(BaseModel):
    patientId: str
    recentVitals: list[VitalRecord] = Field(default_factory=list)
    patientBaseline: dict = Field(default_factory=dict)


class VitalsAnomaly(BaseModel):
    metric: str
    value: float
    threshold: float
    severity: str
    message: str


class VitalsAnalyzeResponse(BaseModel):
    anomalies: list[VitalsAnomaly] = Field(default_factory=list)
