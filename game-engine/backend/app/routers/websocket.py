"""
WebSocket endpoint for real-time game state updates.
"""
from __future__ import annotations

import json

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.services import room_manager

router = APIRouter()


@router.websocket("/ws/{room_code}/{player_id}")
async def websocket_endpoint(websocket: WebSocket, room_code: str, player_id: str):
    room_code = room_code.upper()
    await websocket.accept()

    if not room_manager.room_exists(room_code):
        await websocket.send_text(json.dumps({"type": "error", "message": "Room not found"}))
        await websocket.close()
        return

    # Register this connection
    room_manager.register_connection(room_code, player_id, websocket)

    # Mark player as connected
    state = room_manager.get_state(room_code)
    player = next((p for p in state.players if p.id == player_id), None)
    if player:
        player.isConnected = True
        room_manager.save_state(room_code, state)
        await room_manager.broadcast(room_code, {
            "type": "player_connected",
            "playerId": player_id,
            "name": player.name,
        })
    await room_manager.broadcast_state(room_code)

    try:
        while True:
            data = await websocket.receive_text()
            msg = json.loads(data)
            if msg.get("type") == "ping":
                await websocket.send_text(json.dumps({"type": "pong"}))
    except WebSocketDisconnect:
        room_manager.remove_connection(room_code, player_id)
        state = room_manager.get_state(room_code)
        if state:
            player = next((p for p in state.players if p.id == player_id), None)
            if player:
                player.isConnected = False
                room_manager.save_state(room_code, state)
                await room_manager.broadcast(room_code, {
                    "type": "player_disconnected",
                    "playerId": player_id,
                    "name": player.name,
                })
            await room_manager.broadcast_state(room_code)
