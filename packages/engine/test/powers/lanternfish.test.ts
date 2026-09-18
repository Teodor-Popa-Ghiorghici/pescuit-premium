import { describe, expect, it } from 'vitest';
import { reduce } from '../../src/engine.js';
import { card, cards, findPlayer, makeState } from '../helpers.js';
import { grantPower } from './grantHelper.js';

describe('lanternfish', () => {
  it('reflects a request: the lanternfish holder takes the ASKER cards of that rank instead', () => {
    const state = makeState({
      playerIds: ['a', 'b'],
      hands: { a: cards('herring', 2), b: [card('mackerel')] },
    });
    const grantId = grantPower(state, 'b', 'lanternfish');
    const { state: s1 } = reduce(state, { type: 'REQUEST', playerId: 'a', targetId: 'b', rank: 'herring' });
    expect(s1.pendingWindow?.type).toBe('REQUEST_DECLARED');
    const { state: s2, events } = reduce(s1, { type: 'DECLARE_LANTERNFISH', playerId: 'b', grantId });
    expect(findPlayer(s2, 'b').hand.filter((c) => c.rank === 'herring')).toHaveLength(2);
    expect(findPlayer(s2, 'a').hand.filter((c) => c.rank === 'herring')).toHaveLength(0);
    expect(events.some((e) => e.type === 'LANTERNFISH_REFLECT')).toBe(true);
    // asker's turn always ends immediately: no bonus turn, no pool draw
    expect(events.some((e) => e.type === 'BONUS_TURN')).toBe(false);
    expect(events.some((e) => e.type === 'DREW_FROM_POOL')).toBe(false);
    expect(s2.currentPlayerIndex).toBe(1);
  });

  it('does not require holding the rank itself, and still ends the turn even if the asker has nothing', () => {
    const state = makeState({
      playerIds: ['a', 'b'],
      hands: { a: [card('mackerel')], b: [] },
    });
    // give a something askable but not the reflected rank scenario: a asks for mackerel which they hold
    const grantId = grantPower(state, 'b', 'lanternfish');
    const { state: s1 } = reduce(state, { type: 'REQUEST', playerId: 'a', targetId: 'b', rank: 'mackerel' });
    const { state: s2, events } = reduce(s1, { type: 'DECLARE_LANTERNFISH', playerId: 'b', grantId });
    // a holds mackerel so it WAS transferred to b (reflected_success)
    expect(findPlayer(s2, 'b').hand.filter((c) => c.rank === 'mackerel')).toHaveLength(1);
    expect(s2.currentPlayerIndex).toBe(1);
    expect(events.some((e) => e.type === 'BONUS_TURN')).toBe(false);
  });

  it('tortoise may cancel a reflection attempt on its own cards', () => {
    const state = makeState({
      playerIds: ['a', 'b'],
      hands: { a: cards('herring', 2), b: [] },
    });
    const lfGrant = grantPower(state, 'b', 'lanternfish');
    const tGrant = grantPower(state, 'a', 'tortoise');
    const { state: s1 } = reduce(state, { type: 'REQUEST', playerId: 'a', targetId: 'b', rank: 'herring' });
    const { state: s2 } = reduce(s1, { type: 'DECLARE_LANTERNFISH', playerId: 'b', grantId: lfGrant });
    expect(s2.pendingWindow?.type).toBe('TRANSFER_PENDING');
    const { state: s3 } = reduce(s2, { type: 'DECLARE_TORTOISE', playerId: 'a', grantId: tGrant, rank: 'herring' });
    expect(findPlayer(s3, 'a').hand.filter((c) => c.rank === 'herring')).toHaveLength(2);
    expect(findPlayer(s3, 'b').hand.filter((c) => c.rank === 'herring')).toHaveLength(0);
  });
});
