// ============================================================
// API SERVICE — bridges NextJS frontend to FastAPI backend
// All game data flows through here.
// ============================================================

import type {
  GameState,
  GameConfig,
  GameAction,
  ActionResponse,
  ApiResponse,
  Player,
} from "../entities";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function request<T>(
  path: string,
  options?: RequestInit
): Promise<ApiResponse<T>> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Unknown error" }));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

// ── Game lifecycle ──────────────────────────────────────────

const API_V1 = "/api/v1";

/** Fetch the full config/definition for a game type */
export async function fetchGameConfig(gameType: string): Promise<GameConfig> {
  const res = await request<GameConfig>(`${API_V1}/games/${gameType}/config`);
  return res.data;
}

/** Create a new game session */
export async function createGame(
  gameType: string,
  playerNames: string[]
): Promise<GameState> {
  const res = await request<GameState>(`${API_V1}/games/create`, {
    method: "POST",
    body: JSON.stringify({ game_type: gameType, player_names: playerNames }),
  });
  return res.data;
}

/** Fetch the current game state */
export async function fetchGameState(gameId: string): Promise<GameState> {
  const res = await request<GameState>(`${API_V1}/games/${gameId}/state`);
  return res.data;
}

/** List all available game types */
export async function fetchAvailableGames(): Promise<GameConfig[]> {
  const res = await request<GameConfig[]>(`${API_V1}/games/available`);
  return res.data;
}

// ── Game actions ────────────────────────────────────────────

/** Submit any player action to the backend */
export async function submitAction(
  gameId: string,
  action: Omit<GameAction, "id" | "timestamp">
): Promise<ActionResponse> {
  const res = await request<ActionResponse>(`${API_V1}/games/${gameId}/action`, {
    method: "POST",
    body: JSON.stringify(action),
  });
  return res.data;
}

/** Draw a card */
export async function drawCard(
  gameId: string,
  playerId: string
): Promise<ActionResponse> {
  return submitAction(gameId, {
    type: "draw_card",
    playerId,
    metadata: {},
  });
}

/** Play a card from hand */
export async function playCard(
  gameId: string,
  playerId: string,
  cardId: string,
  targetPlayerId?: string
): Promise<ActionResponse> {
  return submitAction(gameId, {
    type: "play_card",
    playerId,
    cardId,
    targetPlayerId,
    metadata: {},
  });
}

/** Pass the current turn */
export async function passTurn(
  gameId: string,
  playerId: string
): Promise<ActionResponse> {
  return submitAction(gameId, {
    type: "pass_turn",
    playerId,
    metadata: {},
  });
}

// ── Player helpers ──────────────────────────────────────────

export async function fetchPlayer(
  gameId: string,
  playerId: string
): Promise<Player> {
  const state = await fetchGameState(gameId);
  const player = state.players.find((p) => p.id === playerId);
  if (!player) throw new Error(`Player ${playerId} not found`);
  return player;
}
