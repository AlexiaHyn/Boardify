"use client";

import type { RuleBlueprint } from "~/types/game";
import { Plus, Trash2, Minus, BookOpen } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface RuleBlueprintEditorProps {
	rules: RuleBlueprint[];
	onChange: (rules: RuleBlueprint[]) => void;
}

const RULE_TYPES = [
	"match_validation",
	"forced_draw",
	"hand_limit",
	"deck_exhaustion",
	"elimination",
	"turn_transition",
	"simultaneous_effect",
];

function emptyRule(): RuleBlueprint {
	return {
		rule_id: "",
		name: "",
		rule_type: "match_validation",
		trigger_condition: "",
		validation_logic: "",
		resulting_effect: "",
		priority_level: 1,
		conflict_resolution: "",
		override_capability: false,
	};
}

function RuleCard({
	rule,
	index,
	onChange,
	onDelete,
}: {
	rule: RuleBlueprint;
	index: number;
	onChange: (patch: Partial<RuleBlueprint>) => void;
	onDelete: () => void;
}) {
	return (
		<motion.div
			className="group relative rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-deep)]/60 p-5 transition-all hover:border-[var(--color-gold-dim)]/40"
			initial={{ opacity: 0, y: 15 }}
			animate={{ opacity: 1, y: 0 }}
			exit={{ opacity: 0, scale: 0.95 }}
			transition={{ delay: index * 0.04, duration: 0.3 }}
		>
			{/* Delete */}
			<button
				type="button"
				onClick={onDelete}
				className="absolute top-4 right-4 rounded p-1 text-[var(--color-border)] opacity-0 transition-all hover:text-[var(--color-crimson)] group-hover:opacity-100"
			>
				<Trash2 className="h-4 w-4" />
			</button>

			{/* Name + Type row */}
			<div className="flex flex-wrap items-center gap-3 pr-10">
				<div className="form-field flex-1" style={{ minWidth: 160 }}>
					<label className="form-label">Rule Name</label>
					<input
						type="text"
						value={rule.name}
						onChange={(e) => onChange({ name: e.target.value })}
						placeholder="e.g. Color Match Required"
						className="form-input"
					/>
				</div>
				<div className="form-field" style={{ minWidth: 140 }}>
					<label className="form-label">Type</label>
					<select
						value={rule.rule_type}
						onChange={(e) =>
							onChange({ rule_type: e.target.value })
						}
						className="form-select"
					>
						{RULE_TYPES.map((t) => (
							<option key={t} value={t}>
								{t.replace(/_/g, " ")}
							</option>
						))}
					</select>
				</div>
			</div>

			{/* Detail fields */}
			<div className="form-row mt-3">
				<div className="form-field">
					<label className="form-label">Trigger Condition</label>
					<input
						type="text"
						value={rule.trigger_condition}
						onChange={(e) =>
							onChange({ trigger_condition: e.target.value })
						}
						placeholder="When does this rule activate?"
						className="form-input"
					/>
				</div>
				<div className="form-field">
					<label className="form-label">Validation Logic</label>
					<input
						type="text"
						value={rule.validation_logic}
						onChange={(e) =>
							onChange({ validation_logic: e.target.value })
						}
						placeholder="What must be checked?"
						className="form-input"
					/>
				</div>
			</div>

			<div className="form-row mt-3">
				<div className="form-field">
					<label className="form-label">Resulting Effect</label>
					<input
						type="text"
						value={rule.resulting_effect}
						onChange={(e) =>
							onChange({ resulting_effect: e.target.value })
						}
						placeholder="What happens when triggered?"
						className="form-input"
					/>
				</div>
				<div className="form-field">
					<label className="form-label">Conflict Resolution</label>
					<input
						type="text"
						value={rule.conflict_resolution}
						onChange={(e) =>
							onChange({ conflict_resolution: e.target.value })
						}
						placeholder="How are conflicts resolved?"
						className="form-input"
					/>
				</div>
			</div>

			{/* Priority + Override */}
			<div className="mt-3 flex flex-wrap items-end gap-4">
				<div className="form-field">
					<label className="form-label">Priority</label>
					<div className="stepper-controls">
						<button
							type="button"
							onClick={() =>
								onChange({
									priority_level: Math.max(
										0,
										rule.priority_level - 1,
									),
								})
							}
							className="stepper-btn"
							style={{ width: 28, height: 28 }}
						>
							<Minus className="h-3 w-3" />
						</button>
						<span
							className="stepper-value"
							style={{ minWidth: 36, height: 28, fontSize: 13 }}
						>
							{rule.priority_level}
						</span>
						<button
							type="button"
							onClick={() =>
								onChange({
									priority_level: rule.priority_level + 1,
								})
							}
							className="stepper-btn"
							style={{ width: 28, height: 28 }}
						>
							<Plus className="h-3 w-3" />
						</button>
					</div>
				</div>
				<label className="flex cursor-pointer items-center gap-2 pb-1">
					<input
						type="checkbox"
						checked={rule.override_capability}
						onChange={(e) =>
							onChange({ override_capability: e.target.checked })
						}
						className="h-4 w-4 rounded border-[var(--color-border)] bg-[var(--color-bg-deep)] accent-[var(--color-gold)]"
					/>
					<span className="font-body text-sm text-[var(--color-cream-dim)]">
						Can override other rules
					</span>
				</label>
			</div>
		</motion.div>
	);
}

export default function RuleBlueprintEditor({
	rules,
	onChange,
}: RuleBlueprintEditorProps) {
	function updateRule(i: number, patch: Partial<RuleBlueprint>) {
		const next = [...rules];
		next[i] = { ...next[i]!, ...patch };
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
						<BookOpen className="h-4 w-4" />
						Global Rules
						<span className="ml-1 font-body text-sm font-normal text-[var(--color-stone)]">
							({rules.length} rules)
						</span>
					</h3>
					<button
						type="button"
						onClick={() => onChange([...rules, emptyRule()])}
						className="btn-press flex items-center gap-1.5 rounded-lg bg-[var(--color-gold-muted)] px-3 py-2 font-display text-xs font-medium tracking-wider text-[var(--color-gold)] transition-all hover:bg-[var(--color-gold)] hover:text-[var(--color-bg-deep)]"
					>
						<Plus className="h-3.5 w-3.5" /> ADD RULE
					</button>
				</div>

				{/* Rule List */}
				<div className="mt-4 space-y-3">
					<AnimatePresence>
						{rules.map((rule, i) => (
							<RuleCard
								key={`rule-${i}`}
								rule={rule}
								index={i}
								onChange={(patch) => updateRule(i, patch)}
								onDelete={() =>
									onChange(rules.filter((_, j) => j !== i))
								}
							/>
						))}
					</AnimatePresence>
				</div>

				{/* Empty state */}
				{rules.length === 0 && (
					<div className="empty-state">
						<BookOpen />
						<p>No rules yet. Add your first global rule!</p>
					</div>
				)}
			</div>
		</section>
	);
}
