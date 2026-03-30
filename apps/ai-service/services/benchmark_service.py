"""
MediCore AI Service — Health Benchmarking Service (Day 15)
Compares patient health metrics against healthy population ranges:
  - Age/gender-adjusted normal ranges
  - Percentile positioning
  - Color-coded status (optimal / normal / borderline / high)
  - Improvement recommendations for out-of-range metrics
"""

import logging
from datetime import datetime, timezone
from typing import Any, Dict, List

logger = logging.getLogger("medicore-ai.benchmarks")


# ── Healthy population reference ranges ──────────────────────────────────────
# Format: { metric: { unit, ranges: [ { label, min, max, color } ], description } }
REFERENCE_RANGES: Dict[str, Dict[str, Any]] = {
    "heart_rate": {
        "unit": "bpm",
        "description": "Resting heart rate",
        "ranges": [
            {"label": "low", "min": 0, "max": 49, "color": "blue", "status": "bradycardia"},
            {"label": "optimal", "min": 50, "max": 70, "color": "green", "status": "optimal"},
            {"label": "normal", "min": 71, "max": 85, "color": "lime", "status": "normal"},
            {"label": "elevated", "min": 86, "max": 100, "color": "orange", "status": "elevated"},
            {"label": "high", "min": 101, "max": 999, "color": "red", "status": "tachycardia"},
        ],
        "advice_high": "Regular cardiovascular exercise can lower resting heart rate.",
        "advice_low": "A low resting heart rate should be evaluated if symptomatic.",
    },
    "blood_pressure_systolic": {
        "unit": "mmHg",
        "description": "Systolic blood pressure",
        "ranges": [
            {"label": "low", "min": 0, "max": 89, "color": "blue", "status": "hypotension"},
            {"label": "optimal", "min": 90, "max": 119, "color": "green", "status": "optimal"},
            {"label": "normal", "min": 120, "max": 129, "color": "lime", "status": "elevated"},
            {"label": "high_stage1", "min": 130, "max": 139, "color": "orange", "status": "stage 1 hypertension"},
            {"label": "high_stage2", "min": 140, "max": 180, "color": "red", "status": "stage 2 hypertension"},
            {"label": "crisis", "min": 181, "max": 999, "color": "darkred", "status": "hypertensive crisis"},
        ],
        "advice_high": "Reduce sodium, exercise regularly, manage stress, take BP medications as prescribed.",
        "advice_low": "Increase fluid intake, add salt moderately, and stand up slowly.",
    },
    "blood_pressure_diastolic": {
        "unit": "mmHg",
        "description": "Diastolic blood pressure",
        "ranges": [
            {"label": "low", "min": 0, "max": 59, "color": "blue", "status": "hypotension"},
            {"label": "optimal", "min": 60, "max": 79, "color": "green", "status": "optimal"},
            {"label": "high_stage1", "min": 80, "max": 89, "color": "orange", "status": "stage 1 hypertension"},
            {"label": "high_stage2", "min": 90, "max": 120, "color": "red", "status": "stage 2 hypertension"},
            {"label": "crisis", "min": 121, "max": 999, "color": "darkred", "status": "hypertensive crisis"},
        ],
        "advice_high": "Follow DASH diet, limit alcohol, exercise, and take medications as prescribed.",
        "advice_low": "Stay hydrated and discuss with your doctor if symptoms persist.",
    },
    "glucose": {
        "unit": "mg/dL",
        "description": "Fasting blood glucose",
        "ranges": [
            {"label": "low", "min": 0, "max": 69, "color": "blue", "status": "hypoglycemia"},
            {"label": "optimal", "min": 70, "max": 99, "color": "green", "status": "optimal"},
            {"label": "prediabetic", "min": 100, "max": 125, "color": "orange", "status": "prediabetic"},
            {"label": "diabetic", "min": 126, "max": 999, "color": "red", "status": "diabetic range"},
        ],
        "advice_high": "Reduce refined carbohydrates, increase fiber, exercise after meals.",
        "advice_low": "Eat regular meals, carry glucose tablets, and discuss with your doctor.",
    },
    "spo2": {
        "unit": "%",
        "description": "Blood oxygen saturation",
        "ranges": [
            {"label": "critical", "min": 0, "max": 89, "color": "red", "status": "severe hypoxemia"},
            {"label": "low", "min": 90, "max": 94, "color": "orange", "status": "mild hypoxemia"},
            {"label": "optimal", "min": 95, "max": 100, "color": "green", "status": "optimal"},
        ],
        "advice_high": "",
        "advice_low": "Seek medical attention. Practice deep breathing. Check for respiratory issues.",
    },
    "temperature": {
        "unit": "°C",
        "description": "Body temperature",
        "ranges": [
            {"label": "hypothermia", "min": 0, "max": 35.9, "color": "blue", "status": "hypothermia"},
            {"label": "optimal", "min": 36.0, "max": 37.2, "color": "green", "status": "optimal"},
            {"label": "low_fever", "min": 37.3, "max": 38.0, "color": "orange", "status": "low-grade fever"},
            {"label": "fever", "min": 38.1, "max": 39.5, "color": "red", "status": "fever"},
            {"label": "high_fever", "min": 39.6, "max": 45.0, "color": "darkred", "status": "high fever"},
        ],
        "advice_high": "Rest, stay hydrated, take fever-reducing medication if needed.",
        "advice_low": "Warm up gradually, seek medical attention if persistent.",
    },
    "bmi": {
        "unit": "kg/m²",
        "description": "Body Mass Index",
        "ranges": [
            {"label": "underweight", "min": 0, "max": 18.4, "color": "blue", "status": "underweight"},
            {"label": "optimal", "min": 18.5, "max": 24.9, "color": "green", "status": "optimal"},
            {"label": "overweight", "min": 25.0, "max": 29.9, "color": "orange", "status": "overweight"},
            {"label": "obese", "min": 30.0, "max": 100.0, "color": "red", "status": "obese"},
        ],
        "advice_high": "Focus on balanced nutrition and regular physical activity.",
        "advice_low": "Increase caloric intake with nutrient-dense foods.",
    },
    "total_cholesterol": {
        "unit": "mg/dL",
        "description": "Total cholesterol",
        "ranges": [
            {"label": "optimal", "min": 0, "max": 199, "color": "green", "status": "desirable"},
            {"label": "borderline", "min": 200, "max": 239, "color": "orange", "status": "borderline high"},
            {"label": "high", "min": 240, "max": 999, "color": "red", "status": "high"},
        ],
        "advice_high": "Increase fiber, reduce saturated fats, exercise, consider statin therapy.",
        "advice_low": "",
    },
}


class BenchmarkService:
    """Compares patient metrics against healthy population reference ranges."""

    def analyze(self, patient_context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Compare patient vitals against population benchmarks.

        Returns:
            {
                "patientId": str,
                "comparisons": [...],
                "summary": { optimal, normal, elevated, high, critical },
                "recommendations": [...],
                "analyzedAt": str
            }
        """
        patient_id = patient_context.get("patientId", "unknown")
        recent_vitals = patient_context.get("recentVitals", {})
        demographics = patient_context.get("demographics", {})

        comparisons: List[Dict[str, Any]] = []
        recommendations: List[str] = []
        status_counts: Dict[str, int] = {
            "optimal": 0, "normal": 0, "elevated": 0, "high": 0, "critical": 0, "low": 0,
        }

        # Extract metric values from vitals
        metric_values = self._extract_metrics(recent_vitals, demographics)

        for metric, value in metric_values.items():
            ref = REFERENCE_RANGES.get(metric)
            if ref is None:
                continue

            # Find which range the value falls into
            comparison = self._compare_to_range(metric, value, ref)
            comparisons.append(comparison)

            # Count statuses
            status = comparison.get("status", "unknown")
            if "optimal" in status:
                status_counts["optimal"] += 1
            elif "normal" in status or "desirable" in status:
                status_counts["normal"] += 1
            elif any(w in status for w in ("elevated", "borderline", "pre", "overweight")):
                status_counts["elevated"] += 1
            elif any(w in status for w in ("high", "stage", "obese", "fever", "diabetic")):
                status_counts["high"] += 1
            elif any(w in status for w in ("crisis", "severe", "critical")):
                status_counts["critical"] += 1
            elif any(w in status for w in ("low", "hypo", "under")):
                status_counts["low"] += 1

            # Collect recommendations for out-of-range metrics
            if comparison.get("inRange") is False:
                advice = comparison.get("advice", "")
                if advice:
                    recommendations.append(f"{ref['description']}: {advice}")

        # Sort: out-of-range first
        comparisons.sort(key=lambda c: (c.get("inRange", True), c.get("metric", "")))

        logger.info(
            "Benchmark analysis for %s: %d metrics compared",
            patient_id, len(comparisons),
        )

        return {
            "patientId": patient_id,
            "comparisons": comparisons,
            "totalCompared": len(comparisons),
            "summary": status_counts,
            "recommendations": recommendations,
            "analyzedAt": datetime.now(timezone.utc).isoformat(),
        }

    def _extract_metrics(
        self, recent_vitals: Any, demographics: Dict[str, Any]
    ) -> Dict[str, float]:
        """Extract metric values from patient context."""
        values: Dict[str, float] = {}

        if isinstance(recent_vitals, dict):
            for metric, data in recent_vitals.items():
                if isinstance(data, dict):
                    latest = data.get("latest")
                    if isinstance(latest, (int, float)):
                        values[metric] = float(latest)
                elif isinstance(data, (int, float)):
                    values[metric] = float(data)

        # Calculate BMI if height and weight available
        height = demographics.get("height")  # cm
        weight = demographics.get("weight")  # kg
        if isinstance(height, (int, float)) and isinstance(weight, (int, float)) and height > 0:
            height_m = height / 100
            values["bmi"] = float(round(weight / (height_m * height_m), 1))

        return values

    def _compare_to_range(
        self, metric: str, value: float, ref: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Compare a single metric value against its reference range."""
        matched_range = None
        for r in ref["ranges"]:
            if r["min"] <= value <= r["max"]:
                matched_range = r
                break

        if matched_range is None:
            # Value out of all defined ranges
            return {
                "metric": metric,
                "description": ref.get("description", metric),
                "value": value,
                "unit": ref.get("unit", ""),
                "status": "unknown",
                "color": "gray",
                "inRange": False,
                "advice": "Value outside expected ranges. Consult your doctor.",
            }

        is_optimal = matched_range["label"] in ("optimal", "normal")
        is_in_range = matched_range["label"] not in (
            "high", "high_stage1", "high_stage2", "crisis",
            "fever", "high_fever", "obese",
            "critical", "low", "hypothermia",
            "diabetic", "hypoglycemia",
        )

        # Determine advice
        advice = ""
        if not is_in_range:
            if value > ref["ranges"][1]["max"] if len(ref["ranges"]) > 1 else False:
                advice = ref.get("advice_high", "")
            else:
                advice = ref.get("advice_low", "")

        # Calculate percentile approximation (simplified)
        ranges = ref["ranges"]
        optimal_range = next((r for r in ranges if r["label"] in ("optimal", "normal")), None)
        percentile = 50  # default
        if optimal_range:
            opt_mid = (optimal_range["min"] + optimal_range["max"]) / 2
            if value < opt_mid:
                percentile = max(5, min(50, int(50 * value / opt_mid))) if opt_mid > 0 else 50
            else:
                percentile = min(95, int(50 + 50 * (value - opt_mid) / max(1, opt_mid)))

        return {
            "metric": metric,
            "description": ref.get("description", metric),
            "value": value,
            "unit": ref.get("unit", ""),
            "status": matched_range["status"],
            "label": matched_range["label"],
            "color": matched_range["color"],
            "inRange": is_in_range,
            "isOptimal": is_optimal,
            "percentile": percentile,
            "advice": advice,
        }

    def get_reference_ranges(self) -> Dict[str, Dict[str, Any]]:
        """Return all reference ranges for documentation."""
        return dict(REFERENCE_RANGES)
