"""
MediCore AI Service — LLM Service
RAG Health Advisor powered by Google Gemini API.
Injects patient health records into the system prompt and enforces strict safety rules.
"""

import json
import logging
from typing import Any, Dict, List, Optional, Tuple

import google.generativeai as genai  # type: ignore  # pyright: ignore[reportPrivateImportUsage]
from config import get_settings  # type: ignore
from fastapi import HTTPException  # type: ignore

logger = logging.getLogger("medicore-ai.llm")

# ── NON-NEGOTIABLE System Prompt (from workplan) ─────────────────────────────

SYSTEM_PROMPT_TEMPLATE = """You are MediCore Health Advisor — a health information assistant. You have access to this patient's personal health records shown below.

ABSOLUTE RULES:
1. NEVER diagnose. Say 'I notice X in your records' not 'You have X'.
2. ALWAYS recommend physician consultation for any clinical question.
3. NEVER suggest changing a prescribed dosage.
4. If patient mentions self-harm, suicide, or wanting to die, respond ONLY with: 'I'm concerned about what you've shared. Please reach out to iCall at 9152987821 or a trusted person right now. I am not able to help with this — a real person can.' Then set safetyFlag=true.
5. Base every claim on patient's records only.
6. Express uncertainty: 'Based on your records, I can see...'
7. Max 3 paragraphs. End every clinical response with: 'Please discuss this with your doctor before making any changes.'

PATIENT HEALTH RECORDS:
{patient_context_json}"""

# ── Crisis Detection ─────────────────────────────────────────────────────────

CRISIS_KEYWORDS = [
    "suicide", "kill myself", "end my life", "want to die",
    "self-harm", "self harm", "hurt myself", "giving up",
    "no reason to live", "better off dead", "ending it all",
    "don't want to live", "cant go on", "can't go on",
]

CRISIS_RESPONSE = (
    "I'm concerned about what you've shared. Please reach out to "
    "iCall at 9152987821 or a trusted person right now. "
    "I am not able to help with this — a real person can."
)


import asyncio

class LLMService:
    """Wrapper around the Google Gemini SDK for AI interactions with safety constraints."""

    MAX_RETRIES = 3
    RETRY_DELAYS = [2, 5, 10]  # seconds

    def __init__(self) -> None:
        self.settings = get_settings()
        self.api_key = self.settings.GEMINI_API_KEY

        # Configure the Gemini SDK with the API key
        genai.configure(api_key=self.api_key)  # pyright: ignore[reportPrivateImportUsage]

        # Initialize the model
        self.model = genai.GenerativeModel(  # pyright: ignore[reportPrivateImportUsage]
            model_name="gemini-1.5-flash",
            generation_config=genai.GenerationConfig(  # pyright: ignore[reportPrivateImportUsage]
                max_output_tokens=500,
                temperature=0.3,
            ),
        )

    def _detect_crisis(self, message: str) -> bool:
        """Check if the user message contains crisis keywords."""
        lower = message.lower()
        return any(kw in lower for kw in CRISIS_KEYWORDS)

    def _build_system_prompt(self, patient_context: Dict[str, Any]) -> str:
        """Inject patient health records into the system prompt."""
        context_json = json.dumps(patient_context, indent=2, default=str)
        return SYSTEM_PROMPT_TEMPLATE.format(patient_context_json=context_json)

    async def ask_advisor(
        self,
        message: str,
        patient_context: Dict[str, Any],
        conversation_history: Optional[List[Dict[str, str]]] = None,
    ) -> Tuple[str, bool]:
        """
        Send a patient message to Gemini with their health context.

        Returns:
            (reply_text, safety_flag)
        """

        # 1. Crisis detection — override everything
        if self._detect_crisis(message):
            logger.warning("Crisis keywords detected — returning safety response")
            return (CRISIS_RESPONSE, True)

        # 2. Build the system prompt with patient records
        system_prompt = self._build_system_prompt(patient_context)

        # 3. Build conversation contents for Gemini
        contents: List[Dict[str, Any]] = []

        if conversation_history:
            for entry in conversation_history:
                role = entry.get("role", "user")
                content = entry.get("content", "")
                if content:
                    gemini_role = "model" if role == "assistant" else "user"
                    contents.append({"role": gemini_role, "parts": [content]})

        # Add the current user message
        contents.append({"role": "user", "parts": [message]})

        # 4. Call Gemini API with retry logic for rate limits
        last_error: Optional[Exception] = None
        for attempt in range(self.MAX_RETRIES):
            try:
                model_with_context = genai.GenerativeModel(  # pyright: ignore[reportPrivateImportUsage]
                    model_name="gemini-1.5-flash",
                    generation_config=genai.GenerationConfig(  # pyright: ignore[reportPrivateImportUsage]
                        max_output_tokens=500,
                        temperature=0.3,
                    ),
                    system_instruction=system_prompt,
                )

                response = await model_with_context.generate_content_async(contents)

                reply = response.text
                logger.info("Gemini response received (%d chars, attempt %d)", len(reply), attempt + 1)
                return (reply, False)

            except Exception as exc:
                last_error = exc
                error_msg = str(exc).lower()

                if "api_key" in error_msg or "invalid" in error_msg or "authentication" in error_msg:
                    logger.error("Gemini API key is invalid or missing")
                    return (
                        "I'm sorry, the AI service is not properly configured. "
                        "Please contact your administrator to set up the API key.",
                        False,
                    )
                elif "quota" in error_msg or "rate" in error_msg:
                    if attempt < self.MAX_RETRIES - 1:
                        delay = self.RETRY_DELAYS[attempt]
                        logger.warning("Gemini rate limit hit (attempt %d/%d), retrying in %ds...", attempt + 1, self.MAX_RETRIES, delay)
                        await asyncio.sleep(delay)
                        continue
                    else:
                        logger.warning("Gemini rate limit hit after %d attempts, giving up", self.MAX_RETRIES)
                        raise HTTPException(status_code=429, detail="Rate limit exceeded on AI Service.")
                else:
                    logger.error("Gemini API error: %s", exc)
                    return (
                        "I'm sorry, I encountered an error processing your request. "
                        "Please try again later.",
                        False,
                    )

        # Should not reach here, but just in case
        logger.error("Unexpected: exhausted retries without returning. Last error: %s", last_error)
        raise HTTPException(status_code=429, detail="Rate limit exceeded on AI Service.")

