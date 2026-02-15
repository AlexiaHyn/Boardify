"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import AppNav from "~/components/AppNav";
import { createGame } from "~/lib/api";
import { isGameSnapshot } from "~/types/gameSnapshot";
import type { ClientPlayerSession } from "~/types/multiplayer";

export default function HostPage() {
	const router = useRouter();
	const [hostPerson, setHostPerson] = useState("");
	const [snapshotText, setSnapshotText] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);

	useEffect(() => {
		const stored = window.localStorage.getItem("boardify:lastGeneratedGame");
		if (stored) {
			setSnapshotText(stored);
		}
	}, []);

	async function onHost() {
		setLoading(true);
		setError(null);
		try {
			const parsed: unknown = JSON.parse(snapshotText);
			if (!isGameSnapshot(parsed)) {
				throw new Error(
					"Snapshot must be either a Boardify GameData object or an UNO-style FSM snapshot.",
				);
			}
			const result = await createGame(hostPerson, parsed);
			const playerSession: ClientPlayerSession = {
				gameCode: result.game_code,
				playerId: result.player_id,
				playerName: hostPerson,
				isHost: true,
			};
			window.sessionStorage.setItem(
				`boardify:player:${result.game_code}`,
				JSON.stringify(playerSession),
			);
			router.push(`/game/${result.game_code}`);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Unable to create game.");
		} finally {
			setLoading(false);
		}
	}

	return (
		<main className="min-h-screen bg-gradient-to-b from-[#0f172a] to-[#1e293b] px-4 py-12 text-white">
			<div className="mx-auto w-full max-w-4xl">
				<h1 className="mb-2 font-bold text-4xl">Host Game</h1>
				<p className="mb-8 text-slate-400">
					Create a lobby and share the game code with players.
				</p>
				<AppNav />
				<div className="space-y-4 rounded-2xl border border-slate-700 bg-slate-800 p-6">
					<label className="block text-slate-300 text-sm">
						Host name
						<input
							className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-white outline-none focus:border-indigo-500"
							onChange={(e) => setHostPerson(e.target.value)}
							placeholder="Elaine"
							type="text"
							value={hostPerson}
						/>
					</label>
					<label className="block text-slate-300 text-sm">
						Game snapshot JSON
						<textarea
							className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 font-mono text-slate-200 text-xs outline-none focus:border-indigo-500"
							onChange={(e) => setSnapshotText(e.target.value)}
							rows={14}
							value={snapshotText}
						/>
					</label>
					{error && (
						<p className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-red-200 text-sm">
							{error}
						</p>
					)}
					<button
						className="rounded-lg bg-indigo-600 px-4 py-2 font-semibold text-white transition-colors hover:bg-indigo-500 disabled:opacity-50"
						disabled={loading || !hostPerson.trim() || !snapshotText.trim()}
						onClick={() => void onHost()}
						type="button"
					>
						{loading ? "Creating..." : "Create Game"}
					</button>
				</div>
			</div>
		</main>
	);
}
