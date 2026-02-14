"""Anthropic provider using official anthropic Python SDK."""

from dataclasses import dataclass

from app.config import settings


@dataclass
class AnthropicModel:
    model_id: str
    provider: str = "anthropic"

    def generate(self, prompt: str, system: str | None = None, **kwargs) -> "GenerateResult":
        """Generate text synchronously."""
        from anthropic import Anthropic

        client = Anthropic(api_key=settings.ANTHROPIC_API_KEY)
        create_kwargs = {"model": self.model_id, "max_tokens": 4096, **kwargs}
        if system:
            create_kwargs["system"] = system
        create_kwargs["messages"] = [{"role": "user", "content": prompt}]

        resp = client.messages.create(**create_kwargs)
        text = ""
        if resp.content:
            for block in resp.content:
                if hasattr(block, "text"):
                    text += block.text

        usage = resp.usage
        return GenerateResult(
            text=text,
            finish_reason=getattr(resp.stop_reason, "value", str(resp.stop_reason)) if resp.stop_reason else "end_turn",
            usage=Usage(
                prompt_tokens=usage.input_tokens,
                completion_tokens=usage.output_tokens,
                total_tokens=usage.input_tokens + usage.output_tokens,
            ),
        )

    async def stream(self, prompt: str, system: str | None = None, **kwargs):
        """Stream text asynchronously."""
        from anthropic import AsyncAnthropic

        client = AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)
        create_kwargs = {"model": self.model_id, "max_tokens": 4096, **kwargs}
        if system:
            create_kwargs["system"] = system
        create_kwargs["messages"] = [{"role": "user", "content": prompt}]

        async with client.messages.stream(**create_kwargs) as stream:
            async for text_event in stream.text_stream:
                yield text_event


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
