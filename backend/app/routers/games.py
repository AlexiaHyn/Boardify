from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.services.session_store import (
    create_session,
    get_session,
    join_session,
    serialize_session,
)

router = APIRouter(prefix="/games", tags=["games"])


class CreateGameRequest(BaseModel):
    host_person: str
    game_snapshot: dict[str, Any]


class JoinGameRequest(BaseModel):
    game_code: str
    player_name: str


@router.post("/create")
async def create_game(body: CreateGameRequest):
    try:
        session, host_player = await create_session(body.host_person, body.game_snapshot)
        print(f"[games] created session game_code={session.game_code} host={session.host_person}")
        return {
            "game_code": session.game_code,
            "game_id": session.game_id,
            "player_id": host_player.player_id,
            "session": serialize_session(session),
        }
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc))


@router.post("/join")
async def join_game(body: JoinGameRequest):
    try:
        session, player = await join_session(body.game_code, body.player_name)
        print(f"[games] player joined game_code={session.game_code} player={player.name}")
        return {
            "game_code": session.game_code,
            "game_id": session.game_id,
            "player_id": player.player_id,
            "session": serialize_session(session),
        }
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


@router.get("/{game_code}/status")
async def game_status(game_code: str):
    session = await get_session(game_code)
    if not session:
        raise HTTPException(status_code=404, detail="Game not found.")
    return serialize_session(session)
