"""
MediCore AI Service — Symptom Checker Service (Day 12)
Analyzes reported symptoms to suggest:
  1. Possible conditions (with confidence & disclaimers)
  2. Urgency level (emergency → routine)
  3. Red flag detection for life-threatening symptoms
  4. Recommended next steps
"""

import logging
from datetime import datetime, timezone
from typing import Any, Dict, List

logger = logging.getLogger("medicore-ai.symptoms")


# ── Red Flag Symptoms (immediate emergency) ──────────────────────────────────
RED_FLAG_SYMPTOMS: Dict[str, str] = {
    "chest pain": "Possible cardiac event — seek emergency care immediately.",
    "crushing chest pressure": "Possible myocardial infarction — call emergency services.",
    "difficulty breathing": "Acute respiratory distress — seek immediate medical attention.",
    "shortness of breath": "May indicate cardiac or pulmonary emergency if sudden onset.",
    "sudden severe headache": "Possible stroke or aneurysm — seek emergency care.",
    "worst headache of my life": "Thunderclap headache — possible subarachnoid hemorrhage.",
    "sudden numbness": "Possible stroke — F.A.S.T. assessment needed immediately.",
    "facial drooping": "Stroke symptom — call emergency services immediately.",
    "slurred speech": "Possible stroke — seek emergency care immediately.",
    "sudden vision loss": "Possible stroke or retinal detachment — emergency.",
    "coughing blood": "Hemoptysis — requires urgent evaluation.",
    "vomiting blood": "Upper GI bleed — seek emergency care.",
    "severe abdominal pain": "May indicate appendicitis, perforation, or other surgical emergency.",
    "fainting": "Syncope may indicate cardiac arrhythmia or other serious condition.",
    "seizure": "Requires immediate medical evaluation.",
    "allergic reaction": "If severe (anaphylaxis), use EpiPen and call emergency services.",
    "swelling of face": "Possible angioedema or anaphylaxis — seek emergency care.",
    "high fever": "Fever above 39.5°C/103°F requires urgent evaluation.",
    "confusion": "Altered mental status — may indicate stroke, infection, or metabolic crisis.",
    "uncontrolled bleeding": "Apply pressure and seek emergency care.",
}

# ── Symptom → Possible Condition Mapping ─────────────────────────────────────
# Each entry: { symptoms: [...], condition, confidence: high/moderate/low, description }
SYMPTOM_CONDITION_MAP: List[Dict[str, Any]] = [
    {
        "symptoms": ["headache", "fatigue", "dizziness"],
        "condition": "Tension Headache / Migraine",
        "confidence": "moderate",
        "description": "Recurring headaches with fatigue may indicate tension-type or migraine headaches.",
        "urgency": "routine",
    },
    {
        "symptoms": ["fever", "cough", "sore throat"],
        "condition": "Upper Respiratory Infection",
        "confidence": "moderate",
        "description": "Common cold or viral respiratory infection. Usually self-limiting.",
        "urgency": "routine",
    },
    {
        "symptoms": ["fever", "cough", "shortness of breath", "chest pain"],
        "condition": "Pneumonia",
        "confidence": "moderate",
        "description": "Combination of respiratory symptoms with fever may suggest pneumonia.",
        "urgency": "urgent",
    },
    {
        "symptoms": ["frequent urination", "excessive thirst", "fatigue", "blurred vision"],
        "condition": "Possible Diabetes / Hyperglycemia",
        "confidence": "moderate",
        "description": "Classic diabetic symptoms. Blood glucose testing recommended.",
        "urgency": "soon",
    },
    {
        "symptoms": ["chest pain", "shortness of breath", "sweating", "nausea"],
        "condition": "Possible Cardiac Event",
        "confidence": "high",
        "description": "This combination is consistent with acute coronary syndrome. Seek emergency care.",
        "urgency": "emergency",
    },
    {
        "symptoms": ["joint pain", "swelling", "stiffness", "fatigue"],
        "condition": "Arthritis / Inflammatory Condition",
        "confidence": "low",
        "description": "Joint symptoms may indicate rheumatoid arthritis or other inflammatory conditions.",
        "urgency": "routine",
    },
    {
        "symptoms": ["abdominal pain", "nausea", "vomiting", "diarrhea"],
        "condition": "Gastroenteritis / GI Disorder",
        "confidence": "moderate",
        "description": "GI symptoms may indicate viral gastroenteritis or food-related illness.",
        "urgency": "routine",
    },
    {
        "symptoms": ["abdominal pain", "right lower quadrant", "fever", "nausea"],
        "condition": "Possible Appendicitis",
        "confidence": "moderate",
        "description": "Right lower quadrant pain with fever and nausea warrants surgical evaluation.",
        "urgency": "emergency",
    },
    {
        "symptoms": ["weight gain", "fatigue", "cold intolerance", "dry skin"],
        "condition": "Possible Hypothyroidism",
        "confidence": "low",
        "description": "Symptoms may suggest underactive thyroid. TSH blood test recommended.",
        "urgency": "routine",
    },
    {
        "symptoms": ["palpitations", "anxiety", "weight loss", "tremor"],
        "condition": "Possible Hyperthyroidism",
        "confidence": "low",
        "description": "Symptoms may suggest overactive thyroid. Thyroid function tests recommended.",
        "urgency": "soon",
    },
    {
        "symptoms": ["back pain", "leg numbness", "weakness"],
        "condition": "Possible Disc Herniation / Radiculopathy",
        "confidence": "low",
        "description": "Back pain with neurological symptoms may indicate nerve compression.",
        "urgency": "soon",
    },
    {
        "symptoms": ["rash", "fever", "fatigue", "joint pain"],
        "condition": "Possible Autoimmune or Infectious Condition",
        "confidence": "low",
        "description": "Combination of systemic symptoms with rash requires clinical evaluation.",
        "urgency": "soon",
    },
]


class SymptomCheckerService:
    """Analyzes reported symptoms and provides clinical guidance with appropriate disclaimers."""

    def analyze(
        self,
        symptoms: List[str],
        patient_age: int | None = None,
        patient_gender: str | None = None,
        existing_conditions: List[str] | None = None,
    ) -> Dict[str, Any]:
        """
        Analyze a list of symptoms and return possible conditions with urgency.

        Returns:
            {
                "urgency": "emergency" | "urgent" | "soon" | "routine",
                "redFlags": [...],
                "possibleConditions": [...],
                "recommendations": [...],
                "disclaimer": str,
                "analyzedAt": str
            }
        """
        symptom_lower = [s.lower().strip() for s in symptoms]
        conditions_lower = [c.lower() for c in (existing_conditions or [])]

        # 1. Check for red flags
        red_flags = self._check_red_flags(symptom_lower)

        # 2. Match symptoms to possible conditions
        possible_conditions = self._match_conditions(symptom_lower)

        # 3. Determine urgency level
        urgency = self._determine_urgency(red_flags, possible_conditions)

        # 4. Generate recommendations
        recommendations = self._generate_recommendations(
            urgency, red_flags, possible_conditions, conditions_lower
        )

        logger.info(
            "Symptom analysis: %d symptoms, %d red flags, %d matches, urgency=%s",
            len(symptoms), len(red_flags), len(possible_conditions), urgency,
        )

        return {
            "urgency": urgency,
            "redFlags": red_flags,
            "possibleConditions": possible_conditions,
            "recommendations": recommendations,
            "disclaimer": (
                "This is an AI-assisted symptom analysis tool and is NOT a medical diagnosis. "
                "It is intended for informational purposes only. Always consult a qualified "
                "healthcare provider for proper diagnosis and treatment."
            ),
            "analyzedAt": datetime.now(timezone.utc).isoformat(),
        }

    def _check_red_flags(self, symptoms: List[str]) -> List[Dict[str, str]]:
        """Check for life-threatening red flag symptoms (exact phrase match)."""
        flags: List[Dict[str, str]] = []
        for symptom in symptoms:
            for red_flag, warning in RED_FLAG_SYMPTOMS.items():
                # Exact match: the reported symptom must be the red flag phrase
                # or the red flag must be an exact match to the symptom
                if symptom == red_flag or red_flag == symptom:
                    flags.append({
                        "symptom": symptom,
                        "warning": warning,
                        "severity": "critical",
                    })
        return flags

    def _match_conditions(self, symptoms: List[str]) -> List[Dict[str, Any]]:
        """Match reported symptoms against known condition patterns."""
        matches: List[Dict[str, Any]] = []

        for entry in SYMPTOM_CONDITION_MAP:
            entry_symptoms = entry["symptoms"]
            # Count how many of the entry's symptoms the patient has
            matched_count = sum(
                1 for es in entry_symptoms
                if any(es in s or s in es for s in symptoms)
            )

            if matched_count == 0:
                continue

            match_ratio = matched_count / len(entry_symptoms)

            # Require at least 50% symptom match
            if match_ratio >= 0.5:
                # Adjust confidence based on match ratio
                if match_ratio >= 0.8:
                    confidence = "high"
                elif match_ratio >= 0.6:
                    confidence = "moderate"
                else:
                    confidence = "low"

                matches.append({
                    "condition": entry["condition"],
                    "confidence": confidence,
                    "matchedSymptoms": matched_count,
                    "totalSymptoms": len(entry_symptoms),
                    "matchRatio": round(match_ratio * 100),
                    "description": entry["description"],
                    "urgency": entry["urgency"],
                })

        # Sort by match ratio descending
        matches.sort(key=lambda m: m["matchRatio"], reverse=True)
        return matches

    def _determine_urgency(
        self,
        red_flags: List[Dict[str, str]],
        conditions: List[Dict[str, Any]],
    ) -> str:
        """Determine overall urgency level."""
        if red_flags:
            return "emergency"

        urgency_order = {"emergency": 0, "urgent": 1, "soon": 2, "routine": 3}
        min_urgency = "routine"

        for cond in conditions:
            cond_urgency = cond.get("urgency", "routine")
            if urgency_order.get(cond_urgency, 3) < urgency_order.get(min_urgency, 3):
                min_urgency = cond_urgency

        return min_urgency

    def _generate_recommendations(
        self,
        urgency: str,
        red_flags: List[Dict[str, str]],
        conditions: List[Dict[str, Any]],
        existing_conditions: List[str],
    ) -> List[str]:
        """Generate actionable recommendations based on analysis."""
        recs: List[str] = []

        if urgency == "emergency":
            recs.append("⚠️ SEEK EMERGENCY MEDICAL CARE IMMEDIATELY. Call your local emergency number.")
            if red_flags:
                recs.append(f"Red flag symptoms detected: {', '.join(f['symptom'] for f in red_flags)}.")
        elif urgency == "urgent":
            recs.append("Schedule an urgent appointment with your doctor within 24-48 hours.")
        elif urgency == "soon":
            recs.append("Schedule an appointment with your doctor within the next week.")
        else:
            recs.append("Schedule a routine appointment with your doctor at your convenience.")

        # Add condition-specific advice
        if any("diabetes" in c for c in existing_conditions):
            recs.append("As a diabetic patient, monitor blood glucose levels closely with these symptoms.")

        if any("hypertension" in c for c in existing_conditions):
            recs.append("As a hypertensive patient, monitor blood pressure regularly with these symptoms.")

        recs.append("Please discuss all symptoms with your healthcare provider for proper evaluation.")

        return recs
