from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.services.connection_manager import connection_manager
from app.services.session_store import (
    append_action,
    end_session,
    get_session,
    leave_session,
    remove_session,
    serialize_session,
    start_session,
)
from app.services.supabase_client import save_showcase_row

router = APIRouter(tags=["websocket"])


@router.websocket("/ws/{game_code}")
async def game_websocket(websocket: WebSocket, game_code: str, player_id: str):
    normalized_code = game_code.strip().upper()
    session = await get_session(normalized_code)
    if not session:
        await websocket.close(code=1008, reason="Game not found")
        return
    if player_id not in session.players:
        await websocket.close(code=1008, reason="Unknown player")
        return

    await connection_manager.connect(normalized_code, player_id, websocket)
    await connection_manager.send_to_room(
        normalized_code,
        {"type": "session_state", "session": serialize_session(session)},
    )

    try:
        while True:
            message: dict[str, Any] = await websocket.receive_json()
            event_type = message.get("type")

            if event_type == "start_game":
                updated = await start_session(normalized_code, player_id)
                await connection_manager.send_to_room(
                    normalized_code,
                    {"type": "game_started", "session": serialize_session(updated)},
                )
                continue

            if event_type == "player_action":
                action = {
                    "player_id": player_id,
                    "payload": message.get("payload"),
                    "created_at": datetime.now(timezone.utc).isoformat(),
                }
                updated = await append_action(normalized_code, action)
                await connection_manager.send_to_room(
                    normalized_code,
                    {"type": "player_action", "action": action, "session": serialize_session(updated)},
                )
                continue

            if event_type == "end_game":
                current = await get_session(normalized_code)
                if not current:
                    continue
                caller = current.players.get(player_id)
                if not caller or not caller.is_host:
                    await websocket.send_json({"type": "error", "detail": "Only host can end game."})
                    continue

                ended = await end_session(normalized_code, status="completed")
                save_showcase_row(
                    game_code=ended.game_code,
                    game_id=ended.game_id,
                    host_person=ended.host_person,
                    game_snapshot=ended.game_snapshot,
                    status=ended.status,
                    completed_at=ended.completed_at,
                )
                await connection_manager.send_to_room(
                    normalized_code,
                    {"type": "game_ended", "session": serialize_session(ended)},
                )
                await remove_session(normalized_code)
                break

            await websocket.send_json({"type": "error", "detail": "Unsupported event type."})
    except WebSocketDisconnect:
        current, player = await leave_session(normalized_code, player_id)
        await connection_manager.disconnect(normalized_code, player_id)
        if not current or not player:
            return

        if player.is_host:
            ended = await end_session(normalized_code, status="abandoned")
            save_showcase_row(
                game_code=ended.game_code,
                game_id=ended.game_id,
                host_person=ended.host_person,
                game_snapshot=ended.game_snapshot,
                status=ended.status,
                completed_at=ended.completed_at,
            )
            await connection_manager.send_to_room(
                normalized_code,
                {"type": "game_ended", "session": serialize_session(ended)},
            )
            await remove_session(normalized_code)
            return

        latest = await get_session(normalized_code)
        if latest:
            await connection_manager.send_to_room(
                normalized_code,
                {"type": "session_state", "session": serialize_session(latest)},
            )
