from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4


@dataclass
class Player:
    player_id: str
    name: str
    is_host: bool = False
    joined_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))


@dataclass
class GameSession:
    game_code: str
    game_id: str
    host_person: str
    game_snapshot: dict[str, Any]
    status: str = "lobby"
    started: bool = False
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    completed_at: datetime | None = None
    players: dict[str, Player] = field(default_factory=dict)
    action_log: list[dict[str, Any]] = field(default_factory=list)


def new_player(name: str, *, is_host: bool = False) -> Player:
    return Player(player_id=str(uuid4()), name=name, is_host=is_host)
