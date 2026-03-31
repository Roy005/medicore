"""
MediCore AI Service — Conversation History Service (Day 9)
Manages per-patient conversation histories in memory for multi-turn advisor chats.
Provides retrieval, pagination, and automatic pruning.
"""

import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from collections import defaultdict

logger = logging.getLogger("medicore-ai.conversation")

# Maximum conversations kept per patient
MAX_HISTORY_PER_PATIENT = 50


class ConversationEntry:
    """A single conversation turn (user message + AI reply)."""

    __slots__ = ("message", "reply", "safety_flag", "timestamp")

    def __init__(
        self, message: str, reply: str, safety_flag: bool, timestamp: str
    ) -> None:
        self.message = message
        self.reply = reply
        self.safety_flag = safety_flag
        self.timestamp = timestamp

    def to_dict(self) -> Dict[str, Any]:
        return {
            "message": self.message,
            "reply": self.reply,
            "safetyFlag": self.safety_flag,
            "timestamp": self.timestamp,
        }


class ConversationHistoryService:
    """In-memory conversation manager with per-patient history and auto-pruning."""

    def __init__(self) -> None:
        # { patient_id: [ConversationEntry, ...] }
        self._history: Dict[str, List[ConversationEntry]] = defaultdict(list)

    def add_entry(
        self,
        patient_id: str,
        message: str,
        reply: str,
        safety_flag: bool,
    ) -> None:
        """Add a conversation turn to the patient's history."""
        entry = ConversationEntry(
            message=message,
            reply=reply,
            safety_flag=safety_flag,
            timestamp=datetime.now(timezone.utc).isoformat(),
        )
        self._history[patient_id].append(entry)

        # Auto-prune: keep only the most recent
        if len(self._history[patient_id]) > MAX_HISTORY_PER_PATIENT:
            entries = self._history[patient_id]
            self._history[patient_id] = list(entries[-MAX_HISTORY_PER_PATIENT:])

        logger.info(
            "Conversation logged for patient %s (total: %d)",
            patient_id, len(self._history[patient_id]),
        )

    def get_history(
        self,
        patient_id: str,
        limit: int = 10,
        offset: int = 0,
    ) -> List[Dict[str, Any]]:
        """Get conversation history for a patient (newest first)."""
        all_entries = self._history.get(patient_id, [])
        # Return newest first
        reversed_entries = list(reversed(all_entries))
        page = list(reversed_entries[offset: offset + limit])
        return [e.to_dict() for e in page]

    def get_recent_messages_for_context(
        self,
        patient_id: str,
        max_turns: int = 5,
    ) -> List[Dict[str, str]]:
        """
        Get recent conversation turns formatted for LLM context injection.
        Returns alternating user/assistant messages.
        """
        all_entries = self._history.get(patient_id, [])
        recent = list(all_entries[-max_turns:]) if len(all_entries) > max_turns else list(all_entries)
        messages: List[Dict[str, str]] = []
        for e in recent:
            messages.append({"role": "user", "content": e.message})
            messages.append({"role": "assistant", "content": e.reply})
        return messages

    def get_stats(self) -> Dict[str, Any]:
        """Return overall conversation statistics."""
        total_patients = len(self._history)
        total_conversations = sum(len(v) for v in self._history.values())
        safety_triggers = sum(
            1 for entries in self._history.values()
            for e in entries if e.safety_flag
        )
        return {
            "totalPatients": total_patients,
            "totalConversations": total_conversations,
            "safetyTriggers": safety_triggers,
        }

    def clear_patient(self, patient_id: str) -> int:
        """Clear all conversation history for a patient. Returns count deleted."""
        count = len(self._history.get(patient_id, []))
        self._history.pop(patient_id, None)
        return count
