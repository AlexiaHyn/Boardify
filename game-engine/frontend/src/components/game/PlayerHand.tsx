'use client';

import { useState } from 'react';
import type { Card, GameState, Player } from '@/types/game';
import { GameCard, CardTooltip } from './GameCard';

interface PlayerHandProps {
  player: Player;
  gameState: GameState;
  onPlayCard: (card: Card) => void;
  onSelectComboCard?: (card: Card) => void;
  selectedCard?: Card | null;
  loading?: boolean;
}

export function PlayerHand({
  player,
  gameState,
  onPlayCard,
  onSelectComboCard,
  selectedCard,
  loading,
}: PlayerHandProps) {
  const [hoveredCard, setHoveredCard] = useState<Card | null>(null);

  const isMyTurn = gameState.currentTurnPlayerId === player.id;
  const isPlaying = gameState.phase === 'playing';
  const isAwaiting = gameState.phase === 'awaiting_response';

  // Can play nope if there's a pending action and we have one
  const pending = gameState.pendingAction;
  const canNope =
    isAwaiting &&
    pending?.type !== 'insert_exploding' &&
    player.hand.cards.some((c) => c.subtype === 'nope');

  const canPlayCard = (card: Card): boolean => {
    if (loading) return false;
    if (card.type === 'hidden') return false;
    if (card.subtype === 'defuse') return false; // auto-played
    if (card.subtype === 'exploding') return false;
    if (card.isReaction && card.subtype === 'nope') return canNope || (isMyTurn && isPlaying);
    return isMyTurn && isPlaying;
  };

  const handleCardClick = (card: Card) => {
    if (!canPlayCard(card)) return;
    onPlayCard(card);
  };

  const cardCount = player.hand.cards.length;

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">{player.emoji}</span>
          <span className="text-white font-bold">{player.name}</span>
          <span className="text-white/60 text-sm">({cardCount} card{cardCount !== 1 ? 's' : ''})</span>
        </div>
        {isMyTurn && isPlaying && (
          <span className="bg-green-500 text-white text-xs font-bold px-3 py-1 rounded-full animate-pulse">
            YOUR TURN
          </span>
        )}
        {canNope && (
          <span className="bg-red-500 text-white text-xs font-bold px-3 py-1 rounded-full animate-pulse">
            NOPE?
          </span>
        )}
      </div>

      <div className="flex flex-wrap gap-3 justify-center min-h-[9rem] bg-black/20 rounded-xl p-3">
        {player.hand.cards.length === 0 ? (
          <div className="flex items-center justify-center w-full text-white/40 text-sm">
            No cards in hand
          </div>
        ) : (
          player.hand.cards.map((card) => {
            const playable = canPlayCard(card);
            return (
              <div key={card.id} className="relative">
                <GameCard
                  card={card}
                  selected={selectedCard?.id === card.id}
                  selectable={playable}
                  disabled={!playable}
                  onClick={handleCardClick}
                  onHover={setHoveredCard}
                />
                {hoveredCard?.id === card.id && (
                  <CardTooltip card={card} visible />
                )}
              </div>
            );
          })
        )}
      </div>

      {isMyTurn && isPlaying && (
        <p className="text-white/60 text-xs text-center mt-2">
          Click a card to play it, or draw from the deck
        </p>
      )}
    </div>
  );
}
