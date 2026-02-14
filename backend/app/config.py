from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    APP_NAME: str = "Boardify API"
    DEBUG: bool = False
    API_V1_PREFIX: str = "/api/v1"

    # CORS
    CORS_ORIGINS: list[str] = ["http://localhost:3000"]

    # LLM API Keys (set in .env; only required for providers you use)
    OPENAI_API_KEY: str | None = None
    ANTHROPIC_API_KEY: str | None = None
    GOOGLE_GENERATIVE_AI_API_KEY: str | None = None
    PERPLEXITY_API_KEY: str | None = None

    # Default model per provider (optional overrides)
    DEFAULT_OPENAI_MODEL: str = "gpt-4o-mini"
    DEFAULT_ANTHROPIC_MODEL: str = "claude-3-5-haiku-20241022"
    DEFAULT_GEMINI_MODEL: str = "gemini-1.5-flash"
    DEFAULT_PERPLEXITY_MODEL: str = "sonar"

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
