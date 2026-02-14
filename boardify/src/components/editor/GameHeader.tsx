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
		<section className="section-panel">
			<div className="section-panel-inner">
				{/* Name — hero style */}
				<EditableText
					value={game.name}
					onChange={(v) => onChange({ ...game, name: v })}
					placeholder="Game name..."
					className="font-display text-3xl font-semibold tracking-wide text-[var(--color-gold)]"
					as="h2"
				/>

				{/* Decorative gold divider */}
				<hr className="gold-divider my-4" />

				{/* Description */}
				<EditableText
					value={game.description}
					onChange={(v) => onChange({ ...game, description: v })}
					placeholder="Game description..."
					className="font-body leading-relaxed text-[var(--color-cream-dim)]"
					multiline
					as="p"
				/>

				{/* Player count */}
				<div className="mt-5 flex flex-wrap items-center gap-6">
					<div className="flex items-center gap-2">
						<Users className="h-4 w-4 text-[var(--color-gold-dim)]" />
						<span className="font-body text-sm text-[var(--color-stone)]">Players:</span>
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
								className="btn-press flex h-7 w-7 items-center justify-center rounded-l-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-stone)] transition-colors hover:bg-[var(--color-surface-raised)] hover:text-[var(--color-cream)]"
							>
								<Minus className="h-3.5 w-3.5" />
							</button>
							<span className="flex h-7 min-w-9 items-center justify-center border-y border-[var(--color-border)] bg-[var(--color-bg-deep)] px-2 font-display text-sm font-medium text-[var(--color-cream)] tabular-nums">
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
								className="btn-press flex h-7 w-7 items-center justify-center rounded-r-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-stone)] transition-colors hover:bg-[var(--color-surface-raised)] hover:text-[var(--color-cream)]"
							>
								<Plus className="h-3.5 w-3.5" />
							</button>
						</div>
						<span className="font-body text-[var(--color-stone-dim)]">to</span>
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
								className="btn-press flex h-7 w-7 items-center justify-center rounded-l-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-stone)] transition-colors hover:bg-[var(--color-surface-raised)] hover:text-[var(--color-cream)]"
							>
								<Minus className="h-3.5 w-3.5" />
							</button>
							<span className="flex h-7 min-w-9 items-center justify-center border-y border-[var(--color-border)] bg-[var(--color-bg-deep)] px-2 font-display text-sm font-medium text-[var(--color-cream)] tabular-nums">
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
								className="btn-press flex h-7 w-7 items-center justify-center rounded-r-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-stone)] transition-colors hover:bg-[var(--color-surface-raised)] hover:text-[var(--color-cream)]"
							>
								<Plus className="h-3.5 w-3.5" />
							</button>
						</div>
					</div>
				</div>

				{/* Information Model */}
				<div className="mt-5 border-t border-[var(--color-border-subtle)] pt-4">
					<div className="flex items-center gap-2">
						<Eye className="h-4 w-4 text-[var(--color-gold-dim)]" />
						<span className="font-display text-xs font-medium tracking-wider text-[var(--color-gold-dim)]">INFORMATION MODEL</span>
					</div>
					<div className="mt-2 flex items-center gap-2">
						<span className="font-body text-xs text-[var(--color-stone-dim)]">Randomness:</span>
						<EditableText
							value={game.information_model.randomness_model}
							onChange={(v) =>
								onChange({
									...game,
									information_model: { ...game.information_model, randomness_model: v },
								})
							}
							placeholder="e.g. deterministic seed"
							className="font-body text-sm text-[var(--color-cream-dim)]"
						/>
					</div>
					<div className="mt-2">
						<span className="font-body text-xs text-[var(--color-stone-dim)]">Public Knowledge Rules:</span>
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
			</div>
		</section>
	);
}
