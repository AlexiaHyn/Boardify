import type { GameSnapshot } from "~/types/gameSnapshot";
import type {
	CreateGameResponse,
	JoinGameResponse,
	ShowcaseItem,
} from "~/types/multiplayer";

const API_BASE =
	process.env.NEXT_PUBLIC_MODAL_ENDPOINT ?? "http://localhost:8000";

function buildPath(path: string): string {
	return `${API_BASE}${path}`;
}

async function parseOrThrow<T>(res: Response): Promise<T> {
	if (!res.ok) {
		const detail = await res.json().catch(() => null);
		const message =
			(detail as { detail?: string })?.detail ??
			`Request failed with status ${res.status}`;
		throw new Error(message);
	}
	return (await res.json()) as T;
}

export async function createGame(
	hostPerson: string,
	gameSnapshot: GameSnapshot,
): Promise<CreateGameResponse> {
	const res = await fetch(buildPath("/api/v1/games/create"), {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			host_person: hostPerson,
			game_snapshot: gameSnapshot,
		}),
	});
	return parseOrThrow<CreateGameResponse>(res);
}

export async function joinGame(
	gameCode: string,
	playerName: string,
): Promise<JoinGameResponse> {
	const res = await fetch(buildPath("/api/v1/games/join"), {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			game_code: gameCode,
			player_name: playerName,
		}),
	});
	return parseOrThrow<JoinGameResponse>(res);
}

export async function getShowcase(limit = 50): Promise<ShowcaseItem[]> {
	const res = await fetch(
		buildPath(`/api/v1/showcase?limit=${encodeURIComponent(String(limit))}`),
		{ cache: "no-store" },
	);
	const data = await parseOrThrow<{ items: ShowcaseItem[] }>(res);
	return data.items;
}

export function buildWsUrl(gameCode: string, playerId: string): string {
	const base = API_BASE.replace(/^http/i, "ws");
	const code = encodeURIComponent(gameCode);
	const pid = encodeURIComponent(playerId);
	return `${base}/api/v1/ws/${code}?player_id=${pid}`;
}
