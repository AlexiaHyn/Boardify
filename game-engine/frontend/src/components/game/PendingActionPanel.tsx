'use client';

import { useState } from 'react';
import type { Card, GameState, Player } from '@/types/game';
import { GameCard } from './GameCard';

interface PendingActionPanelProps {
  gameState: GameState;
  localPlayerId: string;
  onInsertExploding: (position: number) => void;
  onGiveCard: (cardId: string) => void;
  onSelectTarget: (targetPlayerId: string) => void;
  onPlayNope?: (cardId: string) => void;
}

export function PendingActionPanel({
  gameState,
  localPlayerId,
  onInsertExploding,
  onGiveCard,
  onSelectTarget,
  onPlayNope,
}: PendingActionPanelProps) {
  const pending = gameState.pendingAction;
  if (!pending) return null;
  if (gameState.phase !== 'awaiting_response') return null;

  // Insert exploding: only the player who defused sees this
  if (pending.type === 'insert_exploding' && pending.playerId === localPlayerId) {
    return (
      <InsertExplodingModal
        deckSize={pending.deckSize ?? 0}
        onInsert={onInsertExploding}
      />
    );
  }

  // Favor target must give a card
  if (pending.type === 'favor' && pending.targetPlayerId === localPlayerId) {
    const localPlayer = gameState.players.find((p) => p.id === localPlayerId);
    const requester = gameState.players.find((p) => p.id === pending.playerId);
    if (localPlayer && requester) {
      return (
        <GiveCardModal
          player={localPlayer}
          requesterName={requester.name}
          onGive={onGiveCard}
        />
      );
    }
  }

  // Nope window: any player with a Nope can cancel a pending action (not insert_exploding)
  if (
    pending.type !== 'insert_exploding' &&
    pending.type !== 'favor' &&
    onPlayNope
  ) {
    const localPlayer = gameState.players.find((p) => p.id === localPlayerId);
    const nopeCard = localPlayer?.hand.cards.find((c) => c.subtype === 'nope');
    if (nopeCard) {
      return <NopeWindow nopeCard={nopeCard} onNope={onPlayNope} pendingType={pending.type} />;
    }
  }

  // Generic waiting overlay
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-gray-900 rounded-2xl p-8 border border-white/20 text-center max-w-sm">
        <div className="text-4xl mb-4 animate-spin">⏳</div>
        <p className="text-white font-bold text-lg">Waiting…</p>
        <p className="text-white/60 text-sm mt-2">
          {pending.type === 'favor' ? 'Waiting for a player to give a card…' : 'Waiting for response…'}
        </p>
      </div>
    </div>
  );
}

// ── Insert Exploding Kitten ───────────────────────────────────────────────────

function InsertExplodingModal({
  deckSize,
  onInsert,
}: {
  deckSize: number;
  onInsert: (pos: number) => void;
}) {
  const [position, setPosition] = useState(0);
  const max = deckSize;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
      <div className="bg-gray-900 rounded-2xl p-8 border border-orange-500/50 text-center max-w-md w-full mx-4 shadow-2xl">
        <div className="text-5xl mb-4">💣</div>
        <h2 className="text-white font-bold text-xl mb-2">You Defused It!</h2>
        <p className="text-white/70 text-sm mb-6">
          Choose where to secretly reinsert the Exploding Kitten into the deck.
          Position 0 = top, {max} = bottom.
        </p>

        <div className="mb-6">
          <label className="text-white/60 text-sm block mb-2">
            Position: <span className="text-yellow-400 font-bold text-lg">{position}</span>
            {position === 0 && <span className="text-red-400 text-xs ml-2">(TOP — dangerous!)</span>}
            {position === max && <span className="text-green-400 text-xs ml-2">(BOTTOM — safe!)</span>}
          </label>
          <input
            type="range"
            min={0}
            max={max}
            value={position}
            onChange={(e) => setPosition(Number(e.target.value))}
            className="w-full accent-orange-500"
          />
          <div className="flex justify-between text-white/30 text-xs mt-1">
            <span>Top</span>
            <span>Bottom</span>
          </div>
        </div>

        <div className="flex gap-3 justify-center">
          <button
            onClick={() => onInsert(position)}
            className="bg-orange-500 hover:bg-orange-600 text-white font-bold px-8 py-3 rounded-xl transition-colors shadow-lg"
          >
            Insert Here
          </button>
          <button
            onClick={() => onInsert(Math.floor(Math.random() * (max + 1)))}
            className="bg-gray-700 hover:bg-gray-600 text-white/70 px-4 py-3 rounded-xl transition-colors text-sm"
          >
            Random
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Give Card (Favor target) ──────────────────────────────────────────────────

function GiveCardModal({
  player,
  requesterName,
  onGive,
}: {
  player: Player;
  requesterName: string;
  onGive: (cardId: string) => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
      <div className="bg-gray-900 rounded-2xl p-8 border border-purple-500/50 text-center max-w-lg w-full mx-4 shadow-2xl">
        <div className="text-5xl mb-4">🙏</div>
        <h2 className="text-white font-bold text-xl mb-2">Favor!</h2>
        <p className="text-white/70 text-sm mb-6">
          <span className="text-yellow-400 font-bold">{requesterName}</span> wants a card.
          Choose which card to give them.
        </p>

        <div className="flex flex-wrap gap-3 justify-center mb-6">
          {player.hand.cards.map((card) => (
            <div key={card.id} className="cursor-pointer" onClick={() => onGive(card.id)}>
              <GameCard
                card={card}
                selectable
                onClick={() => onGive(card.id)}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Nope window ───────────────────────────────────────────────────────────────

function NopeWindow({
  nopeCard,
  onNope,
  pendingType,
}: {
  nopeCard: Card;
  onNope: (cardId: string) => void;
  pendingType: string;
}) {
  return (
    <div className="fixed bottom-4 right-4 z-50">
      <div className="bg-red-900/90 rounded-xl p-4 border border-red-500 shadow-2xl max-w-xs">
        <p className="text-white font-bold text-sm mb-2">🚫 Play Nope?</p>
        <p className="text-white/70 text-xs mb-3">
          Cancel the <span className="text-red-300 font-semibold">{pendingType}</span> action?
        </p>
        <button
          onClick={() => onNope(nopeCard.id)}
          className="w-full bg-red-500 hover:bg-red-600 text-white font-bold py-2 rounded-lg transition-colors"
        >
          NOPE! 🚫
        </button>
      </div>
    </div>
  );
}

// ── Target selector ───────────────────────────────────────────────────────────

interface TargetSelectorProps {
  players: Player[];
  localPlayerId: string;
  onSelect: (targetId: string) => void;
  onCancel: () => void;
  title?: string;
  subtitle?: string;
}

export function TargetSelector({
  players,
  localPlayerId,
  onSelect,
  onCancel,
  title = 'Choose a Target',
  subtitle,
}: TargetSelectorProps) {
  const targets = players.filter(
    (p) => p.id !== localPlayerId && p.status === 'active',
  );

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
      <div className="bg-gray-900 rounded-2xl p-8 border border-blue-500/50 text-center max-w-sm w-full mx-4 shadow-2xl">
        <h2 className="text-white font-bold text-xl mb-2">{title}</h2>
        {subtitle && <p className="text-white/60 text-sm mb-6">{subtitle}</p>}

        <div className="space-y-3 mb-6">
          {targets.map((p) => (
            <button
              key={p.id}
              onClick={() => onSelect(p.id)}
              className="w-full flex items-center gap-3 bg-gray-800 hover:bg-gray-700 rounded-xl p-3 transition-colors border border-white/10"
            >
              <span className="text-2xl">{p.emoji}</span>
              <div className="text-left">
                <p className="text-white font-semibold">{p.name}</p>
                <p className="text-white/40 text-xs">{p.hand.cards.length} cards</p>
              </div>
            </button>
          ))}
        </div>

        <button
          onClick={onCancel}
          className="text-white/40 hover:text-white text-sm transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
