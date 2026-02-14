"""Convenience wrappers for LLM text generation.

Use these for a consistent API across providers.
"""


def generate_text_sync(model, prompt: str, system: str | None = None, **kwargs):
    """Generate text synchronously.

    Args:
        model: Model from get_model() or get_openai_model(), etc.
        prompt: User prompt
        system: Optional system message
        **kwargs: Passed to model.generate() (e.g. max_tokens)

    Returns:
        Result with .text, .usage, .finish_reason
    """
    return model.generate(prompt=prompt, system=system, **kwargs)


async def stream_text_async(model, prompt: str, system: str | None = None, **kwargs):
    """Stream text asynchronously.

    Args:
        model: Model from get_model() or provider-specific getter
        prompt: User prompt
        system: Optional system message
        **kwargs: Passed to model.stream()

    Yields:
        Text chunks from the model
    """
    async for chunk in model.stream(prompt=prompt, system=system, **kwargs):
        yield chunk
