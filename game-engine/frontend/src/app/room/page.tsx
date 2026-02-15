'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { getGameByType } from '@/lib/games';
import { createRoom, joinRoom } from '@/lib/api';

function RoomForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const gameParam = searchParams.get('game') ?? '';
  const game = getGameByType(gameParam);

  const [mode, setMode] = useState<'create' | 'join'>('create');
  const [name, setName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!game) {
    return (
      <div className="min-h-screen bg-[#07070A] flex items-center justify-center">
        <div className="text-center">
          <div className="text-5xl mb-4">🔍</div>
          <p className="text-white text-xl font-bold">Game not found</p>
          <p className="text-zinc-500 text-sm mt-2">
            No game matches &ldquo;{gameParam}&rdquo;
          </p>
          <Link
            href="/showcase"
            className="mt-6 inline-block text-zinc-400 hover:text-white transition-colors"
          >
            &#8592; Browse Games
          </Link>
        </div>
      </div>
    );
  }

  const handleCreate = async () => {
    if (!name.trim()) {
      setError('Enter your name');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const data = await createRoom({
        host_name: name.trim(),
        game_type: game.gameType,
      });
      sessionStorage.setItem(`player_${data.roomCode}`, data.playerId);
      router.push(`/room/${data.roomCode}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    if (!name.trim()) {
      setError('Enter your name');
      return;
    }
    if (!roomCode.trim()) {
      setError('Enter a room code');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const data = await joinRoom(roomCode.trim().toUpperCase(), {
        player_name: name.trim(),
      });
      sessionStorage.setItem(`player_${data.roomCode}`, data.playerId);
      router.push(`/room/${data.roomCode}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#07070A] relative overflow-hidden">
      {/* Game-colored ambient glow */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] rounded-full blur-[150px] pointer-events-none"
        style={{ backgroundColor: `rgba(${game.accentColorRgb}, 0.06)` }}
      />

      <div className="relative z-10 min-h-screen flex flex-col">
        {/* Nav */}
        <nav className="flex items-center justify-between px-8 py-6">
          <Link
            href="/"
            className="font-display text-xl font-bold text-white tracking-tight"
          >
            Boardify
          </Link>
          <Link
            href="/showcase"
            className="text-zinc-400 hover:text-white transition-colors text-sm font-medium"
          >
            &#8592; All Games
          </Link>
        </nav>

        {/* Main */}
        <div className="flex-1 flex items-center justify-center px-4 pb-16">
          <div className="w-full max-w-md">
            {/* Game hero */}
            <div className="text-center mb-10">
              <div className="text-7xl mb-4">{game.emoji}</div>
              <h1 className="font-display text-4xl font-extrabold text-white tracking-tight mb-2">
                {game.name}
              </h1>
              <p className="text-zinc-500 mt-2 leading-relaxed max-w-sm mx-auto">
                {game.description}
              </p>
              <p className="text-zinc-600 text-sm mt-3">{game.playerCount}</p>
            </div>

            {/* Mode toggle */}
            <div className="flex bg-white/[0.03] border border-white/[0.08] rounded-xl p-1 mb-6">
              <button
                onClick={() => {
                  setMode('create');
                  setError('');
                }}
                className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                  mode === 'create'
                    ? 'bg-white/[0.08] text-white'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                Create Room
              </button>
              <button
                onClick={() => {
                  setMode('join');
                  setError('');
                }}
                className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                  mode === 'join'
                    ? 'bg-white/[0.08] text-white'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                Join Room
              </button>
            </div>

            {/* Form */}
            <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-6 space-y-4">
              <div>
                <label className="text-zinc-500 text-sm block mb-2">
                  Your Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. PlayerOne"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) =>
                    e.key === 'Enter' &&
                    (mode === 'create' ? handleCreate() : handleJoin())
                  }
                  maxLength={20}
                  className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-4 py-3 text-white placeholder:text-zinc-700 focus:outline-none focus:border-white/20 transition-colors"
                />
              </div>

              {mode === 'join' && (
                <div>
                  <label className="text-zinc-500 text-sm block mb-2">
                    Room Code
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. ABC123"
                    value={roomCode}
                    onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                    onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
                    maxLength={6}
                    className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-4 py-3 text-white placeholder:text-zinc-700 font-mono text-xl text-center tracking-widest focus:outline-none focus:border-white/20 transition-colors uppercase"
                  />
                </div>
              )}

              {error && (
                <p className="text-red-400 text-sm bg-red-900/20 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}

              <button
                onClick={mode === 'create' ? handleCreate : handleJoin}
                disabled={loading}
                className="w-full font-bold py-4 rounded-2xl text-lg transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-40 disabled:hover:brightness-100"
                style={{
                  backgroundColor: game.accentColor,
                  color: 'white',
                }}
              >
                {loading
                  ? 'Loading\u2026'
                  : mode === 'create'
                    ? 'Create Room'
                    : 'Join Game'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function RoomPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#07070A] flex items-center justify-center text-white">
          Loading&hellip;
        </div>
      }
    >
      <RoomForm />
    </Suspense>
  );
}
