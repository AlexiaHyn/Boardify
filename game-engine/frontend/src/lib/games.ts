// Game catalogue — maps numeric IDs to game metadata

export interface GameConfig {
  id: number;
  name: string;
  description: string;
  emoji: string;
  accentColor: string;
  accentColorRgb: string;
  playerCount: string;
  gameType: string; // maps to backend game_type
}

// ── Accent color palette for AI-generated games ─────────────────────────────

const GENERATED_COLORS = [
  { hex: '#8B5CF6', rgb: '139, 92, 246' },
  { hex: '#F59E0B', rgb: '245, 158, 11' },
  { hex: '#10B981', rgb: '16, 185, 129' },
  { hex: '#EC4899', rgb: '236, 72, 153' },
  { hex: '#3B82F6', rgb: '59, 130, 246' },
  { hex: '#14B8A6', rgb: '20, 184, 166' },
  { hex: '#F97316', rgb: '249, 115, 22' },
];

const GENERATED_EMOJIS = ['🎲', '🃏', '✨', '🎯', '🧩', '🎪', '🌀'];

// ── localStorage persistence for custom games ───────────────────────────────

const STORAGE_KEY = 'boardify_custom_games';

function loadCustomGames(): GameConfig[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveCustomGames(games: GameConfig[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(games));
  } catch {
    /* quota exceeded – ignore */
  }
}

// ── Mutable game list (installed/custom games only) ──────────────────────────

export const GAMES: GameConfig[] = [];

// Hydrate from localStorage on the client
if (typeof window !== 'undefined') {
  const custom = loadCustomGames();
  for (const g of custom) {
    if (!GAMES.some((x) => x.gameType === g.gameType)) {
      GAMES.push(g);
    }
  }
}

// ── Add a dynamically-generated game ────────────────────────────────────────

export function addGame(
  gameType: string,
  gameName: string,
  description?: string,
): GameConfig {
  // Return existing entry if already registered
  const existing = GAMES.find((g) => g.gameType === gameType);
  if (existing) return existing;

  const nextId = Math.max(...GAMES.map((g) => g.id), -1) + 1;
  const color = GENERATED_COLORS[nextId % GENERATED_COLORS.length];
  const emoji = GENERATED_EMOJIS[nextId % GENERATED_EMOJIS.length];

  const game: GameConfig = {
    id: nextId,
    name: gameName,
    description: description || 'An AI-generated card game.',
    emoji,
    accentColor: color.hex,
    accentColorRgb: color.rgb,
    playerCount: '2–6 players',
    gameType,
  };

  GAMES.push(game);

  // Persist all games to localStorage
  saveCustomGames([...GAMES]);

  return game;
}

// ── Lookups ─────────────────────────────────────────────────────────────────

export function getGameById(id: number): GameConfig | undefined {
  return GAMES.find((g) => g.id === id);
}

export function getGameByType(gameType: string): GameConfig | undefined {
  return GAMES.find((g) => g.gameType === gameType);
}
