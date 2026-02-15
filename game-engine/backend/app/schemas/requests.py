"""
API request/response schemas (distinct from domain models).
"""
from typing import Any, Dict, List, Optional
from pydantic import BaseModel


# ── Requests ──────────────────────────────────────────────────────────────────

class CreateRoomRequest(BaseModel):
    host_name: str
    game_type: str = "exploding_kittens"   # which game JSON to load


class JoinRoomRequest(BaseModel):
    player_name: str


class StartRoomRequest(BaseModel):
    player_id: str


class ActionRequest(BaseModel):
    type: str                                   # draw_card | play_card | respond_nope | select_target | etc.
    playerId: str
    cardId: Optional[str] = None
    targetPlayerId: Optional[str] = None
    metadata: Dict[str, Any] = {}              # extra payload (insert_position, etc.)


# ── Responses ─────────────────────────────────────────────────────────────────

class CreateRoomResponse(BaseModel):
    success: bool
    roomCode: str
    playerId: str
    gameId: str
    gameName: str


class JoinRoomResponse(BaseModel):
    success: bool
    playerId: str
    roomCode: str
    gameName: str


class ActionResponse(BaseModel):
    success: bool
    triggeredEffects: List[str] = []
    message: str = ""


class AvailableGamesResponse(BaseModel):
    games: List[Dict[str, str]]   # [{"id": "exploding_kittens", "name": "Exploding Kittens"}]
