import { describe, expect, it } from 'vitest';
import { reduce, IllegalActionError } from '../src/engine.js';
import { card, cards, findPlayer, makeState } from './helpers.js';

describe('request legality', () => {
  it('requires the asker to hold a real card of the requested rank', () => {
    const state = makeState({
      playerIds: ['a', 'b'],
      hands: { a: [card('mackerel')], b: cards('herring', 2) },
    });
    expect(() =>
      reduce(state, { type: 'REQUEST', playerId: 'a', targetId: 'b', rank: 'herring' }),
    ).toThrow(IllegalActionError);
  });

  it('eggs in hand do not make a rank askable', () => {
    const state = makeState({
      playerIds: ['a', 'b'],
      hands: { a: cards('eggs', 2), b: cards('herring', 2) },
    });
    expect(() =>
      reduce(state, { type: 'REQUEST', playerId: 'a', targetId: 'b', rank: 'herring' }),
    ).toThrow(IllegalActionError);
  });

  it('eggs themselves cannot be requested', () => {
    const state = makeState({
      playerIds: ['a', 'b'],
      hands: { a: cards('eggs', 2), b: cards('eggs', 2) },
    });
    expect(() => reduce(state, { type: 'REQUEST', playerId: 'a', targetId: 'b', rank: 'eggs' })).toThrow(
      IllegalActionError,
    );
  });

  it('cannot request from yourself', () => {
    const state = makeState({ playerIds: ['a', 'b'], hands: { a: [card('herring')], b: [] } });
    expect(() => reduce(state, { type: 'REQUEST', playerId: 'a', targetId: 'a', rank: 'herring' })).toThrow(
      IllegalActionError,
    );
  });

  it('only the current player may request', () => {
    const state = makeState({ playerIds: ['a', 'b'], hands: { a: [card('herring')], b: [card('herring')] } });
    expect(() => reduce(state, { type: 'REQUEST', playerId: 'b', targetId: 'a', rank: 'herring' })).toThrow(
      IllegalActionError,
    );
  });
});

describe('request resolution', () => {
  it('on success, hands over ALL cards of that rank and grants a bonus turn', () => {
    const state = makeState({
      playerIds: ['a', 'b'],
      hands: { a: [card('herring')], b: cards('herring', 2) },
    });
    const { state: s1, events } = reduce(state, { type: 'REQUEST', playerId: 'a', targetId: 'b', rank: 'herring' });
    expect(findPlayer(s1, 'a').hand.filter((c) => c.rank === 'herring')).toHaveLength(3);
    expect(findPlayer(s1, 'b').hand.filter((c) => c.rank === 'herring')).toHaveLength(0);
    expect(events.some((e) => e.type === 'REQUEST_SUCCEEDED')).toBe(true);
    expect(events.some((e) => e.type === 'BONUS_TURN' && e.playerId === 'a')).toBe(true);
    // still player a's turn (bonus)
    expect(s1.currentPlayerIndex).toBe(0);
    expect(s1.resume.kind).toBe('AWAIT_REQUEST');
  });

  it('on failure, the asker draws one card from the pool and turn passes; no bonus turn for the drawn card', () => {
    const state = makeState({
      playerIds: ['a', 'b'],
      hands: { a: [card('herring')], b: [card('mackerel')] },
      pool: [card('carp')],
    });
    const { state: s1, events } = reduce(state, { type: 'REQUEST', playerId: 'a', targetId: 'b', rank: 'herring' });
    expect(events.some((e) => e.type === 'REQUEST_FAILED')).toBe(true);
    expect(events.some((e) => e.type === 'DREW_FROM_POOL' && e.playerId === 'a')).toBe(true);
    expect(findPlayer(s1, 'a').hand.some((c) => c.rank === 'carp')).toBe(true);
    expect(s1.pool.length).toBe(0);
    // turn passed to b
    expect(s1.currentPlayerIndex).toBe(1);
  });

  it('on failure with an empty pool, no draw happens and play continues with hands only', () => {
    const state = makeState({
      playerIds: ['a', 'b'],
      hands: { a: [card('herring')], b: [card('mackerel')] },
      pool: [],
    });
    const { state: s1, events } = reduce(state, { type: 'REQUEST', playerId: 'a', targetId: 'b', rank: 'herring' });
    expect(events.some((e) => e.type === 'DREW_FROM_POOL')).toBe(false);
  });

  it('cannot request from a stunned player', () => {
    const state = makeState({ playerIds: ['a', 'b'], hands: { a: [card('herring')], b: [card('herring')] } });
    findPlayer(state, 'b').stunned = true;
    expect(() => reduce(state, { type: 'REQUEST', playerId: 'a', targetId: 'b', rank: 'herring' })).toThrow(
      IllegalActionError,
    );
  });

  it('if a player starts their turn with an empty hand and the pool has cards, they draw up to 3', () => {
    const state = makeState({
      playerIds: ['a', 'b'],
      hands: { a: [card('herring')], b: [] },
      pool: cards('carp', 5),
    });
    // a asks b for herring: b has none, ask fails, turn passes to b who has an empty hand.
    const { state: s1, events } = reduce(state, { type: 'REQUEST', playerId: 'a', targetId: 'b', rank: 'herring' });
    expect(s1.currentPlayerIndex).toBe(1);
    expect(events.some((e) => e.type === 'HAND_REFILLED' && e.playerId === 'b' && e.count === 3)).toBe(true);
    expect(findPlayer(s1, 'b').hand.length).toBe(3);
  });

  it('refill is capped by however many cards remain in the pool', () => {
    const state = makeState({
      playerIds: ['a', 'b'],
      hands: { a: [card('herring')], b: [] },
      pool: cards('carp', 3),
    });
    const { state: s1, events } = reduce(state, { type: 'REQUEST', playerId: 'a', targetId: 'b', rank: 'herring' });
    // a's failed ask draws 1 first (pool 3 -> 2), then b refills up to 3 but only 2 remain.
    expect(events.some((e) => e.type === 'HAND_REFILLED' && e.count === 2)).toBe(true);
    expect(findPlayer(s1, 'b').hand.length).toBe(2);
    expect(s1.pool.length).toBe(0);
  });
});
