"""
MediCore AI Service — Care Plan Generator Service (Day 12)
Generates personalized care recommendations based on:
  - Active conditions
  - Current medications
  - Risk scores
  - Recent vitals
  - Patient demographics
"""

import logging
from datetime import datetime, timezone
from typing import Any, Dict, List

from services.risk_service import RiskService  # type: ignore

logger = logging.getLogger("medicore-ai.careplan")


# ── Condition-Specific Care Guidelines ───────────────────────────────────────
CARE_GUIDELINES: Dict[str, Dict[str, Any]] = {
    "type 2 diabetes": {
        "monitoring": [
            "Check blood glucose at least twice daily (fasting + post-meal)",
            "HbA1c test every 3 months (target < 7.0%)",
            "Annual eye exam (diabetic retinopathy screening)",
            "Annual foot exam (neuropathy screening)",
            "Regular kidney function tests (creatinine, eGFR, urine albumin)",
        ],
        "lifestyle": [
            "Follow a balanced diet low in refined carbohydrates",
            "Target 150 minutes of moderate exercise per week",
            "Maintain a healthy BMI (18.5-24.9)",
            "Avoid skipping meals to prevent blood sugar fluctuations",
        ],
        "priority": "high",
    },
    "hypertension": {
        "monitoring": [
            "Check blood pressure daily at the same time",
            "Keep a BP log and share with your doctor",
            "Monitor for headaches, dizziness, or visual changes",
            "Regular kidney function tests",
        ],
        "lifestyle": [
            "Follow a DASH diet (low sodium, rich in fruits and vegetables)",
            "Limit sodium intake to less than 2,300 mg/day",
            "Regular aerobic exercise (30 mins, 5 days/week)",
            "Limit alcohol consumption",
            "Practice stress management techniques",
        ],
        "priority": "high",
    },
    "heart failure": {
        "monitoring": [
            "Weigh yourself daily — report gain of > 2 lbs in a day or 5 lbs in a week",
            "Monitor for increased shortness of breath or swelling",
            "Track fluid intake (usually limited to 1.5-2 L/day)",
            "Regular cardiac check-ups every 3-6 months",
        ],
        "lifestyle": [
            "Restrict sodium to less than 1,500 mg/day",
            "Take medications exactly as prescribed — do not skip doses",
            "Stay as active as tolerated with your doctor's guidance",
            "Get annual flu and pneumonia vaccinations",
        ],
        "priority": "critical",
    },
    "atrial fibrillation": {
        "monitoring": [
            "Monitor heart rate daily — report persistent rates above 100 bpm",
            "Report any episodes of palpitations, dizziness, or fainting",
            "Get regular INR checks if on Warfarin",
            "Echocardiogram annually or as advised",
        ],
        "lifestyle": [
            "Limit caffeine and alcohol intake",
            "Maintain a heart-healthy diet",
            "Take anticoagulants as prescribed without missing doses",
        ],
        "priority": "high",
    },
    "asthma": {
        "monitoring": [
            "Use a peak flow meter daily to track lung function",
            "Track asthma trigger exposure (allergens, cold air, exercise)",
            "Keep rescue inhaler accessible at all times",
        ],
        "lifestyle": [
            "Avoid known triggers (dust, pollen, smoke, cold air)",
            "Follow your asthma action plan from your doctor",
            "Get annual flu vaccination",
            "Stay physically active within your comfort level",
        ],
        "priority": "moderate",
    },
    "depression": {
        "monitoring": [
            "Attend regular follow-ups with your mental health provider",
            "Track mood changes — report worsening symptoms promptly",
            "Take antidepressants as prescribed — do not stop abruptly",
        ],
        "lifestyle": [
            "Maintain a regular sleep schedule (7-9 hours)",
            "Exercise regularly — even 20 minutes of walking helps",
            "Stay connected with supportive friends and family",
            "Avoid alcohol and recreational drugs",
            "Practice mindfulness or relaxation techniques",
        ],
        "priority": "moderate",
    },
}


class CarePlanService:
    """Generates personalized care plans based on patient context."""

    def __init__(self) -> None:
        self._risk_service = RiskService()

    async def generate(self, patient_context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Generate a personalized care plan for a patient.

        Returns:
            {
                "patientId": str,
                "conditions": [...],
                "generalRecommendations": [...],
                "riskBasedActions": [...],
                "medicationReminders": [...],
                "generatedAt": str,
                "disclaimer": str
            }
        """
        patient_id = patient_context.get("patientId", "unknown")
        demographics = patient_context.get("demographics", {})
        age = demographics.get("age", 0)
        conditions_raw = patient_context.get("activeConditions", [])
        medications = patient_context.get("activeMedications", [])

        conditions = [
            c.lower() if isinstance(c, str) else c.get("name", "").lower()
            for c in conditions_raw
        ]

        # 1. Generate condition-specific care plans
        condition_plans = self._get_condition_plans(conditions)

        # 2. Generate risk-based actions
        risk_actions = await self._get_risk_actions(patient_context)

        # 3. Generate medication reminders
        med_reminders = self._get_medication_reminders(medications)

        # 4. Generate general recommendations based on demographics
        general_recs = self._get_general_recommendations(age, conditions)

        logger.info(
            "Care plan for %s: %d conditions, %d risk actions, %d med reminders",
            patient_id, len(condition_plans), len(risk_actions), len(med_reminders),
        )

        return {
            "patientId": patient_id,
            "conditions": condition_plans,
            "generalRecommendations": general_recs,
            "riskBasedActions": risk_actions,
            "medicationReminders": med_reminders,
            "totalItems": len(condition_plans) + len(risk_actions) + len(med_reminders) + len(general_recs),
            "generatedAt": datetime.now(timezone.utc).isoformat(),
            "disclaimer": (
                "This care plan is AI-generated and intended for informational purposes only. "
                "It does not replace professional medical advice. Please review all recommendations "
                "with your healthcare provider before making changes to your care routine."
            ),
        }

    def _get_condition_plans(
        self, conditions: List[str]
    ) -> List[Dict[str, Any]]:
        """Get care guidelines for each active condition."""
        plans: List[Dict[str, Any]] = []
        for condition in conditions:
            for guideline_key, guideline in CARE_GUIDELINES.items():
                if guideline_key in condition or condition in guideline_key:
                    plans.append({
                        "condition": condition,
                        "priority": guideline["priority"],
                        "monitoring": guideline["monitoring"],
                        "lifestyle": guideline["lifestyle"],
                    })
                    break
        return plans

    async def _get_risk_actions(
        self, patient_context: Dict[str, Any]
    ) -> List[Dict[str, str]]:
        """Generate actions based on risk score levels."""
        actions: List[Dict[str, str]] = []

        cv_risk = await self._risk_service.compute_cardiovascular_risk(patient_context)
        t2d_risk = await self._risk_service.compute_diabetes_risk(patient_context)

        if cv_risk["level"] in ("high", "critical"):
            actions.append({
                "risk": "Cardiovascular",
                "level": cv_risk["level"],
                "action": (
                    f"Your cardiovascular risk score is {cv_risk['score']}/100 ({cv_risk['level']}). "
                    f"Key factors: {', '.join(cv_risk['topFactors'][:3])}. "
                    "Schedule a cardiac evaluation with your doctor."
                ),
            })
        elif cv_risk["level"] == "moderate":
            actions.append({
                "risk": "Cardiovascular",
                "level": cv_risk["level"],
                "action": (
                    "Moderate cardiovascular risk. Focus on lifestyle modifications: "
                    "regular exercise, heart-healthy diet, and stress management."
                ),
            })

        if t2d_risk["level"] in ("high", "critical"):
            actions.append({
                "risk": "Type 2 Diabetes",
                "level": t2d_risk["level"],
                "action": (
                    f"Your diabetes risk score is {t2d_risk['score']}/100 ({t2d_risk['level']}). "
                    f"Key factors: {', '.join(t2d_risk['topFactors'][:3])}. "
                    "Discuss blood sugar management with your doctor."
                ),
            })

        return actions

    def _get_medication_reminders(
        self, medications: List[Any]
    ) -> List[Dict[str, str]]:
        """Generate medication-specific reminders."""
        reminders: List[Dict[str, str]] = []
        for med in medications:
            name = med.get("name", "") if isinstance(med, dict) else str(med)
            dose = med.get("dose", "") if isinstance(med, dict) else ""
            freq = med.get("frequency", "") if isinstance(med, dict) else ""

            if not name:
                continue

            reminder = f"Take {name}"
            if dose:
                reminder += f" ({dose})"
            if freq:
                reminder += f" — {freq}"

            # Add specific advice for common medications
            name_lower = name.lower()
            if "metformin" in name_lower:
                reminder += ". Take with food to reduce GI side effects."
            elif "statin" in name_lower or "atorvastatin" in name_lower:
                reminder += ". Take at bedtime for best efficacy."
            elif "warfarin" in name_lower:
                reminder += ". Maintain consistent vitamin K intake. Report any unusual bleeding."
            elif "insulin" in name_lower:
                reminder += ". Rotate injection sites. Store properly."

            reminders.append({"medication": name, "reminder": reminder})

        return reminders

    def _get_general_recommendations(
        self, age: int, conditions: List[str]
    ) -> List[str]:
        """Generate age and condition-appropriate general health recommendations."""
        recs: List[str] = []

        # Universal recommendations
        recs.append("Stay hydrated — aim for 8 glasses of water per day.")
        recs.append("Get 7-9 hours of quality sleep each night.")

        # Age-based recommendations
        if age >= 50:
            recs.append("Schedule regular cancer screenings (colonoscopy, mammogram/PSA as applicable).")
            recs.append("Discuss bone density screening with your doctor.")
            recs.append("Get annual flu and pneumonia vaccinations.")
        elif age >= 40:
            recs.append("Discuss cardiovascular screening schedule with your doctor.")
            recs.append("Get annual health check-ups including cholesterol and blood sugar.")
        elif age >= 18:
            recs.append("Maintain regular health check-ups at least annually.")

        # Condition-aware recommendations
        if not conditions:
            recs.append("Continue healthy lifestyle habits for disease prevention.")

        recs.append("Keep an updated list of all medications and share with every healthcare provider.")

        return recs
