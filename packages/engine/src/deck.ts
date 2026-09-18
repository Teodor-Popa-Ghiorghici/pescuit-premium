import { Card, EGGS, NORMAL_RANKS, POWER_RANKS, Rank } from './types.js';

export const DECK_SIZE = 66;

export function buildDeck(): Card[] {
  const cards: Card[] = [];
  let n = 0;
  for (const rank of POWER_RANKS) {
    for (let i = 0; i < 4; i++) cards.push({ id: `c${n++}_${rank}`, rank });
  }
  for (const rank of NORMAL_RANKS) {
    for (let i = 0; i < 3; i++) cards.push({ id: `c${n++}_${rank}`, rank });
  }
  for (let i = 0; i < 6; i++) cards.push({ id: `c${n++}_${EGGS}`, rank: EGGS });

  if (cards.length !== DECK_SIZE) {
    throw new Error(`Deck assertion failed: expected ${DECK_SIZE} cards, built ${cards.length}`);
  }
  return cards;
}

export function isPowerRank(rank: Rank): boolean {
  return (POWER_RANKS as readonly string[]).includes(rank);
}

export function isNormalRank(rank: Rank): boolean {
  return (NORMAL_RANKS as readonly string[]).includes(rank);
}

export function setSizeForRank(rank: Rank): number {
  if (rank === EGGS) return 4;
  if (isPowerRank(rank)) return 4;
  return 3;
}
