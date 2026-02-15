"""
RoomManager – holds in-memory room state and WebSocket connections.
Provides broadcast helpers used by both HTTP and WebSocket routes.
"""
from __future__ import annotations

import json
import random
import string
from typing import Dict

from fastapi import WebSocket

from app.models.game import GameState, Player


# ── In-memory stores ──────────────────────────────────────────────────────────

# ROOMS[room_code] = {"state": dict}  (serialised GameState)
ROOMS: Dict[str, Dict] = {}

# ROOM_CONNECTIONS[room_code][player_id] = WebSocket
ROOM_CONNECTIONS: Dict[str, Dict[str, WebSocket]] = {}


# ── Room code ─────────────────────────────────────────────────────────────────

def make_room_code() -> str:
    chars = string.ascii_uppercase + string.digits
    code = "".join(random.choices(chars, k=6))
    while code in ROOMS:
        code = "".join(random.choices(chars, k=6))
    return code


# ── State helpers ─────────────────────────────────────────────────────────────

def get_state(room_code: str) -> GameState | None:
    raw = ROOMS.get(room_code)
    if raw is None:
        return None
    return GameState(**raw["state"])


def save_state(room_code: str, state: GameState):
    ROOMS[room_code]["state"] = state.dict()


def room_exists(room_code: str) -> bool:
    return room_code in ROOMS


def create_room(room_code: str, state: GameState):
    ROOMS[room_code] = {"state": state.dict()}
    ROOM_CONNECTIONS[room_code] = {}


# ── WebSocket helpers ─────────────────────────────────────────────────────────

def register_connection(room_code: str, player_id: str, ws: WebSocket):
    if room_code not in ROOM_CONNECTIONS:
        ROOM_CONNECTIONS[room_code] = {}
    ROOM_CONNECTIONS[room_code][player_id] = ws


def remove_connection(room_code: str, player_id: str):
    ROOM_CONNECTIONS.get(room_code, {}).pop(player_id, None)


async def broadcast(room_code: str, message: dict):
    """Send a raw message to all connected players."""
    dead = []
    for pid, ws in list(ROOM_CONNECTIONS.get(room_code, {}).items()):
        try:
            await ws.send_text(json.dumps(message))
        except Exception:
            dead.append(pid)
    for pid in dead:
        remove_connection(room_code, pid)


async def broadcast_state(room_code: str):
    """Send per-player state views (with masked hands and available actions) to all connected players."""
    state = get_state(room_code)
    if state is None:
        return

    # Import here to avoid circular dependency
    from app.services.engines import universal

    for pid in list(ROOM_CONNECTIONS.get(room_code, {}).keys()):
        ws = ROOM_CONNECTIONS[room_code].get(pid)
        if not ws:
            continue

        view = state.dict()

        # Add available default actions for this specific player
        available_actions = universal.get_available_default_actions(state, pid)
        view["availableActions"] = available_actions

        # Mask other players' hands
        for p in view["players"]:
            if p["id"] != pid:
                p["hand"]["cards"] = [_hidden_card() for _ in p["hand"]["cards"]]
                p["isLocalPlayer"] = False
            else:
                p["isLocalPlayer"] = True

        try:
            await ws.send_text(json.dumps({"type": "state_update", "state": view}))
        except Exception:
            remove_connection(room_code, pid)


def _hidden_card() -> dict:
    return {
        "id": "hidden",
        "definitionId": "hidden",
        "name": "Hidden",
        "type": "hidden",
        "subtype": "hidden",
        "emoji": "🂠",
        "description": "",
        "effects": [],
        "isPlayable": False,
        "isReaction": False,
        "metadata": {},
    }
