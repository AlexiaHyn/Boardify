"use client";

import { useParams } from "next/navigation";
import { useMemo } from "react";
import AppNav from "~/components/AppNav";
import { useGameSocket } from "~/lib/useGameSocket";
import type { ClientPlayerSession } from "~/types/multiplayer";

function readPlayerSession(gameCode: string): ClientPlayerSession | null {
	const raw = window.sessionStorage.getItem(`boardify:player:${gameCode}`);
	if (!raw) {
		return null;
	}
	try {
		return JSON.parse(raw) as ClientPlayerSession;
	} catch {
		return null;
	}
}

export default function GameRoomPage() {
	const params = useParams<{ gameCode: string }>();
	const gameCode = (params.gameCode ?? "").toUpperCase();

	const playerSession = useMemo(() => {
		if (typeof window === "undefined") {
			return null;
		}
		return readPlayerSession(gameCode);
	}, [gameCode]);

	const socket = useGameSocket(gameCode, playerSession?.playerId ?? "");

	if (!playerSession) {
		return (
			<main className="min-h-screen bg-gradient-to-b from-[#0f172a] to-[#1e293b] px-4 py-12 text-white">
				<div className="mx-auto w-full max-w-2xl">
					<h1 className="mb-4 font-bold text-3xl">Game Room</h1>
					<AppNav />
					<p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-amber-200">
						No local player session found for this room. Rejoin using the game
						code.
					</p>
				</div>
			</main>
		);
	}

	const session = socket.session;
	const players = session?.players ?? [];

	return (
		<main className="min-h-screen bg-gradient-to-b from-[#0f172a] to-[#1e293b] px-4 py-12 text-white">
			<div className="mx-auto w-full max-w-3xl">
				<h1 className="font-bold text-4xl">Game Room</h1>
				<p className="mt-2 text-slate-300">
					Game code:{" "}
					<span className="font-mono tracking-widest">{gameCode}</span>
				</p>
				<p className="mt-1 mb-8 text-slate-400 text-sm">
					{socket.connected ? "Connected" : "Connecting..."}
				</p>
				<AppNav />

				<div className="mb-6 rounded-2xl border border-slate-700 bg-slate-800 p-6">
					<div className="mb-4 flex items-center justify-between">
						<h2 className="font-semibold text-xl">Lobby</h2>
						<p className="text-slate-300 text-sm">
							Status: {session?.status ?? "lobby"}
						</p>
					</div>
					<ul className="space-y-2">
						{players.map((p) => (
							<li
								className="rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm"
								key={p.player_id}
							>
								{p.name} {p.is_host ? "(host)" : ""}
							</li>
						))}
						{players.length === 0 && (
							<li className="text-slate-400 text-sm">Waiting for players...</li>
						)}
					</ul>
					{playerSession.isHost && (
						<div className="mt-4 flex gap-3">
							<button
								className="rounded-lg bg-indigo-600 px-4 py-2 font-semibold text-sm transition-colors hover:bg-indigo-500"
								onClick={() => socket.send("start_game")}
								type="button"
							>
								Start Game
							</button>
							<button
								className="rounded-lg border border-slate-500 px-4 py-2 font-semibold text-sm transition-colors hover:bg-slate-700"
								onClick={() => socket.send("end_game")}
								type="button"
							>
								End Game
							</button>
						</div>
					)}
				</div>

				<div className="rounded-2xl border border-slate-700 bg-slate-800 p-6">
					<h2 className="mb-3 font-semibold text-xl">Realtime Feed</h2>
					{socket.error && (
						<p className="mb-3 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-red-200 text-sm">
							{socket.error}
						</p>
					)}
					<ul className="space-y-2 text-slate-300 text-sm">
						{socket.events.map((event, index) => (
							<li
								className="rounded-lg border border-slate-600 bg-slate-900 px-3 py-2"
								key={`${event.type}-${index}`}
							>
								{event.type}
								{event.detail ? ` - ${event.detail}` : ""}
							</li>
						))}
						{socket.events.length === 0 && (
							<li className="text-slate-400">No events yet.</li>
						)}
					</ul>
				</div>
			</div>
		</main>
	);
}
