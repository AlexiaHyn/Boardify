"""
HTTP API routes for room management, game actions, and AI game generation.
"""
from __future__ import annotations

import asyncio
import json

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse

from app.schemas.requests import (
    ActionRequest, ActionResponse, AvailableGamesResponse,
    CreateRoomRequest, CreateRoomResponse,
    GenerateGameRequest, GenerateGameResponse,
    JoinRoomRequest, JoinRoomResponse,
)
from app.services import game_loader, room_manager

router = APIRouter(prefix="/api")


# ── Game catalogue ────────────────────────────────────────────────────────────

@router.get("/games", response_model=AvailableGamesResponse)
def list_games():
    """Return all available game types (discovered from JSON files)."""
    return AvailableGamesResponse(games=game_loader.list_available_games())


# ── AI game generation ────────────────────────────────────────────────────────

@router.post("/games/generate")
async def generate_game(req: GenerateGameRequest, request: Request):
    """
    Generate a new card game definition using AI.

    Returns a Server-Sent Events (SSE) stream so Cloudflare / reverse proxies
    don't time out on the long-running pipeline.  Each SSE message is either a
    ``progress`` event (with step + message) or a final ``result`` event that
    carries the full GenerateGameResponse JSON.
    """
    from app.services import game_generator

    queue: asyncio.Queue[dict | None] = asyncio.Queue()
    loop = asyncio.get_event_loop()

    def on_progress(step: str, message: str) -> None:
        """Thread-safe callback that pushes into the asyncio queue."""
        loop.call_soon_threadsafe(
            queue.put_nowait,
            {"event": "progress", "data": {"step": step, "message": message}},
        )

    async def event_stream():
        # Immediately yield a comment so Starlette flushes the response
        # headers and Cloudflare sees the first byte within milliseconds.
        yield ": stream-start\n\n"

        # Kick off the synchronous Modal pipeline in a worker thread.
        task = asyncio.ensure_future(
            asyncio.to_thread(game_generator.generate_game, req.game_name, on_progress)
        )

        # Yield progress events as they arrive, plus a keepalive comment
        # every 15 s so Cloudflare never considers the connection idle.
        while not task.done():
            # Check for client disconnect
            if await request.is_disconnected():
                task.cancel()
                return

            try:
                msg = await asyncio.wait_for(queue.get(), timeout=15.0)
                yield f"event: progress\ndata: {json.dumps(msg['data'])}\n\n"
            except asyncio.TimeoutError:
                # SSE keepalive comment (ignored by EventSource clients)
                yield ": keepalive\n\n"

        # Drain any remaining progress messages
        while not queue.empty():
            msg = queue.get_nowait()
            yield f"event: progress\ndata: {json.dumps(msg['data'])}\n\n"

        # Build and emit the final result
        result = task.result()
        response = GenerateGameResponse(
            success=result.get("success", False),
            game_id=result.get("game_id", ""),
            game_name=result.get("game_name", ""),
            description=result.get("description", ""),
            message=result.get("message", result.get("error", "")),
            errors=result.get("errors", []),
            warnings=result.get("warnings", []),
        )
        yield f"event: result\ndata: {response.model_dump_json()}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",       # Nginx: don't buffer SSE
        },
    )


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
