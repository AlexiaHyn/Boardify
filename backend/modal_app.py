"""
Boardify – Modal serverless backend.

Serves the FastAPI application through Modal's ASGI integration,
giving us serverless deployment with zero infrastructure management.

Deploy:   modal deploy backend/modal_app.py
Dev:      modal serve backend/modal_app.py
"""

import modal

# ---------------------------------------------------------------------------
# Container image
# ---------------------------------------------------------------------------
image = (
    modal.Image.debian_slim(python_version="3.11")
    .pip_install(
        "fastapi[standard]>=0.115.0",
        "openai>=1.14.0",
        "Pillow>=10.0.0",
        "pydantic>=2.10.0",
        "pydantic-settings>=2.7.0",
        "python-dotenv>=1.0.0",
    )
    .add_local_dir("app", remote_path="/root/app")
)

modal_app = modal.App("boardify", image=image)


# ---------------------------------------------------------------------------
# Serve the FastAPI app through Modal
# ---------------------------------------------------------------------------
@modal_app.function(
    secrets=[modal.Secret.from_name("openai-secret")],
    timeout=180,
)
@modal.asgi_app()
def serve():
    """Mount the full FastAPI application as a Modal ASGI app."""
    import sys
    sys.path.insert(0, "/root")

    from app.main import app
    return app
