"use client";

import type {
	SetupBlueprint,
	DeckComposition,
	CardPoolEntry,
	ZoneInit,
} from "~/types/game";
import {
	Plus,
	Trash2,
	Minus,
	Wrench,
	Shuffle,
	Users,
	Map,
	Play,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import EditableList from "~/components/ui/EditableList";

interface SetupBlueprintEditorProps {
	setup: SetupBlueprint;
	onChange: (setup: SetupBlueprint) => void;
}

export default function SetupBlueprintEditor({
	setup,
	onChange,
}: SetupBlueprintEditorProps) {
	function updateDeck(i: number, patch: Partial<DeckComposition>) {
		const next = [...setup.deck_compositions];
		next[i] = { ...next[i]!, ...patch };
		onChange({ ...setup, deck_compositions: next });
	}

	function updatePoolEntry(
		deckIdx: number,
		entryIdx: number,
		patch: Partial<CardPoolEntry>,
	) {
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
		<section className="section-panel">
			<div className="section-panel-inner space-y-0">
				{/* ── Deck Compositions ──────────────────────────── */}
				<div className="sub-section">
					<div className="flex flex-wrap items-center justify-between gap-3">
						<h4
							className="sub-section-title"
							style={{ marginBottom: 0 }}
						>
							<Shuffle />
							Deck Compositions
						</h4>
						<button
							type="button"
							onClick={() =>
								onChange({
									...setup,
									deck_compositions: [
										...setup.deck_compositions,
										{
											deck_name: "",
											card_pool: [],
											shuffle_policy: "shuffle",
										},
									],
								})
							}
							className="btn-press flex items-center gap-1.5 rounded-lg bg-[var(--color-gold-muted)] px-3 py-1.5 font-display text-xs font-medium tracking-wider text-[var(--color-gold)] transition-all hover:bg-[var(--color-gold)] hover:text-[var(--color-bg-deep)]"
						>
							<Plus className="h-3.5 w-3.5" /> ADD DECK
						</button>
					</div>

					<div className="mt-3 space-y-4">
						<AnimatePresence>
							{setup.deck_compositions.map((deck, di) => (
								<motion.div
									key={`deck-${di}`}
									className="group relative rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-deep)]/50 p-4"
									initial={{ opacity: 0, y: 10 }}
									animate={{ opacity: 1, y: 0 }}
									exit={{ opacity: 0, scale: 0.95 }}
									transition={{ delay: di * 0.04 }}
								>
									<button
										type="button"
										onClick={() =>
											onChange({
												...setup,
												deck_compositions:
													setup.deck_compositions.filter(
														(_, i) => i !== di,
													),
											})
										}
										className="absolute top-3 right-3 rounded p-1 text-[var(--color-border)] opacity-0 transition-all hover:text-[var(--color-crimson)] group-hover:opacity-100"
									>
										<Trash2 className="h-4 w-4" />
									</button>

									<div className="form-row pr-8">
										<div className="form-field">
											<label className="form-label">
												Deck Name
											</label>
											<input
												type="text"
												value={deck.deck_name}
												onChange={(e) =>
													updateDeck(di, {
														deck_name:
															e.target.value,
													})
												}
												placeholder="e.g. Main Deck"
												className="form-input"
											/>
										</div>
										<div className="form-field">
											<label className="form-label">
												Shuffle Policy
											</label>
											<input
												type="text"
												value={deck.shuffle_policy}
												onChange={(e) =>
													updateDeck(di, {
														shuffle_policy:
															e.target.value,
													})
												}
												placeholder="shuffle / ordered / player choice"
												className="form-input"
											/>
										</div>
									</div>

									{/* Card Pool Table */}
									<div className="mt-3">
										<label className="form-label">
											Card Pool (
											{deck.card_pool.reduce(
												(s, e) => s + e.count,
												0,
											)}{" "}
											total)
										</label>
										<table className="mt-2 w-full text-sm">
											<thead>
												<tr className="font-body text-xs text-[var(--color-stone-dim)]">
													<th className="pb-1.5 text-left font-medium">
														Card ID
													</th>
													<th className="w-28 pb-1.5 text-center font-medium">
														Count
													</th>
													<th className="w-8 pb-1.5" />
												</tr>
											</thead>
											<tbody className="divide-y divide-[var(--color-border-subtle)]">
												{deck.card_pool.map(
													(entry, ei) => (
														<tr
															key={`pool-${di}-${ei}`}
															className="group/row"
														>
															<td className="py-1.5 pr-2">
																<input
																	type="text"
																	value={
																		entry.card_id
																	}
																	onChange={(
																		e,
																	) =>
																		updatePoolEntry(
																			di,
																			ei,
																			{
																				card_id:
																					e
																						.target
																						.value,
																			},
																		)
																	}
																	className="form-input"
																	style={{
																		padding:
																			"4px 8px",
																		fontSize: 13,
																	}}
																	placeholder="card-id"
																/>
															</td>
															<td className="py-1.5">
																<div className="flex items-center justify-center">
																	<div className="stepper-controls">
																		<button
																			type="button"
																			onClick={() =>
																				updatePoolEntry(
																					di,
																					ei,
																					{
																						count: Math.max(
																							0,
																							entry.count -
																								1,
																						),
																					},
																				)
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
																				minWidth: 28,
																				height: 24,
																				fontSize: 12,
																			}}
																		>
																			{
																				entry.count
																			}
																		</span>
																		<button
																			type="button"
																			onClick={() =>
																				updatePoolEntry(
																					di,
																					ei,
																					{
																						count:
																							entry.count +
																							1,
																					},
																				)
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
															</td>
															<td className="py-1.5 text-center">
																<button
																	type="button"
																	onClick={() => {
																		const pool =
																			deck.card_pool.filter(
																				(
																					_,
																					i,
																				) =>
																					i !==
																					ei,
																			);
																		updateDeck(
																			di,
																			{
																				card_pool:
																					pool,
																			},
																		);
																	}}
																	className="rounded p-0.5 text-[var(--color-border)] opacity-0 transition-opacity hover:text-[var(--color-crimson)] group-hover/row:opacity-100"
																>
																	<Trash2 className="h-3.5 w-3.5" />
																</button>
															</td>
														</tr>
													),
												)}
											</tbody>
										</table>
										<button
											type="button"
											onClick={() =>
												updateDeck(di, {
													card_pool: [
														...deck.card_pool,
														{
															card_id: "",
															count: 1,
														},
													],
												})
											}
											className="btn-press mt-2 flex items-center gap-1 font-body text-xs text-[var(--color-gold-dim)] hover:text-[var(--color-gold)]"
										>
											<Plus className="h-3 w-3" /> Add
											card to pool
										</button>
									</div>
								</motion.div>
							))}
						</AnimatePresence>
					</div>
				</div>

				{/* ── Player Initialization ──────────────────────── */}
				<div className="sub-section">
					<h4 className="sub-section-title">
						<Users />
						Player Initialization
					</h4>
					<div className="form-row">
						<div className="form-field">
							<label className="form-label">
								Initial Hand Size
							</label>
							<div className="stepper-controls">
								<button
									type="button"
									onClick={() =>
										onChange({
											...setup,
											player_initialization: {
												...setup.player_initialization,
												initial_hand_size: Math.max(
													0,
													setup.player_initialization
														.initial_hand_size - 1,
												),
											},
										})
									}
									className="stepper-btn"
									style={{ width: 32, height: 32 }}
								>
									<Minus className="h-3.5 w-3.5" />
								</button>
								<span
									className="stepper-value"
									style={{ minWidth: 44, height: 32 }}
								>
									{
										setup.player_initialization
											.initial_hand_size
									}
								</span>
								<button
									type="button"
									onClick={() =>
										onChange({
											...setup,
											player_initialization: {
												...setup.player_initialization,
												initial_hand_size:
													setup.player_initialization
														.initial_hand_size + 1,
											},
										})
									}
									className="stepper-btn"
									style={{ width: 32, height: 32 }}
								>
									<Plus className="h-3.5 w-3.5" />
								</button>
							</div>
						</div>
						<div className="form-field">
							<label className="form-label">
								Hand Composition
							</label>
							<input
								type="text"
								value={
									setup.player_initialization.hand_composition
								}
								onChange={(e) =>
									onChange({
										...setup,
										player_initialization: {
											...setup.player_initialization,
											hand_composition: e.target.value,
										},
									})
								}
								placeholder="e.g. random from deck"
								className="form-input"
							/>
						</div>
					</div>
				</div>

				{/* ── Starting Turn ──────────────────────────────── */}
				<div className="sub-section">
					<h4 className="sub-section-title">
						<Play />
						Starting Turn
					</h4>
					<div className="form-row">
						<div className="form-field">
							<label className="form-label">First Player</label>
							<input
								type="text"
								value={setup.starting_turn.starting_player_rule}
								onChange={(e) =>
									onChange({
										...setup,
										starting_turn: {
											...setup.starting_turn,
											starting_player_rule:
												e.target.value,
										},
									})
								}
								placeholder="e.g. youngest player"
								className="form-input"
							/>
						</div>
						<div className="form-field">
							<label className="form-label">
								Initial Direction
							</label>
							<input
								type="text"
								value={
									setup.starting_turn.initial_turn_direction
								}
								onChange={(e) =>
									onChange({
										...setup,
										starting_turn: {
											...setup.starting_turn,
											initial_turn_direction:
												e.target.value,
										},
									})
								}
								placeholder="clockwise"
								className="form-input"
							/>
						</div>
					</div>
					<div className="mt-3">
						<label className="form-label mb-2 block">
							Pre-Game Actions
						</label>
						<EditableList
							items={setup.starting_turn.pre_game_actions}
							onChange={(v) =>
								onChange({
									...setup,
									starting_turn: {
										...setup.starting_turn,
										pre_game_actions: v,
									},
								})
							}
							placeholder="Action..."
							addLabel="Add action"
						/>
					</div>
				</div>

				{/* ── Zone Initialization ────────────────────────── */}
				<div className="sub-section">
					<div className="flex flex-wrap items-center justify-between gap-3">
						<h4
							className="sub-section-title"
							style={{ marginBottom: 0 }}
						>
							<Map />
							Zones
						</h4>
						<button
							type="button"
							onClick={() =>
								onChange({
									...setup,
									zone_initialization: [
										...setup.zone_initialization,
										{
											zone_id: "",
											zone_type: "custom",
											owner: "global",
											initial_cards: "",
										},
									],
								})
							}
							className="btn-press flex items-center gap-1.5 rounded-lg bg-[var(--color-gold-muted)] px-3 py-1.5 font-display text-xs font-medium tracking-wider text-[var(--color-gold)] transition-all hover:bg-[var(--color-gold)] hover:text-[var(--color-bg-deep)]"
						>
							<Plus className="h-3.5 w-3.5" /> ADD ZONE
						</button>
					</div>

					<div className="mt-3 space-y-3">
						<AnimatePresence>
							{setup.zone_initialization.map((zone, zi) => (
								<motion.div
									key={`zone-${zi}`}
									className="group relative rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-deep)]/50 p-4"
									initial={{ opacity: 0, y: 10 }}
									animate={{ opacity: 1, y: 0 }}
									exit={{ opacity: 0, scale: 0.95 }}
									transition={{ delay: zi * 0.04 }}
								>
									<button
										type="button"
										onClick={() =>
											onChange({
												...setup,
												zone_initialization:
													setup.zone_initialization.filter(
														(_, i) => i !== zi,
													),
											})
										}
										className="absolute top-3 right-3 rounded p-1 text-[var(--color-border)] opacity-0 transition-all hover:text-[var(--color-crimson)] group-hover:opacity-100"
									>
										<Trash2 className="h-3.5 w-3.5" />
									</button>

									<div className="grid gap-3 pr-8 sm:grid-cols-3">
										<div className="form-field">
											<label className="form-label">
												Zone ID
											</label>
											<input
												type="text"
												value={zone.zone_id}
												onChange={(e) =>
													updateZone(zi, {
														zone_id: e.target.value,
													})
												}
												placeholder="zone-id"
												className="form-input"
											/>
										</div>
										<div className="form-field">
											<label className="form-label">
												Type
											</label>
											<input
												type="text"
												value={zone.zone_type}
												onChange={(e) =>
													updateZone(zi, {
														zone_type:
															e.target.value,
													})
												}
												placeholder="deck / discard / hand..."
												className="form-input"
											/>
										</div>
										<div className="form-field">
											<label className="form-label">
												Owner
											</label>
											<input
												type="text"
												value={zone.owner}
												onChange={(e) =>
													updateZone(zi, {
														owner: e.target.value,
													})
												}
												placeholder="global / player"
												className="form-input"
											/>
										</div>
									</div>
									<div className="form-field mt-3">
										<label className="form-label">
											Initial Cards
										</label>
										<input
											type="text"
											value={zone.initial_cards}
											onChange={(e) =>
												updateZone(zi, {
													initial_cards:
														e.target.value,
												})
											}
											placeholder="Describe initial card placement..."
											className="form-input"
										/>
									</div>
								</motion.div>
							))}
						</AnimatePresence>
					</div>
				</div>
			</div>
		</section>
	);
}
