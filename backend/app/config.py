from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    APP_NAME: str = "Boardify API"
    DEBUG: bool = False
    API_V1_PREFIX: str = "/api/v1"

    # CORS – Modal endpoints get a *.modal.run domain; include it alongside localhost
    CORS_ORIGINS: list[str] = [
        "http://localhost:3000",
        "https://*.modal.run",
    ]

    # Perplexity – injected by Modal Secret at runtime
    PERPLEXITY_API_KEY: str = ""
    SUPABASE_URL: str = ""
    SUPABASE_SERVICE_ROLE_KEY: str = ""

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
