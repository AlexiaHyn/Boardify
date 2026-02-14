"""
Entry point for the Card Game API.
Run with:  uvicorn main:app --reload --port 8000
"""

from app.main import app  # noqa: F401  — re-exported for uvicorn

__all__ = ["app"]