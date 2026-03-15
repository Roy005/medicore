"""
MediCore AI Service — Patient Context Service
Fetches and assembles patient data from the database for AI consumption.
"""


class PatientContextService:
    """Assembles patient context for AI endpoints."""

    async def get_patient_context(self, patient_id: str, db) -> dict:
        """
        Retrieve patient demographics, medical history, and recent vitals.
        Stub — will query real tables in Day 3+.
        """
        return {
            "patientId": patient_id,
            "demographics": {},
            "medicalHistory": [],
            "recentVitals": [],
        }
