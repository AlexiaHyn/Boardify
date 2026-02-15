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
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="text-6xl mb-4">🐱</div>
          <h1 className="text-white text-3xl font-bold">{gameState.gameName}</h1>
          <p className="text-white/60 mt-2">Waiting for players to join…</p>
        </div>

        {/* Room code */}
        <div className="bg-black/40 rounded-2xl p-6 border border-white/10 mb-6 text-center">
          <p className="text-white/40 text-xs uppercase tracking-widest mb-2">Room Code</p>
          <p className="text-5xl font-mono font-bold text-yellow-400 tracking-widest mb-4">
            {gameState.roomCode}
          </p>
          <button
            onClick={handleCopy}
            className="bg-blue-600 hover:bg-blue-500 text-white font-semibold px-6 py-2 rounded-xl transition-colors text-sm flex items-center gap-2 mx-auto"
          >
            {copied ? '✅ Copied!' : '🔗 Copy Invite Link'}
          </button>
        </div>

        {/* Players */}
        <div className="bg-black/40 rounded-2xl p-6 border border-white/10 mb-6">
          <div className="flex justify-between items-center mb-4">
            <p className="text-white font-semibold">
              Players ({gameState.players.length}/{gameState.rules.maxPlayers})
            </p>
            <p className="text-white/40 text-sm">
              Need {gameState.rules.minPlayers}–{gameState.rules.maxPlayers} to play
            </p>
          </div>
          <div className="space-y-2">
            {gameState.players.map((player) => (
              <div
                key={player.id}
                className="flex items-center gap-3 bg-white/5 rounded-xl px-4 py-3"
              >
                <span className="text-2xl">{player.emoji}</span>
                <div className="flex-1">
                  <p className="text-white font-semibold">
                    {player.name}
                    {player.id === localPlayerId && (
                      <span className="text-blue-400 text-xs ml-2">(You)</span>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {!!player.metadata?.isHost && (
                    <span className="bg-yellow-500/20 text-yellow-400 text-xs px-2 py-0.5 rounded-full border border-yellow-500/30">
                      Host
                    </span>
                  )}
                  <span
                    className={`w-2 h-2 rounded-full ${
                      player.isConnected ? 'bg-green-400' : 'bg-gray-600'
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
                  className="flex items-center gap-3 border-2 border-dashed border-white/10 rounded-xl px-4 py-3"
                >
                  <span className="text-2xl opacity-30">👤</span>
                  <p className="text-white/30 text-sm">Waiting for player…</p>
                </div>
              ),
            )}
          </div>
        </div>

        {/* Rules summary */}
        <div className="bg-black/40 rounded-2xl p-4 border border-white/10 mb-6">
          <p className="text-white/40 text-xs uppercase tracking-wider mb-3">How to Win</p>
          <p className="text-white/70 text-sm">{gameState.rules.winCondition.description}</p>
        </div>

        {/* Start button */}
        {isHost ? (
          <button
            onClick={onStart}
            disabled={!canStart || startLoading}
            className={`
              w-full py-4 rounded-2xl font-bold text-lg transition-all
              ${
                canStart && !startLoading
                  ? 'bg-green-500 hover:bg-green-400 text-white shadow-lg shadow-green-500/30 hover:scale-[1.02] active:scale-100'
                  : 'bg-gray-700 text-white/40 cursor-not-allowed'
              }
            `}
          >
            {startLoading ? '⏳ Starting…' : canStart ? '🚀 Start Game!' : `Need ${gameState.rules.minPlayers - gameState.players.length} more player(s)`}
          </button>
        ) : (
          <div className="text-center text-white/40 text-sm py-4">
            Waiting for the host to start the game…
          </div>
        )}
      </div>
    </div>
  );
}
