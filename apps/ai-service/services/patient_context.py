"""
MediCore AI Service — Patient Context Service
Fetches and assembles patient data from the database for AI consumption.
"""

from datetime import datetime, timezone
from collections import defaultdict
from typing import Any, Dict, List, Optional
import asyncpg # type: ignore


class PatientContextService:
    """Assembles patient context for AI endpoints with a 5-minute memory cache."""

    def __init__(self):
        # Cache structure: { "patient_id": { "data": dict, "expires_at": float } }
        self._cache: Dict[str, Dict[str, Any]] = {}
        self.CACHE_TTL_SECONDS = 300

    def _get_from_cache(self, patient_id: str) -> dict | None:
        """Return cached context if valid."""
        now = datetime.now(timezone.utc).timestamp()
        if patient_id in self._cache:
            entry = self._cache[patient_id]
            if now < entry.get("expires_at", 0):
                return entry.get("data")
            else:
                self._cache.pop(patient_id, None)
        return None

    def _save_to_cache(self, patient_id: str, data: dict):
        """Save context to memory cache for 5 minutes."""
        now = datetime.now(timezone.utc).timestamp()
        self._cache[patient_id] = {
            "data": data,
            "expires_at": now + self.CACHE_TTL_SECONDS,
        }

    async def get_patient_context(self, patient_id: str, db: asyncpg.Pool | None) -> dict:
        """
        Retrieve patient demographics, medical history, and recent vitals.
        Returns cached data if available and fresh (< 5 mins).
        """
        cached = self._get_from_cache(patient_id)
        if cached:
            return cached

        # MOCK FALLBACK: If DB is unavailable (i.e. local dev without docker-compose up)
        if db is None:
            data = self._get_mock_context(patient_id)
            self._save_to_cache(patient_id, data)
            return data

        # ── Database Strategy ─────────────────────────────────────────────────
        # In a real NestJS/Prisma DB, table names might be exactly as specified:
        # patient_profiles, users, medications, allergies, diagnoses, vitals, alerts.
        # We use standard SQL syntax that matches the workplan requirements.

        async with db.acquire() as conn:
            # 1. Demographics
            demo_query = """
                SELECT p.blood_group, p.demographics->>'gender' as gender, p.date_of_birth,
                       EXTRACT(YEAR FROM age(CURRENT_DATE, p.date_of_birth)) AS age
                FROM patient_profiles p
                WHERE p.id = $1
            """
            demo_record = await conn.fetchrow(demo_query, patient_id)
            demographics = {}
            if demo_record:
                demographics = {
                    "bloodGroup": demo_record["blood_group"],
                    "gender": demo_record["gender"],
                    "age": int(demo_record["age"]) if demo_record["age"] else None
                }

            # 2. Active Medications
            meds_query = """
                SELECT drug_name AS name, dosage AS dose, frequency, rxnorm_code, start_date AS prescribed_at
                FROM medications
                WHERE patient_id = $1 AND is_active = true
            """
            med_records = await conn.fetch(meds_query, patient_id)
            meds = [
                {
                    "name": r["name"],
                    "dose": r["dose"],
                    "frequency": r["frequency"],
                    "rxnormCode": r["rxnorm_code"],
                    "prescribedAt": r["prescribed_at"].isoformat() if r["prescribed_at"] else None
                }
                for r in med_records
            ]

            # 3. Allergies
            allergies_query = """
                SELECT allergen, severity, reaction_description AS reaction_type
                FROM allergies
                WHERE patient_id = $1
            """
            allergy_records = await conn.fetch(allergies_query, patient_id)
            allergies = [dict(r) for r in allergy_records]

            # 4. Active Conditions (Diagnoses)
            conditions_query = """
                SELECT icd10_description AS name, icd10_code AS icd10, diagnosis_date AS since
                FROM diagnoses
                WHERE patient_id = $1 AND status = 'active'
            """
            cond_records = await conn.fetch(conditions_query, patient_id)
            conditions = [
                {
                    "name": r["name"],
                    "icd10": r["icd10"],
                    "since": r["since"].isoformat() if r["since"] else None
                }
                for r in cond_records
            ]

            # 5. Vitals (Recent stats + History)
            # Use window functions to get the last 30 readings per metric, and the latest.
            vitals_query = """
                WITH ranked_vitals AS (
                    SELECT metric_type, value, recorded_at,
                           ROW_NUMBER() OVER(PARTITION BY metric_type ORDER BY recorded_at DESC) as rn
                    FROM vitals
                    WHERE patient_id = $1
                )
                SELECT metric_type, value, recorded_at
                FROM ranked_vitals
                WHERE rn <= 30
                ORDER BY metric_type, recorded_at DESC
            """
            vitals_records = await conn.fetch(vitals_query, patient_id)
            
            # Group into history and calculate simple aggregates in Python for speed
            vitals_history: List[Dict[str, Any]] = []
            recent_vitals: Dict[str, Dict[str, Any]] = defaultdict(lambda: {"latest": None, "avg7d": None, "avg30d": None, "trend": "stable", "_values": []})
            
            for r in vitals_records:
                metric = r["metric_type"]
                val = float(r["value"])
                vitals_history.append({"metric": metric, "value": val, "timestamp": r["recorded_at"].isoformat()})
                
                rv = recent_vitals[metric]
                _vals = rv.setdefault("_values", [])
                if isinstance(_vals, list):
                    _vals.append(val)
                if rv.get("latest") is None:
                    rv["latest"] = val  # type: ignore
            
            # Simple Python-side averaging and trend (since we only have max 30 per metric)
            for rv in recent_vitals.values():
                vals_any = rv.pop("_values", [])
                vals: List[float] = vals_any if isinstance(vals_any, list) else []
                if len(vals) > 0:
                    avg_val: float = sum(vals) / len(vals)
                    rv["avg30d"] = round(avg_val, 1) # type: ignore
                    
                    # rough 7d average (assume first 7 are recent)
                    recent_7: List[float] = vals[:7] # type: ignore
                    recent_avg: float = sum(recent_7) / len(recent_7)
                    rv["avg7d"] = round(recent_avg, 1) # type: ignore
                    
                    if len(vals) >= 2:
                        half_idx = len(vals) // 2
                        first_half: List[float] = vals[:half_idx] # type: ignore
                        second_half: List[float] = vals[half_idx:] # type: ignore
                        
                        fh_avg = sum(first_half) / len(first_half) if first_half else 0
                        sh_avg = sum(second_half) / len(second_half) if second_half else 0
                        
                        if fh_avg > sh_avg * 1.05:
                            rv["trend"] = "up"
                        elif fh_avg < sh_avg * 0.95:
                            rv["trend"] = "down"

            # 6. Recent Alerts
            alerts_query = """
                SELECT tier, message, created_at
                FROM alerts
                WHERE patient_id = $1
                  AND status != 'resolved'
                ORDER BY created_at DESC
                LIMIT 5
            """
            alert_records = await conn.fetch(alerts_query, patient_id)
            alerts = [
                {
                    "tier": r["tier"],
                    "message": r["message"],
                    "createdAt": r["created_at"].isoformat()
                }
                for r in alert_records
            ]

        # Assemble final dictionary
        full_context = {
            "patientId": patient_id,
            "demographics": demographics,
            "activeMedications": meds,
            "allergies": allergies,
            "activeConditions": conditions,
            "recentVitals": dict(recent_vitals),
            "vitalsHistory": vitals_history,
            "recentAlerts": alerts,
            "familyHistory": {},  # Placeholder
            "lastUpdated": datetime.now(timezone.utc).isoformat()
        }

        self._save_to_cache(patient_id, full_context)
        return full_context

    def _get_mock_context(self, patient_id: str) -> dict:
        """Fallback mock data when the DB pool is None (local dev without Docker)."""
        return {
            "patientId": patient_id,
            "demographics": {"bloodGroup": "O+", "gender": "Female", "age": 42},
            "activeMedications": [
                {"name": "Metformin", "dose": "500mg", "frequency": "twice daily", "rxnormCode": "860975", "prescribedAt": "2025-01-10T00:00:00Z"}
            ],
            "allergies": [{"allergen": "Penicillin", "severity": "high", "reactionType": "anaphylaxis"}],
            "activeConditions": [{"name": "Type 2 Diabetes", "icd10": "E11.9", "since": "2024-06-15T00:00:00Z"}],
            "recentVitals": {
                "glucose": {"latest": 109, "avg7d": 105, "avg30d": 98, "trend": "up"},
                "spo2": {"latest": 98, "avg7d": 98, "avg30d": 99, "trend": "stable"}
            },
            "vitalsHistory": [
                {"metric": "glucose", "value": 109, "timestamp": datetime.now(timezone.utc).isoformat()},
                {"metric": "glucose", "value": 102, "timestamp": "2026-03-10T08:00:00Z"},
                {"metric": "glucose", "value": 88, "timestamp": "2026-03-01T08:00:00Z"}
            ],
            "recentAlerts": [],
            "familyHistory": {},
            "lastUpdated": datetime.now(timezone.utc).isoformat()
        }
