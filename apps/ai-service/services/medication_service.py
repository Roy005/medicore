"""
MediCore AI Service — Medication Safety Service (Day 11)
Standalone medication safety checker that validates:
  1. Drug-drug interactions
  2. Drug-allergy conflicts
  3. Duplicate therapy detection
  4. Contraindications with active conditions
"""

import logging
from typing import Any, Dict, List, Literal

logger = logging.getLogger("medicore-ai.med-safety")


# ── Known Drug-Drug Interactions ─────────────────────────────────────────────
DRUG_INTERACTIONS: List[Dict[str, str]] = [
    {"a": "aspirin", "b": "warfarin", "severity": "critical",
     "detail": "Aspirin + Warfarin increases bleeding risk significantly."},
    {"a": "lisinopril", "b": "potassium", "severity": "warning",
     "detail": "ACE inhibitor + Potassium supplements may cause hyperkalemia."},
    {"a": "metformin", "b": "contrast dye", "severity": "warning",
     "detail": "Metformin should be paused before contrast dye procedures (lactic acidosis risk)."},
    {"a": "simvastatin", "b": "amiodarone", "severity": "critical",
     "detail": "Simvastatin + Amiodarone significantly increases rhabdomyolysis risk."},
    {"a": "ssri", "b": "maoi", "severity": "critical",
     "detail": "SSRI + MAOI can cause serotonin syndrome — a life-threatening condition."},
    {"a": "ibuprofen", "b": "aspirin", "severity": "warning",
     "detail": "Ibuprofen may reduce the cardioprotective effects of Aspirin."},
    {"a": "metformin", "b": "alcohol", "severity": "warning",
     "detail": "Metformin + Alcohol increases risk of lactic acidosis."},
    {"a": "warfarin", "b": "nsaid", "severity": "critical",
     "detail": "Warfarin + NSAIDs dramatically increases GI bleeding risk."},
    {"a": "lithium", "b": "ibuprofen", "severity": "critical",
     "detail": "NSAIDs can increase lithium levels to toxic range."},
    {"a": "digoxin", "b": "amiodarone", "severity": "critical",
     "detail": "Amiodarone increases digoxin levels — risk of digoxin toxicity."},
    {"a": "clopidogrel", "b": "omeprazole", "severity": "warning",
     "detail": "Omeprazole may reduce the antiplatelet effect of Clopidogrel."},
    {"a": "methotrexate", "b": "trimethoprim", "severity": "critical",
     "detail": "Trimethoprim + Methotrexate increases risk of bone marrow suppression."},
    {"a": "ciprofloxacin", "b": "theophylline", "severity": "critical",
     "detail": "Ciprofloxacin increases theophylline levels — seizure risk."},
    {"a": "fluoxetine", "b": "tramadol", "severity": "critical",
     "detail": "Fluoxetine + Tramadol increases risk of serotonin syndrome and seizures."},
]

# ── Drug-Allergy Cross-References ────────────────────────────────────────────
# Drug class → common allergens that contraindicate the drug
DRUG_ALLERGY_MAP: Dict[str, List[str]] = {
    "amoxicillin": ["penicillin", "amoxicillin", "ampicillin", "beta-lactam"],
    "ampicillin": ["penicillin", "amoxicillin", "ampicillin", "beta-lactam"],
    "penicillin": ["penicillin", "amoxicillin", "ampicillin", "beta-lactam"],
    "cephalexin": ["penicillin", "cephalosporin", "beta-lactam"],
    "cefazolin": ["penicillin", "cephalosporin", "beta-lactam"],
    "sulfa": ["sulfonamide", "sulfa", "sulfamethoxazole", "trimethoprim-sulfamethoxazole"],
    "sulfamethoxazole": ["sulfonamide", "sulfa", "sulfamethoxazole"],
    "aspirin": ["aspirin", "nsaid", "salicylate"],
    "ibuprofen": ["nsaid", "ibuprofen", "aspirin"],
    "naproxen": ["nsaid", "naproxen"],
    "codeine": ["codeine", "morphine", "opioid"],
    "morphine": ["morphine", "codeine", "opioid"],
    "tramadol": ["tramadol", "opioid"],
}

# ── Condition Contraindications ──────────────────────────────────────────────
# Medications that are contraindicated with certain conditions
CONDITION_CONTRAINDICATIONS: List[Dict[str, Any]] = [
    {"drug": "metformin", "condition": "kidney disease", "severity": "critical",
     "detail": "Metformin is contraindicated in severe kidney disease (lactic acidosis risk)."},
    {"drug": "nsaid", "condition": "kidney disease", "severity": "warning",
     "detail": "NSAIDs can worsen kidney function in patients with kidney disease."},
    {"drug": "ibuprofen", "condition": "kidney disease", "severity": "warning",
     "detail": "Ibuprofen can worsen kidney function in patients with kidney disease."},
    {"drug": "metformin", "condition": "liver disease", "severity": "warning",
     "detail": "Metformin should be used with caution in liver disease."},
    {"drug": "statin", "condition": "liver disease", "severity": "warning",
     "detail": "Statins may worsen liver function — regular monitoring required."},
    {"drug": "beta-blocker", "condition": "asthma", "severity": "critical",
     "detail": "Non-selective beta-blockers are contraindicated in asthma (bronchospasm risk)."},
    {"drug": "metoprolol", "condition": "asthma", "severity": "warning",
     "detail": "Metoprolol (selective beta-blocker) should be used with caution in asthma."},
    {"drug": "aspirin", "condition": "bleeding disorder", "severity": "critical",
     "detail": "Aspirin is contraindicated in bleeding disorders (increased bleeding risk)."},
]

# ── Duplicate Therapy Classes ────────────────────────────────────────────────
THERAPY_CLASSES: Dict[str, List[str]] = {
    "NSAID": ["ibuprofen", "naproxen", "diclofenac", "celecoxib", "meloxicam", "aspirin"],
    "ACE Inhibitor": ["lisinopril", "enalapril", "ramipril", "benazepril", "captopril"],
    "ARB": ["losartan", "valsartan", "irbesartan", "candesartan", "telmisartan"],
    "Statin": ["atorvastatin", "rosuvastatin", "simvastatin", "pravastatin", "lovastatin"],
    "SSRI": ["fluoxetine", "sertraline", "paroxetine", "citalopram", "escitalopram"],
    "PPI": ["omeprazole", "pantoprazole", "lansoprazole", "esomeprazole", "rabeprazole"],
    "Benzodiazepine": ["diazepam", "lorazepam", "alprazolam", "clonazepam", "midazolam"],
    "Opioid": ["morphine", "oxycodone", "hydrocodone", "fentanyl", "codeine", "tramadol"],
}


class MedicationSafetyService:
    """Checks medications for interactions, allergy conflicts, duplicates, and contraindications."""

    def check_all(
        self,
        medications: List[str],
        allergies: List[str],
        conditions: List[str],
    ) -> Dict[str, Any]:
        """
        Run all safety checks on a medication list.

        Returns:
            {
                "safe": bool,
                "interactions": [...],
                "allergyConflicts": [...],
                "duplicates": [...],
                "contraindications": [...],
                "totalIssues": int
            }
        """
        med_lower = [m.lower().strip() for m in medications]
        allergy_lower = [a.lower().strip() for a in allergies]
        cond_lower = [c.lower().strip() for c in conditions]

        interactions = self._check_interactions(med_lower)
        allergy_conflicts = self._check_allergy_conflicts(med_lower, allergy_lower)
        duplicates = self._check_duplicates(med_lower)
        contraindications = self._check_contraindications(med_lower, cond_lower)

        total = len(interactions) + len(allergy_conflicts) + len(duplicates) + len(contraindications)
        has_critical = any(
            item.get("severity") == "critical"
            for group in [interactions, allergy_conflicts, duplicates, contraindications]
            for item in group
        )

        logger.info(
            "Medication safety check: %d meds, %d issues (%s)",
            len(medications), total, "UNSAFE" if has_critical else "OK",
        )

        return {
            "safe": total == 0,
            "interactions": interactions,
            "allergyConflicts": allergy_conflicts,
            "duplicates": duplicates,
            "contraindications": contraindications,
            "totalIssues": total,
        }

    def _check_interactions(self, meds: List[str]) -> List[Dict[str, str]]:
        """Check for drug-drug interactions."""
        issues: List[Dict[str, str]] = []
        for rule in DRUG_INTERACTIONS:
            a_found = any(rule["a"] in m for m in meds)
            b_found = any(rule["b"] in m for m in meds)
            if a_found and b_found:
                issues.append({
                    "type": "drug_interaction",
                    "severity": rule["severity"],
                    "drugA": rule["a"],
                    "drugB": rule["b"],
                    "detail": rule["detail"],
                })
        return issues

    def _check_allergy_conflicts(
        self, meds: List[str], allergies: List[str]
    ) -> List[Dict[str, str]]:
        """Check if any medication conflicts with known allergies."""
        issues: List[Dict[str, str]] = []
        for med in meds:
            for drug_name, allergens in DRUG_ALLERGY_MAP.items():
                if drug_name in med:
                    for allergen in allergens:
                        if any(allergen in a for a in allergies):
                            issues.append({
                                "type": "allergy_conflict",
                                "severity": "critical",
                                "drug": med,
                                "allergen": allergen,
                                "detail": f"Patient is allergic to '{allergen}' — '{med}' is contraindicated.",
                            })
                            break  # One conflict per drug is enough
        return issues

    def _check_duplicates(self, meds: List[str]) -> List[Dict[str, str]]:
        """Check for duplicate therapy (multiple drugs from the same class)."""
        issues: List[Dict[str, str]] = []
        for class_name, class_drugs in THERAPY_CLASSES.items():
            found_in_class = [
                med for med in meds
                if any(drug in med for drug in class_drugs)
            ]
            if len(found_in_class) >= 2:
                issues.append({
                    "type": "duplicate_therapy",
                    "severity": "warning",
                    "drugClass": class_name,
                    "drugs": ", ".join(found_in_class),
                    "detail": f"Duplicate {class_name} therapy: {', '.join(found_in_class)}. Review for necessity.",
                })
        return issues

    def _check_contraindications(
        self, meds: List[str], conditions: List[str]
    ) -> List[Dict[str, str]]:
        """Check if any medications are contraindicated with active conditions."""
        issues: List[Dict[str, str]] = []
        for rule in CONDITION_CONTRAINDICATIONS:
            drug_found = any(rule["drug"] in m for m in meds)
            cond_found = any(rule["condition"] in c for c in conditions)
            if drug_found and cond_found:
                issues.append({
                    "type": "contraindication",
                    "severity": rule["severity"],
                    "drug": rule["drug"],
                    "condition": rule["condition"],
                    "detail": rule["detail"],
                })
        return issues
