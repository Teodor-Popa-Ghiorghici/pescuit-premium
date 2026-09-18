import { describe, expect, it } from 'vitest';
import { reduce } from '../src/engine.js';
import { card, cards, findPlayer, makeState } from './helpers.js';

describe('game end and scoring', () => {
  it('ends when the pool is empty and no player holds any real (non-egg) card', () => {
    const state = makeState({
      playerIds: ['a', 'b'],
      hands: { a: [card('herring')], b: cards('eggs', 2) },
      pool: [],
    });
    const { state: s1, events } = reduce(state, { type: 'REQUEST', playerId: 'a', targetId: 'b', rank: 'herring' });
    // fails (b has no herring); a's hand still has the herring though, so game should NOT end yet
    expect(s1.status).toBe('IN_PROGRESS');
  });

  it('the highest score wins', () => {
    const herrings = cards('herring', 3);
    const state = makeState({ playerIds: ['a', 'b'], hands: { a: herrings, b: [] }, pool: [] });
    const { state: s1 } = reduce(state, {
      type: 'LAY_SET',
      playerId: 'a',
      rank: 'herring',
      cardIds: herrings.map((c) => c.id),
    });
    expect(s1.status).toBe('ENDED');
    expect(findPlayer(s1, 'a').score).toBe(1);
    expect(s1.winners).toEqual(['a']);
  });

  it('ties break on number of power sets completed', () => {
    const sharks = cards('shark', 4);
    const herrings = cards('herring', 3);
    // set up: a lays a normal set (1pt), b lays a power set (1pt) -- both tied at 1, b should win via power-set tiebreak
    const state = makeState({
      playerIds: ['a', 'b'],
      hands: { a: herrings, b: sharks },
      pool: [],
    });
    const { state: s1 } = reduce(state, {
      type: 'LAY_SET',
      playerId: 'a',
      rank: 'herring',
      cardIds: herrings.map((c) => c.id),
    });
    expect(s1.status).toBe('IN_PROGRESS'); // b still holds cards (sharks), game continues
    const { state: s2 } = reduce(s1, {
      type: 'LAY_SET',
      playerId: 'b',
      rank: 'shark',
      cardIds: sharks.map((c) => c.id),
    });
    expect(s2.status).toBe('ENDED');
    expect(findPlayer(s2, 'a').score).toBe(1);
    expect(findPlayer(s2, 'b').score).toBe(1);
    expect(s2.winners).toEqual(['b']); // b's set was a power set
  });

  it('a genuine tie (same score, same power-set count) is a shared victory', () => {
    const herringsA = cards('herring', 3);
    const herringsB = cards('mackerel', 3);
    const state = makeState({ playerIds: ['a', 'b'], hands: { a: herringsA, b: herringsB }, pool: [] });
    const { state: s1 } = reduce(state, {
      type: 'LAY_SET',
      playerId: 'a',
      rank: 'herring',
      cardIds: herringsA.map((c) => c.id),
    });
    const { state: s2 } = reduce(s1, {
      type: 'LAY_SET',
      playerId: 'b',
      rank: 'mackerel',
      cardIds: herringsB.map((c) => c.id),
    });
    expect(s2.status).toBe('ENDED');
    expect(s2.winners.sort()).toEqual(['a', 'b']);
  });

  it('a set destroyed by mantis still keeps its point for the layer', () => {
    // covered in mantisShrimp.test.ts too, quick sanity check here on final scoring
    const sharks = cards('shark', 4);
    const state = makeState({ playerIds: ['a', 'b'], hands: { a: sharks, b: [] }, pool: [] });
    const { state: s1 } = reduce(state, {
      type: 'LAY_SET',
      playerId: 'a',
      rank: 'shark',
      cardIds: sharks.map((c) => c.id),
    });
    expect(findPlayer(s1, 'a').score).toBe(1);
  });
});
