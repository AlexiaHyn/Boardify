from __future__ import annotations

import asyncio
from collections import defaultdict

from fastapi import WebSocket


class ConnectionManager:
    def __init__(self) -> None:
        self._connections: dict[str, dict[str, WebSocket]] = defaultdict(dict)
        self._lock = asyncio.Lock()

    async def connect(self, game_code: str, player_id: str, websocket: WebSocket) -> None:
        await websocket.accept()
        async with self._lock:
            self._connections[game_code][player_id] = websocket

    async def disconnect(self, game_code: str, player_id: str) -> None:
        async with self._lock:
            room = self._connections.get(game_code)
            if not room:
                return
            room.pop(player_id, None)
            if not room:
                self._connections.pop(game_code, None)

    async def send_to_room(self, game_code: str, payload: dict) -> None:
        async with self._lock:
            room = list(self._connections.get(game_code, {}).values())
        for socket in room:
            await socket.send_json(payload)


connection_manager = ConnectionManager()
