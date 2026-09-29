/* Water — the pond. Bubble: a sine rising ~40 % over its 40-80 ms life (large 450 Hz, small
 * 900-1600 Hz). Plop: one large and two or three small bubbles plus a 120 ms splash. Drip: one
 * 1.8-2.6 kHz bubble. */

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

export function drip(ctx: Ctx, out: AudioNode, t: number, r: () => number, gain = 1): void {
  bubble(ctx, out, t, 1800 + r() * 800, 0.04, gain);
}

/** The water churns: a low-passed noise sweeping down. 3 nodes plus the filter. */
export function churn(ctx: Ctx, out: AudioNode, t: number, dur: number, gain: number, r: () => number): void {
  const lp = filt(ctx, 'lowpass', 4000);
  lp.frequency.setValueAtTime(4000, t);
  lp.frequency.exponentialRampToValueAtTime(500, t + dur);
  noiseSrc(ctx, t, dur, r).connect(lp).connect(env(ctx, t, gain, 0.02, Math.max(0.01, dur - 0.02))).connect(out);
}
