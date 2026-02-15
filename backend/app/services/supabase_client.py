from __future__ import annotations

from datetime import datetime
from typing import Any

from app.config import settings

try:
    from supabase import Client, create_client
except Exception:  # pragma: no cover - dependency may not be installed in all envs yet
    Client = Any  # type: ignore[misc,assignment]
    create_client = None  # type: ignore[assignment]


def _get_client() -> Client | None:
    if not settings.SUPABASE_URL or not settings.SUPABASE_SERVICE_ROLE_KEY:
        return None
    if create_client is None:
        return None
    return create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)


def save_showcase_row(
    *,
    game_code: str,
    game_id: str,
    host_person: str,
    game_snapshot: dict[str, Any],
    status: str,
    completed_at: datetime | None,
) -> bool:
    client = _get_client()
    if not client:
        print("[showcase] Supabase not configured; skipping showcase persistence.")
        return False

    payload: dict[str, Any] = {
        "game_code": game_code,
        "game_id": game_id,
        "host_person": host_person,
        "game_snapshot": game_snapshot,
        "status": status,
        "completed_at": completed_at.isoformat() if completed_at else None,
    }
    client.table("game_showcases").insert(payload).execute()
    return True


def list_showcase_rows(limit: int = 50) -> list[dict[str, Any]]:
    client = _get_client()
    if not client:
        return []
    response = (
        client.table("game_showcases")
        .select("id,game_code,game_id,host_person,game_snapshot,status,created_at,completed_at")
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
    )
    return list(response.data or [])
