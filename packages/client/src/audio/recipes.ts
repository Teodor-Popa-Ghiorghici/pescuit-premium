/* The recipes: what each cue is made of (Appendix B and C). A recipe writes one cue into the
 * graph starting at `t`, from (params, seed): live families for everything frequent, rendered
 * buffers for the rare and the tonal. `speaker` selects the speaker variant of §3.4 - every
 * public cue says what it has to say in 250 ms - and `p.short` the backlog variant.
 * The ringing planks A, B and C appear only in seat cues; a test walks every recipe and fails
 * if any other cue strikes one. */

import { renderedBuffer } from './bank.js';
import { MOTIFS } from './motifs.js';
import { RANK_TO_MOTIF, SILENT_RANKS } from './cuesheet.js';
import { rng } from './util.js';
import { type Ctx, env, filt, harmonics, noiseSrc } from './live/common.js';
import { paperLift, paperSlide } from './live/paper.js';
import { doba, slap, stamp, thud, creak } from './live/tabletop.js';
import { bubble, churn, plop, splash } from './live/water.js';
import { click, signature, wood } from './live/wood.js';

export interface CueParams {
  /** a seat index: the signature the cue carries */
  seat?: number;
  /** cards moved / drawn */
  count?: number;
  /** a rank (short cue-id name) for power cues */
  rank?: string;
  /** how wet the pool still is, 0..1 (table.draw) */
  wet?: number;
  on?: boolean;
  pip?: number;
  open?: boolean;
  /** the weight of a strike, 0..1 (table.impact) */
  weight?: number;
  /** the backlog variant (§4.2) */
  short?: boolean;
  /** the request voices a private fact: dropped unless headphones mode is on */
  private?: boolean;
}

export type Recipe = (ctx: Ctx, out: AudioNode, t: number, seed: number, speaker: boolean, p: CueParams) => void;

/** a rendered buffer through a gain; 2 nodes */
function playBuf(ctx: Ctx, out: AudioNode, t: number, key: string, gain: number): void {
  const b = renderedBuffer(ctx, key);
  if (!b) return;
  const s = ctx.createBufferSource();
  s.buffer = b;
  const g = ctx.createGain();
  g.gain.value = gain;
  s.connect(g).connect(out);
  s.start(t);
}

/** Sustained sources are carved for speech: a -6 dB bell at 2 kHz and a 7 kHz low-pass. */
function carve(ctx: Ctx, out: AudioNode): AudioNode {
  const bell = filt(ctx, 'peaking', 2000, 0.7, -6);
  bell.connect(filt(ctx, 'lowpass', 7000)).connect(out);
  return bell;
}

const takeOf = (seed: number, n: number): number => ((seed % n) + n) % n;
const motifOf = (rank: string | undefined): keyof typeof MOTIFS | 'clownfish' | null => {
  const m = rank ? RANK_TO_MOTIF[rank] ?? (rank in MOTIFS || rank === 'clownfish' ? (rank as never) : undefined) : undefined;
  return m ?? null;
};

/** the motif of a rank, played soft or as the effect's voice */
function motif(ctx: Ctx, out: AudioNode, t: number, rank: string | undefined, sp: boolean, gain: number, copied?: string): void {
  const m = motifOf(rank);
  if (!m) return; // Squid, or nothing known: a rest
  if (copied && SILENT_RANKS.has(copied)) return; // a clownfish that copied Squid plays the rest
  const k = carve(ctx, out);
  if (m === 'clownfish') {
    const c = motifOf(copied);
    playBuf(ctx, k, t, `clown.${c && c !== 'clownfish' ? c : 'default'}.${sp ? 'spk' : 'full'}`, gain);
    return;
  }
  playBuf(ctx, k, t, `motif.${m}.${sp ? 'spk' : 'full'}`, gain);
}

/** the two-note strings figure of the uniform grant */
function granted(ctx: Ctx, out: AudioNode, t: number, seed: number, sp: boolean): void {
  const k = carve(ctx, out);
  playBuf(ctx, k, t, `granted.${sp ? 'spk' : 'full'}.${takeOf(seed, 3)}`, 0.9);
  if (sp) return;
  const sw = ctx.createOscillator();
  sw.frequency.value = 146.8; // D3
  sw.connect(env(ctx, t + 0.01, 0.25, 0.3, 1.0)).connect(k);
  sw.start(t + 0.01);
  sw.stop(t + 1.4);
}

export const RECIPES: Record<string, Recipe> = {
  /* ---------------------------------------------------------------- interface */
  'ui.press': (c, o, t, s) => wood(c, o, t, { plank: 'D', damping: 0.5, gain: 0.9, seed: s }),
  'ui.press.soft': (c, o, t, s) => wood(c, o, t, { plank: 'D', damping: 0.85, gain: 0.75, seed: s }),
  'ui.select': (c, o, t, s) => {
    paperLift(c, o, t + 0.005, 0.6, rng(s));
    wood(c, o, t + 0.03, { plank: 'D', damping: 0.7, gain: 0.6, seed: s + 1 });
  },
  'ui.drop': (c, o, t, s) => paperSlide(c, o, t, 0.06, 0.4, rng(s), [3800, 2400]),
  'ui.target': (c, o, t, s, _sp, p) => signature(c, o, t + 0.005, p.seat ?? 0, s, 0.7, 0.5),
  // a dull double bump on the table top - never a buzzer
  'ui.error': (c, o, t, s) => {
    const r = rng(s);
    thud(c, o, t + 0.005, 0.9, r, 1.3 + 0.2 * (s % 2));
    thud(c, o, t + 0.05, 0.6, r, 1.6);
  },
  'ui.toggle': (c, o, t, s, _sp, p) => {
    paperLift(c, o, t, 0.4, rng(s), 4000);
    wood(c, o, t + 0.03, { plank: 'D', f0: p.on ? 1500 : 1000, damping: 0.8, gain: 0.5, seed: s });
  },
  'ui.copy': (c, o, t, s) => stamp(c, o, t, 0.55, rng(s), 1.5),

  /* ------------------------------------------------------------------ the table */
  'table.turn': (c, o, t, s, _sp, p) => signature(c, o, t + 0.01, p.seat ?? 0, s),
  'table.turn.you': (c, o, t, s, _sp, p) => {
    signature(c, o, t + 0.01, p.seat ?? 0, s);
    if (!p.short) wood(c, o, t + 0.13, { plank: 'D', gain: 0.8, seed: s + 7 });
  },
  // the arrow-chip's short paper flick, then it lands on the target's post
  'table.ask': (c, o, t, s, _sp, p) => {
    if (!p.short) paperLift(c, o, t + 0.01, 0.5, rng(s));
    signature(c, o, t + (p.short ? 0.01 : 0.08), p.seat ?? 0, s);
  },
  // the asker keeps the turn: their own signature again, softer, as the totem settles back
  'table.bonus': (c, o, t, s, _sp, p) => {
    const seat = p.seat ?? 0;
    if (p.short) wood(c, o, t + 0.01, { plank: (['A', 'B', 'C'] as const)[seat % 3], gain: 0.7, seed: s });
    else signature(c, o, t + 0.01, seat, s, 0.7);
  },
  // the stunned seat's signature, muffled, with a jaw-harp wobble
  'table.skipped': (c, o, t, s, sp, p) => {
    signature(c, o, t + 0.01, p.seat ?? 0, s, 0.8, 0.6);
    playBuf(c, o, t + (sp ? 0.06 : 0.12), sp ? 'dramba.wobble.spk' : 'dramba.wobble', 0.5);
  },
  // the target's plank rises: a roll of three taps on plank D - the only three-onset figure
  'table.asked': (c, o, t, s, sp, p) => {
    const taps = p.short ? [0.01] : [0.01, 0.05, 0.09];
    taps.forEach((dt, i) => wood(c, o, t + dt, { plank: 'D', damping: 0.5, gain: 0.55 + 0.15 * i, seed: s + i }));
    void sp;
  },
  'table.flight': (c, o, t, s) => paperSlide(c, o, t + 0.005, 0.26, 0.45, rng(s)),
  'table.give': (c, o, t, s, sp, p) => {
    const r = rng(s);
    const short = sp || p.short;
    const w = 1.3 + 0.1 * Math.min(4, Math.max(0, (p.count ?? 1) - 1));
    if (!p.short) paperSlide(c, o, t + 0.01, sp ? 0.15 : 0.28, 0.8, r);
    thud(c, o, t + (p.short ? 0.01 : short ? 0.16 : 0.3), 1.0, r, w);
  },
  'table.gofish': (c, o, t, s, _sp, p) => {
    const r = rng(s);
    if (p.short) bubble(c, o, t + 0.01, 430 + r() * 60, 0.08, 1);
    else plop(c, o, t + 0.01, r);
  },
  // neutral and brief: a dull knock on the dry basin floor and a short skid, no joke
  'table.gofish.dry': (c, o, t, s, _sp, p) => {
    thud(c, o, t + 0.01, 0.9, rng(s), 1.1);
    if (p.short) return;
    [0.07, 0.11, 0.16].forEach((dt, i) => wood(c, o, t + dt, { plank: 'D', damping: 0.4, gain: 0.35 - i * 0.08, seed: s + 10 + i }));
  },
  'table.draw': (c, o, t, s, _sp, p) => {
    const r = rng(s);
    const wet = p.wet ?? 1;
    bubble(c, o, t + 0.01, 1900 + r() * 700, 0.035, 0.5 * wet);
    if (!p.short) paperLift(c, o, t + 0.03, 0.9, r);
  },
  'table.refill': (c, o, t, s, _sp, p) => {
    const n = Math.min(4, Math.max(1, p.count ?? 1));
    for (let i = 0; i < n; i++) RECIPES['table.draw'](c, o, t + i * 0.09, s + i, false, { wet: 0.8 });
  },
  // a drain gurgle into the hollow ring of the empty basin; the water turns to wind
  'table.poolEmpty': (c, o, t, s, sp, p) => {
    const r = rng(s);
    const n = sp || p.short ? 5 : 12;
    for (let i = 0; i < n; i++) {
      const at = t + 0.01 + (i / n) * (sp || p.short ? 0.14 : 0.6) + r() * 0.02;
      bubble(c, o, at, 900 - (i / n) * 520 + r() * 80, 0.05 + r() * 0.03, 0.7 - (i / n) * 0.3);
    }
    churn(c, o, t + 0.01, sp || p.short ? 0.15 : 0.7, 0.35, r);
    thud(c, o, t + (sp || p.short ? 0.16 : 0.62), 0.9, r, 1.6);
    if (!(sp || p.short)) {
      // the hollow ring: a low, damped sine that no seat can own
      const ring = c.createOscillator();
      ring.frequency.value = 138;
      ring.connect(env(c, t + 0.64, 0.25, 0.01, 0.5)).connect(o);
      ring.start(t + 0.64);
      ring.stop(t + 1.2);
    }
  },
  // three cards slapped down, each heavier, then the ink stamp
  'table.lay': (c, o, t, s, sp, p) => {
    const r = rng(s);
    if (p.short) return stamp(c, o, t + 0.01, 0.9, r);
    const k = sp ? [0.01, 0.06, 0.11, 0.16] : [0.01, 0.13, 0.25, 0.38];
    [0, 1, 2].forEach((i) => slap(c, o, t + k[i], 1, r, 1 + 0.3 * i));
    stamp(c, o, t + k[3], 0.9, r);
  },
  'table.lay.power': (c, o, t, s, sp, p) => {
    RECIPES['table.lay'](c, o, t, s, sp, p);
    if (!p.short) doba(c, o, t + (sp ? 0.16 : 0.3), 0.7, rng(s + 3), sp ? 0.14 : 0.3);
  },
  // the strike lands on the table top: a crack of splintering wood, a heavy skin whose pitch falls a long way, and
  // under it a sub sweep (phones get its harmonics). `weight` 0..1 scales the depth and the body. Nothing rings.
  'table.impact': (c, o, t, s, sp, p) => {
    // three onsets no seat uses (a seat is one knock, or two 75 ms apart): the splinter crack, the body's boom
    // 45 ms later, and the debris settling at 150 ms
    const r = rng(s);
    const w = Math.max(0.2, Math.min(1, p.weight ?? 0.8));
    noiseSrc(c, t + 0.002, 0.03, r).connect(filt(c, 'highpass', 3200, 0.7)).connect(env(c, t + 0.002, 0.8 * w, 0.001, 0.022)).connect(o);
    if (p.short) return thud(c, o, t + 0.045, 1.2 * w, r, 1.8);
    const b = t + 0.045;
    const sub = c.createOscillator();
    sub.frequency.setValueAtTime(150 - 30 * w, b);
    sub.frequency.exponentialRampToValueAtTime(38 + 8 * (1 - w), b + (sp ? 0.15 : 0.24));
    const body = env(c, b, 1.1 * w, 0.003, sp ? 0.15 : 0.26);
    sub.connect(body).connect(o);
    harmonics(c, sub, body, -6);
    sub.start(b);
    sub.stop(b + (sp ? 0.2 : 0.32));
    doba(c, o, b + 0.002, 0.9 * w, r, sp ? 0.1 : 0.18);
    [0.15, 0.172, 0.19].forEach((dt, i) => noiseSrc(c, t + dt, 0.012, r).connect(filt(c, 'bandpass', 900 + 500 * i, 1.2)).connect(env(c, t + dt, 0.45 * w * (1 - 0.25 * i), 0.001, 0.012)).connect(o));
  },
  // the score race
  'table.lead': (c, o, t, s, sp, p) => {
    const r = rng(s);
    playBuf(c, carve(c, o), t + 0.005, `lead.${sp || p.short ? 'spk' : 'full'}.${takeOf(s, 3)}`, 0.9);
    doba(c, o, t + 0.01, 0.55, r, 0.18);
  },
  'table.breakaway': (c, o, t, s, sp, p) => {
    const r = rng(s);
    playBuf(c, carve(c, o), t + 0.005, `breakaway.${sp || p.short ? 'spk' : 'full'}`, 0.9);
    doba(c, o, t + 0.01, 0.6, r, 0.12);
    doba(c, o, t + (sp || p.short ? 0.13 : 0.3), 0.75, r, 0.16);
  },
  'table.chase': (c, o, t, s, sp, p) => {
    const r = rng(s);
    playBuf(c, carve(c, o), t + 0.005, `chase.${sp || p.short ? 'spk' : 'full'}`, 0.85);
    if (!(sp || p.short)) [0.02, 0.3].forEach((dt) => thud(c, o, t + dt, 0.6, r, 1.2));
  },
  'table.clinch': (c, o, t, s, sp) => {
    const r = rng(s);
    playBuf(c, carve(c, o), t + 0.005, 'clinch.full', 0.9);
    if (!sp) playBuf(c, carve(c, o), t + 0.02, 'tulnic.lastset', 0.5);
    [0.01, 0.14, 0.27].forEach((dt, i) => doba(c, o, t + dt, 0.55 + 0.15 * i, r, i === 2 ? 0.4 : 0.14));
  },
  'table.tally': (c, o, t, s, _sp, p) => wood(c, o, t, { plank: 'D', f0: 1200 * 2 ** (((p.pip ?? 0) * 2) / 12), damping: 0.4, gain: 0.7, seed: s }),

  /* ------------------------------------------------------------------- ceremony */
  // the tulnic calls the table: two long rising notes
  'mus.start': (c, o, t) => {
    const k = carve(c, o);
    playBuf(c, k, t + 0.02, 'tulnic.start1', 1);
    playBuf(c, k, t + 1.15, 'tulnic.start2', 1);
  },
  // the dobă pulse quickens under one low tulnic note - the last set in the pond
  'mus.lastset': (c, o, t, s) => {
    const r = rng(s);
    playBuf(c, carve(c, o), t + 0.02, 'tulnic.lastset', 0.9);
    [0.05, 0.6, 1.05, 1.4].forEach((dt, i) => doba(c, o, t + dt, 0.6 + 0.1 * i, r, 0.25));
  },
  'mus.end.win': (c, o, t, s) => {
    const r = rng(s);
    playBuf(c, carve(c, o), t, 'end.win', 1);
    [0.05, 1.35, 1.9].forEach((dt) => doba(c, o, t + dt, 0.5, r, 0.3));
  },
  'mus.end.tie': (c, o, t, s) => {
    const r = rng(s);
    playBuf(c, carve(c, o), t, 'end.tie', 1);
    [0.05, 1.05, 2.05].forEach((dt) => doba(c, o, t + dt, 0.4, r, 0.3));
  },
  'mus.end.lose': (c, o, t) => playBuf(c, carve(c, o), t, 'end.lose', 1),

  /* ------------------------------------------------------------------ the clock */
  // a dry click, not a knock: plank D stopped at once; urgency is rhythm - a double click
  'clock.tick': (c, o, t, s) => click(c, o, t + 0.005, s),
  'clock.tick.urgent': (c, o, t, s) => {
    click(c, o, t + 0.005, s);
    click(c, o, t + 0.045, s + 1, 0.8);
  },
  // the plank lowered: a paper lift and a soft table-top thud - one cue for every answer
  'clock.close': (c, o, t, s) => {
    const r = rng(s);
    paperLift(c, o, t + 0.005, 0.35, r);
    thud(c, o, t + 0.02, 0.8, r, 0.9);
  },
  'clock.eligible': (c, o, t) => playBuf(c, carve(c, o), t + 0.12, 'eligible', 1),

  /* ------------------------------------------------------------------- powers */
  'power.granted': (c, o, t, s, sp, p) => granted(c, o, t, s, sp || !!p.short),
  'power.granted.mine': (c, o, t, s, sp, p) => motif(c, o, t, p.rank, sp || !!p.short, 0.6),
  // the power gathers itself: filtered noise swelling up a band and a skin roll tightening, ending ON the strike
  // (the request is placed `windup` ms before it). Short and under the call: it is anticipation, not an event.
  'power.windup': (c, o, t, s, sp, p) => {
    if (p.short) return;
    const r = rng(s);
    const d = 0.24;
    const bp = filt(c, 'bandpass', 500, 1.4);
    bp.frequency.setValueAtTime(500, t);
    bp.frequency.exponentialRampToValueAtTime(sp ? 2600 : 3400, t + d);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.7, t + d - 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.012);
    noiseSrc(c, t, d + 0.02, r).connect(bp).connect(g).connect(o);
    [0, 0.09, 0.15, 0.19, 0.215].forEach((dt, i) => doba(c, o, t + dt, 0.18 + 0.08 * i, r, 0.03));
  },
  // three plank-D clacks, then an ink stamp
  'power.reveal': (c, o, t, s, sp, p) => {
    const r = rng(s);
    const at = sp || p.short ? [0.01, 0.055, 0.1] : [0.02, 0.1, 0.18];
    at.forEach((dt, i) => wood(c, o, t + dt, { plank: 'D', damping: 0.3, gain: 0.8 + 0.1 * i, seed: s + i }));
    if (!p.short) stamp(c, o, t + (sp ? 0.15 : 0.28), 0.9, r);
  },
  // the jaws snap on plank D, the body lands 40 ms later on the dobă - a flam no seat uses -
  // and the water churns after it
  'power.shark': (c, o, t, s, sp, p) => {
    const r = rng(s);
    wood(c, o, t + 0.01, { plank: 'D', hard: true, gain: 1.2, seed: s });
    if (p.short) return;
    doba(c, o, t + 0.05, 1, r);
    churn(c, o, t + 0.03, sp ? 0.14 : 0.3, 0.3, r);
  },
  // a țambal glint, then the asker's signature: the ask comes back
  'power.lanternfish': (c, o, t, s, sp, p) => {
    playBuf(c, o, t + 0.005, `glint.${sp || p.short ? 'spk' : 'full'}`, 0.8);
    if (!p.short) signature(c, o, t + (sp ? 0.1 : 0.12), p.seat ?? 0, s, 0.9);
  },
  // the shell clamps - two table-top thuds - and the cards slap back
  'power.tortoise': (c, o, t, s, sp, p) => {
    const r = rng(s);
    thud(c, o, t + 0.01, 1.2, r, 1.4);
    if (p.short) return;
    // two clamps, then the cards slap back: a rhythm no go-fish shares
    thud(c, o, t + (sp ? 0.09 : 0.12), 1.3, r, 1.7);
    slap(c, o, t + (sp ? 0.15 : 0.24), 0.8, r, 1.1);
    if (!sp) slap(c, o, t + 0.32, 0.7, r, 1.2);
  },
  // drâmbă through a sweeping formant, then the bell stamp brands the plate
  'power.jellyfish': (c, o, t, s, sp, p) => {
    const short = sp || p.short;
    playBuf(c, carve(c, o), t + 0.01, `dramba.jelly.${short ? 'spk' : 'full'}`, 1);
    if (!p.short) stamp(c, o, t + (sp ? 0.15 : 0.5), 1, rng(s));
  },
  // a barbed scrape and a paper whip
  'power.stickleback': (c, o, t, s, sp, p) => {
    const r = rng(s);
    paperSlide(c, o, t + 0.005, sp || p.short ? 0.1 : 0.16, 0.9, r, [1800, 5200]);
    if (!p.short) {
      paperLift(c, o, t + (sp ? 0.11 : 0.2), 1, r, 4500);
      splash(c, o, t + (sp ? 0.11 : 0.2), r, 0.3, 5000, 0.04);
    }
  },
  // the scrape, hollow, and a dead tap: nothing caught
  'power.stickleback.miss': (c, o, t, s) => {
    const r = rng(s);
    const lp = filt(c, 'lowpass', 1400);
    lp.connect(o);
    paperSlide(c, lp, t + 0.005, 0.1, 0.7, r, [1800, 3600]);
    wood(c, o, t + 0.13, { plank: 'D', damping: 0.9, gain: 0.5, seed: s + 5 });
    wood(c, o, t + 0.19, { plank: 'D', damping: 0.95, gain: 0.3, seed: s + 6 });
  },
  // the club lands on the table top, the shell cracks, plank D splinters
  'power.mantis': (c, o, t, s, sp, p) => {
    const r = rng(s);
    thud(c, o, t + 0.01, 1.4, r, 1.6);
    if (p.short) return;
    splash(c, o, t + 0.01, r, 0.5, 3000, 0.05);
    const at = sp ? [0.05, 0.075, 0.1, 0.13, 0.17] : [0.07, 0.1, 0.14, 0.19, 0.26];
    at.forEach((dt, i) => wood(c, o, t + dt, { plank: 'D', damping: sp ? 0.4 : 0.2, gain: 0.6 - i * 0.08, seed: s + 20 + i }));
  },
  // a tulnic swell, the riffle, the redeal; the speaker cut keeps the riffle and one landing
  'power.whale': (c, o, t, s, sp, p) => {
    const r = rng(s);
    const take = takeOf(s, 3);
    if (sp || p.short) {
      playBuf(c, o, t + 0.01, `riffle.spk.${take}`, 1);
      slap(c, o, t + 0.2, 0.9, r, 1.2);
      return;
    }
    playBuf(c, carve(c, o), t + 0.01, 'tulnic.whale', 1);
    playBuf(c, o, t + 0.35, `riffle.full.${take}`, 1);
    [1.2, 1.28, 1.36].forEach((dt, i) => slap(c, o, t + dt, 0.8, r, 1 + 0.1 * i));
  },
  // a peg in a slot, then the copied motif on the drâmbă
  'power.clownfish.bound': (c, o, t, s, sp, p) => {
    wood(c, o, t + 0.01, { plank: 'D', damping: 0.6, gain: 0.8, seed: s });
    thud(c, o, t + 0.03, 0.5, rng(s), 1.3);
    // the copied motif is always the two-note figure: the sheet gives this cue 600 ms
    if (!p.short) motif(c, o, t + (sp ? 0.04 : 0.12), 'clownfish', true, 0.7, p.rank);
  },

  /* --------------------------------------------------------------- world and meta */
  'amb.gate': (c, o, t, s, sp, p) => creak(c, o, t, sp ? 0.2 : p.open ? 0.4 : 0.25, 1.4, s, !!p.open),
  'meta.join': (c, o, t, s, _sp, p) => signature(c, o, t + 0.01, p.seat ?? 0, s, 0.8),
  'meta.leave': (c, o, t, s, _sp, p) => signature(c, o, t + 0.01, p.seat ?? 0, s, 0.7, 0.6),
  'meta.reconnected': (c, o, t, s) => stamp(c, o, t, 0.6, rng(s), 1.2),
  'meta.nudge': (c, o, t, s, sp, p) => RECIPES['table.turn.you'](c, o, t, s, sp, { ...p, short: false }),
};

// the eight per-rank cues share their shape
for (const rank of Object.keys(MOTIFS).concat('clownfish')) {
  RECIPES[`power.granted.${rank}`] = (c, o, t, _s, sp, p) => motif(c, o, t, rank, sp || !!p.short, 0.6, p.rank);
  RECIPES[`power.used.${rank}`] = (c, o, t, _s, sp, p) => motif(c, o, t, rank, sp || !!p.short, 1, p.rank);
}
