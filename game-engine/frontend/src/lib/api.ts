import type {
	ActionRequest,
	CreateRoomRequest,
	GameInfo,
	GameState,
	JoinRoomRequest,
} from "@/types/game";

export const API_BASE =
	process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
	const res = await fetch(`${API_BASE}${path}`, {
		headers: { "Content-Type": "application/json" },
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
	const data = await request<{ games: GameInfo[] }>("/api/games");
	return data.games;
}

// ── Room management ───────────────────────────────────────────────────────────

export async function createRoom(
	payload: CreateRoomRequest,
): Promise<{
	roomCode: string;
	playerId: string;
	gameId: string;
	gameName: string;
}> {
	return request("/api/rooms/create", {
		method: "POST",
		body: JSON.stringify(payload),
	});
}

export async function joinRoom(
	roomCode: string,
	payload: JoinRoomRequest,
): Promise<{ playerId: string; roomCode: string; gameName: string }> {
	return request(`/api/rooms/${roomCode}/join`, {
		method: "POST",
		body: JSON.stringify(payload),
	});
}

export async function startRoom(
	roomCode: string,
	playerId: string,
): Promise<{ success: boolean }> {
	return request(`/api/rooms/${roomCode}/start?player_id=${playerId}`, {
		method: "POST",
	});
}

export async function sendAction(
	roomCode: string,
	action: ActionRequest,
): Promise<{ success: boolean; triggeredEffects: string[] }> {
	return request(`/api/rooms/${roomCode}/action`, {
		method: "POST",
		body: JSON.stringify(action),
	});
}

export async function getRoomState(roomCode: string): Promise<GameState> {
	const data = await request<{ state: GameState }>(
		`/api/rooms/${roomCode}/state`,
	);
	return data.state;
}

// ── AI game generation (SSE stream) ──────────────────────────────────────────

export interface GenerateGameResponse {
	success: boolean;
	game_id: string;
	game_name: string;
	description: string;
	message: string;
	errors: string[];
	warnings: string[];
}

export interface GenerateProgressEvent {
	step: string;
	message: string;
}

/**
 * Kick off AI game generation and consume the SSE stream.
 *
 * @param gameName  - the user's prompt / game name
 * @param onProgress - optional callback fired for each progress event
 * @returns the final GenerateGameResponse
 */
export async function generateGame(
	gameName: string,
	onProgress?: (event: GenerateProgressEvent) => void,
): Promise<GenerateGameResponse> {
	const res = await fetch(`${API_BASE}/api/games/generate`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ game_name: gameName }),
	});

	if (!res.ok) {
		const body = await res.json().catch(() => ({}));
		throw new Error(body.detail || `HTTP ${res.status}`);
	}

	const reader = res.body?.getReader();
	if (!reader) throw new Error("No response body");

	const decoder = new TextDecoder();
	let buffer = "";
	let finalResult: GenerateGameResponse | null = null;

	while (true) {
		const { done, value } = await reader.read();
		if (done) break;

		buffer += decoder.decode(value, { stream: true });

		// Parse SSE frames from the buffer
		const parts = buffer.split("\n\n");
		// Keep the last (possibly incomplete) chunk in the buffer
		buffer = parts.pop() ?? "";

		for (const part of parts) {
			const lines = part.split("\n");
			let eventType = "";
			let data = "";

			for (const line of lines) {
				if (line.startsWith("event: ")) {
					eventType = line.slice(7);
				} else if (line.startsWith("data: ")) {
					data = line.slice(6);
				}
				// Ignore comments (lines starting with ':')
			}

			if (!data) continue;

			if (eventType === "progress") {
				try {
					const parsed = JSON.parse(data) as GenerateProgressEvent;
					onProgress?.(parsed);
				} catch {
					// skip malformed progress events
				}
			} else if (eventType === "result") {
				try {
					finalResult = JSON.parse(data) as GenerateGameResponse;
				} catch {
					throw new Error("Malformed result from server");
				}
			}
		}
	}

	if (!finalResult) {
		throw new Error("Stream ended without a result");
	}

	return finalResult;
}

// ── WebSocket ─────────────────────────────────────────────────────────────────

export function buildWsUrl(roomCode: string, playerId: string): string {
	const base = (
		process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000"
	).replace(/\/$/, "");
	return `${base}/ws/${roomCode}/${playerId}`;
}
