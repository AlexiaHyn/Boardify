"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { generateGame } from "@/lib/api";
import { addGame } from "@/lib/games";

/* ─── Example prompts for typing animation ─────────────────────────── */

const EXAMPLE_PROMPTS = [
	"Exploding Kittens with 5 diffuser cards",
	"A bluffing game for 4 players with hidden roles",
	"Uno but every card has a spell effect",
	"Cooperative survival horror card game",
	"Poker meets deck-building with fantasy creatures",
	"A fast 2-player dueling card game",
];

/* ─── Typing Animation Hook ───────────────────────────────────────── */

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

/* ─── Compass Rose Loading SVG ────────────────────────────────────── */

function CompassRose() {
	return (
		<div className="relative flex items-center justify-center my-10">
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

/* ─── Decorative Diamond ──────────────────────────────────────────── */

function Diamond({ className = "" }: { className?: string }) {
	return (
		<svg width="8" height="8" viewBox="0 0 8 8" className={className}>
			<path d="M4 0L8 4L4 8L0 4Z" fill="currentColor" />
		</svg>
	);
}

/* ─── Page ────────────────────────────────────────────────────────── */

export default function HomePage() {
	const router = useRouter();
	const [prompt, setPrompt] = useState("");
	const typedText = useTypingAnimation(EXAMPLE_PROMPTS);

	const [inputFocused, setInputFocused] = useState(false);
	const showAnimatedPlaceholder = !inputFocused && prompt.length === 0;

	// AI generation state
	const [generating, setGenerating] = useState(false);
	const [genMessage, setGenMessage] = useState("");
	const [error, setError] = useState("");

	// True while generating or showing the success message before redirect
	const hideChrome = generating || !!genMessage;

	const handleGenerate = async () => {
		if (!prompt.trim()) {
			setError("Enter a game idea to generate");
			return;
		}
		setGenerating(true);
		setError("");
		setGenMessage("Designing your game blueprint…");
		try {
			const res = await generateGame(prompt.trim());
			if (res.success) {
				setGenMessage(`"${res.game_name}" is ready to play!`);
				// Register the new game in the frontend catalogue
				addGame(res.game_id, res.game_name, res.description);
				setPrompt("");
				// Navigate to room creation for the new game
				setTimeout(() => {
					router.push(`/room?game=${res.game_id}`);
				}, 1200);
			} else {
				setGenMessage("");
				setError(res.message || "Generation failed");
			}
		} catch (e) {
			setGenMessage("");
			setError((e as Error).message);
		} finally {
			setGenerating(false);
		}
	};

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
			<div className="relative z-10 flex w-full min-h-[calc(100vh-6rem)] flex-col items-center justify-center">
				{/* Header */}
				<div className="text-center animate-fade-in-up">
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
						Describe a card game idea and watch it come to life.
					</p>

					{/* Decorative bottom element */}
					<div className="mt-4 flex items-center justify-center gap-3">
						<div className="h-px w-16 bg-gradient-to-r from-transparent to-[var(--color-gold-dim)] opacity-40" />
						<Diamond className="text-[var(--color-gold-dim)] opacity-40" />
						<div className="h-px w-16 bg-gradient-to-l from-transparent to-[var(--color-gold-dim)] opacity-40" />
					</div>
				</div>

				{/* Input form */}
				<form
					onSubmit={(e) => {
						e.preventDefault();
						handleGenerate();
					}}
					className="mt-10 w-full max-w-2xl animate-fade-in-up stagger-2"
				>
					<div
						className={`relative transition-all duration-500 ease-out ${hideChrome ? "opacity-0 scale-95 pointer-events-none" : "opacity-100 scale-100"}`}
					>
						{/* Ornamental input wrapper */}
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
										<circle cx="12" cy="12" r="10" />
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
										onChange={(e) =>
											setPrompt(e.target.value)
										}
										onFocus={() => setInputFocused(true)}
										onBlur={() => setInputFocused(false)}
										disabled={generating}
										className="input-naked font-body relative z-10 w-full border-none bg-transparent px-4 py-4 text-base text-[var(--color-cream)] outline-none disabled:opacity-50"
									/>
									{/* Animated typing placeholder */}
									{showAnimatedPlaceholder && (
										<div className="pointer-events-none absolute inset-0 flex items-center px-4">
											<span className="font-body text-base font-light text-[var(--color-stone-dim)]">
												{typedText}
											</span>
											<span className="ml-[1px] inline-block h-[1.1em] w-[2px] translate-y-[1px] animate-blink bg-[var(--color-gold-dim)]" />
										</div>
									)}
								</div>

								<div className="pr-2">
									<button
										type="submit"
										disabled={generating || !prompt.trim()}
										className="btn-press rounded-lg bg-[var(--color-crimson)] px-6 py-2.5 font-display text-sm font-medium tracking-wider text-[var(--color-cream)] transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
									>
										{generating
											? "GENERATING…"
											: "GENERATE"}
									</button>
								</div>
							</div>
						</div>

						{/* Subtle glow under input */}
						<div className="absolute -bottom-4 left-1/2 h-8 w-3/4 -translate-x-1/2 rounded-full bg-[var(--color-gold)] opacity-[0.03] blur-xl" />
					</div>

					{/* Generation loading overlay */}
					{genMessage && (
						<div
							className="mt-6 flex flex-col items-center gap-4 transition-all duration-500 ease-out"
							style={{
								animation: "fadeInUp 0.6s ease-out both",
							}}
						>
							{generating && <CompassRose />}
							<p
								className="font-body text-sm tracking-widest text-[var(--color-gold)] pt-2"
								style={{
									animation: "fadeIn 0.5s ease-out 0.3s both",
								}}
							>
								<span className="animate-pulse-glow">
									{genMessage}
								</span>
							</p>
							{generating && (
								<p
									className="font-body text-xs text-[var(--color-stone-dim)]"
									style={{
										animation:
											"fadeIn 0.5s ease-out 0.6s both",
									}}
								>
									This may take a moment
								</p>
							)}
						</div>
					)}

					{/* Error message */}
					{error && (
						<p className="mt-3 text-center font-body text-sm text-[var(--color-crimson)] bg-red-900/20 rounded-lg px-4 py-2">
							{error}
						</p>
					)}

					{/* Suggestion chips */}
					<div className={`mt-5 flex flex-wrap items-center justify-center gap-2 animate-fade-in stagger-4 transition-all duration-500 ease-out ${hideChrome ? "opacity-0 translate-y-2 pointer-events-none" : "opacity-100 translate-y-0"}`}>
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
								disabled={generating}
								className="btn-press rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1 font-body text-xs text-[var(--color-stone)] transition-all hover:border-[var(--color-gold-dim)] hover:text-[var(--color-cream)] disabled:opacity-40 disabled:cursor-not-allowed"
							>
								{suggestion}
							</button>
						))}
					</div>
				</form>

				{/* Divider + Browse Games CTA */}
				<div className={`flex flex-col items-center transition-all duration-500 ease-out delay-100 ${hideChrome ? "opacity-0 translate-y-4 pointer-events-none" : "opacity-100 translate-y-0"}`}>
					<div className="mt-12 flex w-full max-w-md items-center gap-4 animate-fade-in stagger-6">
						<div className="h-px flex-1 bg-gradient-to-r from-transparent via-[var(--color-gold-dim)] to-transparent opacity-30" />
						<span className="font-display text-[10px] tracking-[0.2em] uppercase text-[var(--color-stone-dim)]">
							or play now
						</span>
						<div className="h-px flex-1 bg-gradient-to-r from-transparent via-[var(--color-gold-dim)] to-transparent opacity-30" />
					</div>

					<Link
						href="/showcase"
						className="mt-6 btn-press flex items-center gap-2 rounded-lg border border-[var(--color-gold-dim)] px-6 py-3 font-display text-xs font-medium tracking-wider text-[var(--color-gold)] transition-all hover:border-[var(--color-gold)] hover:bg-[var(--color-gold-muted)] hover:text-[var(--color-gold-bright)] animate-fade-in stagger-7"
					>
						BROWSE GAMES
						<span className="text-sm">&#8594;</span>
					</Link>
				</div>
			</div>
		</main>
	);
}
