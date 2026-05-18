"""
MediCore AI Service — LLM Service (Dual-Provider)
Primary: Google Gemini 2.5 Flash (via google-generativeai SDK)
Fallback: OpenRouter (nvidia/nemotron-3-nano-30b-a3b:free via httpx)

Injects patient health records + uploaded document text into the system prompt.
Enforces strict safety rules and crisis detection.
"""

import asyncio
import json
import logging
from typing import Any, Dict, List, Optional, Tuple

import httpx
from config import get_settings  # type: ignore
from fastapi import HTTPException  # type: ignore

logger = logging.getLogger("medicore-ai.llm")

# ── System Prompt (Dual-Mode: patient-specific + general medical knowledge) ──

SYSTEM_PROMPT_TEMPLATE = """You are MediCore Health Advisor — a health information assistant. You have access to this patient's personal health records shown below.

ABSOLUTE RULES:
1. NEVER diagnose. Say 'I notice X in your records' not 'You have X'.
2. ALWAYS recommend physician consultation for any clinical question.
3. NEVER suggest changing a prescribed dosage.
4. If patient mentions self-harm, suicide, or wanting to die, respond ONLY with: 'I'm concerned about what you've shared. Please reach out to iCall at 9152987821 or a trusted person right now. I am not able to help with this — a real person can.' Then set safetyFlag=true.
5. For questions about THIS PATIENT's health: base your answer on the records provided below.
   For GENERAL medical knowledge questions (e.g., "What is metformin?", "What does HbA1c measure?", "What are symptoms of diabetes?"): answer using your medical knowledge, but always add a disclaimer that this is general information and they should consult their physician for personal medical advice.
6. Express uncertainty: 'Based on your records, I can see...'
7. Max 3 paragraphs. End every clinical response with: 'Please discuss this with your doctor before making any changes.'

PATIENT HEALTH RECORDS:
{patient_context_json}

UPLOADED DOCUMENTS (extracted text from patient's lab reports, prescriptions, and scans):
{documents_context}"""

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
    """Dual-provider LLM service: Gemini primary, OpenRouter fallback."""

    MAX_RETRIES = 2
    RETRY_DELAY = 3  # seconds

    def __init__(self) -> None:
        self.settings = get_settings()

        # ── Primary: Gemini ──────────────────────────────────────────────
        self.gemini_available = bool(self.settings.GEMINI_API_KEY)
        self.gemini_model = None

        if self.gemini_available:
            try:
                import google.generativeai as genai  # type: ignore
                genai.configure(api_key=self.settings.GEMINI_API_KEY)
                self.gemini_model = genai.GenerativeModel(
                    model_name="gemini-2.5-flash",
                    generation_config=genai.GenerationConfig(
                        max_output_tokens=1000,
                        temperature=0.3,
                    ),
                )
                self._genai = genai
                logger.info("Primary LLM: Gemini 2.5 Flash ✓")
            except Exception as exc:
                logger.warning("Failed to initialize Gemini SDK: %s", exc)
                self.gemini_available = False

        # ── Fallback: OpenRouter ─────────────────────────────────────────
        self.openrouter_available = bool(self.settings.OPENROUTER_API_KEY)
        self.openrouter_model = self.settings.OPENROUTER_MODEL

        if self.openrouter_available:
            logger.info("Fallback LLM: OpenRouter %s ✓", self.openrouter_model)

        if not self.gemini_available and not self.openrouter_available:
            logger.error("NO LLM providers configured — AI chat will fail!")

    # ── Crisis Detection ─────────────────────────────────────────────────

    def _detect_crisis(self, message: str) -> bool:
        """Check if the user message contains crisis keywords."""
        lower = message.lower()
        return any(kw in lower for kw in CRISIS_KEYWORDS)

    # ── Prompt Building ──────────────────────────────────────────────────

    def _build_system_prompt(self, patient_context: Dict[str, Any]) -> str:
        """Inject patient health records and document text into the system prompt."""
        # Extract documents from context for separate formatting
        documents = patient_context.get("uploadedDocuments", [])

        # Build documents context string
        if documents:
            docs_parts = []
            for doc in documents:
                docs_parts.append(
                    f"--- {doc.get('name', 'Unknown')} ({doc.get('type', 'other')}) ---\n"
                    f"{doc.get('content', 'No content extracted')}"
                )
            documents_context = "\n\n".join(docs_parts)
        else:
            documents_context = "No documents uploaded."

        # Build main context (without documents, to avoid duplication)
        context_without_docs = {k: v for k, v in patient_context.items() if k != "uploadedDocuments"}
        context_json = json.dumps(context_without_docs, indent=2, default=str)

        return SYSTEM_PROMPT_TEMPLATE.format(
            patient_context_json=context_json,
            documents_context=documents_context,
        )

    # ── Main Entry Point ─────────────────────────────────────────────────

    async def ask_advisor(
        self,
        message: str,
        patient_context: Dict[str, Any],
        conversation_history: Optional[List[Dict[str, str]]] = None,
    ) -> Tuple[str, bool]:
        """
        Send a patient message with health context to the LLM.
        Tries Gemini first, falls back to OpenRouter on error.

        Returns:
            (reply_text, safety_flag)
        """

        # 1. Crisis detection — override everything
        if self._detect_crisis(message):
            logger.warning("Crisis keywords detected — returning safety response")
            return (CRISIS_RESPONSE, True)

        # 2. Build the system prompt
        system_prompt = self._build_system_prompt(patient_context)

        # 3. Try Gemini (primary)
        if self.gemini_available:
            try:
                reply = await self._call_gemini(system_prompt, message, conversation_history)
                logger.info("✓ Response from Gemini (%d chars)", len(reply))
                return (reply, False)
            except Exception as exc:
                logger.warning("✗ Gemini failed (%s), falling back to OpenRouter...", exc)

        # 4. Fallback to OpenRouter
        if self.openrouter_available:
            try:
                reply = await self._call_openrouter(system_prompt, message, conversation_history)
                logger.info("✓ Response from OpenRouter fallback (%d chars)", len(reply))
                return (reply, False)
            except Exception as exc:
                logger.error("✗ OpenRouter fallback also failed: %s", exc)

        # 5. Both providers failed
        return (
            "I'm sorry, the AI service is temporarily unavailable. "
            "Please try again later.",
            False,
        )

    # ── Gemini Provider ──────────────────────────────────────────────────

    async def _call_gemini(
        self,
        system_prompt: str,
        message: str,
        conversation_history: Optional[List[Dict[str, str]]] = None,
    ) -> str:
        """Call Gemini 2.5 Flash via the google-generativeai SDK."""
        import google.generativeai as genai  # type: ignore

        # Build conversation contents
        contents: List[Dict[str, Any]] = []

        if conversation_history:
            for entry in conversation_history:
                role = entry.get("role", "user")
                content = entry.get("content", "")
                if content:
                    gemini_role = "model" if role == "assistant" else "user"
                    contents.append({"role": gemini_role, "parts": [content]})

        contents.append({"role": "user", "parts": [message]})

        # Create model with system instruction
        model_with_context = genai.GenerativeModel(
            model_name="gemini-2.5-flash",
            generation_config=genai.GenerationConfig(
                max_output_tokens=1000,
                temperature=0.3,
            ),
            system_instruction=system_prompt,
        )

        for attempt in range(self.MAX_RETRIES):
            try:
                response = await model_with_context.generate_content_async(contents)
                return response.text
            except Exception as exc:
                error_msg = str(exc).lower()
                if "quota" in error_msg or "rate" in error_msg or "429" in error_msg:
                    if attempt < self.MAX_RETRIES - 1:
                        logger.warning("Gemini rate limited (attempt %d), retrying...", attempt + 1)
                        await asyncio.sleep(self.RETRY_DELAY)
                        continue
                raise  # Let the caller catch and fall back

        raise Exception("Gemini: exhausted retries")

    # ── OpenRouter Provider ──────────────────────────────────────────────

    async def _call_openrouter(
        self,
        system_prompt: str,
        message: str,
        conversation_history: Optional[List[Dict[str, str]]] = None,
    ) -> str:
        """Call OpenRouter API (OpenAI-compatible) with context truncation for smaller models."""

        # Truncate system prompt for Nemotron's smaller context window
        max_prompt_len = 6000
        if len(system_prompt) > max_prompt_len:
            system_prompt = system_prompt[:max_prompt_len] + "\n...(context truncated for model limits)"

        # Build messages in OpenAI chat format
        messages: List[Dict[str, str]] = [
            {"role": "system", "content": system_prompt}
        ]

        if conversation_history:
            # Limit history to last 3 turns for smaller context window
            recent_history = conversation_history[-6:]  # 3 turns = 6 messages (user+assistant)
            for entry in recent_history:
                role = entry.get("role", "user")
                content = entry.get("content", "")
                if content:
                    messages.append({"role": role, "content": content})

        messages.append({"role": "user", "content": message})

        for attempt in range(self.MAX_RETRIES):
            try:
                async with httpx.AsyncClient(timeout=30.0) as client:
                    response = await client.post(
                        OPENROUTER_BASE_URL,
                        headers={
                            "Authorization": f"Bearer {self.settings.OPENROUTER_API_KEY}",
                            "Content-Type": "application/json",
                            "HTTP-Referer": "https://medicore-ebon.vercel.app",
                            "X-Title": "MediCore AI Health Advisor",
                        },
                        json={
                            "model": self.openrouter_model,
                            "messages": messages,
                            "max_tokens": 800,
                            "temperature": 0.3,
                        },
                    )

                if response.status_code == 200:
                    data = response.json()
                    return data["choices"][0]["message"]["content"]
                elif response.status_code == 429:
                    if attempt < self.MAX_RETRIES - 1:
                        logger.warning("OpenRouter rate limited (attempt %d), retrying...", attempt + 1)
                        await asyncio.sleep(self.RETRY_DELAY)
                        continue
                    raise HTTPException(status_code=429, detail="Rate limit exceeded on AI Service.")
                else:
                    raise Exception(f"OpenRouter API error {response.status_code}: {response.text}")

            except HTTPException:
                raise
            except httpx.TimeoutException:
                if attempt < self.MAX_RETRIES - 1:
                    logger.warning("OpenRouter timeout (attempt %d), retrying...", attempt + 1)
                    await asyncio.sleep(self.RETRY_DELAY)
                    continue
                raise

        raise Exception("OpenRouter: exhausted retries")
