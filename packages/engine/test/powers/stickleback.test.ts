import { describe, expect, it } from 'vitest';
import { reduce, IllegalActionError } from '../../src/engine.js';
import { card, cards, findPlayer, makeState } from '../helpers.js';
import { grantPower } from './grantHelper.js';

describe('stickleback', () => {
  it('steals every card of a named normal rank from a target', () => {
    const state = makeState({
      playerIds: ['a', 'b'],
      hands: { a: [], b: cards('carp', 3) },
    });
    const grantId = grantPower(state, 'a', 'stickleback');
    state.pendingWindow = { type: 'TURN_START', eligiblePlayerIds: ['a'], context: {} };
    const { state: s1, events } = reduce(state, {
      type: 'USE_STICKLEBACK',
      playerId: 'a',
      grantId,
      targetId: 'b',
      rank: 'carp',
    });
    expect(findPlayer(s1, 'a').hand.filter((c) => c.rank === 'carp')).toHaveLength(3);
    expect(findPlayer(s1, 'b').hand).toHaveLength(0);
    expect(events.some((e) => e.type === 'STICKLEBACK_STEAL')).toBe(true);
  });

  it('is wasted (but still consumed) if the target holds none of the named rank', () => {
    const state = makeState({ playerIds: ['a', 'b'], hands: { a: [], b: [card('mackerel')] } });
    const grantId = grantPower(state, 'a', 'stickleback');
    state.pendingWindow = { type: 'TURN_START', eligiblePlayerIds: ['a'], context: {} };
    const { state: s1, events } = reduce(state, {
      type: 'USE_STICKLEBACK',
      playerId: 'a',
      grantId,
      targetId: 'b',
      rank: 'carp',
    });
    expect(events.some((e) => e.type === 'STICKLEBACK_WASTED')).toBe(true);
    expect(s1.powerGrants.find((g) => g.id === grantId)?.used).toBe(true);
  });

  it('cannot target a power rank', () => {
    const state = makeState({ playerIds: ['a', 'b'], hands: { a: [], b: cards('shark', 4) } });
    const grantId = grantPower(state, 'a', 'stickleback');
    state.pendingWindow = { type: 'TURN_START', eligiblePlayerIds: ['a'], context: {} };
    expect(() =>
      reduce(state, { type: 'USE_STICKLEBACK', playerId: 'a', grantId, targetId: 'b', rank: 'shark' as any }),
    ).toThrow(IllegalActionError);
  });

  it('cannot target eggs', () => {
    const state = makeState({ playerIds: ['a', 'b'], hands: { a: [], b: cards('eggs', 4) } });
    const grantId = grantPower(state, 'a', 'stickleback');
    state.pendingWindow = { type: 'TURN_START', eligiblePlayerIds: ['a'], context: {} };
    expect(() =>
      reduce(state, { type: 'USE_STICKLEBACK', playerId: 'a', grantId, targetId: 'b', rank: 'eggs' as any }),
    ).toThrow(IllegalActionError);
  });
});
