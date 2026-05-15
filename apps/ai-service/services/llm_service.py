"""
MediCore AI Service — LLM Service
RAG Health Advisor powered by OpenRouter API (OpenAI-compatible).
Injects patient health records into the system prompt and enforces strict safety rules.
"""

import asyncio
import json
import logging
from typing import Any, Dict, List, Optional, Tuple

import httpx
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

OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1/chat/completions"


class LLMService:
    """Wrapper around OpenRouter API for AI interactions with safety constraints."""

    MAX_RETRIES = 3
    RETRY_DELAYS = [2, 5, 10]  # seconds

    def __init__(self) -> None:
        self.settings = get_settings()
        self.api_key = self.settings.OPENROUTER_API_KEY
        self.model = self.settings.OPENROUTER_MODEL

        if not self.api_key:
            logger.warning("OPENROUTER_API_KEY not set — AI chat will fail")

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
        Send a patient message to OpenRouter with their health context.

        Returns:
            (reply_text, safety_flag)
        """

        # 1. Crisis detection — override everything
        if self._detect_crisis(message):
            logger.warning("Crisis keywords detected — returning safety response")
            return (CRISIS_RESPONSE, True)

        # 2. Build the system prompt with patient records
        system_prompt = self._build_system_prompt(patient_context)

        # 3. Build conversation messages for OpenAI-compatible API
        messages: List[Dict[str, str]] = [
            {"role": "system", "content": system_prompt}
        ]

        if conversation_history:
            for entry in conversation_history:
                role = entry.get("role", "user")
                content = entry.get("content", "")
                if content:
                    messages.append({"role": role, "content": content})

        # Add the current user message
        messages.append({"role": "user", "content": message})

        # 4. Call OpenRouter API with retry logic
        last_error: Optional[Exception] = None
        for attempt in range(self.MAX_RETRIES):
            try:
                async with httpx.AsyncClient(timeout=30.0) as client:
                    response = await client.post(
                        OPENROUTER_BASE_URL,
                        headers={
                            "Authorization": f"Bearer {self.api_key}",
                            "Content-Type": "application/json",
                            "HTTP-Referer": "https://medicore-ebon.vercel.app",
                            "X-Title": "MediCore AI Health Advisor",
                        },
                        json={
                            "model": self.model,
                            "messages": messages,
                            "max_tokens": 500,
                            "temperature": 0.3,
                        },
                    )

                if response.status_code == 200:
                    data = response.json()
                    reply = data["choices"][0]["message"]["content"]
                    logger.info(
                        "OpenRouter response received (%d chars, attempt %d)",
                        len(reply), attempt + 1,
                    )
                    return (reply, False)
                elif response.status_code == 429:
                    if attempt < self.MAX_RETRIES - 1:
                        delay = self.RETRY_DELAYS[attempt]
                        logger.warning(
                            "OpenRouter rate limit (attempt %d/%d), retrying in %ds...",
                            attempt + 1, self.MAX_RETRIES, delay,
                        )
                        await asyncio.sleep(delay)
                        continue
                    else:
                        logger.warning("OpenRouter rate limit after %d attempts", self.MAX_RETRIES)
                        raise HTTPException(status_code=429, detail="Rate limit exceeded on AI Service.")
                else:
                    error_body = response.text
                    logger.error("OpenRouter API error %d: %s", response.status_code, error_body)
                    return (
                        "I'm sorry, I encountered an error processing your request. "
                        "Please try again later.",
                        False,
                    )

            except HTTPException:
                raise
            except Exception as exc:
                last_error = exc
                error_msg = str(exc).lower()

                if "api_key" in error_msg or "invalid" in error_msg or "authentication" in error_msg:
                    logger.error("OpenRouter API key is invalid or missing")
                    return (
                        "I'm sorry, the AI service is not properly configured. "
                        "Please contact your administrator to set up the API key.",
                        False,
                    )
                else:
                    logger.error("OpenRouter API error: %s", exc)
                    return (
                        "I'm sorry, I encountered an error processing your request. "
                        "Please try again later.",
                        False,
                    )

        # Should not reach here, but just in case
        logger.error("Unexpected: exhausted retries without returning. Last error: %s", last_error)
        raise HTTPException(status_code=429, detail="Rate limit exceeded on AI Service.")
