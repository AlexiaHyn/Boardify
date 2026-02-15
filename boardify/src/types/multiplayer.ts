import type { GameSnapshot } from "~/types/gameSnapshot";

export interface SessionPlayer {
	player_id: string;
	name: string;
	is_host: boolean;
}

export interface GameSessionState {
	game_code: string;
	game_id: string;
	host_person: string;
	status: string;
	started: boolean;
	created_at: string;
	completed_at: string | null;
	players: SessionPlayer[];
}

export interface CreateGameResponse {
	game_code: string;
	game_id: string;
	player_id: string;
	session: GameSessionState;
}

export interface JoinGameResponse {
	game_code: string;
	game_id: string;
	player_id: string;
	session: GameSessionState;
}

export interface ShowcaseItem {
	id: string;
	game_code: string;
	game_id: string;
	host_person: string;
	game_snapshot: GameSnapshot;
	status: "completed" | "abandoned";
	created_at: string;
	completed_at: string | null;
}

export interface ClientPlayerSession {
	gameCode: string;
	playerId: string;
	playerName: string;
	isHost: boolean;
}
