import { describe, expect, it } from 'vitest';
import { createGame, IllegalActionError } from '../src/engine.js';

const P = ['a', 'b', 'c', 'd'].map((id) => ({ id, name: id }));

describe('createGame', () => {
  it('deals 7 cards to each player and puts the rest in the pool', () => {
    const { state } = createGame(P, 42);
    for (const p of state.players) expect(p.hand.length).toBe(7);
    expect(state.pool.length).toBe(66 - 7 * P.length);
  });

  it('is deterministic given the same seed', () => {
    const { state: s1 } = createGame(P, 7);
    const { state: s2 } = createGame(P, 7);
    expect(s1.players.map((p) => p.hand.map((c) => c.id))).toEqual(s2.players.map((p) => p.hand.map((c) => c.id)));
    expect(s1.pool.map((c) => c.id)).toEqual(s2.pool.map((c) => c.id));
  });

  it('produces different deals for different seeds', () => {
    const { state: s1 } = createGame(P, 1);
    const { state: s2 } = createGame(P, 2);
    expect(s1.players.map((p) => p.hand.map((c) => c.id))).not.toEqual(s2.players.map((p) => p.hand.map((c) => c.id)));
  });

  it('rejects fewer than 3 players', () => {
    expect(() => createGame(P.slice(0, 2), 1)).toThrow(IllegalActionError);
  });

  it('rejects more than 6 players', () => {
    const seven = Array.from({ length: 7 }, (_, i) => ({ id: `p${i}`, name: `p${i}` }));
    expect(() => createGame(seven, 1)).toThrow(IllegalActionError);
  });

  it('accepts 3 to 6 players', () => {
    for (let n = 3; n <= 6; n++) {
      const players = Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `p${i}` }));
      expect(() => createGame(players, 1)).not.toThrow();
    }
  });

  it('starts with the first player awaiting a request (or an open TURN_START window)', () => {
    const { state } = createGame(P, 5);
    expect(state.resume.kind).toBe('AWAIT_REQUEST');
    expect(state.currentPlayerIndex).toBe(0);
  });
});
