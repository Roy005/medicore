"""
MediCore AI Service — Health Trends Analysis Service (Day 11)
Analyzes patient vitals history to detect patterns, trends, and generate insights.
"""

import logging
from datetime import datetime, timezone
from typing import Any, Dict, List

logger = logging.getLogger("medicore-ai.trends")


class TrendsService:
    """Analyzes patient health data over time and generates trend reports."""

    def analyze_trends(self, patient_context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Analyze patient vitals history and generate trend insights.

        Returns:
            {
                "patientId": str,
                "metrics": { metric_name: { trend, latestValue, averageValue, ... } },
                "insights": [ { severity, message } ],
                "analyzedAt": str
            }
        """
        patient_id = patient_context.get("patientId", "unknown")
        recent_vitals = patient_context.get("recentVitals", {})
        vitals_history = patient_context.get("vitalsHistory", [])
        conditions = [
            c.lower() if isinstance(c, str) else c.get("name", "").lower()
            for c in patient_context.get("activeConditions", [])
        ]

        metrics: Dict[str, Dict[str, Any]] = {}
        insights: List[Dict[str, str]] = []

        # ── Analyze recent vitals (aggregated stats) ─────────────────────────
        if isinstance(recent_vitals, dict):
            for metric, data in recent_vitals.items():
                if not isinstance(data, dict):
                    continue

                metric_info: Dict[str, Any] = {
                    "metric": metric,
                    "latestValue": data.get("latest"),
                    "avg7d": data.get("avg7d"),
                    "avg30d": data.get("avg30d"),
                    "trend": data.get("trend", "stable"),
                }

                # Calculate change percentage
                avg7d = data.get("avg7d")
                avg30d = data.get("avg30d")
                if (
                    isinstance(avg7d, (int, float))
                    and isinstance(avg30d, (int, float))
                    and avg30d > 0
                ):
                    change_pct = float(round(((avg7d - avg30d) / avg30d) * 100, 1))
                    metric_info["changePercent"] = change_pct

                    if abs(change_pct) >= 10:
                        direction = "increasing" if change_pct > 0 else "decreasing"
                        severity = "warning" if abs(change_pct) >= 20 else "info"
                        insights.append({
                            "severity": severity,
                            "message": (
                                f"{metric.replace('_', ' ').title()} has been {direction} "
                                f"({change_pct:+.1f}% over the past 30 days). "
                                f"7-day avg: {avg7d}, 30-day avg: {avg30d}."
                            ),
                        })

                metrics[metric] = metric_info

        # ── Analyze vitals history for patterns ──────────────────────────────
        if vitals_history:
            history_by_metric = self._group_history(vitals_history)

            for metric, values in history_by_metric.items():
                if len(values) < 2:
                    continue

                # Calculate simple trend direction from history
                trend_dir = self._calculate_trend(values)
                if metric not in metrics:
                    metrics[metric] = {"metric": metric}
                metrics[metric]["historyPoints"] = len(values)
                metrics[metric]["historyTrend"] = trend_dir

                # Detect volatility (high variance)
                if len(values) >= 3:
                    volatility = self._calculate_volatility(values)
                    metrics[metric]["volatility"] = volatility
                    if volatility > 0.15:
                        insights.append({
                            "severity": "warning",
                            "message": (
                                f"{metric.replace('_', ' ').title()} shows high variability "
                                f"(coefficient of variation: {volatility:.0%}). "
                                f"This inconsistency may warrant investigation."
                            ),
                        })

        # ── Generate condition-specific insights ─────────────────────────────
        condition_insights = self._condition_specific_insights(
            conditions, metrics, recent_vitals
        )
        insights.extend(condition_insights)

        # Sort insights: warnings first, then info
        severity_order = {"critical": 0, "warning": 1, "info": 2}
        insights.sort(key=lambda i: severity_order.get(i.get("severity", ""), 3))

        logger.info(
            "Trends analysis for %s: %d metrics, %d insights",
            patient_id, len(metrics), len(insights),
        )

        return {
            "patientId": patient_id,
            "metrics": metrics,
            "insights": insights,
            "totalMetrics": len(metrics),
            "totalInsights": len(insights),
            "analyzedAt": datetime.now(timezone.utc).isoformat(),
        }

    def _group_history(
        self, vitals_history: List[Dict[str, Any]]
    ) -> Dict[str, List[float]]:
        """Group vitals history by metric name, returning lists of values."""
        grouped: Dict[str, List[float]] = {}
        for entry in vitals_history:
            metric = entry.get("metric", "")
            value = entry.get("value")
            if isinstance(value, (int, float)) and metric:
                if metric not in grouped:
                    grouped[metric] = []
                grouped[metric].append(float(value))
        return grouped

    def _calculate_trend(self, values: List[float]) -> str:
        """Determine trend direction from a list of values (newest first)."""
        if len(values) < 2:
            return "stable"

        half = len(values) // 2
        first_half = list(values[:half])
        second_half = list(values[half:])
        first_half_avg = sum(first_half) / len(first_half) if first_half else 0.0
        second_half_avg = sum(second_half) / len(second_half) if second_half else 0.0

        if second_half_avg == 0:
            return "stable"

        change = (first_half_avg - second_half_avg) / second_half_avg
        if change > 0.05:
            return "increasing"
        elif change < -0.05:
            return "decreasing"
        return "stable"

    def _calculate_volatility(self, values: List[float]) -> float:
        """Calculate coefficient of variation (std/mean) as a volatility measure."""
        if not values:
            return 0.0
        mean = sum(values) / len(values)
        if mean == 0:
            return 0.0
        variance = sum((v - mean) ** 2 for v in values) / len(values)
        std = variance ** 0.5
        return std / abs(mean)

    def _condition_specific_insights(
        self,
        conditions: List[str],
        metrics: Dict[str, Dict[str, Any]],
        recent_vitals: Any,
    ) -> List[Dict[str, str]]:
        """Generate insights specific to the patient's conditions."""
        insights: List[Dict[str, str]] = []

        # Diabetes-specific: glucose trend
        if any("diabetes" in c for c in conditions):
            for key in ["glucose", "blood_sugar", "bloodSugar"]:
                metric_data = metrics.get(key, {})
                trend = metric_data.get("trend") or metric_data.get("historyTrend")
                if trend == "increasing" or trend == "up":
                    insights.append({
                        "severity": "warning",
                        "message": (
                            "Blood glucose is trending upward in a patient with diabetes. "
                            "Consider reviewing medication adherence and dietary habits."
                        ),
                    })
                    break

        # Hypertension-specific: BP monitoring
        if any("hypertension" in c for c in conditions):
            if isinstance(recent_vitals, dict):
                bp_data = recent_vitals.get("blood_pressure") or recent_vitals.get("bloodPressure")
                if isinstance(bp_data, dict):
                    trend = bp_data.get("trend", "stable")
                    if trend in ("up", "increasing"):
                        insights.append({
                            "severity": "warning",
                            "message": (
                                "Blood pressure is trending upward in a hypertensive patient. "
                                "May need medication adjustment review."
                            ),
                        })

        return insights
