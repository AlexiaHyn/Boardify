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
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="mb-4 text-5xl">&#128270;</div>
          <p className="font-display text-xl tracking-wide text-[var(--color-cream)]">
            Game not found
          </p>
          <p className="font-body mt-2 text-sm text-[var(--color-stone-dim)]">
            No game matches &ldquo;{gameParam}&rdquo;
          </p>
          <Link
            href="/showcase"
            className="mt-6 inline-block font-body text-sm text-[var(--color-gold)] transition-colors hover:text-[var(--color-gold-bright)]"
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
    <main className="relative flex min-h-screen flex-col items-center px-4 py-12">
      {/* Backdrop */}
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background: `
            radial-gradient(ellipse 50% 35% at 50% 25%, rgba(201, 168, 76, 0.05) 0%, transparent 70%),
            linear-gradient(to bottom, var(--color-bg-deep) 0%, var(--color-bg-base) 100%)
          `,
        }}
      />

      <div className="relative z-10 flex w-full min-h-[calc(100vh-6rem)] flex-col items-center justify-center">
        {/* Nav */}
        <nav className="absolute left-0 right-0 top-0 flex items-center justify-between px-4 py-0">
          <Link
            href="/"
            className="font-display text-lg tracking-[0.12em] text-[var(--color-cream)]"
          >
            BOARDIFY
          </Link>
          <Link
            href="/showcase"
            className="font-body text-sm text-[var(--color-stone)] transition-colors hover:text-[var(--color-cream)]"
          >
            &#8592; All Games
          </Link>
        </nav>

        <div className="w-full max-w-md">
          {/* Game hero */}
          <div className="mb-8 text-center animate-fade-in-up">
            <div className="mb-3 text-6xl">{game.emoji}</div>
            <h1 className="font-display text-3xl font-semibold tracking-[0.08em] text-[var(--color-cream)]">
              {game.name}
            </h1>
            <p className="font-body mx-auto mt-2 max-w-sm text-sm font-light leading-relaxed text-[var(--color-stone)]">
              {game.description}
            </p>
            <p className="font-body mt-2 text-xs text-[var(--color-stone-dim)]">
              {game.playerCount}
            </p>
          </div>

          {/* Mode toggle */}
          <div className="mb-5 flex overflow-hidden rounded-lg border border-[var(--color-border)] animate-fade-in-up stagger-2">
            <button
              onClick={() => {
                setMode('create');
                setError('');
              }}
              className={`flex-1 py-2.5 font-display text-xs font-medium tracking-wider transition-all ${
                mode === 'create'
                  ? 'bg-[var(--color-gold-muted)] text-[var(--color-gold)] border-b-2 border-[var(--color-gold)]'
                  : 'bg-[var(--color-surface)] text-[var(--color-stone)] hover:text-[var(--color-cream)]'
              }`}
            >
              CREATE ROOM
            </button>
            <button
              onClick={() => {
                setMode('join');
                setError('');
              }}
              className={`flex-1 py-2.5 font-display text-xs font-medium tracking-wider transition-all ${
                mode === 'join'
                  ? 'bg-[var(--color-gold-muted)] text-[var(--color-gold)] border-b-2 border-[var(--color-gold)]'
                  : 'bg-[var(--color-surface)] text-[var(--color-stone)] hover:text-[var(--color-cream)]'
              }`}
            >
              JOIN ROOM
            </button>
          </div>

          {/* Form panel */}
          <div className="section-panel animate-fade-in-up stagger-3">
            <div className="section-panel-inner space-y-4">
              <div>
                <label className="form-label">Your Name</label>
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
                  className="form-input w-full"
                />
              </div>

              {mode === 'join' && (
                <div>
                  <label className="form-label">Room Code</label>
                  <input
                    type="text"
                    placeholder="e.g. ABC123"
                    value={roomCode}
                    onChange={(e) =>
                      setRoomCode(e.target.value.toUpperCase())
                    }
                    onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
                    maxLength={6}
                    className="form-input w-full font-mono text-xl text-center tracking-widest uppercase"
                  />
                </div>
              )}

              {error && (
                <div
                  className="rounded-lg border px-4 py-3 font-body text-sm"
                  style={{
                    borderColor: 'var(--color-crimson-dim)',
                    backgroundColor: 'rgba(184, 56, 75, 0.1)',
                    color: 'var(--color-crimson-bright)',
                  }}
                >
                  {error}
                </div>
              )}

              <button
                onClick={mode === 'create' ? handleCreate : handleJoin}
                disabled={loading}
                className="btn-press w-full rounded-lg bg-[var(--color-crimson)] py-3 font-display text-sm font-medium tracking-wider text-[var(--color-cream)] transition-all hover:bg-[var(--color-crimson-bright)] hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-40"
                style={{
                  boxShadow: loading
                    ? undefined
                    : '0 4px 16px rgba(184, 56, 75, 0.2)',
                }}
              >
                {loading
                  ? 'LOADING\u2026'
                  : mode === 'create'
                    ? 'CREATE ROOM'
                    : 'JOIN GAME'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

export default function RoomPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center font-body text-[var(--color-stone)]">
          Loading&hellip;
        </div>
      }
    >
      <RoomForm />
    </Suspense>
  );
}
