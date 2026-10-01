/* Craft - the small things a hand does to wood, rope and clay, and the three ways a frame breaks
 * (SOUND_DESIGN §1). Everything here is noise through filters and a few damped modes: no melodic
 * instrument, no sine bleep. Only Shark, Mantis and Whale use `crack`, `fibres` and `groan`: they are the
 * only cues that may leave the palette. */

import { type Ctx, env, filt, harmonics, hooks, noiseSrc } from './common.js';

/** A chisel tapped into the rim: a 2.5 ms burst and one tiny plank-D mode. `flam` adds a smaller second tick. 6 nodes. */
export function chisel(ctx: Ctx, out: AudioNode, t: number, gain: number, r: () => number, f0 = 2100, flam = false): void {
  noiseSrc(ctx, t, 0.004, r).connect(filt(ctx, 'bandpass', 3200 * (f0 / 2100), 2)).connect(env(ctx, t, gain * 0.7, 0.0004, 0.0025)).connect(out);
  const o = ctx.createOscillator();
  o.frequency.setValueAtTime(f0, t);
  o.connect(env(ctx, t, gain * 0.35, 0.0008, 0.012)).connect(out);
  o.start(t);
  o.stop(t + 0.03);
  if (flam) noiseSrc(ctx, t + 0.006, 0.003, r).connect(filt(ctx, 'bandpass', 4200, 2)).connect(env(ctx, t + 0.006, gain * 0.3, 0.0004, 0.002)).connect(out);
}

/**
 * A clay egg tapped on a board: a 1.5 ms tick and two non-harmonic hollow modes (f0 and x2.2) that fall 3 % in the
 * first 10 ms. `buzz` is the hairline crack in the glaze: a faint rattle riding the second mode. 7 nodes.
 */
export function clay(ctx: Ctx, out: AudioNode, t: number, gain: number, r: () => number, f0 = 790, buzz = false): void {
  noiseSrc(ctx, t, 0.004, r).connect(filt(ctx, 'bandpass', 4200, 1.2)).connect(env(ctx, t, gain * 0.4, 0.0004, 0.002)).connect(out);
  [[1, 0.038, 1], [2.2, 0.02, 0.45]].forEach(([m, t60, a]) => {
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(f0 * m, t);
    o.frequency.exponentialRampToValueAtTime(f0 * m * 0.97, t + 0.01);
    o.connect(env(ctx, t, gain * 0.55 * a, 0.0008, t60)).connect(out);
    o.start(t);
    o.stop(t + t60 + 0.02);
  });
  if (buzz) noiseSrc(ctx, t + 0.004, 0.03, r).connect(filt(ctx, 'bandpass', f0 * 2.2, 14)).connect(env(ctx, t + 0.004, gain * 0.12, 0.002, 0.026)).connect(out);
}

/** Wood parting: a noise burst band-limited to `hp`..6 kHz, `dur` long (a crack is 1.5-2 ms). 4 nodes. */
export function crack(ctx: Ctx, out: AudioNode, t: number, gain: number, r: () => number, hp = 2800, dur = 0.002): void {
  hooks.breaks?.('crack');
  // high-passed to be bright, low-passed at 6 kHz to keep it out of the harsh top (and its inter-sample peaks under the ceiling)
  noiseSrc(ctx, t, dur + 0.006, r).connect(filt(ctx, 'highpass', hp, 0.7)).connect(filt(ctx, 'lowpass', 6000, 0.7)).connect(env(ctx, t, gain, 0.0003, dur)).connect(out);
}

/**
 * Splintering rope fibres: `n` micro-bursts of noise between `f0` and `f1` Hz over `dur` seconds, dense at the start
 * and thinning (each gap wider than the last), each a few ms long. 3 nodes a burst.
 */
export function fibres(ctx: Ctx, out: AudioNode, t: number, dur: number, gain: number, r: () => number, f0 = 6000, f1 = 2000, n = 12): void {
  hooks.breaks?.('fibres');
  for (let i = 0; i < n; i++) {
    const u = i / Math.max(1, n - 1);
    const at = t + dur * u * u * (0.9 + 0.2 * r());
    const f = f0 * (f1 / f0) ** u * (0.85 + 0.3 * r());
    noiseSrc(ctx, at, 0.008, r).connect(filt(ctx, 'bandpass', f, 3)).connect(env(ctx, at, gain * (1 - 0.6 * u) * (0.6 + 0.4 * r()), 0.0004, 0.003 + 0.004 * r())).connect(out);
  }
}

/**
 * A rope twisting under load: a narrow band sweeping down with a 30 Hz grain in its level. `pitch` scales the band.
 * 5 nodes.
 */
export function ropeCreak(ctx: Ctx, out: AudioNode, t: number, dur: number, gain: number, r: () => number, f0 = 700, f1 = 520, pitch = 1): void {
  const bp = filt(ctx, 'bandpass', f0 * pitch, 6);
  bp.frequency.setValueAtTime(f0 * pitch, t);
  bp.frequency.exponentialRampToValueAtTime(f1 * pitch, t + dur);
  const g = env(ctx, t, gain, 0.03, dur - 0.03);
  const grain = ctx.createOscillator();
  grain.frequency.value = 30 + r() * 4;
  const depth = ctx.createGain();
  depth.gain.value = gain * 0.35;
  grain.connect(depth).connect(g.gain);
  grain.start(t);
  grain.stop(t + dur + 0.02);
  noiseSrc(ctx, t, dur, r).connect(bp).connect(g).connect(out);
}

/**
 * The hull of the whale: a 55 Hz pulse low-passed and swept down, with a resonant creak (a narrow band at 90-140 Hz)
 * riding over it. The pulse's saturated harmonics (165 / 220 / 330 Hz) are what a phone hears.
 * `sharpCents` detunes the pulse's third harmonic's layer (the wrong partial). ~12 nodes.
 */
export function groan(ctx: Ctx, out: AudioNode, t: number, dur: number, gain: number, r: () => number, sharpCents = 45): void {
  hooks.breaks?.('groan');
  const saw = ctx.createOscillator();
  saw.type = 'sawtooth';
  saw.frequency.setValueAtTime(58, t);
  saw.frequency.exponentialRampToValueAtTime(48, t + dur);
  const lp = filt(ctx, 'lowpass', 300, 0.9);
  lp.frequency.setValueAtTime(300, t);
  lp.frequency.exponentialRampToValueAtTime(120, t + dur);
  const body = env(ctx, t, gain, dur * 0.35, dur * 0.65);
  saw.connect(lp).connect(body).connect(out);
  harmonics(ctx, saw, body, -4);
  saw.start(t);
  saw.stop(t + dur + 0.05);
  // the wrong-sounding partial: a third harmonic of the hull, 45 cents sharp of where it belongs
  const wrong = ctx.createOscillator();
  wrong.frequency.value = 3 * 55 * 2 ** (sharpCents / 1200);
  wrong.connect(env(ctx, t + dur * 0.1, gain * 0.16, dur * 0.3, dur * 0.5)).connect(out);
  wrong.start(t + dur * 0.1);
  wrong.stop(t + dur * 0.95);
  const bp = filt(ctx, 'bandpass', 140, 10);
  bp.frequency.setValueAtTime(140, t);
  bp.frequency.exponentialRampToValueAtTime(90, t + Math.min(dur, 0.4));
  noiseSrc(ctx, t, dur, r).connect(bp).connect(env(ctx, t, gain * 0.9, 0.05, dur - 0.05)).connect(out);
}

/**
 * A smouldering rope: `n` soft ember ticks (narrow noise at 1.1-2.2 kHz, a few ms each) and the hush of the fibre glowing
 * under them. Not a break: nothing splinters, so it stays inside the palette. 3 nodes a tick, 3 for the hush.
 */
export function ember(ctx: Ctx, out: AudioNode, t: number, dur: number, gain: number, r: () => number, n = 3): void {
  for (let i = 0; i < n; i++) {
    const at = t + dur * (i / Math.max(1, n)) * (0.7 + 0.5 * r());
    noiseSrc(ctx, at, 0.01, r).connect(filt(ctx, 'bandpass', 1100 + r() * 1100, 4)).connect(env(ctx, at, gain * (0.5 + 0.5 * r()), 0.0006, 0.006 + 0.006 * r())).connect(out);
  }
  noiseSrc(ctx, t, dur, r).connect(filt(ctx, 'bandpass', 900, 0.8)).connect(env(ctx, t, gain * 0.12, dur * 0.3, dur * 0.7)).connect(out);
}
