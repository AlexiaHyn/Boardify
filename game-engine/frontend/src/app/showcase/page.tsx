'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { GAMES, type GameConfig } from '@/lib/games';

/* ─── Decorative Diamond ──────────────────────────────────────────── */

function Diamond({ className = '' }: { className?: string }) {
  return (
    <svg width="8" height="8" viewBox="0 0 8 8" className={className}>
      <path d="M4 0L8 4L4 8L0 4Z" fill="currentColor" />
    </svg>
  );
}

/* ─── Page ────────────────────────────────────────────────────────── */

export default function ShowcasePage() {
  // Re-read GAMES on the client so localStorage-hydrated entries appear
  const [games, setGames] = useState<GameConfig[]>([]);
  useEffect(() => {
    setGames([...GAMES]);
  }, []);

  return (
    <main className="relative min-h-screen px-4 py-12">
      {/* Backdrop */}
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background: `
            radial-gradient(ellipse 60% 40% at 50% 20%, rgba(201, 168, 76, 0.04) 0%, transparent 70%),
            linear-gradient(to bottom, var(--color-bg-deep) 0%, var(--color-bg-base) 100%)
          `,
        }}
      />

      <div className="relative z-10 mx-auto max-w-5xl">
        {/* Nav */}
        <nav className="mb-12 flex items-center justify-between">
          <Link
            href="/"
            className="font-display text-lg tracking-[0.12em] text-[var(--color-cream)]"
          >
            BOARDIFY
          </Link>
          <Link
            href="/"
            className="font-body text-sm text-[var(--color-stone)] transition-colors hover:text-[var(--color-cream)]"
          >
            &#8592; Back
          </Link>
        </nav>

        {/* Header */}
        <div className="mb-14 text-center animate-fade-in-up">
          <div className="mb-4 flex items-center justify-center gap-3">
            <div className="h-px w-12 bg-gradient-to-r from-transparent to-[var(--color-gold-dim)] opacity-50" />
            <Diamond className="text-[var(--color-gold)] opacity-50" />
            <div className="h-px w-12 bg-gradient-to-l from-transparent to-[var(--color-gold-dim)] opacity-50" />
          </div>

          <h1 className="font-display text-3xl font-semibold tracking-[0.12em] text-[var(--color-cream)] sm:text-4xl">
            GAME SHOWCASE
          </h1>

          <p className="font-body mt-3 text-base font-light text-[var(--color-stone)]">
            Choose a game and start playing with friends.
          </p>

          <div className="mt-4 flex items-center justify-center gap-3">
            <div className="h-px w-16 bg-gradient-to-r from-transparent to-[var(--color-gold-dim)] opacity-40" />
            <Diamond className="text-[var(--color-gold-dim)] opacity-40" />
            <div className="h-px w-16 bg-gradient-to-l from-transparent to-[var(--color-gold-dim)] opacity-40" />
          </div>
        </div>

        {/* Game Cards */}
        {games.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 animate-fade-in">
            <div className="text-5xl mb-6 opacity-40">🎲</div>
            <p className="font-display text-lg tracking-wide text-[var(--color-stone)] mb-2">
              No games installed yet
            </p>
            <p className="font-body text-sm text-[var(--color-stone-dim)] mb-8 text-center max-w-sm">
              Generate your first game from the home page and it will appear here.
            </p>
            <Link
              href="/"
              className="btn-press flex items-center gap-2 rounded-lg border border-[var(--color-gold-dim)] px-6 py-3 font-display text-xs font-medium tracking-wider text-[var(--color-gold)] transition-all hover:border-[var(--color-gold)] hover:bg-[var(--color-gold-muted)] hover:text-[var(--color-gold-bright)]"
            >
              CREATE A GAME
              <span className="text-sm">&#8594;</span>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 pb-24 md:grid-cols-3">
            {games.map((game, i) => (
              <Link
                key={game.id}
                href={`/room?game=${game.gameType}`}
                className={`playing-card group animate-card-deal stagger-${i + 1}`}
              >
                {/* Color band */}
                <div className="playing-card-band playing-card-band--gold" />

                <div className="p-6">
                  {/* Emoji */}
                  <div className="mb-4 text-4xl transition-transform duration-300 group-hover:scale-110 origin-left">
                    {game.emoji}
                  </div>

                  {/* Name */}
                  <h2 className="font-display mb-2 text-xl font-semibold tracking-wide text-[var(--color-cream)]">
                    {game.name}
                  </h2>

                  {/* Description */}
                  <p className="font-body mb-5 text-sm font-light leading-relaxed text-[var(--color-stone)]">
                    {game.description}
                  </p>

                  {/* Footer */}
                  <div className="flex items-center justify-between">
                    <span className="font-body text-xs text-[var(--color-stone-dim)]">
                      {game.playerCount}
                    </span>
                    <span className="font-display text-[10px] font-medium tracking-wider text-[var(--color-gold-dim)] transition-colors group-hover:text-[var(--color-gold)]">
                      PLAY &#8594;
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
