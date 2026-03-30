"""
MediCore AI Service — Wellness Score Service (Day 13)
Calculates a composite wellness score (0-100) by combining:
  1. Cardiovascular risk (inverted — lower risk = higher wellness)
  2. Diabetes risk (inverted)
  3. Vitals stability (normal vitals = higher score)
  4. Medication safety (fewer issues = higher score)
  5. Emergency flag count (fewer = higher score)
"""

import logging
from datetime import datetime, timezone
from typing import Any, Dict, List

from services.risk_service import RiskService  # type: ignore
from services.vitals_service import VitalsService  # type: ignore
from services.medication_service import MedicationSafetyService  # type: ignore
from services.emergency_service import EmergencyService  # type: ignore

logger = logging.getLogger("medicore-ai.wellness")


# ── Score weights (must sum to 1.0) ──────────────────────────────────────────
WEIGHTS: Dict[str, float] = {
    "cardiovascular": 0.25,
    "diabetes": 0.20,
    "vitals": 0.25,
    "medications": 0.15,
    "emergency": 0.15,
}

# ── Wellness level thresholds ────────────────────────────────────────────────
WELLNESS_LEVELS: List[Dict[str, Any]] = [
    {"min": 80, "level": "excellent", "label": "Excellent health indicators"},
    {"min": 65, "level": "good", "label": "Good overall health with minor areas to improve"},
    {"min": 50, "level": "fair", "label": "Fair health — some areas need attention"},
    {"min": 35, "level": "poor", "label": "Poor health indicators — consult your physician"},
    {"min": 0, "level": "critical", "label": "Critical — immediate medical review recommended"},
]


class WellnessScoreService:
    """Computes a composite wellness score from all health dimensions."""

    def __init__(self) -> None:
        self._risk_service = RiskService()
        self._vitals_service = VitalsService()
        self._med_service = MedicationSafetyService()
        self._emergency_service = EmergencyService()

    async def compute(self, patient_context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Compute composite wellness score for a patient.

        Returns:
            {
                "overallScore": float,
                "level": str,
                "label": str,
                "breakdown": { dimension: { score, weight, weightedScore } },
                "improvementTips": [...],
                "calculatedAt": str
            }
        """
        breakdown: Dict[str, Dict[str, Any]] = {}

        # 1. Cardiovascular dimension (invert risk → wellness)
        cv_risk = await self._risk_service.compute_cardiovascular_risk(patient_context)
        cv_score = max(0.0, 100.0 - cv_risk["score"])
        breakdown["cardiovascular"] = {
            "score": float(round(cv_score, 1)),
            "weight": WEIGHTS["cardiovascular"],
            "weightedScore": float(round(cv_score * WEIGHTS["cardiovascular"], 1)),
            "riskLevel": cv_risk["level"],
            "factors": cv_risk["topFactors"][:3],
        }

        # 2. Diabetes dimension (invert risk → wellness)
        t2d_risk = await self._risk_service.compute_diabetes_risk(patient_context)
        t2d_score = max(0.0, 100.0 - t2d_risk["score"])
        breakdown["diabetes"] = {
            "score": float(round(t2d_score, 1)),
            "weight": WEIGHTS["diabetes"],
            "weightedScore": float(round(t2d_score * WEIGHTS["diabetes"], 1)),
            "riskLevel": t2d_risk["level"],
            "factors": t2d_risk["topFactors"][:3],
        }

        # 3. Vitals stability dimension
        vitals_score = await self._compute_vitals_score(patient_context)
        breakdown["vitals"] = {
            "score": float(round(vitals_score, 1)),
            "weight": WEIGHTS["vitals"],
            "weightedScore": float(round(vitals_score * WEIGHTS["vitals"], 1)),
        }

        # 4. Medication safety dimension
        med_score = self._compute_medication_score(patient_context)
        breakdown["medications"] = {
            "score": float(round(med_score, 1)),
            "weight": WEIGHTS["medications"],
            "weightedScore": float(round(med_score * WEIGHTS["medications"], 1)),
        }

        # 5. Emergency flag dimension
        emg_score = await self._compute_emergency_score(patient_context)
        breakdown["emergency"] = {
            "score": float(round(emg_score, 1)),
            "weight": WEIGHTS["emergency"],
            "weightedScore": float(round(emg_score * WEIGHTS["emergency"], 1)),
        }

        # Calculate overall composite score
        overall = sum(d["weightedScore"] for d in breakdown.values())
        overall = float(round(min(100.0, max(0.0, overall)), 1))

        # Determine wellness level
        level_info = self._get_level(overall)

        # Generate improvement tips
        tips = self._generate_tips(breakdown)

        logger.info(
            "Wellness score for %s: %.1f (%s)",
            patient_context.get("patientId", "unknown"), overall, level_info["level"],
        )

        return {
            "overallScore": overall,
            "level": level_info["level"],
            "label": level_info["label"],
            "breakdown": breakdown,
            "improvementTips": tips,
            "calculatedAt": datetime.now(timezone.utc).isoformat(),
        }

    async def _compute_vitals_score(self, patient_context: Dict[str, Any]) -> float:
        """Score based on how many vitals are within normal range."""
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

        if not vitals_list:
            return 75.0  # Default neutral score if no vitals

        baseline = patient_context.get("patientBaseline", {})
        anomalies = await self._vitals_service.analyze(vitals_list, baseline)

        # Calculate score: 100 if no anomalies, deduct per anomaly
        critical_count = sum(1 for a in anomalies if a.get("severity") == "critical")
        warning_count = sum(1 for a in anomalies if a.get("severity") == "warning")

        deductions = critical_count * 30 + warning_count * 15
        return max(0.0, 100.0 - deductions)

    def _compute_medication_score(self, patient_context: Dict[str, Any]) -> float:
        """Score based on medication safety (fewer issues = higher score)."""
        medications = patient_context.get("activeMedications", [])
        if not medications:
            return 90.0  # No meds = reasonably safe

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

        result = self._med_service.check_all(med_names, allergies, conditions)
        total_issues = result["totalIssues"]

        if total_issues == 0:
            return 100.0
        elif total_issues <= 2:
            return 70.0
        elif total_issues <= 4:
            return 40.0
        else:
            return 20.0

    async def _compute_emergency_score(self, patient_context: Dict[str, Any]) -> float:
        """Score based on emergency flag count (0 flags = 100)."""
        flags = await self._emergency_service.evaluate(patient_context)

        critical_count = sum(1 for f in flags if f.get("severity") == "critical")
        warning_count = sum(1 for f in flags if f.get("severity") == "warning")

        if critical_count == 0 and warning_count == 0:
            return 100.0
        elif critical_count == 0:
            return max(50.0, 100.0 - warning_count * 15)
        else:
            return max(0.0, 50.0 - critical_count * 20)

    def _get_level(self, score: float) -> Dict[str, str]:
        """Map score to wellness level."""
        for lvl in WELLNESS_LEVELS:
            if score >= lvl["min"]:
                return {"level": lvl["level"], "label": lvl["label"]}
        return {"level": "critical", "label": "Critical — immediate medical review recommended"}

    def _generate_tips(self, breakdown: Dict[str, Dict[str, Any]]) -> List[str]:
        """Generate improvement tips for the weakest dimensions."""
        tips: List[str] = []

        # Sort dimensions by score (lowest first)
        sorted_dims = sorted(breakdown.items(), key=lambda x: x[1]["score"])

        for dim_name, dim_data in list(sorted_dims)[:3]:
            score = dim_data["score"]
            if score >= 80:
                continue  # Already good

            if dim_name == "cardiovascular" and score < 70:
                tips.append(
                    "💓 Cardiovascular: Focus on heart-healthy diet, regular aerobic exercise, "
                    "and blood pressure management to improve your CV score."
                )
            elif dim_name == "diabetes" and score < 70:
                tips.append(
                    "🩸 Diabetes: Monitor blood glucose regularly, maintain a balanced diet, "
                    "and stay active to reduce your diabetes risk."
                )
            elif dim_name == "vitals" and score < 70:
                tips.append(
                    "📊 Vitals: Some vital signs are outside normal ranges. "
                    "Discuss these readings with your healthcare provider."
                )
            elif dim_name == "medications" and score < 70:
                tips.append(
                    "💊 Medications: Potential medication issues detected. "
                    "Review your current medications with your pharmacist or doctor."
                )
            elif dim_name == "emergency" and score < 70:
                tips.append(
                    "🚨 Emergency: Active health alerts require attention. "
                    "Please consult your physician promptly."
                )

        if not tips:
            tips.append("✅ Great job! Your health indicators are looking good. Keep up the healthy habits!")

        return tips
