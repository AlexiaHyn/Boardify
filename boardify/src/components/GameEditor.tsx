"use client";

import { useState } from "react";
import type { GameData } from "~/types/game";
import { RotateCcw, Save, SlidersHorizontal, Wrench } from "lucide-react";
import GameHeader from "~/components/editor/GameHeader";
import SetupBlueprintEditor from "~/components/editor/SetupBlueprintEditor";
import TurnModelEditor from "~/components/editor/TurnModelEditor";
import CardBlueprintEditor from "~/components/editor/CardBlueprintEditor";
import RuleBlueprintEditor from "~/components/editor/RuleBlueprintEditor";
import WinLossEditor from "~/components/editor/WinLossEditor";
import SimpleEditor from "~/components/editor/SimpleEditor";

interface GameEditorProps {
	initialGame: GameData;
	onRegenerate: () => void;
}

export default function GameEditor({
	initialGame,
	onRegenerate,
}: GameEditorProps) {
	const [game, setGame] = useState<GameData>({
		...initialGame,
		home_rules: initialGame.home_rules ?? "",
	});
	const [mode, setMode] = useState<"simple" | "advanced">("simple");

	function exportJSON() {
		const blob = new Blob([JSON.stringify(game, null, 2)], {
			type: "application/json",
		});
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = `${game.game.name.toLowerCase().replace(/\s+/g, "-") || "game"}-blueprint.json`;
		a.click();
		URL.revokeObjectURL(url);
	}

	return (
		<div className="w-full max-w-3xl space-y-6">
			{/* Toolbar */}
			<div className="flex items-center justify-between">
				<button
					type="button"
					onClick={onRegenerate}
					className="flex items-center gap-2 rounded-xl border border-slate-600 px-4 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-700 hover:text-white"
				>
					<RotateCcw className="h-4 w-4" />
					Regenerate
				</button>

				{/* Mode toggle */}
				<div className="flex items-center rounded-xl border border-slate-600 p-0.5">
					<button
						type="button"
						onClick={() => setMode("simple")}
						className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
							mode === "simple"
								? "bg-indigo-600 text-white"
								: "text-slate-400 hover:text-white"
						}`}
					>
						<SlidersHorizontal className="h-3.5 w-3.5" />
						Simple
					</button>
					<button
						type="button"
						onClick={() => setMode("advanced")}
						className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
							mode === "advanced"
								? "bg-indigo-600 text-white"
								: "text-slate-400 hover:text-white"
						}`}
					>
						<Wrench className="h-3.5 w-3.5" />
						Advanced
					</button>
				</div>

				<button
					type="button"
					onClick={exportJSON}
					className="flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-500"
				>
					<Save className="h-4 w-4" />
					Save Blueprint
				</button>
			</div>

			{/* Simple mode */}
			{mode === "simple" && (
				<SimpleEditor game={game} onChange={setGame} />
			)}

			{/* Advanced mode */}
			{mode === "advanced" && (
				<>
					<GameHeader
						game={game.game}
						onChange={(g) =>
							setGame((prev) => ({ ...prev, game: g }))
						}
					/>
					<SetupBlueprintEditor
						setup={game.setup}
						onChange={(s) =>
							setGame((prev) => ({ ...prev, setup: s }))
						}
					/>
					<TurnModelEditor
						turnModel={game.turn_model}
						onChange={(tm) =>
							setGame((prev) => ({ ...prev, turn_model: tm }))
						}
					/>
					<CardBlueprintEditor
						cards={game.cards}
						onChange={(cards) =>
							setGame((prev) => ({ ...prev, cards }))
						}
					/>
					<RuleBlueprintEditor
						rules={game.rules}
						onChange={(rules) =>
							setGame((prev) => ({ ...prev, rules }))
						}
					/>
					<WinLossEditor
						winLoss={game.win_loss}
						onChange={(wl) =>
							setGame((prev) => ({ ...prev, win_loss: wl }))
						}
					/>
					<section className="rounded-2xl border border-slate-700 bg-slate-800 p-6">
						<h3 className="mb-2 font-bold text-xl text-amber-300">
							Home Rules
						</h3>
						<p className="mb-2 text-xs text-slate-500">
							Add your own house rules, variants, or custom
							modifications.
						</p>
						<textarea
							value={game.home_rules ?? ""}
							onChange={(e) =>
								setGame((prev) => ({
									...prev,
									home_rules: e.target.value,
								}))
							}
							placeholder="e.g. 'Draw 2 instead of 1 each turn', 'No stacking allowed'..."
							rows={4}
							className="w-full resize-y rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-300 outline-none transition-colors placeholder:text-slate-600 focus:border-amber-500 focus:ring-1 focus:ring-amber-500/50"
						/>
					</section>
				</>
			)}
		</div>
	);
}
