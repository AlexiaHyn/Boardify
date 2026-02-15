import { useCallback, useState } from 'react';
import { sendAction } from '@/lib/api';
import type { ActionRequest, GameState } from '@/types/game';

interface UseGameActionsOptions {
  roomCode: string;
  playerId: string;
  gameState: GameState | null;
}

export function useGameActions({ roomCode, playerId, gameState }: UseGameActionsOptions) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dispatch = useCallback(
    async (action: ActionRequest) => {
      if (!gameState) return;
      setLoading(true);
      setError(null);
      try {
        await sendAction(roomCode, action);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Action failed');
      } finally {
        setLoading(false);
      }
    },
    [roomCode, gameState],
  );

  const drawCard = useCallback(
    () => dispatch({ type: 'draw_card', playerId }),
    [dispatch, playerId],
  );

  const playCard = useCallback(
    (cardId: string, targetPlayerId?: string, meta?: Record<string, unknown>) =>
      dispatch({
        type: 'play_card',
        playerId,
        cardId,
        targetPlayerId,
        metadata: meta,
      }),
    [dispatch, playerId],
  );

  const playCombo = useCallback(
    (cardId: string, comboPairId: string, targetPlayerId?: string) =>
      dispatch({
        type: 'play_card',
        playerId,
        cardId,
        targetPlayerId,
        metadata: { comboPairId },
      }),
    [dispatch, playerId],
  );

  const playNope = useCallback(
    (cardId: string) =>
      dispatch({ type: 'nope', playerId, cardId }),
    [dispatch, playerId],
  );

  const selectTarget = useCallback(
    (targetPlayerId: string, meta?: Record<string, unknown>) =>
      dispatch({ type: 'select_target', playerId, targetPlayerId, metadata: meta }),
    [dispatch, playerId],
  );

  const insertExploding = useCallback(
    (position: number) =>
      dispatch({ type: 'insert_exploding', playerId, metadata: { position } }),
    [dispatch, playerId],
  );

  const giveCard = useCallback(
    (cardId: string) =>
      dispatch({ type: 'give_card', playerId, cardId }),
    [dispatch, playerId],
  );

  const respondToPendingAction = useCallback(
    (actionType: string, value: string) => {
      // Send the response based on action type
      // For choose_color, send color in metadata
      if (actionType === 'choose_color') {
        return dispatch({ type: actionType, playerId, metadata: { color: value } });
      }
      // Generic response with value
      return dispatch({ type: actionType, playerId, metadata: { value } });
    },
    [dispatch, playerId],
  );

  const executeDefaultAction = useCallback(
    (actionType: string, targetPlayerId?: string) => {
      // Execute a default game action (like call_uno, catch_uno, etc.)
      dispatch({
        type: actionType,
        playerId,
        targetPlayerId,
      });
    },
    [dispatch, playerId],
  );

  return {
    loading,
    error,
    drawCard,
    playCard,
    playCombo,
    playNope,
    selectTarget,
    insertExploding,
    giveCard,
    respondToPendingAction,
    executeDefaultAction,
  };
}
