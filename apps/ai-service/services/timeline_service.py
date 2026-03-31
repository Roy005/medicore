"""
MediCore AI Service — Patient Timeline Service (Day 15)
Aggregates all patient health events into a single chronological timeline:
  - Vitals readings
  - Emergency flags
  - Alerts generated
  - Goals created/updated/completed
  - Conversation entries
  - Risk score changes
  - Medication safety checks
"""

import logging
from datetime import datetime, timezone
from typing import Any, Dict, List

from services.conversation_service import ConversationHistoryService  # type: ignore
from services.emergency_service import EmergencyService  # type: ignore
from services.goals_service import HealthGoalsService  # type: ignore
from services.alerts_service import PatientAlertsService  # type: ignore
from services.risk_service import RiskService  # type: ignore
from services.vitals_service import VitalsService  # type: ignore

logger = logging.getLogger("medicore-ai.timeline")


# ── Event type icons ─────────────────────────────────────────────────────────
EVENT_ICONS: Dict[str, str] = {
    "vital_sign": "📊",
    "emergency": "🚨",
    "alert": "🔔",
    "goal_created": "🎯",
    "goal_updated": "📈",
    "goal_completed": "✅",
    "conversation": "💬",
    "risk_assessment": "⚠️",
    "medication_check": "💊",
}


class TimelineService:
    """Generates a chronological timeline of all patient health events."""

    def __init__(
        self,
        conversation_service: ConversationHistoryService,
        goals_service: HealthGoalsService,
        alerts_service: PatientAlertsService,
    ) -> None:
        self._conversations = conversation_service
        self._goals = goals_service
        self._alerts = alerts_service
        self._emergency = EmergencyService()
        self._risk = RiskService()
        self._vitals = VitalsService()

    async def generate_timeline(
        self,
        patient_id: str,
        patient_context: Dict[str, Any],
        limit: int = 50,
    ) -> Dict[str, Any]:
        """
        Generate a chronological timeline for a patient.

        Returns:
            {
                "patientId": str,
                "events": [ { type, icon, title, description, severity, timestamp } ],
                "totalEvents": int,
                "categories": { category: count },
                "generatedAt": str
            }
        """
        events: List[Dict[str, Any]] = []

        # 1. Collect vitals events
        events.extend(self._collect_vitals_events(patient_context))

        # 2. Collect emergency flag events
        emergency_events = await self._collect_emergency_events(patient_context)
        events.extend(emergency_events)

        # 3. Collect alert events
        events.extend(self._collect_alert_events(patient_id))

        # 4. Collect goal events
        events.extend(self._collect_goal_events(patient_id))

        # 5. Collect conversation events
        events.extend(self._collect_conversation_events(patient_id))

        # 6. Generate risk assessment event
        risk_events = await self._collect_risk_events(patient_context)
        events.extend(risk_events)

        # Sort all events by timestamp (newest first)
        events.sort(key=lambda e: e.get("timestamp", ""), reverse=True)

        # Apply limit
        limited_events = list(events[:limit])

        # Calculate category counts
        categories: Dict[str, int] = {}
        for event in events:
            cat = event.get("type", "unknown")
            categories[cat] = categories.get(cat, 0) + 1

        logger.info(
            "Timeline for %s: %d events (%d shown)",
            patient_id, len(events), len(limited_events),
        )

        return {
            "patientId": patient_id,
            "events": limited_events,
            "totalEvents": len(events),
            "shownEvents": len(limited_events),
            "categories": categories,
            "generatedAt": datetime.now(timezone.utc).isoformat(),
        }

    def _collect_vitals_events(
        self, patient_context: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """Convert recent vitals to timeline events."""
        events: List[Dict[str, Any]] = []
        recent_vitals = patient_context.get("recentVitals", {})
        now = datetime.now(timezone.utc).isoformat()

        if isinstance(recent_vitals, dict):
            for metric, data in recent_vitals.items():
                if not isinstance(data, dict):
                    continue
                latest = data.get("latest")
                if latest is None:
                    continue

                events.append({
                    "type": "vital_sign",
                    "icon": EVENT_ICONS["vital_sign"],
                    "title": f"Vital Recorded: {metric.replace('_', ' ').title()}",
                    "description": f"Latest reading: {latest}",
                    "severity": "info",
                    "timestamp": now,
                    "metadata": {"metric": metric, "value": latest},
                })

        return events

    async def _collect_emergency_events(
        self, patient_context: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """Evaluate and convert emergency flags to timeline events."""
        events: List[Dict[str, Any]] = []
        flags = await self._emergency.evaluate(patient_context)
        now = datetime.now(timezone.utc).isoformat()

        for flag in flags:
            events.append({
                "type": "emergency",
                "icon": EVENT_ICONS["emergency"],
                "title": f"Emergency Flag: {flag.get('type', 'Unknown')}",
                "description": flag.get("message", "Emergency condition detected."),
                "severity": flag.get("severity", "critical"),
                "timestamp": now,
            })

        return events

    def _collect_alert_events(self, patient_id: str) -> List[Dict[str, Any]]:
        """Convert stored alerts to timeline events."""
        events: List[Dict[str, Any]] = []
        alerts = self._alerts.get_alerts(patient_id)

        for alert in alerts:
            events.append({
                "type": "alert",
                "icon": EVENT_ICONS["alert"],
                "title": alert.get("title", "Alert"),
                "description": alert.get("message", ""),
                "severity": alert.get("severity", "info"),
                "status": alert.get("status", "active"),
                "timestamp": alert.get("createdAt", ""),
            })

        return events

    def _collect_goal_events(self, patient_id: str) -> List[Dict[str, Any]]:
        """Convert health goals to timeline events."""
        events: List[Dict[str, Any]] = []
        goals = self._goals.get_goals(patient_id)

        for goal in goals:
            status = goal.get("status", "active")
            if status == "completed":
                event_type = "goal_completed"
                title = f"Goal Completed: {goal.get('title', 'Goal')}"
                severity = "info"
            else:
                event_type = "goal_created"
                title = f"Goal Set: {goal.get('title', 'Goal')}"
                severity = "info"

            progress = goal.get("progress", 0)
            events.append({
                "type": event_type,
                "icon": EVENT_ICONS.get(event_type, "🎯"),
                "title": title,
                "description": (
                    f"Target: {goal.get('targetValue', '?')} {goal.get('unit', '')} — "
                    f"Progress: {progress}%"
                ),
                "severity": severity,
                "timestamp": goal.get("createdAt", ""),
            })

        return events

    def _collect_conversation_events(self, patient_id: str) -> List[Dict[str, Any]]:
        """Convert conversation history to timeline events."""
        events: List[Dict[str, Any]] = []
        entries = self._conversations.get_history(patient_id, limit=10)

        for entry in entries:
            msg = entry.get("message", "")
            reply_preview = entry.get("reply", "")[:100]
            safety = entry.get("safetyFlag", False)

            events.append({
                "type": "conversation",
                "icon": EVENT_ICONS["conversation"],
                "title": f"Advisor Chat: {msg[:60]}{'...' if len(msg) > 60 else ''}",
                "description": f"AI Response: {reply_preview}{'...' if len(reply_preview) >= 100 else ''}",
                "severity": "warning" if safety else "info",
                "timestamp": entry.get("timestamp", ""),
                "metadata": {"safetyFlag": safety},
            })

        return events

    async def _collect_risk_events(
        self, patient_context: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """Generate risk assessment events."""
        events: List[Dict[str, Any]] = []
        now = datetime.now(timezone.utc).isoformat()

        cv = await self._risk.compute_cardiovascular_risk(patient_context)
        events.append({
            "type": "risk_assessment",
            "icon": EVENT_ICONS["risk_assessment"],
            "title": f"CV Risk Assessment: {cv['level'].title()}",
            "description": f"Score: {cv['score']}/100. Factors: {', '.join(cv['topFactors'][:3])}.",
            "severity": "warning" if cv["level"] in ("high", "critical") else "info",
            "timestamp": now,
        })

        t2d = await self._risk.compute_diabetes_risk(patient_context)
        events.append({
            "type": "risk_assessment",
            "icon": EVENT_ICONS["risk_assessment"],
            "title": f"Diabetes Risk Assessment: {t2d['level'].title()}",
            "description": f"Score: {t2d['score']}/100. Factors: {', '.join(t2d['topFactors'][:3])}.",
            "severity": "warning" if t2d["level"] in ("high", "critical") else "info",
            "timestamp": now,
        })

        return events
