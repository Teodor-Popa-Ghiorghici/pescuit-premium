import { describe, expect, it } from 'vitest';
import { SOUND_FIELDS, cuesFor, soundInputOf, type PublicEvent, type PublicRecord, type SeatFacts } from '../src/audio/cues.js';

/* SOUND_DESIGN §3: the exact public fields a cue may read, and nothing else. The mapping layer is handed the raw record;
 * this test hands it a Proxy that writes down every property it touches, stuffed with every field a server could send one
 * client and not another (or a bug could add), and fails on any read that is not on the list. */

type Path = string;

/** wraps `value` so every property read is recorded under its path; array indices and player-id keys collapse */
function spy<T extends object>(value: T, path: Path, seen: Set<Path>, collapse: (p: Path) => boolean): T {
  return new Proxy(value, {
    get(target, key, receiver) {
      const v = Reflect.get(target, key, receiver);
      if (typeof key === 'symbol') return v;
      const isIndex = Array.isArray(target) && /^\d+$/.test(key);
      if (Array.isArray(target) && (isIndex || key === 'length' || typeof v === 'function')) {
        return isIndex && v && typeof v === 'object' ? spy(v as object, `${path}[]`, seen, collapse) : v;
      }
      const child = collapse(path) ? `${path}.*` : `${path}.${key}`;
      seen.add(child);
      return v && typeof v === 'object' ? spy(v as object, child, seen, collapse) : v;
    },
  });
}

const VIEW_FIELDS = SOUND_FIELDS.view as readonly string[];
/** every path the list allows, in the form the spy writes them */
function allowed(): Set<Path> {
  const ok = new Set<Path>();
  for (const k of SOUND_FIELDS.record) ok.add(`record.${k}`);
  for (const side of ['before', 'after']) {
    for (const k of VIEW_FIELDS) ok.add(`record.${side}.${k}`);
    for (const k of SOUND_FIELDS.window) ok.add(`record.${side}.window.${k}`);
    for (const k of SOUND_FIELDS.endPressure) ok.add(`record.${side}.endPressure.${k}`);
    ok.add(`record.${side}.scores.*`);
  }
  for (const [type, fields] of Object.entries(SOUND_FIELDS.events)) {
    ok.add('record.events[].type');
    for (const f of fields) ok.add(`record.events[].${f}`);
    void type;
  }
  for (const k of SOUND_FIELDS.facts) ok.add(`facts.${k}`);
  return ok;
}

const PRIVATE = {
  rank: 'squid', cardId: 'card-egg', grantId: 'g-1', unbound: true, boundRank: 'squid', setId: 's-1', sourceSetId: 's-1', eligiblePlayerIds: ['c'], context: { rank: 'squid' }, seed: 9,
  playerId: 'a', askerId: 'a', targetId: 'b', fromId: 'a', count: 2, poolEmpty: false, isPowerSet: true, eggCount: 2,
};
const VIEW_PRIVATE = {
  viewerId: 'c', hand: [{ id: 'x', rank: 'squid' }], ownPowerGrants: [{ id: 'g', rank: 'squid', used: true }], seq: 77, serverNow: 5, winners: ['a'], endReason: 'decided', config: { powerVisibility: 'ascuns' },
  turnOrder: ['a', 'b'], currentPlayerId: 'a', handSizes: { a: 3 }, laidSets: [{ id: 's-1', rank: 'squid', spent: true }], ended: false,
};

const event = (e: { type: string }): PublicEvent => ({ ...PRIVATE, ...e }) as unknown as PublicEvent;
const TYPES = [
  'GAME_STARTED', 'TURN_STARTED', 'TURN_SKIPPED_STUNNED', 'BONUS_TURN', 'HAND_REFILLED', 'REQUEST_MADE', 'REQUEST_SUCCEEDED', 'REQUEST_FAILED', 'DREW_FROM_POOL', 'SET_LAID', 'SET_DESTROYED',
  'POWER_GRANTED', 'POWER_USED', 'CLOWNFISH_BOUND', 'SHARK_JUMP', 'LANTERNFISH_REFLECT', 'TORTOISE_BLOCK', 'JELLYFISH_STUN', 'STICKLEBACK_STEAL', 'STICKLEBACK_WASTED', 'WHALE_SHUFFLE', 'GAME_ENDED',
  'WINDOW_OPENED', 'WINDOW_CLOSED',
];
const answer = { type: 'RESPONSE_PENDING', askerId: 'a', targetId: 'b', deadlineAt: 1000, youAreEligible: true, context: { rank: 'squid', trueHasCards: true } };
const structural = { type: 'TURN_END', youAreEligible: true, eligiblePlayerIds: ['c'], context: { rank: 'squid' } };
const view = (window: object | null, tally: number) => ({
  ...VIEW_PRIVATE, players: ['a', 'b', 'c', 'd'], poolCount: 4, window, setsPossible: tally, endPressure: { misses: 2, limit: 8, staleStreak: 2 }, scores: { a: 1, b: 2 },
});
const FACTS: SeatFacts = { playerId: 'c', headphones: true, closePlayedLocally: false, eligible: true, eligibleBefore: false, grantRank: () => 'squid' };

function reads(record: PublicRecord, facts: SeatFacts): Set<Path> {
  const seen = new Set<Path>();
  const collapse = (p: Path) => p.endsWith('.scores');
  cuesFor(spy(record, 'record', seen, collapse), spy(facts, 'facts', seen, collapse));
  return seen;
}

describe('sound reads only the fields SOUND_DESIGN §3 lists', () => {
  const record = (over: Partial<PublicRecord> = {}): PublicRecord => ({
    seq: 999,
    mode: 'ascuns',
    chain: 2,
    ordinal: 11,
    before: view(answer, 14) as never,
    after: view(structural, 12) as never,
    events: TYPES.map((t) => event({ type: t })),
    ...over,
  });

  it('every property the mapping touches is on the list - with every private field present to be tempted by', () => {
    const ok = allowed();
    const touched = reads(record(), FACTS);
    const strays = [...touched].filter((p) => !ok.has(p));
    expect(strays).toEqual([]);
    // the test can fail: it did read the fields it is allowed
    for (const p of ['record.after.poolCount', 'record.after.setsPossible', 'record.events[].eggCount', 'record.events[].isPowerSet', 'facts.playerId']) expect(touched.has(p), p).toBe(true);
  });

  it('and in Mode Deschis, on a game with no window at all, and on a first look with no "before"', () => {
    const ok = allowed();
    for (const r of [record({ mode: 'deschis' }), record({ before: view(null, 12) as never, after: view(null, 12) as never }), record({ before: null })]) {
      expect([...reads(r, FACTS)].filter((p) => !ok.has(p))).toEqual([]);
    }
  });

  it('never a hand, a grant, a card id, a rank, an eligibility flag, a window\'s context, or the room\'s seq', () => {
    const touched = [...reads(record(), FACTS)].join('\n');
    for (const bad of ['hand', 'ownPowerGrants', 'cardId', 'grantId', 'rank', 'youAreEligible', 'eligiblePlayerIds', 'context', 'unbound', 'boundRank', 'sourceSetId', 'setId', 'laidSets', 'seq', 'eligible', 'grantRank', 'headphones', 'winners', 'viewerId', 'serverNow', 'deadlineAt'])
      expect(touched, bad).not.toMatch(new RegExp(`\\.${bad}\\b`));
  });

  it('the spy can fail: a read of a forbidden field is caught, a read of an allowed one is not', () => {
    const seen = new Set<Path>();
    const r = spy(record(), 'record', seen, (p) => p.endsWith('.scores'));
    void (r.after as unknown as { hand: unknown }).hand;
    void (r.events[0] as unknown as { cardId: unknown }).cardId;
    void r.after.poolCount;
    const strays = [...seen].filter((p) => !allowed().has(p));
    expect(strays.sort()).toEqual(['record.after.hand', 'record.events[].cardId']);
  });

  it('the projection is all the mapping sees: a fresh object with none of the raw fields on it', () => {
    const input = soundInputOf(record(), FACTS);
    const dump = JSON.stringify(input);
    for (const bad of ['squid', 'card-egg', 'g-1', 'trueHasCards', 'youAreEligible', 'grantId', 'hand']) expect(dump, bad).not.toContain(bad);
    expect(input.events.length).toBeGreaterThan(10);
    // a structural window is not in the projection at all
    expect(input.events.some((e) => (e.type as string).startsWith('WINDOW'))).toBe(false);
  });
});
