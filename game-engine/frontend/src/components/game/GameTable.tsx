'use client';

import type { GameState, Player, Zone } from '@/types/game';
import { GameCard } from './GameCard';

interface UiLayout {
  hideDrawPile?: boolean;
  hideDiscardPile?: boolean;
  showZones?: string[];
  showScoreboard?: boolean;
}

interface DisplayField {
  key: string;
  label: string;
  icon?: string;
  format?: 'number' | 'text';
  defaultValue?: string | number;
}

interface UiDisplayConfig {
  playerDisplayFields?: DisplayField[];
  gameDisplayFields?: DisplayField[];
}

interface GameTableProps {
  gameState: GameState;
  localPlayerId: string;
  onDrawCard: () => void;
  loading?: boolean;
}

export function GameTable({ gameState, localPlayerId, onDrawCard, loading }: GameTableProps) {
  const uiConfig = (gameState.metadata?.uiConfig as Record<string, unknown>) ?? {};
  const layout: UiLayout = (uiConfig.layout as UiLayout) ?? {};
  const displayConfig: UiDisplayConfig = {
    playerDisplayFields: (uiConfig.playerDisplayFields as DisplayField[]) ?? [],
    gameDisplayFields: (uiConfig.gameDisplayFields as DisplayField[]) ?? [],
  };

  const drawPile = gameState.zones.find((z) => z.id === 'draw_pile');
  const discardPile = gameState.zones.find((z) => z.id === 'discard_pile');
  const isMyTurn = gameState.currentTurnPlayerId === localPlayerId;
  const isPlaying = gameState.phase === 'playing';
  const canDraw = isMyTurn && isPlaying && !loading && !layout.hideDrawPile;

  const otherPlayers = gameState.players.filter(
    (p) => p.id !== localPlayerId,
  );

  // Custom zones to display (from layout.showZones)
  const customZones = (layout.showZones ?? [])
    .map((zoneId) => gameState.zones.find((z) => z.id === zoneId))
    .filter((z): z is Zone => z != null);

  // Scores for scoreboard
  const scores = (gameState.metadata?.scores as Record<string, number>) ?? {};
  const showScoreboard = layout.showScoreboard && Object.keys(scores).length > 0;

  // Per-player data from metadata
  const playerData = (gameState.metadata?.playerData as Record<string, Record<string, unknown>>) ?? {};

  return (
    <div className="flex flex-col items-center gap-6 w-full">
      {/* Game-wide display fields (e.g. pot size, round) */}
      {displayConfig.gameDisplayFields && displayConfig.gameDisplayFields.length > 0 && (
        <GameInfoBar fields={displayConfig.gameDisplayFields} metadata={gameState.metadata ?? {}} />
      )}

      {/* Other players' areas */}
      <div className="flex flex-wrap gap-4 justify-center w-full">
        {otherPlayers.map((player) => (
          <OtherPlayerArea
            key={player.id}
            player={player}
            isCurrentTurn={gameState.currentTurnPlayerId === player.id}
            score={showScoreboard ? scores[player.id] : undefined}
            displayFields={displayConfig.playerDisplayFields}
            playerData={playerData[player.id]}
          />
        ))}
      </div>

      {/* Scoreboard */}
      {showScoreboard && (
        <Scoreboard players={gameState.players} scores={scores} />
      )}

      {/* Custom zones (e.g. community cards in poker, player line in flip seven) */}
      {customZones.length > 0 && (
        <div className="flex flex-wrap gap-6 justify-center w-full">
          {customZones.map((zone) => (
            <CustomZoneDisplay key={zone.id} zone={zone} />
          ))}
        </div>
      )}

      {/* Center table: draw pile + discard pile */}
      <div className="flex items-center gap-8">
        {/* Draw pile */}
        {!layout.hideDrawPile && (
          <div className="flex flex-col items-center gap-2">
            <span className="font-display text-[10px] font-semibold tracking-[0.1em] uppercase text-[var(--color-stone)]">
              Draw Pile
            </span>
            <div
              className={`relative ${canDraw ? 'cursor-pointer hover:scale-105' : 'cursor-not-allowed'} transition-transform`}
              onClick={canDraw ? onDrawCard : undefined}
            >
              <GameCard
                card={{
                  id: 'deck_back',
                  definitionId: 'hidden',
                  name: 'Draw Pile',
                  type: 'hidden',
                  description: '',
                  effects: [],
                  isPlayable: canDraw,
                  isReaction: false,
                }}
                faceDown
                selectable={canDraw}
                disabled={!canDraw}
              />
              {/* Card count badge */}
              <div className="absolute -top-2 -right-2 bg-[var(--color-gold)] text-[var(--color-bg-deep)] text-xs font-bold rounded-full min-w-6 h-6 flex items-center justify-center px-1 shadow-lg">
                {drawPile?.cards.length ?? 0}
              </div>
              {canDraw && (
                <div className="absolute inset-0 rounded-xl border-2 border-[var(--color-gold)] animate-pulse opacity-70 pointer-events-none" />
              )}
            </div>
            {canDraw && (
              <span className="font-body text-[var(--color-gold)] text-xs font-bold animate-bounce">
                Click to draw!
              </span>
            )}
          </div>
        )}

        {/* Discard pile */}
        {!layout.hideDiscardPile && (
          <div className="flex flex-col items-center gap-2">
            <span className="font-display text-[10px] font-semibold tracking-[0.1em] uppercase text-[var(--color-stone)]">
              Discard
            </span>
            {discardPile?.cards[0] ? (
              <GameCard
                card={discardPile.cards[0]}
                selectable={false}
              />
            ) : (
              <div className="w-24 h-36 rounded-xl border-2 border-dashed border-[var(--color-border)] flex items-center justify-center">
                <span className="font-body text-[var(--color-stone-dim)] text-xs">Empty</span>
              </div>
            )}
            <span className="font-body text-[var(--color-stone-dim)] text-xs">
              {discardPile?.cards.length ?? 0} discarded
            </span>
          </div>
        )}
      </div>

      {/* Game status */}
      <GameStatusBar gameState={gameState} localPlayerId={localPlayerId} />
    </div>
  );
}

// ── Custom Zone Display ──────────────────────────────────────────────────────

function CustomZoneDisplay({ zone }: { zone: Zone }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <span className="font-display text-[10px] font-semibold tracking-[0.1em] uppercase text-[var(--color-stone)]">
        {zone.name}
      </span>
      <div className="flex gap-2 flex-wrap justify-center">
        {zone.cards.length > 0 ? (
          zone.cards.map((card) => (
            <GameCard
              key={card.id}
              card={card}
              selectable={false}
              faceDown={!zone.isPublic}
            />
          ))
        ) : (
          <div className="w-24 h-36 rounded-xl border-2 border-dashed border-[var(--color-border)] flex items-center justify-center">
            <span className="font-body text-[var(--color-stone-dim)] text-xs">Empty</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Scoreboard ───────────────────────────────────────────────────────────────

function Scoreboard({ players, scores }: { players: Player[]; scores: Record<string, number> }) {
  const sorted = [...players]
    .filter((p) => p.status !== 'waiting')
    .sort((a, b) => (scores[b.id] ?? 0) - (scores[a.id] ?? 0));

  return (
    <div className="section-panel w-full max-w-md">
      <div className="section-panel-inner">
        <p className="font-display text-[10px] font-semibold tracking-[0.15em] uppercase text-[var(--color-stone)] mb-2 text-center">
          Scoreboard
        </p>
        <div className="space-y-1">
          {sorted.map((p, i) => (
            <div
              key={p.id}
              className={`flex items-center justify-between px-3 py-1.5 rounded-lg ${
                i === 0 ? 'bg-[var(--color-gold-muted)]' : 'bg-[var(--color-surface)]'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="text-sm">{p.emoji}</span>
                <span className="font-body text-sm font-semibold text-[var(--color-cream)]">
                  {p.name}
                </span>
              </div>
              <span className={`font-body text-sm font-bold ${
                i === 0 ? 'text-[var(--color-gold)]' : 'text-[var(--color-stone)]'
              }`}>
                {scores[p.id] ?? 0}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Game-wide info bar ───────────────────────────────────────────────────────

function GameInfoBar({ fields, metadata }: { fields: DisplayField[]; metadata: Record<string, unknown> }) {
  return (
    <div className="flex flex-wrap gap-3 justify-center w-full">
      {fields.map((field) => {
        const raw = metadata[field.key];
        const value = raw ?? field.defaultValue ?? (field.format === 'number' ? 0 : '—');
        return (
          <div
            key={field.key}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)]"
          >
            {field.icon && <span className="text-sm">{field.icon}</span>}
            <span className="font-body text-xs text-[var(--color-stone)]">{field.label}:</span>
            <span className="font-body text-sm font-bold text-[var(--color-cream)]">
              {typeof value === 'number' ? value.toLocaleString() : String(value)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── Other player display ──────────────────────────────────────────────────────

function OtherPlayerArea({
  player,
  isCurrentTurn,
  score,
  displayFields,
  playerData,
}: {
  player: Player;
  isCurrentTurn: boolean;
  score?: number;
  displayFields?: DisplayField[];
  playerData?: Record<string, unknown>;
}) {
  const cardCount = player.hand.cards.length;
  const isEliminated = player.status === 'eliminated';
  const isWinner = player.status === 'winner';

  return (
    <div
      className={`
        flex flex-col items-center gap-2 p-3 rounded-xl border transition-all
        ${isCurrentTurn ? 'border-[var(--color-gold)] bg-[var(--color-gold-muted)] shadow-lg' : 'border-[var(--color-border)] bg-[var(--color-surface)]'}
        ${isEliminated ? 'opacity-40' : ''}
        ${isWinner ? 'border-[var(--color-verdant)] bg-[rgba(74,175,130,0.1)]' : ''}
      `}
    >
      <div className="flex items-center gap-2">
        <span className="text-lg">{player.emoji}</span>
        <div>
          <p className={`font-body text-sm font-bold ${isEliminated ? 'line-through text-[var(--color-stone-dim)]' : 'text-[var(--color-cream)]'}`}>
            {player.name}
          </p>
          <p className="font-body text-xs text-[var(--color-stone-dim)]">
            {isEliminated ? 'Eliminated' : isWinner ? 'Winner' : isCurrentTurn ? 'Their turn' : `${cardCount} cards`}
          </p>
        </div>
        {!player.isConnected && (
          <span className="text-[var(--color-amber)] text-xs">DC</span>
        )}
      </div>

      {/* JSON-defined player display fields (chips, current bet, etc.) */}
      {displayFields && displayFields.length > 0 && playerData && (
        <div className="flex flex-wrap gap-1.5 justify-center">
          {displayFields.map((field) => {
            const raw = playerData[field.key];
            const value = raw ?? field.defaultValue ?? (field.format === 'number' ? 0 : '—');
            return (
              <span
                key={field.key}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[var(--color-bg-deep)] text-[var(--color-stone)]"
                title={field.label}
              >
                {field.icon && <span className="text-xs">{field.icon}</span>}
                <span className="font-body text-[10px] uppercase tracking-wider">{field.label}</span>
                <span className="font-body text-xs font-bold text-[var(--color-cream)]">
                  {typeof value === 'number' ? value.toLocaleString() : String(value)}
                </span>
              </span>
            );
          })}
        </div>
      )}

      {/* Score badge */}
      {score !== undefined && (
        <span className="font-body text-xs font-bold text-[var(--color-gold)]">
          {score} pts
        </span>
      )}

      {/* Hidden card fans */}
      {!isEliminated && (
        <div className="flex -space-x-3">
          {Array.from({ length: Math.min(cardCount, 7) }).map((_, i) => (
            <div
              key={i}
              className="w-8 h-12 rounded-md bg-gradient-to-br from-[var(--color-surface-raised)] to-[var(--color-bg-deep)] border border-[var(--color-border)] shadow-md"
              style={{ transform: `rotate(${(i - Math.min(cardCount, 7) / 2) * 5}deg)` }}
            />
          ))}
          {cardCount > 7 && (
            <div className="w-8 h-12 rounded-md bg-[var(--color-surface-raised)] border border-[var(--color-gold-dim)] flex items-center justify-center shadow-md">
              <span className="text-[var(--color-cream)] text-xs font-bold">+{cardCount - 7}</span>
            </div>
          )}
        </div>
      )}

      {isCurrentTurn && (
        <span className="font-display text-[10px] tracking-wider text-[var(--color-gold)] font-bold animate-pulse">
          THEIR TURN
        </span>
      )}
    </div>
  );
}

// ── Status bar ────────────────────────────────────────────────────────────────

function GameStatusBar({ gameState, localPlayerId }: { gameState: GameState; localPlayerId: string }) {
  const currentPlayer = gameState.players.find((p) => p.id === gameState.currentTurnPlayerId);
  const isMyTurn = gameState.currentTurnPlayerId === localPlayerId;

  const getMessage = () => {
    if (gameState.phase === 'ended') {
      const winner = gameState.winner ?? gameState.players.find((p) => p.status === 'winner');
      return `${winner?.name ?? 'Someone'} wins!`;
    }
    if (gameState.phase === 'awaiting_response') {
      const pending = gameState.pendingAction;
      if (pending?.type === 'insert_exploding') return 'Place the bomb back in the deck\u2026';
      if (pending?.type === 'favor') {
        const target = gameState.players.find((p) => p.id === pending.targetPlayerId);
        return target ? `${target.name} must give a card\u2026` : 'Waiting for Favor response\u2026';
      }
      return 'Waiting for response\u2026';
    }
    if (isMyTurn) return "It\u2019s your turn!";
    return `Waiting for ${currentPlayer?.name ?? '\u2026'}`;
  };

  return (
    <div className="section-panel w-full">
      <div className="section-panel-inner text-center">
        <p className="font-display text-sm font-semibold tracking-wide text-[var(--color-cream)]">{getMessage()}</p>
        <p className="font-body text-xs text-[var(--color-stone-dim)] mt-1">
          Turn {gameState.turnNumber} &middot; {gameState.players.filter((p) => p.status === 'active').length} player{gameState.players.filter((p) => p.status === 'active').length !== 1 ? 's' : ''} remaining
        </p>
      </div>
    </div>
  );
}
