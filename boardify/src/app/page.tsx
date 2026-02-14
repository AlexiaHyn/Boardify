"use client";

import { useState, type FormEvent } from "react";

const API_BASE =
	process.env.NEXT_PUBLIC_MODAL_ENDPOINT ?? "http://localhost:8000";

// ---------------------------------------------------------------------------
// Types matching the backend GenerateResponse schema
// ---------------------------------------------------------------------------
interface CardType {
	name: string;
	count: number;
	description: string;
	art_prompt: string;
}

interface GameData {
	name: string;
	tagline: string;
	player_count: { min: number; max: number };
	overview: string;
	components: { description: string; total_cards: number };
	card_types: CardType[];
	setup: string[];
	rules: {
		turn_structure: string[];
		winning_condition: string;
		special_rules: string[];
	};
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function HomePage() {
	const [prompt, setPrompt] = useState("");
	const [game, setGame] = useState<GameData | null>(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	async function onSubmit(e: FormEvent) {
		e.preventDefault();
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
		} catch (err) {
			setError(err instanceof Error ? err.message : "Something went wrong.");
		} finally {
			setLoading(false);
		}
	}

	return (
		<main className="flex min-h-screen flex-col items-center bg-gradient-to-b from-[#0f172a] to-[#1e293b] px-4 py-12 text-white">
			{/* Header */}
			<div className="mb-10 text-center">
				<h1 className="font-extrabold text-5xl tracking-tight sm:text-6xl">
					Boardify
				</h1>
				<p className="mt-3 text-lg text-slate-400">
					Describe a card game idea and we'll design the full game for you.
				</p>
			</div>

			{/* Prompt input */}
			<form onSubmit={onSubmit} className="w-full max-w-2xl">
				<div className="flex gap-3">
					<input
						type="text"
						value={prompt}
						onChange={(e) => setPrompt(e.target.value)}
						placeholder='e.g. "Exploding Kittens with 5 diffuser cards"'
						className="flex-1 rounded-xl border border-slate-600 bg-slate-800 px-5 py-3 text-white placeholder-slate-500 outline-none transition-colors focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
					/>
					<button
						type="submit"
						disabled={loading || !prompt.trim()}
						className="rounded-xl bg-indigo-600 px-6 py-3 font-semibold transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
					>
						{loading ? (
							<span className="flex items-center gap-2">
								<svg
									className="h-5 w-5 animate-spin"
									viewBox="0 0 24 24"
									fill="none"
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
										fill="currentColor"
										d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
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

			{/* Error */}
			{error && (
				<div className="mt-6 w-full max-w-2xl rounded-xl border border-red-500/30 bg-red-500/10 px-5 py-4 text-red-300">
					{error}
				</div>
			)}

			{/* Results */}
			{game && (
				<div className="mt-8 w-full max-w-3xl space-y-6">
					{/* Title & overview */}
					<section className="rounded-2xl border border-slate-700 bg-slate-800 p-6">
						<h2 className="font-bold text-3xl text-indigo-300">
							{game.name}
						</h2>
						<p className="mt-1 text-lg italic text-slate-400">
							{game.tagline}
						</p>
						<p className="mt-3 text-slate-300">{game.overview}</p>
						<div className="mt-3 flex gap-4 text-sm text-slate-400">
							<span>
								Players: {game.player_count.min}–{game.player_count.max}
							</span>
							<span>Total cards: {game.components.total_cards}</span>
						</div>
					</section>

					{/* Cards */}
					<section className="rounded-2xl border border-slate-700 bg-slate-800 p-6">
						<h3 className="mb-4 font-bold text-xl text-indigo-300">
							Card Types
						</h3>
						<div className="grid gap-3 sm:grid-cols-2">
							{game.card_types.map((card) => (
								<div
									key={card.name}
									className="rounded-xl border border-slate-600 bg-slate-900/50 p-4"
								>
									<div className="flex items-baseline justify-between">
										<h4 className="font-semibold text-white">
											{card.name}
										</h4>
										<span className="text-sm text-slate-500">
											x{card.count}
										</span>
									</div>
									<p className="mt-1 text-sm text-slate-400">
										{card.description}
									</p>
									<p className="mt-2 text-xs italic text-slate-500">
										Art: {card.art_prompt}
									</p>
								</div>
							))}
						</div>
					</section>

					{/* Setup */}
					<section className="rounded-2xl border border-slate-700 bg-slate-800 p-6">
						<h3 className="mb-3 font-bold text-xl text-indigo-300">
							Setup
						</h3>
						<ol className="list-inside list-decimal space-y-1 text-slate-300">
							{game.setup.map((step) => (
								<li key={step}>{step}</li>
							))}
						</ol>
					</section>

					{/* Rules */}
					<section className="rounded-2xl border border-slate-700 bg-slate-800 p-6">
						<h3 className="mb-3 font-bold text-xl text-indigo-300">
							Rules
						</h3>

						<h4 className="mt-2 font-medium text-slate-200">
							Turn Structure
						</h4>
						<ol className="list-inside list-decimal space-y-1 text-slate-300">
							{game.rules.turn_structure.map((step) => (
								<li key={step}>{step}</li>
							))}
						</ol>

						<h4 className="mt-4 font-medium text-slate-200">
							Winning Condition
						</h4>
						<p className="text-slate-300">
							{game.rules.winning_condition}
						</p>

						{game.rules.special_rules.length > 0 && (
							<>
								<h4 className="mt-4 font-medium text-slate-200">
									Special Rules
								</h4>
								<ul className="list-inside list-disc space-y-1 text-slate-300">
									{game.rules.special_rules.map((rule) => (
										<li key={rule}>{rule}</li>
									))}
								</ul>
							</>
						)}
					</section>
				</div>
			)}
		</main>
	);
}
