from __future__ import annotations

import asyncio
import random
import string
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from app.models.game_session import GameSession, Player, new_player

GAME_CODE_LENGTH = 6
MAX_CODE_ATTEMPTS = 20

_sessions: dict[str, GameSession] = {}
_lock = asyncio.Lock()


def _generate_game_code() -> str:
    alphabet = string.ascii_uppercase + string.digits
    return "".join(random.choice(alphabet) for _ in range(GAME_CODE_LENGTH))


def _is_valid_game_code(game_code: str) -> bool:
    return len(game_code) == GAME_CODE_LENGTH and game_code.isalnum()


async def create_session(host_person: str, game_snapshot: dict[str, Any]) -> tuple[GameSession, Player]:
    if not host_person.strip():
        raise ValueError("Host person cannot be empty.")
    if not isinstance(game_snapshot, dict):
        raise ValueError("Game snapshot must be a JSON object.")

    async with _lock:
        game_code = ""
        for _ in range(MAX_CODE_ATTEMPTS):
            candidate = _generate_game_code()
            if candidate not in _sessions:
                game_code = candidate
                break
        if not game_code:
            raise RuntimeError("Unable to allocate a unique game code.")

        game_id = str(uuid4())
        host_player = new_player(host_person.strip(), is_host=True)
        session = GameSession(
            game_code=game_code,
            game_id=game_id,
            host_person=host_person.strip(),
            game_snapshot=game_snapshot,
            players={host_player.player_id: host_player},
        )
        _sessions[game_code] = session
        return session, host_player


async def get_session(game_code: str) -> GameSession | None:
    async with _lock:
        return _sessions.get(game_code.upper())


async def join_session(game_code: str, player_name: str) -> tuple[GameSession, Player]:
    normalized_code = game_code.strip().upper()
    if not _is_valid_game_code(normalized_code):
        raise ValueError("Game code must be 6 alphanumeric characters.")
    if not player_name.strip():
        raise ValueError("Player name cannot be empty.")

    async with _lock:
        session = _sessions.get(normalized_code)
        if not session:
            raise KeyError("Game not found.")

        player = new_player(player_name.strip(), is_host=False)
        session.players[player.player_id] = player
        return session, player


async def leave_session(game_code: str, player_id: str) -> tuple[GameSession | None, Player | None]:
    async with _lock:
        session = _sessions.get(game_code.upper())
        if not session:
            return None, None
        player = session.players.pop(player_id, None)
        return session, player


async def start_session(game_code: str, player_id: str) -> GameSession:
    async with _lock:
        session = _sessions.get(game_code.upper())
        if not session:
            raise KeyError("Game not found.")
        player = session.players.get(player_id)
        if not player or not player.is_host:
            raise PermissionError("Only the host can start the game.")

        session.started = True
        session.status = "active"
        return session


async def append_action(game_code: str, action: dict[str, Any]) -> GameSession:
    async with _lock:
        session = _sessions.get(game_code.upper())
        if not session:
            raise KeyError("Game not found.")
        session.action_log.append(action)
        return session


async def end_session(game_code: str, *, status: str) -> GameSession:
    async with _lock:
        session = _sessions.get(game_code.upper())
        if not session:
            raise KeyError("Game not found.")
        session.status = status
        session.completed_at = datetime.now(timezone.utc)
        return session


async def remove_session(game_code: str) -> None:
    async with _lock:
        _sessions.pop(game_code.upper(), None)


def serialize_session(session: GameSession) -> dict[str, Any]:
    return {
        "game_code": session.game_code,
        "game_id": session.game_id,
        "host_person": session.host_person,
        "status": session.status,
        "started": session.started,
        "created_at": session.created_at.isoformat(),
        "completed_at": session.completed_at.isoformat() if session.completed_at else None,
        "players": [
            {
                "player_id": player.player_id,
                "name": player.name,
                "is_host": player.is_host,
            }
            for player in session.players.values()
        ],
    }
