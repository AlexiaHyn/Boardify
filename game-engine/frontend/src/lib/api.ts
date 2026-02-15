import type {
  ActionRequest,
  CreateRoomRequest,
  GameInfo,
  GameState,
  JoinRoomRequest,
} from '@/types/game';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

async function request<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

// ── Game catalogue ────────────────────────────────────────────────────────────

export async function listGames(): Promise<GameInfo[]> {
  const data = await request<{ games: GameInfo[] }>('/api/games');
  return data.games;
}

// ── Room management ───────────────────────────────────────────────────────────

export async function createRoom(
  payload: CreateRoomRequest,
): Promise<{ roomCode: string; playerId: string; gameId: string; gameName: string }> {
  return request('/api/rooms/create', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function joinRoom(
  roomCode: string,
  payload: JoinRoomRequest,
): Promise<{ playerId: string; roomCode: string; gameName: string }> {
  return request(`/api/rooms/${roomCode}/join`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function startRoom(
  roomCode: string,
  playerId: string,
): Promise<{ success: boolean }> {
  return request(`/api/rooms/${roomCode}/start?player_id=${playerId}`, {
    method: 'POST',
  });
}

export async function sendAction(
  roomCode: string,
  action: ActionRequest,
): Promise<{ success: boolean; triggeredEffects: string[] }> {
  return request(`/api/rooms/${roomCode}/action`, {
    method: 'POST',
    body: JSON.stringify(action),
  });
}

export async function getRoomState(roomCode: string): Promise<GameState> {
  const data = await request<{ state: GameState }>(`/api/rooms/${roomCode}/state`);
  return data.state;
}

// ── AI game generation ───────────────────────────────────────────────────────

export interface GenerateGameResponse {
  success: boolean;
  game_id: string;
  game_name: string;
  description: string;
  message: string;
  errors: string[];
  warnings: string[];
}

export async function generateGame(
  gameName: string,
): Promise<GenerateGameResponse> {
  return request('/api/games/generate', {
    method: 'POST',
    body: JSON.stringify({ game_name: gameName }),
  });
}

// ── WebSocket ─────────────────────────────────────────────────────────────────

export function buildWsUrl(roomCode: string, playerId: string): string {
  const base = (process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000').replace(/\/$/, '');
  return `${base}/ws/${roomCode}/${playerId}`;
}
