// Read-only helper queries over GameState. Used by bots, the server, and the UI
// to discover legal moves without duplicating engine rules.

import { isNormalRank, isPowerRank, setSizeForRank } from './deck.js';
import { EGGS, GameState, NORMAL_RANKS, POWER_RANKS, PlayerState, Rank } from './types.js';

export interface LayableSet {
  rank: Rank;
  cardIds: string[];
  eggCount: number;
  realCount: number;
}

/** All sets a player could legally lay right now, given only their current hand. */
export function findLayableSets(state: GameState, playerId: string): LayableSet[] {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return [];
  const results: LayableSet[] = [];

  const eggs = player.hand.filter((c) => c.rank === EGGS);
  if (eggs.length >= 4) {
    results.push({ rank: EGGS, cardIds: eggs.slice(0, 4).map((c) => c.id), eggCount: 4, realCount: 0 });
  }

  const allRanks: Rank[] = [...POWER_RANKS, ...NORMAL_RANKS];
  for (const rank of allRanks) {
    const reals = player.hand.filter((c) => c.rank === rank);
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
          realCount: needReal,
        });
        break; // fewest eggs first is fine; a bot/UI can request alternates if needed
      }
    }
  }
  return results;
}

/** Ranks a player may legally name in a REQUEST right now (holds >=1 real card of that rank). */
export function askableRanks(player: PlayerState): Rank[] {
  const set = new Set<Rank>();
  for (const c of player.hand) {
    if (c.rank !== EGGS) set.add(c.rank);
  }
  return [...set];
}

export function legalRequestTargets(state: GameState, askerId: string): string[] {
  return state.players.filter((p) => p.id !== askerId && !p.stunned).map((p) => p.id);
}

export function isRankRequestable(rank: Rank): rank is Exclude<Rank, typeof EGGS> {
  return isPowerRank(rank) || isNormalRank(rank);
}
