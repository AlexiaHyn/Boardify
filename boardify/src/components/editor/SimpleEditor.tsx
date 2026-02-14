"use client";

import type { GameData } from "~/types/game";
import { Minus, Plus, Trash2 } from "lucide-react";
import EditableText from "~/components/ui/EditableText";

interface SimpleEditorProps {
	game: GameData;
	onChange: (game: GameData) => void;
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
		<div className="flex items-center justify-between rounded-lg border border-slate-700 bg-slate-900/50 px-4 py-3">
			<span className="text-sm text-slate-300">{label}</span>
			<div className="flex items-center">
				<button
					type="button"
					onClick={() => onChange(Math.max(min, value - 1))}
					className="flex h-8 w-8 items-center justify-center rounded-l-lg border border-slate-600 bg-slate-800 text-slate-400 transition-colors hover:bg-slate-700 hover:text-white active:bg-slate-600"
				>
					<Minus className="h-4 w-4" />
				</button>
				<span className="flex h-8 min-w-12 items-center justify-center border-y border-slate-600 bg-slate-900 px-3 text-sm font-semibold text-white tabular-nums">
					{value}
				</span>
				<button
					type="button"
					onClick={() => onChange(Math.min(max, value + 1))}
					className="flex h-8 w-8 items-center justify-center rounded-r-lg border border-slate-600 bg-slate-800 text-slate-400 transition-colors hover:bg-slate-700 hover:text-white active:bg-slate-600"
				>
					<Plus className="h-4 w-4" />
				</button>
			</div>
		</div>
	);
}

export default function SimpleEditor({ game, onChange }: SimpleEditorProps) {
	function setGame(patch: Partial<GameData>) {
		onChange({ ...game, ...patch });
	}

	return (
		<div className="space-y-6">
			{/* Game Identity */}
			<section className="rounded-2xl border border-slate-700 bg-slate-800 p-6">
				<EditableText
					value={game.game.name}
					onChange={(v) =>
						setGame({ game: { ...game.game, name: v } })
					}
					placeholder="Game name..."
					className="font-bold text-3xl text-indigo-300"
					as="h2"
				/>
				<div className="mt-3">
					<EditableText
						value={game.game.description}
						onChange={(v) =>
							setGame({ game: { ...game.game, description: v } })
						}
						placeholder="Game description..."
						className="text-slate-300"
						multiline
						as="p"
					/>
				</div>
			</section>

			{/* Quick Settings */}
			<section className="rounded-2xl border border-slate-700 bg-slate-800 p-6">
				<h3 className="mb-4 font-bold text-xl text-indigo-300">
					Game Settings
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
					<div className="flex items-center justify-between rounded-lg border border-slate-700 bg-slate-900/50 px-4 py-3">
						<span className="text-sm text-slate-300">
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
							className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-1.5 text-sm text-white outline-none transition-colors focus:border-indigo-500"
						>
							<option value="clockwise">Clockwise</option>
							<option value="counterclockwise">
								Counter-clockwise
							</option>
							<option value="dynamic">Dynamic</option>
						</select>
					</div>

					{/* Interrupts toggle */}
					<div className="flex items-center justify-between rounded-lg border border-slate-700 bg-slate-900/50 px-4 py-3">
						<span className="text-sm text-slate-300">
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
												!game.turn_model.interrupt_policy
													.interrupt_allowed,
										},
									},
								})
							}
							className={`relative h-7 w-12 rounded-full transition-colors ${
								game.turn_model.interrupt_policy.interrupt_allowed
									? "bg-indigo-600"
									: "bg-slate-600"
							}`}
						>
							<span
								className={`absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white transition-transform ${
									game.turn_model.interrupt_policy
										.interrupt_allowed
										? "translate-x-5"
										: ""
								}`}
							/>
						</button>
					</div>
				</div>
			</section>

			{/* Card Overview — just names and counts */}
			<section className="rounded-2xl border border-slate-700 bg-slate-800 p-6">
				<h3 className="mb-4 font-bold text-xl text-indigo-300">
					Cards{" "}
					<span className="text-sm font-normal text-slate-500">
						({game.cards.reduce((s, c) => s + c.count, 0)} total)
					</span>
				</h3>
				<div className="space-y-2">
					{game.cards.map((card, i) => (
						<div
							key={`simple-card-${i}`}
							className="group flex items-center justify-between rounded-lg border border-slate-700 bg-slate-900/50 px-4 py-2.5"
						>
							<div className="min-w-0 flex-1 pr-3">
								<input
									type="text"
									value={card.display_name}
									onChange={(e) => {
										const next = [...game.cards];
										next[i] = {
											...next[i]!,
											display_name: e.target.value,
										};
										setGame({ cards: next });
									}}
									className="w-full bg-transparent text-sm font-medium text-white outline-none"
									placeholder="Card name..."
								/>
								<p className="mt-0.5 truncate text-xs text-slate-500">
									{card.rule_description || "No description"}
								</p>
							</div>
							<div className="flex items-center gap-2">
								<div className="flex items-center">
									<button
										type="button"
										onClick={() => {
											const next = [...game.cards];
											next[i] = {
												...next[i]!,
												count: Math.max(0, card.count - 1),
											};
											setGame({ cards: next });
										}}
										className="flex h-7 w-7 items-center justify-center rounded-l-lg border border-slate-600 bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white"
									>
										<Minus className="h-3.5 w-3.5" />
									</button>
									<span className="flex h-7 min-w-9 items-center justify-center border-y border-slate-600 bg-slate-900 px-2 text-sm font-medium text-white tabular-nums">
										{card.count}
									</span>
									<button
										type="button"
										onClick={() => {
											const next = [...game.cards];
											next[i] = {
												...next[i]!,
												count: card.count + 1,
											};
											setGame({ cards: next });
										}}
										className="flex h-7 w-7 items-center justify-center rounded-r-lg border border-slate-600 bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white"
									>
										<Plus className="h-3.5 w-3.5" />
									</button>
								</div>
								<button
									type="button"
									onClick={() =>
										setGame({
											cards: game.cards.filter(
												(_, j) => j !== i,
											),
										})
									}
									className="rounded p-1 text-slate-700 opacity-0 transition-opacity hover:text-red-400 group-hover:opacity-100"
								>
									<Trash2 className="h-4 w-4" />
								</button>
							</div>
						</div>
					))}
				</div>
			</section>

			{/* Win Condition — just text */}
			<section className="rounded-2xl border border-slate-700 bg-slate-800 p-6">
				<h3 className="mb-3 font-bold text-xl text-indigo-300">
					Win Condition
				</h3>
				{game.win_loss.victory_conditions.map((vc, i) => (
					<div key={`simple-vc-${i}`} className="mt-2">
						<span className="text-xs font-medium text-emerald-400">
							{vc.type.replace(/_/g, " ")}
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
							className="text-sm text-slate-300"
							as="p"
						/>
					</div>
				))}
			</section>

			{/* Home Rules */}
			<section className="rounded-2xl border border-slate-700 bg-slate-800 p-6">
				<h3 className="mb-2 font-bold text-xl text-amber-300">
					Home Rules
				</h3>
				<p className="mb-2 text-xs text-slate-500">
					Add your own house rules or custom modifications.
				</p>
				<textarea
					value={game.home_rules ?? ""}
					onChange={(e) => setGame({ home_rules: e.target.value })}
					placeholder="e.g. 'Draw 2 instead of 1 each turn'..."
					rows={3}
					className="w-full resize-y rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-300 outline-none transition-colors placeholder:text-slate-600 focus:border-amber-500 focus:ring-1 focus:ring-amber-500/50"
				/>
			</section>
		</div>
	);
}
