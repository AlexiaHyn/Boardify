'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createRoom, listGames, generateGame } from '@/lib/api';
import type { GameInfo } from '@/types/game';

export default function HomePage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [gameType, setGameType] = useState('exploding_kittens');
  const [games, setGames] = useState<GameInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // AI generation state
  const [prompt, setPrompt] = useState('');
  const [generating, setGenerating] = useState(false);
  const [genMessage, setGenMessage] = useState('');

  useEffect(() => {
    fetchGames();
  }, []);

  const fetchGames = () => {
    listGames()
      .then((g) => {
        setGames(g);
        if (g.length > 0 && !g.find((x) => x.id === gameType)) {
          setGameType(g[0].id);
        }
      })
      .catch(() => {
        setGames([
          { id: 'exploding_kittens', name: 'Exploding Kittens' },
          { id: 'uno', name: 'UNO' },
        ]);
      });
  };

  const handleCreate = async () => {
    if (!name.trim()) { setError('Enter your name'); return; }
    setLoading(true);
    setError('');
    try {
      const data = await createRoom({ host_name: name.trim(), game_type: gameType });
      sessionStorage.setItem(`player_${data.roomCode}`, data.playerId);
      router.push(`/room/${data.roomCode}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) { setError('Enter a game name to generate'); return; }
    setGenerating(true);
    setError('');
    setGenMessage('Researching rules and generating game — this may take a minute…');
    try {
      const res = await generateGame(prompt.trim());
      if (res.success) {
        setGenMessage(`"${res.game_name}" is ready to play!`);
        setPrompt('');
        // Refresh game list and auto-select the new game
        const updated = await listGames().catch(() => games);
        setGames(updated);
        setGameType(res.game_id);
      } else {
        setGenMessage('');
        setError(res.message || 'Generation failed');
      }
    } catch (e) {
      setGenMessage('');
      setError((e as Error).message);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="text-7xl mb-4">🃏</div>
          <h1 className="text-white text-4xl font-bold">Boardify</h1>
          <p className="text-white/50 mt-2">Play any card game with friends online</p>
        </div>

        <div className="bg-black/40 rounded-2xl p-8 border border-white/10 space-y-5">
          {/* Name */}
          <div>
            <label className="text-white/60 text-sm block mb-2">Your Name</label>
            <input
              type="text"
              placeholder="e.g. PlayerOne"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              maxLength={20}
              className="w-full bg-gray-800 border border-white/20 rounded-xl px-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>

          {/* Game selector */}
          <div>
            <label className="text-white/60 text-sm block mb-2">Game</label>
            <select
              value={gameType}
              onChange={(e) => setGameType(e.target.value)}
              className="w-full bg-gray-800 border border-white/20 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors"
            >
              {games.length === 0 ? (
                <option value="exploding_kittens">Exploding Kittens</option>
              ) : (
                games.map((g) => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))
              )}
            </select>
          </div>

          {/* AI game generation prompt */}
          <div>
            <label className="text-white/60 text-sm block mb-2">
              Or generate a new game with AI
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="e.g. Crazy Eights, Go Fish…"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !generating && handleGenerate()}
                disabled={generating}
                className="flex-1 bg-gray-800 border border-white/20 rounded-xl px-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:border-purple-500 transition-colors disabled:opacity-50"
              />
              <button
                onClick={handleGenerate}
                disabled={generating || !prompt.trim()}
                className="bg-purple-600 hover:bg-purple-500 disabled:bg-gray-700 disabled:text-white/30 text-white font-bold px-5 py-3 rounded-xl transition-all hover:scale-[1.02] active:scale-100 whitespace-nowrap"
              >
                {generating ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="animate-spin">⏳</span>
                  </span>
                ) : (
                  '✨ Generate'
                )}
              </button>
            </div>
            {genMessage && (
              <p className="text-purple-300 text-sm mt-2 bg-purple-900/20 rounded-lg px-3 py-2">
                {generating && <span className="animate-pulse">⏳ </span>}
                {genMessage}
              </p>
            )}
          </div>

          {error && (
            <p className="text-red-400 text-sm bg-red-900/20 rounded-lg px-3 py-2">{error}</p>
          )}

          {/* Create */}
          <button
            onClick={handleCreate}
            disabled={loading || generating}
            className="w-full bg-green-500 hover:bg-green-400 disabled:bg-gray-700 disabled:text-white/30 text-white font-bold py-4 rounded-2xl text-lg transition-all hover:scale-[1.02] active:scale-100 shadow-lg shadow-green-500/20"
          >
            {loading ? '⏳ Creating…' : '🚀 Create Room'}
          </button>

          <div className="relative">
            <div className="border-t border-white/10" />
            <span className="absolute left-1/2 -translate-x-1/2 -top-3 bg-gray-900 px-3 text-white/30 text-sm">or</span>
          </div>

          {/* Join */}
          <button
            onClick={() => router.push('/join')}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-2xl text-lg transition-all hover:scale-[1.02] active:scale-100"
          >
            🔗 Join with Room Code
          </button>
        </div>

        <p className="text-center text-white/30 text-sm mt-6">
          Share the room code with friends to play together
        </p>
      </div>
    </div>
  );
}
