import { describe, expect, it } from 'vitest';
import type { Card, Rank } from '@pescuit/engine';
import { buildGroups, layoutHand } from '../src/game/handModel.js';

const hand = (...ranks: Rank[]): Card[] => ranks.map((rank, i) => ({ id: `c${i}`, rank }));

describe('the hand model (§5.3)', () => {
  it('sorts powers, then normal fish, then eggs, and groups duplicates', () => {
    const g = buildGroups(hand('catfish', 'eggs', 'tortoise', 'herring', 'tortoise', 'shark'));
    expect(g.map((x) => x.rank)).toEqual(['shark', 'tortoise', 'herring', 'catfish', 'eggs']);
    expect(g.find((x) => x.rank === 'tortoise')!.cards).toHaveLength(2);
  });

  it('ties a layable set with the eggs that complete it beside it', () => {
    const g = buildGroups(hand('herring', 'herring', 'eggs', 'eggs', 'trout'));
    const set = g.find((x) => x.layable)!;
    expect(set.rank).toBe('herring');
    expect(set.cards.map((c) => c.rank)).toEqual(['herring', 'herring', 'eggs']);
    expect(set.layable!.cardIds).toHaveLength(3);
    // the egg left over stays a group of its own
    expect(g.filter((x) => x.rank === 'eggs')).toHaveLength(1);
  });

  it('steps 25 % inside a group and never below 30 % between groups; scrolls past eight at 360 px', () => {
    const eight = buildGroups(hand('squid', 'shark', 'tortoise', 'jellyfish', 'lanternfish', 'stickleback', 'mantisShrimp', 'whale'));
    const l8 = layoutHand(eight, 104, 336);
    expect(l8.inStep).toBe(26);
    expect(l8.scrolls).toBe(false);
    const nine = buildGroups(hand('squid', 'shark', 'tortoise', 'jellyfish', 'lanternfish', 'stickleback', 'mantisShrimp', 'whale', 'herring'));
    const l9 = layoutHand(nine, 104, 336);
    expect(l9.gStep).toBe(Math.round(104 * 0.3));
    expect(l9.scrolls).toBe(true);
  });
});
