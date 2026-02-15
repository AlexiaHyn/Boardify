'use client';

import Link from 'next/link';
import { GAMES } from '@/lib/games';

export default function ShowcasePage() {
  return (
    <div className="min-h-screen bg-[#07070A] relative">
      {/* Ambient glows */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-0 w-[500px] h-[400px] bg-violet-600/[0.04] rounded-full blur-[100px]" />
        <div className="absolute bottom-0 right-0 w-[500px] h-[400px] bg-amber-600/[0.04] rounded-full blur-[100px]" />
      </div>

      <div className="relative z-10">
        {/* Nav */}
        <nav className="flex items-center justify-between px-8 py-6">
          <Link
            href="/"
            className="font-display text-xl font-bold text-white tracking-tight"
          >
            Boardify
          </Link>
          <Link
            href="/"
            className="text-zinc-400 hover:text-white transition-colors text-sm font-medium"
          >
            &#8592; Back
          </Link>
        </nav>

        {/* Header */}
        <div className="text-center pt-12 pb-16 px-4">
          <p className="text-amber-400/80 text-sm font-semibold tracking-[0.2em] uppercase mb-5">
            Ready to play
          </p>
          <h1 className="font-display text-4xl sm:text-5xl font-extrabold text-white tracking-tight mb-4">
            Game Showcase
          </h1>
          <p className="text-zinc-500 text-lg max-w-md mx-auto">
            Choose a game and start playing with friends instantly.
          </p>
        </div>

        {/* Game grid */}
        <div className="max-w-5xl mx-auto px-6 pb-24">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {GAMES.map((game) => (
              <Link
                key={game.id}
                href={`/room?game=${game.gameType}`}
                className="group relative bg-white/[0.02] border border-white/[0.06] rounded-3xl p-8 hover:bg-white/[0.04] hover:border-white/[0.12] transition-all duration-500 overflow-hidden"
              >
                {/* Accent glow on hover */}
                <div
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-3xl"
                  style={{
                    background: `radial-gradient(ellipse at top, rgba(${game.accentColorRgb}, 0.08), transparent 70%)`,
                  }}
                />

                <div className="relative z-10">
                  {/* Emoji */}
                  <div className="text-5xl mb-6 group-hover:scale-110 transition-transform duration-500 origin-left">
                    {game.emoji}
                  </div>

                  {/* Name */}
                  <h2 className="font-display text-2xl font-bold text-white mb-3 tracking-tight">
                    {game.name}
                  </h2>

                  {/* Description */}
                  <p className="text-zinc-500 text-sm leading-relaxed mb-6">
                    {game.description}
                  </p>

                  {/* Footer */}
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-600 text-xs font-medium">
                      {game.playerCount}
                    </span>
                    <span
                      className="text-xs font-semibold px-3 py-1 rounded-full border transition-colors duration-300"
                      style={{
                        color: game.accentColor,
                        borderColor: `rgba(${game.accentColorRgb}, 0.3)`,
                        backgroundColor: `rgba(${game.accentColorRgb}, 0.08)`,
                      }}
                    >
                      Play &#8594;
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
