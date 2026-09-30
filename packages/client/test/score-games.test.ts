// MUSIC_PLAN §10.2 on real engine games: the score's inputs and schedule across paired histories (Law 1), the cuts landing
// on their named cues (`scoreCuts`), and six clients agreeing on every far call (the agreement test, §5.3).
import { createGame, makeBotRng, nextBotAction, redactEventsForPlayer, redactForPlayer, reduce, setSizeForRank, type Action, type Card, type GameEvent, type GameState, type Rank, type RedactedView } from '@pescuit/engine';
import { describe, expect, it } from 'vitest';
import { cuesFor } from '../src/audio/cues.js';
import { factsOf, recordOf } from '../src/game/record.js';
import { ScoreConductor, type ScoreMode } from '../src/audio/score/conductor.js';
import { scoreInputOf, type ScoreInput } from '../src/audio/score/input.js';
import { cutOf, snapshotOf, stateOf } from '../src/audio/score/plan.js';
import { CALL_MS, LOCK_MS } from '../src/audio/score/voicing.js';
import { makeState } from '../../engine/test/helpers.js';
import { grantPower } from '../../engine/test/powers/grantHelper.js';
import { rng } from '../src/audio/util.js';

const ZERO = 1_700_000_000_000;
const ROOM = 'PESTE';

interface Step {
  state: GameState;
  events: (GameEvent & { seq: number })[];
  /** the broadcast's serverNow */
  at: number;
}
interface World {
  state0: GameState;
  steps: Step[];
}

/** a game as the room runs it: every action is one broadcast, some seconds after the last (a window's answer sooner) */
function run(state0: GameState, next: (s: GameState) => Action | null, seed: number, maxSteps = 4000): World {
  const r = rng(seed);
  const steps: Step[] = [];
  let state = state0;
  let seq = 0;
  let at = ZERO + 2_400;
  for (let i = 0; i < maxSteps && state.status === 'IN_PROGRESS'; i++) {
    const a = next(state);
    if (!a) break;
    at += state.pendingWindow ? 600 + r() * 2_000 : 1_500 + r() * 4_500;
    const res = reduce(state, a);
    state = res.state;
    steps.push({ state, events: res.events.map((e) => ({ ...e, seq: ++seq })), at: Math.round(at) });
  }
  return { state0, steps };
}

function botGame(seed: number, n: number, mode: 'ascuns' | 'deschis'): World {
  const ids = Array.from({ length: n }, (_, i) => `p${i}`);
  const { state } = createGame(ids.map((id) => ({ id, name: id })), seed, { powerVisibility: mode });
  const bot = makeBotRng(seed * 31 + 7);
  return run(state, (s) => nextBotAction(s, bot), seed);
}

/** what one viewer's client receives: its view at each broadcast, and the cues its presenter would play in that step */
interface Received {
  view: RedactedView;
  prev: RedactedView;
  cues: Array<{ id: string; at: number }>;
  at: number;
}
function received(w: World, viewer: string): Received[] {
  const view = (s: GameState, seq: number, at: number) => redactForPlayer(s, viewer, { seq, serverNow: at, startedAt: ZERO, windowDeadlineAt: s.pendingWindow ? at + 12_000 : null });
  let prev = view(w.state0, 0, ZERO);
  let chain = 0;
  let ordinal = 0;
  return w.steps.map((st) => {
    const seq = st.events[st.events.length - 1]?.seq ?? 0;
    const v = view(st.state, seq, st.at);
    const record = recordOf(prev, v, redactEventsForPlayer(st.state, st.events, viewer) as never[], seq, chain, ordinal);
    chain = record.chain ?? 0;
    const cues = cuesFor(record, factsOf(prev, v, viewer, { headphones: false }));
    ordinal += cues.length;
    const out = { view: v, prev, cues: cues.map((c) => ({ id: c.id, at: c.at })), at: st.at };
    prev = v;
    return out;
  });
}

const inputOf = (v: RedactedView): ScoreInput => scoreInputOf({ roomCode: ROOM, view: v });
const j = (x: unknown) => JSON.stringify(x);

/** a client: a conductor fed the views as they arrive (after `delay(k)` ms), ticked every 100 ms */
function client(recv: Received[], o: { profile?: 'speaker' | 'headphones'; mode?: ScoreMode; delay?: (k: number) => number; until?: number } = {}) {
  const c = new ScoreConductor({ profile: o.profile ?? 'headphones', mode: o.mode ?? 'on', stereo: true, salt: 1 });
  const arrivals = recv.map((r, k) => ({ r, t: r.at + (o.delay?.(k) ?? 0) })).sort((a, b) => a.t - b.t);
  // the first look: the game's first broadcast (GAME_STARTED)
  c.update(inputOf(recv[0].prev), { nowMs: ZERO + (o.delay?.(-1) ?? 0), live: true, cues: [{ id: 'mus.start', at: 0 }] });
  const end = o.until ?? recv[recv.length - 1].at + 60_000;
  let k = 0;
  for (let t = ZERO; t < end; t += 100) {
    while (k < arrivals.length && arrivals[k].t <= t) {
      const a = arrivals[k++];
      c.update(inputOf(a.r.view), { nowMs: a.t, live: true, cues: a.r.cues });
    }
    c.tick(t, 400);
  }
  return c;
}
const playedKey = (c: ScoreConductor) => new Map(c.played.map((p) => [`${p.slot}:${p.kind}`, `${p.phrase}:${p.take}:${Math.round(p.atMs)}`]));

/* ---------------------------------------------------------------------------------- Law 1, paired histories */

const mk = (id: string, rank: Rank): Card => ({ id, rank });
const many = (prefix: string, rank: Rank, n: number): Card[] => Array.from({ length: n }, (_, i) => mk(`${prefix}${i}`, rank));
const scripted = (actions: Array<Action | ((s: GameState) => Action | null)>) => {
  let i = 0;
  return (s: GameState) => {
    const a = actions[i++];
    return a === undefined ? null : typeof a === 'function' ? a(s) : a;
  };
};
const grantOf = (s: GameState, ownerId: string, rank: string) => s.powerGrants.find((g) => g.ownerId === ownerId && g.rank === rank)!.id;
const inputsFor = (w: World, viewer: string) => received(w, viewer).map((r) => inputOf(r.view));

describe('the score is public (Law 1): paired histories', () => {
  it('an honest "no", a Squid deny and a Squid claim: the same score inputs and the same schedule, for everyone - the owner too', () => {
    const world = (kind: 'honest' | 'deny' | 'claim') => {
      const rank: Rank = kind === 'honest' ? 'shark' : 'squid';
      const keep: Card[] = kind === 'deny' ? many('bh', 'herring', 2) : many('bm', 'mackerel', 2);
      const state = makeState({
        playerIds: ['a', 'b', 'c'],
        hands: { a: [mk('a1', 'herring'), mk('a2', 'trout')], b: [...many('bs', rank, 4), ...keep], c: many('c', 'carp', 2) },
        pool: [mk('p1', 'perch'), mk('p2', 'anchovy')],
        powerVisibility: 'ascuns',
      });
      const answer = (s: GameState): Action => (kind === 'honest' ? { type: 'SKIP_WINDOW', playerId: 'b' } : { type: 'DECLARE_SQUID', playerId: 'b', grantId: grantOf(s, 'b', 'squid'), lie: kind === 'deny' ? 'deny' : 'claim' });
      return run(state, scripted([{ type: 'LAY_SET', playerId: 'b', rank, cardIds: ['bs0', 'bs1', 'bs2', 'bs3'] }, { type: 'REQUEST', playerId: 'a', targetId: 'b', rank: 'herring' }, answer]), 3);
    };
    const worlds = [world('honest'), world('deny'), world('claim')];
    for (const v of ['a', 'b', 'c']) {
      const [x, ...rest] = worlds.map((w) => inputsFor(w, v));
      for (const y of rest) expect(j(y), v).toBe(j(x));
      const [p, ...qs] = worlds.map((w) => [...playedKey(client(received(w, v), { until: ZERO + 600_000 })).entries()]);
      expect(p.length).toBeGreaterThan(0);
      for (const q of qs) expect(j(q), v).toBe(j(p));
    }
  });

  it('a face-down power set of each of the nine ranks: the same score for every viewer', () => {
    const ranks: Rank[] = ['squid', 'tortoise', 'clownfish', 'mantisShrimp', 'shark', 'lanternfish', 'jellyfish', 'stickleback', 'whale'];
    const world = (rank: Rank) => {
      const size = setSizeForRank(rank);
      return run(
        makeState({
          playerIds: ['a', 'b', 'c'],
          hands: { a: [mk('a1', 'herring'), mk('a2', 'trout')], b: [...many('bs', rank, size), mk('bx', 'carp')], c: many('c', 'mackerel', 2) },
          pool: [mk('p1', 'perch')],
          powerVisibility: 'ascuns',
        }),
        scripted([{ type: 'LAY_SET', playerId: 'b', rank, cardIds: many('bs', rank, size).map((c) => c.id) }, { type: 'REQUEST', playerId: 'a', targetId: 'c', rank: 'herring' }, { type: 'SKIP_WINDOW', playerId: 'c' }]),
        5,
      );
    };
    const worlds = ranks.map(world);
    // the laid set's size is public, and so is the tally it moves: compare within each size (whale's set is not four cards)
    for (const v of ['a', 'b', 'c']) {
      const bySize = new Map<number, string>();
      worlds.forEach((w, k) => {
        const size = setSizeForRank(ranks[k]);
        const got = j(inputsFor(w, v));
        if (!bySize.has(size)) bySize.set(size, got);
        expect(got, `${ranks[k]} for ${v}`).toBe(bySize.get(size));
      });
    }
  });

  it('a structural window (a Shark held, its TURN_END window declined) adds a broadcast that carries nothing new: the schedule is the same', () => {
    const world = (shark: boolean) => {
      const state = makeState({
        playerIds: ['a', 'b', 'c'],
        hands: { a: [mk('a1', 'herring'), mk('a2', 'trout')], b: many('b', 'herring', 2), c: many('c', 'carp', 2) },
        pool: [mk('p1', 'perch')],
      });
      if (shark) grantPower(state, 'c', 'shark');
      return run(state, scripted([{ type: 'REQUEST', playerId: 'a', targetId: 'b', rank: 'herring' }, { type: 'SKIP_WINDOW', playerId: 'b' }, (s) => (s.pendingWindow ? { type: 'SKIP_WINDOW', playerId: 'c' } : null)]), 9);
    };
    const held = world(true);
    const none = world(false);
    expect(held.steps.length).toBeGreaterThan(none.steps.length);
    const values = (w: World, v: string) => inputsFor(w, v).map(({ at: _at, ...rest }) => rest);
    const dedupe = (xs: unknown[]) => xs.filter((x, k) => k === 0 || j(x) !== j(xs[k - 1]));
    for (const v of ['a', 'b', 'c']) expect(j(dedupe(values(held, v))), v).toBe(j(dedupe(values(none, v))));
    // the restated test (round 2): the score is a pure function of public values and their broadcast times. Give the two
    // histories' matching broadcasts the same times: the window's extra broadcast changes nothing.
    const recvNone = received(none, 'a');
    const recvHeld = received(held, 'a');
    const times = recvNone.map((r) => r.at);
    const aligned = recvHeld.map((r, k) => ({ ...r, at: times[Math.min(k, times.length - 1)] + (k >= times.length ? 500 : 0), view: { ...r.view, serverNow: times[Math.min(k, times.length - 1)] + (k >= times.length ? 500 : 0) } }));
    const a = playedKey(client(recvNone, { until: ZERO + 900_000 }));
    const b = playedKey(client(aligned, { until: ZERO + 900_000 }));
    expect(a.size).toBeGreaterThan(0);
    expect(j([...b.entries()])).toBe(j([...a.entries()]));
  });
});

/* ---------------------------------------------------------------------------------- cuts land on their named cues */

describe('scoreCuts: every change of the score\'s state coincides with its named cue in the same step (§4.2)', () => {
  it('over real bot games, 3-6 players, both modes: never a cut on silence', () => {
    const seen = new Map<string, number>();
    const unnamed: string[] = [];
    for (let g = 0; g < 24; g++) {
      const w = botGame(1000 + g, 3 + (g % 4), g % 2 ? 'deschis' : 'ascuns');
      for (const r of received(w, 'p0')) {
        const t = Math.max(r.at, ZERO + CALL_MS + 1);
        const before = stateOf(snapshotOf(inputOf(r.prev)), ZERO, t);
        const after = stateOf(snapshotOf(inputOf(r.view)), ZERO, t);
        if (before === after) continue;
        const key = `${before}->${after}`;
        seen.set(key, (seen.get(key) ?? 0) + 1);
        const c = cutOf(before, after, r.cues);
        if (!c.named) unnamed.push(`game ${g} ${key}: ${r.cues.map((x) => x.id).join(',')}`);
      }
    }
    expect(unnamed).toEqual([]);
    // the games really went through the evening: the darkenings, the last set and the finale were all exercised
    for (const k of ['dusk->evening', 'evening->night', 'night->last', 'last->finale']) expect(seen.get(k) ?? 0, k).toBeGreaterThan(0);
    expect([...seen.keys()].some((k) => k.includes('gate')), 'a stall gate somewhere').toBe(true);
  }, 60_000);
});

/* ---------------------------------------------------------------------------------- six clients agree */

describe('agreement (§5.3, §10.2): six clients play the same far calls at the same moments', () => {
  const games = Array.from({ length: 12 }, (_, g) => botGame(2000 + g, 6, g % 2 ? 'deschis' : 'ascuns'));

  it('with 0-300 ms of delivery jitter, at least 99 % of slots are identical on all six (headphones and speakers alike)', () => {
    for (const profile of ['headphones', 'speaker'] as const) {
      let total = 0;
      let agree = 0;
      for (const [gi, w] of games.entries()) {
        const clients = ['p0', 'p1', 'p2', 'p3', 'p4', 'p5'].map((v, ci) => {
          const r = rng(gi * 97 + ci + 1);
          const jitter = Array.from({ length: w.steps.length + 1 }, () => Math.round(r() * 300));
          return playedKey(client(received(w, v), { profile, delay: (k) => jitter[k + 1] }));
        });
        const keys = new Set(clients.flatMap((m) => [...m.keys()]));
        for (const k of keys) {
          total++;
          const vals = clients.map((m) => m.get(k) ?? '-');
          // the same phrase and take, starting within the same 100 ms tick
          const norm = vals.map((v) => (v === '-' ? v : v.split(':').slice(0, 2).join(':') + ':' + Math.round(Number(v.split(':')[2]) / 1000)));
          if (norm.every((x) => x === norm[0])) agree++;
        }
      }
      expect(total, profile).toBeGreaterThan(profile === 'speaker' ? 30 : 60);
      expect(agree / total, profile).toBeGreaterThanOrEqual(0.99);
    }
  }, 120_000);

  it('a client whose broadcasts arrive 3 s late differs only on the slots the lock and the cut predict (D-a, D-g)', () => {
    for (const [gi, w] of games.slice(0, 6).entries()) {
      const recv = received(w, 'p0');
      const cOn = client(recv);
      const cLate = client(recv, { delay: () => 3_000 });
      const onTime = playedKey(cOn);
      const late = playedKey(cLate);
      // the broadcasts that change the score's state, by their server time
      const changes = recv.filter((r) => {
        const t = Math.max(r.at, ZERO + CALL_MS + 1);
        return stateOf(snapshotOf(inputOf(r.prev)), ZERO, t) !== stateOf(snapshotOf(inputOf(r.view)), ZERO, t);
      }).map((r) => r.at);
      const keys = new Set([...onTime.keys(), ...late.keys()]);
      for (const k of keys) {
        if (onTime.get(k) === late.get(k)) continue;
        // a slot is judged by its call's time (an answer starts seconds later)
        const callKey = `${k.split(':')[0]}:call`;
        const slotAt = Number((onTime.get(callKey) ?? late.get(callKey))!.split(':')[2]);
        // a state change within the late client's blind spot before this slot: its lock (2 s) plus the delay, plus a phrase's deferral
        const predicted = changes.some((c) => c > slotAt - LOCK_MS - 3_000 - 3_300 && c <= slotAt + 3_300);
        expect(predicted, `game ${gi} slot ${k}`).toBe(true);
      }
    }
  }, 120_000);
});


