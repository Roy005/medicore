"""
MediCore AI Service — Pydantic v2 Schemas
Request/response models with field validation matching the interface contract.
"""

from __future__ import annotations
from datetime import datetime
from typing import Literal
from pydantic import BaseModel, Field, field_validator  # type: ignore


# ── Health ────────────────────────────────────────────────────────────────────

class HealthResponse(BaseModel):
    status: str = "ok"
    timestamp: datetime


# ── Advisor Chat  POST /ai/advisor/chat ───────────────────────────────────────

class AdvisorChatRequest(BaseModel):
    patientId: str = Field(..., min_length=1, max_length=100, description="Patient identifier")
    message: str = Field(..., min_length=1, max_length=5000, description="User message to the advisor")
    conversationHistory: list[dict] = Field(default_factory=list, description="Previous conversation turns")
    patientContext: dict = Field(default_factory=dict, description="Optional additional patient context")

    @field_validator("patientId")
    @classmethod
    def validate_patient_id(cls, v: str) -> str:
        return v.strip()

    @field_validator("message")
    @classmethod
    def validate_message(cls, v: str) -> str:
        stripped = v.strip()
        if not stripped:
            raise ValueError("Message cannot be empty or whitespace only")
        return stripped


class AdvisorSource(BaseModel):
    title: str
    url: str | None = None


class AdvisorChatResponse(BaseModel):
    reply: str
    sources: list[AdvisorSource] = Field(default_factory=list)
    safetyFlag: bool = False


# ── Risk Scores  GET /ai/patients/{id}/risk-scores ────────────────────────────

class RiskDetail(BaseModel):
    score: float = Field(default=0.0, ge=0.0, le=100.0, description="Risk score 0-100")
    level: Literal["low", "moderate", "high", "critical"] = "low"
    topFactors: list[str] = Field(default_factory=list, description="Top contributing risk factors")


class RiskScoreResponse(BaseModel):
    cardiovascular: RiskDetail = Field(default_factory=RiskDetail)
    diabetes: RiskDetail = Field(default_factory=RiskDetail)


# ── Emergency Flags  GET /ai/patients/{id}/emergency-flags ────────────────────

class EmergencyFlag(BaseModel):
    severity: Literal["warning", "critical"]
    message: str


class EmergencyFlagResponse(BaseModel):
    flags: list[EmergencyFlag] = Field(default_factory=list)


# ── Vitals Analysis  POST /ai/vitals/analyze ──────────────────────────────────

class VitalRecord(BaseModel):
    metric: str = Field(..., min_length=1, max_length=50, description="Vital sign metric name")
    value: float = Field(..., description="Vital sign measurement value")
    timestamp: datetime | None = None

    @field_validator("value")
    @classmethod
    def validate_value(cls, v: float) -> float:
        if v < 0 or v > 1000:
            raise ValueError("Vital value must be between 0 and 1000")
        return v


class VitalsAnalyzeRequest(BaseModel):
    patientId: str = Field(..., min_length=1, max_length=100)
    recentVitals: list[VitalRecord] = Field(
        default_factory=list,
        max_length=100,
        description="List of recent vital sign readings (max 100)"
    )
    patientBaseline: dict = Field(default_factory=dict)


class VitalsAnomaly(BaseModel):
    metric: str
    value: float
    threshold: float
    severity: Literal["warning", "critical"]
    message: str


class VitalsAnalyzeResponse(BaseModel):
    anomalies: list[VitalsAnomaly] = Field(default_factory=list)


# ── Conversation History  GET /ai/patients/{id}/conversations ─────────────────

class ConversationEntry(BaseModel):
    message: str
    reply: str
    safetyFlag: bool = False
    timestamp: str


class ConversationHistoryResponse(BaseModel):
    patientId: str
    conversations: list[ConversationEntry] = Field(default_factory=list)
    total: int = 0


# ── Patient Summary  GET /ai/patients/{id}/summary ───────────────────────────

class PatientSummaryResponse(BaseModel):
    patientId: str
    demographics: dict = Field(default_factory=dict)
    riskScores: RiskScoreResponse = Field(default_factory=RiskScoreResponse)
    emergencyFlags: list[EmergencyFlag] = Field(default_factory=list)
    recentConversations: list[ConversationEntry] = Field(default_factory=list)
    generatedAt: str = ""


# ── Service Stats  GET /ai/stats ──────────────────────────────────────────────

class ServiceStatsResponse(BaseModel):
    status: str = "ok"
    totalPatients: int = 0
    totalConversations: int = 0
    safetyTriggers: int = 0
    uptime: str = ""


# ── Medication Safety  POST /ai/medications/check ────────────────────────────

class MedicationCheckRequest(BaseModel):
    patientId: str = Field(..., min_length=1, max_length=100)
    medications: list[str] = Field(..., min_length=1, max_length=50, description="List of medication names")
    allergies: list[str] = Field(default_factory=list, description="Known allergens")
    conditions: list[str] = Field(default_factory=list, description="Active conditions")


class MedicationIssue(BaseModel):
    type: str
    severity: str
    detail: str


class MedicationCheckResponse(BaseModel):
    safe: bool = True
    interactions: list[dict] = Field(default_factory=list)
    allergyConflicts: list[dict] = Field(default_factory=list)
    duplicates: list[dict] = Field(default_factory=list)
    contraindications: list[dict] = Field(default_factory=list)
    totalIssues: int = 0


# ── Health Trends  GET /ai/patients/{id}/trends ──────────────────────────────

class TrendInsight(BaseModel):
    severity: str
    message: str


class TrendsResponse(BaseModel):
    patientId: str
    metrics: dict = Field(default_factory=dict)
    insights: list[TrendInsight] = Field(default_factory=list)
    totalMetrics: int = 0
    totalInsights: int = 0
    analyzedAt: str = ""


# ── Symptom Checker  POST /ai/symptoms/analyze ───────────────────────────────

class SymptomAnalyzeRequest(BaseModel):
    patientId: str = Field(..., min_length=1, max_length=100)
    symptoms: list[str] = Field(..., min_length=1, max_length=20, description="List of reported symptoms")
    age: int | None = Field(default=None, ge=0, le=150)
    gender: str | None = None
    existingConditions: list[str] = Field(default_factory=list)


class RedFlag(BaseModel):
    symptom: str
    warning: str
    severity: str = "critical"


class PossibleCondition(BaseModel):
    condition: str
    confidence: str
    matchedSymptoms: int
    totalSymptoms: int
    matchRatio: int
    description: str
    urgency: str


class SymptomAnalyzeResponse(BaseModel):
    urgency: str
    redFlags: list[RedFlag] = Field(default_factory=list)
    possibleConditions: list[PossibleCondition] = Field(default_factory=list)
    recommendations: list[str] = Field(default_factory=list)
    disclaimer: str = ""
    analyzedAt: str = ""


# ── Care Plan  GET /ai/patients/{id}/care-plan ───────────────────────────────

class ConditionCarePlan(BaseModel):
    condition: str
    priority: str
    monitoring: list[str] = Field(default_factory=list)
    lifestyle: list[str] = Field(default_factory=list)


class RiskAction(BaseModel):
    risk: str
    level: str
    action: str


class MedicationReminder(BaseModel):
    medication: str
    reminder: str


class CarePlanResponse(BaseModel):
    patientId: str
    conditions: list[ConditionCarePlan] = Field(default_factory=list)
    generalRecommendations: list[str] = Field(default_factory=list)
    riskBasedActions: list[RiskAction] = Field(default_factory=list)
    medicationReminders: list[MedicationReminder] = Field(default_factory=list)
    totalItems: int = 0
    generatedAt: str = ""
    disclaimer: str = ""


# ── Wellness Score  GET /ai/patients/{id}/wellness-score ─────────────────────

class WellnessBreakdown(BaseModel):
    score: float = 0.0
    weight: float = 0.0
    weightedScore: float = 0.0


class WellnessScoreResponse(BaseModel):
    overallScore: float = Field(default=0.0, ge=0.0, le=100.0)
    level: str = "fair"
    label: str = ""
    breakdown: dict = Field(default_factory=dict)
    improvementTips: list[str] = Field(default_factory=list)
    calculatedAt: str = ""


# ── Health Report  GET /ai/patients/{id}/health-report ───────────────────────

class HealthReportResponse(BaseModel):
    patientId: str
    reportType: str = "comprehensive"
    generatedAt: str = ""
    executiveSummary: str = ""
    demographics: dict = Field(default_factory=dict)
    wellnessScore: dict = Field(default_factory=dict)
    riskScores: dict = Field(default_factory=dict)
    vitalsAnalysis: dict = Field(default_factory=dict)
    emergencyFlags: list[dict] = Field(default_factory=list)
    medicationSafety: dict = Field(default_factory=dict)
    healthTrends: dict = Field(default_factory=dict)
    carePlanHighlights: dict = Field(default_factory=dict)
    recentConversations: list[dict] = Field(default_factory=list)
    disclaimer: str = ""


# ── Health Goals  /ai/patients/{id}/goals ────────────────────────────────────

class CreateGoalRequest(BaseModel):
    goalType: str = Field(..., min_length=1, max_length=50, description="Goal template type or 'custom'")
    targetValue: float = Field(..., ge=0, le=10000, description="Target value to achieve")
    currentValue: float | None = Field(default=None, ge=0, le=10000)
    deadline: str | None = None
    notes: str | None = Field(default=None, max_length=500)


class GoalResponse(BaseModel):
    goalId: str
    patientId: str
    goalType: str
    category: str = "custom"
    title: str = ""
    metric: str = ""
    unit: str = ""
    direction: str = "decrease"
    targetValue: float = 0.0
    currentValue: float | None = None
    startValue: float | None = None
    progress: float = 0.0
    status: str = "active"
    advice: str = ""
    deadline: str | None = None
    notes: str = ""
    createdAt: str = ""
    updatedAt: str = ""


class UpdateProgressRequest(BaseModel):
    currentValue: float = Field(..., ge=0, le=10000)


class GoalsSummaryResponse(BaseModel):
    patientId: str
    totalGoals: int = 0
    activeGoals: int = 0
    completedGoals: int = 0
    averageProgress: float = 0.0
    goals: list[dict] = Field(default_factory=list)
    availableTemplates: list[str] = Field(default_factory=list)


# ── Patient Alerts  /ai/patients/{id}/alerts ─────────────────────────────────

class AlertResponse(BaseModel):
    alertId: str
    patientId: str
    category: str
    categoryLabel: str = ""
    severity: str
    title: str
    message: str
    source: str = ""
    status: str = "active"
    metadata: dict = Field(default_factory=dict)
    createdAt: str = ""
    acknowledgedAt: str | None = None
    dismissedAt: str | None = None


class AlertsSummaryResponse(BaseModel):
    patientId: str
    totalAlerts: int = 0
    activeAlerts: int = 0
    acknowledgedAlerts: int = 0
    dismissedAlerts: int = 0
    criticalCount: int = 0
    warningCount: int = 0
    infoCount: int = 0


class AlertActionResponse(BaseModel):
    success: bool = True
    alertId: str = ""
    newStatus: str = ""
    message: str = ""


# ── Patient Timeline  GET /ai/patients/{id}/timeline ────────────────────────

class TimelineEvent(BaseModel):
    type: str
    icon: str = ""
    title: str
    description: str = ""
    severity: str = "info"
    timestamp: str = ""
    status: str | None = None
    metadata: dict | None = None


class TimelineResponse(BaseModel):
    patientId: str
    events: list[TimelineEvent] = Field(default_factory=list)
    totalEvents: int = 0
    shownEvents: int = 0
    categories: dict = Field(default_factory=dict)
    generatedAt: str = ""


# ── Health Benchmarks  GET /ai/patients/{id}/benchmarks ──────────────────────

class BenchmarkComparison(BaseModel):
    metric: str
    description: str = ""
    value: float = 0.0
    unit: str = ""
    status: str = "unknown"
    label: str | None = None
    color: str = "gray"
    inRange: bool = True
    isOptimal: bool | None = None
    percentile: int | None = None
    advice: str = ""


class BenchmarkSummary(BaseModel):
    optimal: int = 0
    normal: int = 0
    elevated: int = 0
    high: int = 0
    critical: int = 0
    low: int = 0


class BenchmarkResponse(BaseModel):
    patientId: str
    comparisons: list[BenchmarkComparison] = Field(default_factory=list)
    totalCompared: int = 0
    summary: BenchmarkSummary = Field(default_factory=BenchmarkSummary)
    recommendations: list[str] = Field(default_factory=list)
    analyzedAt: str = ""
