"""
MediCore AI Service — Patient Alerts Service (Day 14)
Manages patient health alerts:
  - Auto-generated alerts from vitals, risks, and emergency flags
  - Alert severity levels: critical / warning / info
  - Alert acknowledgement and resolution tracking
  - Alert history with timestamps
"""

import logging
from collections import defaultdict
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from uuid import uuid4

from services.emergency_service import EmergencyService  # type: ignore
from services.vitals_service import VitalsService  # type: ignore
from services.risk_service import RiskService  # type: ignore

logger = logging.getLogger("medicore-ai.alerts")


# ── Alert categories ─────────────────────────────────────────────────────────
ALERT_CATEGORIES = {
    "vital_sign": "Vital Sign Alert",
    "risk_score": "Risk Score Alert",
    "emergency": "Emergency Alert",
    "medication": "Medication Alert",
    "goal": "Goal Progress Alert",
    "appointment": "Appointment Reminder",
    "custom": "Custom Alert",
}


class PatientAlertsService:
    """Manages patient health alerts with auto-generation and tracking."""

    def __init__(self) -> None:
        self._alerts: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
        self._emergency_service = EmergencyService()
        self._vitals_service = VitalsService()
        self._risk_service = RiskService()

    async def generate_alerts(
        self, patient_id: str, patient_context: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """
        Auto-generate alerts based on patient context.
        Checks vitals, risk scores, and emergency conditions.
        """
        new_alerts: List[Dict[str, Any]] = []

        # 1. Emergency flags → critical alerts
        emergency_flags = await self._emergency_service.evaluate(patient_context)
        for flag in emergency_flags:
            severity = flag.get("severity", "warning")
            if severity == "critical":
                alert = self._create_alert(
                    patient_id=patient_id,
                    category="emergency",
                    severity="critical",
                    title=f"Emergency: {flag.get('type', 'Unknown')}",
                    message=flag.get("message", "Emergency condition detected."),
                    source="emergency_service",
                )
                new_alerts.append(alert)

        # 2. Vitals anomalies → warning/critical alerts
        recent_vitals = patient_context.get("recentVitals", {})
        vitals_list: List[Dict[str, Any]] = []
        if isinstance(recent_vitals, dict):
            for metric, data in recent_vitals.items():
                if isinstance(data, dict) and "latest" in data:
                    val = data["latest"]
                    if isinstance(val, (int, float)):
                        vitals_list.append({"metric": metric, "value": val})

        if vitals_list:
            baseline = patient_context.get("patientBaseline", {})
            anomalies = await self._vitals_service.analyze(vitals_list, baseline)
            for anomaly in anomalies:
                alert = self._create_alert(
                    patient_id=patient_id,
                    category="vital_sign",
                    severity=anomaly.get("severity", "warning"),
                    title=f"Vital Sign: {anomaly.get('metric', 'unknown')}",
                    message=anomaly.get("message", "Vital sign anomaly detected."),
                    source="vitals_service",
                    metadata={"metric": anomaly.get("metric"), "value": anomaly.get("value")},
                )
                new_alerts.append(alert)

        # 3. High risk scores → info/warning alerts
        cv_risk = await self._risk_service.compute_cardiovascular_risk(patient_context)
        if cv_risk["level"] in ("high", "critical"):
            alert = self._create_alert(
                patient_id=patient_id,
                category="risk_score",
                severity="warning" if cv_risk["level"] == "high" else "critical",
                title="Elevated Cardiovascular Risk",
                message=(
                    f"Cardiovascular risk score: {cv_risk['score']}/100 ({cv_risk['level']}). "
                    f"Top factors: {', '.join(cv_risk['topFactors'][:3])}."
                ),
                source="risk_service",
            )
            new_alerts.append(alert)

        t2d_risk = await self._risk_service.compute_diabetes_risk(patient_context)
        if t2d_risk["level"] in ("high", "critical"):
            alert = self._create_alert(
                patient_id=patient_id,
                category="risk_score",
                severity="warning" if t2d_risk["level"] == "high" else "critical",
                title="Elevated Diabetes Risk",
                message=(
                    f"Diabetes risk score: {t2d_risk['score']}/100 ({t2d_risk['level']}). "
                    f"Top factors: {', '.join(t2d_risk['topFactors'][:3])}."
                ),
                source="risk_service",
            )
            new_alerts.append(alert)

        # Store all new alerts
        self._alerts[patient_id].extend(new_alerts)

        logger.info(
            "Generated %d alerts for %s", len(new_alerts), patient_id,
        )

        return new_alerts

    def get_alerts(
        self,
        patient_id: str,
        status: Optional[str] = None,
        severity: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """Get alerts for a patient, optionally filtered by status or severity."""
        alerts = self._alerts.get(patient_id, [])

        if status:
            alerts = [a for a in alerts if a["status"] == status]
        if severity:
            alerts = [a for a in alerts if a["severity"] == severity]

        # Sort: critical first, then by timestamp (newest first)
        severity_order = {"critical": 0, "warning": 1, "info": 2}
        alerts.sort(key=lambda a: (
            severity_order.get(a.get("severity", "info"), 3),
            a.get("createdAt", ""),
        ))

        return alerts

    def acknowledge_alert(
        self, patient_id: str, alert_id: str
    ) -> Optional[Dict[str, Any]]:
        """Mark an alert as acknowledged."""
        for alert in self._alerts.get(patient_id, []):
            if alert["alertId"] == alert_id:
                alert["status"] = "acknowledged"
                alert["acknowledgedAt"] = datetime.now(timezone.utc).isoformat()
                logger.info("Alert %s acknowledged for %s", alert_id, patient_id)
                return alert
        return None

    def dismiss_alert(
        self, patient_id: str, alert_id: str
    ) -> Optional[Dict[str, Any]]:
        """Dismiss (resolve) an alert."""
        for alert in self._alerts.get(patient_id, []):
            if alert["alertId"] == alert_id:
                alert["status"] = "dismissed"
                alert["dismissedAt"] = datetime.now(timezone.utc).isoformat()
                logger.info("Alert %s dismissed for %s", alert_id, patient_id)
                return alert
        return None

    def get_summary(self, patient_id: str) -> Dict[str, Any]:
        """Get alert summary for a patient."""
        all_alerts = self._alerts.get(patient_id, [])
        active = [a for a in all_alerts if a["status"] == "active"]
        acknowledged = [a for a in all_alerts if a["status"] == "acknowledged"]
        dismissed = [a for a in all_alerts if a["status"] == "dismissed"]

        return {
            "patientId": patient_id,
            "totalAlerts": len(all_alerts),
            "activeAlerts": len(active),
            "acknowledgedAlerts": len(acknowledged),
            "dismissedAlerts": len(dismissed),
            "criticalCount": sum(1 for a in active if a["severity"] == "critical"),
            "warningCount": sum(1 for a in active if a["severity"] == "warning"),
            "infoCount": sum(1 for a in active if a["severity"] == "info"),
        }

    def _create_alert(
        self,
        patient_id: str,
        category: str,
        severity: str,
        title: str,
        message: str,
        source: str,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Create a new alert object."""
        return {
            "alertId": str(uuid4())[:8],
            "patientId": patient_id,
            "category": category,
            "categoryLabel": ALERT_CATEGORIES.get(category, "Custom Alert"),
            "severity": severity,
            "title": title,
            "message": message,
            "source": source,
            "status": "active",
            "metadata": metadata or {},
            "createdAt": datetime.now(timezone.utc).isoformat(),
        }
