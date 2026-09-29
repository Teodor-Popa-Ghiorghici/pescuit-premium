import { shuffle } from './rng.js';
import { Card, EGGS, NORMAL_RANKS, POWER_RANKS, Rank } from './types.js';

export const DECK_SIZE = 66;
export const POWER_COPIES = 4;
export const NORMAL_COPIES = 3;
export const EGG_COUNT = 6;

/**
 * The 66 cards in canonical (unshuffled) order. `makeId` names each card; the default is a
 * readable, rank-encoding id that is fine for tests and CLI sims. A production driver must
 * pass an id source that is independent of both rank and shuffle (the server uses
 * crypto.randomUUID()), because card ids reach clients (FEEL_VISUAL_SOUND_PLAN §6.3).
 */
export function buildDeck(makeId?: (rank: Rank, index: number) => string): Card[] {
  const cards: Card[] = [];
  let n = 0;
  const add = (rank: Rank) => {
    cards.push({ id: makeId ? makeId(rank, n) : `c${n}_${rank}`, rank });
    n += 1;
  };
  for (const rank of POWER_RANKS) for (let i = 0; i < POWER_COPIES; i++) add(rank);
  for (const rank of NORMAL_RANKS) for (let i = 0; i < NORMAL_COPIES; i++) add(rank);
  for (let i = 0; i < EGG_COUNT; i++) add(EGGS);

  if (cards.length !== DECK_SIZE) {
    throw new Error(`Deck assertion failed: expected ${DECK_SIZE} cards, built ${cards.length}`);
  }
  return cards;
}

/** True if `deck` is a legal 66-card deck: the right multiset of ranks, unique non-empty ids. */
export function deckProblem(deck: readonly Card[]): string | null {
  if (deck.length !== DECK_SIZE) return `a deck has ${DECK_SIZE} cards, got ${deck.length}`;
  const want = new Map<string, number>();
  for (const c of buildDeck()) want.set(c.rank, (want.get(c.rank) ?? 0) + 1);
  const ids = new Set<string>();
  for (const c of deck) {
    if (typeof c.id !== 'string' || c.id.length === 0) return 'every card needs an id';
    if (ids.has(c.id)) return `duplicate card id ${c.id}`;
    ids.add(c.id);
    const left = want.get(c.rank);
    if (!left) return `too many cards of rank ${c.rank}`;
    want.set(c.rank, left - 1);
  }
  return null;
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

/**
 * A deterministic deal for engine tests and bot simulations. NOT for production: a 32-bit seed
 * can be brute-forced. Card ids are `k<position>`, independent of rank (and so of the seed's
 * shuffle only through position, which is what a real deck's UUIDs also are).
 */
export function seededDeck(seed: number): Card[] {
  const { result } = shuffle(buildDeck(), seed | 0);
  return result.map((c, i) => ({ id: `k${i}`, rank: c.rank }));
}
