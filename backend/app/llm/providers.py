"""LLM provider connections using official Python SDKs.

Provides a unified interface compatible with AI SDK patterns.
Each provider reads API keys from environment variables (via app.config.settings).
"""

from typing import Protocol

from app.config import settings


class LLMModel(Protocol):
    """Protocol for model-like objects returned by get_*_model."""

    provider: str
    model_id: str


def get_openai_model(model_id: str | None = None) -> "OpenAIModel":
    """Get an OpenAI model instance.

    Requires OPENAI_API_KEY in environment.
    """
    from app.llm._openai import OpenAIModel

    model = model_id or settings.DEFAULT_OPENAI_MODEL
    return OpenAIModel(model_id=model)


def get_anthropic_model(model_id: str | None = None) -> "AnthropicModel":
    """Get an Anthropic Claude model instance.

    Requires ANTHROPIC_API_KEY in environment.
    """
    from app.llm._anthropic import AnthropicModel

    model = model_id or settings.DEFAULT_ANTHROPIC_MODEL
    return AnthropicModel(model_id=model)


def get_gemini_model(model_id: str | None = None) -> "GeminiModel":
    """Get a Google Gemini model instance.

    Requires GOOGLE_GENERATIVE_AI_API_KEY in environment.
    """
    from app.llm._gemini import GeminiModel

    model = model_id or settings.DEFAULT_GEMINI_MODEL
    return GeminiModel(model_id=model)


def get_perplexity_model(model_id: str | None = None) -> "PerplexityModel":
    """Get a Perplexity Sonar model instance.

    Requires PERPLEXITY_API_KEY in environment.
    Uses OpenAI-compatible API at api.perplexity.ai.
    Models: sonar, sonar-pro, sonar-pro-search, etc.
    """
    from app.llm._perplexity import PerplexityModel

    model = model_id or settings.DEFAULT_PERPLEXITY_MODEL
    return PerplexityModel(model_id=model)


_PROVIDER_REGISTRY = {
    "openai": get_openai_model,
    "anthropic": get_anthropic_model,
    "gemini": get_gemini_model,
    "perplexity": get_perplexity_model,
}


def get_model(provider: str, model_id: str | None = None) -> LLMModel:
    """Get a model instance by provider name.

    Args:
        provider: One of "openai", "anthropic", "gemini", "perplexity"
        model_id: Optional model override (e.g. "gpt-4o", "claude-3-opus-20240229")

    Returns:
        Model instance with .generate() and .stream() methods

    Raises:
        ValueError: If provider is not supported
    """
    provider = provider.lower()
    if provider not in _PROVIDER_REGISTRY:
        raise ValueError(
            f"Unknown provider: {provider}. Supported: {list(_PROVIDER_REGISTRY.keys())}"
        )
    return _PROVIDER_REGISTRY[provider](model_id)
