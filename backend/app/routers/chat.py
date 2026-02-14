"""Example chat router using LLM connections."""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.config import settings
from app.llm import get_model, generate_text_sync

router = APIRouter(prefix="/chat", tags=["chat"])


class ChatRequest(BaseModel):
    prompt: str
    provider: str = "openai"
    model_id: str | None = None


class ChatResponse(BaseModel):
    text: str
    provider: str
    model: str


@router.post("", response_model=ChatResponse)
def chat(request: ChatRequest):
    """Generate text using the specified LLM provider."""
    provider = request.provider.lower()
    if provider not in ("openai", "anthropic", "gemini", "perplexity"):
        raise HTTPException(400, f"Unknown provider: {provider}")

    # Check API key is configured
    key_map = {
        "openai": settings.OPENAI_API_KEY,
        "anthropic": settings.ANTHROPIC_API_KEY,
        "gemini": settings.GOOGLE_GENERATIVE_AI_API_KEY,
        "perplexity": settings.PERPLEXITY_API_KEY,
    }
    if not key_map.get(provider):
        raise HTTPException(
            503,
            f"Provider {provider} is not configured. Set the API key in .env",
        )

    model = get_model(provider, request.model_id)
    result = generate_text_sync(model, prompt=request.prompt)

    default_models = {
        "openai": settings.DEFAULT_OPENAI_MODEL,
        "anthropic": settings.DEFAULT_ANTHROPIC_MODEL,
        "gemini": settings.DEFAULT_GEMINI_MODEL,
        "perplexity": settings.DEFAULT_PERPLEXITY_MODEL,
    }
    return ChatResponse(
        text=result.text,
        provider=provider,
        model=request.model_id or default_models[provider],
    )
