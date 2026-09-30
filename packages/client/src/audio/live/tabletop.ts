/* The table top and its neighbours: things that land (an unpitched thud with no modal ring, so
 * it can never be heard as a seat's plank), the ink stamp, and the dobă (skin). All bodies get
 * a tanh harmonic layer so phone speakers can play them. */

import { rng } from '../util.js';
import { type Ctx, env, filt, harmonics, noiseSrc } from './common.js';
import { paperSlide } from './paper.js';

/** Something landing on the table. Heavier = lower. `pitch` is variation.ts's multiplier. 7 nodes. */
export function thud(ctx: Ctx, out: AudioNode, t: number, gain: number, r: () => number, weight = 1, pitch = 1): void {
  const f = (125 / weight) * pitch;
  const o = ctx.createOscillator();
  o.frequency.setValueAtTime(f, t);
  o.frequency.exponentialRampToValueAtTime(f * 0.6, t + 0.05);
  const body = env(ctx, t, gain * 0.6, 0.002, 0.05);
  o.connect(body).connect(out);
  harmonics(ctx, o, body);
  o.start(t);
  o.stop(t + 0.08);
  noiseSrc(ctx, t, 0.04, r).connect(filt(ctx, 'bandpass', 440 / Math.sqrt(weight), 0.9)).connect(env(ctx, t, gain * 0.9, 0.001, 0.035)).connect(out);
}

/** A card pressed down: a dull ink-press thud under a faint paper scuff - not a snap. 10 nodes. */
export function slap(ctx: Ctx, out: AudioNode, t: number, gain: number, r: () => number, weight = 1, pitch = 1): void {
  // the scuff: a soft-edged band (6 ms in, 24 ms out, 1.9 kHz, low Q), about 20 dB under the body
  noiseSrc(ctx, t, 0.03, r).connect(filt(ctx, 'bandpass', 1900 * pitch, 0.6)).connect(env(ctx, t, gain * 0.16, 0.006, 0.024)).connect(out);
  thud(ctx, out, t + 0.003, gain * 0.8, r, weight, pitch);
}

/** Ink meeting paper: a sine falling 110 -> 70 Hz over 60 ms, then a 15 ms peel. 7 nodes. */
export function stamp(ctx: Ctx, out: AudioNode, t: number, gain: number, r: () => number, pitch = 1): void {
  const o = ctx.createOscillator();
  o.frequency.setValueAtTime(110 * pitch, t);
  o.frequency.exponentialRampToValueAtTime(70 * pitch, t + 0.06);
  const body = env(ctx, t, gain * 0.8, 0.002, 0.07);
  o.connect(body).connect(out);
  harmonics(ctx, o, body);
  o.start(t);
  o.stop(t + 0.1);
  noiseSrc(ctx, t + 0.04, 0.015, r).connect(filt(ctx, 'highpass', 2000)).connect(env(ctx, t + 0.04, gain * 0.2, 0.001, 0.015)).connect(out);
}

/** Skin: a sine falling 95 -> 52 Hz, a 500 Hz slap, a tanh layer. 7 nodes. */
export function doba(ctx: Ctx, out: AudioNode, t: number, gain: number, r: () => number, decay = 0.55, pitch = 1): void {
  const o = ctx.createOscillator();
  o.frequency.setValueAtTime(95 * pitch, t);
  o.frequency.exponentialRampToValueAtTime(52 * pitch, t + 0.12);
  const body = env(ctx, t, gain * 0.9, 0.003, decay);
  o.connect(body).connect(out);
  harmonics(ctx, o, body);
  o.start(t);
  o.stop(t + decay + 0.05);
  noiseSrc(ctx, t, 0.03, r).connect(filt(ctx, 'bandpass', 500, 0.8)).connect(env(ctx, t, gain * 0.4, 0.001, 0.03)).connect(out);
}

/** A low creak of the gate on its hinge: noise through a slow band-pass with a 28 Hz grain. */
export function creak(ctx: Ctx, out: AudioNode, t: number, dur: number, gain: number, seed: number, rising: boolean): void {
  const r = rng(seed);
  const bp = filt(ctx, 'bandpass', rising ? 180 : 320, 6);
  bp.frequency.setValueAtTime(rising ? 180 : 320, t);
  bp.frequency.exponentialRampToValueAtTime(rising ? 340 : 190, t + dur);
  paperSlide(ctx, bp, t, dur, gain * 0.7, r, [900, 500]);
  bp.connect(out);
}
