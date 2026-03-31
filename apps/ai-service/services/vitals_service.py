"""
MediCore AI Service — Vitals Anomaly Detection (Day 6)
Detects anomalies in patient vital signs using personalized thresholds
and trend-based analysis.

Each metric has a DEFAULT clinical range that is adjusted based on the
patient's baseline (personal average). Anomalies are classified as
warning or critical severity.
"""

import logging
from typing import Any, Dict, List, Optional

logger = logging.getLogger("medicore-ai.vitals")


# ── Default Clinical Thresholds ──────────────────────────────────────────────
# Each metric: (low_critical, low_warning, high_warning, high_critical, unit)

DEFAULT_THRESHOLDS: Dict[str, Dict[str, Any]] = {
    "heart_rate": {
        "low_critical": 40, "low_warning": 50,
        "high_warning": 100, "high_critical": 120,
        "unit": "bpm",
    },
    "heartRate": {
        "low_critical": 40, "low_warning": 50,
        "high_warning": 100, "high_critical": 120,
        "unit": "bpm",
    },
    "systolic_bp": {
        "low_critical": 80, "low_warning": 90,
        "high_warning": 140, "high_critical": 180,
        "unit": "mmHg",
    },
    "diastolic_bp": {
        "low_critical": 50, "low_warning": 60,
        "high_warning": 90, "high_critical": 120,
        "unit": "mmHg",
    },
    "blood_sugar": {
        "low_critical": 54, "low_warning": 70,
        "high_warning": 180, "high_critical": 250,
        "unit": "mg/dL",
    },
    "bloodSugar": {
        "low_critical": 54, "low_warning": 70,
        "high_warning": 180, "high_critical": 250,
        "unit": "mg/dL",
    },
    "temperature": {
        "low_critical": 35.0, "low_warning": 36.1,
        "high_warning": 37.8, "high_critical": 39.4,
        "unit": "°C",
    },
    "spo2": {
        "low_critical": 90, "low_warning": 94,
        "high_warning": 100.1, "high_critical": 100.1,
        "unit": "%",
    },
    "oxygen_saturation": {
        "low_critical": 90, "low_warning": 94,
        "high_warning": 100.1, "high_critical": 100.1,
        "unit": "%",
    },
    "respiratory_rate": {
        "low_critical": 8, "low_warning": 12,
        "high_warning": 20, "high_critical": 30,
        "unit": "breaths/min",
    },
}


class VitalsService:
    """Analyzes patient vitals for anomalies using personalized thresholds."""

    def _get_thresholds(
        self, metric: str, baseline: Dict[str, Any]
    ) -> Optional[Dict[str, Any]]:
        """
        Get thresholds for a metric. If the patient has a personal baseline
        for this metric, adjust thresholds by ±10% around their personal average.
        """
        metric_lower = metric.lower().replace(" ", "_")

        # Try exact match first, then lowercase match
        thresholds = DEFAULT_THRESHOLDS.get(metric)
        if not thresholds:
            thresholds = DEFAULT_THRESHOLDS.get(metric_lower)
        if not thresholds:
            # Try partial match
            for key, val in DEFAULT_THRESHOLDS.items():
                if key in metric_lower or metric_lower in key:
                    thresholds = val
                    break

        if not thresholds:
            return None

        # Make a copy so we don't mutate the defaults
        adjusted = dict(thresholds)

        # Adjust based on patient baseline if available
        patient_baseline = baseline.get(metric) or baseline.get(metric_lower)
        if isinstance(patient_baseline, (int, float)) and patient_baseline > 0:
            # Personalize: shift thresholds toward patient's baseline ± 10%
            margin = patient_baseline * 0.10
            adjusted["low_warning"] = min(adjusted["low_warning"], patient_baseline - margin)
            adjusted["high_warning"] = max(adjusted["high_warning"], patient_baseline + margin)

        return adjusted

    def _check_single_vital(
        self,
        metric: str,
        value: float,
        thresholds: Dict[str, Any],
    ) -> Optional[Dict[str, Any]]:
        """
        Check a single vital reading against thresholds.
        Returns an anomaly dict or None.
        """
        unit = thresholds.get("unit", "")

        # Critical LOW
        if value <= thresholds["low_critical"]:
            return {
                "metric": metric,
                "value": value,
                "threshold": thresholds["low_critical"],
                "severity": "critical",
                "message": f"CRITICAL: {metric} is dangerously low at {value} {unit} (threshold: ≥{thresholds['low_critical']} {unit})",
            }

        # Warning LOW
        if value <= thresholds["low_warning"]:
            return {
                "metric": metric,
                "value": value,
                "threshold": thresholds["low_warning"],
                "severity": "warning",
                "message": f"WARNING: {metric} is below normal at {value} {unit} (expected: ≥{thresholds['low_warning']} {unit})",
            }

        # Critical HIGH
        if value >= thresholds["high_critical"]:
            return {
                "metric": metric,
                "value": value,
                "threshold": thresholds["high_critical"],
                "severity": "critical",
                "message": f"CRITICAL: {metric} is dangerously high at {value} {unit} (threshold: ≤{thresholds['high_critical']} {unit})",
            }

        # Warning HIGH
        if value >= thresholds["high_warning"]:
            return {
                "metric": metric,
                "value": value,
                "threshold": thresholds["high_warning"],
                "severity": "warning",
                "message": f"WARNING: {metric} is above normal at {value} {unit} (expected: ≤{thresholds['high_warning']} {unit})",
            }

        return None

    def _parse_blood_pressure(
        self, vitals: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """
        If a vital has metric 'blood_pressure' with value like '140/90',
        split it into separate systolic and diastolic entries.
        """
        expanded: List[Dict[str, Any]] = []
        for v in vitals:
            metric = v.get("metric", "")
            val = v.get("value")

            if "blood_pressure" in metric.lower() or "bp" == metric.lower():
                # Try to parse "140/90" format
                if isinstance(val, str) and "/" in val:
                    try:
                        parts = val.split("/")
                        expanded.append({
                            "metric": "systolic_bp",
                            "value": float(parts[0]),
                            "timestamp": v.get("timestamp"),
                        })
                        expanded.append({
                            "metric": "diastolic_bp",
                            "value": float(parts[1]),
                            "timestamp": v.get("timestamp"),
                        })
                        continue
                    except (ValueError, IndexError):
                        pass

            # Convert value to float if possible
            if isinstance(val, (int, float)):
                expanded.append(v)
            elif isinstance(val, str):
                try:
                    expanded.append({**v, "value": float(val)})
                except ValueError:
                    pass

        return expanded

    async def analyze(
        self,
        recent_vitals: List[Dict[str, Any]],
        baseline: Dict[str, Any],
    ) -> List[Dict[str, Any]]:
        """
        Compare recent vitals to personalized thresholds and flag anomalies.

        Args:
            recent_vitals: List of {metric, value, timestamp?} records
            baseline: Patient's personal average values {metric: avg_value}

        Returns:
            List of anomaly dicts with metric, value, threshold, severity, message
        """
        anomalies: List[Dict[str, Any]] = []

        # Parse blood pressure strings into systolic/diastolic
        expanded_vitals = self._parse_blood_pressure(recent_vitals)

        for vital in expanded_vitals:
            metric = vital.get("metric", "")
            value = vital.get("value")

            if not isinstance(value, (int, float)):
                continue

            # Get personalized thresholds
            thresholds = self._get_thresholds(metric, baseline)
            if not thresholds:
                logger.debug("No thresholds defined for metric '%s', skipping", metric)
                continue

            # Check against thresholds
            anomaly = self._check_single_vital(metric, float(value), thresholds)
            if anomaly:
                anomalies.append(anomaly)

        # Sort: critical first, then warning
        severity_order = {"critical": 0, "warning": 1}
        anomalies.sort(key=lambda a: severity_order.get(a.get("severity", ""), 2))

        logger.info(
            "Vitals analysis complete: %d readings → %d anomalies",
            len(expanded_vitals), len(anomalies),
        )
        return anomalies
