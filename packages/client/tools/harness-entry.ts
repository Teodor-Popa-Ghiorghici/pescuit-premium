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
import { ANCHOR_CUE, ANCHOR_LUFS, BUSES, CLASS_TARGET_LUFS, CUES, ECHO_EXEMPT, MASTER_CAP_DB, SEAT_CUES, cueDef, type Profile } from '../src/audio/cuesheet.js';
import { DYNAMICS_DEFAULTS, runDynamics } from '../src/audio/dynamics.js';
import { spawnVoice } from '../src/audio/engine.js';
import { hooks } from '../src/audio/live/common.js';
import { signature } from '../src/audio/live/wood.js';
import { measure, integrated, lufsOf, kWeight, meanSquare, onsets, peakOf, sameRhythm, shortTermMax, timbre, timbreDistance, truePeakDb } from '../src/audio/measure.js';
import { DEFAULT_SETTINGS, buildStemGraph, busGain } from '../src/audio/mixer.js';
import { RECIPES, type CueParams } from '../src/audio/recipes.js';
import { db, fromDb, rng } from '../src/audio/util.js';
import { VoicePool } from '../src/audio/voices.js';

const SR = 48000;
const log = (m: string) => console.log(`[harness] ${m}`);

/* ----------------------------------------------------------- what is measured */

/** the parameters a cue is measured with: a representative seat, count, wetness, ... */
const PARAMS: Record<string, CueParams> = {
  'table.turn': { seat: 4 }, 'table.turn.you': { seat: 0 }, 'table.ask': { seat: 1 }, 'table.bonus': { seat: 4 }, 'table.skipped': { seat: 2 },
  'ui.target': { seat: 1 }, 'power.lanternfish': { seat: 3 }, 'meta.join': { seat: 4 }, 'meta.leave': { seat: 5 }, 'meta.nudge': { seat: 0 },
  'table.give': { count: 2 }, 'table.gofish': { wet: 1 }, 'table.draw': { wet: 1 }, 'table.refill': { count: 3 }, 'ui.toggle': { on: true },
  'amb.gate': { open: false }, 'table.tally': { pip: 2 }, 'power.granted.mine': { rank: 'whale' }, 'power.clownfish.bound': { rank: 'shark' },
  'power.used.clownfish': { rank: 'shark' }, 'power.granted.clownfish': { rank: 'shark' },
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
  const ctx = new OfflineAudioContext(3, Math.ceil(seconds * SR), SR);
  ctx.destination.channelInterpretation = 'discrete';
  const merger = ctx.createChannelMerger(3);
  merger.connect(ctx.destination);
  const graph = buildStemGraph(ctx, profile);
  const s = { ...DEFAULT_SETTINGS, profile };
  for (const b of Object.keys(BUSES) as Array<keyof typeof BUSES>) graph.buses[b].gain.value = busGain(b, profile, s);
  graph.outputs.main.connect(merger, 0, 0);
  graph.outputs.clock.connect(merger, 0, 1);
  graph.outputs.ambience.connect(merger, 0, 2);
  fill(ctx, graph);
  const buf = await ctx.startRendering();
  return [0, 1, 2].map((c) => buf.getChannelData(c).slice());
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
      plan.push({ id: 'power.used.lanternfish', at: t });
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
  'table.lay': 'lay', 'table.lay.power': 'lay', 'power.mantis': 'lay', 'power.granted': 'lay', 'power.reveal': 'power',
  'power.jellyfish': 'power', 'power.whale': 'power', 'power.clownfish.bound': 'power',
  'mus.start': 'ceremony', 'mus.lastset': 'ceremony', 'mus.end.win': 'ceremony', 'mus.end.tie': 'ceremony', 'mus.end.lose': 'ceremony',
};
// The nine motifs and the ceremonies are told apart by their melody and instrument, not by the first
// 50 ms of a swell, so they are not compared pair by pair on timbre: test/motifs.test.ts checks their
// contours are distinct, and the Codex test (§9.2) checks that listeners can tell them apart.
const MELODIC = (id: string): boolean => id.startsWith('mus.') || (/^power\.(used|granted)\./.test(id) && id !== 'power.granted');
/** cues that are one event and always sound together (or never at once) */
const EVENT: Record<string, string> = {
  'table.turn': 'seat', 'table.turn.you': 'seat', 'table.bonus': 'seat', 'table.skipped': 'seat', 'table.ask': 'ask', 'table.asked': 'ask',
  'clock.tick': 'clock', 'clock.tick.urgent': 'clock', 'clock.close': 'clock',
  'table.flight': 'give', 'table.give': 'give', 'table.gofish': 'wet', 'table.draw': 'wet', 'table.refill': 'wet',
  'table.lay': 'lay', 'table.lay.power': 'lay', 'power.stickleback': 'stickleback', 'power.stickleback.miss': 'stickleback',
  'power.whale': 'whale',
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

export async function run(options: Options) {
  await loadRendered();
  const pre = await preloadRendered('speaker');
  await preloadRendered('headphones');
  log(`rendered families: ${pre.keys} keys, ${pre.ms.toFixed(0)} ms of CPU (speaker profile, this machine)`);
  const committed = JSON.parse(JSON.stringify({ CAL, PROGRAM_DB })) as { CAL: Record<Profile, Record<string, CueCal>>; PROGRAM_DB: Record<Profile, number> };

  const ids = CUES.map((c) => c.id);
  const wavs: Record<string, string> = {};
  const raw: Record<Profile, Record<string, Float32Array>> = { speaker: {}, headphones: {} };
  const strikes: string[] = [];
  const nodes: Record<string, number> = {};
  const spread: Record<string, number> = {};
  for (const id of ids) {
    const spk = new Set<string>();
    hooks.strike = (p) => spk.add(p);
    raw.headphones[id] = await renderRaw(id, 3, false);
    raw.speaker[id] = await renderRaw(id, 3, true);
    hooks.strike = undefined;
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
  const alone: Record<Profile, Record<string, { shiftDb: number; tailVsHeadDb: number; activeLufs: number; nonlinearDb: number; activeMs: number; peakDb: number; gr: number; clipped: number }>> = { speaker: {}, headphones: {} };
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
        tailVsHeadDb: mo.tailVsHeadDb, activeLufs: mo.activeLufs, activeMs: mo.activeMs, peakDb: mo.peakDb,
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
  const bedStems = async (profile: Profile, inputs: { poolCount: number; poolStart: number; setsPossible: number | null }) =>
    renderStems(profile, SCENE, (ctx, g) => {
      const amb = new Ambience(ctx, g.buses.Ambience, 5);
      amb.start(0);
      amb.update({ ...inputs, scene: 'game' }, true);
      amb.schedule(SCENE);
    });
  for (const profile of ['speaker', 'headphones'] as Profile[]) {
    const target = ANCHOR_LUFS[profile];
    const pool = new VoicePool();
    const stems = await renderStems(profile, SCENE, (ctx, g) => {
      const amb = new Ambience(ctx, g.buses.Ambience, 5);
      amb.start(0);
      amb.update({ poolCount: 12, poolStart: 20, setsPossible: null, scene: 'game' }, true);
      amb.schedule(SCENE);
      for (const p of plan) if (!place(ctx, g, profile, pool, p, true)) drops.push(`${profile} ${p.id}@${p.at.toFixed(1)}`);
    });
    const full = chain(stems, PROGRAM_DB[profile]);
    if (options.wav) {
      let from = 0;
      const busy = (a: number) => plan.filter((p) => p.at >= a && p.at < a + 12).length;
      for (const p of plan) if (Math.max(0, p.at - 0.5) + 12 <= SCENE && busy(Math.max(0, p.at - 0.5)) > busy(from)) from = Math.max(0, p.at - 0.5);
      wavs[`scene-${profile}-12s`] = wav(full.out.subarray(Math.round(from * SR), Math.round((from + 12) * SR)), SR);
    }
    const cues = chain([stems[0], stems[1], null], PROGRAM_DB[profile]);
    const burst = chain(await renderStems(profile, 2, (ctx, g) => BURST.forEach((id, i) => void place(ctx, g, profile, undefined, { id, at: 0.1 + i * 0.01 }, false))), PROGRAM_DB[profile]);
    // the bed alone, in every state of the pond: the loudest is what must sit 12-20 LU under the anchor
    const beds: Record<string, number> = {};
    for (const [name, inputs] of Object.entries({ wet: { poolCount: 20, poolStart: 20, setsPossible: null }, half: { poolCount: 10, poolStart: 20, setsPossible: null }, dry: { poolCount: 0, poolStart: 20, setsPossible: 2 } })) {
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
        if (a.startsWith('mus.')) return; // a 2-3 s melody cannot be heard as a 200 ms knock
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

  void lufsOf; void kWeight; void meanSquare;
  return {
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
    limits: { ANCHOR_LUFS, AMBIENCE_UNDER, TICK_OVER_BED, BALANCE, ECHO, ECHO_EXEMPT: [...ECHO_EXEMPT, ...CUES.filter((c) => c.heard === 'private').map((c) => c.id)], CURVE_SAMPLES },
    aloneOutPeak: Object.fromEntries((['speaker', 'headphones'] as Profile[]).map((p) => [p, Math.max(...Object.values(aloneOut[p]).map((x) => db(peakOf(x))))])),
  };
}
