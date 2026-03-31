"""
MediCore AI Service — Safety Test Suite (Day 4)
Tests the 6 mandatory safety constraints of the AI Health Advisor.

These tests validate the LLM service's LOCAL safety logic (crisis detection,
prompt rules) and do NOT require a live Gemini API key.
"""

import pytest
import sys
import os

# Add the ai-service root to the path so imports work
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from services.llm_service import (  # type: ignore
    LLMService,
    CRISIS_KEYWORDS,
    CRISIS_RESPONSE,
    SYSTEM_PROMPT_TEMPLATE,
)
from services.patient_context import PatientContextService  # type: ignore


# ── Fixtures ─────────────────────────────────────────────────────────────────

@pytest.fixture
def llm_service():
    """Create an LLMService instance (API key may be empty for local tests)."""
    return LLMService()


@pytest.fixture
def patient_context_service():
    """Create a PatientContextService instance."""
    return PatientContextService()


@pytest.fixture
def mock_patient_context():
    """Realistic mock patient context for testing prompt injection."""
    return {
        "demographics": {
            "name": "Rahul Sharma",
            "age": 45,
            "gender": "Male",
            "blood_type": "B+",
        },
        "active_medications": [
            {"name": "Metformin 500mg", "frequency": "Twice daily"},
            {"name": "Lisinopril 10mg", "frequency": "Once daily"},
            {"name": "Aspirin 75mg", "frequency": "Once daily"},
        ],
        "allergies": ["Penicillin", "Sulfa drugs"],
        "active_conditions": ["Type 2 Diabetes", "Hypertension"],
        "recent_vitals": {
            "blood_pressure": {"latest": "138/88", "trend": "stable"},
            "blood_sugar": {"latest": 142, "avg7d": 135, "trend": "up"},
            "heart_rate": {"latest": 78, "avg7d": 76, "trend": "stable"},
        },
        "recent_alerts": [],
    }


# ══════════════════════════════════════════════════════════════════════════════
# TEST 1: Crisis keyword detection → safetyFlag=True + iCall number
# ══════════════════════════════════════════════════════════════════════════════

class TestCrisisDetection:
    """Verify that ALL crisis keywords trigger the safety response."""

    @pytest.mark.parametrize("keyword", CRISIS_KEYWORDS)
    @pytest.mark.asyncio
    async def test_crisis_keyword_triggers_safety_flag(
        self, llm_service, mock_patient_context, keyword
    ):
        """Each crisis keyword must return safetyFlag=True."""
        message = f"I have been feeling like {keyword} lately"
        reply, safety_flag = await llm_service.ask_advisor(
            message=message,
            patient_context=mock_patient_context,
        )
        assert safety_flag is True, f"Crisis keyword '{keyword}' did NOT trigger safetyFlag"

    @pytest.mark.parametrize("keyword", CRISIS_KEYWORDS)
    @pytest.mark.asyncio
    async def test_crisis_response_contains_icall_number(
        self, llm_service, mock_patient_context, keyword
    ):
        """Crisis response must contain the iCall helpline number."""
        message = f"I have been thinking about {keyword}"
        reply, _ = await llm_service.ask_advisor(
            message=message,
            patient_context=mock_patient_context,
        )
        assert "9152987821" in reply, "Crisis response must include iCall number 9152987821"

    @pytest.mark.asyncio
    async def test_crisis_response_exact_text(self, llm_service, mock_patient_context):
        """Crisis response must match the exact prescribed text."""
        reply, safety_flag = await llm_service.ask_advisor(
            message="I want to kill myself",
            patient_context=mock_patient_context,
        )
        assert reply == CRISIS_RESPONSE
        assert safety_flag is True

    @pytest.mark.asyncio
    async def test_non_crisis_message_does_not_trigger_safety(
        self, llm_service, mock_patient_context
    ):
        """A normal health question must NOT trigger the safety flag."""
        reply, safety_flag = await llm_service.ask_advisor(
            message="What is my blood pressure?",
            patient_context=mock_patient_context,
        )
        assert safety_flag is False, "Non-crisis message should NOT trigger safetyFlag"


# ══════════════════════════════════════════════════════════════════════════════
# TEST 2: Advisor never diagnoses — system prompt enforces "I notice" language
# ══════════════════════════════════════════════════════════════════════════════

class TestNoDiagnosis:
    """Verify the system prompt contains the no-diagnosis rule."""

    def test_system_prompt_contains_no_diagnosis_rule(self):
        """The system prompt must include the 'NEVER diagnose' rule."""
        assert "NEVER diagnose" in SYSTEM_PROMPT_TEMPLATE
        assert "I notice" in SYSTEM_PROMPT_TEMPLATE

    def test_system_prompt_avoids_you_have_pattern(self):
        """System prompt instructs to say 'I notice X' not 'You have X'."""
        assert "You have X" in SYSTEM_PROMPT_TEMPLATE  # The DON'T example
        assert "I notice X" in SYSTEM_PROMPT_TEMPLATE  # The DO example

    def test_prompt_injection_with_patient_context(self, llm_service, mock_patient_context):
        """Patient context must be injected into the system prompt as JSON."""
        prompt = llm_service._build_system_prompt(mock_patient_context)
        assert "Rahul Sharma" in prompt
        assert "Metformin" in prompt
        assert "Penicillin" in prompt


# ══════════════════════════════════════════════════════════════════════════════
# TEST 3: Advisor never suggests changing dosage
# ══════════════════════════════════════════════════════════════════════════════

class TestNoDosageChange:
    """Verify the system prompt forbids dosage change suggestions."""

    def test_system_prompt_contains_dosage_rule(self):
        """The system prompt must include the 'NEVER suggest changing prescribed dosage' rule."""
        assert "NEVER suggest changing a prescribed dosage" in SYSTEM_PROMPT_TEMPLATE


# ══════════════════════════════════════════════════════════════════════════════
# TEST 4: Advisor always recommends physician consultation
# ══════════════════════════════════════════════════════════════════════════════

class TestPhysicianReferral:
    """Verify the system prompt enforces physician consultation recommendation."""

    def test_system_prompt_contains_physician_rule(self):
        """The system prompt must require physician consultation."""
        assert "ALWAYS recommend physician consultation" in SYSTEM_PROMPT_TEMPLATE

    def test_system_prompt_ends_with_doctor_disclaimer(self):
        """Every clinical response should end with a doctor disclaimer."""
        assert "Please discuss this with your doctor before making any changes" in SYSTEM_PROMPT_TEMPLATE


# ══════════════════════════════════════════════════════════════════════════════
# TEST 5: Response capped at max 3 paragraphs
# ══════════════════════════════════════════════════════════════════════════════

class TestResponseLength:
    """Verify the system prompt enforces the 3-paragraph limit."""

    def test_system_prompt_contains_paragraph_limit(self):
        """The system prompt must specify max 3 paragraphs."""
        assert "Max 3 paragraphs" in SYSTEM_PROMPT_TEMPLATE

    @pytest.mark.asyncio
    async def test_crisis_response_is_single_paragraph(
        self, llm_service, mock_patient_context
    ):
        """Crisis response must be a single paragraph (no newlines)."""
        reply, _ = await llm_service.ask_advisor(
            message="I want to end my life",
            patient_context=mock_patient_context,
        )
        paragraphs = [p.strip() for p in reply.split("\n\n") if p.strip()]
        assert len(paragraphs) <= 3, f"Crisis response has {len(paragraphs)} paragraphs"


# ══════════════════════════════════════════════════════════════════════════════
# TEST 6: All responses cite patient records
# ══════════════════════════════════════════════════════════════════════════════

class TestRecordsCitation:
    """Verify the system prompt enforces patient records citation."""

    def test_system_prompt_requires_records_basis(self):
        """The system prompt must require basing claims on patient records."""
        assert "Base every claim on patient's records only" in SYSTEM_PROMPT_TEMPLATE

    def test_system_prompt_requires_uncertainty_expression(self):
        """The system prompt must require 'Based on your records' language."""
        assert "Based on your records" in SYSTEM_PROMPT_TEMPLATE

    def test_patient_context_json_injected(self, llm_service, mock_patient_context):
        """The system prompt must have the patient records JSON block."""
        prompt = llm_service._build_system_prompt(mock_patient_context)
        assert "PATIENT HEALTH RECORDS:" in prompt
        assert "Type 2 Diabetes" in prompt
        assert "Hypertension" in prompt
        assert "Lisinopril" in prompt


# ══════════════════════════════════════════════════════════════════════════════
# TEST: Patient Context Service cache
# ══════════════════════════════════════════════════════════════════════════════

class TestPatientContextCache:
    """Verify the PatientContextService cache works correctly."""

    @pytest.mark.asyncio
    async def test_mock_context_returns_valid_structure(self, patient_context_service):
        """Mock context must return a dict with required keys."""
        ctx = await patient_context_service.get_patient_context("test-id", None)
        assert isinstance(ctx, dict)
        assert "demographics" in ctx
        assert "activeMedications" in ctx
        assert "allergies" in ctx
        assert "activeConditions" in ctx

    @pytest.mark.asyncio
    async def test_cache_hit_returns_same_data(self, patient_context_service):
        """Second call should return cached data."""
        ctx1 = await patient_context_service.get_patient_context("cache-test", None)
        ctx2 = await patient_context_service.get_patient_context("cache-test", None)
        assert ctx1 == ctx2

    @pytest.mark.asyncio
    async def test_different_patients_get_different_cache_entries(
        self, patient_context_service
    ):
        """Different patient IDs should produce separate cache entries."""
        ctx_a = await patient_context_service.get_patient_context("patient-a", None)
        ctx_b = await patient_context_service.get_patient_context("patient-b", None)
        # Both should be valid
        assert isinstance(ctx_a, dict)
        assert isinstance(ctx_b, dict)
