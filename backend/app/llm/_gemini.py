"""Google Gemini provider using official google-generativeai Python SDK."""

import asyncio
from dataclasses import dataclass

from app.config import settings


@dataclass
class GeminiModel:
    model_id: str
    provider: str = "gemini"

    def generate(self, prompt: str, system: str | None = None, **kwargs) -> "GenerateResult":
        """Generate text synchronously."""
        import google.generativeai as genai

        genai.configure(api_key=settings.GOOGLE_GENERATIVE_AI_API_KEY)
        model = genai.GenerativeModel(self.model_id)

        full_prompt = prompt
        if system:
            full_prompt = f"{system}\n\n{prompt}"

        resp = model.generate_content(full_prompt, **kwargs)
        text = resp.text if resp.text else ""

        usage = getattr(resp, "usage_metadata", None)
        return GenerateResult(
            text=text,
            finish_reason=getattr(resp.candidates[0], "finish_reason", "stop") if resp.candidates else "stop",
            usage=Usage(
                prompt_tokens=usage.prompt_token_count if usage else 0,
                completion_tokens=usage.candidates_token_count if usage else 0,
                total_tokens=(usage.prompt_token_count + usage.candidates_token_count) if usage else 0,
            ),
        )

    async def stream(self, prompt: str, system: str | None = None, **kwargs):
        """Stream text asynchronously (runs sync API in executor)."""
        import google.generativeai as genai

        genai.configure(api_key=settings.GOOGLE_GENERATIVE_AI_API_KEY)
        model = genai.GenerativeModel(self.model_id)

        full_prompt = prompt
        if system:
            full_prompt = f"{system}\n\n{prompt}"

        def _sync_stream():
            resp = model.generate_content(full_prompt, stream=True, **kwargs)
            for chunk in resp:
                if chunk.text:
                    yield chunk.text

        loop = asyncio.get_event_loop()
        gen = _sync_stream()
        while True:
            try:
                chunk = await loop.run_in_executor(None, lambda g=gen: next(g, StopIteration))
            except StopIteration:
                break
            if chunk is StopIteration:
                break
            yield chunk


@dataclass
class Usage:
    prompt_tokens: int
    completion_tokens: int
    total_tokens: int


@dataclass
class GenerateResult:
    text: str
    finish_reason: str
    usage: Usage
