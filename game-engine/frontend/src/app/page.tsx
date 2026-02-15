'use client';

import Link from 'next/link';
import { useState } from 'react';

export default function ImaginePage() {
  const [prompt, setPrompt] = useState('');

  return (
    <div className="min-h-screen bg-[#07070A] relative overflow-hidden">
      {/* Layered atmospheric gradients */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-violet-600/[0.07] rounded-full blur-[120px]" />
        <div className="absolute bottom-0 right-0 w-[600px] h-[400px] bg-amber-600/[0.04] rounded-full blur-[100px]" />
      </div>

      {/* Subtle grid texture */}
      <div
        className="absolute inset-0 opacity-[0.015] pointer-events-none"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.15) 1px, transparent 1px)',
          backgroundSize: '72px 72px',
        }}
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
            className="text-zinc-400 hover:text-white transition-colors text-sm font-medium flex items-center gap-1.5"
          >
            Browse Games <span className="text-lg leading-none">&#8594;</span>
          </Link>
        </nav>

        {/* Main content */}
        <div className="flex-1 flex items-center justify-center px-4 pb-24">
          <div className="w-full max-w-2xl">
            {/* Heading */}
            <div className="text-center mb-12">
              <p className="text-violet-400/80 text-sm font-semibold tracking-[0.2em] uppercase mb-5">
                Dream it up
              </p>
              <h1 className="font-display text-5xl sm:text-6xl md:text-7xl font-extrabold text-white leading-[0.95] tracking-tight mb-6">
                Imagine
                <br />
                a Game
              </h1>
              <p className="text-zinc-500 text-lg max-w-md mx-auto leading-relaxed">
                Describe your dream board game and we&apos;ll bring it to life.
                Any rules, any theme, any world.
              </p>
            </div>

            {/* Input area */}
            <div className="space-y-4">
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="A card game where mythical creatures battle across elemental realms..."
                rows={4}
                className="w-full bg-white/[0.03] border border-white/[0.08] rounded-2xl px-6 py-5 text-white placeholder:text-zinc-600 focus:outline-none focus:border-violet-500/40 focus:bg-white/[0.05] transition-all duration-300 resize-none text-lg leading-relaxed"
              />
              <button
                disabled
                className="w-full bg-violet-600/30 border border-violet-500/20 text-violet-300/50 cursor-not-allowed font-bold py-4 rounded-2xl text-lg tracking-wide"
              >
                Generate Game &mdash; Coming Soon
              </button>
            </div>

            {/* Divider */}
            <div className="mt-16 flex items-center gap-4">
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
              <span className="text-zinc-600 text-xs font-medium tracking-wider uppercase">
                or play now
              </span>
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
            </div>

            {/* Browse games CTA */}
            <div className="mt-8 text-center">
              <Link
                href="/showcase"
                className="inline-flex items-center gap-3 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] hover:border-white/[0.15] text-white px-8 py-4 rounded-2xl transition-all duration-300 font-semibold group"
              >
                Browse Available Games
                <span className="text-zinc-500 group-hover:text-white group-hover:translate-x-0.5 transition-all">
                  &#8594;
                </span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
