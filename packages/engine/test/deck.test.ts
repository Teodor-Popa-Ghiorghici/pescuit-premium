import { describe, expect, it } from 'vitest';
import { buildDeck, DECK_SIZE } from '../src/deck.js';
import { EGGS, NORMAL_RANKS, POWER_RANKS } from '../src/types.js';

describe('deck', () => {
  it('has exactly 66 cards', () => {
    expect(buildDeck().length).toBe(DECK_SIZE);
    expect(DECK_SIZE).toBe(66);
  });

  it('has 4 of each of the 9 power ranks', () => {
    const deck = buildDeck();
    for (const rank of POWER_RANKS) {
      expect(deck.filter((c) => c.rank === rank)).toHaveLength(4);
    }
  });

  it('has 3 of each of the 8 normal ranks', () => {
    const deck = buildDeck();
    for (const rank of NORMAL_RANKS) {
      expect(deck.filter((c) => c.rank === rank)).toHaveLength(3);
    }
  });

  it('has 6 eggs', () => {
    const deck = buildDeck();
    expect(deck.filter((c) => c.rank === EGGS)).toHaveLength(6);
  });

  it('has unique card ids', () => {
    const deck = buildDeck();
    expect(new Set(deck.map((c) => c.id)).size).toBe(deck.length);
  });
});
