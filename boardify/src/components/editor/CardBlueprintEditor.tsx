"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import type { CardBlueprint } from "~/types/game";
import {
	ChevronDown,
	ChevronUp,
	Plus,
	Minus,
	Trash2,
	Search,
	Layers,
} from "lucide-react";
import EditableList from "~/components/ui/EditableList";

interface CardBlueprintEditorProps {
	cards: CardBlueprint[];
	onChange: (cards: CardBlueprint[]) => void;
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
	if (cat.includes("action") || cat.includes("attack"))
		return "playing-card-band--crimson";
	if (
		cat.includes("defense") ||
		cat.includes("defuse") ||
		cat.includes("shield")
	)
		return "playing-card-band--teal";
	if (cat.includes("special") || cat.includes("wild"))
		return "playing-card-band--gold";
	if (
		cat.includes("utility") ||
		cat.includes("skip") ||
		cat.includes("reverse")
	)
		return "playing-card-band--amber";
	return CARD_BANDS[index % CARD_BANDS.length]!;
}

function emptyCard(): CardBlueprint {
	return {
		card_id: "",
		display_name: "",
		category: "",
		rule_description: "",
		art_prompt: "",
		count: 1,
		visibility: { default_visibility: "private", reveal_conditions: [] },
		play_timing: {
			own_turn_only: true,
			any_turn: false,
			reaction_only: false,
			end_of_turn_triggered: false,
		},
		play_conditions: {
			state_conditions: [],
			target_requirements: [],
			zone_requirements: [],
			stack_requirements: [],
		},
		effects: {
			primary_effects: [],
			secondary_effects: [],
			triggered_effects: [],
			passive_effects: [],
			ongoing_effects: [],
		},
		stack_behavior: {
			can_stack: false,
			cancels_previous: false,
			can_be_revoked: false,
			requires_target_confirmation: false,
		},
		lifecycle: "instant",
	};
}

function Toggle({
	label,
	value,
	onChange,
}: {
	label: string;
	value: boolean;
	onChange: (v: boolean) => void;
}) {
	return (
		<label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-[var(--color-gold-muted)]">
			<input
				type="checkbox"
				checked={value}
				onChange={(e) => onChange(e.target.checked)}
				className="h-3.5 w-3.5 rounded border-[var(--color-border)] bg-[var(--color-bg-deep)] accent-[var(--color-gold)]"
			/>
			<span className="font-body text-xs text-[var(--color-cream-dim)]">
				{label}
			</span>
		</label>
	);
}

/* ── Single Card Tile ───────────────────────────────────────────────── */

function CardTile({
	card,
	onChange,
	onDelete,
	index,
}: {
	card: CardBlueprint;
	onChange: (patch: Partial<CardBlueprint>) => void;
	onDelete: () => void;
	index: number;
}) {
	const [expanded, setExpanded] = useState(false);

	return (
		<motion.div
			className="playing-card group"
			layout
			initial={{ opacity: 0, y: 20 }}
			animate={{ opacity: 1, y: 0 }}
			exit={{ opacity: 0, scale: 0.95 }}
			transition={{
				delay: index * 0.03,
				duration: 0.35,
				ease: "easeOut",
			}}
		>
			{/* Category color band */}
			<div
				className={`playing-card-band ${getBand(card.category, index)}`}
			/>

			<div className="p-4">
				{/* Delete */}
				<button
					type="button"
					onClick={onDelete}
					className="absolute top-3 right-3 rounded p-1 text-[var(--color-border)] opacity-0 transition-all hover:text-[var(--color-crimson)] group-hover:opacity-100"
				>
					<Trash2 className="h-4 w-4" />
				</button>

				{/* Name */}
				<input
					type="text"
					value={card.display_name}
					onChange={(e) => onChange({ display_name: e.target.value })}
					placeholder="Card name..."
					className="form-input form-input--lg"
					style={{
						background: "transparent",
						border: "1px solid transparent",
						padding: "4px 8px",
						fontFamily: "var(--font-display)",
						fontWeight: 600,
						letterSpacing: "0.02em",
					}}
				/>

				{/* Category + Count row */}
				<div className="mt-2 flex items-center justify-between gap-2">
					<input
						type="text"
						value={card.category}
						onChange={(e) => onChange({ category: e.target.value })}
						placeholder="Category..."
						className="w-32 rounded-md border border-transparent bg-transparent px-2 py-1 font-body text-xs text-[var(--color-stone)] outline-none transition-colors hover:border-[var(--color-border)] focus:border-[var(--color-gold)] focus:bg-[var(--color-bg-deep)]"
					/>
					<div className="flex items-center gap-1.5">
						<span className="font-body text-[10px] uppercase tracking-wider text-[var(--color-stone-dim)]">
							Qty
						</span>
						<div className="stepper-controls">
							<button
								type="button"
								onClick={() =>
									onChange({
										count: Math.max(0, card.count - 1),
									})
								}
								className="stepper-btn"
								style={{
									width: 24,
									height: 24,
								}}
							>
								<Minus className="h-3 w-3" />
							</button>
							<span
								className="stepper-value"
								style={{
									minWidth: 32,
									height: 24,
									fontSize: 12,
								}}
							>
								{card.count}
							</span>
							<button
								type="button"
								onClick={() =>
									onChange({ count: card.count + 1 })
								}
								className="stepper-btn"
								style={{
									width: 24,
									height: 24,
								}}
							>
								<Plus className="h-3 w-3" />
							</button>
						</div>
					</div>
				</div>

				{/* Rule description */}
				<textarea
					value={card.rule_description}
					onChange={(e) =>
						onChange({ rule_description: e.target.value })
					}
					placeholder="What does this card do?..."
					rows={2}
					className="form-textarea mt-2"
					style={{
						fontSize: 13,
						minHeight: 48,
						padding: "6px 10px",
					}}
				/>

				{/* Art prompt */}
				<input
					type="text"
					value={card.art_prompt}
					onChange={(e) => onChange({ art_prompt: e.target.value })}
					placeholder="Art description..."
					className="mt-1.5 w-full rounded-md border border-transparent bg-transparent px-2 py-1 font-body text-xs italic text-[var(--color-stone-dim)] outline-none transition-colors hover:border-[var(--color-border)] focus:border-[var(--color-gold)] focus:bg-[var(--color-bg-deep)]"
				/>

				{/* Expand toggle */}
				<button
					type="button"
					onClick={() => setExpanded(!expanded)}
					className="btn-press mt-3 flex w-full items-center justify-center gap-1.5 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-deep)] py-1.5 font-body text-xs text-[var(--color-stone)] transition-all hover:border-[var(--color-gold-dim)] hover:text-[var(--color-gold)]"
				>
					{expanded ? (
						<ChevronUp className="h-3 w-3" />
					) : (
						<ChevronDown className="h-3 w-3" />
					)}
					{expanded ? "Hide details" : "Show details"}
				</button>

				<AnimatePresence>
					{expanded && (
						<motion.div
							initial={{ height: 0, opacity: 0 }}
							animate={{ height: "auto", opacity: 1 }}
							exit={{ height: 0, opacity: 0 }}
							transition={{ duration: 0.25 }}
							className="overflow-hidden"
						>
							<div className="mt-3 space-y-4 border-t border-[var(--color-border-subtle)] pt-3">
								{/* Visibility */}
								<div>
									<span className="form-label">
										Visibility
									</span>
									<div className="mt-1.5 flex items-center gap-2">
										<select
											value={
												card.visibility
													.default_visibility
											}
											onChange={(e) =>
												onChange({
													visibility: {
														...card.visibility,
														default_visibility:
															e.target.value,
													},
												})
											}
											className="form-select"
											style={{ fontSize: 12 }}
										>
											<option value="public">
												Public
											</option>
											<option value="private">
												Private
											</option>
											<option value="hidden">
												Hidden
											</option>
										</select>
									</div>
									<EditableList
										items={
											card.visibility.reveal_conditions
										}
										onChange={(v) =>
											onChange({
												visibility: {
													...card.visibility,
													reveal_conditions: v,
												},
											})
										}
										placeholder="Reveal condition..."
										addLabel="Add condition"
									/>
								</div>

								{/* Play Timing */}
								<div>
									<span className="form-label">
										Play Timing
									</span>
									<div className="mt-1.5 flex flex-wrap gap-1">
										<Toggle
											label="Own turn"
											value={
												card.play_timing.own_turn_only
											}
											onChange={(v) =>
												onChange({
													play_timing: {
														...card.play_timing,
														own_turn_only: v,
													},
												})
											}
										/>
										<Toggle
											label="Any turn"
											value={card.play_timing.any_turn}
											onChange={(v) =>
												onChange({
													play_timing: {
														...card.play_timing,
														any_turn: v,
													},
												})
											}
										/>
										<Toggle
											label="Reaction"
											value={
												card.play_timing.reaction_only
											}
											onChange={(v) =>
												onChange({
													play_timing: {
														...card.play_timing,
														reaction_only: v,
													},
												})
											}
										/>
										<Toggle
											label="End-of-turn"
											value={
												card.play_timing
													.end_of_turn_triggered
											}
											onChange={(v) =>
												onChange({
													play_timing: {
														...card.play_timing,
														end_of_turn_triggered:
															v,
													},
												})
											}
										/>
									</div>
								</div>

								{/* Effects */}
								<div>
									<span className="form-label">Effects</span>
									{(
										[
											"primary_effects",
											"secondary_effects",
											"triggered_effects",
											"passive_effects",
											"ongoing_effects",
										] as const
									).map((key) => (
										<div key={key} className="mt-1.5">
											<span className="font-body text-[10px] uppercase tracking-wider text-[var(--color-stone-dim)]">
												{key.replace(/_/g, " ")}
											</span>
											<EditableList
												items={card.effects[key]}
												onChange={(v) =>
													onChange({
														effects: {
															...card.effects,
															[key]: v,
														},
													})
												}
												placeholder="Effect..."
												addLabel="Add"
											/>
										</div>
									))}
								</div>

								{/* Stack Behavior */}
								<div>
									<span className="form-label">
										Stack Behavior
									</span>
									<div className="mt-1.5 flex flex-wrap gap-1">
										<Toggle
											label="Can stack"
											value={
												card.stack_behavior.can_stack
											}
											onChange={(v) =>
												onChange({
													stack_behavior: {
														...card.stack_behavior,
														can_stack: v,
													},
												})
											}
										/>
										<Toggle
											label="Cancels prev"
											value={
												card.stack_behavior
													.cancels_previous
											}
											onChange={(v) =>
												onChange({
													stack_behavior: {
														...card.stack_behavior,
														cancels_previous: v,
													},
												})
											}
										/>
										<Toggle
											label="Revocable"
											value={
												card.stack_behavior
													.can_be_revoked
											}
											onChange={(v) =>
												onChange({
													stack_behavior: {
														...card.stack_behavior,
														can_be_revoked: v,
													},
												})
											}
										/>
										<Toggle
											label="Needs confirm"
											value={
												card.stack_behavior
													.requires_target_confirmation
											}
											onChange={(v) =>
												onChange({
													stack_behavior: {
														...card.stack_behavior,
														requires_target_confirmation:
															v,
													},
												})
											}
										/>
									</div>
								</div>

								{/* Lifecycle */}
								<div>
									<span className="form-label">
										Lifecycle
									</span>
									<select
										value={card.lifecycle}
										onChange={(e) =>
											onChange({
												lifecycle: e.target.value,
											})
										}
										className="form-select mt-1.5"
										style={{ fontSize: 12 }}
									>
										<option value="instant">Instant</option>
										<option value="persistent">
											Persistent
										</option>
										<option value="delayed">Delayed</option>
										<option value="conditional_expiry">
											Conditional Expiry
										</option>
									</select>
								</div>
							</div>
						</motion.div>
					)}
				</AnimatePresence>
			</div>
		</motion.div>
	);
}

/* ── Main CardBlueprintEditor ───────────────────────────────────────── */

export default function CardBlueprintEditor({
	cards,
	onChange,
}: CardBlueprintEditorProps) {
	const [search, setSearch] = useState("");
	const [categoryFilter, setCategoryFilter] = useState<string | null>(null);

	const totalCards = cards.reduce((sum, c) => sum + c.count, 0);

	/* Derive unique categories */
	const categories = useMemo(() => {
		const set = new Set<string>();
		for (const c of cards) {
			if (c.category.trim()) set.add(c.category.trim());
		}
		return Array.from(set).sort();
	}, [cards]);

	/* Filtered cards */
	const filteredCards = useMemo(() => {
		let list = cards.map((card, originalIndex) => ({
			card,
			originalIndex,
		}));
		if (search.trim()) {
			const q = search.toLowerCase();
			list = list.filter(
				({ card }) =>
					card.display_name.toLowerCase().includes(q) ||
					card.category.toLowerCase().includes(q) ||
					card.rule_description.toLowerCase().includes(q),
			);
		}
		if (categoryFilter) {
			list = list.filter(
				({ card }) =>
					card.category.trim().toLowerCase() ===
					categoryFilter.toLowerCase(),
			);
		}
		return list;
	}, [cards, search, categoryFilter]);

	function updateCard(originalIndex: number, patch: Partial<CardBlueprint>) {
		const next = [...cards];
		next[originalIndex] = { ...next[originalIndex]!, ...patch };
		onChange(next);
	}

	return (
		<section className="section-panel">
			<div className="section-panel-inner">
				{/* Header */}
				<div className="flex flex-wrap items-center justify-between gap-3">
					<h3
						className="sub-section-title"
						style={{ marginBottom: 0 }}
					>
						<Layers className="h-4 w-4" />
						Card Blueprints
						<span className="ml-1 font-body text-sm font-normal text-[var(--color-stone)]">
							({cards.length} types, {totalCards} total)
						</span>
					</h3>
					<button
						type="button"
						onClick={() => onChange([...cards, emptyCard()])}
						className="btn-press flex items-center gap-1.5 rounded-lg bg-[var(--color-gold-muted)] px-3 py-2 font-display text-xs font-medium tracking-wider text-[var(--color-gold)] transition-all hover:bg-[var(--color-gold)] hover:text-[var(--color-bg-deep)]"
					>
						<Plus className="h-3.5 w-3.5" /> ADD CARD
					</button>
				</div>

				{/* Search + Filters */}
				<div className="mt-4 space-y-3">
					<div className="search-input-wrap">
						<Search />
						<input
							type="text"
							value={search}
							onChange={(e) => setSearch(e.target.value)}
							placeholder="Search cards by name, category, or rule..."
							className="search-input"
						/>
					</div>

					{categories.length > 1 && (
						<div className="flex flex-wrap gap-2">
							<button
								type="button"
								onClick={() => setCategoryFilter(null)}
								className={`category-pill ${categoryFilter === null ? "category-pill--active" : ""}`}
							>
								All
							</button>
							{categories.map((cat) => (
								<button
									key={cat}
									type="button"
									onClick={() =>
										setCategoryFilter(
											categoryFilter === cat ? null : cat,
										)
									}
									className={`category-pill ${categoryFilter === cat ? "category-pill--active" : ""}`}
								>
									{cat}
								</button>
							))}
						</div>
					)}
				</div>

				{/* Card Grid */}
				<div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
					<AnimatePresence>
						{filteredCards.map(({ card, originalIndex }, i) => (
							<CardTile
								key={`card-${originalIndex}`}
								card={card}
								index={i}
								onChange={(patch) =>
									updateCard(originalIndex, patch)
								}
								onDelete={() =>
									onChange(
										cards.filter(
											(_, j) => j !== originalIndex,
										),
									)
								}
							/>
						))}
					</AnimatePresence>
				</div>

				{/* Empty state */}
				{filteredCards.length === 0 && (
					<div className="empty-state">
						<Layers />
						<p>
							{search || categoryFilter
								? "No cards match your search."
								: "No cards yet. Add your first card!"}
						</p>
					</div>
				)}
			</div>
		</section>
	);
}
