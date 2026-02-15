'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Card, GameState } from '@/types/game';
import { useGameSocket } from '@/hooks/useGameSocket';
import { useGameActions } from '@/hooks/useGameActions';
import { startRoom } from '@/lib/api';
import { Lobby } from '@/components/lobby/Lobby';
import { GameTable } from '@/components/game/GameTable';
import { PlayerHand } from '@/components/game/PlayerHand';
import { GameLog } from '@/components/game/GameLog';
import { PendingActionPanel, TargetSelector } from '@/components/game/PendingActionPanel';
import { SeeTheFutureModal } from '@/components/game/SeeTheFutureModal';

interface GameRoomProps {
  roomCode: string;
  playerId: string;
  initialState?: GameState;
}

type CardInteractionMode =
  | { mode: 'idle' }
  | { mode: 'select_favor_target'; card: Card }
  | { mode: 'select_combo_pair'; firstCard: Card }
  | { mode: 'select_combo_target'; firstCard: Card; secondCard: Card };

export function GameRoom({ roomCode, playerId, initialState }: GameRoomProps) {
  const [gameState, setGameState] = useState<GameState | null>(initialState ?? null);
  const [interaction, setInteraction] = useState<CardInteractionMode>({ mode: 'idle' });
  const [seeTheFutureCards, setSeeTheFutureCards] = useState<string[] | null>(null);
  const [startLoading, setStartLoading] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);
  const notifTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showNotif = useCallback((msg: string) => {
    setNotification(msg);
    if (notifTimeout.current) clearTimeout(notifTimeout.current);
    notifTimeout.current = setTimeout(() => setNotification(null), 3500);
  }, []);

  // WebSocket updates
  const onStateUpdate = useCallback(
    (state: GameState) => {
      setGameState((prev) => {
        // If a new log entry references see_future, extract card names
        if (prev) {
          const newEntries = state.log.slice(prev.log.length);
          for (const entry of newEntries) {
            const m = entry.message.match(/top3:(.+)$/);
            if (m && entry.playerId === playerId) {
              setSeeTheFutureCards(m[1].split(','));
            }
            if (entry.type === 'effect' || entry.type === 'system') {
              showNotif(entry.message);
            }
          }
        }
        return state;
      });
    },
    [playerId, showNotif],
  );

  const { connected } = useGameSocket({ roomCode, playerId, onStateUpdate });

  const { loading, error, drawCard, playCard, playCombo, playNope, selectTarget, insertExploding, giveCard } =
    useGameActions({ roomCode, playerId, gameState });

  const localPlayer = gameState?.players.find((p) => p.id === playerId);

  // ── Card interaction flow ──────────────────────────────────────────────────

  const handleCardClick = (card: Card) => {
    if (!gameState || !localPlayer) return;
    const isMyTurn = gameState.currentTurnPlayerId === playerId;
    const isPlaying = gameState.phase === 'playing';

    // Nope: can be played anytime during awaiting_response (not insert_exploding)
    if (
      card.subtype === 'nope' &&
      gameState.phase === 'awaiting_response' &&
      gameState.pendingAction?.type !== 'insert_exploding'
    ) {
      playNope(card.id);
      return;
    }

    if (!isMyTurn || !isPlaying) return;

    // Combo cats: needs two matching cards
    const COMBO_SUBTYPES = ['taco', 'rainbow', 'beard', 'potato', 'cattermelon'];
    if (COMBO_SUBTYPES.includes(card.subtype ?? '')) {
      if (interaction.mode === 'select_combo_pair') {
        if (
          interaction.firstCard.subtype === card.subtype &&
          interaction.firstCard.id !== card.id
        ) {
          // Found pair — select target
          setInteraction({ mode: 'select_combo_target', firstCard: interaction.firstCard, secondCard: card });
        } else {
          // Different card type or same card — reset
          setInteraction({ mode: 'select_combo_pair', firstCard: card });
          showNotif('Pick a matching cat card to pair with!');
        }
      } else {
        setInteraction({ mode: 'select_combo_pair', firstCard: card });
        showNotif(`Pick another ${card.name} to pair with it!`);
      }
      return;
    }

    // Favor: needs to select target
    if (card.subtype === 'favor') {
      setInteraction({ mode: 'select_favor_target', card });
      return;
    }

    // Regular card — play immediately
    playCard(card.id);
    setInteraction({ mode: 'idle' });
  };

  const handleFavorTargetSelect = (targetId: string) => {
    if (interaction.mode !== 'select_favor_target') return;
    playCard(interaction.card.id, targetId);
    setInteraction({ mode: 'idle' });
  };

  const handleComboTargetSelect = (targetId: string) => {
    if (interaction.mode !== 'select_combo_target') return;
    playCombo(interaction.firstCard.id, interaction.secondCard.id, targetId);
    setInteraction({ mode: 'idle' });
  };

  const handleCancelInteraction = () => setInteraction({ mode: 'idle' });

  // ── Lobby / start ─────────────────────────────────────────────────────────

  const handleStart = async () => {
    setStartLoading(true);
    try {
      await startRoom(roomCode, playerId);
    } catch (e) {
      showNotif((e as Error).message);
    } finally {
      setStartLoading(false);
    }
  };

  const handleCopyLink = () => {
    const url = `${window.location.origin}/join?room=${roomCode}`;
    navigator.clipboard.writeText(url).catch(() => {
      // fallback: show room code
    });
  };

  // ── Render ────────────────────────────────────────────────────────────────

  if (!gameState) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white text-center">
          <div className="text-5xl mb-4 animate-spin">⏳</div>
          <p className="text-xl font-semibold">Connecting…</p>
          <p className="text-white/40 text-sm mt-2">{connected ? 'Connected!' : 'Establishing connection…'}</p>
        </div>
      </div>
    );
  }

  if (gameState.phase === 'lobby') {
    return (
      <Lobby
        gameState={gameState}
        localPlayerId={playerId}
        onStart={handleStart}
        onCopyLink={handleCopyLink}
        startLoading={startLoading}
      />
    );
  }

  if (gameState.phase === 'ended') {
    const winner = gameState.winner ?? gameState.players.find((p) => p.status === 'winner');
    const isWinner = winner?.id === playerId;
    return (
      <GameOverScreen
        winner={winner?.name ?? 'Unknown'}
        isWinner={isWinner}
        gameName={gameState.gameName}
        log={gameState.log}
        onPlayAgain={handleCopyLink}
      />
    );
  }

  // ── Active game ───────────────────────────────────────────────────────────

  const selectedCard =
    interaction.mode === 'select_combo_pair' ? interaction.firstCard :
    interaction.mode === 'select_combo_target' ? interaction.firstCard :
    null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-3 border-b border-white/10 bg-black/30">
        <div className="flex items-center gap-3">
          <span className="text-xl">🃏</span>
          <span className="font-bold text-lg">{gameState.gameName}</span>
          <span className="bg-white/10 rounded-full px-3 py-0.5 text-xs font-mono text-white/70">
            {gameState.roomCode}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span
            className={`w-2 h-2 rounded-full ${connected ? 'bg-green-400' : 'bg-red-400 animate-pulse'}`}
          />
          <span className="text-white/40 text-xs">{connected ? 'Connected' : 'Reconnecting…'}</span>
        </div>
      </header>

      {/* Main game area */}
      <main className="flex-1 flex flex-col gap-4 p-4 max-w-6xl mx-auto w-full">
        {/* Game table (other players + deck + discard) */}
        <GameTable
          gameState={gameState}
          localPlayerId={playerId}
          onDrawCard={drawCard}
          loading={loading}
        />

        {/* Divider */}
        <div className="border-t border-white/10" />

        {/* Local player's hand */}
        {localPlayer && (
          <PlayerHand
            player={localPlayer}
            gameState={gameState}
            onPlayCard={handleCardClick}
            selectedCard={selectedCard}
            loading={loading}
          />
        )}

        {/* Game log */}
        <GameLog entries={gameState.log} />

        {/* Error display */}
        {error && (
          <div className="bg-red-900/50 border border-red-500/50 rounded-xl px-4 py-3 text-red-300 text-sm">
            ⚠️ {error}
          </div>
        )}
      </main>

      {/* Modals & overlays */}

      {/* Pending action (favor give / bomb insert / nope window) */}
      {localPlayer && (
        <PendingActionPanel
          gameState={gameState}
          localPlayerId={playerId}
          onInsertExploding={insertExploding}
          onGiveCard={giveCard}
          onSelectTarget={selectTarget}
          onPlayNope={playNope}
        />
      )}

      {/* Target selectors */}
      {interaction.mode === 'select_favor_target' && (
        <TargetSelector
          players={gameState.players}
          localPlayerId={playerId}
          onSelect={handleFavorTargetSelect}
          onCancel={handleCancelInteraction}
          title="Choose a Player to Favor"
          subtitle="They will give you a card of their choice."
        />
      )}
      {interaction.mode === 'select_combo_target' && (
        <TargetSelector
          players={gameState.players}
          localPlayerId={playerId}
          onSelect={handleComboTargetSelect}
          onCancel={handleCancelInteraction}
          title="Cat Combo! Steal From?"
          subtitle="Pick a player to steal a random card from."
        />
      )}

      {/* See the Future reveal */}
      {seeTheFutureCards && (
        <SeeTheFutureModal
          cards={seeTheFutureCards}
          onClose={() => setSeeTheFutureCards(null)}
        />
      )}

      {/* Toast notification */}
      {notification && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] pointer-events-none">
          <div className="bg-gray-800 border border-white/20 rounded-2xl px-6 py-3 shadow-2xl text-white text-sm font-semibold animate-bounce-once max-w-sm text-center">
            {notification}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Game over screen ──────────────────────────────────────────────────────────

function GameOverScreen({
  winner,
  isWinner,
  gameName,
  log,
  onPlayAgain,
}: {
  winner: string;
  isWinner: boolean;
  gameName: string;
  log: GameState['log'];
  onPlayAgain: () => void;
}) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md text-center">
        <div className="text-7xl mb-6">{isWinner ? '🏆' : '💥'}</div>
        <h1 className="text-white text-4xl font-bold mb-2">
          {isWinner ? "You Won!" : "Game Over"}
        </h1>
        <p className="text-white/60 text-lg mb-8">
          {isWinner ? `You survived ${gameName}!` : `${winner} survived!`}
        </p>

        <div className="bg-black/40 rounded-2xl p-4 border border-white/10 mb-8 max-h-48 overflow-y-auto text-left">
          <p className="text-white/40 text-xs uppercase tracking-wider mb-3">Final Log</p>
          {log.slice(-10).reverse().map((entry) => (
            <p key={entry.id} className="text-white/70 text-xs mb-1">{entry.message}</p>
          ))}
        </div>

        <button
          onClick={onPlayAgain}
          className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-8 py-4 rounded-2xl text-lg transition-all hover:scale-105"
        >
          🔗 Copy Link for New Game
        </button>
      </div>
    </div>
  );
}
