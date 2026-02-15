import type { GameData } from "~/types/game";

export interface UnoLikeSnapshot {
	meta: {
		game_name?: string;
		version?: string;
	};
	assets?: unknown;
	zones?: unknown;
	variables?: unknown;
	card_effects?: unknown;
	fsm?: unknown;
}

export type GameSnapshot = GameData | UnoLikeSnapshot;

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

export function isGameSnapshot(value: unknown): value is GameSnapshot {
	if (!isRecord(value)) {
		return false;
	}

	// Existing Boardify blueprint format.
	if ("game" in value) {
		return true;
	}

	// UNO-like runtime/FSM snapshot format.
	return "meta" in value && "fsm" in value;
}

export function getSnapshotDisplayName(snapshot: GameSnapshot): string {
	if ("game" in snapshot) {
		return snapshot.game.name;
	}
	return snapshot.meta?.game_name ?? "Untitled game";
}
