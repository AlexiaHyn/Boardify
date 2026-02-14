"use client";

import { useState } from "react";
import type { CardBlueprint } from "~/types/game";
import { ChevronDown, ChevronUp, Plus, Minus, Trash2 } from "lucide-react";
import EditableList from "~/components/ui/EditableList";

interface CardBlueprintEditorProps {
	cards: CardBlueprint[];
	onChange: (cards: CardBlueprint[]) => void;
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
		play_timing: { own_turn_only: true, any_turn: false, reaction_only: false, end_of_turn_triggered: false },
		play_conditions: { state_conditions: [], target_requirements: [], zone_requirements: [], stack_requirements: [] },
		effects: { primary_effects: [], secondary_effects: [], triggered_effects: [], passive_effects: [], ongoing_effects: [] },
		stack_behavior: { can_stack: false, cancels_previous: false, can_be_revoked: false, requires_target_confirmation: false },
		lifecycle: "instant",
	};
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
	return (
		<label className="flex cursor-pointer items-center gap-1.5">
			<input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} className="h-3.5 w-3.5 rounded border-slate-600 bg-slate-900 accent-indigo-500" />
			<span className="text-xs text-slate-400">{label}</span>
		</label>
	);
}

function CardTile({ card, onChange, onDelete }: { card: CardBlueprint; onChange: (patch: Partial<CardBlueprint>) => void; onDelete: () => void }) {
	const [expanded, setExpanded] = useState(false);

	return (
		<div className="group relative rounded-xl border border-slate-600 bg-slate-900/50 p-4 transition-all hover:border-slate-500">
			<button type="button" onClick={onDelete} className="absolute top-3 right-3 rounded p-1 text-slate-600 opacity-0 transition-all hover:bg-red-500/20 hover:text-red-400 group-hover:opacity-100">
				<Trash2 className="h-4 w-4" />
			</button>

			{/* Name */}
			<input type="text" value={card.display_name} onChange={(e) => onChange({ display_name: e.target.value })} placeholder="Card name..." className="w-full rounded-lg border border-transparent bg-transparent px-2 py-1 font-semibold text-white outline-none hover:border-slate-600 focus:border-indigo-500 focus:bg-slate-900 pr-8" />

			{/* Category + Count */}
			<div className="mt-2 flex items-center justify-between">
				<input type="text" value={card.category} onChange={(e) => onChange({ category: e.target.value })} placeholder="Category..." className="w-28 rounded border border-transparent bg-transparent px-2 py-0.5 text-xs text-slate-400 outline-none hover:border-slate-600 focus:border-indigo-500" />
				<div className="flex items-center">
					<span className="mr-2 text-xs text-slate-500">Count:</span>
					<button type="button" onClick={() => onChange({ count: Math.max(0, card.count - 1) })} className="flex h-6 w-6 items-center justify-center rounded-l border border-slate-600 bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white">
						<Minus className="h-3 w-3" />
					</button>
					<span className="flex h-6 min-w-8 items-center justify-center border-y border-slate-600 bg-slate-900 px-1 text-xs text-white tabular-nums">{card.count}</span>
					<button type="button" onClick={() => onChange({ count: card.count + 1 })} className="flex h-6 w-6 items-center justify-center rounded-r border border-slate-600 bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white">
						<Plus className="h-3 w-3" />
					</button>
				</div>
			</div>

			{/* Rule description */}
			<textarea value={card.rule_description} onChange={(e) => onChange({ rule_description: e.target.value })} placeholder="Rule description..." rows={2} className="mt-2 w-full resize-y rounded-lg border border-transparent bg-transparent px-2 py-1 text-sm text-slate-400 outline-none hover:border-slate-600 focus:border-indigo-500 focus:bg-slate-900" />

			{/* Art prompt */}
			<input type="text" value={card.art_prompt} onChange={(e) => onChange({ art_prompt: e.target.value })} placeholder="Art description..." className="mt-1 w-full rounded-lg border border-transparent bg-transparent px-2 py-1 text-xs italic text-slate-500 outline-none hover:border-slate-600 focus:border-indigo-500 focus:bg-slate-900" />

			{/* Expand toggle */}
			<button type="button" onClick={() => setExpanded(!expanded)} className="mt-2 flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300">
				{expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
				{expanded ? "Less details" : "More details"}
			</button>

			{expanded && (
				<div className="mt-3 space-y-3 border-t border-slate-700 pt-3">
					{/* Visibility */}
					<div>
						<span className="text-xs font-medium text-slate-400">Visibility</span>
						<div className="mt-1 flex items-center gap-2">
							<select value={card.visibility.default_visibility} onChange={(e) => onChange({ visibility: { ...card.visibility, default_visibility: e.target.value } })} className="rounded border border-slate-600 bg-slate-900 px-2 py-1 text-xs text-white outline-none">
								<option value="public">Public</option>
								<option value="private">Private</option>
								<option value="hidden">Hidden</option>
							</select>
						</div>
						<EditableList items={card.visibility.reveal_conditions} onChange={(v) => onChange({ visibility: { ...card.visibility, reveal_conditions: v } })} placeholder="Reveal condition..." addLabel="Add condition" />
					</div>

					{/* Play Timing */}
					<div>
						<span className="text-xs font-medium text-slate-400">Play Timing</span>
						<div className="mt-1 flex flex-wrap gap-3">
							<Toggle label="Own turn" value={card.play_timing.own_turn_only} onChange={(v) => onChange({ play_timing: { ...card.play_timing, own_turn_only: v } })} />
							<Toggle label="Any turn" value={card.play_timing.any_turn} onChange={(v) => onChange({ play_timing: { ...card.play_timing, any_turn: v } })} />
							<Toggle label="Reaction" value={card.play_timing.reaction_only} onChange={(v) => onChange({ play_timing: { ...card.play_timing, reaction_only: v } })} />
							<Toggle label="End-of-turn" value={card.play_timing.end_of_turn_triggered} onChange={(v) => onChange({ play_timing: { ...card.play_timing, end_of_turn_triggered: v } })} />
						</div>
					</div>

					{/* Effects */}
					<div>
						<span className="text-xs font-medium text-slate-400">Effects</span>
						{(["primary_effects", "secondary_effects", "triggered_effects", "passive_effects", "ongoing_effects"] as const).map((key) => (
							<div key={key} className="mt-1">
								<span className="text-xs text-slate-500">{key.replace(/_/g, " ")}:</span>
								<EditableList items={card.effects[key]} onChange={(v) => onChange({ effects: { ...card.effects, [key]: v } })} placeholder="Effect..." addLabel="Add" />
							</div>
						))}
					</div>

					{/* Stack Behavior */}
					<div>
						<span className="text-xs font-medium text-slate-400">Stack Behavior</span>
						<div className="mt-1 flex flex-wrap gap-3">
							<Toggle label="Can stack" value={card.stack_behavior.can_stack} onChange={(v) => onChange({ stack_behavior: { ...card.stack_behavior, can_stack: v } })} />
							<Toggle label="Cancels prev" value={card.stack_behavior.cancels_previous} onChange={(v) => onChange({ stack_behavior: { ...card.stack_behavior, cancels_previous: v } })} />
							<Toggle label="Revocable" value={card.stack_behavior.can_be_revoked} onChange={(v) => onChange({ stack_behavior: { ...card.stack_behavior, can_be_revoked: v } })} />
							<Toggle label="Needs confirm" value={card.stack_behavior.requires_target_confirmation} onChange={(v) => onChange({ stack_behavior: { ...card.stack_behavior, requires_target_confirmation: v } })} />
						</div>
					</div>

					{/* Lifecycle */}
					<div>
						<span className="text-xs font-medium text-slate-400">Lifecycle</span>
						<select value={card.lifecycle} onChange={(e) => onChange({ lifecycle: e.target.value })} className="ml-2 rounded border border-slate-600 bg-slate-900 px-2 py-1 text-xs text-white outline-none">
							<option value="instant">Instant</option>
							<option value="persistent">Persistent</option>
							<option value="delayed">Delayed</option>
							<option value="conditional_expiry">Conditional Expiry</option>
						</select>
					</div>
				</div>
			)}
		</div>
	);
}

export default function CardBlueprintEditor({ cards, onChange }: CardBlueprintEditorProps) {
	const [collapsed, setCollapsed] = useState(false);
	const totalCards = cards.reduce((sum, c) => sum + c.count, 0);

	function updateCard(index: number, patch: Partial<CardBlueprint>) {
		const next = [...cards];
		next[index] = { ...next[index]!, ...patch };
		onChange(next);
	}

	return (
		<section className="rounded-2xl border border-slate-700 bg-slate-800 p-6">
			<button type="button" onClick={() => setCollapsed(!collapsed)} className="flex w-full items-center justify-between">
				<h3 className="font-bold text-xl text-indigo-300">
					Card Blueprints{" "}
					<span className="text-sm font-normal text-slate-500">({cards.length} types, {totalCards} total)</span>
				</h3>
				{collapsed ? <ChevronDown className="h-5 w-5 text-slate-500" /> : <ChevronUp className="h-5 w-5 text-slate-500" />}
			</button>

			{!collapsed && (
				<>
					<div className="mt-4 grid gap-3 sm:grid-cols-2">
						{cards.map((card, i) => (
							<CardTile key={`card-${i}`} card={card} onChange={(patch) => updateCard(i, patch)} onDelete={() => onChange(cards.filter((_, j) => j !== i))} />
						))}
					</div>
					<button type="button" onClick={() => onChange([...cards, emptyCard()])} className="mt-4 flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-indigo-400 hover:bg-indigo-500/10 hover:text-indigo-300">
						<Plus className="h-4 w-4" /> Add card type
					</button>
				</>
			)}
		</section>
	);
}
