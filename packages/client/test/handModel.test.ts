import { describe, expect, it } from 'vitest';
import type { Card, Rank } from '@pescuit/engine';
import { buildGroups, FAN_MAX_TILT, FAN_PHONE, fanOf, layoutHand, tiltReach } from '../src/game/handModel.js';

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

  it('fans the hand: symmetric tilts and an arc, the middle highest, nothing below the row; flat when the dock scrolls (HAND_AND_TURN_PLAN #2)', () => {
    const seven = buildGroups(hand('shark', 'tortoise', 'jellyfish', 'herring', 'carp', 'trout', 'eggs'));
    const l = layoutHand(seven, 132, 1200);
    expect(l.scrolls).toBe(false);
    expect(l.tilts[0]).toBe(-FAN_MAX_TILT);
    expect(l.tilts[6]).toBe(FAN_MAX_TILT);
    expect(l.tilts[3]).toBe(0);
    for (let i = 1; i < 7; i++) expect(l.tilts[i]).toBeGreaterThan(l.tilts[i - 1]);
    // the middle rides highest, the arc is symmetric, and the lowest tilted corner sits on the baseline
    expect(Math.min(...l.sinks)).toBe(l.sinks[3]);
    expect(l.sinks[0]).toBe(l.sinks[6]);
    const lowest = Math.max(...l.sinks.map((y, i) => y + tiltReach(132, 198, l.tilts[i]).y));
    expect(lowest).toBeLessThanOrEqual(0.5);
    expect(lowest).toBeGreaterThan(-1.5);
    // two groups barely fan
    expect(Math.abs(fanOf(2, false).tilts[0])).toBeLessThan(2);
    // a scrolling dock lies flat
    const nine = buildGroups(hand('squid', 'shark', 'tortoise', 'jellyfish', 'lanternfish', 'stickleback', 'mantisShrimp', 'whale', 'herring'));
    const l9 = layoutHand(nine, 104, 336, FAN_PHONE);
    expect(l9.tilts.every((t) => t === 0) && l9.sinks.every((y) => y === 0)).toBe(true);
  });

  it('leaves room at both ends for the tilted corners: the fanned row never reaches past the hand', () => {
    const seven = buildGroups(hand('shark', 'tortoise', 'jellyfish', 'herring', 'carp', 'trout', 'eggs'));
    const avail = 700;
    const l = layoutHand(seven, 132, avail);
    const reach = tiltReach(132, 198, FAN_MAX_TILT).x;
    expect((avail - l.width) / 2).toBeGreaterThanOrEqual(reach);
  });
});
