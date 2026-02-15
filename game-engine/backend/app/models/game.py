"""
Core domain models for the generic card game engine.
These models are game-agnostic; specific game data is loaded from JSON.
"""
from __future__ import annotations
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


# ── Card models ───────────────────────────────────────────────────────────────

class CardEffect(BaseModel):
    type: str
    value: Optional[int] = None
    target: Optional[str] = None        # self | others | choose | all
    description: str
    metadata: Dict[str, Any] = {}


class CardDefinition(BaseModel):
    """Template for a card type, loaded from game JSON."""
    id: str                             # unique key, e.g. "attack"
    name: str
    type: str                           # action | defense | reaction | special | combo
    subtype: Optional[str] = None
    emoji: Optional[str] = None
    description: str
    effects: List[CardEffect]
    isPlayable: bool = True
    isReaction: bool = False            # can be played out of turn (e.g. Nope)
    count: int = 1                      # how many copies to put in the deck
    metadata: Dict[str, Any] = {}


class Card(BaseModel):
    """An actual card instance in play."""
    id: str                             # e.g. "attack_0"
    definitionId: str                   # references CardDefinition.id
    name: str
    type: str
    subtype: Optional[str] = None
    emoji: Optional[str] = None
    description: str
    effects: List[CardEffect]
    isPlayable: bool = True
    isReaction: bool = False
    metadata: Dict[str, Any] = {}


# ── Player & Hand models ──────────────────────────────────────────────────────

class Hand(BaseModel):
    playerId: str
    cards: List[Card]
    isVisible: bool = True              # false means the hand is hidden from others


class Player(BaseModel):
    id: str
    name: str
    emoji: Optional[str] = None
    status: str = "waiting"             # waiting | active | eliminated | winner
    hand: Hand
    isCurrentTurn: bool = False
    isLocalPlayer: bool = False         # set per-client; never stored server-side
    isConnected: bool = False
    turnCount: int = 0                  # how many draws this player owes this turn
    metadata: Dict[str, Any] = {}


# ── Zone model ────────────────────────────────────────────────────────────────

class Zone(BaseModel):
    id: str
    name: str
    type: str                           # deck | discard | common | hand
    cards: List[Card]
    isPublic: bool
    maxCards: Optional[int] = None
    metadata: Dict[str, Any] = {}


# ── Rules models ──────────────────────────────────────────────────────────────

class TurnPhase(BaseModel):
    id: str
    name: str
    description: str
    isOptional: bool


class TurnStructure(BaseModel):
    phases: List[TurnPhase]
    canPassTurn: bool
    mustPlayCard: bool
    drawCount: int                      # cards drawn at end of turn


class WinCondition(BaseModel):
    type: str                           # last_standing | most_points | empty_hand | etc.
    description: str
    metadata: Dict[str, Any] = {}


class SpecialRule(BaseModel):
    id: str
    name: str
    trigger: str                        # on_play | on_draw | on_combo | on_turn_end
    description: str
    metadata: Dict[str, Any] = {}


class GameRules(BaseModel):
    minPlayers: int
    maxPlayers: int
    handSize: int
    turnStructure: TurnStructure
    winCondition: WinCondition
    specialRules: List[SpecialRule] = []


# ── Log model ─────────────────────────────────────────────────────────────────

class LogEntry(BaseModel):
    id: str
    timestamp: int
    message: str
    type: str                           # system | action | effect
    playerId: Optional[str] = None
    cardId: Optional[str] = None


# ── Game state ────────────────────────────────────────────────────────────────

class GameState(BaseModel):
    gameId: str
    roomCode: str
    gameName: str
    gameType: str                       # e.g. "exploding_kittens", "uno"
    phase: str = "lobby"               # lobby | playing | awaiting_response | ended
    players: List[Player] = []
    zones: List[Zone] = []
    currentTurnPlayerId: str = ""
    turnNumber: int = 0
    rules: GameRules
    log: List[LogEntry] = []
    winner: Optional[Player] = None
    pendingAction: Optional[Dict[str, Any]] = None   # for nope-windows, favor, etc.
    metadata: Dict[str, Any] = {}
