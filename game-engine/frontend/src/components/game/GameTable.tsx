'use client';

import type { GameState, Player } from '@/types/game';
import { GameCard } from './GameCard';

interface GameTableProps {
  gameState: GameState;
  localPlayerId: string;
  onDrawCard: () => void;
  loading?: boolean;
}

export function GameTable({ gameState, localPlayerId, onDrawCard, loading }: GameTableProps) {
  const drawPile = gameState.zones.find((z) => z.id === 'draw_pile');
  const discardPile = gameState.zones.find((z) => z.id === 'discard_pile');
  const isMyTurn = gameState.currentTurnPlayerId === localPlayerId;
  const isPlaying = gameState.phase === 'playing';
  const canDraw = isMyTurn && isPlaying && !loading;

  const otherPlayers = gameState.players.filter(
    (p) => p.id !== localPlayerId,
  );

  return (
    <div className="flex flex-col items-center gap-6 w-full">
      {/* Other players' areas */}
      <div className="flex flex-wrap gap-4 justify-center w-full">
        {otherPlayers.map((player) => (
          <OtherPlayerArea key={player.id} player={player} isCurrentTurn={gameState.currentTurnPlayerId === player.id} />
        ))}
      </div>

      {/* Center table: draw pile + discard pile */}
      <div className="flex items-center gap-8">
        {/* Draw pile */}
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

        {/* Discard pile */}
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
      </div>

      {/* Game status */}
      <GameStatusBar gameState={gameState} localPlayerId={localPlayerId} />
    </div>
  );
}

// ── Other player display ──────────────────────────────────────────────────────

function OtherPlayerArea({ player, isCurrentTurn }: { player: Player; isCurrentTurn: boolean }) {
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
