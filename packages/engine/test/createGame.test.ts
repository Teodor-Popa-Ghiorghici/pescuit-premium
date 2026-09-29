import { describe, expect, it } from 'vitest';
import { buildDeck, seededDeck } from '../src/deck.js';
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
    expect(s1.players.map((p) => p.hand)).toEqual(s2.players.map((p) => p.hand));
    expect(s1.pool).toEqual(s2.pool);
  });

  it('produces different deals for different seeds', () => {
    const { state: s1 } = createGame(P, 1);
    const { state: s2 } = createGame(P, 2);
    expect(s1.players.map((p) => p.hand.map((c) => c.rank))).not.toEqual(
      s2.players.map((p) => p.hand.map((c) => c.rank)),
    );
  });

  it('deals an explicit ordered deck: 7 rounds of one card per player from the front, the rest is the pool', () => {
    const deck = buildDeck((_r, i) => `id-${i}`);
    const { state } = createGame(P, deck);
    expect(state.players[0].hand.map((c) => c.id)).toEqual([0, 4, 8, 12, 16, 20, 24].map((i) => `id-${i}`));
    expect(state.players[3].hand.map((c) => c.id)).toEqual([3, 7, 11, 15, 19, 23, 27].map((i) => `id-${i}`));
    expect(state.pool.map((c) => c.id)).toEqual(deck.slice(28).map((c) => c.id));
  });

  it('rejects a deck that is not the 66 cards of the game', () => {
    const deck = buildDeck();
    expect(() => createGame(P, deck.slice(1))).toThrow(IllegalActionError);
    expect(() => createGame(P, [...deck.slice(1), { ...deck[0], id: deck[1].id }])).toThrow(IllegalActionError);
    expect(() => createGame(P, [...deck.slice(1), { id: 'x', rank: 'eggs' }])).toThrow(IllegalActionError);
  });

  it('keeps no random state: GameState carries no seed, rngState or entropy', () => {
    const { state } = createGame(P, 7);
    const keys = Object.keys(JSON.parse(JSON.stringify(state)));
    for (const k of ['seed', 'rngState', 'entropy']) expect(keys).not.toContain(k);
  });

  it('seeded decks give every card an id that does not encode its rank', () => {
    for (const c of seededDeck(3)) expect(c.id).not.toMatch(/squid|shark|herring|eggs/);
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
