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
      <main className="relative flex min-h-screen items-center justify-center px-4 py-12">
        <div
          className="pointer-events-none fixed inset-0 z-0"
          style={{
            background: `
              radial-gradient(ellipse 50% 35% at 50% 35%, rgba(201, 168, 76, 0.04) 0%, transparent 70%),
              linear-gradient(to bottom, var(--color-bg-deep), var(--color-bg-base))
            `,
          }}
        />

        <div className="relative z-10 w-full max-w-md">
          <div className="mb-8 text-center animate-fade-in-up">
            <div className="mb-3 text-6xl">&#128279;</div>
            <h1 className="font-display text-2xl font-semibold tracking-[0.08em] text-[var(--color-cream)]">
              JOIN ROOM
            </h1>
            <p className="font-body mt-2 text-sm text-[var(--color-stone)]">
              Room{' '}
              <span className="font-mono text-[var(--color-gold)]">
                {roomCode}
              </span>
            </p>
          </div>

          <div className="section-panel animate-fade-in-up stagger-2">
            <div className="section-panel-inner space-y-4">
              <div>
                <label className="form-label">Your Name</label>
                <input
                  type="text"
                  placeholder="e.g. Player Two"
                  value={joinName}
                  onChange={(e) => setJoinName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
                  maxLength={20}
                  className="form-input w-full"
                />
              </div>

              {joinError && (
                <div
                  className="rounded-lg border px-4 py-3 font-body text-sm"
                  style={{
                    borderColor: 'var(--color-crimson-dim)',
                    backgroundColor: 'rgba(184, 56, 75, 0.1)',
                    color: 'var(--color-crimson-bright)',
                  }}
                >
                  {joinError}
                </div>
              )}

              <button
                onClick={handleJoin}
                disabled={joinLoading}
                className="btn-press w-full rounded-lg bg-[var(--color-crimson)] py-3 font-display text-sm font-medium tracking-wider text-[var(--color-cream)] transition-all hover:bg-[var(--color-crimson-bright)] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {joinLoading ? 'JOINING\u2026' : 'JOIN GAME'}
              </button>

              <Link
                href="/showcase"
                className="block py-2 text-center font-body text-sm text-[var(--color-stone-dim)] transition-colors hover:text-[var(--color-stone)]"
              >
                &#8592; Browse Games
              </Link>
            </div>
          </div>
        </div>
      </main>
    );
  }

  // Error state
  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="mb-4 text-5xl">&#10060;</div>
          <p className="font-display text-xl tracking-wide text-[var(--color-cream)]">
            Room not found
          </p>
          <p className="font-body mt-2 text-sm text-[var(--color-stone-dim)]">
            {error}
          </p>
          <Link
            href="/showcase"
            className="btn-press mt-6 inline-block rounded-lg bg-[var(--color-crimson)] px-6 py-3 font-display text-xs font-medium tracking-wider text-[var(--color-cream)]"
          >
            BROWSE GAMES
          </Link>
        </div>
      </main>
    );
  }

  // Loading state
  if (!playerId) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="relative flex items-center justify-center">
            <div className="absolute h-36 w-36 rounded-full border border-[var(--color-gold-dim)] opacity-20 animate-[radialPulse_2.5s_ease-in-out_infinite]" />
            <div className="absolute h-44 w-44 rounded-full border border-[var(--color-gold-dim)] opacity-10 animate-[radialPulse_2.5s_ease-in-out_infinite_0.5s]" />
            <svg
              width="80"
              height="80"
              viewBox="0 0 120 120"
              fill="none"
              className="animate-[compassSpin_8s_linear_infinite]"
            >
              <circle
                cx="60"
                cy="60"
                r="50"
                stroke="var(--color-gold)"
                strokeWidth="1.5"
                strokeDasharray="314"
                opacity="0.6"
              />
              <circle
                cx="60"
                cy="60"
                r="35"
                stroke="var(--color-gold-dim)"
                strokeWidth="1"
                strokeDasharray="220"
                opacity="0.4"
              />
              <line x1="60" y1="60" x2="60" y2="15" stroke="var(--color-gold)" strokeWidth="2" strokeLinecap="round" opacity="0.8" />
              <line x1="60" y1="60" x2="60" y2="105" stroke="var(--color-gold-dim)" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
              <line x1="60" y1="60" x2="105" y2="60" stroke="var(--color-gold-dim)" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
              <line x1="60" y1="60" x2="15" y2="60" stroke="var(--color-gold-dim)" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
              <circle cx="60" cy="60" r="3" fill="var(--color-gold)" />
            </svg>
          </div>
          <p className="font-body mt-8 text-sm tracking-widest text-[var(--color-gold)] animate-pulse-glow">
            Connecting&hellip;
          </p>
        </div>
      </main>
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
