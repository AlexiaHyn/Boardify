"""
HTTP API routes for room management and game actions.
"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.schemas.requests import (
    ActionRequest, ActionResponse, AvailableGamesResponse,
    CreateRoomRequest, CreateRoomResponse,
    JoinRoomRequest, JoinRoomResponse,
)
from app.services import game_loader, room_manager

router = APIRouter(prefix="/api")


# ── Game catalogue ────────────────────────────────────────────────────────────

@router.get("/games", response_model=AvailableGamesResponse)
def list_games():
    """Return all available game types (discovered from JSON files)."""
    return AvailableGamesResponse(games=game_loader.list_available_games())


# ── Room lifecycle ────────────────────────────────────────────────────────────

@router.post("/rooms/create", response_model=CreateRoomResponse)
async def create_room(req: CreateRoomRequest):
    room_code = room_manager.make_room_code()
    state, host_id = game_loader.create_initial_state(
        game_type=req.game_type,
        room_code=room_code,
        host_name=req.host_name,
    )
    room_manager.create_room(room_code, state)
    return CreateRoomResponse(
        success=True,
        roomCode=room_code,
        playerId=host_id,
        gameId=state.gameId,
        gameName=state.gameName,
    )


@router.post("/rooms/{room_code}/join", response_model=JoinRoomResponse)
async def join_room(room_code: str, req: JoinRoomRequest):
    room_code = room_code.upper()
    state = room_manager.get_state(room_code)
    if state is None:
        raise HTTPException(status_code=404, detail="Room not found")

    ok, error, player_id = game_loader.add_player_to_state(state, req.player_name)
    if not ok:
        raise HTTPException(status_code=400, detail=error)

    room_manager.save_state(room_code, state)
    await room_manager.broadcast_state(room_code)

    return JoinRoomResponse(
        success=True,
        playerId=player_id,
        roomCode=room_code,
        gameName=state.gameName,
    )


@router.post("/rooms/{room_code}/start")
async def start_room(room_code: str, player_id: str):
    room_code = room_code.upper()
    state = room_manager.get_state(room_code)
    if state is None:
        raise HTTPException(status_code=404, detail="Room not found")
    if state.metadata.get("hostId") != player_id:
        raise HTTPException(status_code=403, detail="Only the host can start the game")

    ok, error = game_loader.start_game(state)
    if not ok:
        raise HTTPException(status_code=400, detail=error)

    room_manager.save_state(room_code, state)
    await room_manager.broadcast_state(room_code)
    return {"success": True}


@router.post("/rooms/{room_code}/action", response_model=ActionResponse)
async def room_action(room_code: str, action: ActionRequest):
    room_code = room_code.upper()
    state = room_manager.get_state(room_code)
    if state is None:
        raise HTTPException(status_code=404, detail="Room not found")
    if state.phase not in ("playing", "awaiting_response"):
        raise HTTPException(status_code=400, detail="Game is not in progress")

    # Load universal engine + game plugin (plugin used inside apply_action)
    engine, plugin = game_loader._get_engine_and_plugin(
        state.gameType,
        state.metadata.get("gameConfig", {})
    )
    success, error, triggered = engine.apply_action(state, action)
    if not success:
        raise HTTPException(status_code=400, detail=error)

    room_manager.save_state(room_code, state)
    await room_manager.broadcast_state(room_code)
    return ActionResponse(success=True, triggeredEffects=triggered)


@router.get("/rooms/{room_code}/state")
def get_room_state(room_code: str):
    room_code = room_code.upper()
    state = room_manager.get_state(room_code)
    if state is None:
        raise HTTPException(status_code=404, detail="Room not found")
    return {"success": True, "state": state.dict()}
