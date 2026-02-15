"use client";

// ── useGame hook — WebSocket-powered real-time game state ─────────────────────

import { useState, useEffect, useCallback, useRef } from "react";
import type { GameState } from "../entities";
import { createWebSocket, sendAction, fetchRoomState } from "../services/gameApi";

interface UseGameOptions {
  roomCode: string;
  playerId: string;
}

interface UseGameReturn {
  gameState: GameState | null;
  isConnected: boolean;
  isLoading: boolean;
  error: string | null;
  peekCards: string[] | null;       // top-3 cards from See the Future
  clearPeek: () => void;
  drawCard: () => Promise<void>;
  playCard: (cardId: string, targetPlayerId?: string) => Promise<void>;
  clearError: () => void;
}

export function useGame({ roomCode, playerId }: UseGameOptions): UseGameReturn {
  const [gameState, setGameState]     = useState<GameState | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading]     = useState(true);
  const [error, setError]             = useState<string | null>(null);
  const [peekCards, setPeekCards]     = useState<string[] | null>(null);

  const wsRef       = useRef<WebSocket | null>(null);
  const pingRef     = useRef<NodeJS.Timeout | null>(null);
  const reconnectRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef  = useRef(true);

  // ── WebSocket setup ─────────────────────────────────────────────────────────
  const connect = useCallback(() => {
    if (!roomCode || !playerId) return;

    const ws = createWebSocket(roomCode, playerId);
    wsRef.current = ws;

    ws.onopen = () => {
      if (!mountedRef.current) return;
      setIsConnected(true);
      setIsLoading(false);
      // Send keep-alive pings every 20s
      pingRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "ping" }));
        }
      }, 20_000);
    };

    ws.onmessage = (event) => {
      if (!mountedRef.current) return;
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === "state_update") {
          setGameState(msg.state as GameState);
          setIsLoading(false);
        } else if (msg.type === "error") {
          setError(msg.message);
        }
      } catch { /* ignore malformed */ }
    };

    ws.onerror = () => {
      if (!mountedRef.current) return;
      setIsConnected(false);
    };

    ws.onclose = () => {
      if (!mountedRef.current) return;
      setIsConnected(false);
      if (pingRef.current) clearInterval(pingRef.current);
      // Auto-reconnect after 2s
      reconnectRef.current = setTimeout(() => {
        if (mountedRef.current) connect();
      }, 2000);
    };
  }, [roomCode, playerId]);

  useEffect(() => {
    mountedRef.current = true;
    connect();

    // Fallback: also poll once on mount in case WS is slow
    fetchRoomState(roomCode)
      .then((s) => { if (mountedRef.current) { setGameState(s); setIsLoading(false); } })
      .catch(() => {});

    return () => {
      mountedRef.current = false;
      wsRef.current?.close();
      if (pingRef.current)     clearInterval(pingRef.current);
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
    };
  }, [connect, roomCode]);

  // ── Actions ─────────────────────────────────────────────────────────────────
  const drawCard = useCallback(async () => {
    try {
      const res = await sendAction(roomCode, "draw_card", playerId);
      if (!res.success) setError("Draw failed");
      // Check if See the Future was triggered
      const peek = res.triggeredEffects.find((e) => e.startsWith("top3:"));
      if (peek) setPeekCards(peek.replace("top3:", "").split(","));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Draw failed");
    }
  }, [roomCode, playerId]);

  const playCard = useCallback(
    async (cardId: string, targetPlayerId?: string) => {
      try {
        const res = await sendAction(roomCode, "play_card", playerId, cardId, targetPlayerId);
        if (!res.success) setError("Play failed");
        const peek = res.triggeredEffects.find((e) => e.startsWith("top3:"));
        if (peek) setPeekCards(peek.replace("top3:", "").split(","));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Play failed");
      }
    },
    [roomCode, playerId]
  );

  return {
    gameState,
    isConnected,
    isLoading,
    error,
    peekCards,
    clearPeek: () => setPeekCards(null),
    drawCard,
    playCard,
    clearError: () => setError(null),
  };
}
