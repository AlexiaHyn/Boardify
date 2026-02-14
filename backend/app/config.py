from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    APP_NAME: str = "Boardify API"
    DEBUG: bool = False
    API_V1_PREFIX: str = "/api/v1"

    # CORS (comma-separated in .env, e.g. CORS_ORIGINS=http://localhost:3000,http://localhost:3001)
    CORS_ORIGINS: str = "http://localhost:3000"

    @property
    def cors_origins_list(self) -> list[str]:
        """Parse CORS_ORIGINS comma-separated string into a list."""
        return [x.strip() for x in self.CORS_ORIGINS.split(",") if x.strip()]

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
