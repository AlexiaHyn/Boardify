"use client";

import { useState } from "react";
import type { TurnModelBlueprint } from "~/types/game";
import { ChevronDown, ChevronUp, Minus, Plus } from "lucide-react";
import EditableText from "~/components/ui/EditableText";
import EditableList from "~/components/ui/EditableList";

interface TurnModelEditorProps {
	turnModel: TurnModelBlueprint;
	onChange: (tm: TurnModelBlueprint) => void;
}

function Stepper({ value, onChange, label, min = 0 }: { value: number; onChange: (v: number) => void; label: string; min?: number }) {
	return (
		<div className="flex items-center gap-2">
			<span className="text-xs text-slate-500">{label}:</span>
			<div className="flex items-center">
				<button type="button" onClick={() => onChange(Math.max(min, value - 1))} className="flex h-7 w-7 items-center justify-center rounded-l-lg border border-slate-600 bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white">
					<Minus className="h-3.5 w-3.5" />
				</button>
				<span className="flex h-7 min-w-9 items-center justify-center border-y border-slate-600 bg-slate-900 px-2 text-sm font-medium text-white tabular-nums">{value}</span>
				<button type="button" onClick={() => onChange(value + 1)} className="flex h-7 w-7 items-center justify-center rounded-r-lg border border-slate-600 bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white">
					<Plus className="h-3.5 w-3.5" />
				</button>
			</div>
		</div>
	);
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
	return (
		<div className="flex items-center gap-2">
			<span className="min-w-24 text-xs text-slate-500">{label}:</span>
			<EditableText value={value} onChange={onChange} className="text-sm text-slate-300" placeholder={placeholder} />
		</div>
	);
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
	return (
		<label className="flex cursor-pointer items-center gap-2">
			<input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 rounded border-slate-600 bg-slate-900 accent-indigo-500" />
			<span className="text-sm text-slate-300">{label}</span>
		</label>
	);
}

export default function TurnModelEditor({ turnModel, onChange }: TurnModelEditorProps) {
	const [collapsed, setCollapsed] = useState(false);

	return (
		<section className="rounded-2xl border border-slate-700 bg-slate-800 p-6">
			<button type="button" onClick={() => setCollapsed(!collapsed)} className="flex w-full items-center justify-between">
				<h3 className="font-bold text-xl text-indigo-300">Turn Model</h3>
				{collapsed ? <ChevronDown className="h-5 w-5 text-slate-500" /> : <ChevronUp className="h-5 w-5 text-slate-500" />}
			</button>

			{!collapsed && (
				<div className="mt-4 space-y-6">
					{/* Turn Order */}
					<div>
						<h4 className="mb-2 font-medium text-slate-200">Turn Order</h4>
						<div className="space-y-2">
							<Field label="Direction" value={turnModel.turn_order.direction} onChange={(v) => onChange({ ...turnModel, turn_order: { ...turnModel.turn_order, direction: v } })} placeholder="clockwise" />
							<Field label="Reverse rule" value={turnModel.turn_order.reverse_handling} onChange={(v) => onChange({ ...turnModel, turn_order: { ...turnModel.turn_order, reverse_handling: v } })} />
							<Field label="Extra turn" value={turnModel.turn_order.extra_turn_rule} onChange={(v) => onChange({ ...turnModel, turn_order: { ...turnModel.turn_order, extra_turn_rule: v } })} />
							<Field label="Skip rule" value={turnModel.turn_order.skip_rule} onChange={(v) => onChange({ ...turnModel, turn_order: { ...turnModel.turn_order, skip_rule: v } })} />
						</div>
					</div>

					{/* Action Policy */}
					<div>
						<h4 className="mb-2 font-medium text-slate-200">Action Policy</h4>
						<div className="space-y-2">
							<Stepper label="Max actions/turn" value={turnModel.action_policy.max_actions_per_turn} onChange={(v) => onChange({ ...turnModel, action_policy: { ...turnModel.action_policy, max_actions_per_turn: v } })} min={1} />
							<Field label="Draw timing" value={turnModel.action_policy.draw_requirement_timing} onChange={(v) => onChange({ ...turnModel, action_policy: { ...turnModel.action_policy, draw_requirement_timing: v } })} />
							<Field label="End-of-turn" value={turnModel.action_policy.end_of_turn_validation} onChange={(v) => onChange({ ...turnModel, action_policy: { ...turnModel.action_policy, end_of_turn_validation: v } })} />
							<div>
								<span className="text-xs text-slate-500">Forced actions:</span>
								<EditableList items={turnModel.action_policy.forced_actions} onChange={(v) => onChange({ ...turnModel, action_policy: { ...turnModel.action_policy, forced_actions: v } })} placeholder="Action..." addLabel="Add action" />
							</div>
						</div>
					</div>

					{/* Interrupt Policy */}
					<div>
						<h4 className="mb-2 font-medium text-slate-200">Interrupt Policy</h4>
						<div className="space-y-2">
							<Toggle label="Interrupts allowed" value={turnModel.interrupt_policy.interrupt_allowed} onChange={(v) => onChange({ ...turnModel, interrupt_policy: { ...turnModel.interrupt_policy, interrupt_allowed: v } })} />
							<Field label="Who reacts" value={turnModel.interrupt_policy.who_can_react} onChange={(v) => onChange({ ...turnModel, interrupt_policy: { ...turnModel.interrupt_policy, who_can_react: v } })} placeholder="any / target / next_player" />
							<Stepper label="Reaction timer (s)" value={turnModel.interrupt_policy.reaction_time_limit} onChange={(v) => onChange({ ...turnModel, interrupt_policy: { ...turnModel.interrupt_policy, reaction_time_limit: v } })} />
						</div>
					</div>

					{/* Timeout Policy */}
					<div>
						<h4 className="mb-2 font-medium text-slate-200">Timeout Policy</h4>
						<div className="space-y-2">
							<Stepper label="Turn timer (s)" value={turnModel.timeout_policy.per_turn_timer} onChange={(v) => onChange({ ...turnModel, timeout_policy: { ...turnModel.timeout_policy, per_turn_timer: v } })} />
							<Stepper label="Reaction timer (s)" value={turnModel.timeout_policy.per_reaction_timer} onChange={(v) => onChange({ ...turnModel, timeout_policy: { ...turnModel.timeout_policy, per_reaction_timer: v } })} />
							<Field label="Auto-resolve" value={turnModel.timeout_policy.auto_resolve_behavior} onChange={(v) => onChange({ ...turnModel, timeout_policy: { ...turnModel.timeout_policy, auto_resolve_behavior: v } })} />
						</div>
					</div>
				</div>
			)}
		</section>
	);
}
