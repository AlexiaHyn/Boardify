/** Row from public.game_showcases */
export interface GameShowcaseRow {
  id: string;
  game_code: string;
  game_id: string;
  host_person: string;
  game_snapshot: GameSnapshot;
  status: 'completed' | 'in_progress';
  created_at: string;
  completed_at: string | null;
}

/** Minimal shape of game_snapshot (jsonb) for display */
export interface GameSnapshot {
  gameName?: string;
  gameType?: string;
  roomCode?: string;
  phase?: string;
  winner?: { name?: string };
  players?: { name: string }[];
  [key: string]: unknown;
}
