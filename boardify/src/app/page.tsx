"use client";

import { useState, useEffect, useCallback, type FormEvent } from "react";
import { motion, AnimatePresence } from "motion/react";
import type { GameData } from "~/types/game";
import GameEditor from "~/components/GameEditor";

const API_BASE =
	process.env.NEXT_PUBLIC_MODAL_ENDPOINT ?? "http://localhost:8000";

const EXAMPLE_PROMPTS = [
	"Exploding Kittens with 5 diffuser cards",
	"A bluffing game for 4 players with hidden roles",
	"Uno but every card has a spell effect",
	"Cooperative survival horror card game",
	"Poker meets deck-building with fantasy creatures",
	"A fast 2-player dueling card game",
];

/* ─── Typing Animation Hook ───────────────────────────────────────────── */
function useTypingAnimation(
	phrases: string[],
	typingSpeed = 45,
	deletingSpeed = 25,
	pauseMs = 2200,
) {
	const [display, setDisplay] = useState("");
	const [phraseIdx, setPhraseIdx] = useState(0);
	const [charIdx, setCharIdx] = useState(0);
	const [isDeleting, setIsDeleting] = useState(false);

	useEffect(() => {
		const current = phrases[phraseIdx] ?? "";

		if (!isDeleting && charIdx <= current.length) {
			if (charIdx === current.length) {
				// Pause at full phrase, then start deleting
				const timeout = setTimeout(() => setIsDeleting(true), pauseMs);
				return () => clearTimeout(timeout);
			}
			const timeout = setTimeout(() => {
				setDisplay(current.slice(0, charIdx + 1));
				setCharIdx((c) => c + 1);
			}, typingSpeed);
			return () => clearTimeout(timeout);
		}

		if (isDeleting && charIdx > 0) {
			const timeout = setTimeout(() => {
				setDisplay(current.slice(0, charIdx - 1));
				setCharIdx((c) => c - 1);
			}, deletingSpeed);
			return () => clearTimeout(timeout);
		}

		if (isDeleting && charIdx === 0) {
			setIsDeleting(false);
			setPhraseIdx((i) => (i + 1) % phrases.length);
		}
	}, [
		charIdx,
		isDeleting,
		phraseIdx,
		phrases,
		typingSpeed,
		deletingSpeed,
		pauseMs,
	]);

	return display;
}

/* ─── Compass Rose Loading SVG ────────────────────────────────────────── */
function CompassRose() {
	return (
		<div className="relative flex items-center justify-center">
			<div className="absolute h-36 w-36 rounded-full border border-[var(--color-gold-dim)] opacity-20 animate-[radialPulse_2.5s_ease-in-out_infinite]" />
			<div className="absolute h-44 w-44 rounded-full border border-[var(--color-gold-dim)] opacity-10 animate-[radialPulse_2.5s_ease-in-out_infinite_0.5s]" />
			<svg
				width="120"
				height="120"
				viewBox="0 0 120 120"
				fill="none"
				className="animate-[compassSpin_8s_linear_infinite]"
			>
				<circle
					cx="60"
					cy="60"
					r="50"
					stroke="var(--color-gold)"
					strokeWidth="1.5"
					strokeDasharray="314"
					className="animate-[drawCircle_2s_ease-out_forwards]"
					opacity="0.6"
				/>
				<circle
					cx="60"
					cy="60"
					r="35"
					stroke="var(--color-gold-dim)"
					strokeWidth="1"
					strokeDasharray="220"
					className="animate-[drawCircle_2.5s_ease-out_forwards]"
					opacity="0.4"
				/>
				<line
					x1="60"
					y1="60"
					x2="60"
					y2="15"
					stroke="var(--color-gold)"
					strokeWidth="2"
					strokeLinecap="round"
					strokeDasharray="45"
					className="animate-[drawNeedle_1.5s_ease-out_0.5s_forwards]"
					opacity="0.8"
				/>
				<line
					x1="60"
					y1="60"
					x2="60"
					y2="105"
					stroke="var(--color-gold-dim)"
					strokeWidth="1.5"
					strokeLinecap="round"
					strokeDasharray="45"
					className="animate-[drawNeedle_1.5s_ease-out_0.7s_forwards]"
					opacity="0.5"
				/>
				<line
					x1="60"
					y1="60"
					x2="105"
					y2="60"
					stroke="var(--color-gold-dim)"
					strokeWidth="1.5"
					strokeLinecap="round"
					strokeDasharray="45"
					className="animate-[drawNeedle_1.5s_ease-out_0.9s_forwards]"
					opacity="0.5"
				/>
				<line
					x1="60"
					y1="60"
					x2="15"
					y2="60"
					stroke="var(--color-gold-dim)"
					strokeWidth="1.5"
					strokeLinecap="round"
					strokeDasharray="45"
					className="animate-[drawNeedle_1.5s_ease-out_1.1s_forwards]"
					opacity="0.5"
				/>
				<line
					x1="60"
					y1="60"
					x2="92"
					y2="28"
					stroke="var(--color-gold-dim)"
					strokeWidth="1"
					strokeLinecap="round"
					strokeDasharray="45"
					className="animate-[drawNeedle_1.5s_ease-out_1.3s_forwards]"
					opacity="0.3"
				/>
				<line
					x1="60"
					y1="60"
					x2="28"
					y2="92"
					stroke="var(--color-gold-dim)"
					strokeWidth="1"
					strokeLinecap="round"
					strokeDasharray="45"
					className="animate-[drawNeedle_1.5s_ease-out_1.5s_forwards]"
					opacity="0.3"
				/>
				<circle
					cx="60"
					cy="60"
					r="3"
					fill="var(--color-gold)"
					className="animate-[fadeIn_0.5s_ease-out_0.3s_both]"
				/>
			</svg>
		</div>
	);
}

/* ─── Decorative Diamond ──────────────────────────────────────────────── */
function Diamond({ className = "" }: { className?: string }) {
	return (
		<svg width="8" height="8" viewBox="0 0 8 8" className={className}>
			<path d="M4 0L8 4L4 8L0 4Z" fill="currentColor" />
		</svg>
	);
}

export default function HomePage() {
	const [prompt, setPrompt] = useState("");
	const [game, setGame] = useState<GameData | null>(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const typedText = useTypingAnimation(EXAMPLE_PROMPTS);

	// Hide animated placeholder when focused or has content
	const [inputFocused, setInputFocused] = useState(false);
	const showAnimatedPlaceholder = !inputFocused && prompt.length === 0;

	const handlePromptChange = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			setPrompt(e.target.value);
		},
		[],
	);

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
		} catch (err) {
			setError(
				err instanceof Error ? err.message : "Something went wrong.",
			);
		} finally {
			setLoading(false);
		}
	}

	function handleRegenerate() {
		setGame(null);
		setTimeout(() => void generate(), 100);
	}

	/* Keep centered while on landing OR loading (only un-center for editor) */
	const isCentered = !game;

	return (
		<main className="relative flex min-h-screen flex-col items-center px-4 py-12">
			{/* Warm radial glow backdrop */}
			<div
				className="pointer-events-none fixed inset-0 z-0"
				style={{
					background: `
						radial-gradient(ellipse 60% 40% at 50% 30%, rgba(201, 168, 76, 0.06) 0%, transparent 70%),
						radial-gradient(ellipse 80% 50% at 50% 100%, rgba(30, 26, 38, 0.8) 0%, transparent 60%),
						linear-gradient(to bottom, var(--color-bg-deep) 0%, var(--color-bg-base) 100%)
					`,
				}}
			/>

			{/* Content layer */}
			<div
				className={`relative z-10 flex w-full flex-col items-center transition-all duration-700 ease-out ${
					isCentered
						? "min-h-[calc(100vh-6rem)] justify-center"
						: ""
				}`}
			>
				{/* Header */}
				<motion.div
					className="text-center"
					initial={{ opacity: 0, y: 20 }}
					animate={{ opacity: 1, y: 0 }}
					layout="position"
					transition={{
						layout: { duration: 0.6, ease: [0.4, 0, 0.2, 1] },
						duration: 0.7,
						ease: "easeOut",
					}}
				>
					{/* Decorative top element */}
					<div className="mb-4 flex items-center justify-center gap-3">
						<div className="h-px w-12 bg-gradient-to-r from-transparent to-[var(--color-gold-dim)] opacity-50" />
						<Diamond className="text-[var(--color-gold)] opacity-50" />
						<div className="h-px w-12 bg-gradient-to-l from-transparent to-[var(--color-gold-dim)] opacity-50" />
					</div>

					<h1 className="font-display text-5xl font-semibold tracking-[0.15em] text-[var(--color-cream)] sm:text-7xl">
						BOARDIFY
					</h1>

					<p className="font-body mt-4 text-lg font-light tracking-wide text-[var(--color-stone)]">
						{game
							? "Your game blueprint is ready \u2014 click any field to refine it."
							: "Describe a card game idea and watch it come to life."}
					</p>

					{/* Decorative bottom element */}
					<div className="mt-4 flex items-center justify-center gap-3">
						<div className="h-px w-16 bg-gradient-to-r from-transparent to-[var(--color-gold-dim)] opacity-40" />
						<Diamond className="text-[var(--color-gold-dim)] opacity-40" />
						<div className="h-px w-16 bg-gradient-to-l from-transparent to-[var(--color-gold-dim)] opacity-40" />
					</div>
				</motion.div>

				{/* Central area: form → loading → error, sequenced with mode="wait" */}
				<AnimatePresence mode="wait">
					{!game && !loading && !error && (
						<motion.form
							key="prompt-form"
							onSubmit={generate}
							className="mt-10 w-full max-w-2xl"
							initial={{ opacity: 0, y: 15 }}
							animate={{ opacity: 1, y: 0 }}
							exit={{ opacity: 0, scale: 0.98, filter: "blur(4px)" }}
							transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
						>
							<div className="relative">
								{/* Ornamental wrapper */}
								<div className="relative overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-lg shadow-black/20">
									<div className="flex items-center">
										{/* Compass icon */}
										<div className="flex shrink-0 items-center justify-center pl-5">
											<svg
												width="20"
												height="20"
												viewBox="0 0 24 24"
												fill="none"
												stroke="var(--color-gold-dim)"
												strokeWidth="1.5"
												strokeLinecap="round"
												strokeLinejoin="round"
											>
												<circle
													cx="12"
													cy="12"
													r="10"
												/>
												<polygon
													points="16.24,7.76 14.12,14.12 7.76,16.24 9.88,9.88"
													fill="var(--color-gold-muted)"
													stroke="var(--color-gold-dim)"
												/>
											</svg>
										</div>

										{/* Input with animated placeholder */}
										<div className="relative flex-1">
											<input
												type="text"
												value={prompt}
												onChange={handlePromptChange}
												onFocus={() =>
													setInputFocused(true)
												}
												onBlur={() =>
													setInputFocused(false)
												}
												className="input-naked font-body relative z-10 w-full border-none bg-transparent px-4 py-4 text-base text-[var(--color-cream)] outline-none"
											/>
											{/* Custom animated placeholder — hidden on focus */}
											{showAnimatedPlaceholder && (
												<div className="pointer-events-none absolute inset-0 flex items-center px-4">
													<span className="font-body text-base font-light text-[var(--color-stone-dim)]">
														{typedText}
													</span>
													<span className="ml-[1px] inline-block h-[1.1em] w-[2px] translate-y-[1px] animate-[blink_1s_steps(2)_infinite] bg-[var(--color-gold-dim)]" />
												</div>
											)}
										</div>

										<div className="pr-2">
											<button
												type="submit"
												disabled={
													loading || !prompt.trim()
												}
												className="btn-press rounded-lg bg-[var(--color-crimson)] px-6 py-2.5 font-display text-sm font-medium tracking-wider text-[var(--color-cream)] transition-all hover:bg-[var(--color-crimson-bright)] hover:shadow-lg hover:shadow-[var(--color-crimson)]/20 disabled:cursor-not-allowed disabled:opacity-40"
											>
												GENERATE
											</button>
										</div>
									</div>
								</div>

								{/* Subtle glow under input */}
								<div className="absolute -bottom-4 left-1/2 h-8 w-3/4 -translate-x-1/2 rounded-full bg-[var(--color-gold)] opacity-[0.03] blur-xl" />
							</div>

							{/* Suggestion chips */}
							<motion.div
								className="mt-5 flex flex-wrap items-center justify-center gap-2"
								initial={{ opacity: 0 }}
								animate={{ opacity: 1 }}
								transition={{ delay: 0.5, duration: 0.5 }}
							>
								<span className="font-body text-xs text-[var(--color-stone-dim)]">
									Or try:
								</span>
								{[
									"A bluffing game for 4 players",
									"Uno but with spell cards",
									"Cooperative survival card game",
								].map((suggestion) => (
									<button
										key={suggestion}
										type="button"
										onClick={() => setPrompt(suggestion)}
										className="btn-press rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1 font-body text-xs text-[var(--color-stone)] transition-all hover:border-[var(--color-gold-dim)] hover:text-[var(--color-cream)]"
									>
										{suggestion}
									</button>
								))}
							</motion.div>
						</motion.form>
					)}

					{loading && !game && (
						<motion.div
							key="loading"
							className="mt-14 flex flex-col items-center gap-4"
							initial={{ opacity: 0, scale: 0.9 }}
							animate={{ opacity: 1, scale: 1 }}
							exit={{ opacity: 0, scale: 0.95 }}
							transition={{
								duration: 0.5,
								ease: [0.4, 0, 0.2, 1],
							}}
						>
							<CompassRose />
							<motion.p
								className="font-body text-sm tracking-widest text-[var(--color-gold)] pt-6 pb-2"
								initial={{ opacity: 0, y: 8 }}
								animate={{ opacity: 1, y: 0 }}
								transition={{ delay: 0.3, duration: 0.5 }}
							>
								<span className="animate-pulse-glow">
									Designing your game blueprint...
								</span>
							</motion.p>
							<motion.p
								className="font-body text-xs text-[var(--color-stone-dim)]"
								initial={{ opacity: 0 }}
								animate={{ opacity: 1 }}
								transition={{ delay: 0.6, duration: 0.5 }}
							>
								This may take a moment
							</motion.p>
						</motion.div>
					)}

					{error && !loading && !game && (
						<motion.div
							key="error"
							className="mt-10 w-full max-w-2xl rounded-xl border border-[var(--color-crimson-dim)] bg-[var(--color-crimson)]/10 px-5 py-4 font-body text-[var(--color-crimson-bright)]"
							initial={{ opacity: 0, y: 10 }}
							animate={{ opacity: 1, y: 0 }}
							exit={{ opacity: 0 }}
							transition={{ duration: 0.35 }}
						>
							<div className="flex items-start gap-3">
								<svg
									width="18"
									height="18"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									strokeWidth="2"
									className="mt-0.5 shrink-0"
								>
									<circle cx="12" cy="12" r="10" />
									<line x1="15" y1="9" x2="9" y2="15" />
									<line x1="9" y1="9" x2="15" y2="15" />
								</svg>
								<span>{error}</span>
							</div>
						</motion.div>
					)}
				</AnimatePresence>

				{/* Editor */}
				<AnimatePresence>
					{game && (
						<motion.div
							key="editor"
							initial={{ opacity: 0, y: 30 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ duration: 0.6, ease: "easeOut" }}
							className="mt-8 w-full"
						>
							<GameEditor
								initialGame={game}
								onRegenerate={handleRegenerate}
								prompt={prompt}
							/>
						</motion.div>
					)}
				</AnimatePresence>
			</div>
		</main>
	);
}
