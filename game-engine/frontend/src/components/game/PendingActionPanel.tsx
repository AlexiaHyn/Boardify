"use client";

import { useState, useEffect, useRef } from "react";
import type { Card, GameState, Player, Choice } from "@/types/game";
import { GameCard } from "./GameCard";

interface PendingActionPanelProps {
	gameState: GameState;
	localPlayerId: string;
	onInsertExploding: (position: number) => void;
	onGiveCard: (cardId: string) => void;
	onSelectTarget: (targetPlayerId: string) => void;
	onPlayNope?: (cardId: string) => void;
	onRespond?: (actionType: string, value: string) => void;
	onResolveNopeWindow?: () => void;
}

export function PendingActionPanel({
	gameState,
	localPlayerId,
	onInsertExploding,
	onGiveCard,
	onSelectTarget,
	onPlayNope,
	onRespond,
	onResolveNopeWindow,
}: PendingActionPanelProps) {
	const pending = gameState.pendingAction;
	if (!pending) return null;
	if (gameState.phase !== "awaiting_response") return null;

	// Generic choice modal: for actions with choices array (color selection, etc.)
	if (
		pending.choices &&
		pending.choices.length > 0 &&
		pending.playerId === localPlayerId &&
		onRespond
	) {
		return (
			<ChoiceModal
				choices={pending.choices}
				prompt={pending.prompt || "Make a choice"}
				onChoose={(value) => onRespond(pending.type, value)}
			/>
		);
	}

	if (
		pending.type === "insert_exploding" &&
		pending.playerId === localPlayerId
	) {
		return (
			<InsertExplodingModal
				deckSize={pending.deckSize ?? 0}
				onInsert={onInsertExploding}
			/>
		);
	}

	if (pending.type === "favor" && pending.targetPlayerId === localPlayerId) {
		const localPlayer = gameState.players.find(
			(p) => p.id === localPlayerId,
		);
		const requester = gameState.players.find(
			(p) => p.id === pending.playerId,
		);
		if (localPlayer && requester) {
			return (
				<GiveCardModal
					player={localPlayer}
					requesterName={requester.name}
					onGive={onGiveCard}
				/>
			);
		}
	}

	// Nope window: shown after any action card is played in Exploding Kittens.
	// All players can see it; players with Nope cards can counter.
	if (pending.type === "nope_window" && onResolveNopeWindow) {
		const localPlayer = gameState.players.find(
			(p) => p.id === localPlayerId,
		);
		const nopeCard = localPlayer?.hand.cards.find(
			(c) => c.subtype === "nope",
		);
		const cardPlayer = gameState.players.find(
			(p) => p.id === pending.playerId,
		);
		const cardName = (pending.cardName as string) || "action";
		const nopeCount = (pending.nopeCount as number) || 0;

		return (
			<NopeWindow
				nopeCard={nopeCard ?? null}
				onNope={onPlayNope ?? (() => {})}
				onResolve={onResolveNopeWindow}
				cardName={cardName}
				playerName={cardPlayer?.name ?? "Someone"}
				nopeCount={nopeCount}
				isCardPlayer={pending.playerId === localPlayerId}
			/>
		);
	}

	// Legacy Nope support for other pending types (non-nope_window)
	if (
		pending.type !== "insert_exploding" &&
		pending.type !== "favor" &&
		pending.type !== "nope_window" &&
		onPlayNope
	) {
		const localPlayer = gameState.players.find(
			(p) => p.id === localPlayerId,
		);
		const nopeCard = localPlayer?.hand.cards.find(
			(c) => c.subtype === "nope",
		);
		if (nopeCard) {
			return (
				<LegacyNopeWindow
					nopeCard={nopeCard}
					onNope={onPlayNope}
					pendingType={pending.type}
				/>
			);
		}
	}

	// Generic waiting overlay
	return (
		<div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
			<div className="section-panel max-w-sm text-center">
				<div className="section-panel-inner">
					<div className="relative flex items-center justify-center mb-4">
						<div className="absolute h-20 w-20 rounded-full border border-[var(--color-gold-dim)] opacity-20 animate-[radialPulse_2.5s_ease-in-out_infinite]" />
						<svg
							width="40"
							height="40"
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
								opacity="0.6"
							/>
							<line
								x1="60"
								y1="60"
								x2="60"
								y2="15"
								stroke="var(--color-gold)"
								strokeWidth="2"
								strokeLinecap="round"
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
								opacity="0.5"
							/>
							<circle
								cx="60"
								cy="60"
								r="3"
								fill="var(--color-gold)"
							/>
						</svg>
					</div>
					<p className="font-display font-semibold text-lg tracking-wide text-[var(--color-cream)]">
						Waiting&hellip;
					</p>
					<p className="font-body text-sm text-[var(--color-stone)] mt-2">
						{pending.type === "favor"
							? "Waiting for a player to give a card\u2026"
							: "Waiting for response\u2026"}
					</p>
				</div>
			</div>
		</div>
	);
}
// ── Generic Choice Modal ──────────────────────────────────────────────────────

function ChoiceModal({
	choices,
	prompt,
	onChoose,
}: {
	choices: Choice[];
	prompt: string;
	onChoose: (value: string) => void;
}) {
	return (
		<div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
			<div className="bg-gray-900 rounded-2xl p-8 border border-blue-500/50 text-center max-w-md w-full mx-4 shadow-2xl">
				<h2 className="text-white font-bold text-xl mb-2">{prompt}</h2>

				<div className="grid grid-cols-2 gap-4 mt-6">
					{choices.map((choice) => (
						<button
							key={choice.value}
							onClick={() => onChoose(choice.value)}
							className="bg-gray-800 hover:bg-gray-700 border-2 border-white/20 hover:border-white/40 rounded-xl p-4 transition-all transform hover:scale-105"
						>
							{choice.icon && (
								<div className="text-4xl mb-2">
									{choice.icon}
								</div>
							)}
							<div className="text-white font-semibold">
								{choice.label}
							</div>
						</button>
					))}
				</div>
			</div>
		</div>
	);
}

// ── Insert Exploding Kitten ───────────────────────────────────────────────────

function InsertExplodingModal({
	deckSize,
	onInsert,
}: {
	deckSize: number;
	onInsert: (pos: number) => void;
}) {
	const [position, setPosition] = useState(0);
	const max = deckSize;

	return (
		<div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
			<div
				className="section-panel max-w-md w-full mx-4 text-center"
				style={{ borderColor: "var(--color-amber)" }}
			>
				<div className="section-panel-inner">
					<div className="text-5xl mb-4">&#128163;</div>
					<h2 className="font-display text-xl font-semibold tracking-wide text-[var(--color-cream)] mb-2">
						You Defused It!
					</h2>
					<p className="font-body text-sm text-[var(--color-stone)] mb-6">
						Choose where to secretly reinsert the Exploding Kitten
						into the deck. Position 0 = top, {max} = bottom.
					</p>

					<div className="mb-6">
						<label className="font-body text-sm text-[var(--color-stone)] block mb-2">
							Position:{" "}
							<span className="text-[var(--color-gold)] font-bold text-lg">
								{position}
							</span>
							{position === 0 && (
								<span className="text-[var(--color-crimson-bright)] text-xs ml-2">
									(TOP &mdash; dangerous!)
								</span>
							)}
							{position === max && (
								<span className="text-[var(--color-verdant)] text-xs ml-2">
									(BOTTOM &mdash; safe!)
								</span>
							)}
						</label>
						<input
							type="range"
							min={0}
							max={max}
							value={position}
							onChange={(e) =>
								setPosition(Number(e.target.value))
							}
							className="w-full accent-[var(--color-amber)]"
						/>
						<div className="flex justify-between font-body text-[var(--color-stone-dim)] text-xs mt-1">
							<span>Top</span>
							<span>Bottom</span>
						</div>
					</div>

					<div className="flex gap-3 justify-center">
						<button
							onClick={() => onInsert(position)}
							className="btn-press bg-[var(--color-amber)] hover:bg-[var(--color-amber-bright)] text-[var(--color-cream)] font-display font-medium tracking-wider text-sm px-8 py-3 rounded-xl transition-colors shadow-lg"
						>
							INSERT HERE
						</button>
						<button
							onClick={() =>
								onInsert(Math.floor(Math.random() * (max + 1)))
							}
							className="btn-press bg-[var(--color-surface-raised)] hover:bg-[var(--color-border)] text-[var(--color-stone)] font-display tracking-wider text-xs px-4 py-3 rounded-xl transition-colors"
						>
							RANDOM
						</button>
					</div>
				</div>
			</div>
		</div>
	);
}

// ── Give Card (Favor target) ──────────────────────────────────────────────────

function GiveCardModal({
	player,
	requesterName,
	onGive,
}: {
	player: Player;
	requesterName: string;
	onGive: (cardId: string) => void;
}) {
	return (
		<div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
			<div
				className="section-panel max-w-lg w-full mx-4 text-center"
				style={{ borderColor: "var(--color-rose)" }}
			>
				<div className="section-panel-inner">
					<div className="text-5xl mb-4">&#128591;</div>
					<h2 className="font-display text-xl font-semibold tracking-wide text-[var(--color-cream)] mb-2">
						Favor!
					</h2>
					<p className="font-body text-sm text-[var(--color-stone)] mb-6">
						<span className="text-[var(--color-gold)] font-bold">
							{requesterName}
						</span>{" "}
						wants a card. Choose which card to give them.
					</p>

					<div className="flex flex-wrap gap-3 justify-center mb-6">
						{player.hand.cards.map((card) => (
							<div
								key={card.id}
								className="cursor-pointer"
								onClick={() => onGive(card.id)}
							>
								<GameCard
									card={card}
									selectable
									onClick={() => onGive(card.id)}
								/>
							</div>
						))}
					</div>
				</div>
			</div>
		</div>
	);
}

// ── Nope Window (with countdown for Exploding Kittens) ────────────────────────

const NOPE_WINDOW_SECONDS = 3;

function NopeWindow({
	nopeCard,
	onNope,
	onResolve,
	cardName,
	playerName,
	nopeCount,
	isCardPlayer,
}: {
	nopeCard: Card | null;
	onNope: (cardId: string) => void;
	onResolve: () => void;
	cardName: string;
	playerName: string;
	nopeCount: number;
	isCardPlayer: boolean;
}) {
	const [countdown, setCountdown] = useState(NOPE_WINDOW_SECONDS);
	const resolvedRef = useRef(false);

	// Reset countdown when nopeCount changes (a new Nope was played)
	useEffect(() => {
		setCountdown(NOPE_WINDOW_SECONDS);
		resolvedRef.current = false;
	}, [nopeCount]);

	useEffect(() => {
		const timer = setInterval(() => {
			setCountdown((prev) => {
				if (prev <= 1) {
					clearInterval(timer);
					// Auto-resolve when countdown reaches 0
					if (!resolvedRef.current) {
						resolvedRef.current = true;
						setTimeout(() => onResolve(), 0);
					}
					return 0;
				}
				return prev - 1;
			});
		}, 1000);
		return () => clearInterval(timer);
	}, [onResolve, nopeCount]);

	const isNoped = nopeCount % 2 === 1;

	return (
		<div className="fixed bottom-4 right-4 z-50 max-w-sm w-full">
			<div
				className="section-panel"
				style={{
					borderColor: isNoped
						? "var(--color-crimson)"
						: "var(--color-gold)",
				}}
			>
				<div className="section-panel-inner">
					{/* Header */}
					<div className="flex items-center justify-between mb-2">
						<p className="font-display font-semibold text-sm tracking-wide text-[var(--color-cream)]">
							{isNoped ? "NOPED!" : "Card Played!"}
						</p>
						<span
							className="font-display text-xs font-bold px-2 py-0.5 rounded-full"
							style={{
								backgroundColor: countdown <= 2
									? "var(--color-crimson)"
									: "var(--color-surface-raised)",
								color: "var(--color-cream)",
							}}
						>
							{countdown}s
						</span>
					</div>

					{/* Description */}
					<p className="font-body text-xs text-[var(--color-stone)] mb-3">
						<span className="text-[var(--color-gold)] font-semibold">
							{playerName}
						</span>{" "}
						played{" "}
						<span className="text-[var(--color-crimson-bright)] font-semibold">
							{cardName}
						</span>
						{nopeCount > 0 && (
							<span className="text-[var(--color-stone-dim)]">
								{" "}
								&middot; {nopeCount} Nope{nopeCount > 1 ? "s" : ""}{" "}
								played
							</span>
						)}
					</p>

					{/* Nope button */}
					{nopeCard && (
						<button
							onClick={() => {
								resolvedRef.current = true;
								onNope(nopeCard.id);
							}}
							className="btn-press w-full bg-[var(--color-crimson)] hover:bg-[var(--color-crimson-bright)] text-[var(--color-cream)] font-display font-medium tracking-wider text-xs py-2.5 rounded-lg transition-colors mb-2"
						>
							🚫 NOPE!
						</button>
					)}

					{/* Continue / Let it happen button */}
					<button
						onClick={() => {
							if (!resolvedRef.current) {
								resolvedRef.current = true;
								onResolve();
							}
						}}
						disabled={countdown > 0}
						className={`btn-press w-full font-display font-medium tracking-wider text-xs py-2 rounded-lg transition-colors ${
							countdown > 0
								? "bg-[var(--color-surface-raised)] text-[var(--color-stone-dim)] cursor-not-allowed opacity-60"
								: "bg-[var(--color-verdant)] hover:bg-[var(--color-verdant-bright)] text-[var(--color-cream)]"
						}`}
					>
						{countdown > 0
							? `Wait ${countdown}s...`
							: isNoped
								? "Accept Cancellation"
								: "Let it Happen"}
					</button>
				</div>
			</div>
		</div>
	);
}

// ── Legacy Nope window (non-nope_window pending types) ────────────────────────

function LegacyNopeWindow({
	nopeCard,
	onNope,
	pendingType,
}: {
	nopeCard: Card;
	onNope: (cardId: string) => void;
	pendingType: string;
}) {
	return (
		<div className="fixed bottom-4 right-4 z-50">
			<div
				className="section-panel max-w-xs"
				style={{ borderColor: "var(--color-crimson)" }}
			>
				<div className="section-panel-inner">
					<p className="font-display font-semibold text-sm tracking-wide text-[var(--color-cream)] mb-2">
						Play Nope?
					</p>
					<p className="font-body text-xs text-[var(--color-stone)] mb-3">
						Cancel the{" "}
						<span className="text-[var(--color-crimson-bright)] font-semibold">
							{pendingType}
						</span>{" "}
						action?
					</p>
					<button
						onClick={() => onNope(nopeCard.id)}
						className="btn-press w-full bg-[var(--color-crimson)] hover:bg-[var(--color-crimson-bright)] text-[var(--color-cream)] font-display font-medium tracking-wider text-xs py-2 rounded-lg transition-colors"
					>
						NOPE!
					</button>
				</div>
			</div>
		</div>
	);
}

// ── Target selector ───────────────────────────────────────────────────────────

interface TargetSelectorProps {
	players: Player[];
	localPlayerId: string;
	onSelect: (targetId: string) => void;
	onCancel: () => void;
	title?: string;
	subtitle?: string;
}

export function TargetSelector({
	players,
	localPlayerId,
	onSelect,
	onCancel,
	title = "Choose a Target",
	subtitle,
}: TargetSelectorProps) {
	const targets = players.filter(
		(p) => p.id !== localPlayerId && p.status === "active",
	);

	return (
		<div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
			<div
				className="section-panel max-w-sm w-full mx-4 text-center"
				style={{ borderColor: "var(--color-gold-dim)" }}
			>
				<div className="section-panel-inner">
					<h2 className="font-display text-xl font-semibold tracking-wide text-[var(--color-cream)] mb-2">
						{title}
					</h2>
					{subtitle && (
						<p className="font-body text-sm text-[var(--color-stone)] mb-6">
							{subtitle}
						</p>
					)}

					<div className="space-y-3 mb-6">
						{targets.map((p) => (
							<button
								key={p.id}
								onClick={() => onSelect(p.id)}
								className="btn-press w-full flex items-center gap-3 bg-[var(--color-bg-deep)] hover:bg-[var(--color-surface-raised)] rounded-xl p-3 transition-colors border border-[var(--color-border)]"
							>
								<span className="text-2xl">{p.emoji}</span>
								<div className="text-left">
									<p className="font-body font-semibold text-[var(--color-cream)]">
										{p.name}
									</p>
									<p className="font-body text-xs text-[var(--color-stone-dim)]">
										{p.hand.cards.length} cards
									</p>
								</div>
							</button>
						))}
					</div>

					<button
						onClick={onCancel}
						className="font-body text-sm text-[var(--color-stone-dim)] hover:text-[var(--color-cream)] transition-colors"
					>
						Cancel
					</button>
				</div>
			</div>
		</div>
	);
}
