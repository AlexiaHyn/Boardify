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
import { DefaultActionButtons } from '@/components/game/DefaultActionButtons';

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

  const { loading, error, drawCard, playCard, playCombo, playNope, selectTarget, insertExploding, giveCard, respondToPendingAction, executeDefaultAction } =
    useGameActions({ roomCode, playerId, gameState });

  const localPlayer = gameState?.players.find((p) => p.id === playerId);

  // ── Card interaction flow ──────────────────────────────────────────────────

  const handleCardClick = (card: Card) => {
    if (!gameState || !localPlayer) return;
    const isMyTurn = gameState.currentTurnPlayerId === playerId;
    const isPlaying = gameState.phase === 'playing';

    if (
      card.subtype === 'nope' &&
      gameState.phase === 'awaiting_response' &&
      gameState.pendingAction?.type !== 'insert_exploding'
    ) {
      playNope(card.id);
      return;
    }

    if (!isMyTurn || !isPlaying) return;

    const COMBO_SUBTYPES = ['taco', 'rainbow', 'beard', 'potato', 'cattermelon'];
    if (COMBO_SUBTYPES.includes(card.subtype ?? '')) {
      if (interaction.mode === 'select_combo_pair') {
        if (
          interaction.firstCard.subtype === card.subtype &&
          interaction.firstCard.id !== card.id
        ) {
          setInteraction({ mode: 'select_combo_target', firstCard: interaction.firstCard, secondCard: card });
        } else {
          setInteraction({ mode: 'select_combo_pair', firstCard: card });
          showNotif('Pick a matching cat card to pair with!');
        }
      } else {
        setInteraction({ mode: 'select_combo_pair', firstCard: card });
        showNotif(`Pick another ${card.name} to pair with it!`);
      }
      return;
    }

    if (card.subtype === 'favor') {
      setInteraction({ mode: 'select_favor_target', card });
      return;
    }

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
    const url = window.location.href;
    navigator.clipboard.writeText(url).catch(() => {});
  };

  // ── Render ────────────────────────────────────────────────────────────────

  if (!gameState) {
    return (
      <div className="min-h-screen bg-[var(--color-bg-deep)] flex items-center justify-center">
        <div className="text-center">
          <div className="relative flex items-center justify-center mb-8">
            <div className="absolute h-28 w-28 rounded-full border border-[var(--color-gold-dim)] opacity-20 animate-[radialPulse_2.5s_ease-in-out_infinite]" />
            <svg width="60" height="60" viewBox="0 0 120 120" fill="none" className="animate-[compassSpin_8s_linear_infinite]">
              <circle cx="60" cy="60" r="50" stroke="var(--color-gold)" strokeWidth="1.5" strokeDasharray="314" opacity="0.6" />
              <line x1="60" y1="60" x2="60" y2="15" stroke="var(--color-gold)" strokeWidth="2" strokeLinecap="round" opacity="0.8" />
              <line x1="60" y1="60" x2="60" y2="105" stroke="var(--color-gold-dim)" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
              <line x1="60" y1="60" x2="105" y2="60" stroke="var(--color-gold-dim)" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
              <line x1="60" y1="60" x2="15" y2="60" stroke="var(--color-gold-dim)" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
              <circle cx="60" cy="60" r="3" fill="var(--color-gold)" />
            </svg>
          </div>
          <p className="font-display text-lg tracking-wider text-[var(--color-cream)]">Connecting&hellip;</p>
          <p className="font-body text-sm text-[var(--color-stone-dim)] mt-2">
            {connected ? 'Connected!' : 'Establishing connection\u2026'}
          </p>
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
    <div className="min-h-screen bg-[var(--color-bg-deep)] text-[var(--color-cream)] flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-3 border-b border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="flex items-center gap-3">
          <span className="text-xl">&#9824;</span>
          <span className="font-display font-semibold text-lg tracking-wide text-[var(--color-cream)]">{gameState.gameName}</span>
          <span className="bg-[var(--color-gold-muted)] rounded-full px-3 py-0.5 text-xs font-mono text-[var(--color-gold)]">
            {gameState.roomCode}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span
            className={`w-2 h-2 rounded-full ${connected ? 'bg-[var(--color-verdant)]' : 'bg-[var(--color-crimson)] animate-pulse'}`}
          />
          <span className="font-body text-[var(--color-stone-dim)] text-xs">{connected ? 'Connected' : 'Reconnecting\u2026'}</span>
        </div>
      </header>

      {/* Main game area */}
      <main className="flex-1 flex flex-col gap-4 p-4 max-w-6xl mx-auto w-full">
        <GameTable
          gameState={gameState}
          localPlayerId={playerId}
          onDrawCard={drawCard}
          loading={loading}
        />

        <hr className="gold-divider" />

        {/* Local player stats (chips, score, etc.) from JSON-defined display fields */}
        {localPlayer && (() => {
          const uiCfg = (gameState.metadata?.uiConfig as Record<string, unknown>) ?? {};
          const playerFields = (uiCfg.playerDisplayFields as Array<{ key: string; label: string; icon?: string; format?: string; defaultValue?: string | number }>) ?? [];
          const pData = ((gameState.metadata?.playerData as Record<string, Record<string, unknown>>) ?? {})[playerId];
          if (playerFields.length > 0 && pData) {
            return (
              <div className="flex flex-wrap gap-2 justify-center">
                {playerFields.map((field) => {
                  const raw = pData[field.key];
                  const value = raw ?? field.defaultValue ?? (field.format === 'number' ? 0 : '—');
                  return (
                    <span
                      key={field.key}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)]"
                    >
                      {field.icon && <span className="text-sm">{field.icon}</span>}
                      <span className="font-body text-xs text-[var(--color-stone)]">{field.label}</span>
                      <span className="font-body text-sm font-bold text-[var(--color-gold)]">
                        {typeof value === 'number' ? value.toLocaleString() : String(value)}
                      </span>
                    </span>
                  );
                })}
              </div>
            );
          }
          return null;
        })()}

        {localPlayer && (
          <PlayerHand
            player={localPlayer}
            gameState={gameState}
            onPlayCard={handleCardClick}
            selectedCard={selectedCard}
            loading={loading}
          />
        )}

        <GameLog entries={gameState.log} />

        {error && (
          <div
            className="rounded-xl px-4 py-3 font-body text-sm border"
            style={{
              borderColor: 'var(--color-crimson-dim)',
              backgroundColor: 'rgba(184, 56, 75, 0.15)',
              color: 'var(--color-crimson-bright)',
            }}
          >
            &#9888;&#65039; {error}
          </div>
        )}
      </main>

      {/* Modals & overlays */}
      {localPlayer && (
        <PendingActionPanel
          gameState={gameState}
          localPlayerId={playerId}
          onInsertExploding={insertExploding}
          onGiveCard={giveCard}
          onSelectTarget={selectTarget}
          onPlayNope={playNope}
          onRespond={respondToPendingAction}
        />
      )}

      {/* Default action buttons (UNO call, catch UNO, etc.) */}
      {gameState.availableActions && gameState.availableActions.length > 0 && (
        <DefaultActionButtons
          actions={gameState.availableActions}
          onAction={executeDefaultAction}
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

      {seeTheFutureCards && (
        <SeeTheFutureModal
          cards={seeTheFutureCards}
          onClose={() => setSeeTheFutureCards(null)}
        />
      )}

      {/* Toast notification */}
      {notification && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] pointer-events-none">
          <div className="bg-[var(--color-surface)] border border-[var(--color-gold-dim)] rounded-2xl px-6 py-3 shadow-2xl font-body text-sm font-semibold text-[var(--color-cream)] animate-bounce-once max-w-sm text-center">
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
    <div className="min-h-screen bg-[var(--color-bg-deep)] flex items-center justify-center p-4">
      <div className="w-full max-w-md text-center animate-fade-in-up">
        <div className="text-7xl mb-6">{isWinner ? '&#127942;' : '&#128165;'}</div>
        <h1 className="font-display text-4xl font-semibold tracking-wide text-[var(--color-cream)] mb-2">
          {isWinner ? 'You Won!' : 'Game Over'}
        </h1>
        <p className="font-body text-lg text-[var(--color-stone)] mb-8">
          {isWinner ? `You survived ${gameName}!` : `${winner} survived!`}
        </p>

        <div className="section-panel mb-8 max-h-48 overflow-y-auto text-left">
          <div className="section-panel-inner">
            <p className="font-display text-[10px] font-semibold tracking-[0.1em] uppercase text-[var(--color-stone-dim)] mb-3">Final Log</p>
            {log.slice(-10).reverse().map((entry) => (
              <p key={entry.id} className="font-body text-[var(--color-stone)] text-xs mb-1">{entry.message}</p>
            ))}
          </div>
        </div>

        <button
          onClick={onPlayAgain}
          className="btn-press bg-[var(--color-crimson)] hover:bg-[var(--color-crimson-bright)] text-[var(--color-cream)] font-display font-medium tracking-wider px-8 py-4 rounded-xl text-sm transition-all hover:shadow-lg"
        >
          COPY LINK FOR NEW GAME
        </button>
      </div>
    </div>
  );
}
