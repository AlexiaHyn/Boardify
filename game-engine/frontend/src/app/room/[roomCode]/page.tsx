'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getRoomState } from '@/lib/api';
import type { GameState } from '@/types/game';
import { GameRoom } from '@/components/game/GameRoom';

export default function RoomPage() {
  const params = useParams();
  const router = useRouter();
  const roomCode = (params.roomCode as string).toUpperCase();
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [initialState, setInitialState] = useState<GameState | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const stored = sessionStorage.getItem(`player_${roomCode}`);
    if (!stored) {
      // Not joined — redirect to join page with pre-filled room code
      router.replace(`/join?room=${roomCode}`);
      return;
    }
    setPlayerId(stored);

    // Fetch initial state
    getRoomState(roomCode)
      .then((state) => setInitialState(state))
      .catch((e) => setError((e as Error).message));
  }, [roomCode, router]);

  if (error) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-5xl mb-4">❌</div>
          <p className="text-white text-xl font-bold">Room not found</p>
          <p className="text-white/50 text-sm mt-2">{error}</p>
          <button
            onClick={() => router.push('/')}
            className="mt-6 bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-xl transition-colors"
          >
            Go Home
          </button>
        </div>
      </div>
    );
  }

  if (!playerId) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white text-center">
          <div className="text-5xl animate-spin mb-4">⏳</div>
          <p className="text-xl">Loading…</p>
        </div>
      </div>
    );
  }

  return (
    <GameRoom
      roomCode={roomCode}
      playerId={playerId}
      initialState={initialState ?? undefined}
    />
  );
}
