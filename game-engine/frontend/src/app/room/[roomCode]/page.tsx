'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { getRoomState, joinRoom } from '@/lib/api';
import type { GameState } from '@/types/game';
import { GameRoom } from '@/components/game/GameRoom';

export default function RoomCodePage() {
  const params = useParams();
  const roomCode = (params.roomCode as string).toUpperCase();

  const [playerId, setPlayerId] = useState<string | null>(null);
  const [initialState, setInitialState] = useState<GameState | null>(null);
  const [error, setError] = useState('');
  const [needsJoin, setNeedsJoin] = useState(false);

  // Join form state
  const [joinName, setJoinName] = useState('');
  const [joinLoading, setJoinLoading] = useState(false);
  const [joinError, setJoinError] = useState('');

  useEffect(() => {
    const stored = sessionStorage.getItem(`player_${roomCode}`);
    if (!stored) {
      setNeedsJoin(true);
      return;
    }
    setPlayerId(stored);

    getRoomState(roomCode)
      .then((state) => setInitialState(state))
      .catch((e) => setError((e as Error).message));
  }, [roomCode]);

  const handleJoin = async () => {
    if (!joinName.trim()) {
      setJoinError('Enter your name');
      return;
    }
    setJoinLoading(true);
    setJoinError('');
    try {
      const data = await joinRoom(roomCode, {
        player_name: joinName.trim(),
      });
      sessionStorage.setItem(`player_${data.roomCode}`, data.playerId);
      setPlayerId(data.playerId);
      setNeedsJoin(false);

      getRoomState(roomCode)
        .then((state) => setInitialState(state))
        .catch((e) => setError((e as Error).message));
    } catch (e) {
      setJoinError((e as Error).message);
    } finally {
      setJoinLoading(false);
    }
  };

  // Needs to join — inline join form
  if (needsJoin) {
    return (
      <div className="min-h-screen bg-[#07070A] relative overflow-hidden flex items-center justify-center p-4">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-blue-600/[0.05] rounded-full blur-[120px] pointer-events-none" />

        <div className="relative z-10 w-full max-w-md">
          <div className="text-center mb-8">
            <div className="text-6xl mb-4">🔗</div>
            <h1 className="font-display text-3xl font-bold text-white">
              Join Room
            </h1>
            <p className="text-zinc-500 mt-2">
              Room{' '}
              <span className="font-mono text-zinc-400">{roomCode}</span>
            </p>
          </div>

          <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-6 space-y-4">
            <div>
              <label className="text-zinc-500 text-sm block mb-2">
                Your Name
              </label>
              <input
                type="text"
                placeholder="e.g. Player Two"
                value={joinName}
                onChange={(e) => setJoinName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
                maxLength={20}
                className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-4 py-3 text-white placeholder:text-zinc-700 focus:outline-none focus:border-white/20 transition-colors"
              />
            </div>

            {joinError && (
              <p className="text-red-400 text-sm bg-red-900/20 rounded-lg px-3 py-2">
                {joinError}
              </p>
            )}

            <button
              onClick={handleJoin}
              disabled={joinLoading}
              className="w-full bg-blue-600 hover:bg-blue-500 font-bold py-4 rounded-2xl text-lg text-white transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-40"
            >
              {joinLoading ? 'Joining\u2026' : 'Join Game'}
            </button>

            <Link
              href="/showcase"
              className="block text-center text-zinc-600 hover:text-zinc-400 text-sm transition-colors py-2"
            >
              &#8592; Browse Games
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-[#07070A] flex items-center justify-center">
        <div className="text-center">
          <div className="text-5xl mb-4">&#10060;</div>
          <p className="text-white text-xl font-bold">Room not found</p>
          <p className="text-zinc-500 text-sm mt-2">{error}</p>
          <Link
            href="/showcase"
            className="mt-6 inline-block bg-blue-600 hover:bg-blue-500 text-white font-semibold px-6 py-3 rounded-xl transition-colors"
          >
            Browse Games
          </Link>
        </div>
      </div>
    );
  }

  // Loading state
  if (!playerId) {
    return (
      <div className="min-h-screen bg-[#07070A] flex items-center justify-center">
        <div className="text-white text-center">
          <div className="text-5xl animate-spin mb-4">&#9203;</div>
          <p className="text-xl">Loading&hellip;</p>
        </div>
      </div>
    );
  }

  // Game room
  return (
    <GameRoom
      roomCode={roomCode}
      playerId={playerId}
      initialState={initialState ?? undefined}
    />
  );
}
