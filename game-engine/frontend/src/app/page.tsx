'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

/* ─── Example prompts for typing animation ─────────────────────────── */

const EXAMPLE_PROMPTS = [
  'Exploding Kittens with 5 diffuser cards',
  'A bluffing game for 4 players with hidden roles',
  'Uno but every card has a spell effect',
  'Cooperative survival horror card game',
  'Poker meets deck-building with fantasy creatures',
  'A fast 2-player dueling card game',
];

/* ─── Typing Animation Hook ───────────────────────────────────────── */

function useTypingAnimation(
  phrases: string[],
  typingSpeed = 45,
  deletingSpeed = 25,
  pauseMs = 2200,
) {
  const [display, setDisplay] = useState('');
  const [phraseIdx, setPhraseIdx] = useState(0);
  const [charIdx, setCharIdx] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const current = phrases[phraseIdx] ?? '';

    if (!isDeleting && charIdx <= current.length) {
      if (charIdx === current.length) {
        const timeout = setTimeout(() => setIsDeleting(true), pauseMs);
        return () => clearTimeout(timeout);
      }
      const timeout = setTimeout(() => {
        setDisplay(current.slice(0, charIdx + 1));
        setCharIdx((c) => c + 1);
      }, typingSpeed);
      return () => clearTimeout(timeout);
    }

    if (isDeleting && charIdx > 0) {
      const timeout = setTimeout(() => {
        setDisplay(current.slice(0, charIdx - 1));
        setCharIdx((c) => c - 1);
      }, deletingSpeed);
      return () => clearTimeout(timeout);
    }

    if (isDeleting && charIdx === 0) {
      setIsDeleting(false);
      setPhraseIdx((i) => (i + 1) % phrases.length);
    }
  }, [charIdx, isDeleting, phraseIdx, phrases, typingSpeed, deletingSpeed, pauseMs]);

  return display;
}

/* ─── Decorative Diamond ──────────────────────────────────────────── */

function Diamond({ className = '' }: { className?: string }) {
  return (
    <svg width="8" height="8" viewBox="0 0 8 8" className={className}>
      <path d="M4 0L8 4L4 8L0 4Z" fill="currentColor" />
    </svg>
  );
}

/* ─── Page ────────────────────────────────────────────────────────── */

export default function HomePage() {
  const [prompt, setPrompt] = useState('');
  const typedText = useTypingAnimation(EXAMPLE_PROMPTS);

  const [inputFocused, setInputFocused] = useState(false);
  const showAnimatedPlaceholder = !inputFocused && prompt.length === 0;

  return (
    <main className="relative flex min-h-screen flex-col items-center px-4 py-12">
      {/* Warm radial glow backdrop */}
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background: `
            radial-gradient(ellipse 60% 40% at 50% 30%, rgba(201, 168, 76, 0.06) 0%, transparent 70%),
            radial-gradient(ellipse 80% 50% at 50% 100%, rgba(30, 26, 38, 0.8) 0%, transparent 60%),
            linear-gradient(to bottom, var(--color-bg-deep) 0%, var(--color-bg-base) 100%)
          `,
        }}
      />

      {/* Content layer */}
      <div className="relative z-10 flex w-full min-h-[calc(100vh-6rem)] flex-col items-center justify-center">
        {/* Header */}
        <div className="text-center animate-fade-in-up">
          {/* Decorative top element */}
          <div className="mb-4 flex items-center justify-center gap-3">
            <div className="h-px w-12 bg-gradient-to-r from-transparent to-[var(--color-gold-dim)] opacity-50" />
            <Diamond className="text-[var(--color-gold)] opacity-50" />
            <div className="h-px w-12 bg-gradient-to-l from-transparent to-[var(--color-gold-dim)] opacity-50" />
          </div>

          <h1 className="font-display text-5xl font-semibold tracking-[0.15em] text-[var(--color-cream)] sm:text-7xl">
            BOARDIFY
          </h1>

          <p className="font-body mt-4 text-lg font-light tracking-wide text-[var(--color-stone)]">
            Describe a card game idea and watch it come to life.
          </p>

          {/* Decorative bottom element */}
          <div className="mt-4 flex items-center justify-center gap-3">
            <div className="h-px w-16 bg-gradient-to-r from-transparent to-[var(--color-gold-dim)] opacity-40" />
            <Diamond className="text-[var(--color-gold-dim)] opacity-40" />
            <div className="h-px w-16 bg-gradient-to-l from-transparent to-[var(--color-gold-dim)] opacity-40" />
          </div>
        </div>

        {/* Input form */}
        <form
          onSubmit={(e) => e.preventDefault()}
          className="mt-10 w-full max-w-2xl animate-fade-in-up stagger-2"
        >
          <div className="relative">
            {/* Ornamental input wrapper */}
            <div className="relative overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-lg shadow-black/20">
              <div className="flex items-center">
                {/* Compass icon */}
                <div className="flex shrink-0 items-center justify-center pl-5">
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="var(--color-gold-dim)"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <polygon
                      points="16.24,7.76 14.12,14.12 7.76,16.24 9.88,9.88"
                      fill="var(--color-gold-muted)"
                      stroke="var(--color-gold-dim)"
                    />
                  </svg>
                </div>

                {/* Input with animated placeholder */}
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    onFocus={() => setInputFocused(true)}
                    onBlur={() => setInputFocused(false)}
                    className="input-naked font-body relative z-10 w-full border-none bg-transparent px-4 py-4 text-base text-[var(--color-cream)] outline-none"
                  />
                  {/* Animated typing placeholder */}
                  {showAnimatedPlaceholder && (
                    <div className="pointer-events-none absolute inset-0 flex items-center px-4">
                      <span className="font-body text-base font-light text-[var(--color-stone-dim)]">
                        {typedText}
                      </span>
                      <span className="ml-[1px] inline-block h-[1.1em] w-[2px] translate-y-[1px] animate-blink bg-[var(--color-gold-dim)]" />
                    </div>
                  )}
                </div>

                <div className="pr-2">
                  <button
                    type="submit"
                    disabled
                    className="btn-press rounded-lg bg-[var(--color-crimson)] px-6 py-2.5 font-display text-sm font-medium tracking-wider text-[var(--color-cream)] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    GENERATE
                  </button>
                </div>
              </div>
            </div>

            {/* Subtle glow under input */}
            <div className="absolute -bottom-4 left-1/2 h-8 w-3/4 -translate-x-1/2 rounded-full bg-[var(--color-gold)] opacity-[0.03] blur-xl" />
          </div>

          {/* Suggestion chips */}
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2 animate-fade-in stagger-4">
            <span className="font-body text-xs text-[var(--color-stone-dim)]">
              Or try:
            </span>
            {[
              'A bluffing game for 4 players',
              'Uno but with spell cards',
              'Cooperative survival card game',
            ].map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => setPrompt(suggestion)}
                className="btn-press rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1 font-body text-xs text-[var(--color-stone)] transition-all hover:border-[var(--color-gold-dim)] hover:text-[var(--color-cream)]"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </form>

        {/* Coming soon notice */}
        <p className="mt-3 font-body text-xs italic text-[var(--color-stone-dim)] animate-fade-in stagger-5">
          Game generation coming soon
        </p>

        {/* Divider */}
        <div className="mt-12 flex w-full max-w-md items-center gap-4 animate-fade-in stagger-6">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-[var(--color-gold-dim)] to-transparent opacity-30" />
          <span className="font-display text-[10px] tracking-[0.2em] uppercase text-[var(--color-stone-dim)]">
            or play now
          </span>
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-[var(--color-gold-dim)] to-transparent opacity-30" />
        </div>

        {/* Browse Games CTA */}
        <Link
          href="/showcase"
          className="mt-6 btn-press flex items-center gap-2 rounded-lg border border-[var(--color-gold-dim)] px-6 py-3 font-display text-xs font-medium tracking-wider text-[var(--color-gold)] transition-all hover:border-[var(--color-gold)] hover:bg-[var(--color-gold-muted)] hover:text-[var(--color-gold-bright)] animate-fade-in stagger-7"
        >
          BROWSE GAMES
          <span className="text-sm">&#8594;</span>
        </Link>
      </div>
    </main>
  );
}
