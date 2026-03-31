"""
MediCore AI Service — Health Report Generator Service (Day 13)
Generates a comprehensive health report aggregating ALL services:
  - Patient demographics
  - Wellness score
  - Risk scores
  - Vitals analysis
  - Emergency flags
  - Medication safety
  - Health trends
  - Care plan highlights
  - Recent conversations
"""

import logging
from datetime import datetime, timezone
from typing import Any, Dict, List

from services.wellness_service import WellnessScoreService  # type: ignore
from services.risk_service import RiskService  # type: ignore
from services.vitals_service import VitalsService  # type: ignore
from services.emergency_service import EmergencyService  # type: ignore
from services.medication_service import MedicationSafetyService  # type: ignore
from services.trends_service import TrendsService  # type: ignore
from services.careplan_service import CarePlanService  # type: ignore
from services.conversation_service import ConversationHistoryService  # type: ignore

logger = logging.getLogger("medicore-ai.report")


class HealthReportService:
    """Aggregates all AI services into a single comprehensive health report."""

    def __init__(self, conversation_service: ConversationHistoryService) -> None:
        self._wellness = WellnessScoreService()
        self._risk = RiskService()
        self._vitals = VitalsService()
        self._emergency = EmergencyService()
        self._meds = MedicationSafetyService()
        self._trends = TrendsService()
        self._careplan = CarePlanService()
        self._conversations = conversation_service

    async def generate(self, patient_context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Generate a comprehensive health report for a patient.

        Returns a structured report combining all service outputs.
        """
        patient_id = patient_context.get("patientId", "unknown")
        demographics = patient_context.get("demographics", {})

        # 1. Wellness Score
        wellness = await self._wellness.compute(patient_context)

        # 2. Risk Scores
        cv_risk = await self._risk.compute_cardiovascular_risk(patient_context)
        t2d_risk = await self._risk.compute_diabetes_risk(patient_context)

        # 3. Vitals Analysis
        vitals_analysis = await self._analyze_vitals(patient_context)

        # 4. Emergency Flags
        emergency_flags = await self._emergency.evaluate(patient_context)

        # 5. Medication Safety
        med_safety = self._check_medications(patient_context)

        # 6. Health Trends
        trends = self._trends.analyze_trends(patient_context)

        # 7. Care Plan
        care_plan = await self._careplan.generate(patient_context)

        # 8. Recent Conversations
        recent_convos = self._get_recent_conversations(patient_id)

        # 9. Generate executive summary
        summary = self._generate_summary(
            wellness, cv_risk, t2d_risk, emergency_flags, med_safety
        )

        logger.info(
            "Health report generated for %s: wellness=%.1f (%s)",
            patient_id, wellness["overallScore"], wellness["level"],
        )

        return {
            "patientId": patient_id,
            "reportType": "comprehensive",
            "generatedAt": datetime.now(timezone.utc).isoformat(),
            "executiveSummary": summary,
            "demographics": demographics,
            "wellnessScore": {
                "overallScore": wellness["overallScore"],
                "level": wellness["level"],
                "label": wellness["label"],
                "breakdown": wellness["breakdown"],
                "improvementTips": wellness["improvementTips"],
            },
            "riskScores": {
                "cardiovascular": cv_risk,
                "diabetes": t2d_risk,
            },
            "vitalsAnalysis": vitals_analysis,
            "emergencyFlags": emergency_flags,
            "medicationSafety": med_safety,
            "healthTrends": {
                "metrics": trends.get("metrics", {}),
                "insights": trends.get("insights", []),
                "totalInsights": trends.get("totalInsights", 0),
            },
            "carePlanHighlights": {
                "conditions": care_plan.get("conditions", []),
                "riskBasedActions": care_plan.get("riskBasedActions", []),
                "totalItems": care_plan.get("totalItems", 0),
            },
            "recentConversations": recent_convos,
            "disclaimer": (
                "This health report is AI-generated and intended for informational purposes only. "
                "It does not constitute a medical diagnosis or replace professional medical advice. "
                "Please share this report with your healthcare provider for proper interpretation."
            ),
        }

    async def _analyze_vitals(self, patient_context: Dict[str, Any]) -> Dict[str, Any]:
        """Run vitals analysis and return structured results."""
        recent_vitals = patient_context.get("recentVitals", {})

        vitals_list: List[Dict[str, Any]] = []
        if isinstance(recent_vitals, dict):
            for metric, data in recent_vitals.items():
                if isinstance(data, dict) and "latest" in data:
                    val = data["latest"]
                    if isinstance(val, (int, float)):
                        vitals_list.append({"metric": metric, "value": val})
        elif isinstance(recent_vitals, list):
            vitals_list = recent_vitals

        baseline = patient_context.get("patientBaseline", {})
        anomalies = await self._vitals.analyze(vitals_list, baseline)

        return {
            "totalChecked": len(vitals_list),
            "anomalies": anomalies,
            "anomalyCount": len(anomalies),
            "status": "normal" if not anomalies else "attention_needed",
        }

    def _check_medications(self, patient_context: Dict[str, Any]) -> Dict[str, Any]:
        """Run medication safety checks."""
        medications = patient_context.get("activeMedications", [])
        if not medications:
            return {"safe": True, "totalIssues": 0, "checked": 0}

        med_names = [
            m.get("name", "") if isinstance(m, dict) else str(m)
            for m in medications
        ]
        allergies = [
            a if isinstance(a, str) else a.get("name", "")
            for a in patient_context.get("allergies", [])
        ]
        conditions = [
            c.lower() if isinstance(c, str) else c.get("name", "").lower()
            for c in patient_context.get("activeConditions", [])
        ]

        result = self._meds.check_all(med_names, allergies, conditions)
        result["checked"] = len(med_names)
        return result

    def _get_recent_conversations(self, patient_id: str) -> List[Dict[str, Any]]:
        """Get last 5 conversations for the report."""
        entries = self._conversations.get_history(patient_id, limit=5)
        return [
            {
                "message": e.get("message", ""),
                "reply": e.get("reply", "")[:200] + "..." if len(e.get("reply", "")) > 200 else e.get("reply", ""),
                "safetyFlag": e.get("safetyFlag", False),
                "timestamp": e.get("timestamp", ""),
            }
            for e in entries
        ]

    def _generate_summary(
        self,
        wellness: Dict[str, Any],
        cv_risk: Dict[str, Any],
        t2d_risk: Dict[str, Any],
        emergency_flags: List[Dict[str, str]],
        med_safety: Dict[str, Any],
    ) -> str:
        """Generate a plain-English executive summary."""
        parts: List[str] = []

        # Wellness overview
        score = wellness["overallScore"]
        level = wellness["level"]
        parts.append(
            f"Overall wellness score: {score}/100 ({level})."
        )

        # Risk highlights
        cv_level = cv_risk["level"]
        t2d_level = t2d_risk["level"]
        if cv_level in ("high", "critical") or t2d_level in ("high", "critical"):
            risks = []
            if cv_level in ("high", "critical"):
                risks.append(f"cardiovascular ({cv_level})")
            if t2d_level in ("high", "critical"):
                risks.append(f"diabetes ({t2d_level})")
            parts.append(f"Elevated risk areas: {', '.join(risks)}.")

        # Emergency count
        critical_flags = [f for f in emergency_flags if f.get("severity") == "critical"]
        if critical_flags:
            parts.append(
                f"⚠️ {len(critical_flags)} critical emergency flag(s) detected — "
                "immediate physician review recommended."
            )

        # Medication safety
        if not med_safety.get("safe", True):
            parts.append(
                f"Medication safety: {med_safety.get('totalIssues', 0)} issue(s) found — "
                "review with your pharmacist."
            )

        return " ".join(parts)
