import { describe, expect, it } from 'vitest';
import { reduce, IllegalActionError } from '../../src/engine.js';
import { cards, findPlayer, makeState } from '../helpers.js';
import { grantPower } from './grantHelper.js';

describe('whale', () => {
  it('shuffles two adjacent hands blind and deals back the same count each had before', () => {
    const state = makeState({
      playerIds: ['a', 'b', 'c'],
      hands: { a: cards('herring', 4), b: cards('mackerel', 2), c: [] },
    });
    const grantId = grantPower(state, 'c', 'whale');
    state.pendingWindow = { type: 'TURN_START', eligiblePlayerIds: ['c'], context: {} };
    const { state: s1, events } = reduce(state, {
      type: 'USE_WHALE',
      playerId: 'c',
      grantId,
      targetAId: 'a',
      targetBId: 'b',
    });
    expect(findPlayer(s1, 'a').hand).toHaveLength(4);
    expect(findPlayer(s1, 'b').hand).toHaveLength(2);
    expect(events.some((e) => e.type === 'WHALE_SHUFFLE')).toBe(true);
    // total cards conserved
    const totalAfter = findPlayer(s1, 'a').hand.length + findPlayer(s1, 'b').hand.length;
    expect(totalAfter).toBe(6);
  });

  it('requires at least 3 players', () => {
    const state = makeState({ playerIds: ['a', 'b'], hands: { a: cards('herring', 2), b: cards('mackerel', 2) } });
    const grantId = grantPower(state, 'a', 'whale');
    state.pendingWindow = { type: 'TURN_START', eligiblePlayerIds: ['a'], context: {} };
    expect(() =>
      reduce(state, { type: 'USE_WHALE', playerId: 'a', grantId, targetAId: 'a', targetBId: 'b' }),
    ).toThrow(IllegalActionError);
  });

  it('targets must be seated next to each other', () => {
    const state = makeState({
      playerIds: ['a', 'b', 'c', 'd'],
      hands: { a: cards('herring', 2), b: cards('mackerel', 2), c: [], d: cards('carp', 2) },
    });
    const grantId = grantPower(state, 'c', 'whale');
    state.pendingWindow = { type: 'TURN_START', eligiblePlayerIds: ['c'], context: {} };
    expect(() =>
      reduce(state, { type: 'USE_WHALE', playerId: 'c', grantId, targetAId: 'a', targetBId: 'd' }),
    ).not.toThrow(); // a and d ARE adjacent (circular: d -> a)
  });

  it('excludes tortoise-protected cards from the shuffle; they stay with their owner', () => {
    const state = makeState({
      playerIds: ['a', 'b', 'c'],
      hands: { a: cards('herring', 3), b: cards('mackerel', 2), c: [] },
    });
    state.tortoiseProtections.push({ id: 'tp1', ownerId: 'a', rank: 'herring', expiresAtNextTurnOf: 'a' });
    const grantId = grantPower(state, 'c', 'whale');
    state.pendingWindow = { type: 'TURN_START', eligiblePlayerIds: ['c'], context: {} };
    const { state: s1 } = reduce(state, {
      type: 'USE_WHALE',
      playerId: 'c',
      grantId,
      targetAId: 'a',
      targetBId: 'b',
    });
    // a's 3 protected herrings never left a's hand
    expect(findPlayer(s1, 'a').hand.filter((c) => c.rank === 'herring')).toHaveLength(3);
    expect(findPlayer(s1, 'a').hand).toHaveLength(3);
    expect(findPlayer(s1, 'b').hand).toHaveLength(2);
  });

  it('may target the acting player if adjacent to their neighbor', () => {
    const state = makeState({
      playerIds: ['a', 'b', 'c'],
      hands: { a: cards('herring', 2), b: cards('mackerel', 2), c: [] },
    });
    const grantId = grantPower(state, 'a', 'whale');
    state.pendingWindow = { type: 'TURN_START', eligiblePlayerIds: ['a'], context: {} };
    expect(() =>
      reduce(state, { type: 'USE_WHALE', playerId: 'a', grantId, targetAId: 'a', targetBId: 'b' }),
    ).not.toThrow();
  });
});
