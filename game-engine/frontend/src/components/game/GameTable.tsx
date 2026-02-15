'use client';

import type { GameState, Player, Zone } from '@/types/game';
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
          <span className="text-white/60 text-xs font-semibold uppercase tracking-wider">
            {gameState.rules?.turnStructure ? 'Draw Pile' : 'Draw'}
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
            <div className="absolute -top-2 -right-2 bg-yellow-500 text-black text-xs font-bold rounded-full min-w-6 h-6 flex items-center justify-center px-1 shadow-lg">
              {drawPile?.cards.length ?? 0}
            </div>
            {canDraw && (
              <div className="absolute inset-0 rounded-xl border-2 border-yellow-400 animate-pulse opacity-70 pointer-events-none" />
            )}
          </div>
          {canDraw && (
            <span className="text-yellow-400 text-xs font-bold animate-bounce">
              Click to draw!
            </span>
          )}
        </div>

        {/* Discard pile */}
        <div className="flex flex-col items-center gap-2">
          <span className="text-white/60 text-xs font-semibold uppercase tracking-wider">Discard</span>
          {discardPile?.cards[0] ? (
            <GameCard
              card={discardPile.cards[0]}
              selectable={false}
            />
          ) : (
            <div className="w-24 h-36 rounded-xl border-2 border-dashed border-white/20 flex items-center justify-center">
              <span className="text-white/30 text-xs">Empty</span>
            </div>
          )}
          <span className="text-white/40 text-xs">
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
        ${isCurrentTurn ? 'border-yellow-400 bg-yellow-400/10 shadow-lg shadow-yellow-400/20' : 'border-white/10 bg-white/5'}
        ${isEliminated ? 'opacity-40' : ''}
        ${isWinner ? 'border-green-400 bg-green-400/10' : ''}
      `}
    >
      {/* Player info */}
      <div className="flex items-center gap-2">
        <span className="text-lg">{player.emoji}</span>
        <div>
          <p className={`text-sm font-bold ${isEliminated ? 'line-through text-gray-500' : 'text-white'}`}>
            {player.name}
          </p>
          <p className="text-xs text-white/40">
            {isEliminated ? '💥 Eliminated' : isWinner ? '🏆 Winner' : isCurrentTurn ? '⏳ Their turn' : `${cardCount} cards`}
          </p>
        </div>
        {!player.isConnected && (
          <span className="text-orange-400 text-xs">⚠️ DC</span>
        )}
      </div>

      {/* Hidden card fans */}
      {!isEliminated && (
        <div className="flex -space-x-3">
          {Array.from({ length: Math.min(cardCount, 7) }).map((_, i) => (
            <div
              key={i}
              className="w-8 h-12 rounded-md bg-gradient-to-br from-gray-700 to-gray-900 border border-gray-600 shadow-md"
              style={{ transform: `rotate(${(i - Math.min(cardCount, 7) / 2) * 5}deg)` }}
            />
          ))}
          {cardCount > 7 && (
            <div className="w-8 h-12 rounded-md bg-blue-800 border border-blue-600 flex items-center justify-center shadow-md">
              <span className="text-white text-xs font-bold">+{cardCount - 7}</span>
            </div>
          )}
        </div>
      )}

      {isCurrentTurn && (
        <span className="text-yellow-400 text-xs font-bold animate-pulse">THEIR TURN</span>
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
      return `🎉 ${winner?.name ?? 'Someone'} wins!`;
    }
    if (gameState.phase === 'awaiting_response') {
      const pending = gameState.pendingAction;
      if (pending?.type === 'insert_exploding') return '🔧 Place the bomb back in the deck…';
      if (pending?.type === 'favor') {
        const target = gameState.players.find((p) => p.id === pending.targetPlayerId);
        return target ? `🙏 ${target.name} must give a card…` : 'Waiting for Favor response…';
      }
      return '⏳ Waiting for response…';
    }
    if (isMyTurn) return "🎯 It's your turn!";
    return `⏳ Waiting for ${currentPlayer?.name ?? '…'}`;
  };

  return (
    <div className="bg-black/40 rounded-xl px-6 py-3 border border-white/10">
      <p className="text-white text-sm font-semibold text-center">{getMessage()}</p>
      <p className="text-white/40 text-xs text-center mt-1">
        Turn {gameState.turnNumber} · {gameState.players.filter((p) => p.status === 'active').length} player{gameState.players.filter((p) => p.status === 'active').length !== 1 ? 's' : ''} remaining
      </p>
    </div>
  );
}
