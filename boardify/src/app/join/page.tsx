"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import AppNav from "~/components/AppNav";
import { joinGame } from "~/lib/api";
import type { ClientPlayerSession } from "~/types/multiplayer";

export default function JoinPage() {
	const router = useRouter();
	const [gameCode, setGameCode] = useState("");
	const [playerName, setPlayerName] = useState("");
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	async function onJoin() {
		setLoading(true);
		setError(null);
		try {
			const normalizedCode = gameCode.trim().toUpperCase();
			const result = await joinGame(normalizedCode, playerName);
			const playerSession: ClientPlayerSession = {
				gameCode: result.game_code,
				playerId: result.player_id,
				playerName,
				isHost: false,
			};
			window.sessionStorage.setItem(
				`boardify:player:${result.game_code}`,
				JSON.stringify(playerSession),
			);
			router.push(`/game/${result.game_code}`);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Unable to join game.");
		} finally {
			setLoading(false);
		}
	}

	return (
		<main className="min-h-screen bg-gradient-to-b from-[#0f172a] to-[#1e293b] px-4 py-12 text-white">
			<div className="mx-auto w-full max-w-xl">
				<h1 className="mb-2 font-bold text-4xl">Join Game</h1>
				<p className="mb-8 text-slate-400">
					Enter the game code from your host.
				</p>
				<AppNav />
				<div className="space-y-4 rounded-2xl border border-slate-700 bg-slate-800 p-6">
					<label className="block text-slate-300 text-sm">
						Player name
						<input
							className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 outline-none focus:border-indigo-500"
							onChange={(e) => setPlayerName(e.target.value)}
							type="text"
							value={playerName}
						/>
					</label>
					<label className="block text-slate-300 text-sm">
						Game code
						<input
							className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 uppercase tracking-widest outline-none focus:border-indigo-500"
							maxLength={6}
							onChange={(e) => setGameCode(e.target.value.toUpperCase())}
							type="text"
							value={gameCode}
						/>
					</label>
					{error && (
						<p className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-red-200 text-sm">
							{error}
						</p>
					)}
					<button
						className="rounded-lg bg-indigo-600 px-4 py-2 font-semibold transition-colors hover:bg-indigo-500 disabled:opacity-50"
						disabled={
							loading || !playerName.trim() || gameCode.trim().length !== 6
						}
						onClick={() => void onJoin()}
						type="button"
					>
						{loading ? "Joining..." : "Join Game"}
					</button>
				</div>
			</div>
		</main>
	);
}
