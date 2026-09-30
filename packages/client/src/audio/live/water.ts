/* Water — the pond. Bubble: a sine rising ~40 % over its 40-80 ms life (large 450 Hz, small
 * 900-1600 Hz); only the drain gurgle (`table.poolEmpty`) still uses it. Plop: one large and two or three small
 * bubbles plus a 120 ms splash (no longer used by a cue). Drip: a resonant noise band falling 2400 -> 1300 Hz. */

import { type Ctx, env, filt, noiseSrc } from './common.js';

/** 2 nodes. */
export function bubble(ctx: Ctx, out: AudioNode, t: number, f0: number, life: number, gain: number): void {
  const o = ctx.createOscillator();
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(f0 * 1.4, t + life);
  o.connect(env(ctx, t, gain * 0.5, 0.002, life)).connect(out);
  o.start(t);
  o.stop(t + life + 0.02);
}

/** 3 nodes. */
export function splash(ctx: Ctx, out: AudioNode, t: number, r: () => number, gain: number, f = 2500, dur = 0.12): void {
  noiseSrc(ctx, t, dur, r).connect(filt(ctx, 'bandpass', f, 0.7)).connect(env(ctx, t, gain, 0.004, dur)).connect(out);
}

export function plop(ctx: Ctx, out: AudioNode, t: number, r: () => number, gain = 1): void {
  bubble(ctx, out, t, 430 + r() * 60, 0.08, gain);
  const n = 2 + Math.floor(r() * 2);
  for (let i = 0; i < n; i++) bubble(ctx, out, t + 0.01 + r() * 0.06, 900 + r() * 700, 0.04, 0.4 * gain);
  splash(ctx, out, t + 0.005, r, 0.2 * gain);
}

/**
 * A drip: a droplet in still water. Noise through a narrow resonant band that falls 2400 -> 1300 Hz in 35 ms (a fast
 * pitch drop), and a dull 6 ms tap under it. Made of noise, not an oscillator: no sine bleep. 5 nodes.
 */
export function drip(ctx: Ctx, out: AudioNode, t: number, r: () => number, gain = 1, pitch = 1, rise = false): void {
  // `rise` is the audition page's other direction (a real entrained bubble tends to rise); the game's drip falls
  const [a, b] = rise ? [1300, 2400] : [2400, 1300];
  const bp = filt(ctx, 'bandpass', a * pitch, 25);
  bp.frequency.setValueAtTime(a * pitch * (1 + (r() - 0.5) * 0.1), t);
  bp.frequency.exponentialRampToValueAtTime(b * pitch, t + 0.035);
  noiseSrc(ctx, t, 0.05, r).connect(bp).connect(env(ctx, t, gain * 1.6, 0.001, 0.04)).connect(out);
  noiseSrc(ctx, t, 0.008, r).connect(filt(ctx, 'lowpass', 700)).connect(env(ctx, t, gain * 0.5, 0.001, 0.006)).connect(out);
}

/** The water churns: a low-passed noise sweeping down. 3 nodes plus the filter. */
export function churn(ctx: Ctx, out: AudioNode, t: number, dur: number, gain: number, r: () => number): void {
  const lp = filt(ctx, 'lowpass', 4000);
  lp.frequency.setValueAtTime(4000, t);
  lp.frequency.exponentialRampToValueAtTime(500, t + dur);
  noiseSrc(ctx, t, dur, r).connect(lp).connect(env(ctx, t, gain, 0.02, Math.max(0.01, dur - 0.02))).connect(out);
}
