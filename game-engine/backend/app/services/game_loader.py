"""
GameLoader – reads game definition JSON files and constructs the initial
GameState, card deck, and rules.  Adding a new card game requires only
dropping a new JSON file into the /games directory.
"""
from __future__ import annotations

import json
import os
import random
import uuid
from pathlib import Path
from typing import Any, Dict, List, Optional

from app.models.game import (
    Card, CardDefinition, CardEffect, GameRules, GameState,
    Hand, LogEntry, Player, SpecialRule, TurnPhase,
    TurnStructure, WinCondition, Zone,
)

GAMES_DIR = Path(__file__).parent.parent / "games"

PLAYER_EMOJIS = ["🐱", "🐶", "🦊", "🐻", "🐼", "🐯", "🦁", "🐮"]


# ── Utility ───────────────────────────────────────────────────────────────────

def _ts() -> int:
    from datetime import datetime
    return int(datetime.now().timestamp() * 1000)


def _log(message: str, type_: str = "system",
         player_id: str = None, card_id: str = None) -> LogEntry:
    return LogEntry(
        id=str(uuid.uuid4()),
        timestamp=_ts(),
        message=message,
        type=type_,
        playerId=player_id,
        cardId=card_id,
    )


# ── JSON → model helpers ──────────────────────────────────────────────────────

def _load_json(game_type: str) -> Dict[str, Any]:
    path = GAMES_DIR / f"{game_type}.json"
    if not path.exists():
        raise FileNotFoundError(f"Game definition not found: {path}")
    with open(path) as f:
        return json.load(f)


def _parse_card_definitions(raw: List[Dict]) -> List[CardDefinition]:
    defs = []
    for d in raw:
        effects = [CardEffect(**e) for e in d.get("effects", [])]
        defs.append(CardDefinition(
            id=d["id"],
            name=d["name"],
            type=d["type"],
            subtype=d.get("subtype", d["id"]),
            emoji=d.get("emoji"),
            description=d.get("description", ""),
            effects=effects,
            isPlayable=d.get("isPlayable", True),
            isReaction=d.get("isReaction", False),
            count=d.get("count", 1),
            metadata=d.get("metadata", {}),
        ))
    return defs


def _parse_rules(raw: Dict) -> GameRules:
    ts_raw = raw["turnStructure"]
    phases = [TurnPhase(**p) for p in ts_raw["phases"]]
    turn_structure = TurnStructure(
        phases=phases,
        canPassTurn=ts_raw.get("canPassTurn", False),
        mustPlayCard=ts_raw.get("mustPlayCard", False),
        drawCount=ts_raw.get("drawCount", 1),
    )
    win_condition = WinCondition(**raw["winCondition"])
    special_rules = [SpecialRule(**sr) for sr in raw.get("specialRules", [])]
    return GameRules(
        minPlayers=raw["minPlayers"],
        maxPlayers=raw["maxPlayers"],
        handSize=raw["handSize"],
        turnStructure=turn_structure,
        winCondition=win_condition,
        specialRules=special_rules,
    )


# ── Deck building ─────────────────────────────────────────────────────────────

def build_deck_from_definitions(
    card_defs: List[CardDefinition],
    exclude_ids: Optional[List[str]] = None,
) -> List[Card]:
    """Build a flat list of Card instances from definitions, respecting count."""
    exclude = set(exclude_ids or [])
    deck: List[Card] = []
    for defn in card_defs:
        if defn.id in exclude:
            continue
        for i in range(defn.count):
            deck.append(Card(
                id=f"{defn.id}_{i}",
                definitionId=defn.id,
                name=defn.name,
                type=defn.type,
                subtype=defn.subtype or defn.id,
                emoji=defn.emoji,
                description=defn.description,
                effects=defn.effects,
                isPlayable=defn.isPlayable,
                isReaction=defn.isReaction,
                metadata=defn.metadata.copy(),
            ))
    return deck


# ── Public API ────────────────────────────────────────────────────────────────

def list_available_games() -> List[Dict[str, str]]:
    result = []
    for path in GAMES_DIR.glob("*.json"):
        try:
            data = json.loads(path.read_text())
            result.append({"id": path.stem, "name": data.get("name", path.stem)})
        except Exception:
            pass
    return result


def create_initial_state(game_type: str, room_code: str, host_name: str) -> tuple[GameState, str]:
    """
    Create a lobby-phase GameState for the given game type.
    Returns (state, host_player_id).
    """
    data = _load_json(game_type)
    rules = _parse_rules(data["rules"])

    host_id = str(uuid.uuid4())
    host = Player(
        id=host_id,
        name=host_name,
        emoji=PLAYER_EMOJIS[0],
        status="waiting",
        hand=Hand(playerId=host_id, cards=[], isVisible=True),
        metadata={"isHost": True},
    )

    state = GameState(
        gameId=str(uuid.uuid4()),
        roomCode=room_code,
        gameName=data["name"],
        gameType=game_type,
        phase="lobby",
        players=[host],
        zones=[],
        rules=rules,
        log=[_log(f"🏠 Room {room_code} created by {host_name}.", "system")],
        metadata={
            "hostId": host_id,
            "cardDefinitions": data["cards"],   # store raw defs for use during start_game
            "gameConfig": data.get("config", {}),
        },
    )
    return state, host_id


def add_player_to_state(state: GameState, player_name: str) -> tuple[bool, str, str]:
    """
    Add a new player to a lobby state.
    Returns (success, error_message, player_id).
    """
    if state.phase != "lobby":
        return False, "Game already started", ""
    if len(state.players) >= state.rules.maxPlayers:
        return False, f"Room is full (max {state.rules.maxPlayers} players)", ""
    existing = {p.name.lower() for p in state.players}
    if player_name.lower() in existing:
        return False, "Name already taken in this room", ""

    player_id = str(uuid.uuid4())
    player = Player(
        id=player_id,
        name=player_name,
        emoji=PLAYER_EMOJIS[len(state.players) % len(PLAYER_EMOJIS)],
        status="waiting",
        hand=Hand(playerId=player_id, cards=[], isVisible=True),
        metadata={"isHost": False},
    )
    state.players.append(player)
    state.log.append(_log(f"👋 {player_name} joined!", "system"))
    return True, "", player_id


def start_game(state: GameState) -> tuple[bool, str]:
    """
    Deal cards, set up zones, and transition to 'playing'.
    The specific deal logic is delegated to the game's engine module.
    Returns (success, error_message).
    """
    if len(state.players) < state.rules.minPlayers:
        return False, f"Need at least {state.rules.minPlayers} players"
    if state.phase != "lobby":
        return False, "Game already started"

    # Import game-specific engine dynamically
    engine = _get_engine(state.gameType)
    engine.setup_game(state)
    return True, ""


def _get_engine(game_type: str):
    """
    Dynamically import the game-specific engine module.
    Resolution order:
      1. app.services.engines.<game_type>   (hand-written engine, e.g. exploding_kittens.py)
      2. app.services.engines.universal      (data-driven engine — works for any JSON game)
      3. app.services.engines.generic        (legacy minimal fallback)
    """
    import importlib
    try:
        return importlib.import_module(f"app.services.engines.{game_type}")
    except ModuleNotFoundError:
        pass
    try:
        return importlib.import_module("app.services.engines.universal")
    except ModuleNotFoundError:
        return importlib.import_module("app.services.engines.generic")
