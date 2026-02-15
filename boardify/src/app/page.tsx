"use client";

import Link from "next/link";
import { type FormEvent, useState } from "react";
import AppNav from "~/components/AppNav";
import GameEditor from "~/components/GameEditor";
import type { GameData } from "~/types/game";

const API_BASE =
	process.env.NEXT_PUBLIC_MODAL_ENDPOINT ?? "http://localhost:8000";

export default function HomePage() {
	const [prompt, setPrompt] = useState("");
	const [game, setGame] = useState<GameData | null>(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	async function generate(e?: FormEvent) {
		e?.preventDefault();
		if (!prompt.trim()) return;

		setLoading(true);
		setError(null);
		setGame(null);

		try {
			const res = await fetch(`${API_BASE}/api/v1/generate`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ prompt }),
			});

			if (!res.ok) {
				const detail = await res.json().catch(() => null);
				throw new Error(
					(detail as { detail?: string })?.detail ??
						`Server responded with ${res.status}`,
				);
			}

			const data = (await res.json()) as GameData;
			setGame(data);
			window.localStorage.setItem(
				"boardify:lastGeneratedGame",
				JSON.stringify(data),
			);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Something went wrong.");
		} finally {
			setLoading(false);
		}
	}

	function handleRegenerate() {
		setGame(null);
		setTimeout(() => void generate(), 100);
	}

	return (
		<main className="flex min-h-screen flex-col items-center bg-gradient-to-b from-[#0f172a] to-[#1e293b] px-4 py-12 text-white">
			{/* Header */}
			<div className="mb-10 text-center">
				<h1 className="font-extrabold text-5xl tracking-tight sm:text-6xl">
					Boardify
				</h1>
				<p className="mt-3 text-lg text-slate-400">
					{game
						? "Edit your game blueprint — click any field to change it."
						: "Describe a card game idea and we'll design the full blueprint."}
				</p>
			</div>
			<AppNav />

			{/* Prompt input */}
			{!game && (
				<form className="mb-8 w-full max-w-2xl" onSubmit={generate}>
					<div className="flex gap-3">
						<input
							className="flex-1 rounded-xl border border-slate-600 bg-slate-800 px-5 py-3 text-white placeholder-slate-500 outline-none transition-colors focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
							onChange={(e) => setPrompt(e.target.value)}
							placeholder='e.g. "Exploding Kittens with 5 diffuser cards"'
							type="text"
							value={prompt}
						/>
						<button
							className="rounded-xl bg-indigo-600 px-6 py-3 font-semibold transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
							disabled={loading || !prompt.trim()}
							type="submit"
						>
							{loading ? (
								<span className="flex items-center gap-2">
									<svg
										aria-hidden="true"
										className="h-5 w-5 animate-spin"
										fill="none"
										viewBox="0 0 24 24"
									>
										<circle
											className="opacity-25"
											cx="12"
											cy="12"
											r="10"
											stroke="currentColor"
											strokeWidth="4"
										/>
										<path
											className="opacity-75"
											d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
											fill="currentColor"
										/>
									</svg>
									Generating...
								</span>
							) : (
								"Generate"
							)}
						</button>
					</div>
				</form>
			)}

			{/* Loading */}
			{loading && !game && (
				<div className="flex flex-col items-center gap-3 text-slate-400">
					<svg
						aria-hidden="true"
						className="h-10 w-10 animate-spin text-indigo-500"
						fill="none"
						viewBox="0 0 24 24"
					>
						<circle
							className="opacity-25"
							cx="12"
							cy="12"
							r="10"
							stroke="currentColor"
							strokeWidth="4"
						/>
						<path
							className="opacity-75"
							d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
							fill="currentColor"
						/>
					</svg>
					<p>Designing your game blueprint...</p>
				</div>
			)}

			{/* Error */}
			{error && (
				<div className="mb-6 w-full max-w-2xl rounded-xl border border-red-500/30 bg-red-500/10 px-5 py-4 text-red-300">
					{error}
				</div>
			)}

			{/* Editor */}
			{game && (
				<div className="w-full max-w-3xl space-y-6">
					<div className="flex justify-end">
						<Link
							className="rounded-xl bg-indigo-600 px-4 py-2 font-semibold text-sm text-white transition-colors hover:bg-indigo-500"
							href="/host"
						>
							Host This Game
						</Link>
					</div>
					<GameEditor initialGame={game} onRegenerate={handleRegenerate} />
				</div>
			)}
		</main>
	);
}
