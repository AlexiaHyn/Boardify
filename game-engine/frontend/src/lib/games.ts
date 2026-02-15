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

export const GAMES: GameConfig[] = [
  {
    id: 0,
    name: 'Exploding Kittens',
    description:
      'A strategic card game of kitty-powered mayhem. Draw cards, avoid explosions, and be the last player standing.',
    emoji: '🐱',
    accentColor: '#FF6B35',
    accentColorRgb: '255, 107, 53',
    playerCount: '2–5 players',
    gameType: 'exploding_kittens',
  },
  {
    id: 1,
    name: 'Poker',
    description:
      'The timeless game of skill, strategy, and nerve. Read your opponents, manage your chips, and claim the pot.',
    emoji: '♠️',
    accentColor: '#E63946',
    accentColorRgb: '230, 57, 70',
    playerCount: '2–8 players',
    gameType: 'poker',
  },
  {
    id: 2,
    name: 'Uno',
    description:
      'Match colors, stack cards, and unleash chaos. The classic card game that turns friends into rivals.',
    emoji: '🎴',
    accentColor: '#2EC4B6',
    accentColorRgb: '46, 196, 182',
    playerCount: '2–10 players',
    gameType: 'uno',
  },
];

export function getGameById(id: number): GameConfig | undefined {
  return GAMES.find((g) => g.id === id);
}

export function getGameByType(gameType: string): GameConfig | undefined {
  return GAMES.find((g) => g.gameType === gameType);
}
