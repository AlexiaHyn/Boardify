import { useCallback, useEffect, useRef, useState } from 'react';
import type { GameState, WsMessage } from '@/types/game';
import { buildWsUrl } from '@/lib/api';

interface UseGameSocketOptions {
  roomCode: string;
  playerId: string;
  onStateUpdate?: (state: GameState) => void;
  onEvent?: (msg: WsMessage) => void;
}

export function useGameSocket({
  roomCode,
  playerId,
  onStateUpdate,
  onEvent,
}: UseGameSocketOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const pingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [connected, setConnected] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  const connect = useCallback(() => {
    if (!roomCode || !playerId) return;
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const url = buildWsUrl(roomCode, playerId);
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      setLastError(null);
      // Keep-alive ping every 20s
      pingRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'ping' }));
        }
      }, 20_000);
    };

    ws.onmessage = (event) => {
      try {
        const msg: WsMessage = JSON.parse(event.data);
        if (msg.type === 'state_update') {
          onStateUpdate?.(msg.state);
        }
        onEvent?.(msg);
      } catch {
        console.error('WS parse error', event.data);
      }
    };

    ws.onerror = () => {
      setLastError('WebSocket error — retrying…');
    };

    ws.onclose = () => {
      setConnected(false);
      if (pingRef.current) clearInterval(pingRef.current);
      // Reconnect after 2s
      setTimeout(() => connect(), 2_000);
    };
  }, [roomCode, playerId, onStateUpdate, onEvent]);

  useEffect(() => {
    connect();
    return () => {
      if (pingRef.current) clearInterval(pingRef.current);
      wsRef.current?.close();
    };
  }, [connect]);

  return { connected, lastError };
}
