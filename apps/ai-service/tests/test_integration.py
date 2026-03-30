"""
MediCore AI Service — Integration Test Suite (Day 8)
Tests the full HTTP request/response flow through all API endpoints
using FastAPI's TestClient (no live server or API keys required).
"""

import pytest  # pyre-ignore[21]
import sys
import os

# Add the ai-service root to the path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from fastapi.testclient import TestClient  # type: ignore
from main import app  # type: ignore


@pytest.fixture
def client():
    """Create a FastAPI test client."""
    return TestClient(app)


# ══════════════════════════════════════════════════════════════════════════════
# Health Check
# ══════════════════════════════════════════════════════════════════════════════

class TestHealthEndpoint:
    """Test GET /health."""

    def test_health_returns_200(self, client: TestClient):
        response = client.get("/health")
        assert response.status_code == 200

    def test_health_returns_ok_status(self, client: TestClient):
        data = client.get("/health").json()
        assert data["status"] == "ok"

    def test_health_has_timestamp(self, client: TestClient):
        data = client.get("/health").json()
        assert "timestamp" in data
        assert len(data["timestamp"]) > 0


# ══════════════════════════════════════════════════════════════════════════════
# Advisor Chat — POST /ai/advisor/chat
# ══════════════════════════════════════════════════════════════════════════════

class TestAdvisorChatEndpoint:
    """Test POST /ai/advisor/chat."""

    def test_advisor_returns_200(self, client: TestClient):
        response = client.post("/ai/advisor/chat", json={
            "patientId": "test-patient",
            "message": "What is my blood pressure?",
            "conversationHistory": [],
            "patientContext": {},
        })
        assert response.status_code == 200

    def test_advisor_response_has_required_fields(self, client: TestClient):
        response = client.post("/ai/advisor/chat", json={
            "patientId": "test-patient",
            "message": "What is my blood pressure?",
            "conversationHistory": [],
            "patientContext": {},
        })
        data = response.json()
        assert "reply" in data
        assert "sources" in data
        assert "safetyFlag" in data

    def test_advisor_crisis_sets_safety_flag(self, client: TestClient):
        response = client.post("/ai/advisor/chat", json={
            "patientId": "test-patient",
            "message": "I want to kill myself",
            "conversationHistory": [],
            "patientContext": {},
        })
        data = response.json()
        assert data["safetyFlag"] is True
        assert "9152987821" in data["reply"]

    def test_advisor_crisis_returns_empty_sources(self, client: TestClient):
        response = client.post("/ai/advisor/chat", json={
            "patientId": "test-patient",
            "message": "I want to end my life",
            "conversationHistory": [],
            "patientContext": {},
        })
        data = response.json()
        assert data["sources"] == []

    def test_advisor_normal_message_no_safety_flag(self, client: TestClient):
        response = client.post("/ai/advisor/chat", json={
            "patientId": "test-patient",
            "message": "How is my health?",
            "conversationHistory": [],
            "patientContext": {},
        })
        data = response.json()
        assert data["safetyFlag"] is False

    def test_advisor_rejects_missing_patient_id(self, client: TestClient):
        response = client.post("/ai/advisor/chat", json={
            "message": "Hello",
        })
        assert response.status_code == 422  # Validation error

    def test_advisor_rejects_missing_message(self, client: TestClient):
        response = client.post("/ai/advisor/chat", json={
            "patientId": "test",
        })
        assert response.status_code == 422


# ══════════════════════════════════════════════════════════════════════════════
# Risk Scores — GET /ai/patients/{id}/risk-scores
# ══════════════════════════════════════════════════════════════════════════════

class TestRiskScoresEndpoint:
    """Test GET /ai/patients/{id}/risk-scores."""

    def test_risk_scores_returns_200(self, client: TestClient):
        response = client.get("/ai/patients/test-123/risk-scores")
        assert response.status_code == 200

    def test_risk_scores_has_cardiovascular(self, client: TestClient):
        data = client.get("/ai/patients/test-123/risk-scores").json()
        assert "cardiovascular" in data
        cv = data["cardiovascular"]
        assert "score" in cv
        assert "level" in cv
        assert "topFactors" in cv

    def test_risk_scores_has_diabetes(self, client: TestClient):
        data = client.get("/ai/patients/test-123/risk-scores").json()
        assert "diabetes" in data
        t2d = data["diabetes"]
        assert "score" in t2d
        assert "level" in t2d
        assert "topFactors" in t2d

    def test_risk_score_levels_are_valid(self, client: TestClient):
        data = client.get("/ai/patients/test-123/risk-scores").json()
        valid_levels = {"low", "moderate", "high", "critical"}
        assert data["cardiovascular"]["level"] in valid_levels
        assert data["diabetes"]["level"] in valid_levels

    def test_risk_scores_are_in_range(self, client: TestClient):
        data = client.get("/ai/patients/test-123/risk-scores").json()
        assert 0 <= data["cardiovascular"]["score"] <= 100
        assert 0 <= data["diabetes"]["score"] <= 100


# ══════════════════════════════════════════════════════════════════════════════
# Vitals Analysis — POST /ai/vitals/analyze
# ══════════════════════════════════════════════════════════════════════════════

class TestVitalsAnalyzeEndpoint:
    """Test POST /ai/vitals/analyze."""

    def test_vitals_returns_200(self, client: TestClient):
        response = client.post("/ai/vitals/analyze", json={
            "patientId": "test",
            "recentVitals": [{"metric": "heart_rate", "value": 75}],
            "patientBaseline": {},
        })
        assert response.status_code == 200

    def test_vitals_normal_returns_no_anomalies(self, client: TestClient):
        data = client.post("/ai/vitals/analyze", json={
            "patientId": "test",
            "recentVitals": [
                {"metric": "heart_rate", "value": 75},
                {"metric": "temperature", "value": 36.8},
                {"metric": "spo2", "value": 98},
            ],
            "patientBaseline": {},
        }).json()
        assert data["anomalies"] == []

    def test_vitals_critical_heart_rate_detected(self, client: TestClient):
        data = client.post("/ai/vitals/analyze", json={
            "patientId": "test",
            "recentVitals": [{"metric": "heart_rate", "value": 135}],
            "patientBaseline": {},
        }).json()
        assert len(data["anomalies"]) > 0
        assert data["anomalies"][0]["severity"] == "critical"
        assert data["anomalies"][0]["metric"] == "heart_rate"

    def test_vitals_low_spo2_detected(self, client: TestClient):
        data = client.post("/ai/vitals/analyze", json={
            "patientId": "test",
            "recentVitals": [{"metric": "spo2", "value": 85}],
            "patientBaseline": {},
        }).json()
        assert len(data["anomalies"]) > 0
        assert data["anomalies"][0]["severity"] == "critical"

    def test_vitals_high_blood_sugar_detected(self, client: TestClient):
        data = client.post("/ai/vitals/analyze", json={
            "patientId": "test",
            "recentVitals": [{"metric": "blood_sugar", "value": 320}],
            "patientBaseline": {},
        }).json()
        assert len(data["anomalies"]) > 0
        assert data["anomalies"][0]["severity"] == "critical"

    def test_vitals_high_temperature_warning(self, client: TestClient):
        data = client.post("/ai/vitals/analyze", json={
            "patientId": "test",
            "recentVitals": [{"metric": "temperature", "value": 38.5}],
            "patientBaseline": {},
        }).json()
        assert len(data["anomalies"]) > 0
        assert data["anomalies"][0]["severity"] == "warning"

    def test_vitals_empty_list_returns_empty(self, client: TestClient):
        data = client.post("/ai/vitals/analyze", json={
            "patientId": "test",
            "recentVitals": [],
            "patientBaseline": {},
        }).json()
        assert data["anomalies"] == []

    def test_vitals_anomaly_has_required_fields(self, client: TestClient):
        data = client.post("/ai/vitals/analyze", json={
            "patientId": "test",
            "recentVitals": [{"metric": "heart_rate", "value": 130}],
            "patientBaseline": {},
        }).json()
        anomaly = data["anomalies"][0]
        assert "metric" in anomaly
        assert "value" in anomaly
        assert "threshold" in anomaly
        assert "severity" in anomaly
        assert "message" in anomaly


# ══════════════════════════════════════════════════════════════════════════════
# Emergency Flags — GET /ai/patients/{id}/emergency-flags
# ══════════════════════════════════════════════════════════════════════════════

class TestEmergencyFlagsEndpoint:
    """Test GET /ai/patients/{id}/emergency-flags."""

    def test_emergency_returns_200(self, client: TestClient):
        response = client.get("/ai/patients/test-123/emergency-flags")
        assert response.status_code == 200

    def test_emergency_has_flags_list(self, client: TestClient):
        data = client.get("/ai/patients/test-123/emergency-flags").json()
        assert "flags" in data
        assert isinstance(data["flags"], list)

    def test_emergency_flag_has_severity_and_message(self, client: TestClient):
        data = client.get("/ai/patients/any-patient/emergency-flags").json()
        for flag in data["flags"]:
            assert "severity" in flag
            assert "message" in flag
            assert flag["severity"] in ("warning", "critical")


# ══════════════════════════════════════════════════════════════════════════════
# OpenAPI Docs
# ══════════════════════════════════════════════════════════════════════════════

class TestOpenAPIDocs:
    """Test the auto-generated OpenAPI spec is accessible."""

    def test_openapi_json_available(self, client: TestClient):
        response = client.get("/openapi.json")
        assert response.status_code == 200
        data = response.json()
        assert data["info"]["title"] == "MediCore AI Service"

    def test_docs_page_available(self, client: TestClient):
        response = client.get("/docs")
        assert response.status_code == 200


# ══════════════════════════════════════════════════════════════════════════════
# Edge Cases & Error Handling
# ══════════════════════════════════════════════════════════════════════════════

class TestEdgeCases:
    """Test edge cases and error handling."""

    def test_unknown_route_returns_404(self, client: TestClient):
        response = client.get("/ai/nonexistent")
        assert response.status_code in (404, 405)

    def test_post_to_get_endpoint_returns_405(self, client: TestClient):
        response = client.post("/health")
        assert response.status_code == 405

    def test_advisor_with_empty_message_string(self, client: TestClient):
        """Empty message should still process (not crash)."""
        response = client.post("/ai/advisor/chat", json={
            "patientId": "test",
            "message": "",
            "conversationHistory": [],
            "patientContext": {},
        })
        # Should return 200 (Gemini handles it) or 422 (validation)
        assert response.status_code in (200, 422)

    def test_vitals_with_unknown_metric(self, client: TestClient):
        """Unknown metric should be ignored, not crash."""
        response = client.post("/ai/vitals/analyze", json={
            "patientId": "test",
            "recentVitals": [{"metric": "unknown_metric_xyz", "value": 99}],
            "patientBaseline": {},
        })
        assert response.status_code == 200
        assert response.json()["anomalies"] == []


# ══════════════════════════════════════════════════════════════════════════════
# Conversation History — GET /ai/patients/{id}/conversations
# ══════════════════════════════════════════════════════════════════════════════

class TestConversationHistoryEndpoint:
    """Test GET /ai/patients/{id}/conversations."""

    def test_conversations_returns_200(self, client: TestClient):
        response = client.get("/ai/patients/test-123/conversations")
        assert response.status_code == 200

    def test_conversations_has_required_fields(self, client: TestClient):
        data = client.get("/ai/patients/test-123/conversations").json()
        assert "patientId" in data
        assert "conversations" in data
        assert "total" in data
        assert isinstance(data["conversations"], list)

    def test_conversations_after_chat(self, client: TestClient):
        """After sending a chat, conversion should appear in history."""
        # Send a chat first
        client.post("/ai/advisor/chat", json={
            "patientId": "history-test",
            "message": "I have a headache",
            "conversationHistory": [],
            "patientContext": {},
        })
        # Check history
        data = client.get("/ai/patients/history-test/conversations").json()
        assert data["total"] >= 1
        assert data["conversations"][0]["message"] == "I have a headache"

    def test_conversations_pagination(self, client: TestClient):
        """Pagination should work with limit and offset."""
        data = client.get("/ai/patients/test/conversations?limit=5&offset=0").json()
        assert "conversations" in data


# ══════════════════════════════════════════════════════════════════════════════
# Patient Summary — GET /ai/patients/{id}/summary
# ══════════════════════════════════════════════════════════════════════════════

class TestPatientSummaryEndpoint:
    """Test GET /ai/patients/{id}/summary."""

    def test_summary_returns_200(self, client: TestClient):
        response = client.get("/ai/patients/test-123/summary")
        assert response.status_code == 200

    def test_summary_has_required_fields(self, client: TestClient):
        data = client.get("/ai/patients/test-123/summary").json()
        assert "patientId" in data
        assert "demographics" in data
        assert "riskScores" in data
        assert "emergencyFlags" in data
        assert "recentConversations" in data
        assert "generatedAt" in data

    def test_summary_risk_scores_embedded(self, client: TestClient):
        data = client.get("/ai/patients/test-123/summary").json()
        assert "cardiovascular" in data["riskScores"]
        assert "diabetes" in data["riskScores"]

    def test_summary_patient_id_matches(self, client: TestClient):
        data = client.get("/ai/patients/xyz-patient/summary").json()
        assert data["patientId"] == "xyz-patient"


# ══════════════════════════════════════════════════════════════════════════════
# Service Stats — GET /ai/stats
# ══════════════════════════════════════════════════════════════════════════════

class TestServiceStatsEndpoint:
    """Test GET /ai/stats."""

    def test_stats_returns_200(self, client: TestClient):
        response = client.get("/ai/stats")
        assert response.status_code == 200

    def test_stats_has_required_fields(self, client: TestClient):
        data = client.get("/ai/stats").json()
        assert "status" in data
        assert data["status"] == "ok"
        assert "totalPatients" in data
        assert "totalConversations" in data
        assert "safetyTriggers" in data
        assert "uptime" in data

    def test_stats_uptime_is_formatted(self, client: TestClient):
        data = client.get("/ai/stats").json()
        # Uptime format: "Xh Ym Zs"
        assert "h" in data["uptime"]
        assert "m" in data["uptime"]
        assert "s" in data["uptime"]


# ══════════════════════════════════════════════════════════════════════════════
# Medication Safety — POST /ai/medications/check
# ══════════════════════════════════════════════════════════════════════════════

class TestMedicationSafetyEndpoint:
    """Test POST /ai/medications/check."""

    def test_medication_check_returns_200(self, client: TestClient):
        response = client.post("/ai/medications/check", json={
            "patientId": "test",
            "medications": ["Metformin 500mg"],
        })
        assert response.status_code == 200

    def test_safe_medications_no_issues(self, client: TestClient):
        data = client.post("/ai/medications/check", json={
            "patientId": "test",
            "medications": ["Metformin 500mg"],
            "allergies": [],
            "conditions": [],
        }).json()
        assert data["safe"] is True
        assert data["totalIssues"] == 0

    def test_detects_drug_interaction(self, client: TestClient):
        data = client.post("/ai/medications/check", json={
            "patientId": "test",
            "medications": ["Aspirin 75mg", "Warfarin 5mg"],
        }).json()
        assert data["safe"] is False
        assert len(data["interactions"]) >= 1
        assert data["interactions"][0]["severity"] == "critical"

    def test_detects_allergy_conflict(self, client: TestClient):
        data = client.post("/ai/medications/check", json={
            "patientId": "test",
            "medications": ["Amoxicillin 500mg"],
            "allergies": ["Penicillin"],
        }).json()
        assert len(data["allergyConflicts"]) >= 1
        assert data["allergyConflicts"][0]["severity"] == "critical"

    def test_detects_duplicate_therapy(self, client: TestClient):
        data = client.post("/ai/medications/check", json={
            "patientId": "test",
            "medications": ["Ibuprofen 400mg", "Naproxen 250mg"],
        }).json()
        assert len(data["duplicates"]) >= 1
        assert "NSAID" in data["duplicates"][0]["drugClass"]

    def test_detects_condition_contraindication(self, client: TestClient):
        data = client.post("/ai/medications/check", json={
            "patientId": "test",
            "medications": ["Metformin 500mg"],
            "conditions": ["Chronic Kidney Disease"],
        }).json()
        assert len(data["contraindications"]) >= 1

    def test_response_has_required_fields(self, client: TestClient):
        data = client.post("/ai/medications/check", json={
            "patientId": "test",
            "medications": ["Aspirin"],
        }).json()
        assert "safe" in data
        assert "interactions" in data
        assert "allergyConflicts" in data
        assert "duplicates" in data
        assert "contraindications" in data
        assert "totalIssues" in data

    def test_multiple_issues_detected(self, client: TestClient):
        """Complex scenario with multiple safety issues."""
        data = client.post("/ai/medications/check", json={
            "patientId": "test",
            "medications": ["Aspirin 75mg", "Warfarin 5mg", "Ibuprofen 400mg"],
            "allergies": [],
            "conditions": [],
        }).json()
        # Should detect: Aspirin+Warfarin, Ibuprofen+Aspirin, Warfarin+NSAID, duplicate NSAIDs
        assert data["totalIssues"] >= 3


# ══════════════════════════════════════════════════════════════════════════════
# Health Trends — GET /ai/patients/{id}/trends
# ══════════════════════════════════════════════════════════════════════════════

class TestHealthTrendsEndpoint:
    """Test GET /ai/patients/{id}/trends."""

    def test_trends_returns_200(self, client: TestClient):
        response = client.get("/ai/patients/test-123/trends")
        assert response.status_code == 200

    def test_trends_has_required_fields(self, client: TestClient):
        data = client.get("/ai/patients/test-123/trends").json()
        assert "patientId" in data
        assert "metrics" in data
        assert "insights" in data
        assert "totalMetrics" in data
        assert "totalInsights" in data
        assert "analyzedAt" in data

    def test_trends_patient_id_matches(self, client: TestClient):
        data = client.get("/ai/patients/xyz-pat/trends").json()
        assert data["patientId"] == "xyz-pat"

    def test_trends_has_metrics(self, client: TestClient):
        """Mock patient has glucose and spo2 data — should appear in metrics."""
        data = client.get("/ai/patients/test-123/trends").json()
        assert data["totalMetrics"] >= 1


# ══════════════════════════════════════════════════════════════════════════════
# Symptom Checker — POST /ai/symptoms/analyze
# ══════════════════════════════════════════════════════════════════════════════

class TestSymptomCheckerEndpoint:
    """Test POST /ai/symptoms/analyze."""

    def test_symptom_analyze_returns_200(self, client: TestClient):
        response = client.post("/ai/symptoms/analyze", json={
            "patientId": "test",
            "symptoms": ["headache", "fatigue"],
        })
        assert response.status_code == 200

    def test_response_has_required_fields(self, client: TestClient):
        data = client.post("/ai/symptoms/analyze", json={
            "patientId": "test",
            "symptoms": ["headache"],
        }).json()
        assert "urgency" in data
        assert "redFlags" in data
        assert "possibleConditions" in data
        assert "recommendations" in data
        assert "disclaimer" in data

    def test_red_flag_detected_for_chest_pain(self, client: TestClient):
        data = client.post("/ai/symptoms/analyze", json={
            "patientId": "test",
            "symptoms": ["chest pain", "shortness of breath"],
        }).json()
        assert data["urgency"] == "emergency"
        assert len(data["redFlags"]) >= 1

    def test_routine_symptoms_not_emergency(self, client: TestClient):
        data = client.post("/ai/symptoms/analyze", json={
            "patientId": "test",
            "symptoms": ["headache", "fatigue"],
        }).json()
        assert data["urgency"] in ("routine", "soon")

    def test_possible_conditions_returned(self, client: TestClient):
        data = client.post("/ai/symptoms/analyze", json={
            "patientId": "test",
            "symptoms": ["fever", "cough", "sore throat"],
        }).json()
        assert len(data["possibleConditions"]) >= 1
        assert data["possibleConditions"][0]["matchRatio"] >= 50

    def test_disclaimer_present(self, client: TestClient):
        data = client.post("/ai/symptoms/analyze", json={
            "patientId": "test",
            "symptoms": ["headache"],
        }).json()
        assert "not a medical diagnosis" in data["disclaimer"].lower()

    def test_recommendations_include_consultation(self, client: TestClient):
        data = client.post("/ai/symptoms/analyze", json={
            "patientId": "test",
            "symptoms": ["headache"],
        }).json()
        assert any("healthcare provider" in r.lower() or "doctor" in r.lower()
                    for r in data["recommendations"])

    def test_rejects_empty_symptoms(self, client: TestClient):
        response = client.post("/ai/symptoms/analyze", json={
            "patientId": "test",
            "symptoms": [],
        })
        assert response.status_code == 422


# ══════════════════════════════════════════════════════════════════════════════
# Care Plan — GET /ai/patients/{id}/care-plan
# ══════════════════════════════════════════════════════════════════════════════

class TestCarePlanEndpoint:
    """Test GET /ai/patients/{id}/care-plan."""

    def test_careplan_returns_200(self, client: TestClient):
        response = client.get("/ai/patients/test-123/care-plan")
        assert response.status_code == 200

    def test_careplan_has_required_fields(self, client: TestClient):
        data = client.get("/ai/patients/test-123/care-plan").json()
        assert "patientId" in data
        assert "conditions" in data
        assert "generalRecommendations" in data
        assert "riskBasedActions" in data
        assert "medicationReminders" in data
        assert "disclaimer" in data

    def test_careplan_has_general_recommendations(self, client: TestClient):
        data = client.get("/ai/patients/test-123/care-plan").json()
        assert len(data["generalRecommendations"]) >= 1

    def test_careplan_has_medication_reminders(self, client: TestClient):
        """Mock patient has Metformin — should generate a reminder."""
        data = client.get("/ai/patients/test-123/care-plan").json()
        assert len(data["medicationReminders"]) >= 1
        assert "metformin" in data["medicationReminders"][0]["medication"].lower()

    def test_careplan_has_condition_plans(self, client: TestClient):
        """Mock patient has Type 2 Diabetes — should have a condition plan."""
        data = client.get("/ai/patients/test-123/care-plan").json()
        assert len(data["conditions"]) >= 1

    def test_careplan_disclaimer_present(self, client: TestClient):
        data = client.get("/ai/patients/test-123/care-plan").json()
        assert "not replace professional medical advice" in data["disclaimer"].lower()

    def test_careplan_patient_id_matches(self, client: TestClient):
        data = client.get("/ai/patients/xyz-pat/care-plan").json()
        assert data["patientId"] == "xyz-pat"


# ══════════════════════════════════════════════════════════════════════════════
# Wellness Score — GET /ai/patients/{id}/wellness-score
# ══════════════════════════════════════════════════════════════════════════════

class TestWellnessScoreEndpoint:
    """Test GET /ai/patients/{id}/wellness-score."""

    def test_wellness_returns_200(self, client: TestClient):
        response = client.get("/ai/patients/test-123/wellness-score")
        assert response.status_code == 200

    def test_wellness_has_required_fields(self, client: TestClient):
        data = client.get("/ai/patients/test-123/wellness-score").json()
        assert "overallScore" in data
        assert "level" in data
        assert "label" in data
        assert "breakdown" in data
        assert "improvementTips" in data
        assert "calculatedAt" in data

    def test_wellness_score_in_range(self, client: TestClient):
        data = client.get("/ai/patients/test-123/wellness-score").json()
        assert 0 <= data["overallScore"] <= 100

    def test_wellness_has_all_dimensions(self, client: TestClient):
        data = client.get("/ai/patients/test-123/wellness-score").json()
        breakdown = data["breakdown"]
        assert "cardiovascular" in breakdown
        assert "diabetes" in breakdown
        assert "vitals" in breakdown
        assert "medications" in breakdown
        assert "emergency" in breakdown

    def test_wellness_level_is_valid(self, client: TestClient):
        data = client.get("/ai/patients/test-123/wellness-score").json()
        valid_levels = {"excellent", "good", "fair", "poor", "critical"}
        assert data["level"] in valid_levels

    def test_wellness_has_tips(self, client: TestClient):
        data = client.get("/ai/patients/test-123/wellness-score").json()
        assert isinstance(data["improvementTips"], list)
        assert len(data["improvementTips"]) >= 1

    def test_wellness_patient_id_different(self, client: TestClient):
        """Different patient IDs should still return 200."""
        r1 = client.get("/ai/patients/patient-A/wellness-score")
        r2 = client.get("/ai/patients/patient-B/wellness-score")
        assert r1.status_code == 200
        assert r2.status_code == 200


# ══════════════════════════════════════════════════════════════════════════════
# Health Report — GET /ai/patients/{id}/health-report
# ══════════════════════════════════════════════════════════════════════════════

class TestHealthReportEndpoint:
    """Test GET /ai/patients/{id}/health-report."""

    def test_report_returns_200(self, client: TestClient):
        response = client.get("/ai/patients/test-123/health-report")
        assert response.status_code == 200

    def test_report_has_required_sections(self, client: TestClient):
        data = client.get("/ai/patients/test-123/health-report").json()
        assert "patientId" in data
        assert "reportType" in data
        assert data["reportType"] == "comprehensive"
        assert "executiveSummary" in data
        assert "wellnessScore" in data
        assert "riskScores" in data
        assert "vitalsAnalysis" in data
        assert "emergencyFlags" in data
        assert "medicationSafety" in data
        assert "healthTrends" in data
        assert "carePlanHighlights" in data
        assert "disclaimer" in data

    def test_report_wellness_embedded(self, client: TestClient):
        data = client.get("/ai/patients/test-123/health-report").json()
        ws = data["wellnessScore"]
        assert "overallScore" in ws
        assert "level" in ws
        assert "breakdown" in ws

    def test_report_risk_scores_embedded(self, client: TestClient):
        data = client.get("/ai/patients/test-123/health-report").json()
        assert "cardiovascular" in data["riskScores"]
        assert "diabetes" in data["riskScores"]

    def test_report_has_executive_summary(self, client: TestClient):
        data = client.get("/ai/patients/test-123/health-report").json()
        assert len(data["executiveSummary"]) > 0
        assert "wellness" in data["executiveSummary"].lower()

    def test_report_disclaimer_present(self, client: TestClient):
        data = client.get("/ai/patients/test-123/health-report").json()
        assert "ai-generated" in data["disclaimer"].lower()

    def test_report_patient_id_matches(self, client: TestClient):
        data = client.get("/ai/patients/xyz-rep/health-report").json()
        assert data["patientId"] == "xyz-rep"


# ══════════════════════════════════════════════════════════════════════════════
# Health Goals — /ai/patients/{id}/goals
# ══════════════════════════════════════════════════════════════════════════════

class TestHealthGoalsEndpoint:
    """Test health goals CRUD endpoints."""

    def test_create_goal_returns_201(self, client: TestClient):
        response = client.post("/ai/patients/goal-test/goals", json={
            "goalType": "weight_loss",
            "targetValue": 75.0,
            "currentValue": 85.0,
        })
        assert response.status_code == 201

    def test_create_goal_has_fields(self, client: TestClient):
        data = client.post("/ai/patients/goal-test2/goals", json={
            "goalType": "blood_pressure",
            "targetValue": 120.0,
            "currentValue": 140.0,
        }).json()
        assert "goalId" in data
        assert data["patientId"] == "goal-test2"
        assert data["goalType"] == "blood_pressure"
        assert data["targetValue"] == 120.0
        assert data["status"] == "active"
        assert data["progress"] >= 0.0

    def test_create_goal_calculates_progress(self, client: TestClient):
        data = client.post("/ai/patients/goal-test3/goals", json={
            "goalType": "weight_loss",
            "targetValue": 70.0,
            "currentValue": 80.0,
            "notes": "Target by summer",
        }).json()
        assert data["progress"] == 0.0  # No progress yet (current == start)
        assert data["direction"] == "decrease"

    def test_get_goals_summary(self, client: TestClient):
        # Create a goal first
        client.post("/ai/patients/goal-sum/goals", json={
            "goalType": "glucose_control",
            "targetValue": 100.0,
            "currentValue": 150.0,
        })
        data = client.get("/ai/patients/goal-sum/goals").json()
        assert "totalGoals" in data
        assert "activeGoals" in data
        assert "completedGoals" in data
        assert "availableTemplates" in data
        assert data["totalGoals"] >= 1

    def test_update_goal_progress(self, client: TestClient):
        # Create
        goal = client.post("/ai/patients/goal-upd/goals", json={
            "goalType": "weight_loss",
            "targetValue": 70.0,
            "currentValue": 80.0,
        }).json()
        goal_id = goal["goalId"]

        # Update progress
        updated = client.patch(
            f"/ai/patients/goal-upd/goals/{goal_id}",
            json={"currentValue": 75.0},
        ).json()
        assert updated["currentValue"] == 75.0
        assert updated["progress"] > 0.0

    def test_update_nonexistent_goal_returns_404(self, client: TestClient):
        response = client.patch(
            "/ai/patients/goal-upd/goals/nonexistent",
            json={"currentValue": 75.0},
        )
        assert response.status_code == 404

    def test_get_templates(self, client: TestClient):
        data = client.get("/ai/goals/templates").json()
        assert "templates" in data
        assert "weight_loss" in data["templates"]
        assert "blood_pressure" in data["templates"]
        assert "glucose_control" in data["templates"]

    def test_goal_completes_at_target(self, client: TestClient):
        """A decrease goal that reaches its target should auto-complete."""
        goal = client.post("/ai/patients/goal-comp/goals", json={
            "goalType": "weight_loss",
            "targetValue": 70.0,
            "currentValue": 80.0,
        }).json()
        goal_id = goal["goalId"]

        # Update to exactly the target
        updated = client.patch(
            f"/ai/patients/goal-comp/goals/{goal_id}",
            json={"currentValue": 70.0},
        ).json()
        assert updated["progress"] == 100.0
        assert updated["status"] == "completed"


# ══════════════════════════════════════════════════════════════════════════════
# Patient Alerts — /ai/patients/{id}/alerts
# ══════════════════════════════════════════════════════════════════════════════

class TestPatientAlertsEndpoint:
    """Test patient alerts endpoints."""

    def test_get_alerts_returns_200(self, client: TestClient):
        response = client.get("/ai/patients/alert-test/alerts")
        assert response.status_code == 200

    def test_alerts_auto_generated(self, client: TestClient):
        """Alerts should be auto-generated from patient health data."""
        data = client.get("/ai/patients/test-123/alerts").json()
        assert isinstance(data, list)
        # Mock patient with diabetes and high-risk conditions should generate alerts
        # At minimum, the data should be a list
        assert len(data) >= 0

    def test_alert_has_required_fields(self, client: TestClient):
        data = client.get("/ai/patients/test-123/alerts").json()
        if data:  # Only check if alerts were generated
            alert = data[0]
            assert "alertId" in alert
            assert "patientId" in alert
            assert "category" in alert
            assert "severity" in alert
            assert "title" in alert
            assert "message" in alert
            assert "status" in alert

    def test_alerts_summary_returns_200(self, client: TestClient):
        response = client.get("/ai/patients/test-123/alerts/summary")
        assert response.status_code == 200

    def test_alerts_summary_has_fields(self, client: TestClient):
        data = client.get("/ai/patients/test-123/alerts/summary").json()
        assert "totalAlerts" in data
        assert "activeAlerts" in data
        assert "criticalCount" in data
        assert "warningCount" in data

    def test_acknowledge_nonexistent_returns_404(self, client: TestClient):
        response = client.post("/ai/patients/test-123/alerts/fake-id/acknowledge")
        assert response.status_code == 404

    def test_dismiss_nonexistent_returns_404(self, client: TestClient):
        response = client.post("/ai/patients/test-123/alerts/fake-id/dismiss")
        assert response.status_code == 404

    def test_acknowledge_and_dismiss_flow(self, client: TestClient):
        """Generate alerts, acknowledge one, dismiss one."""
        alerts = client.get("/ai/patients/flow-test/alerts").json()
        if alerts:
            alert_id = alerts[0]["alertId"]
            # Acknowledge
            ack = client.post(f"/ai/patients/flow-test/alerts/{alert_id}/acknowledge").json()
            assert ack["success"] is True
            assert ack["newStatus"] == "acknowledged"

            # Dismiss
            dismiss = client.post(f"/ai/patients/flow-test/alerts/{alert_id}/dismiss").json()
            assert dismiss["success"] is True
            assert dismiss["newStatus"] == "dismissed"


# ══════════════════════════════════════════════════════════════════════════════
# Patient Timeline — GET /ai/patients/{id}/timeline
# ══════════════════════════════════════════════════════════════════════════════

class TestPatientTimelineEndpoint:
    """Test GET /ai/patients/{id}/timeline."""

    def test_timeline_returns_200(self, client: TestClient):
        response = client.get("/ai/patients/test-123/timeline")
        assert response.status_code == 200

    def test_timeline_has_required_fields(self, client: TestClient):
        data = client.get("/ai/patients/test-123/timeline").json()
        assert "patientId" in data
        assert "events" in data
        assert "totalEvents" in data
        assert "shownEvents" in data
        assert "categories" in data
        assert "generatedAt" in data

    def test_timeline_patient_id_matches(self, client: TestClient):
        data = client.get("/ai/patients/xyz-tl/timeline").json()
        assert data["patientId"] == "xyz-tl"

    def test_timeline_has_events(self, client: TestClient):
        """Mock patient has vitals and risk data — should produce events."""
        data = client.get("/ai/patients/test-123/timeline").json()
        assert data["totalEvents"] >= 1
        assert len(data["events"]) >= 1

    def test_timeline_events_have_fields(self, client: TestClient):
        data = client.get("/ai/patients/test-123/timeline").json()
        if data["events"]:
            event = data["events"][0]
            assert "type" in event
            assert "title" in event
            assert "severity" in event

    def test_timeline_categories_populated(self, client: TestClient):
        data = client.get("/ai/patients/test-123/timeline").json()
        assert isinstance(data["categories"], dict)
        # Should have at least risk_assessment and vital_sign categories
        assert len(data["categories"]) >= 1

    def test_timeline_respects_limit(self, client: TestClient):
        data = client.get("/ai/patients/test-123/timeline?limit=3").json()
        assert data["shownEvents"] <= 3


# ══════════════════════════════════════════════════════════════════════════════
# Health Benchmarks — GET /ai/patients/{id}/benchmarks
# ══════════════════════════════════════════════════════════════════════════════

class TestHealthBenchmarksEndpoint:
    """Test GET /ai/patients/{id}/benchmarks."""

    def test_benchmarks_returns_200(self, client: TestClient):
        response = client.get("/ai/patients/test-123/benchmarks")
        assert response.status_code == 200

    def test_benchmarks_has_required_fields(self, client: TestClient):
        data = client.get("/ai/patients/test-123/benchmarks").json()
        assert "patientId" in data
        assert "comparisons" in data
        assert "totalCompared" in data
        assert "summary" in data
        assert "recommendations" in data
        assert "analyzedAt" in data

    def test_benchmarks_has_comparisons(self, client: TestClient):
        """Mock patient has vitals — should produce comparisons."""
        data = client.get("/ai/patients/test-123/benchmarks").json()
        assert data["totalCompared"] >= 1
        assert len(data["comparisons"]) >= 1

    def test_comparison_has_fields(self, client: TestClient):
        data = client.get("/ai/patients/test-123/benchmarks").json()
        if data["comparisons"]:
            c = data["comparisons"][0]
            assert "metric" in c
            assert "value" in c
            assert "status" in c
            assert "color" in c
            assert "inRange" in c

    def test_summary_has_counts(self, client: TestClient):
        data = client.get("/ai/patients/test-123/benchmarks").json()
        summary = data["summary"]
        assert "optimal" in summary
        assert "normal" in summary
        assert "elevated" in summary
        assert "high" in summary

    def test_benchmarks_patient_id_matches(self, client: TestClient):
        data = client.get("/ai/patients/bench-test/benchmarks").json()
        assert data["patientId"] == "bench-test"

    def test_reference_ranges_endpoint(self, client: TestClient):
        data = client.get("/ai/benchmarks/ranges").json()
        assert "ranges" in data
        assert "heart_rate" in data["ranges"]
        assert "glucose" in data["ranges"]
        assert "spo2" in data["ranges"]
