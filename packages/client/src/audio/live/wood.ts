/* Wood — the voice of the table. An exciter burst ringing four free-free bar modes
 * (1 : 2.756 : 5.404 : 8.933). The grammar (§3.1): a ringing plank A, B or C always means a
 * seat, so only seat cues strike one. Plank D is the clock and your own hand; things that
 * land use the table top. At most 10 nodes a hit. */

import { rng } from '../util.js';
import { type Ctx, env, filt, hooks, noiseSrc } from './common.js';

export const MODES = [1, 2.756, 5.404, 8.933];
const AMPS = [1, 0.5, 0.25, 0.12];
const T60 = [0.16, 0.09, 0.045, 0.025];
export type Plank = 'A' | 'B' | 'C' | 'D';
export const PLANK: Record<Plank, [number, number]> = { A: [180, 1.4], B: [320, 1.0], C: [620, 0.7], D: [1200, 0.45] };

export interface WoodOpts {
  plank?: Plank;
  f0?: number;
  /** 0 rings freely, 1 is stopped at once and low-passed */
  damping?: number;
  gain?: number;
  /** a harder mallet: a shorter, brighter exciter */
  hard?: boolean;
  seed?: number;
  /** a multiplier on the bar's pitch (the take, the chain, the jitter of variation.ts) */
  pitch?: number;
  /** a multiplier per mode: the deliberate imperfection of a bar whose second partial is a little off */
  detune?: readonly number[];
  /** a multiplier on how long the modes ring (a thick bar rings longer than a small one) */
  ring?: number;
  /** no exciter: the note starts mid-envelope, as if its attack were missing */
  soft?: boolean;
}

export function wood(ctx: Ctx, out: AudioNode, t: number, o: WoodOpts = {}): void {
  const { plank = 'B', damping = 0, gain = 1, hard = false, seed = 1 } = o;
  hooks.strike?.(plank, damping);
  const r = rng(seed);
  const [pf, size] = PLANK[plank];
  const base = (o.f0 ?? pf) * (o.pitch ?? 1) * (1 + (r() - 0.5) * 0.01);
  let dest: AudioNode = out;
  if (damping > 0.05) {
    dest = filt(ctx, 'lowpass', 9000 - 7000 * damping);
    dest.connect(out);
  }
  if (!o.soft)
    noiseSrc(ctx, t, 0.005, r)
      .connect(filt(ctx, 'bandpass', Math.min((hard ? 4 : 2.5) * base, 15000), 1))
      .connect(env(ctx, t, gain * (hard ? 0.9 : 0.6), 0.0005, hard ? 0.002 : 0.004))
      .connect(dest);
  // damped hits keep three modes; the fourth of a free ring shares the third's envelope
  const shared = damping > 0.05 ? [[0], [1], [2]] : [[0], [1], [2, 3]];
  for (const group of shared) {
    const t60 = T60[group[group.length - 1]] * size * (o.ring ?? 1) * (1 - 0.7 * damping);
    const amp = group.reduce((s, i) => s + AMPS[i], 0) / group.length;
    const g = env(ctx, t, amp * 0.35 * gain, 0.001, t60);
    g.connect(dest);
    for (const i of group) {
      const f = base * MODES[i] * (o.detune?.[i] ?? 1) * (1 + (r() - 0.5) * 0.02);
      const o2 = ctx.createOscillator();
      o2.frequency.setValueAtTime(Math.min(f, ctx.sampleRate / 2 - 2000), t);
      o2.connect(g);
      o2.start(t);
      o2.stop(t + t60 + 0.05);
    }
  }
}

/**
 * A dry wooden click — the clock: a bright exciter on plank D, stopped at once, so it has no
 * ring a seat could own. 8 nodes.
 */
export function click(ctx: Ctx, out: AudioNode, t: number, seed: number, gain = 1, pitch = 1): void {
  hooks.strike?.('D', 0.9);
  const r = rng(seed);
  // a broad band-pass, not a low-pass: a click has no DC and no low tail for a 30 Hz high-pass to ring on
  const lp = filt(ctx, 'bandpass', 2400, 0.6);
  lp.connect(out);
  noiseSrc(ctx, t, 0.004, r).connect(filt(ctx, 'bandpass', 3200, 1.5)).connect(env(ctx, t, gain * 0.7, 0.0005, 0.003)).connect(lp);
  const base = 1200 * pitch * (1 + (r() - 0.5) * 0.01);
  for (let i = 0; i < 2; i++) {
    const t60 = T60[i] * 0.45 * 0.25;
    const g = env(ctx, t, AMPS[i] * 0.35 * 0.6 * gain, 0.001, t60);
    g.connect(lp);
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(base * MODES[i], t);
    o.connect(g);
    o.start(t);
    o.stop(t + t60 + 0.05);
  }
}

/** Seat signatures: plank size (low A, middle B, high C) x knock count (one, or two 75 ms apart). */
export const SIGNATURE: ReadonlyArray<readonly [Plank, number]> = [['A', 1], ['B', 1], ['C', 1], ['A', 2], ['B', 2], ['C', 2]];

export function signature(ctx: Ctx, out: AudioNode, t: number, seat: number, seed: number, gain = 1, damping = 0, pitch = 1, hard = false): void {
  const [plank, knocks] = SIGNATURE[((seat % 6) + 6) % 6];
  // the totem bar's deliberate imperfection: its second partial sits 1.5 % off the bar ratio
  for (let k = 0; k < knocks; k++) wood(ctx, out, t + k * 0.075, { plank, gain: gain * (k ? 0.8 : 1), damping, seed: seed + k, pitch, hard, detune: [1, 1.015, 1, 1] });
}
