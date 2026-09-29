import { describe, expect, it } from 'vitest';
import { reduce, IllegalActionError } from '../../src/engine.js';
import { cards, findPlayer, makeState } from '../helpers.js';
import { grantPower } from './grantHelper.js';

const ENTROPY = [0x9e3779b9, 0x243f6a88, 0xb7e15162, 0x85a308d3];

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
      entropy: ENTROPY,
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
      reduce(state, { type: 'USE_WHALE', playerId: 'a', grantId, targetAId: 'a', targetBId: 'b', entropy: ENTROPY }),
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
      reduce(state, { type: 'USE_WHALE', playerId: 'c', grantId, targetAId: 'a', targetBId: 'd', entropy: ENTROPY }),
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
      entropy: ENTROPY,
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
      reduce(state, { type: 'USE_WHALE', playerId: 'a', grantId, targetAId: 'a', targetBId: 'b', entropy: ENTROPY }),
    ).not.toThrow();
  });

  describe('entropy (§6.3)', () => {
    const setup = () => {
      const state = makeState({
        playerIds: ['a', 'b', 'c'],
        hands: { a: cards('herring', 5), b: cards('mackerel', 5), c: [] },
      });
      const grantId = grantPower(state, 'c', 'whale');
      state.pendingWindow = { type: 'TURN_START', eligiblePlayerIds: ['c'], context: {} };
      return { state, grantId };
    };
    const fixture = setup();
    const hands = (entropy: number[]) => {
      const { state, grantId } = fixture;
      const { state: s1 } = reduce(state, { type: 'USE_WHALE', playerId: 'c', grantId, targetAId: 'a', targetBId: 'b', entropy });
      return [findPlayer(s1, 'a'), findPlayer(s1, 'b')].map((p) => p.hand.map((c) => c.id).join(','));
    };

    it('the shuffle is a pure function of the state and the entropy attached to the action', () => {
      expect(hands(ENTROPY)).toEqual(hands([...ENTROPY]));
      expect(hands(ENTROPY)).not.toEqual(hands([1, 2, 3, 4]));
    });

    it('rejects a Whale action with no (or too little) entropy: the engine never invents randomness', () => {
      const { state, grantId } = setup();
      const base = { type: 'USE_WHALE' as const, playerId: 'c', grantId, targetAId: 'a', targetBId: 'b' };
      expect(() => reduce(state, base as any)).toThrow(IllegalActionError);
      expect(() => reduce(state, { ...base, entropy: [1, 2, 3] })).toThrow(IllegalActionError);
      expect(() => reduce(state, { ...base, entropy: [1, 2, 3, -1] })).toThrow(IllegalActionError);
      expect(() => reduce(state, { ...base, entropy: [1, 2, 3, 1.5] })).toThrow(IllegalActionError);
    });

    it('is uniform enough: over many entropies every card lands in every seat about equally', () => {
      const { state, grantId } = setup();
      let aGetsMackerel = 0;
      const N = 400;
      for (let i = 0; i < N; i++) {
        const entropy = [Math.imul(i + 1, 0x9e3779b1) >>> 0, i * 7919 + 13, Math.imul(i, 40503) >>> 0, (0xdeadbeef ^ i) >>> 0];
        const { state: s1 } = reduce(state, { type: 'USE_WHALE', playerId: 'c', grantId, targetAId: 'a', targetBId: 'b', entropy });
        aGetsMackerel += findPlayer(s1, 'a').hand.filter((c) => c.rank === 'mackerel').length;
      }
      // a holds 5 of the 10 shuffled cards, half of which are mackerel: mean 2.5 per game
      expect(aGetsMackerel / N).toBeGreaterThan(2.3);
      expect(aGetsMackerel / N).toBeLessThan(2.7);
    });
  });
});
