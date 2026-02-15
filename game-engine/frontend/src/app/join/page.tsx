'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { joinRoom } from '@/lib/api';
import { Suspense } from 'react';

function JoinForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [roomCode, setRoomCode] = useState(params.get('room') ?? '');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleJoin = async () => {
    if (!name.trim()) { setError('Enter your name'); return; }
    if (!roomCode.trim()) { setError('Enter a room code'); return; }
    setLoading(true);
    setError('');
    try {
      const data = await joinRoom(roomCode.trim().toUpperCase(), { player_name: name.trim() });
      sessionStorage.setItem(`player_${data.roomCode}`, data.playerId);
      router.push(`/room/${data.roomCode}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="text-6xl mb-4">🔗</div>
          <h1 className="text-white text-3xl font-bold">Join a Room</h1>
          <p className="text-white/50 mt-2">Enter the room code shared by your friend</p>
        </div>

        <div className="bg-black/40 rounded-2xl p-8 border border-white/10 space-y-5">
          <div>
            <label className="text-white/60 text-sm block mb-2">Room Code</label>
            <input
              type="text"
              placeholder="e.g. ABC123"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              maxLength={6}
              className="w-full bg-gray-800 border border-white/20 rounded-xl px-4 py-3 text-white placeholder:text-white/30 font-mono text-xl text-center tracking-widest focus:outline-none focus:border-blue-500 transition-colors uppercase"
            />
          </div>

          <div>
            <label className="text-white/60 text-sm block mb-2">Your Name</label>
            <input
              type="text"
              placeholder="e.g. Player Two"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
              maxLength={20}
              className="w-full bg-gray-800 border border-white/20 rounded-xl px-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>

          {error && (
            <p className="text-red-400 text-sm bg-red-900/20 rounded-lg px-3 py-2">{error}</p>
          )}

          <button
            onClick={handleJoin}
            disabled={loading}
            className="w-full bg-blue-500 hover:bg-blue-400 disabled:bg-gray-700 disabled:text-white/30 text-white font-bold py-4 rounded-2xl text-lg transition-all hover:scale-[1.02] active:scale-100"
          >
            {loading ? '⏳ Joining…' : '🚀 Join Game'}
          </button>

          <button
            onClick={() => router.push('/')}
            className="w-full text-white/40 hover:text-white text-sm transition-colors py-2"
          >
            ← Back to Home
          </button>
        </div>
      </div>
    </div>
  );
}

export default function JoinPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-900 flex items-center justify-center text-white">Loading…</div>}>
      <JoinForm />
    </Suspense>
  );
}
