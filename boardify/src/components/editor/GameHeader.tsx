"use client";

import type { GameBlueprint } from "~/types/game";
import EditableText from "~/components/ui/EditableText";
import EditableList from "~/components/ui/EditableList";
import { Minus, Plus, Users, Eye } from "lucide-react";

interface GameHeaderProps {
	game: GameBlueprint;
	onChange: (game: GameBlueprint) => void;
}

export default function GameHeader({ game, onChange }: GameHeaderProps) {
	return (
		<section className="rounded-2xl border border-slate-700 bg-slate-800 p-6">
			{/* Name */}
			<EditableText
				value={game.name}
				onChange={(v) => onChange({ ...game, name: v })}
				placeholder="Game name..."
				className="font-bold text-3xl text-indigo-300"
				as="h2"
			/>

			{/* Description */}
			<div className="mt-3">
				<EditableText
					value={game.description}
					onChange={(v) => onChange({ ...game, description: v })}
					placeholder="Game description..."
					className="text-slate-300"
					multiline
					as="p"
				/>
			</div>

			{/* Player count */}
			<div className="mt-4 flex flex-wrap items-center gap-6">
				<div className="flex items-center gap-2">
					<Users className="h-4 w-4 text-slate-500" />
					<span className="text-sm text-slate-400">Players:</span>
					<div className="flex items-center">
						<button
							type="button"
							onClick={() =>
								onChange({
									...game,
									player_config: {
										...game.player_config,
										min_players: Math.max(1, game.player_config.min_players - 1),
									},
								})
							}
							className="flex h-7 w-7 items-center justify-center rounded-l-lg border border-slate-600 bg-slate-800 text-slate-400 transition-colors hover:bg-slate-700 hover:text-white active:bg-slate-600"
						>
							<Minus className="h-3.5 w-3.5" />
						</button>
						<span className="flex h-7 min-w-9 items-center justify-center border-y border-slate-600 bg-slate-900 px-2 text-sm font-medium text-white tabular-nums">
							{game.player_config.min_players}
						</span>
						<button
							type="button"
							onClick={() =>
								onChange({
									...game,
									player_config: {
										...game.player_config,
										min_players: Math.min(game.player_config.max_players, game.player_config.min_players + 1),
									},
								})
							}
							className="flex h-7 w-7 items-center justify-center rounded-r-lg border border-slate-600 bg-slate-800 text-slate-400 transition-colors hover:bg-slate-700 hover:text-white active:bg-slate-600"
						>
							<Plus className="h-3.5 w-3.5" />
						</button>
					</div>
					<span className="text-slate-500">to</span>
					<div className="flex items-center">
						<button
							type="button"
							onClick={() =>
								onChange({
									...game,
									player_config: {
										...game.player_config,
										max_players: Math.max(game.player_config.min_players, game.player_config.max_players - 1),
									},
								})
							}
							className="flex h-7 w-7 items-center justify-center rounded-l-lg border border-slate-600 bg-slate-800 text-slate-400 transition-colors hover:bg-slate-700 hover:text-white active:bg-slate-600"
						>
							<Minus className="h-3.5 w-3.5" />
						</button>
						<span className="flex h-7 min-w-9 items-center justify-center border-y border-slate-600 bg-slate-900 px-2 text-sm font-medium text-white tabular-nums">
							{game.player_config.max_players}
						</span>
						<button
							type="button"
							onClick={() =>
								onChange({
									...game,
									player_config: {
										...game.player_config,
										max_players: game.player_config.max_players + 1,
									},
								})
							}
							className="flex h-7 w-7 items-center justify-center rounded-r-lg border border-slate-600 bg-slate-800 text-slate-400 transition-colors hover:bg-slate-700 hover:text-white active:bg-slate-600"
						>
							<Plus className="h-3.5 w-3.5" />
						</button>
					</div>
				</div>
			</div>

			{/* Information Model */}
			<div className="mt-4 border-t border-slate-700 pt-4">
				<div className="flex items-center gap-2">
					<Eye className="h-4 w-4 text-slate-500" />
					<span className="text-sm font-medium text-slate-400">Information Model</span>
				</div>
				<div className="mt-2 flex items-center gap-2">
					<span className="text-xs text-slate-500">Randomness:</span>
					<EditableText
						value={game.information_model.randomness_model}
						onChange={(v) =>
							onChange({
								...game,
								information_model: { ...game.information_model, randomness_model: v },
							})
						}
						placeholder="e.g. deterministic seed"
						className="text-sm text-slate-300"
					/>
				</div>
				<div className="mt-2">
					<span className="text-xs text-slate-500">Public Knowledge Rules:</span>
					<EditableList
						items={game.information_model.public_knowledge_rules}
						onChange={(v) =>
							onChange({
								...game,
								information_model: { ...game.information_model, public_knowledge_rules: v },
							})
						}
						placeholder="Knowledge rule..."
						addLabel="Add rule"
					/>
				</div>
			</div>
		</section>
	);
}
