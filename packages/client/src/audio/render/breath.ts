/* Breath and reed: the shepherd's instruments, rendered in plain JS at 32 kHz.
 *   Fluier - sine plus 2nd (-14 dB) and 3rd (-20 dB) harmonics; breath noise band-passed at f0
 *            (Q 8) and at 3 kHz; 50 ms attack with a -30-cent scoop; 5.5 Hz vibrato of +-12 cents
 *            after 150 ms.
 *   Caval  - an octave down, breathier, its breath band at 1.4 kHz.
 *   Tulnic - harmonics 1-8 at -6 dB/octave, low-passed at 900 Hz, 200 ms attack.
 *   Drâmbă - a 10 %-duty pulse at 98 Hz through two swept band-pass formants, a 6 Hz wobble.
 * All in D Romanian minor (the motifs, §3.8). No DOM, no Web Audio: unit-testable in Node. */

import { midi, rng } from '../util.js';
import { Biquad, bp, expEnv, lp, RENDER_SR } from './dsp.js';

const fromDb = (d: number): number => 10 ** (d / 20);

export interface BreathNote {
  /** MIDI note as written (a caval sounds an octave below) */
  note: number;
  /** seconds from the start of the buffer */
  start: number;
  dur: number;
  gain?: number;
  /** the pitch sags this many cents over the note (the jellyfish's trill) */
  sagCents?: number;
  /** a constant offset from the written pitch, in cents (a trill that sinks) */
  cents?: number;
}

export interface BreathOptions {
  octave?: 0 | -1;
  breathDb?: number;
  breathBand?: number;
  seed?: number;
  sr?: number;
}

/** Renders a run of fluier or caval notes into one mono buffer of `seconds`. */
export function renderBreath(notes: BreathNote[], seconds: number, o: BreathOptions = {}): Float32Array {
  const sr = o.sr ?? RENDER_SR;
  const octave = o.octave ?? 0;
  const breathDb = o.breathDb ?? -18;
  const breathBand = o.breathBand ?? (octave < 0 ? 1400 : 3000);
  const r = rng(o.seed ?? 5);
  const out = new Float32Array(Math.ceil(seconds * sr));
  for (const n of notes) {
    const f = midi(n.note + 12 * octave);
    const gain = n.gain ?? 1;
    const first = Math.floor(n.start * sr);
    const len = Math.min(out.length - first, Math.ceil((n.dur + 0.02) * sr));
    const holdEnd = Math.max(0.06, n.dur - 0.12);
    const f1 = new Biquad(bp(f, 8, sr)), f2 = new Biquad(bp(breathBand, 1, sr));
    const g1 = fromDb(breathDb) * 6, g2 = fromDb(breathDb - 8) * 2;
    let phase = 0;
    for (let i = 0; i < len; i++) {
      const tau = i / sr;
      const e = expEnv(tau, 0.05, gain * 0.3, holdEnd, n.dur);
      const scoop = tau < 0.05 ? -30 * (1 - tau / 0.05) : 0;
      const depth = tau < 0.15 ? 0 : tau < 0.35 ? (12 * (tau - 0.15)) / 0.2 : 12;
      const cents = scoop + depth * Math.sin(2 * Math.PI * 5.5 * tau) - (n.sagCents ?? 0) * (tau / n.dur) + (n.cents ?? 0);
      phase += (2 * Math.PI * f * 2 ** (cents / 1200)) / sr;
      let s = Math.sin(phase);
      if (f * 2 < sr / 2 - 2000) s += fromDb(-14) * Math.sin(2 * phase);
      if (f * 3 < sr / 2 - 2000) s += fromDb(-20) * Math.sin(3 * phase);
      const w = r() * 2 - 1;
      s += f1.tick(w) * g1 + f2.tick(w) * g2;
      out[first + i] += s * e;
    }
  }
  return out;
}

/** A horn note: harmonics 1-8 at 1/h, low-passed at 900 Hz, 200 ms attack, 300 ms release. */
export function renderTulnic(note: number, dur: number, gain = 1, sr = RENDER_SR): Float32Array {
  const out = new Float32Array(Math.ceil(dur * sr));
  const f = midi(note);
  const filter = new Biquad(lp(900, 0.7071, sr));
  for (let i = 0; i < out.length; i++) {
    const tau = i / sr;
    let s = 0;
    for (let h = 1; h <= 8; h++) s += Math.sin(2 * Math.PI * f * h * tau) / h;
    out[i] = filter.tick(s) * expEnv(tau, 0.2, 0.25 * gain, Math.max(0.21, dur - 0.3), dur);
  }
  return out;
}

export interface DrambaVoice {
  start: number;
  dur: number;
  gain?: number;
  /** centre of each formant at the start and at the end of the note, Hz */
  formants: [[number, number], [number, number]];
  wobbleHz?: number;
  Q?: [number, number];
}

let PULSE: Float32Array | null = null;
function pulseTable(): Float32Array {
  if (!PULSE) {
    const N = 2048;
    PULSE = new Float32Array(N);
    for (let k = 1; k < 48; k++) for (let i = 0; i < N; i++) PULSE[i] += (2 / (k * Math.PI)) * Math.sin(k * Math.PI * 0.1) * Math.cos((2 * Math.PI * k * i) / N);
  }
  return PULSE;
}

/** A jaw harp: the pulse's overtones picked out by two moving formants. */
export function renderDramba(voices: DrambaVoice[], seconds: number, sr = RENDER_SR): Float32Array {
  const out = new Float32Array(Math.ceil(seconds * sr));
  const table = pulseTable();
  const N = table.length;
  for (const v of voices) {
    const first = Math.floor(v.start * sr);
    const len = Math.min(out.length - first, Math.ceil((v.dur + 0.02) * sr));
    const gain = v.gain ?? 1;
    const [Q1, Q2] = v.Q ?? [5, 7];
    const b1 = new Biquad(bp(v.formants[0][0], Q1, sr)), b2 = new Biquad(bp(v.formants[1][0], Q2, sr));
    const wob = v.wobbleHz ?? 6;
    let ph = 0;
    for (let i = 0; i < len; i++) {
      const tau = i / sr, u = tau / v.dur;
      if (i % 8 === 0) {
        const fa = v.formants[0][0] * (v.formants[0][1] / v.formants[0][0]) ** Math.min(1, u);
        const fb = v.formants[1][0] * (v.formants[1][1] / v.formants[1][0]) ** Math.min(1, u);
        b1.c = bp(fa + v.formants[0][0] * 0.25 * Math.sin(2 * Math.PI * wob * tau), Q1, sr);
        b2.c = bp(fb, Q2, sr);
      }
      ph = (ph + (98 * N) / sr) % N;
      const i0 = Math.floor(ph), fr = ph - i0;
      const p = table[i0] * (1 - fr) + table[(i0 + 1) % N] * fr;
      const e = tau < 0.01 ? 1e-4 * (gain / 1e-4) ** (tau / 0.01) : expEnv(tau, 0.01, gain, Math.max(0.02, v.dur - 0.06), v.dur);
      out[first + i] += (b1.tick(p) + b2.tick(p)) * e;
    }
  }
  return out;
}
