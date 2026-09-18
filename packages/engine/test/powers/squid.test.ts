import { describe, expect, it } from 'vitest';
import { reduce } from '../../src/engine.js';
import { card, cards, findPlayer, makeState } from '../helpers.js';

function grantSquid(state: ReturnType<typeof makeState>, ownerId: string) {
  const set = {
    id: 'squidset',
    ownerId,
    rank: 'squid' as const,
    cardIds: [],
    eggCount: 0,
    isPowerSet: true,
    faceUp: false,
    spent: false,
    destroyedByMantis: false,
  };
  state.laidSets.push(set);
  state.powerGrants.push({
    id: 'gsquid',
    ownerId,
    rank: 'squid',
    sourceSetId: set.id,
    used: false,
    bound: true,
    isClownfishCopy: false,
  });
  return state;
}

describe('squid', () => {
  it('deny: target secretly keeps cards they truly hold; ask reads as a normal failure', () => {
    let state = makeState({
      playerIds: ['a', 'b'],
      hands: { a: [card('herring')], b: cards('herring', 2) },
    });
    state = grantSquid(state, 'b');
    const { state: s1, events } = reduce(state, { type: 'REQUEST', playerId: 'a', targetId: 'b', rank: 'herring' });
    // window opens for squid holder
    expect(s1.pendingWindow?.type).toBe('RESPONSE_PENDING');
    const { state: s2, events: e2 } = reduce(s1, {
      type: 'DECLARE_SQUID',
      playerId: 'b',
      grantId: 'gsquid',
      lie: 'deny',
    });
    // no card moved; b secretly keeps their herrings
    expect(findPlayer(s2, 'b').hand.filter((c) => c.rank === 'herring')).toHaveLength(2);
    expect(findPlayer(s2, 'a').hand.filter((c) => c.rank === 'herring')).toHaveLength(1);
    // reads publicly exactly like a normal failed request
    expect(e2.some((e) => e.type === 'REQUEST_FAILED')).toBe(true);
    // absolutely no event reveals squid was involved
    expect(e2.every((e) => JSON.stringify(e).toLowerCase().includes('squid') === false)).toBe(true);
    expect(events.every((e) => JSON.stringify(e).toLowerCase().includes('squid') === false)).toBe(true);
  });

  it('claim: falsely claims cards; ask fails, asker draws from pool, no cards change hands', () => {
    let state = makeState({
      playerIds: ['a', 'b'],
      hands: { a: [card('herring')], b: [card('mackerel')] },
      pool: [card('carp')],
    });
    state = grantSquid(state, 'b');
    const { state: s1 } = reduce(state, { type: 'REQUEST', playerId: 'a', targetId: 'b', rank: 'herring' });
    const { state: s2, events } = reduce(s1, {
      type: 'DECLARE_SQUID',
      playerId: 'b',
      grantId: 'gsquid',
      lie: 'claim',
    });
    expect(findPlayer(s2, 'b').hand.filter((c) => c.rank === 'herring')).toHaveLength(0);
    expect(findPlayer(s2, 'a').hand.filter((c) => c.rank === 'herring')).toHaveLength(1);
    expect(events.some((e) => e.type === 'DREW_FROM_POOL' && e.playerId === 'a')).toBe(true);
    expect(events.some((e) => e.type === 'REQUEST_FAILED')).toBe(true);
    expect(events.every((e) => JSON.stringify(e).toLowerCase().includes('squid') === false)).toBe(true);
  });

  it('the grant is consumed (used) after a lie, win or lose', () => {
    let state = makeState({
      playerIds: ['a', 'b'],
      hands: { a: [card('herring')], b: cards('herring', 1) },
    });
    state = grantSquid(state, 'b');
    const { state: s1 } = reduce(state, { type: 'REQUEST', playerId: 'a', targetId: 'b', rank: 'herring' });
    const { state: s2 } = reduce(s1, { type: 'DECLARE_SQUID', playerId: 'b', grantId: 'gsquid', lie: 'deny' });
    expect(s2.powerGrants.find((g) => g.id === 'gsquid')?.used).toBe(true);
  });

  it('cannot deny cards you do not truly hold, or claim cards you truly hold', () => {
    let state = makeState({
      playerIds: ['a', 'b'],
      hands: { a: [card('herring')], b: [card('mackerel')] },
    });
    state = grantSquid(state, 'b');
    const { state: s1 } = reduce(state, { type: 'REQUEST', playerId: 'a', targetId: 'b', rank: 'herring' });
    expect(() => reduce(s1, { type: 'DECLARE_SQUID', playerId: 'b', grantId: 'gsquid', lie: 'deny' })).toThrow();
  });
});
