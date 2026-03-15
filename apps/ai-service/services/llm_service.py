"""
MediCore AI Service — LLM Service
Handles communication with the Anthropic Claude API.
"""

from config import get_settings


class LLMService:
    """Wrapper around the Anthropic SDK for Claude interactions."""

    def __init__(self):
        self.settings = get_settings()
        self.api_key = self.settings.ANTHROPIC_API_KEY

    async def generate_response(
        self,
        system_prompt: str,
        user_message: str,
        conversation_history: list[dict] | None = None,
    ) -> str:
        """
        Send a prompt to Claude and return the response text.
        Stub — will integrate Anthropic SDK in Day 2+.
        """
        return "This is a placeholder LLM response."
