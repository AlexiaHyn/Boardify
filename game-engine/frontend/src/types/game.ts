// Core game types — mirrors the backend Pydantic models

export interface CardEffect {
  type: string;
  value?: number;
  target?: string;
  description: string;
  metadata?: Record<string, unknown>;
}

export interface Card {
  id: string;
  definitionId: string;
  name: string;
  type: string;
  subtype?: string;
  emoji?: string;
  description: string;
  effects: CardEffect[];
  isPlayable: boolean;
  isReaction: boolean;
  metadata?: Record<string, unknown>;
}

export interface Hand {
  playerId: string;
  cards: Card[];
  isVisible: boolean;
}

export interface Player {
  id: string;
  name: string;
  emoji?: string;
  status: 'waiting' | 'active' | 'eliminated' | 'winner';
  hand: Hand;
  isCurrentTurn: boolean;
  isLocalPlayer: boolean;
  isConnected: boolean;
  turnCount: number;
  metadata?: Record<string, unknown>;
}

export interface Zone {
  id: string;
  name: string;
  type: 'deck' | 'discard' | 'common' | 'hand';
  cards: Card[];
  isPublic: boolean;
  maxCards?: number;
  metadata?: Record<string, unknown>;
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
}

export interface GameRules {
  minPlayers: number;
  maxPlayers: number;
  handSize: number;
  turnStructure: TurnStructure;
  winCondition: WinCondition;
  specialRules: SpecialRule[];
}

export interface LogEntry {
  id: string;
  timestamp: number;
  message: string;
  type: 'system' | 'action' | 'effect';
  playerId?: string;
  cardId?: string;
}

export interface Choice {
  value: string;
  label: string;
  icon?: string;
  color?: string;
}

export interface PendingAction {
  type: string;
  playerId: string;
  targetPlayerId?: string;
  card?: Card;
  deckSize?: number;
  choices?: Choice[];
  prompt?: string;
  [key: string]: unknown;
}

export interface DefaultAction {
  id: string;
  label: string;
  icon?: string;
  description?: string;
  actionType: string;
  color?: string;
  targetPlayerId?: string;
  targetPlayerName?: string;
}

export interface GameState {
  gameId: string;
  roomCode: string;
  gameName: string;
  gameType: string;
  phase: 'lobby' | 'playing' | 'awaiting_response' | 'ended';
  players: Player[];
  zones: Zone[];
  availableActions?: DefaultAction[];
  currentTurnPlayerId: string;
  turnNumber: number;
  rules: GameRules;
  log: LogEntry[];
  winner?: Player;
  pendingAction?: PendingAction;
  metadata?: Record<string, unknown>;
}

// API request types

export interface CreateRoomRequest {
  host_name: string;
  game_type: string;
}

export interface JoinRoomRequest {
  player_name: string;
}

export interface ActionRequest {
  type: string;
  playerId: string;
  cardId?: string;
  targetPlayerId?: string;
  metadata?: Record<string, unknown>;
}

// WebSocket message types

export type WsMessage =
  | { type: 'state_update'; state: GameState }
  | { type: 'player_connected'; playerId: string; name: string }
  | { type: 'player_disconnected'; playerId: string; name: string }
  | { type: 'pong' }
  | { type: 'error'; message: string };

// UI helpers

export type GamePhase = GameState['phase'];

export interface GameInfo {
  id: string;
  name: string;
}

export interface SeeTheFutureData {
  cards: string[];
}
