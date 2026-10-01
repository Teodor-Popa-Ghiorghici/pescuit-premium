/* The in-browser half of the audio harness (tools/audio-check.cjs bundles this with esbuild and
 * runs it in Chromium). It is the prototype's eight-check harness pointed at the PRODUCT:
 *
 *   product recipes  ->  per-voice mastering (calibrated)  ->  product buses/stems/profile EQ
 *   ->  program gain  ->  product dynamics.ts (the same function the AudioWorklet runs)
 *
 * rendered with OfflineAudioContext, measured with the BS.1770 meter in src/audio/measure.ts.
 * Calibration (each cue's mastering ceiling and class-normalisation gain, and the program gain
 * that puts the anchor cue at its LUFS) is computed here, compared with the committed
 * src/audio/calibration.ts, and written back by `--write-calibration`.
 */

import { Ambience } from '../src/audio/ambience.js';
import { loadRendered, preloadRendered } from '../src/audio/bank.js';
import { CAL, PROGRAM_DB, type CueCal } from '../src/audio/calibration.js';
import { ANCHOR_CUE, ANCHOR_LUFS, BUSES, CLASS_TARGET_LUFS, CUES, ECHO_EXEMPT, FRAME_BREAKERS, MASTER_CAP_DB, SEAT_CUES, cueDef, type Profile } from '../src/audio/cuesheet.js';
import { DYNAMICS_DEFAULTS, runDynamics } from '../src/audio/dynamics.js';
import { spawnVoice } from '../src/audio/engine.js';
import { hooks, sharedNoise } from '../src/audio/live/common.js';
import { signature } from '../src/audio/live/wood.js';
import { fft, measure, integrated, lufsOf, kWeight, meanSquare, onsets, peakOf, sameRhythm, shortTermMax, timbre, timbreDistance, truePeakDb } from '../src/audio/measure.js';
import { VALLEY } from '../src/audio/render/horn.js';
import { DARK_STEPS, DEFAULT_SETTINGS, buildStemGraph, busGain } from '../src/audio/mixer.js';
import { RECIPES, type CueParams } from '../src/audio/recipes.js';
import { db, fromDb, rng } from '../src/audio/util.js';
import { VoicePool } from '../src/audio/voices.js';
import { runScoreChecks, type ScoreHarnessDeps } from './score-harness.js';
import { renderScoreOffline } from '../src/audio/score/synth.js';
import { SCORE_SYNTH } from '../src/audio/score/levels.js';
import { humGains } from '../src/audio/score/voicing.js';
import { PHRASES, TAKES } from '../src/audio/score/phrases.js';

const SR = 48000;
const log = (m: string) => console.log(`[harness] ${m}`);

/* ----------------------------------------------------------- what is measured */

/** the parameters a cue is measured with: a representative seat, count, wetness, ... */
const PARAMS: Record<string, CueParams> = {
  'table.turn': { seat: 4 }, 'table.turn.you': { seat: 0 }, 'table.ask': { seat: 1 }, 'table.bonus': { seat: 4 }, 'table.skipped': { seat: 2 },
  'ui.target': { seat: 1 }, 'power.lanternfish': { seat: 3, seat2: 1 }, 'meta.join': { seat: 4 }, 'meta.leave': { seat: 5 }, 'meta.nudge': { seat: 0 },
  'table.give': { count: 2 }, 'table.gofish': { wet: 1 }, 'table.draw': { wet: 1 }, 'table.refill': { count: 3 }, 'ui.toggle': { on: true },
  'table.egg': { count: 4 }, 'amb.gate': { open: false }, 'table.tally': { pip: 2 }, 'table.impact': { weight: 1 },
  'world.dark.12': { step: 1 }, 'world.dark.06': { step: 2 }, 'world.dark.01': { step: 3 },
};
const paramsOf = (id: string): CueParams => PARAMS[id] ?? {};
/** the seat whose signature a seat cue carries in the measurement */
const seatOf = (id: string): number | undefined => (SEAT_CUES.has(id) ? paramsOf(id).seat : undefined);

const lengthOf = (id: string): number => Math.max(0.5, cueDef(id)!.maxLenMs / 1000 + 0.6);

/** the cue's own loudness: transients by K-weighted level over the active span, sustained by momentary max */
const levelOf = (id: string, x: Float32Array): number => {
  const m = measure(x, SR);
  return cueDef(id)!.cls === 'T' ? m.activeLufs : m.momentaryMax;
};

/* --------------------------------------------------------------- rendering */

async function renderRaw(id: string, seed: number, speaker: boolean): Promise<Float32Array> {
  const ctx = new OfflineAudioContext(1, Math.ceil(lengthOf(id) * SR), SR);
  RECIPES[id](ctx, ctx.destination, 0.01, seed, speaker, paramsOf(id));
  return (await ctx.startRendering()).getChannelData(0).slice();
}

/** counts the nodes a recipe creates, by wrapping the context's factory methods */
async function countNodes(id: string): Promise<number> {
  const ctx = new OfflineAudioContext(1, 4800, SR) as unknown as Record<string, unknown>;
  let n = 0;
  for (const k of ['createGain', 'createOscillator', 'createBiquadFilter', 'createBufferSource', 'createWaveShaper', 'createStereoPanner']) {
    const orig = (ctx[k] as (...a: unknown[]) => unknown).bind(ctx);
    ctx[k] = (...a: unknown[]) => (n++, orig(...a));
  }
  RECIPES[id](ctx as unknown as BaseAudioContext, (ctx as unknown as BaseAudioContext).destination, 0.01, 3, false, paramsOf(id));
  return n;
}

const CURVE_SAMPLES = 4097;

/** c·tanh(x/c) in JS: the same maths as the WaveShaper curve, without its interpolation */
function shave(x: Float32Array, cDb: number): Float32Array {
  const c = fromDb(cDb);
  const y = new Float32Array(x.length);
  for (let i = 0; i < x.length; i++) y[i] = c * Math.tanh(x[i] / c);
  return y;
}

interface Calibrated extends CueCal {
  rawPlr: number;
  plr: number;
  residualDb: number;
}

/** Mastering (§3.3): round the peaks until they sit at most `cap` dB over the class loudness, then restore the loudness. */
function calibrate(id: string, x: Float32Array, profile: Profile): Calibrated {
  const cap = MASTER_CAP_DB[profile];
  const loud = (y: Float32Array) => levelOf(id, y);
  const plr = (y: Float32Array) => db(peakOf(y)) - loud(y);
  const rawPlr = plr(x);
  let y = x;
  let used: number | null = null;
  let c = loud(x) + cap;
  for (let k = 0; k < 8 && plr(y) > cap + 0.1; k++) {
    y = shave(x, c);
    used = c;
    c -= plr(y) - cap;
  }
  let xy = 0, xx = 0;
  for (let i = 0; i < x.length; i++) { xy += x[i] * y[i]; xx += x[i] * x[i]; }
  const a = xy / xx;
  let rr = 0, yy = 0;
  for (let i = 0; i < x.length; i++) { const r = y[i] - a * x[i]; rr += r * r; yy += y[i] * y[i]; }
  const round = (v: number) => Math.round(v * 100) / 100;
  return { c: used === null ? null : round(used), norm: round(CLASS_TARGET_LUFS[cueDef(id)!.cls] - loud(y)), rawPlr, plr: plr(y), residualDb: 10 * Math.log10(rr / yy + 1e-12) };
}

/* ------------------------------------------------------ the product's chain */

type Stems = Float32Array[];

async function renderStems(profile: Profile, seconds: number, fill: (ctx: OfflineAudioContext, graph: ReturnType<typeof buildStemGraph>) => void): Promise<Stems> {
  const ctx = new OfflineAudioContext(4, Math.ceil(seconds * SR), SR);
  ctx.destination.channelInterpretation = 'discrete';
  const merger = ctx.createChannelMerger(4);
  merger.connect(ctx.destination);
  const graph = buildStemGraph(ctx, profile);
  const s = { ...DEFAULT_SETTINGS, profile };
  for (const b of Object.keys(BUSES) as Array<keyof typeof BUSES>) graph.buses[b].gain.value = busGain(b, profile, s);
  graph.outputs.main.connect(merger, 0, 0);
  graph.outputs.clock.connect(merger, 0, 1);
  graph.outputs.ambience.connect(merger, 0, 2);
  graph.outputs.score.connect(merger, 0, 3);
  fill(ctx, graph);
  const buf = await ctx.startRendering();
  return [0, 1, 2, 3].map((c) => buf.getChannelData(c).slice());
}

/** stems -> program gain -> sum -> the product's limiter and clip, exactly as the AudioWorklet runs them */
function chain(stems: Array<Float32Array | null>, programDb: number) {
  const n = stems.find(Boolean)!.length, g = fromDb(programDb);
  const sum = new Float32Array(n);
  for (const s of stems) if (s) for (let i = 0; i < n; i++) sum[i] += s[i] * g;
  const { out, stats } = runDynamics([sum], SR, DYNAMICS_DEFAULTS);
  return { out: out[0], sum, stats };
}

interface Play {
  id: string;
  at: number;
  params?: CueParams;
  seed?: number;
}

function place(ctx: OfflineAudioContext, graph: ReturnType<typeof buildStemGraph>, profile: Profile, pool: VoicePool | undefined, p: Play, safetyFade: boolean) {
  return spawnVoice({ ctx, buses: graph.buses, profile, pool, safetyFade, mastering: true, pan: false }, p.id, p.params ?? paramsOf(p.id), p.seed ?? 3, p.at);
}

const renderAlone = (profile: Profile, id: string, safetyFade = false): Promise<Stems> =>
  renderStems(profile, lengthOf(id) + 0.3, (ctx, g) => void place(ctx, g, profile, undefined, { id, at: 0.02 }, safetyFade));

/* --------------------------------------------------------------- the scene */

/** A human-paced scene at a five-player table, heard from seat 0 (the prototype's, on product cue ids). */
function scenePlan(seconds: number, seed: number): Play[] {
  const r = rng(seed);
  const who = rng(seed + 101);
  const logn = (median: number, sigma: number) => median * Math.exp(sigma * Math.sqrt(-2 * Math.log(r() || 1e-9)) * Math.cos(2 * Math.PI * r()));
  const plan: Play[] = [{ id: 'mus.start', at: 0.5 }];
  let t = 4, turn = 1, bonus = false;
  while (t < seconds - 6) {
    const mine = turn % 5 === 0;
    if (!bonus) plan.push({ id: mine ? 'table.turn.you' : 'table.turn', at: t, params: { seat: mine ? 0 : turn % 5 } });
    bonus = false;
    t += Math.min(Math.max(logn(6, 0.5), 2), 15);
    const others = [0, 1, 2, 3, 4].filter((p) => p !== turn % 5);
    const target = others[Math.floor(who() * others.length)];
    plan.push({ id: 'table.ask', at: t, params: { seat: target } });
    t += 0.32;
    if (target === 0) plan.push({ id: 'table.asked', at: t });
    const hold = Math.min(logn(2.5, 0.5), 12);
    for (let k = 7; k < hold; k += k >= 9 ? 0.5 : 1) plan.push({ id: k >= 9 ? 'clock.tick.urgent' : 'clock.tick', at: t + k });
    t += hold;
    plan.push({ id: 'clock.close', at: target === 0 ? t - 0.08 : t });
    const roll = r();
    if (roll < 0.35) {
      plan.push({ id: 'table.flight', at: t + 0.1 });
      plan.push({ id: 'table.give', at: t + 0.45, params: { count: 2 } });
      plan.push({ id: 'table.bonus', at: t + 0.62, params: { seat: turn % 5 } });
      bonus = true;
      if (r() < 0.25) plan.push({ id: 'table.lay', at: t + 1.4 });
    } else if (roll < 0.75) {
      plan.push({ id: 'table.gofish', at: t + 0.3, params: { wet: 1 } });
      plan.push({ id: 'table.draw', at: t + 0.6, params: { wet: 1 } });
    } else plan.push({ id: 'table.gofish.dry', at: t + 0.3 });
    t += 1.0;
    if (r() < 0.07) {
      plan.push({ id: 'power.lanternfish', at: t, params: { seat: 3, seat2: 1 } });
      plan.push({ id: 'power.mantis', at: t + 0.9 });
      t += 2;
    }
    turn++;
  }
  return plan.filter((p) => p.at < seconds);
}

const SCENE = 180;
const BURST = ['power.mantis', 'power.shark', 'table.gofish', 'table.give', 'table.lay', 'clock.tick.urgent'];

/* --------------------------------------------------------------- confusability */

/** where a listener must tell cues apart: the same moment of the ask */
const SLOT: Record<string, string> = {
  'table.turn': 'turn', 'table.turn.you': 'turn', 'table.bonus': 'turn', 'table.skipped': 'turn',
  'table.ask': 'ask', 'table.asked': 'ask',
  'clock.tick': 'window', 'clock.tick.urgent': 'window', 'clock.close': 'window',
  'table.flight': 'outcome', 'table.give': 'outcome', 'table.gofish': 'outcome', 'table.gofish.dry': 'outcome', 'table.draw': 'outcome', 'table.refill': 'outcome',
  'power.shark': 'outcome', 'power.lanternfish': 'outcome', 'power.tortoise': 'outcome', 'power.stickleback': 'outcome', 'power.stickleback.miss': 'outcome',
  'table.lay': 'lay', 'table.lay.power': 'lay', 'table.lay.hidden': 'lay', 'table.egg': 'lay', 'world.notch': 'lay', 'world.dark.12': 'lay', 'world.dark.06': 'lay', 'world.dark.01': 'lay',
  'power.mantis': 'lay', 'power.granted': 'lay', 'power.reveal': 'power',
  'power.jellyfish': 'power', 'power.whale': 'power', 'power.clownfish.bound': 'power',
  'mus.start': 'ceremony', 'mus.podium': 'ceremony', 'mus.home': 'ceremony',
};
// The tulnic's phrases are told apart by their melody and length, not by the first 50 ms of a swell, so they are
// not compared pair by pair on timbre: test/horn.test.ts checks their pitches and shapes.
const MELODIC = (id: string): boolean => id.startsWith('mus.');
/** cues that are one event and always sound together (or never at once) */
const EVENT: Record<string, string> = {
  'table.turn': 'seat', 'table.turn.you': 'seat', 'table.bonus': 'seat', 'table.skipped': 'seat', 'table.ask': 'ask', 'table.asked': 'ask',
  'clock.tick': 'clock', 'clock.tick.urgent': 'clock', 'clock.close': 'clock',
  'table.flight': 'give', 'table.give': 'give', 'table.gofish': 'wet', 'table.draw': 'wet', 'table.refill': 'wet',
  'table.lay': 'lay', 'table.lay.power': 'lay', 'table.lay.hidden': 'lay', 'table.egg': 'lay', 'world.notch': 'lay', 'world.dark.12': 'lay', 'world.dark.06': 'lay', 'world.dark.01': 'lay', 'mus.home': 'lay',
  'power.stickleback': 'stickleback', 'power.stickleback.miss': 'stickleback',
  'power.whale': 'whale', 'power.mantis': 'mantis', 'power.granted': 'lay',
};
const eventOf = (id: string): string => EVENT[id] ?? id;

/* ---------------------------------------------------------------- the run */

const AMBIENCE_UNDER: [number, number] = [12, 20];
const TICK_OVER_BED = 10;
const BALANCE = 1;
const ECHO = -12;

interface Options {
  /** use the freshly computed calibration for the checks even where the committed file disagrees */
  useFresh: boolean;
  /** only the score's checks (#14-#23), on the committed calibration: for tuning the score's levels */
  scoreOnly?: boolean;
  /** also return listening files: every cue through each profile's chain, and the scene's busiest 12 s */
  wav?: boolean;
}

/** 16-bit mono WAV as base64 */
function wav(x: Float32Array, sr: number): string {
  const n = x.length;
  const buf = new ArrayBuffer(44 + n * 2);
  const v = new DataView(buf);
  const w = (o: number, t: string) => [...t].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  w(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); w(8, 'WAVE'); w(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, sr, true); v.setUint32(28, sr * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  w(36, 'data'); v.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, x[i])) * 32767, true);
  let s = '';
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

function scoreDeps(clockLufs: ScoreHarnessDeps['clockLufs']): ScoreHarnessDeps {
  return {
    sr: SR, programDb: PROGRAM_DB, renderStems, chain, clockLufs, log,
    place: (ctx, g, profile, id, at, params) => void place(ctx, g, profile, undefined, { id, at, params: params ?? paramsOf(id) }, true),
  };
}

async function clockAlone(): Promise<ScoreHarnessDeps['clockLufs']> {
  const out: ScoreHarnessDeps['clockLufs'] = { speaker: {}, headphones: {} };
  for (const p of ['speaker', 'headphones'] as Profile[]) for (const c of CUES.filter((x) => x.bus === 'Clock')) out[p][c.id] = measure(chain(await renderAlone(p, c.id), PROGRAM_DB[p]).out, SR).activeLufs;
  return out;
}

export async function run(options: Options) {
  await loadRendered();
  const pre = await preloadRendered('speaker');
  await preloadRendered('headphones');
  if (options.scoreOnly) {
    const score = await runScoreChecks(scoreDeps(await clockAlone()));
    return { scoreOnly: true, score, wavs: {} };
  }
  log(`rendered families: ${pre.keys} keys, ${pre.ms.toFixed(0)} ms of CPU (speaker profile, this machine)`);
  const committed = JSON.parse(JSON.stringify({ CAL, PROGRAM_DB })) as { CAL: Record<Profile, Record<string, CueCal>>; PROGRAM_DB: Record<Profile, number> };

  const ids = CUES.map((c) => c.id);
  const wavs: Record<string, string> = {};
  const raw: Record<Profile, Record<string, Float32Array>> = { speaker: {}, headphones: {} };
  const strikes: string[] = [];
  const breaks: string[] = [];
  const nodes: Record<string, number> = {};
  const spread: Record<string, number> = {};
  for (const id of ids) {
    const spk = new Set<string>();
    const brk = new Set<string>();
    hooks.strike = (p) => spk.add(p);
    hooks.breaks = (k) => brk.add(k);
    raw.headphones[id] = await renderRaw(id, 3, false);
    raw.speaker[id] = await renderRaw(id, 3, true);
    hooks.strike = undefined;
    hooks.breaks = undefined;
    // the palette rule: only Shark, Mantis and Whale (and the strike's weight on the board, heard only with them) break the frame
    if (brk.size && !FRAME_BREAKERS.has(id) && id !== 'table.impact') breaks.push(`${id} uses ${[...brk].join(', ')}`);
    if (!brk.size && FRAME_BREAKERS.has(id)) breaks.push(`${id} does not break the frame at all`);
    for (const p of spk) if ('ABC'.includes(p) && !SEAT_CUES.has(id)) strikes.push(`${id} strikes plank ${p}`);
    nodes[id] = await countNodes(id);
    const levels: number[] = [];
    for (const s of [11, 12, 13]) levels.push(levelOf(id, await renderRaw(id, s, false)));
    spread[id] = Math.max(...levels) - Math.min(...levels);
  }
  log(`rendered ${ids.length} cues raw`);

  // calibrate every cue for both profiles
  const fresh: { CAL: Record<Profile, Record<string, Calibrated>>; PROGRAM_DB: Record<Profile, number> } = { CAL: { speaker: {}, headphones: {} }, PROGRAM_DB: { speaker: 0, headphones: 0 } };
  for (const profile of ['speaker', 'headphones'] as Profile[]) for (const id of ids) fresh.CAL[profile][id] = calibrate(id, raw[profile][id], profile);
  log('calibrated cue mastering');

  // install the calibration the checks run on: the committed one, or the fresh one
  const install = (cal: Record<Profile, Record<string, CueCal>>, prog: Record<Profile, number>) => {
    for (const p of ['speaker', 'headphones'] as Profile[]) {
      for (const k of Object.keys(CAL[p])) delete CAL[p][k];
      Object.assign(CAL[p], JSON.parse(JSON.stringify(cal[p])));
      PROGRAM_DB[p] = prog[p];
    }
  };
  const stripped = (c: Record<string, Calibrated>) => Object.fromEntries(Object.entries(c).map(([k, v]) => [k, { c: v.c, norm: v.norm }]));
  install({ speaker: stripped(fresh.CAL.speaker), headphones: stripped(fresh.CAL.headphones) }, { speaker: 0, headphones: 0 });

  // program gain: calibrated on the anchor cue alone, at the chain's output
  for (const profile of ['speaker', 'headphones'] as Profile[]) {
    const anchor = await renderAlone(profile, ANCHOR_CUE);
    let programDb = 0;
    for (let pass = 0; pass < 3; pass++) programDb += ANCHOR_LUFS[profile] - measure(chain(anchor, programDb).out, SR).activeLufs;
    fresh.PROGRAM_DB[profile] = Math.round(programDb * 100) / 100;
    PROGRAM_DB[profile] = fresh.PROGRAM_DB[profile];
  }
  log(`program gain: speaker ${fresh.PROGRAM_DB.speaker} dB, headphones ${fresh.PROGRAM_DB.headphones} dB`);

  // staleness: the committed calibration against the fresh one
  const stale: string[] = [];
  for (const profile of ['speaker', 'headphones'] as Profile[]) {
    if (Math.abs((committed.PROGRAM_DB[profile] ?? 0) - fresh.PROGRAM_DB[profile]) > 0.15) stale.push(`program gain ${profile}: ${committed.PROGRAM_DB[profile]} vs ${fresh.PROGRAM_DB[profile]}`);
    for (const id of ids) {
      const a = committed.CAL[profile][id], b = fresh.CAL[profile][id];
      if (!a) stale.push(`${id} ${profile}: missing`);
      else if (Math.abs(a.norm - b.norm) > 0.15 || (a.c === null) !== (b.c === null) || (a.c !== null && b.c !== null && Math.abs(a.c - b.c) > 0.15)) stale.push(`${id} ${profile}`);
    }
  }
  if (!options.useFresh && stale.length === 0) install(committed.CAL, committed.PROGRAM_DB);
  if (!options.useFresh && stale.length) log(`the committed calibration is stale (${stale.length} entries): checks run on the FRESH calibration`);

  /* ---- alone through the chain ---- */
  const alone: Record<Profile, Record<string, { shiftDb: number; tailVsHeadDb: number; activeLufs: number; nonlinearDb: number; activeMs: number; peakDb: number; truePeakDb: number; gr: number; clipped: number }>> = { speaker: {}, headphones: {} };
  const aloneOut: Record<Profile, Record<string, Float32Array>> = { speaker: {}, headphones: {} };
  for (const profile of ['speaker', 'headphones'] as Profile[]) {
    for (const id of ids) {
      const st = await renderAlone(profile, id);
      const c = chain(st, PROGRAM_DB[profile]);
      const lin = new Float32Array(c.sum.length);
      lin.set(c.sum);
      const mo = measure(c.out, SR);
      let ab = 0, aa = 0;
      for (let i = 0; i < c.out.length; i++) { ab += c.out[i] * lin[i]; aa += lin[i] * lin[i]; }
      const alpha = ab / aa;
      let rr = 0, oo = 0;
      for (let i = 0; i < c.out.length; i++) { const r = c.out[i] - alpha * lin[i]; rr += r * r; oo += c.out[i] * c.out[i]; }
      alone[profile][id] = {
        shiftDb: levelOf(id, c.out) - levelOf(id, lin),
        tailVsHeadDb: mo.tailVsHeadDb, activeLufs: mo.activeLufs, activeMs: mo.activeMs, peakDb: mo.peakDb, truePeakDb: truePeakDb(c.out),
        nonlinearDb: 10 * Math.log10(rr / oo + 1e-12), gr: c.stats.grMaxDb, clipped: c.stats.clipped,
      };
      aloneOut[profile][id] = c.out;
      if (options.wav) wavs[`${profile}/${id}`] = wav(c.out.subarray(0, Math.round((lengthOf(id) + 0.2) * SR)), SR);
    }
  }
  log('every cue alone through the chain');

  /* ---- the scene, the burst, the bed ---- */
  const plan = scenePlan(SCENE, 7);
  const scenes: Record<string, unknown> = {};
  const bedByCondition: Record<string, Record<Profile, number>> = {};
  const drops: string[] = [];
  const bedStems = async (profile: Profile, inputs: { poolCount: number; poolStart: number; dry: boolean; step?: number }) =>
    renderStems(profile, SCENE, (ctx, g) => {
      const amb = new Ambience(ctx, g.buses.Ambience, 5);
      amb.start(0);
      const { step, ...rest } = inputs;
      amb.update({ ...rest, scene: 'game' }, true);
      g.setDarkStep(step ?? 0, 0, true);
      amb.schedule(SCENE);
    });
  for (const profile of ['speaker', 'headphones'] as Profile[]) {
    const target = ANCHOR_LUFS[profile];
    const pool = new VoicePool();
    const stems = await renderStems(profile, SCENE, (ctx, g) => {
      const amb = new Ambience(ctx, g.buses.Ambience, 5);
      amb.start(0);
      amb.update({ poolCount: 12, poolStart: 20, dry: false, scene: 'game', scoreOn: true }, true);
      amb.schedule(SCENE);
      for (const p of plan) if (!place(ctx, g, profile, pool, p, true)) drops.push(`${profile} ${p.id}@${p.at.toFixed(1)}`);
      // the score under it (MUSIC_PLAN §10.1: the existing checks pass with the score on): the evening's hum from the end of
      // the call, and three far calls
      const eve = PHRASES.filter((x) => x.stage === 'evening' && x.kind === 'call');
      const msgs = [
        { type: 'seed' as const, seed: 77, zero: 0, salt: 3 }, { type: 'clock' as const, frame: 0, serverMs: 0 },
        { type: 'hum' as const, frame: Math.round(8.8 * SR), partials: humGains('evening', profile), rampS: 6 },
        ...[50, 95, 140].map((t, k) => ({ type: 'phrase' as const, frame: Math.round(t * SR), notes: eve[k].notes, ...TAKES[k % 3], gain: 1, lpHz: 900, pan: 0, lipDb: -26, wobble: 0.6, repeats: [], seed: k, tag: k })),
      ];
      const [l, r] = renderScoreOffline(SR, SCENE, msgs, SCORE_SYNTH);
      const b = ctx.createBuffer(2, l.length, SR);
      b.getChannelData(0).set(l);
      b.getChannelData(1).set(r);
      const src = ctx.createBufferSource();
      src.buffer = b;
      src.connect(g.buses.Score);
      src.start(0);
    });
    const full = chain(stems, PROGRAM_DB[profile]);
    if (options.wav) {
      let from = 0;
      const busy = (a: number) => plan.filter((p) => p.at >= a && p.at < a + 12).length;
      for (const p of plan) if (Math.max(0, p.at - 0.5) + 12 <= SCENE && busy(Math.max(0, p.at - 0.5)) > busy(from)) from = Math.max(0, p.at - 0.5);
      wavs[`scene-${profile}-12s`] = wav(full.out.subarray(Math.round(from * SR), Math.round((from + 12) * SR)), SR);
    }
    const cues = chain([stems[0], stems[1], null, null], PROGRAM_DB[profile]);
    const burst = chain(await renderStems(profile, 2, (ctx, g) => BURST.forEach((id, i) => void place(ctx, g, profile, undefined, { id, at: 0.1 + i * 0.01 }, false))), PROGRAM_DB[profile]);
    // the bed alone, in every state of the pond: the loudest is what must sit 12-20 LU under the anchor
    const beds: Record<string, number> = {};
    for (const [name, inputs] of Object.entries({ wet: { poolCount: 20, poolStart: 20, dry: false }, half: { poolCount: 10, poolStart: 20, dry: false }, 'wet, step 3': { poolCount: 20, poolStart: 20, dry: false, step: 3 }, dry: { poolCount: 0, poolStart: 20, dry: true }, 'dry, step 3': { poolCount: 0, poolStart: 20, dry: true, step: 3 } })) {
      const b = chain(await bedStems(profile, inputs), PROGRAM_DB[profile]);
      beds[name] = shortTermMax(b.out, SR);
    }
    bedByCondition[profile] = beds as unknown as Record<Profile, number>;
    scenes[profile] = {
      target, programDb: PROGRAM_DB[profile],
      cueLoudness: integrated(cues.out, SR), integrated: integrated(full.out, SR), shortTermMax: shortTermMax(full.out, SR),
      truePeak: truePeakDb(full.out), burstTruePeak: truePeakDb(burst.out),
      limiterGrMax: Math.max(full.stats.grMaxDb, burst.stats.grMaxDb),
      limiterBusy: full.stats.busyFrames / full.stats.frames,
      clipped: full.stats.clipped + burst.stats.clipped,
      beds,
      bedShortTermMax: Math.max(...Object.values(beds)),
      bedShortTermMin: Math.min(...Object.values(beds)),
    };
    log(`scene ${profile}`);
  }

  /* ---- confusability ---- */
  const SEEDS = [40, 60, 80];
  const sigAudio: Float32Array[][] = [];
  for (let seat = 0; seat < 6; seat++) {
    sigAudio.push([]);
    for (const seed of SEEDS) {
      const ctx = new OfflineAudioContext(1, Math.ceil(0.5 * SR), SR);
      signature(ctx, ctx.destination, 0.01, seat, seed + seat);
      sigAudio[seat].push((await ctx.startRendering()).getChannelData(0).slice());
    }
  }
  const seatNames = ['A1', 'B1', 'C1', 'A2', 'B2', 'C2'];
  const seatFeat = sigAudio.map((xs) => ({ rhythm: onsets(xs[0], SR), timbre: timbre(xs[0], SR) }));
  // The bar is set by the design itself: the smallest timbre step between two seat signatures of the
  // same rhythm - over every pair of seeds, so a seat cue rendered with another seed still clears it.
  let bar = { d: Infinity, pair: '' };
  for (let i = 0; i < 6; i++)
    for (let j = i + 1; j < 6; j++) {
      if (!sameRhythm(seatFeat[i].rhythm, seatFeat[j].rhythm)) continue;
      for (const a of sigAudio[i]) for (const b of sigAudio[j]) {
        const d = timbreDistance(timbre(a, SR), timbre(b, SR));
        if (d < bar.d) bar = { d, pair: `${seatNames[i]} / ${seatNames[j]}` };
      }
    }
  const pairs: Array<{ pair: string; d: number }> = [];
  const feats = { full: {} as Record<string, { rhythm: number[]; timbre: number[] }>, speaker: {} as Record<string, { rhythm: number[]; timbre: number[] }> };
  for (const id of ids) {
    feats.full[id] = { rhythm: onsets(raw.headphones[id], SR), timbre: timbre(raw.headphones[id], SR) };
    feats.speaker[id] = { rhythm: onsets(raw.speaker[id], SR), timbre: timbre(raw.speaker[id], SR) };
  }
  for (const variant of ['full', 'speaker'] as const) {
    const F = feats[variant];
    const tag = variant === 'full' ? 'headphones' : 'speaker';
    for (const a of ids) {
      // a seat cue carries its own signature; every other cue must not be mistaken for any seat
      seatFeat.forEach((q, i) => {
        if (seatOf(a) === i) return;
        if (MELODIC(a)) return; // a 1-8 s horn phrase cannot be heard as a 200 ms knock
        if (sameRhythm(F[a].rhythm, q.rhythm)) pairs.push({ pair: `${a} / seat ${seatNames[i]} (${tag})`, d: timbreDistance(F[a].timbre, q.timbre) });
      });
      for (const b of ids) if (a < b && SLOT[a] && SLOT[a] === SLOT[b] && !MELODIC(a) && !MELODIC(b) && eventOf(a) !== eventOf(b) && sameRhythm(F[a].rhythm, F[b].rhythm)) pairs.push({ pair: `${a} / ${b} (${tag})`, d: timbreDistance(F[a].timbre, F[b].timbre) });
    }
  }
  pairs.sort((p, q) => p.d - q.d);

  const cuesPerMinute = (() => {
    const p = plan.filter((x) => x.id !== 'mus.start');
    const per = (k: number) => Math.round((k / SCENE) * 60 * 10) / 10;
    return { all: per(p.length), table: per(p.filter((x) => x.id.startsWith('table.')).length), clock: per(p.filter((x) => x.id.startsWith('clock.')).length), power: per(p.filter((x) => x.id.startsWith('power.')).length), asks: per(p.filter((x) => x.id === 'table.ask').length) };
  })();

  // clock cues over the bed
  const clockIds = ids.filter((id) => cueDef(id)!.bus === 'Clock');
  const overBed: Record<string, Record<Profile, number>> = {};
  for (const id of clockIds) {
    overBed[id] = { speaker: 0, headphones: 0 };
    for (const p of ['speaker', 'headphones'] as Profile[]) overBed[id][p] = alone[p][id].activeLufs - (scenes[p] as { bedShortTermMax: number }).bedShortTermMax;
  }



  /* ---- the tulnic's valley: three discrete repeats, each later, quieter and darker ---- */
  const call = raw.headphones['mus.start'];
  const at0 = 0.01 + 0.02; // the recipe starts the call 20 ms after the cue
  const rmsOf = (a: number, b: number): number => { let e = 0; const i0 = Math.floor(a * SR), i1 = Math.min(call.length, Math.floor(b * SR)); for (let i = i0; i < i1; i++) e += call[i] * call[i]; return Math.sqrt(e / Math.max(1, i1 - i0)); };
  // how dark a stretch is: the energy above 1200 Hz against the energy below it, dB (the horn's own harmonics live on both sides)
  const brightnessOf = (a: number): number => {
    const n = 16384, re = new Float32Array(n), im = new Float32Array(n);
    for (let i = 0; i < n; i++) re[i] = (call[Math.floor(a * SR) + i] ?? 0) * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / n));
    fft(re, im);
    let lo = 1e-30, hi = 1e-30;
    for (let k = Math.floor((100 * n) / SR); k < Math.floor((8000 * n) / SR); k++) { const m = re[k] * re[k] + im[k] * im[k]; if ((k * SR) / n > 1200) hi += m; else lo += m; }
    return 10 * Math.log10(hi / lo);
  };
  const dryFrom = at0 + 1.65 + 0.2, dryTo = at0 + 3.0; // the dry final gesture's held part
  const dryDb = 20 * Math.log10(rmsOf(dryFrom, dryTo));
  const valley = VALLEY.map((v, k) => {
    // a repeat begins when its first note does, partial 7 (406 Hz): the first 40 ms frame where the 406 Hz energy passes 20 % of
    // its own peak around then. (The level of a broadband envelope would catch the tail of the repeat before it.)
    const f7 = 58 * 7, frame = 0.04;
    const at7 = (t: number): number => { let re = 0, im = 0; const i0 = Math.floor(t * SR), n = Math.floor(frame * SR); for (let i = 0; i < n; i++) { const h = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / n); re += call[i0 + i] * h * Math.cos((2 * Math.PI * f7 * i) / SR); im -= call[i0 + i] * h * Math.sin((2 * Math.PI * f7 * i) / SR); } return re * re + im * im; };
    const ts: number[] = [], env: number[] = [];
    for (let t = at0 + v.at - 0.3; t < at0 + v.at + 0.4; t += 0.01) { ts.push(t); env.push(at7(t)); }
    const peak = Math.max(...env);
    const first = env.findIndex((e) => e > 0.2 * peak);
    return {
      k: k + 1, designedAt: v.at, measuredAt: Math.round((ts[first] + frame / 2 - at0) * 100) / 100,
      designedDb: v.gainDb, measuredDb: 20 * Math.log10(rmsOf(at0 + v.at + 0.2, at0 + v.at + 1.2)) - dryDb, brightnessDb: brightnessOf(at0 + v.at + 0.2),
    };
  });
  const dryBrightness = brightnessOf(dryFrom);
  log('valley measured');

  /* ---- the darkening steps: a flat low-pass and level on the ambience stem, reached by a 25 ms ramp ---- */
  const bandDb = (x: Float32Array, fc: number, from: number, to: number): number => {
    // mean power at eight frequencies within +-6 % of fc, over 50 ms segments of [from, to): a noise input needs the average
    const seg = Math.round(0.05 * SR);
    let total = 0, count = 0;
    for (let a = Math.floor(from * SR); a + seg <= Math.floor(to * SR); a += seg) {
      for (let k = 0; k < 8; k++) {
        const w = (2 * Math.PI * fc * (0.94 + (0.12 * k) / 7)) / SR;
        let re = 0, im = 0;
        for (let n = 0; n < seg; n++) { const h = 0.5 - 0.5 * Math.cos((2 * Math.PI * n) / seg); re += x[a + n] * h * Math.cos(w * n); im -= x[a + n] * h * Math.sin(w * n); }
        total += (re * re + im * im) / seg;
        count++;
      }
    }
    return 10 * Math.log10(total / count + 1e-30);
  };
  // dB of the ambience stem's 2nd-order low-pass (Web Audio's Q on a low-pass is in dB: -3.0103 dB is a flat, Butterworth response)
  const butter = (f: number, fc: number): number => { const u = f / fc, q = 10 ** (-3.0103 / 20); return -10 * Math.log10((1 - u * u) ** 2 + (u / q) ** 2); };
  const steps: Array<Record<string, number>> = [];
  const T0 = 2;
  for (const k of [1, 2, 3]) {
    const noiseStems = await renderStems('speaker', 4, (ctx, g) => {
      const src = ctx.createBufferSource();
      src.buffer = sharedNoise(ctx);
      src.loop = true;
      src.connect(g.buses.Ambience);
      src.start(0);
      g.setDarkStep(k, T0);
    });
    const sineStems = await renderStems('speaker', 4, (ctx, g) => {
      const o = ctx.createOscillator();
      o.frequency.value = 300;
      o.connect(g.buses.Ambience);
      o.start(0);
      g.setDarkStep(k, T0);
    });
    const nz = noiseStems[2], sn = sineStems[2];
    const want = (f: number) => 20 * Math.log10(10 ** (DARK_STEPS.db[k] / 20) / 10 ** (DARK_STEPS.db[0] / 20)) + butter(f, DARK_STEPS.hz[k]) - butter(f, DARK_STEPS.hz[0]);
    const got = (f: number) => bandDb(nz, f, T0 + 0.3, T0 + 1.9) - bandDb(nz, f, 0.3, T0 - 0.1);
    // the envelope of the 300 Hz sine, one cycle at a time: where the change starts and ends
    const cyc = Math.round(SR / 300);
    const env: number[] = [];
    for (let n = 0; n + cyc < sn.length; n += cyc) { let m = 0; for (let i = n; i < n + cyc; i++) m = Math.max(m, Math.abs(sn[i])); env.push(m); }
    const idx = (t: number) => Math.round((t * SR) / cyc);
    const pre = env.slice(idx(1), idx(T0 - 0.1)).reduce((a, b) => a + b, 0) / (idx(T0 - 0.1) - idx(1));
    const post = env.slice(idx(T0 + 0.3), idx(T0 + 1.5)).reduce((a, b) => a + b, 0) / (idx(T0 + 1.5) - idx(T0 + 0.3));
    const frac = (v: number) => (v - pre) / (post - pre);
    let t10 = NaN, t90 = NaN;
    for (let i = idx(T0 - 0.05); i < idx(T0 + 0.3); i++) {
      const f = frac(env[i]);
      if (Number.isNaN(t10) && f >= 0.1) t10 = (i * cyc) / SR;
      if (Number.isNaN(t90) && f >= 0.9) t90 = (i * cyc) / SR;
    }
    // no click: the largest sample-to-sample jump across the change against the largest across a steady stretch
    const jump = (from: number, to: number) => { let m = 0; for (let i = Math.floor(from * SR); i < Math.floor(to * SR); i++) m = Math.max(m, Math.abs(sn[i] - sn[i - 1])); return m; };
    steps.push({
      step: k, hz: DARK_STEPS.hz[k], levelDb: DARK_STEPS.db[k],
      wantedAt300: want(300), measuredAt300: got(300), wantedAt3k: want(3000), measuredAt3k: got(3000),
      rampMs: Math.round((t90 - t10) * 1000), clickRatio: jump(T0 - 0.01, T0 + 0.05) / jump(1, 1.05),
    });
  }
  log('darkening steps measured');

  // the score's checks (#14-#23), on the same calibration
  const clockLufs: ScoreHarnessDeps['clockLufs'] = { speaker: {}, headphones: {} };
  for (const p of ['speaker', 'headphones'] as Profile[]) for (const id of clockIds) clockLufs[p][id] = alone[p][id].activeLufs;
  const score = await runScoreChecks(scoreDeps(clockLufs));

  void lufsOf; void kWeight; void meanSquare;
  return {
    score,
    breaks, steps, valley, dryBrightness,
    wavs, sr: SR, ids, plan: plan.length, cuesPerMinute, drops,
    fresh, committed, stale, useFresh: options.useFresh,
    strikes, nodes, spread,
    cues: Object.fromEntries(ids.map((id) => {
      const def = cueDef(id)!;
      const m = measure(raw.headphones[id], SR);
      const ms = measure(raw.speaker[id], SR);
      return [id, { cls: def.cls, bus: def.bus, levelDb: def.levelDb, maxLenMs: def.maxLenMs, activeMs: m.activeMs, speakerActiveMs: ms.activeMs, peakDb: m.peakDb, activeLufs: m.activeLufs, momentaryMax: m.momentaryMax, tailVsHeadDb: m.tailVsHeadDb, plrHeadphones: fresh.CAL.headphones[id].plr, plrSpeaker: fresh.CAL.speaker[id].plr, rawPlr: fresh.CAL.headphones[id].rawPlr, resid: { headphones: fresh.CAL.headphones[id].residualDb, speaker: fresh.CAL.speaker[id].residualDb } }];
    })),
    alone, scenes, bedByCondition, overBed,
    confusability: { bar, seatRhythms: Object.fromEntries(seatFeat.map((q, i) => [seatNames[i], q.rhythm])), rhythms: Object.fromEntries(ids.map((id) => [id, feats.full[id].rhythm])), closest: pairs.slice(0, 10), violations: pairs.filter((p) => p.d < bar.d) },
    limits: { ANCHOR_LUFS, AMBIENCE_UNDER, TICK_OVER_BED, BALANCE, ECHO, ECHO_EXEMPT: [...ECHO_EXEMPT], CURVE_SAMPLES },
    aloneOutPeak: Object.fromEntries((['speaker', 'headphones'] as Profile[]).map((p) => [p, Math.max(...Object.values(aloneOut[p]).map((x) => db(peakOf(x))))])),
  };
}
