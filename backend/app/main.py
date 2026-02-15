from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import games, generate, health, showcase, websocket

app = FastAPI(
    title=settings.APP_NAME,
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS middleware – allow the Next.js frontend to call the API
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Root – so GET / doesn't 404 (e.g. browser or health probes)
@app.get("/")
def root():
    return {
        "app": settings.APP_NAME,
        "docs": "/docs",
        "api": settings.API_V1_PREFIX,
    }


# Routers
app.include_router(health.router, prefix=settings.API_V1_PREFIX)
app.include_router(generate.router, prefix=settings.API_V1_PREFIX)
app.include_router(games.router, prefix=settings.API_V1_PREFIX)
app.include_router(showcase.router, prefix=settings.API_V1_PREFIX)
app.include_router(websocket.router, prefix=settings.API_V1_PREFIX)
