// Mirrors packages/engine/src/queries.ts#findLayableSets, but works off just a hand
// (RedactedView only exposes the viewer's own full hand, not a whole GameState).
import type { Card, Rank } from '@pescuit/engine';
import { EGGS, NORMAL_RANKS, POWER_RANKS, setSizeForRank } from '@pescuit/engine';

export interface LayableSet {
  rank: Rank;
  cardIds: string[];
  eggCount: number;
}

export function findLayableSets(hand: Card[]): LayableSet[] {
  const results: LayableSet[] = [];
  const eggs = hand.filter((c) => c.rank === EGGS);

  if (eggs.length >= 4) {
    results.push({ rank: EGGS, cardIds: eggs.slice(0, 4).map((c) => c.id), eggCount: 4 });
  }

  const allRanks: Rank[] = [...POWER_RANKS, ...NORMAL_RANKS];
  for (const rank of allRanks) {
    const reals = hand.filter((c) => c.rank === rank);
    const size = setSizeForRank(rank);
    const maxEggsUsable = Math.min(2, eggs.length, size - 2);
    for (let e = 0; e <= maxEggsUsable; e++) {
      const needReal = size - e;
      if (needReal < 2) continue;
      if (reals.length >= needReal) {
        results.push({
          rank,
          cardIds: [...reals.slice(0, needReal).map((c) => c.id), ...eggs.slice(0, e).map((c) => c.id)],
          eggCount: e,
        });
        break;
      }
    }
  }
  return results;
}
