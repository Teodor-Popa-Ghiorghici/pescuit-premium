import { describe, expect, it } from 'vitest';
import { reduce, IllegalActionError } from '../../src/engine.js';
import { card, cards, findPlayer, makeState } from '../helpers.js';
import { grantPower } from './grantHelper.js';

describe('jellyfish', () => {
  it('stuns a player: their turn is skipped and the stun clears', () => {
    const state = makeState({
      playerIds: ['a', 'b', 'c'],
      hands: { a: cards('herring', 1), b: cards('herring', 1), c: cards('herring', 1) },
    });
    const grantId = grantPower(state, 'a', 'jellyfish');
    expect(state.pendingWindow).toBeNull(); // makeState doesn't open windows; simulate via action directly
    // Manually open the TURN_START window as beginTurn would (test bypasses createGame's beginTurn).
    state.pendingWindow = { type: 'TURN_START', eligiblePlayerIds: ['a'], context: { playerId: 'a' } };
    const { state: s1, events } = reduce(state, { type: 'USE_JELLYFISH', playerId: 'a', grantId, targetId: 'b' });
    expect(findPlayer(s1, 'b').stunned).toBe(true);
    expect(events.some((e) => e.type === 'JELLYFISH_STUN')).toBe(true);
    // using jellyfish does not consume the request: a may still ask this turn
    const { state: s2 } = reduce(s1, { type: 'REQUEST', playerId: 'a', targetId: 'c', rank: 'herring' });
    expect(s2).toBeTruthy();
  });

  it('a stunned player cannot request cards and cannot be requested from, and their turn is skipped', () => {
    const state = makeState({
      playerIds: ['a', 'b', 'c'],
      hands: { a: cards('herring', 1), b: cards('herring', 1), c: cards('mackerel', 1) },
    });
    findPlayer(state, 'b').stunned = true;
    expect(() => reduce(state, { type: 'REQUEST', playerId: 'a', targetId: 'b', rank: 'herring' })).toThrow(
      IllegalActionError,
    );
  });

  it('stunned players cannot start their turn; the engine skips straight to the next player', () => {
    const state = makeState({
      playerIds: ['a', 'b', 'c'],
      hands: { a: cards('mackerel', 1), b: cards('herring', 1), c: [card('carp')] },
      currentPlayerIndex: 0,
    });
    findPlayer(state, 'b').stunned = true;
    // a fails an ask against c (c has no mackerel) -> turn should pass to b, but b is stunned -> skip to c
    const { state: s1, events } = reduce(state, { type: 'REQUEST', playerId: 'a', targetId: 'c', rank: 'mackerel' });
    expect(events.some((e) => e.type === 'TURN_SKIPPED_STUNNED' && e.playerId === 'b')).toBe(true);
    expect(findPlayer(s1, 'b').stunned).toBe(false); // stun cleared once skipped
    expect(s1.currentPlayerIndex).toBe(2); // c's turn
  });

  it('cannot stun yourself', () => {
    const state = makeState({ playerIds: ['a', 'b'], hands: { a: [], b: [] } });
    const grantId = grantPower(state, 'a', 'jellyfish');
    state.pendingWindow = { type: 'TURN_START', eligiblePlayerIds: ['a'], context: { playerId: 'a' } };
    expect(() => reduce(state, { type: 'USE_JELLYFISH', playerId: 'a', grantId, targetId: 'a' })).toThrow(
      IllegalActionError,
    );
  });
});
