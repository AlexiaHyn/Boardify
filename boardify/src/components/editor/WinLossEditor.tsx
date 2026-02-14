"use client";

import type {
	WinLossBlueprint,
	VictoryCondition,
	LossCondition,
} from "~/types/game";
import { Plus, Trash2, Trophy, Skull, Scale } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface WinLossEditorProps {
	winLoss: WinLossBlueprint;
	onChange: (wl: WinLossBlueprint) => void;
}

const VICTORY_TYPES = [
	"empty_hand",
	"last_standing",
	"score_based",
	"objective_based",
	"survival_based",
];
const LOSS_TYPES = ["explosion", "timeout", "illegal_move", "elimination"];
const TIE_STRATEGIES = [
	"seat_order_priority",
	"sudden_death",
	"shared_victory",
];

function ConditionCard({
	type,
	description,
	onTypeChange,
	onDescChange,
	onDelete,
	typeOptions,
	index,
	accent,
}: {
	type: string;
	description: string;
	onTypeChange: (v: string) => void;
	onDescChange: (v: string) => void;
	onDelete: () => void;
	typeOptions: string[];
	index: number;
	accent: string;
}) {
	return (
		<motion.div
			className="group relative rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-deep)]/50 p-4 transition-all hover:border-[var(--color-gold-dim)]/30"
			initial={{ opacity: 0, y: 10 }}
			animate={{ opacity: 1, y: 0 }}
			exit={{ opacity: 0, scale: 0.95 }}
			transition={{ delay: index * 0.04 }}
		>
			<button
				type="button"
				onClick={onDelete}
				className="absolute top-3 right-3 rounded p-1 text-[var(--color-border)] opacity-0 transition-all hover:text-[var(--color-crimson)] group-hover:opacity-100"
			>
				<Trash2 className="h-3.5 w-3.5" />
			</button>

			<div className="flex flex-wrap items-start gap-3 pr-8">
				<div className="form-field" style={{ minWidth: 140 }}>
					<label className="form-label">Type</label>
					<select
						value={type}
						onChange={(e) => onTypeChange(e.target.value)}
						className="form-select"
					>
						{typeOptions.map((t) => (
							<option key={t} value={t}>
								{t.replace(/_/g, " ")}
							</option>
						))}
					</select>
				</div>
				<div className="form-field flex-1" style={{ minWidth: 200 }}>
					<label className="form-label">Description</label>
					<textarea
						value={description}
						onChange={(e) => onDescChange(e.target.value)}
						placeholder="Describe this condition..."
						rows={2}
						className="form-textarea"
						style={{ minHeight: 44, fontSize: 13 }}
					/>
				</div>
			</div>

			{/* Accent bar */}
			<div
				className="absolute top-0 left-0 h-full w-1 rounded-l-lg"
				style={{ background: accent }}
			/>
		</motion.div>
	);
}

export default function WinLossEditor({
	winLoss,
	onChange,
}: WinLossEditorProps) {
	function updateVictory(i: number, patch: Partial<VictoryCondition>) {
		const next = [...winLoss.victory_conditions];
		next[i] = { ...next[i]!, ...patch };
		onChange({ ...winLoss, victory_conditions: next });
	}

	function updateLoss(i: number, patch: Partial<LossCondition>) {
		const next = [...winLoss.loss_conditions];
		next[i] = { ...next[i]!, ...patch };
		onChange({ ...winLoss, loss_conditions: next });
	}

	return (
		<section className="section-panel">
			<div className="section-panel-inner space-y-0">
				{/* ── Victory Conditions ─────────────────────────── */}
				<div className="sub-section">
					<div className="flex flex-wrap items-center justify-between gap-3">
						<h4
							className="sub-section-title"
							style={{
								marginBottom: 0,
								color: "var(--color-verdant)",
							}}
						>
							<Trophy />
							Victory Conditions
						</h4>
						<button
							type="button"
							onClick={() =>
								onChange({
									...winLoss,
									victory_conditions: [
										...winLoss.victory_conditions,
										{ type: "empty_hand", description: "" },
									],
								})
							}
							className="btn-press flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-display text-xs font-medium tracking-wider text-[var(--color-verdant)] transition-all hover:bg-[var(--color-verdant)]/10 hover:text-[var(--color-verdant-bright)]"
						>
							<Plus className="h-3.5 w-3.5" /> ADD
						</button>
					</div>

					<div className="mt-3 space-y-3">
						<AnimatePresence>
							{winLoss.victory_conditions.map((vc, i) => (
								<ConditionCard
									key={`vic-${i}`}
									type={vc.type}
									description={vc.description}
									typeOptions={VICTORY_TYPES}
									index={i}
									accent="var(--color-verdant)"
									onTypeChange={(v) =>
										updateVictory(i, { type: v })
									}
									onDescChange={(v) =>
										updateVictory(i, { description: v })
									}
									onDelete={() =>
										onChange({
											...winLoss,
											victory_conditions:
												winLoss.victory_conditions.filter(
													(_, j) => j !== i,
												),
										})
									}
								/>
							))}
						</AnimatePresence>
					</div>
				</div>

				{/* ── Loss Conditions ────────────────────────────── */}
				<div className="sub-section">
					<div className="flex flex-wrap items-center justify-between gap-3">
						<h4
							className="sub-section-title"
							style={{
								marginBottom: 0,
								color: "var(--color-crimson)",
							}}
						>
							<Skull />
							Loss Conditions
						</h4>
						<button
							type="button"
							onClick={() =>
								onChange({
									...winLoss,
									loss_conditions: [
										...winLoss.loss_conditions,
										{
											type: "elimination",
											description: "",
										},
									],
								})
							}
							className="btn-press flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-display text-xs font-medium tracking-wider text-[var(--color-crimson)] transition-all hover:bg-[var(--color-crimson)]/10 hover:text-[var(--color-crimson-bright)]"
						>
							<Plus className="h-3.5 w-3.5" /> ADD
						</button>
					</div>

					<div className="mt-3 space-y-3">
						<AnimatePresence>
							{winLoss.loss_conditions.map((lc, i) => (
								<ConditionCard
									key={`loss-${i}`}
									type={lc.type}
									description={lc.description}
									typeOptions={LOSS_TYPES}
									index={i}
									accent="var(--color-crimson)"
									onTypeChange={(v) =>
										updateLoss(i, { type: v })
									}
									onDescChange={(v) =>
										updateLoss(i, { description: v })
									}
									onDelete={() =>
										onChange({
											...winLoss,
											loss_conditions:
												winLoss.loss_conditions.filter(
													(_, j) => j !== i,
												),
										})
									}
								/>
							))}
						</AnimatePresence>
					</div>
				</div>

				{/* ── Tie Handling ───────────────────────────────── */}
				<div className="sub-section">
					<h4
						className="sub-section-title"
						style={{ color: "var(--color-amber-bright)" }}
					>
						<Scale />
						Tie Handling
					</h4>
					<div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-deep)]/50 p-4">
						<div className="form-row">
							<div className="form-field">
								<label className="form-label">Strategy</label>
								<select
									value={winLoss.tie_handling.strategy}
									onChange={(e) =>
										onChange({
											...winLoss,
											tie_handling: {
												...winLoss.tie_handling,
												strategy: e.target.value,
											},
										})
									}
									className="form-select"
								>
									{TIE_STRATEGIES.map((t) => (
										<option key={t} value={t}>
											{t.replace(/_/g, " ")}
										</option>
									))}
								</select>
							</div>
							<div className="form-field">
								<label className="form-label">
									Description
								</label>
								<textarea
									value={winLoss.tie_handling.description}
									onChange={(e) =>
										onChange({
											...winLoss,
											tie_handling: {
												...winLoss.tie_handling,
												description: e.target.value,
											},
										})
									}
									placeholder="Describe how ties are broken..."
									rows={2}
									className="form-textarea"
									style={{ minHeight: 44, fontSize: 13 }}
								/>
							</div>
						</div>
					</div>
				</div>
			</div>
		</section>
	);
}
