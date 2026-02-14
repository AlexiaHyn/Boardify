"use client";

import { useState } from "react";
import type { SetupBlueprint, DeckComposition, CardPoolEntry, ZoneInit } from "~/types/game";
import { ChevronDown, ChevronUp, Plus, Trash2, Minus } from "lucide-react";
import EditableText from "~/components/ui/EditableText";
import EditableList from "~/components/ui/EditableList";

interface SetupBlueprintEditorProps {
	setup: SetupBlueprint;
	onChange: (setup: SetupBlueprint) => void;
}

export default function SetupBlueprintEditor({ setup, onChange }: SetupBlueprintEditorProps) {
	const [collapsed, setCollapsed] = useState(false);

	function updateDeck(i: number, patch: Partial<DeckComposition>) {
		const next = [...setup.deck_compositions];
		next[i] = { ...next[i]!, ...patch };
		onChange({ ...setup, deck_compositions: next });
	}

	function updatePoolEntry(deckIdx: number, entryIdx: number, patch: Partial<CardPoolEntry>) {
		const deck = setup.deck_compositions[deckIdx]!;
		const pool = [...deck.card_pool];
		pool[entryIdx] = { ...pool[entryIdx]!, ...patch };
		updateDeck(deckIdx, { card_pool: pool });
	}

	function updateZone(i: number, patch: Partial<ZoneInit>) {
		const next = [...setup.zone_initialization];
		next[i] = { ...next[i]!, ...patch };
		onChange({ ...setup, zone_initialization: next });
	}

	return (
		<section className="rounded-2xl border border-slate-700 bg-slate-800 p-6">
			<button type="button" onClick={() => setCollapsed(!collapsed)} className="flex w-full items-center justify-between">
				<h3 className="font-bold text-xl text-indigo-300">Setup Blueprint</h3>
				{collapsed ? <ChevronDown className="h-5 w-5 text-slate-500" /> : <ChevronUp className="h-5 w-5 text-slate-500" />}
			</button>

			{!collapsed && (
				<div className="mt-4 space-y-6">
					{/* Deck Compositions */}
					<div>
						<h4 className="mb-2 font-medium text-slate-200">Deck Compositions</h4>
						<div className="space-y-3">
							{setup.deck_compositions.map((deck, di) => (
								<div key={`deck-${di}`} className="rounded-xl border border-slate-600 bg-slate-900/50 p-4">
									<div className="flex items-center justify-between">
										<input
											type="text"
											value={deck.deck_name}
											onChange={(e) => updateDeck(di, { deck_name: e.target.value })}
											placeholder="Deck name..."
											className="rounded-lg border border-transparent bg-transparent px-2 py-1 font-semibold text-white outline-none hover:border-slate-600 focus:border-indigo-500 focus:bg-slate-900"
										/>
										<button
											type="button"
											onClick={() => onChange({ ...setup, deck_compositions: setup.deck_compositions.filter((_, i) => i !== di) })}
											className="rounded p-1 text-slate-600 hover:bg-red-500/20 hover:text-red-400"
										>
											<Trash2 className="h-4 w-4" />
										</button>
									</div>
									<div className="mt-2 flex items-center gap-2">
										<span className="text-xs text-slate-500">Shuffle:</span>
										<EditableText value={deck.shuffle_policy} onChange={(v) => updateDeck(di, { shuffle_policy: v })} className="text-xs text-slate-400" placeholder="shuffle policy..." />
									</div>
									<div className="mt-3">
										<span className="text-xs text-slate-500">Card Pool ({deck.card_pool.reduce((s, e) => s + e.count, 0)} total):</span>
										<table className="mt-1 w-full text-xs">
											<thead>
												<tr className="text-left text-slate-500">
													<th className="pb-1 font-medium">Card ID</th>
													<th className="pb-1 text-center font-medium w-24">Count</th>
													<th className="pb-1 w-8" />
												</tr>
											</thead>
											<tbody className="divide-y divide-slate-700/50">
												{deck.card_pool.map((entry, ei) => (
													<tr key={`pool-${di}-${ei}`} className="group/row">
														<td className="py-1 pr-2">
															<input
																type="text"
																value={entry.card_id}
																onChange={(e) => updatePoolEntry(di, ei, { card_id: e.target.value })}
																className="w-full rounded border border-transparent bg-transparent px-1.5 py-0.5 text-slate-300 outline-none hover:border-slate-600 focus:border-indigo-500 focus:bg-slate-900"
																placeholder="card-id"
															/>
														</td>
														<td className="py-1">
															<div className="flex items-center justify-center">
																<button type="button" onClick={() => updatePoolEntry(di, ei, { count: Math.max(0, entry.count - 1) })} className="flex h-6 w-6 items-center justify-center rounded-l border border-slate-600 bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white">
																	<Minus className="h-3 w-3" />
																</button>
																<span className="flex h-6 min-w-8 items-center justify-center border-y border-slate-600 bg-slate-900 px-1 text-white tabular-nums">{entry.count}</span>
																<button type="button" onClick={() => updatePoolEntry(di, ei, { count: entry.count + 1 })} className="flex h-6 w-6 items-center justify-center rounded-r border border-slate-600 bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white">
																	<Plus className="h-3 w-3" />
																</button>
															</div>
														</td>
														<td className="py-1 text-center">
															<button type="button" onClick={() => { const pool = deck.card_pool.filter((_, i) => i !== ei); updateDeck(di, { card_pool: pool }); }} className="rounded p-0.5 text-slate-700 opacity-0 transition-opacity hover:text-red-400 group-hover/row:opacity-100">
																<Trash2 className="h-3.5 w-3.5" />
															</button>
														</td>
													</tr>
												))}
											</tbody>
										</table>
										<button type="button" onClick={() => updateDeck(di, { card_pool: [...deck.card_pool, { card_id: "", count: 1 }] })} className="mt-1.5 flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300">
											<Plus className="h-3 w-3" /> Add card
										</button>
									</div>
								</div>
							))}
						</div>
						<button type="button" onClick={() => onChange({ ...setup, deck_compositions: [...setup.deck_compositions, { deck_name: "", card_pool: [], shuffle_policy: "shuffle" }] })} className="mt-2 flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-indigo-400 hover:bg-indigo-500/10 hover:text-indigo-300">
							<Plus className="h-4 w-4" /> Add deck
						</button>
					</div>

					{/* Player Initialization */}
					<div>
						<h4 className="mb-2 font-medium text-slate-200">Player Initialization</h4>
						<div className="space-y-2">
							<div className="flex items-center gap-2">
								<span className="text-xs text-slate-500">Hand size:</span>
								<div className="flex items-center">
									<button type="button" onClick={() => onChange({ ...setup, player_initialization: { ...setup.player_initialization, initial_hand_size: Math.max(0, setup.player_initialization.initial_hand_size - 1) } })} className="flex h-7 w-7 items-center justify-center rounded-l-lg border border-slate-600 bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white">
										<Minus className="h-3.5 w-3.5" />
									</button>
									<span className="flex h-7 min-w-9 items-center justify-center border-y border-slate-600 bg-slate-900 px-2 text-sm font-medium text-white tabular-nums">{setup.player_initialization.initial_hand_size}</span>
									<button type="button" onClick={() => onChange({ ...setup, player_initialization: { ...setup.player_initialization, initial_hand_size: setup.player_initialization.initial_hand_size + 1 } })} className="flex h-7 w-7 items-center justify-center rounded-r-lg border border-slate-600 bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white">
										<Plus className="h-3.5 w-3.5" />
									</button>
								</div>
							</div>
							<div className="flex items-center gap-2">
								<span className="text-xs text-slate-500">Composition:</span>
								<EditableText value={setup.player_initialization.hand_composition} onChange={(v) => onChange({ ...setup, player_initialization: { ...setup.player_initialization, hand_composition: v } })} className="text-sm text-slate-300" placeholder="e.g. random from deck" />
							</div>
						</div>
					</div>

					{/* Starting Turn */}
					<div>
						<h4 className="mb-2 font-medium text-slate-200">Starting Turn</h4>
						<div className="space-y-2">
							<div className="flex items-center gap-2">
								<span className="text-xs text-slate-500">First player:</span>
								<EditableText value={setup.starting_turn.starting_player_rule} onChange={(v) => onChange({ ...setup, starting_turn: { ...setup.starting_turn, starting_player_rule: v } })} className="text-sm text-slate-300" placeholder="e.g. youngest player" />
							</div>
							<div className="flex items-center gap-2">
								<span className="text-xs text-slate-500">Direction:</span>
								<EditableText value={setup.starting_turn.initial_turn_direction} onChange={(v) => onChange({ ...setup, starting_turn: { ...setup.starting_turn, initial_turn_direction: v } })} className="text-sm text-slate-300" placeholder="clockwise" />
							</div>
							<div>
								<span className="text-xs text-slate-500">Pre-game actions:</span>
								<EditableList items={setup.starting_turn.pre_game_actions} onChange={(v) => onChange({ ...setup, starting_turn: { ...setup.starting_turn, pre_game_actions: v } })} placeholder="Action..." addLabel="Add action" />
							</div>
						</div>
					</div>

					{/* Zone Initialization */}
					<div>
						<h4 className="mb-2 font-medium text-slate-200">Zones</h4>
						<div className="space-y-2">
							{setup.zone_initialization.map((zone, zi) => (
								<div key={`zone-${zi}`} className="flex items-start gap-2 rounded-lg border border-slate-600 bg-slate-900/50 p-3">
									<div className="flex-1 space-y-1">
										<input type="text" value={zone.zone_id} onChange={(e) => updateZone(zi, { zone_id: e.target.value })} placeholder="zone-id" className="w-full rounded border border-transparent bg-transparent px-1 py-0.5 text-sm font-medium text-white outline-none hover:border-slate-600 focus:border-indigo-500" />
										<div className="flex gap-3 text-xs">
											<span className="text-slate-500">Type:</span>
											<input type="text" value={zone.zone_type} onChange={(e) => updateZone(zi, { zone_type: e.target.value })} className="w-20 border-b border-transparent bg-transparent text-slate-400 outline-none hover:border-slate-600 focus:border-indigo-500" />
											<span className="text-slate-500">Owner:</span>
											<input type="text" value={zone.owner} onChange={(e) => updateZone(zi, { owner: e.target.value })} className="w-16 border-b border-transparent bg-transparent text-slate-400 outline-none hover:border-slate-600 focus:border-indigo-500" />
										</div>
										<input type="text" value={zone.initial_cards} onChange={(e) => updateZone(zi, { initial_cards: e.target.value })} placeholder="Initial cards..." className="w-full rounded border border-transparent bg-transparent px-1 py-0.5 text-xs text-slate-500 outline-none hover:border-slate-600 focus:border-indigo-500" />
									</div>
									<button type="button" onClick={() => onChange({ ...setup, zone_initialization: setup.zone_initialization.filter((_, i) => i !== zi) })} className="rounded p-1 text-slate-600 hover:bg-red-500/20 hover:text-red-400">
										<Trash2 className="h-3.5 w-3.5" />
									</button>
								</div>
							))}
						</div>
						<button type="button" onClick={() => onChange({ ...setup, zone_initialization: [...setup.zone_initialization, { zone_id: "", zone_type: "custom", owner: "global", initial_cards: "" }] })} className="mt-2 flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-indigo-400 hover:bg-indigo-500/10 hover:text-indigo-300">
							<Plus className="h-4 w-4" /> Add zone
						</button>
					</div>
				</div>
			)}
		</section>
	);
}
