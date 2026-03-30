"""
MediCore AI Service — Health Goals Tracker Service (Day 14)
Allows patients to set, track, and monitor health goals:
  - Weight targets
  - Blood pressure targets
  - Glucose / HbA1c targets
  - Exercise frequency
  - Custom goals
With progress tracking against current vitals.
"""

import logging
from collections import defaultdict
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from uuid import uuid4

logger = logging.getLogger("medicore-ai.goals")


# ── Predefined goal templates ────────────────────────────────────────────────
GOAL_TEMPLATES: Dict[str, Dict[str, Any]] = {
    "weight_loss": {
        "category": "weight",
        "title": "Weight Loss Goal",
        "metric": "weight",
        "unit": "kg",
        "direction": "decrease",
        "advice": "Focus on a calorie deficit of 500 kcal/day for sustainable weight loss (~0.5 kg/week).",
    },
    "blood_pressure": {
        "category": "cardiovascular",
        "title": "Blood Pressure Control",
        "metric": "blood_pressure_systolic",
        "unit": "mmHg",
        "direction": "decrease",
        "advice": "Follow a DASH diet, reduce sodium, exercise regularly, and take medications as prescribed.",
    },
    "glucose_control": {
        "category": "diabetes",
        "title": "Blood Glucose Control",
        "metric": "glucose",
        "unit": "mg/dL",
        "direction": "decrease",
        "advice": "Monitor carbohydrate intake, exercise after meals, and maintain medication schedule.",
    },
    "hba1c_target": {
        "category": "diabetes",
        "title": "HbA1c Target",
        "metric": "hba1c",
        "unit": "%",
        "direction": "decrease",
        "advice": "HbA1c below 7% reduces complication risk. Consistent daily glucose management is key.",
    },
    "exercise_frequency": {
        "category": "lifestyle",
        "title": "Exercise Frequency",
        "metric": "exercise_sessions",
        "unit": "sessions/week",
        "direction": "increase",
        "advice": "Aim for at least 150 minutes of moderate aerobic activity per week (5 × 30 min).",
    },
    "cholesterol_reduction": {
        "category": "cardiovascular",
        "title": "Cholesterol Reduction",
        "metric": "total_cholesterol",
        "unit": "mg/dL",
        "direction": "decrease",
        "advice": "Increase fiber intake, reduce saturated fats, and consider statin therapy if prescribed.",
    },
    "heart_rate_target": {
        "category": "cardiovascular",
        "title": "Resting Heart Rate",
        "metric": "heart_rate",
        "unit": "bpm",
        "direction": "decrease",
        "advice": "Regular cardio exercise lowers resting heart rate. Aim for 60-80 bpm range.",
    },
    "sleep_quality": {
        "category": "lifestyle",
        "title": "Sleep Improvement",
        "metric": "sleep_hours",
        "unit": "hours/night",
        "direction": "increase",
        "advice": "Maintain a consistent sleep schedule, avoid screens before bed, and aim for 7-9 hours.",
    },
}


class HealthGoalsService:
    """In-memory health goals tracker with progress calculation."""

    def __init__(self) -> None:
        # patient_id → list of goals
        self._goals: Dict[str, List[Dict[str, Any]]] = defaultdict(list)

    def create_goal(
        self,
        patient_id: str,
        goal_type: str,
        target_value: float,
        current_value: Optional[float] = None,
        deadline: Optional[str] = None,
        notes: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Create a new health goal for a patient.

        Args:
            patient_id: Patient identifier
            goal_type: One of the predefined goal templates or 'custom'
            target_value: The target value to achieve
            current_value: Optional starting value
            deadline: Optional target date (ISO format)
            notes: Optional notes

        Returns:
            The created goal object with ID and metadata.
        """
        template = GOAL_TEMPLATES.get(goal_type, {})

        goal: Dict[str, Any] = {
            "goalId": str(uuid4())[:8],
            "patientId": patient_id,
            "goalType": goal_type,
            "category": template.get("category", "custom"),
            "title": template.get("title", f"Custom Goal: {goal_type}"),
            "metric": template.get("metric", goal_type),
            "unit": template.get("unit", ""),
            "direction": template.get("direction", "decrease"),
            "targetValue": target_value,
            "currentValue": current_value,
            "startValue": current_value,
            "deadline": deadline,
            "notes": notes or "",
            "advice": template.get("advice", "Work with your healthcare provider to achieve this goal."),
            "status": "active",
            "progress": 0.0,
            "createdAt": datetime.now(timezone.utc).isoformat(),
            "updatedAt": datetime.now(timezone.utc).isoformat(),
        }

        # Calculate initial progress if start value provided
        if current_value is not None:
            goal["progress"] = self._calculate_progress(
                current_value, target_value, current_value,
                template.get("direction", "decrease"),
            )

        self._goals[patient_id].append(goal)

        logger.info(
            "Goal created for %s: %s → target %s %s",
            patient_id, goal["title"], target_value, goal["unit"],
        )

        return goal

    def get_goals(
        self,
        patient_id: str,
        status: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """Get all goals for a patient, optionally filtered by status."""
        all_goals = self._goals.get(patient_id, [])
        if status:
            return [g for g in all_goals if g["status"] == status]
        return list(all_goals)

    def update_progress(
        self,
        patient_id: str,
        goal_id: str,
        current_value: float,
    ) -> Optional[Dict[str, Any]]:
        """Update a goal's current value and recalculate progress."""
        for goal in self._goals.get(patient_id, []):
            if goal["goalId"] == goal_id:
                start = goal.get("startValue") or goal.get("currentValue") or current_value
                goal["currentValue"] = current_value
                goal["updatedAt"] = datetime.now(timezone.utc).isoformat()
                goal["progress"] = self._calculate_progress(
                    current_value, goal["targetValue"], start, goal["direction"],
                )

                # Auto-complete if target met
                if goal["progress"] >= 100.0:
                    goal["status"] = "completed"
                    goal["progress"] = 100.0

                logger.info(
                    "Goal %s updated: current=%s, progress=%.1f%%",
                    goal_id, current_value, goal["progress"],
                )
                return goal
        return None

    def update_goal_from_vitals(
        self,
        patient_id: str,
        patient_context: Dict[str, Any],
    ) -> List[Dict[str, Any]]:
        """
        Auto-update goal progress from patient vitals.
        Matches goal metrics to recent vitals data.
        """
        updated: List[Dict[str, Any]] = []
        recent_vitals = patient_context.get("recentVitals", {})

        for goal in self._goals.get(patient_id, []):
            if goal["status"] != "active":
                continue

            metric = goal.get("metric", "")
            vitals_data = None

            # Try to match metric to vitals
            if isinstance(recent_vitals, dict):
                vitals_data = recent_vitals.get(metric, {})

            if isinstance(vitals_data, dict) and "latest" in vitals_data:
                latest = vitals_data["latest"]
                if isinstance(latest, (int, float)):
                    result = self.update_progress(patient_id, goal["goalId"], float(latest))
                    if result:
                        updated.append(result)

        return updated

    def get_summary(self, patient_id: str) -> Dict[str, Any]:
        """Get a summary of all goals for a patient."""
        all_goals = self._goals.get(patient_id, [])
        active = [g for g in all_goals if g["status"] == "active"]
        completed = [g for g in all_goals if g["status"] == "completed"]

        avg_progress = 0.0
        if active:
            avg_progress = sum(g["progress"] for g in active) / len(active)

        return {
            "patientId": patient_id,
            "totalGoals": len(all_goals),
            "activeGoals": len(active),
            "completedGoals": len(completed),
            "averageProgress": float(round(avg_progress, 1)),
            "goals": all_goals,
            "availableTemplates": list(GOAL_TEMPLATES.keys()),
        }

    def _calculate_progress(
        self,
        current: float,
        target: float,
        start: float,
        direction: str,
    ) -> float:
        """
        Calculate progress percentage toward a goal.
        Handles both 'increase' and 'decrease' directions.
        """
        if start == target:
            return 100.0 if current == target else 0.0

        if direction == "decrease":
            # Lower is better (e.g., weight loss, BP reduction)
            if start <= target:
                return 100.0 if current <= target else 0.0
            progress = ((start - current) / (start - target)) * 100
        else:
            # Higher is better (e.g., exercise frequency, sleep hours)
            if start >= target:
                return 100.0 if current >= target else 0.0
            progress = ((current - start) / (target - start)) * 100

        return float(round(min(100.0, max(0.0, progress)), 1))

    def get_templates(self) -> Dict[str, Dict[str, Any]]:
        """Return all available goal templates."""
        return dict(GOAL_TEMPLATES)
