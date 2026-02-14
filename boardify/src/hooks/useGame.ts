// ============================================================
// useGame hook — manages game state, polling, and actions
// ============================================================

import { useState, useEffect, useCallback, useRef } from "react";
import {
  GameState,
  GameAction,
  ActionResponse,
  LogEntry,
} from "../entities";
import {
  fetchGameState,
  submitAction,
  drawCard,
  playCard,
  passTurn,
} from "../services/gameApi";

interface UseGameOptions {
  gameId: string;
  localPlayerId: string;
  pollInterval?: number; // ms, default 2000
}

interface UseGameReturn {
  gameState: GameState | null;
  isLoading: boolean;
  error: string | null;
  // Actions
  handleDrawCard: () => Promise<void>;
  handlePlayCard: (cardId: string, targetPlayerId?: string) => Promise<void>;
  handlePassTurn: () => Promise<void>;
  handleAction: (action: Omit<GameAction, "id" | "timestamp">) => Promise<ActionResponse | null>;
  // Helpers
  localPlayer: GameState["players"][0] | null;
  isMyTurn: boolean;
  recentLog: LogEntry[];
  refresh: () => void;
}

export function useGame({
  gameId,
  localPlayerId,
  pollInterval = 2000,
}: UseGameOptions): UseGameReturn {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  const loadState = useCallback(async () => {
    try {
      const state = await fetchGameState(gameId);
      setGameState(state);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load game state");
    } finally {
      setIsLoading(false);
    }
  }, [gameId]);

  // Initial load + polling
  useEffect(() => {
    loadState();
    pollRef.current = setInterval(loadState, pollInterval);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [loadState, pollInterval]);

  // ── Actions ────────────────────────────────────────────────

  const handleAction = useCallback(
    async (
      action: Omit<GameAction, "id" | "timestamp">
    ): Promise<ActionResponse | null> => {
      try {
        const result = await submitAction(gameId, action);
        if (result.success) {
          setGameState(result.newState);
        } else {
          setError(result.error || "Action failed");
        }
        return result;
      } catch (e) {
        setError(e instanceof Error ? e.message : "Action failed");
        return null;
      }
    },
    [gameId]
  );

  const handleDrawCard = useCallback(async () => {
    const result = await drawCard(gameId, localPlayerId);
    if (result.success) setGameState(result.newState);
    else setError(result.error || "Draw failed");
  }, [gameId, localPlayerId]);

  const handlePlayCard = useCallback(
    async (cardId: string, targetPlayerId?: string) => {
      const result = await playCard(gameId, localPlayerId, cardId, targetPlayerId);
      if (result.success) setGameState(result.newState);
      else setError(result.error || "Play failed");
    },
    [gameId, localPlayerId]
  );

  const handlePassTurn = useCallback(async () => {
    const result = await passTurn(gameId, localPlayerId);
    if (result.success) setGameState(result.newState);
    else setError(result.error || "Pass turn failed");
  }, [gameId, localPlayerId]);

  // ── Derived values ─────────────────────────────────────────

  const localPlayer =
    gameState?.players.find((p) => p.id === localPlayerId) ?? null;

  const isMyTurn = gameState?.currentTurnPlayerId === localPlayerId;

  const recentLog = gameState?.log.slice(-6) ?? [];

  return {
    gameState,
    isLoading,
    error,
    handleDrawCard,
    handlePlayCard,
    handlePassTurn,
    handleAction,
    localPlayer,
    isMyTurn,
    recentLog,
    refresh: loadState,
  };
}
