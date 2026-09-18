import { describe, expect, it } from 'vitest';
import { reduce } from '../../src/engine.js';
import { cards, findPlayer, makeState } from '../helpers.js';
import { grantPower } from './grantHelper.js';

describe('mantis shrimp', () => {
  it('destroys a power set at the moment of completion; the layer keeps the point but not the power', () => {
    const sharks = cards('shark', 4);
    const state = makeState({ playerIds: ['a', 'b'], hands: { a: sharks, b: [] } });
    const grantId = grantPower(state, 'b', 'mantisShrimp');
    const { state: s1 } = reduce(state, {
      type: 'LAY_SET',
      playerId: 'a',
      rank: 'shark',
      cardIds: sharks.map((c) => c.id),
    });
    expect(s1.pendingWindow?.type).toBe('SET_COMPLETED');
    const setId = s1.laidSets.find((s) => s.rank === 'shark')!.id;
    const { state: s2, events } = reduce(s1, { type: 'DECLARE_MANTIS', playerId: 'b', grantId });
    expect(findPlayer(s2, 'a').score).toBe(1); // point kept
    expect(s2.laidSets.find((s) => s.id === setId)?.destroyedByMantis).toBe(true);
    expect(s2.laidSets.find((s) => s.id === setId)?.faceUp).toBe(true);
    expect(s2.powerGrants.filter((g) => g.rank === 'shark')).toHaveLength(0); // no power granted
    expect(events.some((e) => e.type === 'SET_DESTROYED')).toBe(true);
  });

  it('may target a mantis shrimp set (including itself, if two exist)', () => {
    const mantisA = cards('mantisShrimp', 4);
    const state = makeState({ playerIds: ['a', 'b'], hands: { a: mantisA, b: [] } });
    const grantId = grantPower(state, 'b', 'mantisShrimp');
    const { state: s1 } = reduce(state, {
      type: 'LAY_SET',
      playerId: 'a',
      rank: 'mantisShrimp',
      cardIds: mantisA.map((c) => c.id),
    });
    expect(s1.pendingWindow?.type).toBe('SET_COMPLETED');
    const { state: s2 } = reduce(s1, { type: 'DECLARE_MANTIS', playerId: 'b', grantId });
    expect(s2.laidSets.find((s) => s.rank === 'mantisShrimp' && s.ownerId === 'a')?.destroyedByMantis).toBe(true);
  });

  it('is not usable later, only at the instant of completion (no window if nobody has an unused mantis)', () => {
    const sharks = cards('shark', 4);
    const state = makeState({ playerIds: ['a', 'b'], hands: { a: sharks, b: [] } });
    const { state: s1 } = reduce(state, {
      type: 'LAY_SET',
      playerId: 'a',
      rank: 'shark',
      cardIds: sharks.map((c) => c.id),
    });
    expect(s1.pendingWindow).toBeNull();
    expect(s1.powerGrants.filter((g) => g.rank === 'shark')).toHaveLength(1);
  });
});
