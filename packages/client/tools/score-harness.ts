/* The score's half of the audio harness (MUSIC_PLAN §10.1, checks #14-#23). Bundled with harness-entry.ts and run in
 * headless Chromium: the score's own DSP (synth.ts, the same function the AudioWorklet runs) rendered offline, fed into
 * the product's Score bus, its duck and darkening gain, its stem and the profile EQ, summed with the pond and the table
 * through the product's dynamics - and measured with the same meter as every cue.
 */

import { Ambience, scoreWetFactor } from '../src/audio/ambience.js';
import { ANCHOR_LUFS, CUES, type Profile } from '../src/audio/cuesheet.js';
import { measure, shortTermMax, integrated, fft } from '../src/audio/measure.js';
import { buildStemGraph } from '../src/audio/mixer.js';
import { Biquad, hp, lp } from '../src/audio/render/dsp.js';
import { ScoreConductor, type TimedMessage } from '../src/audio/score/conductor.js';
import type { ScoreInput } from '../src/audio/score/input.js';
import { SCORE_SYNTH } from '../src/audio/score/levels.js';
import { lengthOf, PHRASES, TAKES, type Phrase } from '../src/audio/score/phrases.js';
import { CUT_LAG_MS, cutCuesFor } from '../src/audio/score/plan.js';
import { createScoreSynth, renderScoreOffline, type SynthMessage } from '../src/audio/score/synth.js';
import { ANSWER_DB, ANSWER_LP_HZ, CALL_LP_HZ, HUM, humGains, type ScoreState } from '../src/audio/score/voicing.js';
import type { CueParams } from '../src/audio/recipes.js';

type Stems = Float32Array[];
type Graph = ReturnType<typeof buildStemGraph>;

export interface ScoreHarnessDeps {
  sr: number;
  programDb: Record<Profile, number>;
  renderStems(profile: Profile, seconds: number, fill: (ctx: OfflineAudioContext, graph: Graph) => void): Promise<Stems>;
  chain(stems: Array<Float32Array | null>, programDb: number): { out: Float32Array };
  /** places one cue on the graph (the product's spawnVoice) */
  place(ctx: OfflineAudioContext, graph: Graph, profile: Profile, id: string, at: number, params?: CueParams): void;
  /** each Clock cue's loudness alone through the chain, per profile */
  clockLufs: Record<Profile, Record<string, number>>;
  log(m: string): void;
}

export interface ScoreCheck {
  n: number;
  title: string;
  fail: string[];
}

const PROFILES: Profile[] = ['speaker', 'headphones'];
const f1 = (v: number) => (Number.isFinite(v) ? v.toFixed(1) : '—');
const dbToLin = (d: number) => 10 ** (d / 20);
const row = (cells: Array<string | number>) => `| ${cells.join(' | ')} |`;
const table = (head: string[], rows: Array<Array<string | number>>) => [row(head), row(head.map(() => '---')), ...rows.map(row)].join('\n');

/** the in-play states whose world is measured, with the darkening step each sits in */
const PLAY: Array<{ state: ScoreState; step: number }> = [
  { state: 'dusk', step: 0 },
  { state: 'evening', step: 1 },
  { state: 'night', step: 2 },
  { state: 'gate', step: 2 },
  { state: 'last', step: 3 },
];
/** the pond's states: its wetness is not a score input, so the hum cannot follow it (round 2) - it is measured instead */
const PONDS: Array<{ name: string; poolCount: number; poolStart: number; dry: boolean }> = [
  { name: 'wet', poolCount: 20, poolStart: 20, dry: false },
  { name: 'half', poolCount: 10, poolStart: 20, dry: false },
  { name: 'nearly empty', poolCount: 1, poolStart: 20, dry: false },
  { name: 'dry', poolCount: 0, poolStart: 20, dry: true },
];

const humMessages = (state: ScoreState, profile: Profile, salt = 3): SynthMessage[] => [
  { type: 'seed', seed: 77, zero: 0, salt },
  { type: 'clock', frame: 0, serverMs: 0 },
  { type: 'hum', frame: 0, partials: humGains(state, profile), rampS: 0.01 },
];

const phraseMessage = (ph: Phrase, frame: number, answer: boolean, take = 0, repeats = false): SynthMessage => {
  const tk = TAKES[take];
  return {
    type: 'phrase', frame, notes: ph.notes, scoopCents: tk.scoopCents, sagScale: tk.sagScale, extraTrimMs: tk.extraTrimMs,
    gain: dbToLin(answer ? ANSWER_DB : 0), lpHz: answer ? ANSWER_LP_HZ : CALL_LP_HZ, pan: 0, lipDb: -26, wobble: 0.6,
    repeats: repeats ? [{ at: 1.3, db: -12, lpHz: 520 }, { at: 2.9, db: -19, lpHz: 380 }] : [], seed: 11, tag: 0,
  };
};

/** mono render of synth messages: the centre of the two channels. `centre` holds every hum partial at the middle of its
 *  +-3 dB wander: the voicing as designed (a 40 s render sees two or three knots, so the wander would decide the level) */
function synthMono(sr: number, seconds: number, msgs: SynthMessage[], from = 0, centre = false): Float32Array {
  const [l, r] = renderScoreOffline(sr, seconds, msgs, centre ? { ...SCORE_SYNTH, wanderDb: 0 } : SCORE_SYNTH, from);
  const m = new Float32Array(l.length);
  for (let i = 0; i < l.length; i++) m[i] = 0.5 * (l[i] + r[i]);
  return m;
}

function bufferOf(ctx: OfflineAudioContext, x: Float32Array): AudioBufferSourceNode {
  const b = ctx.createBuffer(1, x.length, ctx.sampleRate);
  b.getChannelData(0).set(x);
  const s = ctx.createBufferSource();
  s.buffer = b;
  return s;
}

/** the long-term power spectrum (Welch, Hann, 50 % overlap) */
function psd(x: Float32Array, sr: number, n = 16384, from = 0): { p: Float64Array; hz: number } {
  const p = new Float64Array(n / 2);
  const re = new Float32Array(n), im = new Float32Array(n);
  let count = 0;
  for (let a = from; a + n <= x.length; a += n / 2) {
    for (let i = 0; i < n; i++) {
      re[i] = x[a + i] * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / n));
      im[i] = 0;
    }
    fft(re, im);
    for (let k = 0; k < n / 2; k++) p[k] += re[k] * re[k] + im[k] * im[k];
    count++;
  }
  for (let k = 0; k < n / 2; k++) p[k] /= Math.max(1, count);
  return { p, hz: sr / n };
}
const bandPower = (s: { p: Float64Array; hz: number }, lo: number, hi: number): number => {
  let e = 0;
  for (let k = Math.ceil(lo / s.hz); k <= Math.floor(hi / s.hz); k++) e += s.p[k];
  return e;
};
const thirdOctave = (f: number): [number, number] => [f / 2 ** (1 / 6), f * 2 ** (1 / 6)];

/** 5 ms RMS envelope, dB */
function envelope(x: Float32Array, sr: number, ms = 5): number[] {
  const n = Math.round((ms / 1000) * sr);
  const out: number[] = [];
  for (let a = 0; a + n <= x.length; a += n) {
    let e = 0;
    for (let i = a; i < a + n; i++) e += x[i] * x[i];
    out.push(10 * Math.log10(e / n + 1e-20));
  }
  return out;
}

/** the frequency of the strongest peak near `f0` in a slice, by a zero-padded FFT and parabolic interpolation */
function peakHz(x: Float32Array, sr: number, from: number, len: number, f0: number): number {
  const n = 32768;
  const re = new Float32Array(n), im = new Float32Array(n);
  for (let i = 0; i < len && i < n; i++) re[i] = (x[from + i] ?? 0) * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / len));
  fft(re, im);
  const hz = sr / n;
  let best = -Infinity, bk = 0;
  for (let k = Math.floor((f0 * 0.97) / hz); k <= Math.ceil((f0 * 1.03) / hz); k++) {
    const m = re[k] * re[k] + im[k] * im[k];
    if (m > best) [best, bk] = [m, k];
  }
  const mag = (k: number) => Math.log(re[k] * re[k] + im[k] * im[k] + 1e-30);
  const [a, b, c] = [mag(bk - 1), mag(bk), mag(bk + 1)];
  const d = (0.5 * (a - c)) / (a - 2 * b + c || 1e-12);
  return (bk + d) * hz;
}
const cents = (f: number, ref: number) => 1200 * Math.log2(f / ref);

/** 1-4 kHz: two high-pass and two low-pass biquads (a fourth-order band) */
function speechBand(x: Float32Array, sr: number): Float32Array {
  const f = [new Biquad(hp(1000, 0.7071, sr)), new Biquad(hp(1000, 0.7071, sr)), new Biquad(lp(4000, 0.7071, sr)), new Biquad(lp(4000, 0.7071, sr))];
  const y = new Float32Array(x.length);
  for (let i = 0; i < x.length; i++) {
    let v = x[i];
    for (const q of f) v = q.tick(v);
    y[i] = v;
  }
  return y;
}

/** drives a conductor through a feed of broadcasts and ticks it every 100 ms: what a client would post, frames from `fromMs` */
function conduct(profile: Profile, feed: Array<{ at: number; input: ScoreInput }>, fromMs: number, toMs: number, sr: number, salt = 3): { msgs: SynthMessage[]; conductor: ScoreConductor } {
  const c = new ScoreConductor({ profile, mode: 'on', stereo: false, salt });
  const timed: TimedMessage[] = [];
  let k = 0;
  for (let t = fromMs; t < toMs; t += 100) {
    while (k < feed.length && feed[k].at <= t) timed.push(...c.update(feed[k++].input, { nowMs: t, live: false }));
    timed.push(...c.tick(t, 400));
  }
  const msgs: SynthMessage[] = [{ type: 'clock', frame: 0, serverMs: fromMs }];
  for (const m of timed) msgs.push({ ...m.msg, frame: Math.max(0, Math.round(((m.atMs - fromMs) / 1000) * sr)) } as SynthMessage);
  return { msgs, conductor: c };
}

export async function runScoreChecks(d: ScoreHarnessDeps): Promise<{ checks: ScoreCheck[]; report: string; numbers: Record<string, unknown> }> {
  const SR = d.sr;
  const SECONDS = 40;
  const checks: ScoreCheck[] = [];
  const report: string[] = [];
  const numbers: Record<string, unknown> = {};

  const worldStems = (profile: Profile, o: { state: ScoreState | null; step: number; pond: (typeof PONDS)[number] | null; scene?: 'lobby' | 'game'; scoreOn: boolean; seconds?: number; salt?: number }) =>
    d.renderStems(profile, o.seconds ?? SECONDS, (ctx, g) => {
      if (o.pond) {
        const amb = new Ambience(ctx, g.buses.Ambience, 5);
        amb.start(0);
        amb.update({ poolCount: o.pond.poolCount, poolStart: o.pond.poolStart, dry: o.pond.dry, scene: o.scene ?? 'game', scoreOn: o.scoreOn }, true);
        amb.schedule(o.seconds ?? SECONDS);
      }
      g.setDarkStep(o.step, 0, true);
      if (o.pond) g.scoreWet.gain.value = scoreWetFactor({ poolCount: o.pond.poolCount, poolStart: o.pond.poolStart, scene: o.scene ?? 'game' }, o.pond.dry);
      if (o.state && o.scoreOn) {
        const src = bufferOf(ctx, synthMono(SR, o.seconds ?? SECONDS, humMessages(o.state, profile, o.salt), 0, true));
        src.connect(g.buses.Score);
        src.start(0);
      }
    });
  // short-term max of the world stem (pond + hum), skipping the first second: the window under the anchor
  const worldLevel = (st: Stems, p: Profile) => shortTermMax(d.chain([null, null, st[2], st[3]], d.programDb[p]).out.subarray(SR), SR);
  // its integrated loudness: "unchanged from today" is a statement about level, not about the loudest 3 s of a noise
  const worldIntegrated = (st: Stems, p: Profile) => integrated(d.chain([null, null, st[2], st[3]], d.programDb[p]).out.subarray(SR), SR);

  /* ---- #17 the world window, #18 presence ---- */
  const world: Record<Profile, Array<{ state: string; pond: string; today: number; withScore: number; hum: number; todayI: number; withScoreI: number }>> = { speaker: [], headphones: [] };
  const presence: Array<{ profile: Profile; state: string; pond: string; partial: number; snr: number }> = [];
  for (const p of PROFILES) {
    for (const { state, step } of PLAY) {
      for (const pond of PONDS) {
        // the wind's gusts come every 12-30 s: a dry world is rendered as long as the bed check renders it (180 s), or its
        // short-term max depends on how many gusts fell in the window
        const seconds = pond.dry ? 180 : SECONDS;
        const alone = await worldStems(p, { state: null, step, pond, scoreOn: false, seconds });
        const today = worldLevel(alone, p);
        const st = await worldStems(p, { state, step, pond, scoreOn: true, seconds });
        const withScore = worldLevel(st, p);
        const hum = shortTermMax(d.chain([null, null, null, st[3]], d.programDb[p]).out.subarray(SR), SR);
        world[p].push({ state, pond: pond.name, today, withScore, hum, todayI: worldIntegrated(alone, p), withScoreI: worldIntegrated(st, p) });
        const sp = psd(st[3], SR, 16384, SR), sb = psd(st[2], SR, 16384, SR);
        for (const [partial] of HUM[state][p]) {
          const [lo, hi] = thirdOctave(58 * partial);
          presence.push({ profile: p, state, pond: pond.name, partial, snr: 10 * Math.log10(bandPower(sp, lo, hi) / Math.max(1e-30, bandPower(sb, lo, hi))) });
        }
      }
    }
  }
  d.log('score: the world window and presence');
  const window17: string[] = [];
  for (const p of PROFILES)
    for (const w of world[p]) {
      const under = ANCHOR_LUFS[p] - w.withScore;
      if (under < 12 || under > 20) window17.push(`${p} ${w.state}/${w.pond} ${f1(under)} LU under`);
      if (Math.abs(w.withScoreI - w.todayI) > 0.3) window17.push(`${p} ${w.state}/${w.pond} ${(w.withScoreI - w.todayI).toFixed(2)} dB from today`);
    }
  checks.push({ n: 17, title: 'the world window: pond or wind + hum sits 12-20 LU under the anchor (short-term max) in every state, and its integrated loudness is within 0.3 dB of today\'s pond alone, the hum at the centre of its wander', fail: window17 });
  checks.push({ n: 18, title: 'presence: every hum partial, at the centre of its wander, at least 0 dB over the pond or the wind in its own third-octave band', fail: presence.filter((x) => x.snr < 0).map((x) => `${x.profile} ${x.state}/${x.pond} partial ${x.partial} ${f1(x.snr)} dB`) });
  numbers.world = world;
  numbers.presence = presence;
  report.push('### The world stem with the score (#17), short-term max LUFS', table(['Profile', 'State', 'Pond', 'Pond alone, today', 'Pond + hum', 'Under the anchor LU', 'Hum alone', 'Integrated: today / with the score, difference dB'], PROFILES.flatMap((p) => world[p].map((w) => [p, w.state, w.pond, f1(w.today), f1(w.withScore), f1(ANCHOR_LUFS[p] - w.withScore), f1(w.hum), `${f1(w.todayI)} / ${f1(w.withScoreI)}, ${(w.withScoreI - w.todayI).toFixed(2)}`]))));
  const worstPresence = new Map<string, number>();
  for (const x of presence) {
    const k = `${x.profile} ${x.state} partial ${x.partial}`;
    worstPresence.set(k, Math.min(worstPresence.get(k) ?? Infinity, x.snr));
  }
  report.push('### Presence (#18): each hum partial over the pond or the wind in its third-octave band, worst pond state, dB', table(['Profile, state, partial', 'SNR dB'], [...worstPresence].map(([k, v]) => [k, f1(v)])));

  /* ---- #22 the waiting room ---- */
  const lobby22: string[] = [];
  const lobbyRows: Array<Array<string | number>> = [];
  const calls = PHRASES.filter((x) => x.kind === 'call');
  for (const p of PROFILES) {
    const st = await worldStems(p, { state: 'lobby', step: 0, pond: PONDS[0], scene: 'lobby', scoreOn: true });
    const lvl = worldLevel(st, p);
    const today = worldLevel(await worldStems(p, { state: null, step: 0, pond: PONDS[0], scene: 'lobby', scoreOn: false }), p);
    let loudestCall = -Infinity;
    for (const ph of calls.filter((x) => x.stage === 'lobby')) {
      const len = lengthOf(ph.notes) + 1;
      const s = await d.renderStems(p, len, (ctx, g) => {
        const src = bufferOf(ctx, synthMono(SR, len, [phraseMessage(ph, Math.round(0.05 * SR), false)]));
        src.connect(g.buses.Score);
        src.start(0);
      });
      loudestCall = Math.max(loudestCall, measure(d.chain([null, null, null, s[3]], d.programDb[p]).out, SR).momentaryMax);
    }
    if (ANCHOR_LUFS[p] - lvl < 7) lobby22.push(`${p} world ${f1(ANCHOR_LUFS[p] - lvl)} LU under`);
    if (ANCHOR_LUFS[p] - loudestCall < 6) lobby22.push(`${p} a call ${f1(ANCHOR_LUFS[p] - loudestCall)} LU under`);
    lobbyRows.push([p, f1(today), f1(ANCHOR_LUFS[p] - today), f1(lvl), f1(ANCHOR_LUFS[p] - lvl), f1(loudestCall), f1(ANCHOR_LUFS[p] - loudestCall)]);
  }
  checks.push({ n: 22, title: 'the waiting room: the world stem at least 7 LU under the anchor, its calls at least 6', fail: lobby22 });
  report.push('### The waiting room (#22)', table(['Profile', 'Pond alone today LUFS', 'LU under', 'Pond + hum LUFS', 'LU under', 'Loudest lobby call, momentary max', 'LU under'], lobbyRows));
  d.log('score: the waiting room');

  /* ---- #19 distance and the clock; #14 the key; #15 onsets and slurs ---- */
  const callRows: Record<Profile, { loudest: number; id: string }> = { speaker: { loudest: -Infinity, id: '' }, headphones: { loudest: -Infinity, id: '' } };
  const key14: string[] = [];
  const onset15: string[] = [];
  let worstCents = 0;
  let slowestOnset = Infinity;
  let deepestDip = 0;
  for (const ph of PHRASES) {
    if (ph.stage === 'lobby') continue; // the waiting room's own rule is #22
    const answer = ph.kind === 'answer';
    const len = lengthOf(ph.notes) + 1;
    const dry = synthMono(SR, len, [phraseMessage(ph, Math.round(0.05 * SR), answer)]);
    for (const p of PROFILES) {
      const s = await d.renderStems(p, len, (ctx, g) => {
        const src = bufferOf(ctx, dry);
        src.connect(g.buses.Score);
        src.start(0);
      });
      const mm = measure(d.chain([null, null, null, s[3]], d.programDb[p]).out, SR).momentaryMax;
      if (mm > callRows[p].loudest) callRows[p] = { loudest: mm, id: ph.id };
    }
    // #14: held notes' stable middle (>= 300 ms of a note of at least 450 ms)
    let at = 0.05;
    for (const n of ph.notes) {
      if (n.d >= 0.45) {
        const f = peakHz(dry, SR, Math.round((at + n.d / 2 - 0.15) * SR), Math.round(0.3 * SR), 58 * n.p);
        const c = Math.abs(cents(f, 58 * n.p));
        worstCents = Math.max(worstCents, c);
        if (c > 15) key14.push(`${ph.id} partial ${n.p} ${f1(c)} cents`);
      }
      at += n.d;
    }
    // #15: the onset swells (>= 80 ms to within 6 dB of the phrase's first-second peak), slurs dip <= 3 dB
    const env = envelope(dry, SR);
    const start = Math.round(0.05 / 0.005);
    const peak = Math.max(...env.slice(start, start + 200));
    const reach = (env.slice(start).findIndex((e) => e >= peak - 6)) * 5;
    slowestOnset = Math.min(slowestOnset, reach);
    if (reach < 80) onset15.push(`${ph.id} onset reaches -6 dB in ${reach} ms`);
    let t = 0.05;
    ph.notes.forEach((n, k) => {
      if (k > 0 && ph.notes[k - 1].d >= 0.3 && n.d >= 0.3) {
        const fr = (s: number) => Math.round(s / 0.005);
        const mean = (a: number, b: number) => env.slice(fr(a), fr(b)).reduce((x, y) => x + y, 0) / Math.max(1, fr(b) - fr(a));
        const around = Math.min(...env.slice(fr(t - 0.01), fr(t + 0.04)));
        const ref = Math.min(mean(t - 0.15, t - 0.02), mean(t + 0.06, t + 0.2));
        deepestDip = Math.max(deepestDip, ref - around);
        if (ref - around > 3) onset15.push(`${ph.id} slur into note ${k + 1} dips ${f1(ref - around)} dB`);
      }
      t += n.d;
    });
  }
  d.log('score: every phrase measured');

  // the hum's envelope has no period (#15), and its partials sit on the key (#14)
  let worstAc = 0;
  let worstHumCents = 0;
  for (const { state } of [...PLAY, { state: 'lobby' as ScoreState, step: 0 }]) {
    const x = synthMono(SR, 62, humMessages(state, 'headphones'));
    const s = psd(x, SR, 65536, SR);
    for (const [partial] of HUM[state].headphones) {
      // the centroid within +-2 Hz: a noise-driven 3 Hz-wide peak's argmax jitters (round 2), its centroid does not
      const f0 = 58 * partial;
      let e = 0, ef = 0;
      for (let k = Math.ceil((f0 - 2) / s.hz); k <= Math.floor((f0 + 2) / s.hz); k++) {
        e += s.p[k];
        ef += s.p[k] * k * s.hz;
      }
      const c = Math.abs(cents(ef / e, f0));
      worstHumCents = Math.max(worstHumCents, c);
      if (c > 5) key14.push(`hum ${state} partial ${partial} ${f1(c)} cents`);
    }
    const fr = Math.round(0.01 * SR);
    const env: number[] = [];
    for (let a = SR; a + fr < x.length; a += fr) {
      let q = 0;
      for (let i = a; i < a + fr; i++) q += x[i] * x[i];
      env.push(Math.sqrt(q / fr));
    }
    const m = env.reduce((a, b) => a + b, 0) / env.length;
    const e = env.map((v) => v - m);
    const r0 = e.reduce((a, b) => a + b * b, 0);
    for (let lag = 30; lag <= 300; lag++) {
      let r = 0;
      for (let i = 0; i + lag < e.length; i++) r += e[i] * e[i + lag];
      if (r / r0 > worstAc) worstAc = r / r0;
    }
  }
  if (worstAc > 0.3) onset15.push(`hum envelope autocorrelation ${worstAc.toFixed(2)}`);
  checks.push({ n: 14, title: 'the key: every held note of every phrase within 15 cents of its partial; every hum partial\'s centroid within 5 cents', fail: key14 });
  checks.push({ n: 15, title: 'no pulse, no transient, no loop: every onset swells over at least 80 ms to within 6 dB of its peak (a seat signature\'s attack is under 10 ms, so no phrase can be heard as a knock), every slur dips at most 3 dB, the written durations pass the no-pulse rule (phrases.test.ts), the hum\'s envelope autocorrelation is at most 0.3 at 0.3-3 s', fail: onset15 });
  report.push('### The key and the shape (#14, #15)', `Worst held note: ${f1(worstCents)} cents off its partial. Worst hum partial centroid: ${f1(worstHumCents)} cents. Slowest onset: at least ${slowestOnset} ms to come within 6 dB of its peak. Deepest slur dip: ${f1(deepestDip)} dB. Largest hum envelope autocorrelation at 0.3-3 s: ${worstAc.toFixed(2)}.`);

  const clock19: string[] = [];
  const clockRows: Array<Array<string | number>> = [];
  for (const p of PROFILES) {
    const worldMax = Math.max(...world[p].map((w) => w.withScore));
    const call = callRows[p].loudest;
    if (ANCHOR_LUFS[p] - call < 14) clock19.push(`${p} ${callRows[p].id} ${f1(ANCHOR_LUFS[p] - call)} LU under the anchor`);
    for (const [id, l] of Object.entries(d.clockLufs[p])) {
      if (l - worldMax < 10) clock19.push(`${id} on ${p} ${f1(l - worldMax)} LU over the world`);
      if (l - call < 10) clock19.push(`${id} on ${p} ${f1(l - call)} LU over the loudest call`);
      clockRows.push([id, p, f1(l), f1(l - worldMax), f1(l - call)]);
    }
  }
  checks.push({ n: 19, title: 'distance and the clock: every in-play call\'s momentary max at least 14 LU under the anchor; every Clock cue at least 10 LU over the world stem and over the loudest call, on both profiles', fail: clock19 });
  report.push('### Distance and the clock (#19)', `Loudest in-play phrase, momentary max: speaker ${f1(callRows.speaker.loudest)} LUFS (\`${callRows.speaker.id}\`, ${f1(ANCHOR_LUFS.speaker - callRows.speaker.loudest)} LU under the anchor); headphones ${f1(callRows.headphones.loudest)} LUFS (\`${callRows.headphones.id}\`, ${f1(ANCHOR_LUFS.headphones - callRows.headphones.loudest)} LU under).`, table(['Clock cue', 'Profile', 'Alone LUFS', 'Over the loudest world LU', 'Over the loudest call LU'], clockRows));
  numbers.calls = callRows;

  /* ---- #16 speech room: a busy night minute, calls, answers and repeats ---- */
  const speech16: string[] = [];
  const speechRows: Array<Array<string | number>> = [];
  for (const p of PROFILES) {
    const night = PHRASES.filter((x) => x.stage === 'night');
    const msgs = humMessages('night', p);
    let t = 1;
    for (const ph of night.filter((x) => x.kind === 'call').slice(0, 6)) {
      msgs.push(phraseMessage(ph, Math.round(t * SR), false));
      const ans = night.find((x) => x.kind === 'answer')!;
      msgs.push(phraseMessage(ans, Math.round((t + lengthOf(ph.notes) - ph.notes[ph.notes.length - 1].d + 1.2) * SR), true, 0, p === 'headphones'));
      t += 9;
    }
    const s = await d.renderStems(p, 58, (ctx, g) => {
      g.setDarkStep(2, 0, true);
      const src = bufferOf(ctx, synthMono(SR, 58, msgs));
      src.connect(g.buses.Score);
      src.start(0);
    });
    const out = d.chain([null, null, null, s[3]], d.programDb[p]).out;
    const band = shortTermMax(speechBand(out, SR), SR);
    const under = ANCHOR_LUFS[p] - band;
    if (under < (p === 'speaker' ? 30 : 28)) speech16.push(`${p} ${f1(under)} LU under`);
    speechRows.push([p, f1(shortTermMax(out, SR)), f1(band), f1(under)]);
  }
  checks.push({ n: 16, title: 'speech room: the score\'s 1-4 kHz short-term max at least 30 LU (speaker) / 28 LU (headphones) under the anchor', fail: speech16 });
  report.push('### Speech room (#16): a busy night minute (hum, six calls, their answers)', table(['Profile', 'Score short-term max LUFS', '1-4 kHz short-term max LUFS', 'LU under the anchor'], speechRows));
  d.log('score: speech room');

  /* ---- #20 cuts land on knocks ---- */
  const cut20: string[] = [];
  const T0 = 2.0;
  const st = await d.renderStems('speaker', 3, (ctx, g) => {
    const msgs: SynthMessage[] = [{ type: 'seed', seed: 77, zero: 0, salt: 3 }, { type: 'clock', frame: 0, serverMs: 0 }, { type: 'hum', frame: 0, partials: humGains('evening', 'speaker'), rampS: 0.01 }, { type: 'hum', frame: Math.round((T0 + CUT_LAG_MS / 1000) * SR), partials: humGains('night', 'speaker'), rampS: 0.025 }];
    const src = bufferOf(ctx, synthMono(SR, 3, msgs));
    src.connect(g.buses.Score);
    src.start(0);
    d.place(ctx, g, 'speaker', 'world.dark.06', T0, { step: 2 });
  });
  // the ramp itself, exactly: the partial that leaves (10) rendered alone with and without the cut from the same noise - their
  // ratio is the synth's gain, sample by sample (a noise envelope's own fluctuation would blur a 25 ms ramp)
  const one = (cut: boolean): Float32Array => synthMono(SR, 3, [{ type: 'seed', seed: 77, zero: 0, salt: 3 }, { type: 'clock', frame: 0, serverMs: 0 }, { type: 'hum', frame: 0, partials: [[10, 1]], rampS: 0.01 }, ...(cut ? [{ type: 'hum' as const, frame: Math.round((T0 + CUT_LAG_MS / 1000) * SR), partials: [] as Array<[number, number]>, rampS: 0.025 }] : [])]);
  const withCut = one(true), steady = one(false);
  const gainAt = (ms: number): number => {
    let a = 0, b = 0;
    for (let i = Math.round((ms / 1000) * SR); i < Math.round(((ms + 1) / 1000) * SR); i++) { a += withCut[i] * steady[i]; b += steady[i] * steady[i]; }
    return b > 0 ? a / b : 1;
  };
  let t10 = NaN, t90 = NaN;
  for (let ms = Math.round(T0 * 1000) - 50; ms < Math.round(T0 * 1000) + 150; ms++) {
    const g = gainAt(ms);
    if (Number.isNaN(t10) && g <= 0.9) t10 = ms;
    if (Number.isNaN(t90) && g <= 0.1) t90 = ms;
  }
  // the knock's onset on the main stem
  const main = st[0];
  let kp = 0;
  for (let i = Math.round((T0 - 0.05) * SR); i < Math.round((T0 + 0.2) * SR); i++) kp = Math.max(kp, Math.abs(main[i]));
  let knockAt = NaN;
  for (let i = Math.round((T0 - 0.05) * SR); i < Math.round((T0 + 0.2) * SR); i++) if (Math.abs(main[i]) > kp * 0.1) { knockAt = (i / SR) * 1000; break; }
  const x = st[3];
  const jump = (a: number, b: number) => { let m = 0; for (let i = Math.floor(a * SR); i < Math.floor(b * SR); i++) m = Math.max(m, Math.abs(x[i] - x[i - 1])); return m; };
  const click = jump(T0 - 0.01, T0 + 0.05) / jump(1.0, 1.3);
  const rampMs = t90 - t10;
  // the ramp starts where the gain first leaves 1: the 10 % point less a tenth of the ramp
  const startMs = t10 - rampMs / 8;
  if (!(rampMs >= 10 && rampMs <= 35)) cut20.push(`ramp ${rampMs} ms`);
  if (!(Math.abs(startMs - knockAt) <= 5)) cut20.push(`starts ${f1(startMs - knockAt)} ms from the knock`);
  if (click > 1.5) cut20.push(`click ratio ${click.toFixed(2)}`);
  // no score duck is active at a stage's cut: the cut cues of the darkenings and the table's own never duck the score
  const ducks = new Set(CUES.filter((c) => c.scoreDuckDb !== undefined).map((c) => c.id));
  for (const [from, to] of [['dusk', 'evening'], ['evening', 'night'], ['night', 'last'], ['night', 'gate'], ['gate', 'night'], ['last', 'finale']] as Array<[ScoreState, ScoreState]>) {
    const first = cutCuesFor(from, to)[0];
    if (ducks.has(first)) cut20.push(`${from}->${to} cuts on ${first}, which ducks the score`);
  }
  checks.push({ n: 20, title: 'cuts land on knocks: a voicing change ramps 10-35 ms (10-90 %), starts within 5 ms of its cue\'s onset, click ratio at most 1.5; the stages\' first-choice cut cues never duck the score', fail: cut20 });
  report.push('### Cuts (#20): evening to night on `world.dark.06`, speaker', `Ramp ${rampMs} ms (10-90 % of partial 10's gain); it starts ${f1(startMs - knockAt)} ms from the knock's onset; click ratio across the change ${click.toFixed(2)}.`);
  d.log('score: cuts');

  /* ---- #21 rejoin equals staying ---- */
  const rejoin21: string[] = [];
  {
    const Z = 1_700_000_000_000;
    const inp = (at: number, possible: number): ScoreInput => ({ phase: 'game', setsPossible: possible, misses: 0, limit: 8, at, zero: Z, seed: 4242 });
    const feed = [{ at: Z, input: inp(Z, 18) }, { at: Z + 60_000, input: inp(Z + 60_000, 11) }, { at: Z + 110_000, input: inp(Z + 110_000, 5) }];
    const END = 200;
    const full = conduct('headphones', feed, Z, Z + END * 1000, SR);
    const lateFeed = [{ at: Z + 137_000, input: { ...feed[2].input, at: Z + 137_000 } }];
    const late = conduct('headphones', lateFeed, Z + 137_000, Z + END * 1000, SR);
    const key = (c: ScoreConductor) => c.played.filter((p) => p.atMs >= Z + 139_000).map((p) => `${p.slot}:${p.phrase}:${p.take}:${p.kind}`).join(',');
    if (key(full.conductor) !== key(late.conductor)) rejoin21.push(`the slots differ: ${key(full.conductor)} / ${key(late.conductor)}`);
    if (!full.conductor.played.some((p) => p.atMs >= Z + 139_000)) rejoin21.push('no call after the rejoin to compare');
    const fullX = synthMono(SR, END, full.msgs);
    // the rejoined client's messages, re-based on the full render's frames
    const lateMsgs = late.msgs.map((m) => ({ ...m, frame: ((m as { frame?: number }).frame ?? 0) + Math.round(137 * SR) }) as SynthMessage);
    const lateX = synthMono(SR, END, lateMsgs, 0);
    const a = integrated(fullX.subarray(Math.round(139 * SR)), SR);
    const b = integrated(lateX.subarray(Math.round(139 * SR)), SR);
    if (Math.abs(a - b) > 1) rejoin21.push(`${f1(b - a)} dB after the swell`);
    report.push('### Rejoin (#21)', `A client entering at 137 s plays ${late.conductor.played.filter((p) => p.atMs >= Z + 139_000).length} phrases after its swell, the same slots, phrases and takes as one that stayed; its level after the 1.5 s swell is ${f1(b - a)} dB from the staying client's (integrated, 139-200 s).`);
  }
  checks.push({ n: 21, title: 'rejoin equals staying: a client entering at 137 s has the same slots, phrases, takes and voicing, and after its 1.5 s swell its level is within 1 dB', fail: rejoin21 });
  d.log('score: rejoin');

  /* ---- #23 cost ---- */
  {
    const syn = createScoreSynth(SR, SCORE_SYNTH);
    for (const m of humMessages('night', 'headphones')) syn.post(m);
    const n4 = PHRASES.find((x) => x.id === 'N4')!, an = PHRASES.find((x) => x.id === 'AN2')!;
    for (let k = 0; k < 10; k++) {
      syn.post(phraseMessage(n4, k * 6 * SR, false));
      syn.post(phraseMessage(an, k * 6 * SR + SR, true, 1, true));
    }
    const L = new Float32Array(128), R = new Float32Array(128);
    const t0 = performance.now();
    for (let f = 0; f < 60 * SR; f += 128) syn.process(L, R, 128, f);
    const ms = performance.now() - t0;
    const x = 60_000 / ms;
    checks.push({ n: 23, title: 'cost: the worst moment (hum, a call and its answer with the valley\'s repeats) renders 60 s at least 70x faster than real time in headless Chromium', fail: x < 70 ? [`${x.toFixed(0)}x`] : [] });
    report.push('### Cost (#23)', `60 s of the worst moment rendered in ${ms.toFixed(0)} ms: ${x.toFixed(0)}x real time, ${(100 / x).toFixed(2)} % of one core on this machine.`);
    numbers.costX = x;
  }

  checks.sort((a, b) => a.n - b.n);
  return { checks, report: report.join('\n\n'), numbers };
}
