"""
MediCore AI Service — Vitals Service
Detects anomalies in patient vital signs.
"""


class VitalsService:
    """Analyzes patient vitals for anomalies against baselines."""

    async def analyze(self, recent_vitals: list[dict], baseline: dict) -> list[dict]:
        """
        Compare recent vitals to baseline and flag anomalies.
        Stub — will implement anomaly detection in Day 7+.
        """
        return []
