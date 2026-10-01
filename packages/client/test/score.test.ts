import { describe, expect, it } from 'vitest';
import { CALL, LAST, PODIUM } from '../src/audio/render/horn.js';
import { ScoreConductor, type TimedMessage } from '../src/audio/score/conductor.js';
import type { ScoreInput } from '../src/audio/score/input.js';
import { bagOf, formatPhrase, lengthOf, parsePhrase, PHRASES, phraseById, phraseRules, pulseViolations, type ScoreStage } from '../src/audio/score/phrases.js';
import { ceremoniesOf, CUT_LAG_MS, cutOf, planSlots, slotOf, slotTimes, stateAt, stateOf, type ScoreHistory, type Snapshot } from '../src/audio/score/plan.js';
import { createScoreSynth, renderScoreOffline, type SynthMessage } from '../src/audio/score/synth.js';
import { HUM, SCORE_STATES, type ScoreState } from '../src/audio/score/voicing.js';
import { scoreWorkletSource, SCORE_PROCESSOR } from '../src/audio/score/worklet.js';

/* MUSIC_PLAN §10.2: phrases, the plan, the conductor and the synth. */

const STAGES: ScoreStage[] = ['lobby', 'dusk', 'evening', 'night'];

describe('the phrase library (§3.4, Appendix A)', () => {
  it('every call and every answer obeys the cadence table, the range, the accent, the tonic rule, the lengths and the no-pulse rule', () => {
    const broken = PHRASES.map((p) => [p.id, phraseRules(p)] as const).filter(([, r]) => r.length);
    expect(broken).toEqual([]);
  });

  it('every bag has 10 calls; answers: 4 in the waiting room, 6 in the evening and at night, none at dusk', () => {
    for (const s of STAGES) expect(bagOf(s, 'call'), s).toHaveLength(10);
    expect(bagOf('lobby', 'answer')).toHaveLength(4);
    expect(bagOf('dusk', 'answer')).toHaveLength(0);
    expect(bagOf('evening', 'answer')).toHaveLength(6);
    expect(bagOf('night', 'answer')).toHaveLength(6);
    expect(new Set(PHRASES.map((p) => p.id)).size).toBe(PHRASES.length);
    expect(new Set(PHRASES.map((p) => formatPhrase(p.notes))).size).toBe(PHRASES.length); // no phrase twice
  });

  it('the notation reads and writes back', () => {
    const n = parsePhrase('6~ 1.0 → 8 0.4 → 9 1.6↓20 → 12 1.3 |40');
    expect(n).toEqual([{ p: 6, d: 1, sag: 0, trim: 0 }, { p: 8, d: 0.4, sag: 0, trim: 0 }, { p: 9, d: 1.6, sag: 20, trim: 0 }, { p: 12, d: 1.3, sag: 0, trim: 40 }]);
    expect(parsePhrase(formatPhrase(n))).toEqual(n);
    expect(parsePhrase('6~ 1 > 8 0.4 > 9 1.6v20')).toHaveLength(3);
    for (const bad of ['6 1.0 → 8 0.4', '6~ 1.0 → 8~ 0.4', '6~ 1.0 |20 → 8 0.4', 'six~ 1']) expect(() => parsePhrase(bad), bad).toThrow();
  });

  it('the rules can fail: each one catches its own mistake', () => {
    const rule = (stage: ScoreStage, kind: 'call' | 'answer', text: string) => phraseRules({ stage, kind, notes: parsePhrase(text) }).join('; ');
    expect(rule('dusk', 'call', '6~ 1.0 → 8 0.4 → 9 1.6 → 11 1.3')).toMatch(/partial 11 outside the night/);
    expect(rule('dusk', 'call', '6~ 1.0 → 8 0.4 → 9 1.6 → 5 1.3')).toMatch(/ends on 5/);
    expect(rule('evening', 'call', '6~ 1.0 → 8 1.4 → 9 0.3 → 6 1.3')).toMatch(/partial 8 held/);
    expect(rule('night', 'call', '4~ 1.0 → 7 0.45 → 9 1.6 → 7 1.3')).toMatch(/partial 4 in play/);
    expect(rule('night', 'answer', '7~ 0.7 → 9 0.4 → 11 3.3')).toMatch(/length/);
    // round 2's N2: 0.4 / 0.8 / 1.6 is a metric doubling
    expect(pulseViolations(parsePhrase('6~ 0.4 → 8 0.8 → 11 1.6 → 9 0.8')).join()).toMatch(/1:2/);
    // three even intervals, and two in the clock's range
    expect(pulseViolations(parsePhrase('6~ 1.5 → 7 1.5 → 9 1.52 → 7 1'))).not.toEqual([]);
    expect(pulseViolations(parsePhrase('6~ 0.6 → 7 1.5 → 9 0.62 → 7 1'))).not.toEqual([]);
  });

  it('home is a rule in data (§8.2): no in-play voicing holds the tonic class; the call ends on 5; mus.home and the podium on 4', () => {
    for (const s of ['dusk', 'evening', 'night', 'gate', 'last'] as ScoreState[]) for (const prof of ['speaker', 'headphones'] as const) for (const [p] of HUM[s][prof]) expect([2, 4, 8], `${s} ${prof}`).not.toContain(p);
    expect(CALL[CALL.length - 1].partial).toBe(5);
    expect(LAST[LAST.length - 1].partial).toBe(4);
    expect(PODIUM[PODIUM.length - 1].partial).toBe(4);
    // the speaker arrangement keeps every in-play partial at or above 290 Hz
    for (const s of ['dusk', 'evening', 'night', 'gate', 'last'] as ScoreState[]) for (const [p] of HUM[s].speaker) expect(p).toBeGreaterThanOrEqual(5);
  });
});

/* ------------------------------------------------------------------ the plan */

const ZERO = 1_700_000_000_000;
const snap = (at: number, setsPossible: number | null, o: Partial<Snapshot> = {}): Snapshot => ({ at, phase: 'game', setsPossible, misses: 0, limit: 8, ...o });
const hist = (snaps: Snapshot[], seed = 77): ScoreHistory => ({ seed, zero: ZERO, snapshots: snaps });

describe('the plan (§4, §5.2)', () => {
  it('precedence: finale > the last set > the gate > the call > the stage; the pool is not an input', () => {
    const t = ZERO + 60_000;
    expect(stateOf(snap(t, 14), ZERO, t)).toBe('dusk');
    expect(stateOf(snap(t, 12), ZERO, t)).toBe('evening');
    expect(stateOf(snap(t, 6), ZERO, t)).toBe('night');
    expect(stateOf(snap(t, 6, { misses: 4 }), ZERO, t)).toBe('gate');
    expect(stateOf(snap(t, 1, { misses: 4 }), ZERO, t)).toBe('last');
    expect(stateOf(snap(t, 0, { misses: 4 }), ZERO, t)).toBe('finale');
    expect(stateOf(snap(t, 3, { phase: 'ended' }), ZERO, t)).toBe('finale');
    expect(stateOf(snap(ZERO, 18), ZERO, ZERO + 5_000)).toBe('call');
    expect(stateOf(snap(t, 18, { misses: 3 }), ZERO, t)).toBe('dusk'); // 3 of 8 is not half
    expect(stateOf(snap(t, 5, { phase: 'ended' }), ZERO, t + 20_000, t)).toBe('post');
    expect(stateOf(snap(t, null, { phase: 'lobby' }), ZERO, t)).toBe('lobby');
  });

  it('slots fall every 18-42 s from the zero, the same for any window of time asked', () => {
    const all = slotTimes(5, ZERO, ZERO, ZERO + 3_600_000);
    for (let k = 1; k < all.length; k++) {
      const g = all[k].t - all[k - 1].t;
      expect(g).toBeGreaterThanOrEqual(18_000);
      expect(g).toBeLessThanOrEqual(42_000);
    }
    const part = slotTimes(5, ZERO, ZERO + 600_000, ZERO + 900_000);
    expect(part).toEqual(all.filter((s) => s.t >= ZERO + 600_000 && s.t < ZERO + 900_000));
    const mean = (all[all.length - 1].t - all[0].t) / (all.length - 1);
    expect(mean).toBeGreaterThan(26_000);
    expect(mean).toBeLessThan(34_000);
  });

  it('a slot is decided on the broadcasts sent at least 2 s before it', () => {
    const h = hist([snap(ZERO, 18), snap(ZERO + 99_000, 12)]);
    expect(stateAt(h, ZERO + 100_000, 2_000)).toBe('dusk');
    expect(stateAt(h, ZERO + 101_000, 2_000)).toBe('evening');
  });

  it('no phrase recurs within ten consecutive slots of a stage, and one that comes round again takes another take', () => {
    for (const seed of [1, 2, 3, 99, 12345]) {
      for (const state of ['dusk', 'evening', 'night', 'lobby'] as ScoreState[]) {
        const slots = Array.from({ length: 60 }, (_, i) => slotOf(seed, ZERO - 10_000_000, i, ZERO + i * 30_000, state));
        const active = slots.filter((s) => s.active);
        for (let a = 0; a < active.length; a++)
          for (let b = a + 1; b < active.length && active[b].i - active[a].i < 10; b++) expect(active[b].phrase, `${seed} ${state} slots ${active[a].i}/${active[b].i}`).not.toBe(active[a].phrase);
        for (const x of active) for (const y of active) if (x.phrase === y.phrase && Math.abs(x.i - y.i) === 10) expect(x.take).not.toBe(y.take);
      }
    }
  });

  it('no cascade: forcing one slot into another state changes that slot only', () => {
    const base = Array.from({ length: 40 }, (_, i) => slotOf(9, ZERO, i, ZERO + 60_000 + i * 30_000, 'night'));
    const forced = base.map((s, i) => (i === 17 ? slotOf(9, ZERO, i, s.t, 'evening') : slotOf(9, ZERO, i, s.t, 'night')));
    expect(forced.filter((s, i) => JSON.stringify(s) !== JSON.stringify(base[i])).map((s) => s.i)).toEqual([17]);
  });

  it('activity follows the state: none in the gate, the last set, the call or the finale; none in the first 40 s of dusk', () => {
    for (const st of ['gate', 'last', 'call', 'finale'] as ScoreState[]) for (let i = 0; i < 50; i++) expect(slotOf(3, ZERO, i, ZERO + 100_000, st).active).toBe(false);
    for (let i = 0; i < 50; i++) expect(slotOf(3, ZERO, i, ZERO + 30_000, 'dusk').active).toBe(false);
    const rate = (st: ScoreState) => Array.from({ length: 4000 }, (_, i) => slotOf(3, ZERO - 1e9, i, ZERO + 100_000, st)).filter((s) => s.active).length / 4000;
    expect(rate('dusk')).toBeCloseTo(3 / 8, 1);
    expect(rate('evening')).toBeCloseTo(1 / 2, 1);
    expect(rate('night')).toBeCloseTo(3 / 4, 1);
    expect(rate('lobby')).toBeCloseTo(1 / 3, 1);
    // the waiting room calls at every slot for its first three minutes
    for (let i = 0; i < 5; i++) expect(slotOf(3, ZERO, i, ZERO + 20_000 + i * 30_000, 'lobby').active).toBe(true);
  });

  it('the speaker subset is a per-slot hash (about half), and answers are heard on speakers only at night', () => {
    const night = Array.from({ length: 4000 }, (_, i) => slotOf(4, ZERO - 1e9, i, ZERO, 'night')).filter((s) => s.active);
    const share = night.filter((s) => s.speaker).length / night.length;
    expect(share).toBeGreaterThan(0.45);
    expect(share).toBeLessThan(0.55);
    expect(night.filter((s) => s.answer).every((s) => s.answer!.speaker)).toBe(true);
    const eve = Array.from({ length: 400 }, (_, i) => slotOf(4, ZERO - 1e9, i, ZERO, 'evening')).filter((s) => s.answer);
    expect(eve.length).toBeGreaterThan(0);
    expect(eve.every((s) => !s.answer!.speaker)).toBe(true);
    for (const s of night.filter((x) => x.answer)) {
      expect(s.answer!.delayS).toBeGreaterThanOrEqual(0.9);
      expect(s.answer!.delayS).toBeLessThanOrEqual(2.5);
    }
  });

  it('the horn never talks over the horn: no slot within 10 s after a ceremony, decided on server time', () => {
    const h = hist([snap(ZERO, 18), snap(ZERO + 300_000, 1), snap(ZERO + 400_000, 0, { phase: 'ended' })]);
    const c = ceremoniesOf(h);
    expect(c).toEqual([{ from: ZERO, to: ZERO + 8_300 }, { from: ZERO + 300_000, to: ZERO + 302_000 }, { from: ZERO + 400_000, to: ZERO + 404_100 }]);
    for (const s of planSlots(h, ZERO, ZERO + 600_000)) if (s.active) for (const x of c) expect(s.t < x.from || s.t >= x.to + 10_000, `slot ${s.i}`).toBe(true);
  });

  it('purity: the same history gives the same schedule, whenever and however often it is asked', () => {
    const h = hist([snap(ZERO, 18), snap(ZERO + 200_000, 11), snap(ZERO + 500_000, 5)]);
    const a = planSlots(h, ZERO, ZERO + 900_000);
    const b = planSlots(JSON.parse(JSON.stringify(h)), ZERO, ZERO + 900_000);
    expect(b).toEqual(a);
    expect(a.some((s) => s.active)).toBe(true);
    expect(new Set(a.filter((s) => s.active).map((s) => s.state))).toEqual(new Set(['dusk', 'evening', 'night']));
  });

  it('cuts land on the named cue\'s transient (5 ms into it), never on the quiet gate creak', () => {
    expect(CUT_LAG_MS).toBe(5);
    const cues = [{ id: 'table.lay', at: 0 }, { id: 'world.notch', at: 300 }, { id: 'world.dark.12', at: 380 }];
    expect(cutOf('dusk', 'evening', cues)).toEqual({ at: 385, cue: 'world.dark.12', named: true });
    expect(cutOf('night', 'gate', [{ id: 'amb.gate', at: 300 }, { id: 'table.gofish.dry', at: 340 }])).toMatchObject({ at: 345, cue: 'table.gofish.dry', named: true });
    expect(cutOf('gate', 'night', [{ id: 'table.flight', at: 100 }, { id: 'table.give', at: 490 }])).toMatchObject({ at: 495, named: true });
    expect(cutOf('last', 'finale', [{ id: 'table.lay.hidden', at: 5 }, { id: 'mus.podium', at: 900 }])).toMatchObject({ at: 10, named: true });
    // a power's strike shuts or opens the gate too (a Tortoise's block is a miss; a Whale's capture resets the count)
    expect(cutOf('night', 'gate', [{ id: 'power.tortoise', at: 450 }])).toMatchObject({ cue: 'power.tortoise', named: true });
    expect(cutOf('gate', 'evening', [{ id: 'power.windup', at: 200 }, { id: 'power.whale', at: 450 }, { id: 'table.impact', at: 450 }])).toMatchObject({ cue: 'table.impact', named: true });
    expect(cutOf('night', 'finale', [{ id: 'table.gofish.dry', at: 300 }])).toMatchObject({ named: true }); // a stall ending
    expect(cutOf('dusk', 'evening', [{ id: 'table.turn', at: 760 }])).toEqual({ at: 760, cue: 'table.turn', named: false });
  });
});

/* ------------------------------------------------------------------ the conductor */

const game = (at: number, setsPossible: number, o: Partial<ScoreInput> = {}): ScoreInput => ({ phase: 'game', setsPossible, misses: 0, limit: 8, at, zero: ZERO, seed: 4242, ...o });
const humOf = (m: TimedMessage[]) => m.filter((x) => x.msg.type === 'hum');

describe('the conductor (§4.2, §5.2)', () => {
  it('a first look swells in; the call is silent; dusk swells in over 6 s when the call ends; a darkening cuts on its knock', () => {
    const c = new ScoreConductor({ profile: 'headphones', mode: 'on', stereo: true, salt: 1 });
    const first = c.update(game(ZERO, 18), { nowMs: ZERO + 100, live: true, cues: [{ id: 'mus.start', at: 0 }] });
    expect(first.map((m) => m.msg.type)).toEqual(['seed', 'hum']);
    expect((humOf(first)[0].msg as Extract<SynthMessage, { type: 'hum' }>).partials).toEqual([]); // the call: silence
    const dusk = c.tick(ZERO + 8_000, 400);
    expect(humOf(dusk)).toHaveLength(1);
    expect(humOf(dusk)[0].atMs).toBe(ZERO + 8_300);
    expect((humOf(dusk)[0].msg as Extract<SynthMessage, { type: 'hum' }>).rampS).toBe(6);
    const eve = c.update(game(ZERO + 200_000, 12), { nowMs: ZERO + 200_050, live: true, cues: [{ id: 'table.lay', at: 0 }, { id: 'world.dark.12', at: 380 }] });
    expect(humOf(eve)[0].atMs).toBe(ZERO + 200_050 + 380 + CUT_LAG_MS);
    expect((humOf(eve)[0].msg as Extract<SynthMessage, { type: 'hum' }>).rampS).toBe(0.025);
    expect(eve.some((m) => m.msg.type === 'cut' && m.atMs === ZERO + 200_435)).toBe(true);
  });

  it('a rejoin swells into the current state over 1.5 s, with no cut', () => {
    const c = new ScoreConductor({ profile: 'speaker', mode: 'on', stereo: false, salt: 1 });
    const m = c.update(game(ZERO + 400_000, 5), { nowMs: ZERO + 400_010, live: false });
    expect(humOf(m)[0].msg).toMatchObject({ rampS: 1.5 });
    expect(m.some((x) => x.msg.type === 'cut')).toBe(false);
  });

  it('lobby-only (the default before the playtest, D2) is silent in play and sounds in the waiting room; off is silent', () => {
    const lobby = new ScoreConductor({ profile: 'speaker', mode: 'lobby', stereo: false, salt: 1 });
    const inRoom = lobby.update({ phase: 'lobby', setsPossible: null, misses: 0, limit: 0, at: ZERO, zero: ZERO - 60_000, seed: 3 }, { nowMs: ZERO, live: false });
    expect((humOf(inRoom)[0].msg as Extract<SynthMessage, { type: 'hum' }>).partials.length).toBeGreaterThan(0);
    const inGame = lobby.update(game(ZERO + 400_000, 5), { nowMs: ZERO + 400_010, live: false });
    expect((humOf(inGame)[0].msg as Extract<SynthMessage, { type: 'hum' }>).partials).toEqual([]);
    let calls = 0;
    for (let t = ZERO + 400_000; t < ZERO + 1_400_000; t += 200) calls += lobby.tick(t, 400).filter((x) => x.msg.type === 'phrase').length;
    expect(calls).toBe(0);
    const on = new ScoreConductor({ profile: 'headphones', mode: 'on', stereo: true, salt: 1 });
    on.update(game(ZERO + 400_000, 5), { nowMs: ZERO + 400_010, live: false });
    let heard = 0;
    for (let t = ZERO + 400_000; t < ZERO + 1_400_000; t += 200) heard += on.tick(t, 400).filter((x) => x.msg.type === 'phrase').length;
    expect(heard).toBeGreaterThan(10);
    const off = new ScoreConductor({ profile: 'headphones', mode: 'off', stereo: true, salt: 1 });
    off.update(game(ZERO + 400_000, 5), { nowMs: ZERO + 400_010, live: false });
    let offCalls = 0;
    for (let t = ZERO + 400_000; t < ZERO + 1_400_000; t += 200) offCalls += off.tick(t, 400).filter((x) => x.msg.type === 'phrase').length;
    expect(offCalls).toBe(0);
  });

  it('a slot whose chord this client has not cut yet waits for the cut (up to 3 s), then gives up (D-g)', () => {
    const h = { seed: 4242, zero: ZERO, snapshots: [] as Snapshot[] };
    // find a night slot that is active on headphones
    const slot = planSlots({ ...h, snapshots: [snap(ZERO, 5)] }, ZERO + 60_000, ZERO + 3_000_000).find((s) => s.active)!;
    const run = (cutLag: number) => {
      const c = new ScoreConductor({ profile: 'headphones', mode: 'on', stereo: true, salt: 1 });
      c.update(game(ZERO, 8), { nowMs: ZERO + 10, live: false });
      // the broadcast that takes the tally to night arrives 2.5 s before the slot; its knock is presented `cutLag` later
      c.update(game(slot.t - 2_500, 5), { nowMs: slot.t - 2_400, live: true, cues: [{ id: 'world.dark.06', at: cutLag }] });
      const out: TimedMessage[] = [];
      for (let t = slot.t - 2_400; t < slot.t + 5_000; t += 25) out.push(...c.tick(t, 400));
      return out.filter((m) => m.msg.type === 'phrase');
    };
    expect(run(500)[0].atMs).toBe(slot.t); // the cut landed first: on time
    expect(run(4_000)[0].atMs).toBe(slot.t - 2_400 + 4_000 + CUT_LAG_MS + 300); // a backlogged table: after the cut
    expect(run(6_000)).toEqual([]); // too late: the slot goes
  });

  it('rejoin equals staying (#21, in schedule form): a client that arrives at 137 s plays the same slots from then on', () => {
    const feed = [game(ZERO, 18), game(ZERO + 90_000, 12), game(ZERO + 400_000, 6), game(ZERO + 700_000, 3)];
    const stay = new ScoreConductor({ profile: 'headphones', mode: 'on', stereo: true, salt: 1 });
    const late = new ScoreConductor({ profile: 'headphones', mode: 'on', stereo: true, salt: 2 });
    let k = 0;
    for (let t = ZERO; t < ZERO + 900_000; t += 100) {
      while (k < feed.length && feed[k].at <= t) {
        stay.update(feed[k], { nowMs: t, live: false });
        if (feed[k].at >= ZERO + 137_000) late.update(feed[k], { nowMs: t, live: false });
        k++;
      }
      if (t === ZERO + 137_000) late.update({ ...feed[1], at: t }, { nowMs: t, live: false }); // the rejoin's snapshot
      stay.tick(t, 400);
      if (t >= ZERO + 137_000) late.tick(t, 400);
    }
    const after = (c: ScoreConductor) => c.played.filter((p) => p.atMs >= ZERO + 140_000).map((p) => `${p.slot}:${p.phrase}:${p.take}:${p.kind}`);
    expect(after(stay).length).toBeGreaterThan(10);
    expect(after(late)).toEqual(after(stay));
  });
});

/* ------------------------------------------------------------------ the synth */

const SR = 48000;
const seed: SynthMessage = { type: 'seed', seed: 5, zero: 0, salt: 3 };
const clock: SynthMessage = { type: 'clock', frame: 0, serverMs: 0 };
const phraseMsg = (id: string, frame = 4800, extra: Partial<Extract<SynthMessage, { type: 'phrase' }>> = {}): SynthMessage => ({
  type: 'phrase', frame, notes: phraseById(id)!.notes, scoopCents: 50, sagScale: 0, extraTrimMs: 0, gain: 1, lpHz: 900, pan: 0, lipDb: -26, wobble: 0.6, repeats: [], seed: 9, tag: 1, ...extra,
});
/** power at f over n samples from a (Hann) */
const power = (x: Float32Array, f: number, a: number, n: number): number => {
  let re = 0, im = 0;
  for (let i = 0; i < n; i++) {
    const h = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / n);
    re += x[a + i] * h * Math.cos((2 * Math.PI * f * i) / SR);
    im -= x[a + i] * h * Math.sin((2 * Math.PI * f * i) / SR);
  }
  return re * re + im * im;
};
const rmsDb = (x: Float32Array, a: number, b: number): number => {
  let e = 0;
  for (let i = a; i < b; i++) e += x[i] * x[i];
  return 10 * Math.log10(e / Math.max(1, b - a) + 1e-20);
};

describe('the synth (§3.5-§3.6)', () => {
  it('every held note of a phrase sits within 15 cents of its partial (#14, the stable middle of notes >= 300 ms)', () => {
    for (const id of ['D3', 'E4', 'N4', 'L1']) {
      const ph = phraseById(id)!;
      const [x] = renderScoreOffline(SR, lengthOf(ph.notes) + 1, [seed, clock, phraseMsg(id)]);
      let at = 0.1;
      for (const n of ph.notes) {
        if (n.d >= 0.45) {
          const w = Math.floor(0.3 * SR);
          const a = Math.floor((at + n.d / 2 - 0.15) * SR);
          const f0 = 58 * n.p;
          let best = 0, bf = 0;
          for (let f = f0 * 0.98; f < f0 * 1.02; f += 0.1) {
            const p = power(x, f, a, w);
            if (p > best) [best, bf] = [p, f];
          }
          expect(Math.abs(1200 * Math.log2(bf / f0)), `${id} partial ${n.p}`).toBeLessThan(15);
        }
        at += n.d;
      }
    }
  });

  it('no transient: the onset takes at least 80 ms to come within 6 dB of its peak; a slur dips at most 3 dB', () => {
    const [x] = renderScoreOffline(SR, 5, [seed, clock, phraseMsg('D1', 0, { lipDb: -60, wobble: 0 })]);
    const frame = Math.round(0.005 * SR);
    const env: number[] = [];
    for (let a = 0; a + frame < x.length; a += frame) env.push(rmsDb(x, a, a + frame));
    const peak = Math.max(...env.slice(0, Math.round(1 / 0.005)));
    const reach = env.findIndex((e) => e >= peak - 6) * 5;
    expect(reach).toBeGreaterThanOrEqual(80);
    // the slur from 6 to 8 at 1.0 s: the envelope around it against the notes either side
    const ms = (t: number) => Math.round(t / 0.005);
    const around = env.slice(ms(0.97), ms(1.06));
    const before = env.slice(ms(0.8), ms(0.95)).reduce((p, q) => p + q, 0) / (ms(0.95) - ms(0.8));
    const after = env.slice(ms(1.1), ms(1.3)).reduce((p, q) => p + q, 0) / (ms(1.3) - ms(1.1));
    expect(Math.min(...around)).toBeGreaterThan(Math.min(before, after) - 3);
  });

  it('the hum: every partial at its pitch, no period in its envelope (autocorrelation <= 0.3 at 0.3-3 s: #15), no loop', () => {
    const [x] = renderScoreOffline(SR, 40, [seed, clock, { type: 'hum', frame: 0, partials: [[6, 1], [9, 0.5], [12, 0.25]], rampS: 0.025 }]);
    for (const p of [6, 9, 12]) {
      const f0 = 58 * p;
      let best = 0, bf = 0;
      // the centroid-free argmax jitters with a noise-driven peak; over 12 s it is well inside the bar
      for (let f = f0 - 3; f < f0 + 3; f += 0.25) {
        const pw = power(x, f, SR * 2, SR * 12);
        if (pw > best) [best, bf] = [pw, f];
      }
      expect(Math.abs(1200 * Math.log2(bf / f0)), `partial ${p}`).toBeLessThan(10);
    }
    // the envelope in 10 ms frames, mean removed
    const fr = Math.round(0.01 * SR);
    const env: number[] = [];
    for (let a = SR; a + fr < x.length; a += fr) env.push(Math.sqrt(10 ** (rmsDb(x, a, a + fr) / 10)));
    const m = env.reduce((p, q) => p + q, 0) / env.length;
    const e = env.map((v) => v - m);
    const r0 = e.reduce((p, q) => p + q * q, 0);
    let worst = 0;
    for (let lag = 30; lag <= 300; lag++) {
      let r = 0;
      for (let i = 0; i + lag < e.length; i++) r += e[i] * e[i + lag];
      worst = Math.max(worst, r / r0);
    }
    expect(worst).toBeLessThanOrEqual(0.3);
  });

  it('the grain is per client, the wander is public: two salts give different samples and the same slow level', () => {
    const msgs = (salt: number): SynthMessage[] => [{ ...seed, salt } as SynthMessage, clock, { type: 'hum', frame: 0, partials: [[7, 1]], rampS: 0.025 }];
    const [a] = renderScoreOffline(SR, 30, msgs(1));
    const [b] = renderScoreOffline(SR, 30, msgs(2));
    let same = 0;
    for (let i = SR; i < SR + 1000; i++) if (Math.abs(a[i] - b[i]) < 1e-9) same++;
    expect(same).toBeLessThan(10);
    // the level over long stretches agrees within 2 dB (the wander is the same, only the grain differs)
    for (const [f, t] of [[5, 13], [13, 21], [21, 29]]) expect(Math.abs(rmsDb(a, f * SR, t * SR) - rmsDb(b, f * SR, t * SR))).toBeLessThan(2);
  });

  it('a cut fades a phrase with more than 1.5 s left over 300 ms, and lets one nearly done finish', () => {
    const ph = phraseById('D3')!; // 5.8 s
    const [x] = renderScoreOffline(SR, 8, [seed, clock, phraseMsg('D3', 0), { type: 'cut', frame: SR * 2 }]);
    expect(rmsDb(x, Math.round(2.4 * SR), Math.round(3 * SR))).toBeLessThan(-80);
    const [y] = renderScoreOffline(SR, 8, [seed, clock, phraseMsg('D3', 0), { type: 'cut', frame: Math.round((lengthOf(ph.notes) - 1) * SR) }]);
    expect(rmsDb(y, Math.round((lengthOf(ph.notes) - 0.5) * SR), Math.round((lengthOf(ph.notes) - 0.2) * SR))).toBeGreaterThan(-60);
  });

  it('at most two horn voices (a call and its answer); the valley repeats follow a far answer in headphones', () => {
    const syn = createScoreSynth(SR);
    for (const id of ['N1', 'N2', 'N3']) syn.post(phraseMsg(id, 0));
    const L = new Float32Array(128), R = new Float32Array(128);
    syn.process(L, R, 128, 0);
    expect(syn.voices()).toBe(2);
    const ans = phraseById('AN1')!;
    const [x] = renderScoreOffline(SR, 7, [seed, clock, phraseMsg('AN1', 0, { repeats: [{ at: 1.3, db: -12, lpHz: 520 }, { at: 2.9, db: -19, lpHz: 380 }] })]);
    const end = lengthOf(ans.notes) + 0.35;
    // after the phrase has gone, the second repeat is still sounding
    expect(rmsDb(x, Math.round((end + 1.0) * SR), Math.round((end + 1.6) * SR))).toBeGreaterThan(-90);
  });

  it('costs little: the worst moment (hum + call + answer) renders far faster than real time', () => {
    const syn = createScoreSynth(SR);
    syn.post({ type: 'hum', frame: 0, partials: [[5, 1], [7, 1], [9, 1]], rampS: 0.02 });
    for (let k = 0; k < 5; k++) {
      syn.post(phraseMsg('N4', k * 6 * SR));
      syn.post(phraseMsg('AN2', k * 6 * SR + SR, { repeats: [{ at: 1.3, db: -12, lpHz: 520 }, { at: 2.9, db: -19, lpHz: 380 }] }));
    }
    const L = new Float32Array(128), R = new Float32Array(128);
    const t = performance.now();
    for (let f = 0; f < 30 * SR; f += 128) syn.process(L, R, 128, f);
    const ms = performance.now() - t;
    expect(30_000 / ms).toBeGreaterThan(20); // generous under test runners; the harness gates the product at 70x (#23)
  });

  it('the worklet source is one self-contained module that registers the processor and runs', () => {
    let registered: { name: string; cls: new (o: unknown) => { process(i: unknown, o: Float32Array[][]): boolean; port: { onmessage: (e: { data: unknown }) => void } } } | null = null;
    class Proc {
      port = { onmessage: (_e: { data: unknown }) => {}, postMessage: () => {} };
    }
    // eslint-disable-next-line no-new-func
    new Function('AudioWorkletProcessor', 'registerProcessor', 'sampleRate', 'currentFrame', scoreWorkletSource())(Proc, (name: string, cls: never) => (registered = { name, cls }), SR, 0);
    expect(registered!.name).toBe(SCORE_PROCESSOR);
    const p = new registered!.cls({ processorOptions: {} });
    p.port.onmessage({ data: [{ type: 'hum', frame: 0, partials: [[6, 1]], rampS: 0.01 }] });
    const out = [[new Float32Array(128), new Float32Array(128)]];
    for (let k = 0; k < 40; k++) expect(p.process([], out)).toBe(true);
    expect(out[0][0].some((v) => v !== 0)).toBe(true);
  });
});

describe('every state has a voicing for both profiles', () => {
  it('and only the call and the finale are silent', () => {
    for (const s of SCORE_STATES) for (const p of ['speaker', 'headphones'] as const) expect(HUM[s][p].length === 0, `${s} ${p}`).toBe(s === 'call' || s === 'finale');
  });
});

