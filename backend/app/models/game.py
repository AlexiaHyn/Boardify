"""
Pydantic models for the Card Game Framework.
These mirror the TypeScript entities on the frontend exactly.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from pydantic import BaseModel


# ── Card ──────────────────────────────────────────────────────────────────────

class CardEffect(BaseModel):
    type: str
    value: Optional[int] = None
    target: Optional[str] = None
    description: str


class Card(BaseModel):
    id: str
    name: str
    type: str
    subtype: Optional[str] = None
    imageUrl: Optional[str] = None
    emoji: Optional[str] = None
    description: str
    effects: List[CardEffect]
    isPlayable: bool = True
    metadata: Dict[str, Any] = {}


# ── Player ────────────────────────────────────────────────────────────────────

class Hand(BaseModel):
    playerId: str
    cards: List[Card]
    isVisible: bool
    maxSize: Optional[int] = None


class Player(BaseModel):
    id: str
    name: str
    avatarUrl: Optional[str] = None
    emoji: Optional[str] = None
    status: str = "waiting"
    hand: Hand
    isCurrentTurn: bool = False
    isLocalPlayer: bool = False
    score: Optional[int] = None
    metadata: Dict[str, Any] = {}


# ── Table zones ───────────────────────────────────────────────────────────────

class Zone(BaseModel):
    id: str
    name: str
    type: str
    cards: List[Card]
    isPublic: bool
    maxCards: Optional[int] = None


# ── Rules ─────────────────────────────────────────────────────────────────────

class TurnPhase(BaseModel):
    id: str
    name: str
    description: str
    isOptional: bool


class TurnStructure(BaseModel):
    phases: List[TurnPhase]
    canPassTurn: bool
    mustPlayCard: bool
    drawCount: int


class WinCondition(BaseModel):
    type: str
    description: str
    targetValue: Optional[int] = None


class SpecialRule(BaseModel):
    id: str
    name: str
    trigger: str
    description: str
    metadata: Dict[str, Any] = {}


class GameRules(BaseModel):
    minPlayers: int
    maxPlayers: int
    handSize: int
    turnStructure: TurnStructure
    winCondition: WinCondition
    specialRules: List[SpecialRule]


# ── Game state ────────────────────────────────────────────────────────────────

class LogEntry(BaseModel):
    id: str
    timestamp: int
    message: str
    type: str
    playerId: Optional[str] = None
    cardId: Optional[str] = None


class GameState(BaseModel):
    gameId: str
    gameName: str
    phase: str
    players: List[Player]
    zones: List[Zone]
    currentTurnPlayerId: str
    turnNumber: int
    currentPhaseIndex: int
    rules: GameRules
    log: List[LogEntry]
    winner: Optional[Player] = None
    metadata: Dict[str, Any] = {}


class GameConfig(BaseModel):
    gameId: str
    gameName: str
    gameType: str
    description: str
    thumbnailUrl: Optional[str] = None
    emoji: Optional[str] = None
    rules: GameRules
    cardDefinitions: List[Card]
    initialZones: List[Dict]
    metadata: Dict[str, Any] = {}


# ── Request / Response ────────────────────────────────────────────────────────

class CreateGameRequest(BaseModel):
    game_type: str
    player_names: List[str]


class ActionRequest(BaseModel):
    type: str
    playerId: str
    cardId: Optional[str] = None
    targetPlayerId: Optional[str] = None
    targetZoneId: Optional[str] = None
    metadata: Dict[str, Any] = {}


class ActionResponse(BaseModel):
    success: bool
    newState: GameState
    triggeredEffects: List[str]
    error: Optional[str] = None
