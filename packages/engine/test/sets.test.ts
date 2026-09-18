import { describe, expect, it } from 'vitest';
import { reduce, IllegalActionError } from '../src/engine.js';
import { card, cards, findPlayer, makeState } from './helpers.js';

describe('laying sets', () => {
  it('lays a normal set of 3 real cards for 1 point, no power', () => {
    const herrings = cards('herring', 3);
    const state = makeState({ playerIds: ['a', 'b'], hands: { a: herrings, b: [] } });
    const { state: s1, events } = reduce(state, {
      type: 'LAY_SET',
      playerId: 'a',
      rank: 'herring',
      cardIds: herrings.map((c) => c.id),
    });
    expect(findPlayer(s1, 'a').score).toBe(1);
    expect(findPlayer(s1, 'a').hand).toHaveLength(0);
    expect(s1.laidSets).toHaveLength(1);
    expect(s1.laidSets[0].isPowerSet).toBe(false);
    expect(events.some((e) => e.type === 'SET_LAID')).toBe(true);
    // no power grant for a normal set
    expect(s1.powerGrants).toHaveLength(0);
  });

  it('lays a power set of 4 real cards and grants the power', () => {
    const sharks = cards('shark', 4);
    const state = makeState({ playerIds: ['a', 'b'], hands: { a: sharks, b: [] } });
    const { state: s1, events } = reduce(state, {
      type: 'LAY_SET',
      playerId: 'a',
      rank: 'shark',
      cardIds: sharks.map((c) => c.id),
    });
    expect(findPlayer(s1, 'a').score).toBe(1);
    expect(s1.powerGrants).toHaveLength(1);
    expect(s1.powerGrants[0]).toMatchObject({ ownerId: 'a', rank: 'shark', used: false });
    expect(events.some((e) => e.type === 'POWER_GRANTED')).toBe(true);
  });

  it('allows up to 2 eggs to substitute in a power set, needing at least 2 real cards', () => {
    const reals = cards('whale', 2);
    const eggs = cards('eggs', 2);
    const state = makeState({ playerIds: ['a', 'b'], hands: { a: [...reals, ...eggs], b: [] } });
    const { state: s1 } = reduce(state, {
      type: 'LAY_SET',
      playerId: 'a',
      rank: 'whale',
      cardIds: [...reals, ...eggs].map((c) => c.id),
    });
    expect(s1.laidSets[0].eggCount).toBe(2);
    expect(s1.powerGrants).toHaveLength(1);
  });

  it('allows 1 egg to substitute in a normal set (2 real + 1 egg)', () => {
    const reals = cards('carp', 2);
    const eggs = cards('eggs', 1);
    const state = makeState({ playerIds: ['a', 'b'], hands: { a: [...reals, ...eggs], b: [] } });
    const { state: s1 } = reduce(state, {
      type: 'LAY_SET',
      playerId: 'a',
      rank: 'carp',
      cardIds: [...reals, ...eggs].map((c) => c.id),
    });
    expect(s1.laidSets[0].eggCount).toBe(1);
  });

  it('rejects a normal set of 1 real + 2 eggs (fewer than 2 real cards)', () => {
    const reals = cards('carp', 1);
    const eggs = cards('eggs', 2);
    const state = makeState({ playerIds: ['a', 'b'], hands: { a: [...reals, ...eggs], b: [] } });
    expect(() =>
      reduce(state, { type: 'LAY_SET', playerId: 'a', rank: 'carp', cardIds: [...reals, ...eggs].map((c) => c.id) }),
    ).toThrow(IllegalActionError);
  });

  it('rejects more than 2 eggs in any substitution set', () => {
    const reals = cards('whale', 1);
    const eggs = cards('eggs', 3);
    const state = makeState({ playerIds: ['a', 'b'], hands: { a: [...reals, ...eggs], b: [] } });
    expect(() =>
      reduce(state, {
        type: 'LAY_SET',
        playerId: 'a',
        rank: 'whale',
        cardIds: [...reals, ...eggs.slice(0, 3)].map((c) => c.id),
      }),
    ).toThrow(IllegalActionError);
  });

  it('4 eggs alone form a set worth 1 point with no power', () => {
    const eggs = cards('eggs', 4);
    const state = makeState({ playerIds: ['a', 'b'], hands: { a: eggs, b: [] } });
    const { state: s1 } = reduce(state, {
      type: 'LAY_SET',
      playerId: 'a',
      rank: 'eggs',
      cardIds: eggs.map((c) => c.id),
    });
    expect(findPlayer(s1, 'a').score).toBe(1);
    expect(s1.laidSets[0].isPowerSet).toBe(false);
    expect(s1.powerGrants).toHaveLength(0);
  });

  it('rejects laying cards not in hand', () => {
    const state = makeState({ playerIds: ['a', 'b'], hands: { a: cards('herring', 2), b: [] } });
    expect(() =>
      reduce(state, { type: 'LAY_SET', playerId: 'a', rank: 'herring', cardIds: ['bogus1', 'bogus2', 'bogus3'] }),
    ).toThrow(IllegalActionError);
  });

  it('the same power rank can be completed independently by two different players', () => {
    const stateA = makeState({
      playerIds: ['a', 'b'],
      hands: { a: [...cards('jellyfish', 2), ...cards('eggs', 2)], b: [...cards('jellyfish', 2), ...cards('eggs', 2)] },
    });
    const aCards = stateA.players[0].hand.map((c) => c.id);
    const { state: s1 } = reduce(stateA, { type: 'LAY_SET', playerId: 'a', rank: 'jellyfish', cardIds: aCards });
    const bCards = s1.players[1].hand.map((c) => c.id);
    const { state: s2 } = reduce(s1, { type: 'LAY_SET', playerId: 'b', rank: 'jellyfish', cardIds: bCards });
    const jellyfishGrants = s2.powerGrants.filter((g) => g.rank === 'jellyfish');
    expect(jellyfishGrants).toHaveLength(2);
    expect(jellyfishGrants.map((g) => g.ownerId).sort()).toEqual(['a', 'b']);
  });
});
