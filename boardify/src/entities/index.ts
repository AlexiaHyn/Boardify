// ============================================================
// CORE CARD GAME ENTITIES
// Generic, reusable entities that can model ANY card game.
// Fill with game-specific data from the backend to play any game.
// ============================================================

// ------ CARD ------
export interface CardEffect {
  type: string;           // e.g. "draw", "skip", "attack", "nope"
  value?: number;         // e.g. how many cards to draw
  target?: "self" | "others" | "choose" | "all";
  description: string;
}

export interface Card {
  id: string;
  name: string;
  type: string;           // e.g. "action", "defense", "combo", "special"
  subtype?: string;       // e.g. "cat", "exploding", "defuse"
  imageUrl?: string;
  emoji?: string;
  description: string;
  effects: CardEffect[];
  isPlayable: boolean;    // computed: can this card be played right now?
  metadata: Record<string, unknown>; // game-specific extra data
}

// ------ DECK ------
export interface Deck {
  id: string;
  cards: Card[];
  faceUp: boolean;        // is the top card visible?
  label?: string;         // e.g. "Draw Pile", "Discard Pile"
}

// ------ HAND ------
export interface Hand {
  playerId: string;
  cards: Card[];
  isVisible: boolean;     // to current viewer
  maxSize?: number;       // optional hand limit
}

// ------ PLAYER ------
export type PlayerStatus = "waiting" | "active" | "eliminated" | "winner";

export interface Player {
  id: string;
  name: string;
  avatarUrl?: string;
  emoji?: string;
  status: PlayerStatus;
  hand: Hand;
  isCurrentTurn: boolean;
  isLocalPlayer: boolean; // is this the user sitting at the screen?
  score?: number;
  metadata: Record<string, unknown>; // e.g. shields, lives, tokens
}

// ------ ZONE ------
// A zone is any named area on the table: draw pile, discard, play area, etc.
export interface Zone {
  id: string;
  name: string;
  type: "deck" | "discard" | "play" | "hand" | "staging" | "custom";
  cards: Card[];
  isPublic: boolean;       // visible to all players
  maxCards?: number;
  position?: { x: number; y: number }; // layout hint
}

// ------ GAME RULES ------
export interface WinCondition {
  type: "last_standing" | "points" | "collect" | "custom";
  description: string;
  targetValue?: number;
}

export interface TurnStructure {
  phases: TurnPhase[];
  canPassTurn: boolean;
  mustPlayCard: boolean;
  drawCount: number;       // how many cards drawn per turn
}

export interface TurnPhase {
  id: string;
  name: string;
  description: string;
  isOptional: boolean;
}

export interface GameRules {
  minPlayers: number;
  maxPlayers: number;
  handSize: number;
  turnStructure: TurnStructure;
  winCondition: WinCondition;
  specialRules: SpecialRule[];
}

export interface SpecialRule {
  id: string;
  name: string;
  trigger: string;         // e.g. "on_draw", "on_play", "on_combo"
  description: string;
  metadata: Record<string, unknown>;
}

// ------ GAME ACTION (what players do) ------
export type ActionType =
  | "play_card"
  | "draw_card"
  | "pass_turn"
  | "discard"
  | "use_ability"
  | "select_target"
  | "custom";

export interface GameAction {
  id: string;
  type: ActionType;
  playerId: string;
  cardId?: string;
  targetPlayerId?: string;
  targetZoneId?: string;
  timestamp: number;
  metadata: Record<string, unknown>;
}

// ------ GAME LOG ------
export interface LogEntry {
  id: string;
  timestamp: number;
  message: string;         // human-readable e.g. "Alex played an Attack card!"
  type: "action" | "system" | "effect" | "warning";
  playerId?: string;
  cardId?: string;
}

// ------ GAME STATE ------
export type GamePhase = "lobby" | "starting" | "playing" | "paused" | "ended";

export interface GameState {
  gameId: string;
  gameName: string;
  phase: GamePhase;
  players: Player[];
  zones: Zone[];           // all named areas on the table
  currentTurnPlayerId: string;
  turnNumber: number;
  currentPhaseIndex: number;
  rules: GameRules;
  log: LogEntry[];
  winner?: Player;
  metadata: Record<string, unknown>; // game-specific state extras
}

// ------ GAME CONFIG (how to bootstrap a new game) ------
export interface GameConfig {
  gameId: string;
  gameName: string;
  gameType: string;        // e.g. "exploding_kittens", "poker", "uno"
  description: string;
  thumbnailUrl?: string;
  emoji?: string;
  rules: GameRules;
  cardDefinitions: Card[];
  initialZones: Omit<Zone, "cards">[];
  metadata: Record<string, unknown>;
}

// ------ API RESPONSE WRAPPERS ------
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: string;
  timestamp: number;
}

export interface ActionResponse {
  success: boolean;
  newState: GameState;
  triggeredEffects: string[];
  error?: string;
}
