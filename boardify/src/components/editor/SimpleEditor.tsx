"use client";

import { motion } from "motion/react";
import type { GameData } from "~/types/game";
import { Minus, Plus, Trash2 } from "lucide-react";
import EditableText from "~/components/ui/EditableText";

interface SimpleEditorProps {
	game: GameData;
	onChange: (game: GameData) => void;
}

const CARD_BANDS = [
	"playing-card-band--teal",
	"playing-card-band--amber",
	"playing-card-band--rose",
	"playing-card-band--crimson",
	"playing-card-band--gold",
	"playing-card-band--verdant",
];

function getBand(category: string, index: number): string {
	const cat = category.toLowerCase();
	if (cat.includes("action") || cat.includes("attack")) return "playing-card-band--crimson";
	if (cat.includes("defense") || cat.includes("defuse") || cat.includes("shield")) return "playing-card-band--teal";
	if (cat.includes("special") || cat.includes("wild")) return "playing-card-band--gold";
	if (cat.includes("utility") || cat.includes("skip") || cat.includes("reverse")) return "playing-card-band--amber";
	return CARD_BANDS[index % CARD_BANDS.length]!;
}

function Stepper({
	label,
	value,
	onChange,
	min = 0,
	max = 999,
}: {
	label: string;
	value: number;
	onChange: (v: number) => void;
	min?: number;
	max?: number;
}) {
	return (
		<div className="flex items-center justify-between rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-deep)]/50 px-4 py-3">
			<span className="font-body text-sm text-[var(--color-cream-dim)]">{label}</span>
			<div className="flex items-center">
				<button
					type="button"
					onClick={() => onChange(Math.max(min, value - 1))}
					className="btn-press flex h-8 w-8 items-center justify-center rounded-l-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-stone)] transition-colors hover:bg-[var(--color-surface-raised)] hover:text-[var(--color-cream)] active:bg-[var(--color-gold-muted)]"
				>
					<Minus className="h-4 w-4" />
				</button>
				<span className="flex h-8 min-w-12 items-center justify-center border-y border-[var(--color-border)] bg-[var(--color-bg-deep)] px-3 font-display text-sm font-medium text-[var(--color-cream)] tabular-nums">
					{value}
				</span>
				<button
					type="button"
					onClick={() => onChange(Math.min(max, value + 1))}
					className="btn-press flex h-8 w-8 items-center justify-center rounded-r-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-stone)] transition-colors hover:bg-[var(--color-surface-raised)] hover:text-[var(--color-cream)] active:bg-[var(--color-gold-muted)]"
				>
					<Plus className="h-4 w-4" />
				</button>
			</div>
		</div>
	);
}

const staggerItem = {
	hidden: { opacity: 0, y: 20 },
	visible: (i: number) => ({
		opacity: 1,
		y: 0,
		transition: { delay: i * 0.08, duration: 0.5, ease: "easeOut" as const },
	}),
};

export default function SimpleEditor({ game, onChange }: SimpleEditorProps) {
	function setGame(patch: Partial<GameData>) {
		onChange({ ...game, ...patch });
	}

	let idx = 0;

	return (
		<div className="space-y-5">
			{/* Game Identity */}
			<motion.section
				className="section-panel"
				variants={staggerItem}
				custom={idx++}
				initial="hidden"
				animate="visible"
			>
				<div className="section-panel-inner">
					<EditableText
						value={game.game.name}
						onChange={(v) => setGame({ game: { ...game.game, name: v } })}
						placeholder="Game name..."
						className="font-display text-3xl font-semibold tracking-wide text-[var(--color-gold)]"
						as="h2"
					/>
					<hr className="gold-divider my-3" />
					<EditableText
						value={game.game.description}
						onChange={(v) => setGame({ game: { ...game.game, description: v } })}
						placeholder="Game description..."
						className="font-body text-[var(--color-cream-dim)] leading-relaxed"
						multiline
						as="p"
					/>
				</div>
			</motion.section>

			{/* Quick Settings */}
			<motion.section
				className="section-panel"
				variants={staggerItem}
				custom={idx++}
				initial="hidden"
				animate="visible"
			>
				<div className="section-panel-inner">
					<h3 className="font-display mb-4 text-lg font-semibold tracking-wider text-[var(--color-gold)]">
						GAME SETTINGS
					</h3>
					<div className="space-y-2">
						<Stepper
							label="Minimum Players"
							value={game.game.player_config.min_players}
							min={1}
							max={game.game.player_config.max_players}
							onChange={(v) =>
								setGame({
									game: {
										...game.game,
										player_config: {
											...game.game.player_config,
											min_players: v,
										},
									},
								})
							}
						/>
						<Stepper
							label="Maximum Players"
							value={game.game.player_config.max_players}
							min={game.game.player_config.min_players}
							onChange={(v) =>
								setGame({
									game: {
										...game.game,
										player_config: {
											...game.game.player_config,
											max_players: v,
										},
									},
								})
							}
						/>
						<Stepper
							label="Starting Hand Size"
							value={game.setup.player_initialization.initial_hand_size}
							min={0}
							onChange={(v) =>
								setGame({
									setup: {
										...game.setup,
										player_initialization: {
											...game.setup.player_initialization,
											initial_hand_size: v,
										},
									},
								})
							}
						/>
						<Stepper
							label="Max Actions Per Turn"
							value={game.turn_model.action_policy.max_actions_per_turn}
							min={1}
							onChange={(v) =>
								setGame({
									turn_model: {
										...game.turn_model,
										action_policy: {
											...game.turn_model.action_policy,
											max_actions_per_turn: v,
										},
									},
								})
							}
						/>
						<Stepper
							label="Turn Timer (seconds, 0 = off)"
							value={game.turn_model.timeout_policy.per_turn_timer}
							min={0}
							onChange={(v) =>
								setGame({
									turn_model: {
										...game.turn_model,
										timeout_policy: {
											...game.turn_model.timeout_policy,
											per_turn_timer: v,
										},
									},
								})
							}
						/>

						{/* Turn Direction */}
						<div className="flex items-center justify-between rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-deep)]/50 px-4 py-3">
							<span className="font-body text-sm text-[var(--color-cream-dim)]">
								Turn Direction
							</span>
							<select
								value={game.turn_model.turn_order.direction}
								onChange={(e) =>
									setGame({
										turn_model: {
											...game.turn_model,
											turn_order: {
												...game.turn_model.turn_order,
												direction: e.target.value,
											},
										},
									})
								}
								className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 font-body text-sm text-[var(--color-cream)] outline-none transition-colors"
							>
								<option value="clockwise">Clockwise</option>
								<option value="counterclockwise">Counter-clockwise</option>
								<option value="dynamic">Dynamic</option>
							</select>
						</div>

						{/* Interrupts toggle */}
						<div className="flex items-center justify-between rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-deep)]/50 px-4 py-3">
							<span className="font-body text-sm text-[var(--color-cream-dim)]">
								Allow Interrupts
							</span>
							<button
								type="button"
								onClick={() =>
									setGame({
										turn_model: {
											...game.turn_model,
											interrupt_policy: {
												...game.turn_model.interrupt_policy,
												interrupt_allowed:
													!game.turn_model.interrupt_policy.interrupt_allowed,
											},
										},
									})
								}
								className={`relative h-7 w-12 rounded-full transition-colors ${
									game.turn_model.interrupt_policy.interrupt_allowed
										? "bg-[var(--color-gold)]"
										: "bg-[var(--color-border)]"
								}`}
							>
								<span
									className={`absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-[var(--color-cream)] shadow-sm transition-transform ${
										game.turn_model.interrupt_policy.interrupt_allowed
											? "translate-x-5"
											: ""
									}`}
								/>
							</button>
						</div>
					</div>
				</div>
			</motion.section>

			{/* Card Overview — playing card elements */}
			<motion.section
				className="section-panel"
				variants={staggerItem}
				custom={idx++}
				initial="hidden"
				animate="visible"
			>
				<div className="section-panel-inner">
					<h3 className="font-display mb-4 text-lg font-semibold tracking-wider text-[var(--color-gold)]">
						CARDS{" "}
						<span className="font-body text-sm font-normal text-[var(--color-stone)]">
							({game.cards.reduce((s, c) => s + c.count, 0)} total)
						</span>
					</h3>
					<div className="grid gap-3 sm:grid-cols-2">
						{game.cards.map((card, i) => (
							<motion.div
								key={`simple-card-${i}`}
								className="playing-card group"
								initial={{ opacity: 0, y: 20, rotate: -2 }}
								animate={{ opacity: 1, y: 0, rotate: 0 }}
								transition={{ delay: 0.3 + i * 0.06, duration: 0.4, ease: "easeOut" }}
							>
								{/* Category color band */}
								<div className={`playing-card-band ${getBand(card.category, i)}`} />

								<div className="p-3">
									<div className="flex items-start justify-between gap-2">
										<div className="min-w-0 flex-1">
											<input
												type="text"
												value={card.display_name}
												onChange={(e) => {
													const next = [...game.cards];
													next[i] = { ...next[i]!, display_name: e.target.value };
													setGame({ cards: next });
												}}
												className="w-full bg-transparent font-display text-sm font-medium tracking-wide text-[var(--color-cream)] outline-none placeholder:text-[var(--color-stone-dim)]"
												placeholder="Card name..."
											/>
											<p className="mt-0.5 truncate font-body text-xs text-[var(--color-stone)]">
												{card.category || "Uncategorized"}
											</p>
										</div>
										<button
											type="button"
											onClick={() =>
												setGame({ cards: game.cards.filter((_, j) => j !== i) })
											}
											className="rounded p-1 text-[var(--color-border)] opacity-0 transition-all hover:text-[var(--color-crimson)] group-hover:opacity-100"
										>
											<Trash2 className="h-3.5 w-3.5" />
										</button>
									</div>

									<p className="mt-1.5 line-clamp-2 font-body text-xs leading-relaxed text-[var(--color-stone)]">
										{card.rule_description || "No description"}
									</p>

									{/* Count control */}
									<div className="mt-2 flex items-center justify-between border-t border-[var(--color-border-subtle)] pt-2">
										<span className="font-body text-[10px] uppercase tracking-wider text-[var(--color-stone-dim)]">
											Copies
										</span>
										<div className="flex items-center">
											<button
												type="button"
												onClick={() => {
													const next = [...game.cards];
													next[i] = { ...next[i]!, count: Math.max(0, card.count - 1) };
													setGame({ cards: next });
												}}
												className="btn-press flex h-6 w-6 items-center justify-center rounded-l border border-[var(--color-border)] bg-[var(--color-bg-deep)] text-[var(--color-stone)] hover:bg-[var(--color-surface-raised)] hover:text-[var(--color-cream)]"
											>
												<Minus className="h-3 w-3" />
											</button>
											<span className="flex h-6 min-w-8 items-center justify-center border-y border-[var(--color-border)] bg-[var(--color-bg-deep)] px-2 font-display text-xs font-medium text-[var(--color-cream)] tabular-nums">
												{card.count}
											</span>
											<button
												type="button"
												onClick={() => {
													const next = [...game.cards];
													next[i] = { ...next[i]!, count: card.count + 1 };
													setGame({ cards: next });
												}}
												className="btn-press flex h-6 w-6 items-center justify-center rounded-r border border-[var(--color-border)] bg-[var(--color-bg-deep)] text-[var(--color-stone)] hover:bg-[var(--color-surface-raised)] hover:text-[var(--color-cream)]"
											>
												<Plus className="h-3 w-3" />
											</button>
										</div>
									</div>
								</div>
							</motion.div>
						))}
					</div>
				</div>
			</motion.section>

			{/* Win Condition */}
			<motion.section
				className="section-panel"
				variants={staggerItem}
				custom={idx++}
				initial="hidden"
				animate="visible"
			>
				<div className="section-panel-inner">
					<h3 className="font-display mb-3 text-lg font-semibold tracking-wider text-[var(--color-gold)]">
						WIN CONDITION
					</h3>
					{game.win_loss.victory_conditions.map((vc, i) => (
						<div key={`simple-vc-${i}`} className="mt-2">
							<span className="font-display text-xs font-medium tracking-wider text-[var(--color-verdant)]">
								{vc.type.replace(/_/g, " ").toUpperCase()}
							</span>
							<EditableText
								value={vc.description}
								onChange={(v) => {
									const next = [...game.win_loss.victory_conditions];
									next[i] = { ...next[i]!, description: v };
									setGame({
										win_loss: {
											...game.win_loss,
											victory_conditions: next,
										},
									});
								}}
								className="font-body text-sm text-[var(--color-cream-dim)]"
								as="p"
							/>
						</div>
					))}
				</div>
			</motion.section>

			{/* Home Rules */}
			<motion.section
				className="section-panel"
				variants={staggerItem}
				custom={idx++}
				initial="hidden"
				animate="visible"
			>
				<div className="section-panel-inner">
					<h3 className="font-display mb-2 text-lg font-semibold tracking-wider text-[var(--color-amber-bright)]">
						HOME RULES
					</h3>
					<p className="mb-3 font-body text-xs text-[var(--color-stone-dim)]">
						Add your own house rules or custom modifications.
					</p>
					<textarea
						value={game.home_rules ?? ""}
						onChange={(e) => setGame({ home_rules: e.target.value })}
						placeholder="e.g. 'Draw 2 instead of 1 each turn'..."
						rows={3}
						className="w-full resize-y rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-deep)] px-4 py-3 font-body text-sm text-[var(--color-cream-dim)] outline-none transition-colors placeholder:text-[var(--color-stone-dim)]"
					/>
				</div>
			</motion.section>
		</div>
	);
}
