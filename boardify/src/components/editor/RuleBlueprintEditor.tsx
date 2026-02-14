"use client";

import { useState } from "react";
import type { RuleBlueprint } from "~/types/game";
import { ChevronDown, ChevronUp, Plus, Trash2, Minus } from "lucide-react";
import EditableText from "~/components/ui/EditableText";

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

export default function RuleBlueprintEditor({ rules, onChange }: RuleBlueprintEditorProps) {
	const [collapsed, setCollapsed] = useState(false);

	function updateRule(i: number, patch: Partial<RuleBlueprint>) {
		const next = [...rules];
		next[i] = { ...next[i]!, ...patch };
		onChange(next);
	}

	return (
		<section className="rounded-2xl border border-slate-700 bg-slate-800 p-6">
			<button type="button" onClick={() => setCollapsed(!collapsed)} className="flex w-full items-center justify-between">
				<h3 className="font-bold text-xl text-indigo-300">
					Global Rules{" "}
					<span className="text-sm font-normal text-slate-500">({rules.length} rules)</span>
				</h3>
				{collapsed ? <ChevronDown className="h-5 w-5 text-slate-500" /> : <ChevronUp className="h-5 w-5 text-slate-500" />}
			</button>

			{!collapsed && (
				<>
					<div className="mt-4 space-y-3">
						{rules.map((rule, i) => (
							<div key={`rule-${i}`} className="group relative rounded-xl border border-slate-600 bg-slate-900/50 p-4 transition-all hover:border-slate-500">
								<button type="button" onClick={() => onChange(rules.filter((_, j) => j !== i))} className="absolute top-3 right-3 rounded p-1 text-slate-600 opacity-0 transition-all hover:bg-red-500/20 hover:text-red-400 group-hover:opacity-100">
									<Trash2 className="h-4 w-4" />
								</button>

								{/* Name + Type */}
								<div className="flex items-center gap-3 pr-8">
									<input type="text" value={rule.name} onChange={(e) => updateRule(i, { name: e.target.value })} placeholder="Rule name..." className="flex-1 rounded-lg border border-transparent bg-transparent px-2 py-1 font-semibold text-white outline-none hover:border-slate-600 focus:border-indigo-500 focus:bg-slate-900" />
									<select value={rule.rule_type} onChange={(e) => updateRule(i, { rule_type: e.target.value })} className="rounded border border-slate-600 bg-slate-900 px-2 py-1 text-xs text-slate-400 outline-none">
										{RULE_TYPES.map((t) => (
											<option key={t} value={t}>{t.replace(/_/g, " ")}</option>
										))}
									</select>
								</div>

								{/* Fields */}
								<div className="mt-2 space-y-1">
									<div className="flex items-center gap-2">
										<span className="min-w-20 text-xs text-slate-500">Trigger:</span>
										<EditableText value={rule.trigger_condition} onChange={(v) => updateRule(i, { trigger_condition: v })} className="text-xs text-slate-300" placeholder="When..." />
									</div>
									<div className="flex items-center gap-2">
										<span className="min-w-20 text-xs text-slate-500">Validation:</span>
										<EditableText value={rule.validation_logic} onChange={(v) => updateRule(i, { validation_logic: v })} className="text-xs text-slate-300" placeholder="Check..." />
									</div>
									<div className="flex items-center gap-2">
										<span className="min-w-20 text-xs text-slate-500">Effect:</span>
										<EditableText value={rule.resulting_effect} onChange={(v) => updateRule(i, { resulting_effect: v })} className="text-xs text-slate-300" placeholder="Then..." />
									</div>
									<div className="flex items-center gap-2">
										<span className="min-w-20 text-xs text-slate-500">Conflict:</span>
										<EditableText value={rule.conflict_resolution} onChange={(v) => updateRule(i, { conflict_resolution: v })} className="text-xs text-slate-300" placeholder="Resolution..." />
									</div>
									<div className="flex items-center gap-4">
										<div className="flex items-center gap-2">
											<span className="text-xs text-slate-500">Priority:</span>
											<div className="flex items-center">
												<button type="button" onClick={() => updateRule(i, { priority_level: Math.max(0, rule.priority_level - 1) })} className="flex h-6 w-6 items-center justify-center rounded-l border border-slate-600 bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white">
													<Minus className="h-3 w-3" />
												</button>
												<span className="flex h-6 min-w-8 items-center justify-center border-y border-slate-600 bg-slate-900 px-1 text-xs text-white tabular-nums">{rule.priority_level}</span>
												<button type="button" onClick={() => updateRule(i, { priority_level: rule.priority_level + 1 })} className="flex h-6 w-6 items-center justify-center rounded-r border border-slate-600 bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white">
													<Plus className="h-3 w-3" />
												</button>
											</div>
										</div>
										<label className="flex cursor-pointer items-center gap-1.5">
											<input type="checkbox" checked={rule.override_capability} onChange={(e) => updateRule(i, { override_capability: e.target.checked })} className="h-3.5 w-3.5 rounded border-slate-600 bg-slate-900 accent-indigo-500" />
											<span className="text-xs text-slate-400">Can override</span>
										</label>
									</div>
								</div>
							</div>
						))}
					</div>
					<button type="button" onClick={() => onChange([...rules, emptyRule()])} className="mt-3 flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-indigo-400 hover:bg-indigo-500/10 hover:text-indigo-300">
						<Plus className="h-4 w-4" /> Add rule
					</button>
				</>
			)}
		</section>
	);
}
