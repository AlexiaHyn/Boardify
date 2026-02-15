"""
Card Game Engine – FastAPI entry point.
Generic: load any card game by pointing at its JSON definition.
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import rooms, websocket

app = FastAPI(
    title="Card Game Engine API",
    description="Generic multiplayer card game engine. Load any card game via JSON.",
    version="3.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(rooms.router)
app.include_router(websocket.router)


@app.get("/health")
def health():
    from app.services.room_manager import ROOMS
    return {"status": "ok", "active_rooms": len(ROOMS)}
