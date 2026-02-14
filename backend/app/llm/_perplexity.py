"""Perplexity Sonar provider using OpenAI-compatible API."""

from dataclasses import dataclass

from app.config import settings


PERPLEXITY_BASE_URL = "https://api.perplexity.ai"


@dataclass
class PerplexityModel:
    model_id: str
    provider: str = "perplexity"

    def generate(self, prompt: str, system: str | None = None, **kwargs) -> "GenerateResult":
        """Generate text synchronously."""
        from openai import OpenAI

        client = OpenAI(
            api_key=settings.PERPLEXITY_API_KEY,
            base_url=PERPLEXITY_BASE_URL,
        )
        messages = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": prompt})

        resp = client.chat.completions.create(
            model=self.model_id,
            messages=messages,
            **kwargs,
        )
        choice = resp.choices[0]
        usage = resp.usage
        return GenerateResult(
            text=choice.message.content or "",
            finish_reason=choice.finish_reason or "stop",
            usage=Usage(
                prompt_tokens=usage.prompt_tokens if usage else 0,
                completion_tokens=usage.completion_tokens if usage else 0,
                total_tokens=usage.total_tokens if usage else 0,
            ),
        )

    async def stream(self, prompt: str, system: str | None = None, **kwargs):
        """Stream text asynchronously."""
        from openai import AsyncOpenAI

        client = AsyncOpenAI(
            api_key=settings.PERPLEXITY_API_KEY,
            base_url=PERPLEXITY_BASE_URL,
        )
        messages = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": prompt})

        stream = await client.chat.completions.create(
            model=self.model_id,
            messages=messages,
            stream=True,
            **kwargs,
        )
        async for chunk in stream:
            if chunk.choices and chunk.choices[0].delta.content:
                yield chunk.choices[0].delta.content


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
