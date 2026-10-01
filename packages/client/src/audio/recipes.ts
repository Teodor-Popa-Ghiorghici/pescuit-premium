/* The recipes: what each cue is made of (SOUND_DESIGN §1). A recipe writes one cue into the graph starting at
 * `t`, from (params, seed): live families for everything frequent (noise and damped modes through filters), rendered
 * buffers for the two things worth rendering - the tulnic and the paper riffle. `speaker` selects the speaker variant
 * of §3.4 - every public cue says what it has to say in 250 ms - and `p.short` the backlog variant.
 *
 * The palette is carved and printed: wood, paper, ink, board, clay, water, rope. Only Shark, Mantis Shrimp and
 * Whale (`FRAME_BREAKERS`) may leave it - a cracked-wood transient, splintering fibres, a wrong-sounding partial - and
 * a test walks the recipes to keep it that way. The ringing planks A, B and C appear only in seat cues.
 */

import { renderedBuffer } from './bank.js';
import { rng } from './util.js';
import { VALLEY } from './render/horn.js';
import { type Ctx, env, filt, harmonics, hooks, noiseSrc } from './live/common.js';
import { chisel, clay, crack, ember, fibres, groan, ropeCreak } from './live/craft.js';
import { paperLift, paperSlide } from './live/paper.js';
import { doba, slap, stamp, thud, creak } from './live/tabletop.js';
import { bubble, churn, drip, splash } from './live/water.js';
import { click, signature, wood } from './live/wood.js';

export interface CueParams {
  /** a seat index: the signature the cue carries */
  seat?: number;
  /** a second seat (the Lanternfish: whose ask came back) */
  seat2?: number;
  /** cards moved / drawn / eggs in a set */
  count?: number;
  /** how wet the pool still is, 0..1 (table.draw) */
  wet?: number;
  on?: boolean;
  pip?: number;
  open?: boolean;
  /** the weight of a strike, 0..1 (table.impact) */
  weight?: number;
  /** the backlog variant (§4.2) */
  short?: boolean;
  /** which of the cue's takes (variation.ts) */
  take?: number;
  /** a multiplier on the cue's pitches, 0.95..1.05 (variation.ts, and the chain of bonus turns) */
  pitch?: number;
  /** dB added to the cue's level, +-1.5 (variation.ts) */
  gainDb?: number;
  /** the darkening step this cue marks: 1, 2 or 3 (the ambience steps with it) */
  step?: number;
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

const pt = (p: CueParams): number => p.pitch ?? 1;
/** the take of a cue: the parameter if the mapping layer chose one, else derived from the seed */
const tk = (p: CueParams, seed: number): number => p.take ?? (((seed >>> 3) % 3) + 3) % 3;

/** the table-top ring under a hand-over: a short low-passed 210 Hz body. The middle take's tail is cut 9 ms early. */
function boardRing(ctx: Ctx, out: AudioNode, t: number, gain: number, pitch: number, take: number): void {
  const o = ctx.createOscillator();
  o.frequency.value = 210 * pitch;
  o.connect(env(ctx, t, gain, 0.003, 0.06)).connect(filt(ctx, 'lowpass', 900)).connect(out);
  o.start(t);
  o.stop(t + (take === 1 ? 0.051 : 0.065));
}

/**
 * A bar struck with its envelope reversed: it swells for 90 ms and is chopped at the top. The Lanternfish's ask
 * coming back. Counted as a plank strike for the grammar (it is a seat's bar), tuned 2 % sharp.
 */
function reverseBar(ctx: Ctx, out: AudioNode, t: number, seat: number, gain: number, pitch: number): void {
  const plank = (['A', 'B', 'C'] as const)[((seat % 6) + 6) % 6 % 3];
  hooks.strike?.(plank, 0);
  const f0 = { A: 180, B: 320, C: 620 }[plank] * pitch * 1.02;
  [1, 2.756, 5.404].forEach((m, i) => {
    const o = ctx.createOscillator();
    o.frequency.value = f0 * m;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain * 0.3 * [1, 0.5, 0.25][i], t + 0.09);
    g.gain.setValueAtTime(0.0001, t + 0.094);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + 0.1);
  });
}

/** the world's darkening knock: a mallet on the wooden basin rim, a hand stopping the ring at 160 ms */
function darkKnock(ctx: Ctx, out: AudioNode, t: number, seed: number, step: 1 | 2 | 3, pitch: number): void {
  const f0 = [140, 110, 85][step - 1] * pitch;
  const stop = ctx.createGain();
  stop.gain.setValueAtTime(1, t + 0.14);
  stop.gain.linearRampToValueAtTime(0, t + 0.16);
  stop.connect(out);
  // plank D (not a seat's bar) at a low f0 and a long ring; the middle step rings a little longer (a stubborn plank)
  wood(ctx, stop, t, { plank: 'D', f0, ring: step === 2 ? 3.6 : 3, damping: 0.1, gain: 1.1, seed });
  // the hand that stops it: a dull tap at 160 ms, an onset no seat shares
  thud(ctx, out, t + 0.16, 0.35, rng(seed + 1), 1.8, pitch);
}

export const RECIPES: Record<string, Recipe> = {
  /* ---------------------------------------------------------------- interface */
  'ui.press': (c, o, t, s, _sp, p) => wood(c, o, t, { plank: 'D', damping: 0.5, gain: 0.9, seed: s, pitch: pt(p) }),
  'ui.press.soft': (c, o, t, s, _sp, p) => wood(c, o, t, { plank: 'D', damping: 0.85, gain: 0.75, seed: s, pitch: pt(p) }),
  'ui.select': (c, o, t, s, _sp, p) => {
    paperLift(c, o, t + 0.005, 0.6, rng(s));
    wood(c, o, t + 0.03, { plank: 'D', damping: 0.7, gain: 0.6, seed: s + 1, pitch: pt(p) });
  },
  'ui.drop': (c, o, t, s) => paperSlide(c, o, t, 0.06, 0.4, rng(s), [3800, 2400]),
  'ui.target': (c, o, t, s, _sp, p) => signature(c, o, t + 0.005, p.seat ?? 0, s, 0.7, 0.5, pt(p)),
  // a dull double bump on the table top - never a buzzer
  'ui.error': (c, o, t, s, _sp, p) => {
    const r = rng(s);
    thud(c, o, t + 0.005, 0.9, r, 1.3 + 0.2 * (s % 2), pt(p));
    thud(c, o, t + 0.05, 0.6, r, 1.6, pt(p));
  },
  'ui.toggle': (c, o, t, s, _sp, p) => {
    paperLift(c, o, t, 0.4, rng(s), 4000);
    wood(c, o, t + 0.03, { plank: 'D', f0: p.on ? 1500 : 1000, damping: 0.8, gain: 0.5, seed: s, pitch: pt(p) });
  },
  'ui.copy': (c, o, t, s, _sp, p) => stamp(c, o, t, 0.55, rng(s), 1.5 * pt(p)),

  /* ------------------------------------------------------------------ the table */
  // the turn totem: one wooden bar per seat, no tail
  'table.turn': (c, o, t, s, _sp, p) => signature(c, o, t + 0.01, p.seat ?? 0, s, 1, 0, pt(p)),
  'table.turn.you': (c, o, t, s, _sp, p) => {
    signature(c, o, t + 0.01, p.seat ?? 0, s, 1, 0, pt(p));
    if (!p.short) wood(c, o, t + 0.13, { plank: 'D', gain: 0.8, seed: s + 7, pitch: pt(p) });
  },
  // the hard knock: the arrow-chip's short paper flick, then the target's bar, struck harder, exactly on the beat
  'table.ask': (c, o, t, s, _sp, p) => {
    const gap = [0.07, 0.08, 0.095][tk(p, s)];
    if (!p.short) paperLift(c, o, t + 0.01, 0.5, rng(s));
    signature(c, o, t + (p.short ? 0.01 : gap), p.seat ?? 0, s, 1.25, 0, pt(p), true);
  },
  // the asker keeps the turn: their own bar again, softer, as the totem settles back
  'table.bonus': (c, o, t, s, _sp, p) => {
    const seat = p.seat ?? 0;
    if (p.short) wood(c, o, t + 0.01, { plank: (['A', 'B', 'C'] as const)[seat % 3], gain: 0.7, seed: s, pitch: pt(p) });
    else signature(c, o, t + 0.01, seat, s, 0.7, 0, pt(p));
  },
  // the stunned seat's bar, muffled with a cloth, and one dead knock after it: stopped
  'table.skipped': (c, o, t, s, _sp, p) => {
    signature(c, o, t + 0.01, p.seat ?? 0, s, 0.8, 0.6, pt(p));
    wood(c, o, t + 0.14, { plank: 'D', damping: 0.97, gain: 0.4, seed: s + 3, pitch: pt(p) });
  },
  // the target's plank rises: a roll of three taps on plank D - the only three-onset figure
  'table.asked': (c, o, t, s, _sp, p) => {
    const taps = p.short ? [0.01] : [0.01, 0.05, 0.09];
    taps.forEach((dt, i) => wood(c, o, t + dt, { plank: 'D', damping: 0.5, gain: 0.55 + 0.15 * i, seed: s + i, pitch: pt(p) }));
  },
  'table.flight': (c, o, t, s) => paperSlide(c, o, t + 0.005, 0.26, 0.45, rng(s)),
  // the answering knock: a paper scuff (not a snap), a dull ink-press thud, the board's ring - heavier per card
  'table.give': (c, o, t, s, sp, p) => {
    const r = rng(s);
    const short = sp || p.short;
    const w = 1.3 + 0.1 * Math.min(4, Math.max(0, (p.count ?? 1) - 1));
    if (!p.short) paperSlide(c, o, t + 0.01, sp ? 0.15 : 0.28, 0.6, r, [1800, 2600]);
    const at = t + (p.short ? 0.01 : short ? 0.16 : 0.3);
    slap(c, o, at, 1, r, w, pt(p));
    boardRing(c, o, at, 0.4, pt(p), tk(p, s));
  },
  // "Pescuiește!": the flat of a hand on the board, and one drip of the pond if there is water. The same for an honest no
  // and for every lie.
  'table.gofish': (c, o, t, s, _sp, p) => {
    const r = rng(s);
    thud(c, o, t + 0.01, 1, r, 0.9, pt(p));
    // the drip follows the hand by 115 ms: a gap no seat's second knock (75 ms) and no shark's flam (40 ms) keeps
    drip(c, o, t + 0.125, r, 0.8 * (p.wet ?? 1), pt(p));
    if (!p.short) splash(c, o, t + 0.125, r, 0.08 * (p.wet ?? 1), 1800, 0.08);
  },
  // neutral and brief: a dull knock on the dry basin floor and a short skid, no joke
  'table.gofish.dry': (c, o, t, s, _sp, p) => {
    thud(c, o, t + 0.01, 0.9, rng(s), 1.1, pt(p));
    if (p.short) return;
    [0.07, 0.11, 0.16].forEach((dt, i) => wood(c, o, t + dt, { plank: 'D', damping: 0.4, gain: 0.35 - i * 0.08, seed: s + 10 + i, pitch: pt(p) }));
  },
  // a card lifted from the water: a paper lift and one small drip - the same whatever the card
  'table.draw': (c, o, t, s, _sp, p) => {
    const r = rng(s);
    const wet = p.wet ?? 1;
    drip(c, o, t + 0.005, r, 0.35 * wet, pt(p) * 1.15);
    if (!p.short) paperLift(c, o, t + 0.03, 0.9, r);
  },
  'table.refill': (c, o, t, s, _sp, p) => {
    const n = Math.min(4, Math.max(1, p.count ?? 1));
    for (let i = 0; i < n; i++) RECIPES['table.draw'](c, o, t + i * 0.09, s + i, false, { wet: 0.8, pitch: pt(p) });
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
  // three cards pressed down, each heavier, then the ink stamp
  'table.lay': (c, o, t, s, sp, p) => {
    const r = rng(s);
    if (p.short) return stamp(c, o, t + 0.01, 0.9, r, pt(p));
    const k = sp ? [0.01, 0.06, 0.11, 0.16] : [0.01, 0.13, 0.25, 0.38];
    // the third take's third pressing is 10 ms early: a hand in a hurry
    if (tk(p, s) === 2) k[2] -= 0.01;
    [0, 1, 2].forEach((i) => slap(c, o, t + k[i], 1, r, 1 + 0.3 * i, pt(p)));
    stamp(c, o, t + k[3], 0.9, r, pt(p));
  },
  'table.lay.power': (c, o, t, s, sp, p) => {
    RECIPES['table.lay'](c, o, t, s, sp, p);
    if (!p.short) doba(c, o, t + (sp ? 0.16 : 0.3), 0.7, rng(s + 3), sp ? 0.14 : 0.3, pt(p));
  },
  // a power set laid face down (Mode Ascuns): the same three pressings, but the last is the set turned over on the board -
  // a cloth scuff and a dead thump, no ink peel - then the same low skin as an open power set
  'table.lay.hidden': (c, o, t, s, sp, p) => {
    const r = rng(s);
    const k = sp ? [0.01, 0.06, 0.11, 0.16] : [0.01, 0.13, 0.25, 0.38];
    if (p.short) {
      thud(c, o, t + 0.01, 0.9, r, 1.9, pt(p));
      return;
    }
    if (tk(p, s) === 2) k[2] -= 0.01;
    [0, 1, 2].forEach((i) => slap(c, o, t + k[i], 1, r, 1 + 0.3 * i, pt(p)));
    noiseSrc(c, t + k[3], 0.08, r).connect(filt(c, 'lowpass', 1200)).connect(env(c, t + k[3], 0.25, 0.02, 0.06)).connect(o);
    thud(c, o, t + k[3] + 0.01, 0.8, r, 1.9, pt(p));
    doba(c, o, t + (sp ? 0.16 : 0.3), 0.7, rng(s + 3), sp ? 0.14 : 0.3, pt(p));
  },
  // one clay tick per egg: hollow, in the ochre register; the lowest take has a hairline crack in the glaze
  'table.egg': (c, o, t, s, sp, p) => {
    const r = rng(s);
    const n = Math.min(4, Math.max(1, p.count ?? 1));
    const gap = sp || p.short ? 0.055 : 0.065;
    for (let i = 0; i < n; i++) {
      const f0 = [740, 790, 840][(tk(p, s) + i) % 3] * pt(p);
      clay(c, o, t + 0.005 + i * gap, 1, r, f0, f0 < 780);
      if (p.short) break;
    }
  },
  // the strike lands on the table top: a crack of splintering wood, a heavy skin whose pitch falls a long way, and
  // under it a sub sweep (phones get its harmonics). `weight` 0..1 scales the depth and the body. Nothing rings.
  'table.impact': (c, o, t, s, sp, p) => {
    // three onsets no seat uses (a seat is one knock, or two 75 ms apart): the splinter crack, the body's boom
    // 45 ms later, and the debris settling at 150 ms
    const r = rng(s);
    const w = Math.max(0.2, Math.min(1, p.weight ?? 0.8));
    crack(c, o, t + 0.002, 0.8 * w, r, 3200, 0.022);
    if (p.short) return thud(c, o, t + 0.045, 1.2 * w, r, 1.8, pt(p));
    const b = t + 0.045;
    const sub = c.createOscillator();
    sub.frequency.setValueAtTime((150 - 30 * w) * pt(p), b);
    sub.frequency.exponentialRampToValueAtTime((38 + 8 * (1 - w)) * pt(p), b + (sp ? 0.15 : 0.24));
    const body = env(c, b, 1.1 * w, 0.003, sp ? 0.15 : 0.26);
    sub.connect(body).connect(o);
    harmonics(c, sub, body, -6);
    sub.start(b);
    sub.stop(b + (sp ? 0.2 : 0.32));
    doba(c, o, b + 0.002, 0.9 * w, r, sp ? 0.1 : 0.18, pt(p));
    [0.15, 0.172, 0.19].forEach((dt, i) => noiseSrc(c, t + dt, 0.012, r).connect(filt(c, 'bandpass', 900 + 500 * i, 1.2)).connect(env(c, t + dt, 0.45 * w * (1 - 0.25 * i), 0.001, 0.012)).connect(o));
  },
  // the podium's pips: plank D, unpitched apart from the jitter - no scale to climb
  'table.tally': (c, o, t, s, _sp, p) => wood(c, o, t, { plank: 'D', f0: 1200, damping: 0.4, gain: 0.7, seed: s, pitch: pt(p) }),

  /* ------------------------------------------------------------------- the world */
  // the light steps darker: a mallet on the basin rim, lower each time
  'world.dark.12': (c, o, t, s, _sp, p) => darkKnock(c, o, t + 0.005, s, 1, pt(p)),
  'world.dark.06': (c, o, t, s, _sp, p) => darkKnock(c, o, t + 0.005, s, 2, pt(p)),
  // the last set: the same knock, lower (its bare horn note is mus.home, on the Music bus)
  'world.dark.01': (c, o, t, s, _sp, p) => darkKnock(c, o, t + 0.005, s, 3, pt(p)),
  // a notch counts down the rim: a chisel tick, quiet
  'world.notch': (c, o, t, s, _sp, p) => {
    const take = tk(p, s);
    chisel(c, o, t + 0.003, 1, rng(s), 2100 * pt(p) * [0.952, 1, 1.071][take], take === 2);
  },

  /* ------------------------------------------------------------------- ceremony */
  // the tulnic calls the table: one breath, then the valley answers with three darker repeats of its last gesture
  'mus.start': (c, o, t) => {
    const k = carve(c, o);
    playBuf(c, k, t + 0.02, 'horn.call', 1);
    for (const v of VALLEY) {
      // each repeat is the call, carved for speech like the call is, and then a darker wall's worth of low-pass
      const dark = filt(c, 'lowpass', v.lowpassHz, 0.7);
      dark.connect(carve(c, o));
      playBuf(c, dark, t + 0.02 + v.at, 'horn.echo', 10 ** (v.gainDb / 20));
    }
  },
  // the last set: one bare low note of the tulnic, partial 4, under the knock of world.dark.01 (placed 120 ms after it)
  'mus.home': (c, o, t) => playBuf(c, carve(c, o), t + 0.12, 'horn.last', 0.9),
  // the horn returns, resolved and bare: no echo, no accompaniment
  'mus.podium': (c, o, t) => playBuf(c, carve(c, o), t + 0.02, 'horn.podium', 1),

  /* ------------------------------------------------------------------ the clock */
  // a dry click, not a knock: plank D stopped at once; urgency is rhythm - a double click at the same level
  'clock.tick': (c, o, t, s, _sp, p) => click(c, o, t + 0.005, s, 1, pt(p)),
  'clock.tick.urgent': (c, o, t, s, _sp, p) => {
    click(c, o, t + 0.005, s, 1, pt(p));
    click(c, o, t + 0.045, s + 1, 0.9, pt(p));
  },
  // the plank lowered: a paper lift and a soft table-top thud - one cue for every answer
  'clock.close': (c, o, t, s, _sp, p) => {
    const r = rng(s);
    paperLift(c, o, t + 0.005, 0.35, r);
    thud(c, o, t + 0.02, 0.8, r, 0.9, pt(p));
  },

  /* ------------------------------------------------------------------ the rope */
  // the fuse is lit: a match drawn across paper, and the rope taking the load
  'clock.rope': (c, o, t, s, sp, p) => {
    const r = rng(s);
    paperSlide(c, o, t + 0.005, 0.09, 0.55, r, [3800, 6200]);
    ember(c, o, t + 0.07, 0.12, 0.5, r, 2);
    ropeCreak(c, o, t + 0.1, sp ? 0.22 : 0.3, 0.55, r, 640, 470, pt(p));
  },
  // once a second while it burns: the ember eats a strand
  'clock.rope.burn': (c, o, t, s, _sp, p) => ember(c, o, t + 0.005, 0.14, 0.7 * pt(p), rng(s), 3),
  // the last five seconds, twice a second: the rope strains under the ember
  'clock.rope.urgent': (c, o, t, s, _sp, p) => {
    const r = rng(s);
    ember(c, o, t + 0.005, 0.1, 0.75, r, 2);
    ropeCreak(c, o, t + 0.03, 0.16, 0.45, r, 760 * pt(p), 600 * pt(p));
  },
  // burnt through: the rope parts with a short creak and its end drops on the table
  'clock.rope.out': (c, o, t, s, _sp, p) => {
    const r = rng(s);
    ropeCreak(c, o, t + 0.005, 0.18, 0.7, r, 820, 380, pt(p));
    thud(c, o, t + 0.2, 0.7, r, 0.8, pt(p));
    ember(c, o, t + 0.21, 0.2, 0.35, r, 2);
  },

  /* ------------------------------------------------------------------- powers */
  // a power came into being: a peg driven into a wooden rack, and the rope that holds it twisting. Uniform: every rank, both modes.
  'power.granted': (c, o, t, s, sp, p) => {
    const r = rng(s);
    wood(c, o, t + 0.005, { plank: 'D', f0: 1000, damping: 0.8, gain: 0.9, seed: s, pitch: pt(p) });
    // the second tap is 15 ms late
    wood(c, o, t + (sp || p.short ? 0.05 : 0.085), { plank: 'D', f0: 900, damping: 0.8, gain: 0.8, seed: s + 1, pitch: pt(p) });
    if (!p.short) ropeCreak(c, o, t + 0.03, sp ? 0.16 : 0.22, 0.5, r, 700, 520, pt(p));
  },
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
    at.forEach((dt, i) => wood(c, o, t + dt, { plank: 'D', damping: 0.3, gain: 0.8 + 0.1 * i, seed: s + i, pitch: pt(p) }));
    if (!p.short) stamp(c, o, t + (sp ? 0.15 : 0.28), 0.9, r, pt(p));
  },
  // FRAME-BREAKER. The jaws close on hardwood: a cracked-wood transient, doubled by a splinter; the body lands on the skin 40 ms
  // later (a flam no seat uses); splintering fibres and the water's churn after it; a ring that does not belong (1870 Hz)
  'power.shark': (c, o, t, s, sp, p) => {
    const r = rng(s);
    crack(c, o, t + 0.008, 1.1, r, 2800, 0.002);
    crack(c, o, t + 0.015, 0.7, r, 3400, 0.0015);
    if (p.short) return;
    doba(c, o, t + 0.048, 1, r, 0.55, pt(p));
    fibres(c, o, t + 0.03, sp ? 0.1 : 0.18, 0.5, r, 6000, 2000, sp ? 7 : 12);
    churn(c, o, t + 0.03, sp ? 0.14 : 0.3, 0.3, r);
    const wrong = c.createOscillator();
    wrong.frequency.value = 1870;
    wrong.connect(env(c, t + 0.012, 0.16, 0.001, 0.025)).connect(o);
    wrong.start(t + 0.012);
    wrong.stop(t + 0.05);
  },
  // the ask comes back: the target's bar swells and is chopped (a knock played backwards), then the asker's bar answers, normally
  'power.lanternfish': (c, o, t, s, sp, p) => {
    reverseBar(c, o, t + 0.005, p.seat2 ?? 0, 1, pt(p));
    if (!p.short) signature(c, o, t + (sp ? 0.11 : 0.13), p.seat ?? 0, s, 0.9, 0, pt(p));
  },
  // the shell clamps - two table-top thuds - and the cards slap back
  'power.tortoise': (c, o, t, s, sp, p) => {
    const r = rng(s);
    thud(c, o, t + 0.01, 1.2, r, 1.4, pt(p));
    if (p.short) return;
    // two clamps, then the cards press back: a rhythm no go-fish shares
    thud(c, o, t + (sp ? 0.09 : 0.12), 1.3, r, 1.7, pt(p));
    slap(c, o, t + (sp ? 0.15 : 0.24), 0.8, r, 1.1, pt(p));
    if (!sp) slap(c, o, t + 0.32, 0.7, r, 1.2, pt(p));
  },
  // a wooden rattle that loses its rhythm: five damped taps, each gap longer than the last, the pitch sinking; the last has
  // no attack (it starts already ringing) - a stroke that stutters and breaks
  'power.jellyfish': (c, o, t, s, sp, p) => {
    const at = sp || p.short ? [0, 0.025, 0.06, 0.11] : [0, 0.032, 0.076, 0.14, 0.236, 0.38];
    at.forEach((dt, i) => {
      const last = i === at.length - 1;
      wood(c, o, t + 0.01 + dt, { plank: 'D', f0: (1100 - (300 * i) / (at.length - 1)) * pt(p), damping: 0.7, gain: last ? 0.6 : 0.85 - 0.06 * i, seed: s + i, soft: last });
    });
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
  'power.stickleback.miss': (c, o, t, s, _sp, p) => {
    const r = rng(s);
    const lp = filt(c, 'lowpass', 1400);
    lp.connect(o);
    paperSlide(c, lp, t + 0.005, 0.1, 0.7, r, [1800, 3600]);
    wood(c, o, t + 0.13, { plank: 'D', damping: 0.9, gain: 0.5, seed: s + 5, pitch: pt(p) });
    wood(c, o, t + 0.19, { plank: 'D', damping: 0.95, gain: 0.3, seed: s + 6, pitch: pt(p) });
  },
  // FRAME-BREAKER. The club lands on the board, the shell cracks in five clicks that come faster, and the frame splinters; two
  // partials 37 Hz apart beat against each other where none belong
  'power.mantis': (c, o, t, s, sp, p) => {
    const r = rng(s);
    crack(c, o, t + 0.008, 0.9, r, 3500, 0.0015);
    thud(c, o, t + 0.01, 1.1, r, 1.6, pt(p));
    if (p.short) return;
    // (the speaker cut starts its clicks 40 ms in, so the strike and the first click are two onsets, not one a seat could own)
    const at = sp ? [0.05, 0.085, 0.115, 0.14, 0.16] : [0.05, 0.11, 0.155, 0.187, 0.209];
    at.forEach((dt, i) => crack(c, o, t + dt, 0.45 - 0.06 * i, r, 3000 + 400 * i, 0.001));
    fibres(c, o, t + 0.03, sp ? 0.09 : 0.12, 0.5, r, 5000, 1200, sp ? 6 : 9);
    [2630, 2667].forEach((f) => {
      const w = c.createOscillator();
      w.frequency.value = f;
      w.connect(env(c, t + 0.012, 0.09, 0.001, 0.04)).connect(o);
      w.start(t + 0.012);
      w.stop(t + 0.06);
    });
  },
  // FRAME-BREAKER, the largest and the lowest. A plank slammed with a cracked front; the hull groaning (a 55 Hz pulse swept down
  // with a resonant creak, its saturated harmonics for phones, one partial 45 cents sharp of where it belongs); then the two hands
  // shuffled - a paper riffle - and the cards landing. The speaker cut keeps the slam, the riffle and one landing.
  'power.whale': (c, o, t, s, sp, p) => {
    const r = rng(s);
    const take = (((s >>> 3) % 3) + 3) % 3;
    crack(c, o, t + 0.004, 1.2, r, 2400, 0.003);
    if (sp || p.short) {
      thud(c, o, t + 0.006, 1.4, r, 2.2, pt(p));
      playBuf(c, o, t + 0.03, `riffle.spk.${take}`, 1);
      slap(c, o, t + 0.2, 0.9, r, 1.2, pt(p));
      return;
    }
    thud(c, o, t + 0.006, 1.6, r, 2.6, pt(p));
    groan(c, o, t + 0.06, 0.65, 0.9, r, 45);
    playBuf(c, o, t + 0.5, `riffle.full.${take}`, 1);
    [1.14, 1.22, 1.3].forEach((dt, i) => slap(c, o, t + dt, 0.8, r, 1 + 0.1 * i, pt(p)));
  },
  // Mode Deschis only: a peg in a slot, and the rope taking its weight
  'power.clownfish.bound': (c, o, t, s, sp, p) => {
    wood(c, o, t + 0.01, { plank: 'D', damping: 0.6, gain: 0.8, seed: s, pitch: pt(p) });
    thud(c, o, t + 0.03, 0.5, rng(s), 1.3, pt(p));
    if (!p.short && !sp) ropeCreak(c, o, t + 0.05, 0.14, 0.35, rng(s + 2), 640, 520, pt(p));
  },

  /* --------------------------------------------------------------- world and meta */
  'amb.gate': (c, o, t, s, sp, p) => creak(c, o, t, sp ? 0.2 : p.open ? 0.4 : 0.25, 1.4, s, !!p.open),
  'meta.join': (c, o, t, s, _sp, p) => signature(c, o, t + 0.01, p.seat ?? 0, s, 0.8, 0, pt(p)),
  'meta.leave': (c, o, t, s, _sp, p) => signature(c, o, t + 0.01, p.seat ?? 0, s, 0.7, 0.6, pt(p)),
  'meta.reconnected': (c, o, t, s, _sp, p) => stamp(c, o, t, 0.6, rng(s), 1.2 * pt(p)),
  'meta.nudge': (c, o, t, s, sp, p) => RECIPES['table.turn.you'](c, o, t, s, sp, { ...p, short: false }),
};
