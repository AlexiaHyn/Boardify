'use client';

import { useState } from 'react';
import type { GameState } from '@/types/game';

interface LobbyProps {
  gameState: GameState;
  localPlayerId: string;
  onStart: () => void;
  onCopyLink: () => void;
  startLoading?: boolean;
}

export function Lobby({ gameState, localPlayerId, onStart, onCopyLink, startLoading }: LobbyProps) {
  const [copied, setCopied] = useState(false);
  const isHost = gameState.metadata?.hostId === localPlayerId;
  const canStart =
    gameState.players.length >= gameState.rules.minPlayers &&
    gameState.players.length <= gameState.rules.maxPlayers;

  const handleCopy = () => {
    onCopyLink();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-[var(--color-bg-deep)] flex items-center justify-center p-4">
      {/* Warm glow */}
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background: `
            radial-gradient(ellipse 50% 35% at 50% 30%, rgba(201, 168, 76, 0.05) 0%, transparent 70%),
            linear-gradient(to bottom, var(--color-bg-deep), var(--color-bg-base))
          `,
        }}
      />

      <div className="relative z-10 w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-8 animate-fade-in-up">
          <div className="text-6xl mb-4">&#9824;</div>
          <h1 className="font-display text-3xl font-semibold tracking-[0.08em] text-[var(--color-cream)]">
            {gameState.gameName}
          </h1>
          <p className="font-body mt-2 text-[var(--color-stone)]">Waiting for players to join&hellip;</p>
        </div>

        {/* Room code */}
        <div className="section-panel mb-6 text-center animate-fade-in-up stagger-1">
          <div className="section-panel-inner">
            <p className="font-display text-[10px] font-semibold tracking-[0.15em] uppercase text-[var(--color-stone-dim)] mb-2">
              Room Code
            </p>
            <p className="text-5xl font-mono font-bold text-[var(--color-gold)] tracking-widest mb-4">
              {gameState.roomCode}
            </p>
            <button
              onClick={handleCopy}
              className="btn-press bg-[var(--color-crimson)] hover:bg-[var(--color-crimson-bright)] text-[var(--color-cream)] font-display font-medium text-xs tracking-wider px-6 py-2 rounded-lg transition-all flex items-center gap-2 mx-auto"
            >
              {copied ? 'COPIED!' : 'COPY INVITE LINK'}
            </button>
          </div>
        </div>

        {/* Players */}
        <div className="section-panel mb-6 animate-fade-in-up stagger-2">
          <div className="section-panel-inner">
            <div className="flex justify-between items-center mb-4">
              <p className="font-display text-sm font-semibold tracking-wide text-[var(--color-cream)]">
                Players ({gameState.players.length}/{gameState.rules.maxPlayers})
              </p>
              <p className="font-body text-xs text-[var(--color-stone-dim)]">
                Need {gameState.rules.minPlayers}&ndash;{gameState.rules.maxPlayers} to play
              </p>
            </div>
            <div className="space-y-2">
              {gameState.players.map((player) => (
                <div
                  key={player.id}
                  className="flex items-center gap-3 bg-[var(--color-bg-deep)] rounded-xl px-4 py-3 border border-[var(--color-border-subtle)]"
                >
                  <span className="text-2xl">{player.emoji}</span>
                  <div className="flex-1">
                    <p className="font-body font-semibold text-[var(--color-cream)]">
                      {player.name}
                      {player.id === localPlayerId && (
                        <span className="text-[var(--color-gold)] text-xs ml-2">(You)</span>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {!!player.metadata?.isHost && (
                      <span className="bg-[var(--color-gold-muted)] text-[var(--color-gold)] text-xs px-2 py-0.5 rounded-full border border-[var(--color-gold-dim)]">
                        Host
                      </span>
                    )}
                    <span
                      className={`w-2 h-2 rounded-full ${
                        player.isConnected ? 'bg-[var(--color-verdant)]' : 'bg-[var(--color-stone-dim)]'
                      }`}
                    />
                  </div>
                </div>
              ))}

              {/* Empty slots */}
              {Array.from({ length: gameState.rules.maxPlayers - gameState.players.length }).map(
                (_, i) => (
                  <div
                    key={`empty-${i}`}
                    className="flex items-center gap-3 border-2 border-dashed border-[var(--color-border)] rounded-xl px-4 py-3"
                  >
                    <span className="text-2xl opacity-30">&#128100;</span>
                    <p className="font-body text-sm text-[var(--color-stone-dim)]">Waiting for player&hellip;</p>
                  </div>
                ),
              )}
            </div>
          </div>
        </div>

        {/* Rules summary */}
        <div className="section-panel mb-6 animate-fade-in-up stagger-3">
          <div className="section-panel-inner">
            <p className="font-display text-[10px] font-semibold tracking-[0.1em] uppercase text-[var(--color-stone-dim)] mb-3">
              How to Win
            </p>
            <p className="font-body text-sm text-[var(--color-stone)]">{gameState.rules.winCondition.description}</p>
          </div>
        </div>

        {/* Start button */}
        {isHost ? (
          <button
            onClick={onStart}
            disabled={!canStart || startLoading}
            className={`
              btn-press w-full py-4 rounded-xl font-display font-medium text-sm tracking-wider transition-all animate-fade-in-up stagger-4
              ${
                canStart && !startLoading
                  ? 'bg-[var(--color-verdant)] hover:bg-[var(--color-verdant-bright)] text-[var(--color-cream)] shadow-lg hover:shadow-xl'
                  : 'bg-[var(--color-surface)] text-[var(--color-stone-dim)] cursor-not-allowed border border-[var(--color-border)]'
              }
            `}
          >
            {startLoading
              ? 'STARTING\u2026'
              : canStart
                ? 'START GAME'
                : `NEED ${gameState.rules.minPlayers - gameState.players.length} MORE PLAYER(S)`}
          </button>
        ) : (
          <div className="text-center font-body text-sm text-[var(--color-stone-dim)] py-4 animate-fade-in stagger-4">
            Waiting for the host to start the game&hellip;
          </div>
        )}
      </div>
    </div>
  );
}
