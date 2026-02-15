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
    <div className="flex flex-col items-center gap-6 w-full relative min-h-[500px]">
      {/* Table surface - Green felt like a poker/card table */}
      <div className="absolute inset-0 -mx-4 -my-4 rounded-3xl bg-gradient-to-br from-[#0a5a3a] via-[#0d6e47] to-[#0a5a3a] opacity-95 pointer-events-none" 
           style={{
             backgroundImage: `
               radial-gradient(circle at 20% 80%, rgba(255, 255, 255, 0.03) 0%, transparent 50%),
               radial-gradient(circle at 80% 20%, rgba(255, 255, 255, 0.03) 0%, transparent 50%),
               repeating-linear-gradient(
                 0deg,
                 transparent,
                 transparent 2px,
                 rgba(0, 0, 0, 0.03) 2px,
                 rgba(0, 0, 0, 0.03) 4px
               ),
               repeating-linear-gradient(
                 90deg,
                 transparent,
                 transparent 2px,
                 rgba(0, 0, 0, 0.03) 2px,
                 rgba(0, 0, 0, 0.03) 4px
               )
             `,
             boxShadow: 'inset 0 0 120px rgba(0,0,0,0.6), inset 0 0 60px rgba(0,0,0,0.4), 0 12px 40px rgba(0,0,0,0.7)',
             border: '8px solid #3a2820',
             borderRadius: '24px'
           }}
      />
      
      {/* Content above table */}
      <div className="relative z-10 flex flex-col items-center gap-6 w-full">
        {/* Other players' areas */}
        <div className="flex flex-wrap gap-4 justify-center w-full">
          {otherPlayers.map((player) => (
            <OtherPlayerArea key={player.id} player={player} isCurrentTurn={gameState.currentTurnPlayerId === player.id} />
          ))}
        </div>

        {/* Center table: draw pile + discard pile */}
        <div className="flex items-center gap-8">
          {/* Draw pile - smaller for UNO */}
          <div className="flex flex-col items-center gap-2">
            <span className="font-display text-[10px] font-semibold tracking-[0.1em] uppercase text-[var(--color-gold)] drop-shadow-lg">
              Draw
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
                small
              />
              {/* Card count badge */}
              <div className="absolute -top-2 -right-2 bg-[var(--color-gold)] text-[var(--color-bg-deep)] text-xs font-bold rounded-full min-w-6 h-6 flex items-center justify-center px-1 shadow-lg border border-[var(--color-gold-bright)]">
                {drawPile?.cards.length ?? 0}
              </div>
              {canDraw && (
                <div className="absolute inset-0 rounded-xl border-2 border-[var(--color-gold)] animate-pulse opacity-70 pointer-events-none" />
              )}
            </div>
            {canDraw && (
              <span className="font-body text-[var(--color-gold-bright)] text-xs font-bold animate-bounce drop-shadow-lg">
                Draw!
              </span>
            )}
          </div>

          {/* Discard pile - FOCAL POINT, extra large */}
          <div className="flex flex-col items-center gap-4">
            <span className="font-display text-sm font-bold tracking-[0.15em] uppercase text-[var(--color-gold-bright)] drop-shadow-lg">
              Discard Pile
            </span>
            {discardPile?.cards[0] ? (
              <div className="relative">
                <GameCard
                  card={discardPile.cards[0]}
                  selectable={false}
                  extraLarge
                />
                {/* Spotlight effect */}
                <div className="absolute inset-0 rounded-xl pointer-events-none"
                     style={{
                       boxShadow: '0 0 60px rgba(255, 255, 255, 0.15), 0 0 100px rgba(255, 255, 255, 0.1)'
                     }}
                />
              </div>
            ) : (
              <div className="w-48 h-72 rounded-xl border-3 border-dashed border-[var(--color-gold-dim)] flex items-center justify-center bg-[var(--color-surface)] bg-opacity-50 shadow-2xl">
                <span className="font-body text-[var(--color-stone-dim)] text-base">Empty</span>
              </div>
            )}
            <span className="font-body text-[var(--color-cream)] text-base font-semibold drop-shadow">
              {discardPile?.cards.length ?? 0} cards
            </span>
          </div>
        </div>

        {/* Game status */}
        <GameStatusBar gameState={gameState} localPlayerId={localPlayerId} />
      </div>
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
        flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all backdrop-blur-sm
        ${isCurrentTurn ? 'border-[var(--color-gold)] bg-[rgba(201,168,76,0.25)] shadow-2xl shadow-[var(--color-gold)]' : 'border-[rgba(255,255,255,0.2)] bg-[rgba(0,0,0,0.3)]'}
        ${isEliminated ? 'opacity-40' : ''}
        ${isWinner ? 'border-[var(--color-verdant-bright)] bg-[rgba(74,175,130,0.25)] shadow-2xl shadow-[var(--color-verdant)]' : ''}
      `}
    >
      <div className="flex items-center gap-2">
        <span className="text-2xl drop-shadow-lg">{player.emoji}</span>
        <div>
          <p className={`font-body text-sm font-bold drop-shadow ${isEliminated ? 'line-through text-[var(--color-stone-dim)]' : 'text-white'}`}>
            {player.name}
          </p>
          <p className="font-body text-xs text-[var(--color-cream)] drop-shadow">
            {isEliminated ? 'Eliminated' : isWinner ? 'Winner' : isCurrentTurn ? 'Their turn' : `${cardCount} cards`}
          </p>
        </div>
        {!player.isConnected && (
          <span className="text-[var(--color-amber)] text-xs font-bold">DC</span>
        )}
      </div>

      {/* Hidden card fans - BIGGER */}
      {!isEliminated && (
        <div className="flex -space-x-4">
          {Array.from({ length: Math.min(cardCount, 7) }).map((_, i) => (
            <div
              key={i}
              className="w-12 h-16 rounded-lg bg-gradient-to-br from-[var(--color-surface-raised)] to-[var(--color-bg-deep)] border-2 border-[var(--color-border)] shadow-lg"
              style={{ transform: `rotate(${(i - Math.min(cardCount, 7) / 2) * 5}deg)` }}
            />
          ))}
          {cardCount > 7 && (
            <div className="w-12 h-16 rounded-lg bg-[var(--color-surface-raised)] border-2 border-[var(--color-gold-dim)] flex items-center justify-center shadow-lg">
              <span className="text-[var(--color-cream)] text-sm font-bold">+{cardCount - 7}</span>
            </div>
          )}
        </div>
      )}

      {isCurrentTurn && (
        <span className="font-display text-[10px] tracking-wider text-[var(--color-gold-bright)] font-bold animate-pulse drop-shadow-lg">
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
