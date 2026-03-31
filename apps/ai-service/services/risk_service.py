"""
MediCore AI Service — Risk Scoring Engine (Day 5)
Computes cardiovascular and Type 2 Diabetes risk scores
using simplified clinical algorithms based on patient health records.

Algorithms are simplified versions inspired by:
- Cardiovascular: Framingham Risk Score factors
- Diabetes: Finnish Diabetes Risk Score (FINDRISC) factors
"""

import logging
from typing import Any, Dict, List, Tuple

logger = logging.getLogger("medicore-ai.risk")


def _classify(score: float) -> str:
    """Classify a 0-100 risk score into low / moderate / high / critical."""
    if score >= 75:
        return "critical"
    elif score >= 50:
        return "high"
    elif score >= 25:
        return "moderate"
    return "low"


class RiskService:
    """Calculates patient risk scores using simplified clinical algorithms."""

    # ══════════════════════════════════════════════════════════════════════════
    # Cardiovascular Risk
    # ══════════════════════════════════════════════════════════════════════════

    async def compute_cardiovascular_risk(
        self, patient_context: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Compute cardiovascular risk score (0-100) based on:
        - Age, gender
        - Blood pressure (systolic)
        - Active conditions (hypertension, diabetes, high cholesterol)
        - Medications (statins, antihypertensives)
        - Smoking status (if available)
        - BMI (if available)
        """
        score = 0.0
        factors: List[str] = []

        demographics = patient_context.get("demographics", {})
        conditions = [
            c.lower() if isinstance(c, str) else c.get("name", "").lower()
            for c in patient_context.get("activeConditions", [])
        ]
        medications = [
            m.get("name", "").lower() if isinstance(m, dict) else str(m).lower()
            for m in patient_context.get("activeMedications", [])
        ]
        vitals = patient_context.get("recentVitals", {})

        # ── Age factor ───────────────────────────────────────────────────────
        age = demographics.get("age", 0)
        if isinstance(age, (int, float)):
            if age >= 65:
                score += 25
                factors.append(f"Age {age} (≥65 — high risk)")
            elif age >= 55:
                score += 18
                factors.append(f"Age {age} (55-64 — elevated risk)")
            elif age >= 45:
                score += 10
                factors.append(f"Age {age} (45-54 — moderate risk)")

        # ── Gender factor ────────────────────────────────────────────────────
        gender = str(demographics.get("gender", "")).lower()
        if gender == "male":
            score += 5
            factors.append("Male gender (statistically higher CV risk)")

        # ── Blood pressure ───────────────────────────────────────────────────
        bp_data = vitals.get("blood_pressure", vitals.get("bloodPressure", {}))
        if isinstance(bp_data, dict):
            bp_str = bp_data.get("latest", "")
            if isinstance(bp_str, str) and "/" in bp_str:
                try:
                    systolic = int(bp_str.split("/")[0])
                    if systolic >= 160:
                        score += 20
                        factors.append(f"Systolic BP {systolic} mmHg (stage 2 hypertension)")
                    elif systolic >= 140:
                        score += 15
                        factors.append(f"Systolic BP {systolic} mmHg (stage 1 hypertension)")
                    elif systolic >= 130:
                        score += 8
                        factors.append(f"Systolic BP {systolic} mmHg (elevated)")
                except (ValueError, IndexError):
                    pass

        # ── Conditions ───────────────────────────────────────────────────────
        if any("hypertension" in c for c in conditions):
            score += 12
            factors.append("Active hypertension diagnosis")
        if any("diabetes" in c for c in conditions):
            score += 10
            factors.append("Diabetes (increases CV risk)")
        if any("cholesterol" in c or "hyperlipidemia" in c for c in conditions):
            score += 10
            factors.append("High cholesterol / hyperlipidemia")
        if any("obesity" in c for c in conditions):
            score += 8
            factors.append("Obesity diagnosis")
        if any("smoking" in c or "smoker" in c for c in conditions):
            score += 15
            factors.append("Smoking history")

        # ── Protective medications ───────────────────────────────────────────
        if any("statin" in m or "atorvastatin" in m or "rosuvastatin" in m for m in medications):
            score -= 5
            factors.append("On statin therapy (protective)")
        if any("aspirin" in m for m in medications):
            score -= 3
            factors.append("On aspirin therapy (protective)")

        # ── Heart rate factor ────────────────────────────────────────────────
        hr_data = vitals.get("heart_rate", vitals.get("heartRate", {}))
        if isinstance(hr_data, dict):
            hr = hr_data.get("latest")
            if isinstance(hr, (int, float)):
                if hr > 100:
                    score += 8
                    factors.append(f"Elevated resting heart rate ({hr} bpm)")
                elif hr > 90:
                    score += 4
                    factors.append(f"Borderline elevated heart rate ({hr} bpm)")

        # Clamp score to 0-100
        score = max(0.0, min(100.0, round(score, 1)))
        level = _classify(score)

        logger.info("CV risk: score=%.1f level=%s factors=%d", score, level, len(factors))
        return {"score": score, "level": level, "topFactors": factors[:5]}

    # ══════════════════════════════════════════════════════════════════════════
    # Type 2 Diabetes Risk
    # ══════════════════════════════════════════════════════════════════════════

    async def compute_diabetes_risk(
        self, patient_context: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Compute Type 2 Diabetes risk score (0-100) based on:
        - Age, BMI
        - Family history of diabetes
        - Fasting blood sugar / HbA1c levels
        - Active conditions (prediabetes, PCOS, gestational diabetes history)
        - Physical activity level
        """
        score = 0.0
        factors: List[str] = []

        demographics = patient_context.get("demographics", {})
        conditions = [
            c.lower() if isinstance(c, str) else c.get("name", "").lower()
            for c in patient_context.get("activeConditions", [])
        ]
        medications = [
            m.get("name", "").lower() if isinstance(m, dict) else str(m).lower()
            for m in patient_context.get("activeMedications", [])
        ]
        vitals = patient_context.get("recentVitals", {})
        family_history = patient_context.get("familyHistory", {})

        # ── Already diagnosed ────────────────────────────────────────────────
        if any("type 2 diabetes" in c or "diabetes mellitus" in c or "t2d" in c for c in conditions):
            score += 40
            factors.append("Existing Type 2 Diabetes diagnosis")
        elif any("prediabetes" in c or "impaired glucose" in c for c in conditions):
            score += 25
            factors.append("Prediabetes / impaired glucose tolerance")

        # ── Age factor ───────────────────────────────────────────────────────
        age = demographics.get("age", 0)
        if isinstance(age, (int, float)):
            if age >= 60:
                score += 15
                factors.append(f"Age {age} (≥60 — high diabetes risk)")
            elif age >= 45:
                score += 10
                factors.append(f"Age {age} (45-59 — moderate risk)")
            elif age >= 35:
                score += 5
                factors.append(f"Age {age} (35-44 — slightly elevated)")

        # ── Blood sugar / HbA1c ──────────────────────────────────────────────
        bs_data = vitals.get("blood_sugar", vitals.get("bloodSugar", vitals.get("bloodGlucose", {})))
        if isinstance(bs_data, dict):
            bs_val = bs_data.get("latest")
            if isinstance(bs_val, (int, float)):
                if bs_val >= 200:
                    score += 25
                    factors.append(f"Blood sugar {bs_val} mg/dL (diabetic range)")
                elif bs_val >= 140:
                    score += 18
                    factors.append(f"Blood sugar {bs_val} mg/dL (impaired)")
                elif bs_val >= 100:
                    score += 8
                    factors.append(f"Blood sugar {bs_val} mg/dL (borderline)")

            # Check trend
            trend = bs_data.get("trend", "stable")
            if trend == "up":
                score += 5
                factors.append("Blood sugar trending upward")

        # ── Family history ───────────────────────────────────────────────────
        if isinstance(family_history, dict):
            fh_str = str(family_history).lower()
            if "diabetes" in fh_str:
                score += 12
                factors.append("Family history of diabetes")
        elif isinstance(family_history, list):
            if any("diabetes" in str(fh).lower() for fh in family_history):
                score += 12
                factors.append("Family history of diabetes")

        # ── Conditions that elevate T2D risk ─────────────────────────────────
        if any("hypertension" in c for c in conditions):
            score += 6
            factors.append("Hypertension (associated with T2D)")
        if any("pcos" in c or "polycystic" in c for c in conditions):
            score += 10
            factors.append("PCOS (insulin resistance risk)")
        if any("obesity" in c for c in conditions):
            score += 12
            factors.append("Obesity (major T2D risk factor)")
        if any("gestational diabetes" in c for c in conditions):
            score += 15
            factors.append("History of gestational diabetes")

        # ── Protective: on Metformin ─────────────────────────────────────────
        if any("metformin" in m for m in medications):
            score -= 5
            factors.append("On Metformin therapy (protective)")

        # Clamp score to 0-100
        score = max(0.0, min(100.0, round(score, 1)))
        level = _classify(score)

        logger.info("T2D risk: score=%.1f level=%s factors=%d", score, level, len(factors))
        return {"score": score, "level": level, "topFactors": factors[:5]}
