// ── API Service — Multiplayer ─────────────────────────────────────────────────

import type { GameState, PlayerSession } from "../entities";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const WS_URL   = process.env.NEXT_PUBLIC_WS_URL  || "ws://localhost:8000";

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Unknown error" }));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Unknown error" }));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

// ── Room management ───────────────────────────────────────────────────────────

export async function createRoom(
  hostName: string
): Promise<{ roomCode: string; playerId: string; gameId: string }> {
  return post("/api/rooms/create", { host_name: hostName });
}

export async function joinRoom(
  roomCode: string,
  playerName: string
): Promise<{ playerId: string; roomCode: string }> {
  return post(`/api/rooms/${roomCode.toUpperCase()}/join`, { player_name: playerName });
}

export async function startGame(
  roomCode: string,
  playerId: string
): Promise<void> {
  await post(`/api/rooms/${roomCode.toUpperCase()}/start?player_id=${playerId}`, {});
}

export async function fetchRoomState(roomCode: string): Promise<GameState> {
  const res = await get<{ success: boolean; state: GameState }>(
    `/api/rooms/${roomCode.toUpperCase()}/state`
  );
  return res.state;
}

// ── Game actions ──────────────────────────────────────────────────────────────

export async function sendAction(
  roomCode: string,
  type: string,
  playerId: string,
  cardId?: string,
  targetPlayerId?: string
): Promise<{ success: boolean; triggeredEffects: string[] }> {
  return post(`/api/rooms/${roomCode.toUpperCase()}/action`, {
    type,
    playerId,
    cardId,
    targetPlayerId,
    metadata: {},
  });
}

// ── WebSocket factory ─────────────────────────────────────────────────────────

export function createWebSocket(roomCode: string, playerId: string): WebSocket {
  return new WebSocket(`${WS_URL}/ws/${roomCode.toUpperCase()}/${playerId}`);
}

// ── Session helpers (localStorage) ───────────────────────────────────────────

const SESSION_KEY = "ek_player_session";

export function saveSession(session: PlayerSession): void {
  if (typeof window !== "undefined") {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  }
}

export function loadSession(): PlayerSession | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PlayerSession;
  } catch {
    return null;
  }
}

export function clearSession(): void {
  if (typeof window !== "undefined") {
    localStorage.removeItem(SESSION_KEY);
  }
}
