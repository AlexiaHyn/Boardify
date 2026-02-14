"use client";

import { useState } from "react";
import type { WinLossBlueprint, VictoryCondition, LossCondition } from "~/types/game";
import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";

interface WinLossEditorProps {
	winLoss: WinLossBlueprint;
	onChange: (wl: WinLossBlueprint) => void;
}

function ConditionRow({ type, description, onTypeChange, onDescChange, onDelete, typeOptions }: {
	type: string; description: string;
	onTypeChange: (v: string) => void; onDescChange: (v: string) => void; onDelete: () => void;
	typeOptions: string[];
}) {
	return (
		<div className="group flex items-start gap-2 rounded-lg border border-slate-600 bg-slate-900/50 p-3 transition-all hover:border-slate-500">
			<select value={type} onChange={(e) => onTypeChange(e.target.value)} className="rounded border border-slate-600 bg-slate-900 px-2 py-1 text-xs text-slate-300 outline-none">
				{typeOptions.map((t) => (
					<option key={t} value={t}>{t.replace(/_/g, " ")}</option>
				))}
			</select>
			<textarea value={description} onChange={(e) => onDescChange(e.target.value)} placeholder="Description..." rows={1} className="flex-1 resize-y rounded border border-transparent bg-transparent px-2 py-1 text-sm text-slate-300 outline-none hover:border-slate-600 focus:border-indigo-500 focus:bg-slate-900" />
			<button type="button" onClick={onDelete} className="rounded p-1 text-slate-600 opacity-0 transition-all hover:bg-red-500/20 hover:text-red-400 group-hover:opacity-100">
				<Trash2 className="h-3.5 w-3.5" />
			</button>
		</div>
	);
}

const VICTORY_TYPES = ["empty_hand", "last_standing", "score_based", "objective_based", "survival_based"];
const LOSS_TYPES = ["explosion", "timeout", "illegal_move", "elimination"];
const TIE_STRATEGIES = ["seat_order_priority", "sudden_death", "shared_victory"];

export default function WinLossEditor({ winLoss, onChange }: WinLossEditorProps) {
	const [collapsed, setCollapsed] = useState(false);

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
		<section className="rounded-2xl border border-slate-700 bg-slate-800 p-6">
			<button type="button" onClick={() => setCollapsed(!collapsed)} className="flex w-full items-center justify-between">
				<h3 className="font-bold text-xl text-indigo-300">Win / Loss Conditions</h3>
				{collapsed ? <ChevronDown className="h-5 w-5 text-slate-500" /> : <ChevronUp className="h-5 w-5 text-slate-500" />}
			</button>

			{!collapsed && (
				<div className="mt-4 space-y-6">
					{/* Victory */}
					<div>
						<h4 className="mb-2 font-medium text-emerald-300">Victory Conditions</h4>
						<div className="space-y-2">
							{winLoss.victory_conditions.map((vc, i) => (
								<ConditionRow key={`vic-${i}`} type={vc.type} description={vc.description} typeOptions={VICTORY_TYPES}
									onTypeChange={(v) => updateVictory(i, { type: v })}
									onDescChange={(v) => updateVictory(i, { description: v })}
									onDelete={() => onChange({ ...winLoss, victory_conditions: winLoss.victory_conditions.filter((_, j) => j !== i) })}
								/>
							))}
						</div>
						<button type="button" onClick={() => onChange({ ...winLoss, victory_conditions: [...winLoss.victory_conditions, { type: "empty_hand", description: "" }] })} className="mt-2 flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-300">
							<Plus className="h-4 w-4" /> Add victory condition
						</button>
					</div>

					{/* Loss */}
					<div>
						<h4 className="mb-2 font-medium text-red-300">Loss Conditions</h4>
						<div className="space-y-2">
							{winLoss.loss_conditions.map((lc, i) => (
								<ConditionRow key={`loss-${i}`} type={lc.type} description={lc.description} typeOptions={LOSS_TYPES}
									onTypeChange={(v) => updateLoss(i, { type: v })}
									onDescChange={(v) => updateLoss(i, { description: v })}
									onDelete={() => onChange({ ...winLoss, loss_conditions: winLoss.loss_conditions.filter((_, j) => j !== i) })}
								/>
							))}
						</div>
						<button type="button" onClick={() => onChange({ ...winLoss, loss_conditions: [...winLoss.loss_conditions, { type: "elimination", description: "" }] })} className="mt-2 flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 hover:text-red-300">
							<Plus className="h-4 w-4" /> Add loss condition
						</button>
					</div>

					{/* Tie Handling */}
					<div>
						<h4 className="mb-2 font-medium text-amber-300">Tie Handling</h4>
						<div className="flex items-start gap-3 rounded-lg border border-slate-600 bg-slate-900/50 p-3">
							<select value={winLoss.tie_handling.strategy} onChange={(e) => onChange({ ...winLoss, tie_handling: { ...winLoss.tie_handling, strategy: e.target.value } })} className="rounded border border-slate-600 bg-slate-900 px-2 py-1 text-xs text-slate-300 outline-none">
								{TIE_STRATEGIES.map((t) => (
									<option key={t} value={t}>{t.replace(/_/g, " ")}</option>
								))}
							</select>
							<textarea value={winLoss.tie_handling.description} onChange={(e) => onChange({ ...winLoss, tie_handling: { ...winLoss.tie_handling, description: e.target.value } })} placeholder="Describe tie-breaking..." rows={1} className="flex-1 resize-y rounded border border-transparent bg-transparent px-2 py-1 text-sm text-slate-300 outline-none hover:border-slate-600 focus:border-indigo-500 focus:bg-slate-900" />
						</div>
					</div>
				</div>
			)}
		</section>
	);
}
