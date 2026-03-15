"""
MediCore AI Service — Risk Service
Computes cardiovascular and diabetes risk scores.
"""


class RiskService:
    """Calculates patient risk scores using clinical algorithms."""

    async def compute_cardiovascular_risk(self, patient_context: dict) -> dict:
        """
        Compute cardiovascular risk score.
        Stub — will implement scoring algorithm in Day 5+.
        """
        return {"score": 0.0, "level": "low", "topFactors": []}

    async def compute_diabetes_risk(self, patient_context: dict) -> dict:
        """
        Compute diabetes risk score.
        Stub — will implement scoring algorithm in Day 5+.
        """
        return {"score": 0.0, "level": "low", "topFactors": []}
