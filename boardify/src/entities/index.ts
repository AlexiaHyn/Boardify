// ── Core Card Game Entities (Multiplayer Edition) ────────────────────────────

export interface CardEffect {
  type: string;
  value?: number;
  target?: "self" | "others" | "choose" | "all";
  description: string;
}

export interface Card {
  id: string;
  name: string;
  type: string;
  subtype?: string;
  emoji?: string;
  description: string;
  effects: CardEffect[];
  isPlayable: boolean;
  metadata: Record<string, unknown>;
}

export interface Hand {
  playerId: string;
  cards: Card[];
  isVisible: boolean;
}

export type PlayerStatus = "waiting" | "active" | "eliminated" | "winner";

export interface Player {
  id: string;
  name: string;
  emoji?: string;
  status: PlayerStatus;
  hand: Hand;
  isCurrentTurn: boolean;
  isLocalPlayer: boolean;
  isConnected: boolean;
  metadata: Record<string, unknown>;
}

export interface Zone {
  id: string;
  name: string;
  type: "deck" | "discard" | "play" | "hand" | "custom";
  cards: Card[];
  isPublic: boolean;
  maxCards?: number;
}

export interface TurnPhase {
  id: string;
  name: string;
  description: string;
  isOptional: boolean;
}

export interface TurnStructure {
  phases: TurnPhase[];
  canPassTurn: boolean;
  mustPlayCard: boolean;
  drawCount: number;
}

export interface WinCondition {
  type: string;
  description: string;
}

export interface SpecialRule {
  id: string;
  name: string;
  trigger: string;
  description: string;
  metadata: Record<string, unknown>;
}

export interface GameRules {
  minPlayers: number;
  maxPlayers: number;
  handSize: number;
  turnStructure: TurnStructure;
  winCondition: WinCondition;
  specialRules: SpecialRule[];
}

export type GamePhase = "lobby" | "playing" | "ended";

export interface LogEntry {
  id: string;
  timestamp: number;
  message: string;
  type: "action" | "system" | "effect" | "warning";
  playerId?: string;
  cardId?: string;
}

export interface GameState {
  gameId: string;
  roomCode: string;
  gameName: string;
  phase: GamePhase;
  players: Player[];
  zones: Zone[];
  currentTurnPlayerId: string;
  turnNumber: number;
  rules: GameRules;
  log: LogEntry[];
  winner?: Player;
  metadata: Record<string, unknown>;
}

// ── Session identity (stored in localStorage per browser tab) ─────────────────
export interface PlayerSession {
  playerId: string;
  playerName: string;
  roomCode: string;
}