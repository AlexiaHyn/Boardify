"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import type { GameData } from "~/types/game";
import {
	RotateCcw,
	Download,
	Compass,
	Layers,
	BookOpen,
	RotateCw,
	Wrench,
	Trophy,
	ScrollText,
	Minus,
	Plus,
	Users,
	Clock,
	Hand,
	Zap,
	Eye,
	Shield,
} from "lucide-react";
import SetupBlueprintEditor from "~/components/editor/SetupBlueprintEditor";
import TurnModelEditor from "~/components/editor/TurnModelEditor";
import CardBlueprintEditor from "~/components/editor/CardBlueprintEditor";
import RuleBlueprintEditor from "~/components/editor/RuleBlueprintEditor";
import WinLossEditor from "~/components/editor/WinLossEditor";
import EditableList from "~/components/ui/EditableList";

interface GameEditorProps {
	initialGame: GameData;
	onRegenerate: () => void;
	prompt?: string;
}

const TABS = [
	{ id: "overview", label: "Overview", icon: Compass },
	{ id: "cards", label: "Cards", icon: Layers },
	{ id: "rules", label: "Rules", icon: BookOpen },
	{ id: "turns", label: "Turns", icon: RotateCw },
	{ id: "setup", label: "Setup", icon: Wrench },
	{ id: "winloss", label: "Win / Loss", icon: Trophy },
] as const;

type TabId = (typeof TABS)[number]["id"];

/* ════════════════════════════════════════════════════════════════════════
   Main Editor
   ════════════════════════════════════════════════════════════════════ */

export default function GameEditor({
	initialGame,
	onRegenerate,
}: GameEditorProps) {
	const [game, setGame] = useState<GameData>({
		...initialGame,
		home_rules: initialGame.home_rules ?? "",
	});
	const [activeTab, setActiveTab] = useState<TabId>("overview");

	function exportJSON() {
		const blob = new Blob([JSON.stringify(game, null, 2)], {
			type: "application/json",
		});
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = `${game.game.name.toLowerCase().replace(/\s+/g, "-") || "game"}-blueprint.json`;
		a.click();
		URL.revokeObjectURL(url);
	}

	const totalCards = game.cards.reduce((s, c) => s + c.count, 0);

	function tabBadge(tabId: TabId): number | null {
		if (tabId === "cards") return totalCards;
		if (tabId === "rules") return game.rules.length;
		return null;
	}

	return (
		<div className="mx-auto w-full max-w-5xl pb-16">
			{/* ── Toolbar ──────────────────────────────────────────────── */}
			<motion.div
				className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]/80 px-5 py-3 backdrop-blur-sm"
				initial={{ opacity: 0, y: -10 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ duration: 0.4 }}
			>
				<button
					type="button"
					onClick={onRegenerate}
					className="btn-press flex items-center gap-2 rounded-lg border border-[var(--color-gold-dim)] px-4 py-2 font-display text-xs font-medium tracking-wider text-[var(--color-gold)] transition-all hover:border-[var(--color-gold)] hover:bg-[var(--color-gold-muted)] hover:text-[var(--color-gold-bright)]"
				>
					<RotateCcw className="h-3.5 w-3.5" />
					REGENERATE
				</button>

				<button
					type="button"
					onClick={exportJSON}
					className="btn-press flex items-center gap-2 rounded-lg bg-[var(--color-crimson)] px-5 py-2 font-display text-xs font-medium tracking-wider text-[var(--color-cream)] transition-all hover:bg-[var(--color-crimson-bright)] hover:shadow-md hover:shadow-[var(--color-crimson)]/20"
				>
					<Download className="h-3.5 w-3.5" />
					SAVE BLUEPRINT
				</button>
			</motion.div>

			{/* ── Tab Bar ──────────────────────────────────────────────── */}
			<motion.nav
				className="editor-tabs mt-4"
				initial={{ opacity: 0 }}
				animate={{ opacity: 1 }}
				transition={{ delay: 0.12, duration: 0.35 }}
			>
				{TABS.map((tab) => {
					const badge = tabBadge(tab.id);
					return (
						<button
							key={tab.id}
							type="button"
							onClick={() => setActiveTab(tab.id)}
							className={`editor-tab ${activeTab === tab.id ? "editor-tab--active" : ""}`}
						>
							<tab.icon className="h-4 w-4" />
							<span>{tab.label}</span>
							{badge !== null && (
								<span className="editor-tab-badge">
									{badge}
								</span>
							)}
						</button>
					);
				})}
			</motion.nav>

			{/* ── Tab Content ──────────────────────────────────────────── */}
			<AnimatePresence mode="wait">
				<motion.div
					key={activeTab}
					initial={{ opacity: 0, y: 10 }}
					animate={{ opacity: 1, y: 0 }}
					exit={{ opacity: 0, y: -6 }}
					transition={{ duration: 0.22 }}
					className="mt-5 space-y-5"
				>
					{activeTab === "overview" && (
						<OverviewTab game={game} setGame={setGame} />
					)}

					{activeTab === "cards" && (
						<CardBlueprintEditor
							cards={game.cards}
							onChange={(cards) =>
								setGame((prev) => ({ ...prev, cards }))
							}
						/>
					)}

					{activeTab === "rules" && (
						<RuleBlueprintEditor
							rules={game.rules}
							onChange={(rules) =>
								setGame((prev) => ({ ...prev, rules }))
							}
						/>
					)}

					{activeTab === "turns" && (
						<TurnModelEditor
							turnModel={game.turn_model}
							onChange={(tm) =>
								setGame((prev) => ({ ...prev, turn_model: tm }))
							}
						/>
					)}

					{activeTab === "setup" && (
						<SetupBlueprintEditor
							setup={game.setup}
							onChange={(s) =>
								setGame((prev) => ({ ...prev, setup: s }))
							}
						/>
					)}

					{activeTab === "winloss" && (
						<WinLossEditor
							winLoss={game.win_loss}
							onChange={(wl) =>
								setGame((prev) => ({ ...prev, win_loss: wl }))
							}
						/>
					)}
				</motion.div>
			</AnimatePresence>
		</div>
	);
}

/* ════════════════════════════════════════════════════════════════════════
   Overview Tab
   ════════════════════════════════════════════════════════════════════ */

/* ── Inline Stat-Card Stepper (value IS the display) ───────────────── */
function StatStepper({
	value,
	display,
	onChange,
	min = 0,
	max = 999,
}: {
	value: number;
	display?: string;
	onChange: (v: number) => void;
	min?: number;
	max?: number;
}) {
	return (
		<div className="stat-stepper">
			<button
				type="button"
				onClick={() => onChange(Math.max(min, value - 1))}
				className="stat-stepper-btn"
			>
				<Minus className="h-3.5 w-3.5" />
			</button>
			<span className="stat-stepper-value">{display ?? value}</span>
			<button
				type="button"
				onClick={() => onChange(Math.min(max, value + 1))}
				className="stat-stepper-btn"
			>
				<Plus className="h-3.5 w-3.5" />
			</button>
		</div>
	);
}

function OverviewTab({
	game,
	setGame,
}: {
	game: GameData;
	setGame: React.Dispatch<React.SetStateAction<GameData>>;
}) {
	const totalCards = game.cards.reduce((s, c) => s + c.count, 0);

	return (
		<>
			{/* ── Identity ─────────────────────────────────────────── */}
			<section className="section-panel">
				<div className="section-panel-inner">
					<input
						type="text"
						value={game.game.name}
						onChange={(e) =>
							setGame((prev) => ({
								...prev,
								game: { ...prev.game, name: e.target.value },
							}))
						}
						placeholder="Game name..."
						className="form-input form-input--title"
					/>
					<hr className="gold-divider my-3" />
					<textarea
						value={game.game.description}
						onChange={(e) =>
							setGame((prev) => ({
								...prev,
								game: {
									...prev.game,
									description: e.target.value,
								},
							}))
						}
						placeholder="Describe your game..."
						rows={3}
						className="form-textarea"
						style={{
							background: "transparent",
							border: "1px solid transparent",
						}}
						onFocus={(e) => {
							e.currentTarget.style.background =
								"var(--color-bg-deep)";
							e.currentTarget.style.borderColor =
								"var(--color-gold)";
						}}
						onBlur={(e) => {
							e.currentTarget.style.background = "transparent";
							e.currentTarget.style.borderColor = "transparent";
						}}
					/>
				</div>
			</section>

			{/* ── Quick Stats (all settings merged) ────────────────── */}
			<div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
				{/* Min Players */}
				<div className="stat-card">
					<div className="stat-card-label">
						<Users /> Min Players
					</div>
					<StatStepper
						value={game.game.player_config.min_players}
						min={1}
						max={game.game.player_config.max_players}
						onChange={(v) =>
							setGame((prev) => ({
								...prev,
								game: {
									...prev.game,
									player_config: {
										...prev.game.player_config,
										min_players: v,
									},
								},
							}))
						}
					/>
				</div>

				{/* Max Players */}
				<div className="stat-card">
					<div className="stat-card-label">
						<Users /> Max Players
					</div>
					<StatStepper
						value={game.game.player_config.max_players}
						min={game.game.player_config.min_players}
						onChange={(v) =>
							setGame((prev) => ({
								...prev,
								game: {
									...prev.game,
									player_config: {
										...prev.game.player_config,
										max_players: v,
									},
								},
							}))
						}
					/>
				</div>

				{/* Hand Size */}
				<div className="stat-card">
					<div className="stat-card-label">
						<Hand /> Hand Size
					</div>
					<StatStepper
						value={
							game.setup.player_initialization.initial_hand_size
						}
						min={0}
						onChange={(v) =>
							setGame((prev) => ({
								...prev,
								setup: {
									...prev.setup,
									player_initialization: {
										...prev.setup.player_initialization,
										initial_hand_size: v,
									},
								},
							}))
						}
					/>
				</div>

				{/* Max Actions */}
				<div className="stat-card">
					<div className="stat-card-label">
						<Zap /> Actions / Turn
					</div>
					<StatStepper
						value={
							game.turn_model.action_policy.max_actions_per_turn
						}
						min={1}
						onChange={(v) =>
							setGame((prev) => ({
								...prev,
								turn_model: {
									...prev.turn_model,
									action_policy: {
										...prev.turn_model.action_policy,
										max_actions_per_turn: v,
									},
								},
							}))
						}
					/>
				</div>

				{/* Turn Timer */}
				<div className="stat-card">
					<div className="stat-card-label">
						<Clock /> Turn Timer
					</div>
					<StatStepper
						value={game.turn_model.timeout_policy.per_turn_timer}
						display={
							game.turn_model.timeout_policy.per_turn_timer === 0
								? "Off"
								: `${game.turn_model.timeout_policy.per_turn_timer}s`
						}
						min={0}
						onChange={(v) =>
							setGame((prev) => ({
								...prev,
								turn_model: {
									...prev.turn_model,
									timeout_policy: {
										...prev.turn_model.timeout_policy,
										per_turn_timer: v,
									},
								},
							}))
						}
					/>
				</div>

				{/* Turn Direction */}
				<div className="stat-card">
					<div className="stat-card-label">
						<RotateCw /> Direction
					</div>
					<select
						value={game.turn_model.turn_order.direction}
						onChange={(e) =>
							setGame((prev) => ({
								...prev,
								turn_model: {
									...prev.turn_model,
									turn_order: {
										...prev.turn_model.turn_order,
										direction: e.target.value,
									},
								},
							}))
						}
						className="stat-card-select"
					>
						<option value="clockwise">Clockwise</option>
						<option value="counterclockwise">Counter-CW</option>
						<option value="dynamic">Dynamic</option>
					</select>
				</div>

				{/* Interrupts */}
				<div className="stat-card">
					<div className="stat-card-label">
						<Shield /> Interrupts
					</div>
					<button
						type="button"
						onClick={() =>
							setGame((prev) => ({
								...prev,
								turn_model: {
									...prev.turn_model,
									interrupt_policy: {
										...prev.turn_model.interrupt_policy,
										interrupt_allowed:
											!prev.turn_model.interrupt_policy
												.interrupt_allowed,
									},
								},
							}))
						}
						className={`stat-card-toggle ${game.turn_model.interrupt_policy.interrupt_allowed ? "stat-card-toggle--on" : ""}`}
					>
						{game.turn_model.interrupt_policy.interrupt_allowed
							? "On"
							: "Off"}
					</button>
				</div>

				{/* Total Cards (read-only) */}
				<div className="stat-card">
					<div className="stat-card-label">
						<Layers /> Total Cards
					</div>
					<div className="stat-card-value stat-card-value--readonly">
						{totalCards}
					</div>
					<span className="font-body text-[10px] text-[var(--color-stone-dim)]">
						{game.cards.length} types
					</span>
				</div>
			</div>

			{/* ── House Rules / Additional Input ───────────────────── */}
			<section className="section-panel">
				<div className="section-panel-inner">
					<h3 className="sub-section-title">
						<ScrollText className="h-4 w-4" />
						Any other edits?
					</h3>
					<p className="mb-3 font-body text-sm leading-relaxed text-[var(--color-stone)]">
						Got house rules, extra variants, or ideas that don't fit
						neatly above? Drop them here — anything goes.
					</p>
					<textarea
						value={game.home_rules ?? ""}
						onChange={(e) =>
							setGame((prev) => ({
								...prev,
								home_rules: e.target.value,
							}))
						}
						placeholder="e.g. 'Draw 2 instead of 1 each turn', 'Jokers are wild', 'No stacking skip cards'..."
						rows={4}
						className="form-textarea"
					/>
				</div>
			</section>

			{/* ── Information Model ────────────────────────────────── */}
			<section className="section-panel">
				<div className="section-panel-inner">
					<h3 className="sub-section-title">
						<Eye className="h-4 w-4" />
						Information Model
					</h3>
					<div className="space-y-4">
						<div className="form-field">
							<label className="form-label">
								Randomness Model
							</label>
							<input
								type="text"
								value={
									game.game.information_model.randomness_model
								}
								onChange={(e) =>
									setGame((prev) => ({
										...prev,
										game: {
											...prev.game,
											information_model: {
												...prev.game.information_model,
												randomness_model:
													e.target.value,
											},
										},
									}))
								}
								placeholder="e.g. deterministic seed, true random..."
								className="form-input"
							/>
						</div>
						<div>
							<label className="form-label mb-2 block">
								Public Knowledge Rules
							</label>
							<EditableList
								items={
									game.game.information_model
										.public_knowledge_rules
								}
								onChange={(v) =>
									setGame((prev) => ({
										...prev,
										game: {
											...prev.game,
											information_model: {
												...prev.game.information_model,
												public_knowledge_rules: v,
											},
										},
									}))
								}
								placeholder="Knowledge rule..."
								addLabel="Add rule"
							/>
						</div>
					</div>
				</div>
			</section>
		</>
	);
}
