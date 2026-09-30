/* The tulnic, rendered in plain JS at 32 kHz (SOUND_DESIGN §1.1).
 *
 * A tulnic is a long conical wooden horn with no finger holes, so it can only sound the partials of one
 * fundamental. Every pitch here is `fundamental x partial` (58 Hz x n): nothing is rounded to a tempered scale, so
 * the 7th partial lands about 31 cents flat of its tempered neighbour, as it does on the instrument. The notes are
 * all partials 4-9 (232-522 Hz), which a phone speaker reproduces; the fundamental itself is never sounded.
 *
 *   T lip    band-limited noise (420 Hz, Q 1.2), a slow attack, -20 dB under the body
 *   B horn   harmonics 1-10 at 1/h^1.2 through a low-pass that opens with the dynamics (500 -> 1100 Hz), a 380 Hz bell
 *   L breath noise (600 Hz, Q 0.8) under the note, -24 dB while it is held, rising toward -12 dB as the breath runs out
 *
 * Each note enters with a scoop (a lip slide up from flat), the lip is unsteady (a slow random walk of a few cents,
 * not a vibrato), and a note may sag and may be cut a moment early. No DOM, no Web Audio: unit-testable in Node. */

import { rng } from '../util.js';
import { Biquad, bp, expEnv, lp, RENDER_SR } from './dsp.js';

const fromDb = (d: number): number => 10 ** (d / 20);

export const HORN_FUNDAMENTAL = 58;
export const hornHz = (partial: number, fundamental = HORN_FUNDAMENTAL): number => fundamental * partial;

export interface HornNote {
  /** which partial of the fundamental: 4-9 */
  partial: number;
  start: number;
  dur: number;
  gain?: number;
  /** seconds to reach full level: slow for the first note of a call, short for a slurred one */
  attack?: number;
  /** the lip slides up from this many cents flat, over 70 ms */
  scoopCents?: number;
  /** the pitch sags this many cents by the end of the note (the breath running out) */
  sagCents?: number;
  /** a constant offset in cents (a note that settles a little flat and stays there) */
  cents?: number;
  /** 0..1: how far the breath noise rises toward -12 dB by the end of the note */
  breathRise?: number;
  /** seconds: the note is cut this much before its release finishes (a breath that ran out first) */
  trimEnd?: number;
  /** seconds of natural release */
  release?: number;
}

export interface HornOptions {
  seed?: number;
  fundamental?: number;
  /** the lip's level under the body, dB (-20 for the call, quieter for the bare podium phrase) */
  lipDb?: number;
  /** 1 = the lip's random walk as written; less for a steadier player */
  wobble?: number;
  sr?: number;
}

/** Renders a run of horn notes into one mono buffer of `seconds`. */
export function renderHorn(notes: HornNote[], seconds: number, o: HornOptions = {}): Float32Array {
  const sr = o.sr ?? RENDER_SR;
  const F = o.fundamental ?? HORN_FUNDAMENTAL;
  const r = rng(o.seed ?? 7);
  const lipGain = fromDb(o.lipDb ?? -20);
  const wobbleScale = o.wobble ?? 1;
  const out = new Float32Array(Math.ceil(seconds * sr));
  for (const n of notes) {
    const f0 = F * n.partial;
    const gain = n.gain ?? 1;
    const attack = n.attack ?? 0.09;
    const release = n.release ?? 0.22;
    const first = Math.floor(n.start * sr);
    const trim = n.trimEnd ?? 0;
    const cutAt = n.dur - trim;
    const len = Math.min(out.length - first, Math.ceil((Math.min(n.dur, cutAt + 0.006) + 0.01) * sr));
    const holdEnd = Math.max(attack + 0.02, n.dur - release);
    const body = new Biquad(lp(500, 0.8, sr));
    const bell = new Biquad(bp(380, 1, sr));
    const breath = new Biquad(bp(600, 0.8, sr));
    const lip = new Biquad(bp(420, 1.2, sr));
    let phase = 0;
    let inc = 0;
    let walk = 0;
    for (let i = 0; i < len; i++) {
      const tau = i / sr;
      const e = expEnv(tau, attack, gain * 0.3, holdEnd, n.dur);
      if (i % 16 === 0) {
        walk = 0.96 * walk + (r() * 2 - 1) * 1.2 * wobbleScale;
        const scoop = tau < 0.07 ? -(n.scoopCents ?? 50) * (1 - tau / 0.07) : 0;
        const sag = (n.sagCents ?? 0) * (tau / n.dur) ** 2;
        inc = (2 * Math.PI * f0 * 2 ** ((scoop - sag + (n.cents ?? 0) + walk) / 1200)) / sr;
        const open = Math.min(1, e / (gain * 0.3));
        body.c = lp(500 + 600 * open, 0.8, sr);
      }
      phase += inc;
      // harmonics 1-10 at 1/h^1.2 by the Chebyshev recurrence: one sine and one cosine a sample
      const c2 = 2 * Math.cos(phase);
      let sPrev = 0;
      let sCur = Math.sin(phase);
      let s = sCur;
      for (let h = 2; h <= 10; h++) {
        const sNext = c2 * sCur - sPrev;
        if (f0 * h < sr / 2 - 2000) s += sNext / h ** 1.2;
        sPrev = sCur;
        sCur = sNext;
      }
      let v = body.tick(s);
      v += 0.3 * bell.tick(s);
      const w = r() * 2 - 1;
      // the breath: -24 dB while the note is held, climbing toward -12 dB as it runs out
      const breathDb = -24 + 12 * (n.breathRise ?? 0) * (tau / n.dur);
      v += breath.tick(w) * fromDb(breathDb) * 5;
      // the lip: 90 ms in, gone in another 120
      const lipEnv = tau < 0.09 ? tau / 0.09 : Math.exp(-(tau - 0.09) / 0.06);
      v += lip.tick(w) * lipEnv * lipGain * 2.5;
      // a note cut early stops in 6 ms rather than dying away
      const cut = trim > 0 && tau > cutAt ? Math.max(0, 1 - (tau - cutAt) / 0.006) : 1;
      out[first + i] += v * e * cut;
    }
  }
  return out;
}

/** A pitch as the fundamental's partial, for the tests: which partial (to a tenth) a frequency is. */
export const partialOf = (hz: number, fundamental = HORN_FUNDAMENTAL): number => hz / fundamental;

/* The phrases (SOUND_DESIGN §1.1). Times are seconds from the start of each buffer. */

/** the call to the table: 6 -> 8 -> 7 -> 6 -> 5, one breath. The last three notes are the falling gesture the valley repeats. */
export const CALL: HornNote[] = [
  { partial: 6, start: 0, dur: 1.0, attack: 0.2, scoopCents: 60, gain: 0.9 },
  { partial: 8, start: 0.95, dur: 0.75, attack: 0.06, scoopCents: 80, gain: 1 },
  { partial: 7, start: 1.65, dur: 0.55, attack: 0.05, scoopCents: 30, sagCents: 10, gain: 0.95 },
  { partial: 6, start: 2.15, dur: 0.5, attack: 0.05, scoopCents: 20, sagCents: 20, gain: 0.9 },
  { partial: 5, start: 2.6, dur: 0.55, attack: 0.05, scoopCents: 20, sagCents: 60, gain: 0.85, breathRise: 1, trimEnd: 0.04 },
];
export const CALL_SECONDS = 3.2;
/** the final gesture alone (7 -> 6 -> 5), for the valley's repeats */
export const ECHO: HornNote[] = CALL.slice(2).map((n) => ({ ...n, start: n.start - 1.65 }));
export const ECHO_SECONDS = 1.55;
/** when each repeat begins after the call does, and how dark and how quiet it is */
export const VALLEY: ReadonlyArray<{ at: number; gainDb: number; lowpassHz: number }> = [
  { at: 3.5, gainDb: -9, lowpassHz: 1000 },
  { at: 4.9, gainDb: -16, lowpassHz: 650 },
  { at: 6.6, gainDb: -23, lowpassHz: 420 },
];

/** the podium: the horn returns, resolved and bare - 6 -> 5 -> 4, no echo, a steadier lip, the last note settling flat */
export const PODIUM: HornNote[] = [
  { partial: 6, start: 0, dur: 0.75, attack: 0.15, scoopCents: 40, gain: 0.9 },
  { partial: 5, start: 0.7, dur: 0.75, attack: 0.06, scoopCents: 20, gain: 0.9 },
  { partial: 4, start: 1.4, dur: 1.1, attack: 0.06, scoopCents: 20, cents: -12, gain: 0.95, release: 0.5 },
];
export const PODIUM_SECONDS = 2.5;

/** the last set: one bare low note, partial 4 */
export const LAST: HornNote[] = [{ partial: 4, start: 0, dur: 1.2, attack: 0.2, scoopCents: 30, gain: 0.9, release: 0.3 }];
export const LAST_SECONDS = 1.2;
