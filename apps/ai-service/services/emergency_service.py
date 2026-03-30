"""
MediCore AI Service — Emergency Flags Service (Day 7)
Detects real-time emergency conditions by combining:
  1. Critical vitals anomalies
  2. Critical risk score levels
  3. Dangerous medication interactions
  4. Missing critical medications for known conditions
"""

import logging
from typing import Any, Dict, List

from services.vitals_service import VitalsService  # type: ignore
from services.risk_service import RiskService  # type: ignore

logger = logging.getLogger("medicore-ai.emergency")

# ── Known Dangerous Medication Interactions ──────────────────────────────────
# (med_a, med_b, severity, warning_message)
DANGEROUS_INTERACTIONS: List[Dict[str, str]] = [
    {
        "med_a": "aspirin",
        "med_b": "warfarin",
        "severity": "critical",
        "message": "CRITICAL: Aspirin + Warfarin increases bleeding risk significantly. Consult physician immediately.",
    },
    {
        "med_a": "lisinopril",
        "med_b": "potassium",
        "severity": "warning",
        "message": "WARNING: ACE inhibitor (Lisinopril) + Potassium supplements may cause dangerous hyperkalemia.",
    },
    {
        "med_a": "metformin",
        "med_b": "contrast dye",
        "severity": "warning",
        "message": "WARNING: Metformin should be paused before contrast dye procedures (risk of lactic acidosis).",
    },
    {
        "med_a": "simvastatin",
        "med_b": "amiodarone",
        "severity": "critical",
        "message": "CRITICAL: Simvastatin + Amiodarone significantly increases risk of rhabdomyolysis.",
    },
    {
        "med_a": "ssri",
        "med_b": "maoi",
        "severity": "critical",
        "message": "CRITICAL: SSRI + MAOI can cause serotonin syndrome — a life-threatening condition.",
    },
    {
        "med_a": "ibuprofen",
        "med_b": "aspirin",
        "severity": "warning",
        "message": "WARNING: Ibuprofen may reduce the cardioprotective effects of Aspirin.",
    },
    {
        "med_a": "metformin",
        "med_b": "alcohol",
        "severity": "warning",
        "message": "WARNING: Metformin + Alcohol increases risk of lactic acidosis.",
    },
]

# ── Critical Medications for Common Conditions ──────────────────────────────
# If a patient has the condition but is NOT on any of the expected medications
CRITICAL_MEDS_FOR_CONDITIONS: List[Dict[str, Any]] = [
    {
        "condition": "type 2 diabetes",
        "expected_meds": ["metformin", "insulin", "glipizide", "glimepiride", "sitagliptin"],
        "message": "WARNING: Patient has Type 2 Diabetes but is not on any expected diabetes medication.",
    },
    {
        "condition": "hypertension",
        "expected_meds": ["lisinopril", "amlodipine", "losartan", "metoprolol", "hydrochlorothiazide", "enalapril"],
        "message": "WARNING: Patient has Hypertension but is not on any expected antihypertensive medication.",
    },
    {
        "condition": "atrial fibrillation",
        "expected_meds": ["warfarin", "apixaban", "rivaroxaban", "dabigatran"],
        "message": "CRITICAL: Patient has Atrial Fibrillation but is not on any anticoagulant medication — stroke risk.",
    },
    {
        "condition": "heart failure",
        "expected_meds": ["carvedilol", "metoprolol", "lisinopril", "enalapril", "spironolactone"],
        "message": "CRITICAL: Patient has Heart Failure but is not on any expected cardiac medication.",
    },
]


class EmergencyService:
    """Detects emergency conditions by analyzing vitals, risk scores, and medication safety."""

    def __init__(self) -> None:
        self._vitals_service = VitalsService()
        self._risk_service = RiskService()

    async def evaluate(self, patient_context: Dict[str, Any]) -> List[Dict[str, str]]:
        """
        Evaluate all emergency indicators for a patient.

        Returns a list of emergency flags: [{severity, message}, ...]
        """
        flags: List[Dict[str, str]] = []

        # 1. Check vitals for critical anomalies
        vitals_flags = await self._check_vitals(patient_context)
        flags.extend(vitals_flags)

        # 2. Check risk scores for critical levels
        risk_flags = await self._check_risk_scores(patient_context)
        flags.extend(risk_flags)

        # 3. Check medication interactions
        med_flags = self._check_medication_interactions(patient_context)
        flags.extend(med_flags)

        # 4. Check for missing critical medications
        missing_flags = self._check_missing_medications(patient_context)
        flags.extend(missing_flags)

        # Sort: critical first
        severity_order = {"critical": 0, "warning": 1}
        flags.sort(key=lambda f: severity_order.get(f.get("severity", ""), 2))

        logger.info("Emergency evaluation: %d flags generated", len(flags))
        return flags

    async def _check_vitals(self, patient_context: Dict[str, Any]) -> List[Dict[str, str]]:
        """Convert recent vitals from patient context into anomaly flags."""
        flags: List[Dict[str, str]] = []

        recent_vitals = patient_context.get("recentVitals", {})
        if not recent_vitals:
            return flags

        # Build vitals list from the context format
        vitals_list: List[Dict[str, Any]] = []
        if isinstance(recent_vitals, dict):
            for metric, data in recent_vitals.items():
                if isinstance(data, dict) and "latest" in data:
                    val = data["latest"]
                    if isinstance(val, (int, float)):
                        vitals_list.append({"metric": metric, "value": val})
                    elif isinstance(val, str) and "/" in val:
                        # Blood pressure format "140/90"
                        vitals_list.append({"metric": "blood_pressure", "value": val})
        elif isinstance(recent_vitals, list):
            vitals_list = recent_vitals

        if not vitals_list:
            return flags

        # Run anomaly detection
        baseline = patient_context.get("patientBaseline", {})
        anomalies = await self._vitals_service.analyze(vitals_list, baseline)

        # Only promote CRITICAL anomalies to emergency flags
        for anomaly in anomalies:
            if anomaly.get("severity") == "critical":
                flags.append({
                    "severity": "critical",
                    "message": anomaly["message"],
                })
            elif anomaly.get("severity") == "warning":
                flags.append({
                    "severity": "warning",
                    "message": anomaly["message"],
                })

        return flags

    async def _check_risk_scores(self, patient_context: Dict[str, Any]) -> List[Dict[str, str]]:
        """Check if risk scores are at critical levels."""
        flags: List[Dict[str, str]] = []

        cv_risk = await self._risk_service.compute_cardiovascular_risk(patient_context)
        t2d_risk = await self._risk_service.compute_diabetes_risk(patient_context)

        if cv_risk["level"] == "critical":
            flags.append({
                "severity": "critical",
                "message": f"CRITICAL: Cardiovascular risk score is {cv_risk['score']}/100 — immediate physician review recommended.",
            })
        elif cv_risk["level"] == "high":
            flags.append({
                "severity": "warning",
                "message": f"WARNING: Cardiovascular risk score is elevated at {cv_risk['score']}/100. Top factors: {', '.join(cv_risk['topFactors'][:3])}",
            })

        if t2d_risk["level"] == "critical":
            flags.append({
                "severity": "critical",
                "message": f"CRITICAL: Type 2 Diabetes risk score is {t2d_risk['score']}/100 — immediate physician review recommended.",
            })
        elif t2d_risk["level"] == "high":
            flags.append({
                "severity": "warning",
                "message": f"WARNING: Type 2 Diabetes risk score is elevated at {t2d_risk['score']}/100. Top factors: {', '.join(t2d_risk['topFactors'][:3])}",
            })

        return flags

    def _check_medication_interactions(self, patient_context: Dict[str, Any]) -> List[Dict[str, str]]:
        """Check for dangerous medication interactions."""
        flags: List[Dict[str, str]] = []

        medications = patient_context.get("activeMedications", [])
        med_names = [
            m.get("name", "").lower() if isinstance(m, dict) else str(m).lower()
            for m in medications
        ]

        if not med_names:
            return flags

        # Check each known interaction
        for interaction in DANGEROUS_INTERACTIONS:
            med_a = interaction["med_a"]
            med_b = interaction["med_b"]

            a_found = any(med_a in m for m in med_names)
            b_found = any(med_b in m for m in med_names)

            if a_found and b_found:
                flags.append({
                    "severity": interaction["severity"],
                    "message": interaction["message"],
                })

        return flags

    def _check_missing_medications(self, patient_context: Dict[str, Any]) -> List[Dict[str, str]]:
        """Check if patient is missing critical medications for their conditions."""
        flags: List[Dict[str, str]] = []

        conditions = [
            c.lower() if isinstance(c, str) else c.get("name", "").lower()
            for c in patient_context.get("activeConditions", [])
        ]
        medications = [
            m.get("name", "").lower() if isinstance(m, dict) else str(m).lower()
            for m in patient_context.get("activeMedications", [])
        ]

        if not conditions:
            return flags

        for rule in CRITICAL_MEDS_FOR_CONDITIONS:
            condition = rule["condition"]
            # Check if patient has this condition
            if any(condition in c for c in conditions):
                # Check if patient is on at least one expected medication
                has_expected_med = any(
                    any(expected in m for m in medications)
                    for expected in rule["expected_meds"]
                )
                if not has_expected_med:
                    flags.append({
                        "severity": "critical" if "CRITICAL" in rule["message"] else "warning",
                        "message": rule["message"],
                    })

        return flags
