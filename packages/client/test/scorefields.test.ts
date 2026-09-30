import { describe, expect, it } from 'vitest';
import { SCORE_FIELDS, scoreInputOf, type ScoreSource } from '../src/audio/score/input.js';

/* MUSIC_PLAN §5.1, §10.2 (`scorefields`): the score reads six public fields through one projection and nothing else. The
 * source handed to `scoreInputOf` is a Proxy over a record stuffed with every forbidden field; any read outside
 * SCORE_FIELDS fails the test. A second test proves the spy can fail. */

/** a Proxy that records every property read, by path */
function spy<T extends object>(obj: T, path: string, reads: string[]): T {
  return new Proxy(obj, {
    get(target, key, recv) {
      if (typeof key === 'symbol') return Reflect.get(target, key, recv);
      const p = `${path}.${key}`;
      reads.push(p);
      const v = Reflect.get(target, key, recv);
      return v && typeof v === 'object' ? spy(v as object, p, reads) : v;
    },
  });
}

/** a view carrying every field the redacted view has, secrets and all */
const fullView = () => ({
  viewerId: 'c', status: 'IN_PROGRESS', turnOrder: ['a', 'b', 'c'], currentPlayerId: 'a', turnCounter: 9, poolCount: 4,
  hand: [{ id: 'x', rank: 'squid' }], players: [{ id: 'a', name: 'A', handSize: 3, score: 2, connected: true }],
  laidSets: [{ id: 's', ownerId: 'a', rank: 'whale', isPowerSet: true }], ownPowerGrants: [{ id: 'g', rank: 'squid', used: false }],
  pendingWindow: { type: 'RESPONSE_PENDING', youAreEligible: true, context: { askerId: 'a', targetId: 'c' }, deadlineAt: 99 },
  config: { powerVisibility: 'ascuns', windowTimeoutMs: 12000 }, mode: 'ascuns', winners: ['a'], scores: { a: 1 }, endReason: null,
  sets: { possible: 7, start: 18 }, endPressure: { misses: 2, limit: 6 }, seq: 77, serverNow: 1_700_000_050_000, startedAt: 1_700_000_000_000,
});

const allowed = new Set<string>([
  ...SCORE_FIELDS.source.map((k) => `src.${k}`),
  ...SCORE_FIELDS.view.map((k) => `src.view.${k}`),
  ...SCORE_FIELDS.sets.map((k) => `src.view.sets.${k}`),
  ...SCORE_FIELDS.endPressure.map((k) => `src.view.endPressure.${k}`),
]);

describe('the score reads only SCORE_FIELDS (Law 1)', () => {
  it('a game view stuffed with every secret: every read is on the list', () => {
    const reads: string[] = [];
    const src = spy({ roomCode: 'ABCDE', createdAt: 1_699_999_000_000, serverNow: 5, view: fullView(), facts: { playerId: 'c' }, seq: 12, players: ['a'] } as unknown as ScoreSource, 'src', reads);
    const inp = scoreInputOf(src);
    expect(reads.filter((r) => !allowed.has(r))).toEqual([]);
    expect(inp).toMatchObject({ phase: 'game', setsPossible: 7, misses: 2, limit: 6, at: 1_700_000_050_000, zero: 1_700_000_000_000 });
  });

  it('the waiting room: the room code, its creation time and the server clock, nothing else', () => {
    const reads: string[] = [];
    const inp = scoreInputOf(spy({ roomCode: 'ABCDE', createdAt: 1_699_999_000_000, serverNow: 1_699_999_010_000, players: ['a', 'b'], config: { powerVisibility: 'ascuns' } } as unknown as ScoreSource, 'src', reads));
    expect(reads.filter((r) => !allowed.has(r))).toEqual([]);
    expect(inp).toMatchObject({ phase: 'lobby', setsPossible: null, zero: 1_699_999_000_000, at: 1_699_999_010_000 });
  });

  it('the spy can fail: a read of a forbidden field is caught', () => {
    const reads: string[] = [];
    const src = spy({ roomCode: 'X', view: fullView() } as unknown as ScoreSource, 'src', reads);
    void (src.view as unknown as { hand: unknown }).hand;
    void (src.view as unknown as { pendingWindow: { type: string } }).pendingWindow.type;
    expect(reads.filter((r) => !allowed.has(r))).toEqual(['src.view.hand', 'src.view.pendingWindow', 'src.view.pendingWindow.type']);
  });

  it('the list itself names nothing private: no hand, grant, window, mode, player, pool, score, winner, laid set or seq', () => {
    const flat = JSON.stringify(SCORE_FIELDS);
    for (const bad of ['hand', 'Grant', 'window', 'Window', 'mode', 'players', 'currentPlayerId', 'playerId', 'poolCount', 'scores', 'winners', 'laidSets', '"seq"', 'powerVisibility']) expect(flat, bad).not.toContain(bad);
  });

  it('the seed is public: the room code and the zero, the same for every viewer, and different in another game', () => {
    const a = scoreInputOf({ roomCode: 'ABCDE', view: { ...fullView(), viewerId: 'a' } });
    const c = scoreInputOf({ roomCode: 'ABCDE', view: { ...fullView(), viewerId: 'c', hand: [] } });
    expect(a.seed).toBe(c.seed);
    expect(scoreInputOf({ roomCode: 'ABCDE', view: { ...fullView(), startedAt: 1_700_000_900_000 } }).seed).not.toBe(a.seed);
    expect(scoreInputOf({ roomCode: 'QWERT', view: fullView() }).seed).not.toBe(a.seed);
  });
});
