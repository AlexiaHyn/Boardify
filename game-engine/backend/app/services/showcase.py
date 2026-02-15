"""
Push games to Supabase game_showcases for the showcase page.
- Insert when game starts (status='in_progress'); update to status='completed' when game ends.
"""
from __future__ import annotations

import os
import logging
from datetime import datetime, timezone
from typing import Set

from app.models.game import GameState

# Avoid duplicate updates for the same room when game has ended
_ended_rooms: Set[str] = set()
logger = logging.getLogger(__name__)


def _get_supabase():
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("SUPABASE_ANON_KEY")
    if not url or not key:
        return None
    try:
        from supabase import create_client
        return create_client(url, key)
    except Exception:
        return None


def _host_name(state: GameState) -> str:
    host_id = (state.metadata or {}).get("hostId")
    if not host_id:
        return "Unknown"
    for p in state.players:
        if p.id == host_id:
            return p.name
    return "Unknown"


def record_game_started(room_code: str, state: GameState) -> bool:
    """Insert this game into public.game_showcases when it starts (status='in_progress')."""
    sb = _get_supabase()
    if not sb:
        logger.warning("showcase start skipped: Supabase not configured")
        return False
    try:
        row = {
            "game_code": room_code,
            "game_id": state.gameId,
            "host_person": _host_name(state),
            "game_snapshot": state.dict(),
            "status": "in_progress",
            "completed_at": None,
        }
        sb.table("game_showcases").insert(row).execute()
        logger.info("showcase start inserted: room=%s", room_code)
        return True
    except Exception as e:
        logger.exception("showcase start insert failed: room=%s error=%s", room_code, e)
        return False


def record_game_ended(room_code: str, state: GameState, status: str = "completed") -> bool:
    """Update the game_showcases row for this room to status='completed' when the game ends."""
    if room_code in _ended_rooms:
        logger.info("showcase end skipped (already updated): room=%s", room_code)
        return False
    sb = _get_supabase()
    if not sb:
        logger.warning("showcase end skipped: Supabase not configured")
        return False
    if state.phase != "ended" and status == "completed":
        logger.info("showcase end skipped: room=%s phase=%s", room_code, state.phase)
        return False
    try:
        sb.table("game_showcases").update({
            "status": status,
            "completed_at": datetime.now(timezone.utc).isoformat(),
            "game_snapshot": state.dict(),
        }).eq("game_code", room_code).execute()
        _ended_rooms.add(room_code)
        logger.info("showcase end updated: room=%s status=%s", room_code, status)
        return True
    except Exception as e:
        logger.exception("showcase end update failed: room=%s error=%s", room_code, e)
        return False
