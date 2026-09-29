/* Paper — the printed cards moving. Slide: noise through a band-pass swept 2.5 -> 4.5 kHz with
 * a 40-80 Hz amplitude grain. Lift / flick: a short high-passed burst. */

import { type Ctx, env, filt, noiseSrc } from './common.js';

/** 5 nodes. */
export function paperSlide(ctx: Ctx, out: AudioNode, t: number, dur: number, gain: number, r: () => number, sweep: [number, number] = [2500, 4500]): void {
  const bp = filt(ctx, 'bandpass', sweep[0], 1.2);
  bp.frequency.setValueAtTime(sweep[0], t);
  bp.frequency.exponentialRampToValueAtTime(sweep[1], t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain * 0.5, t + 0.015);
  g.gain.setValueAtTime(gain * 0.5, t + Math.max(0.016, dur - 0.04));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  const am = ctx.createOscillator();
  am.frequency.value = 40 + r() * 40;
  const amg = ctx.createGain();
  amg.gain.value = gain * 0.15;
  am.connect(amg).connect(g.gain);
  am.start(t);
  am.stop(t + dur);
  noiseSrc(ctx, t, dur, r).connect(bp).connect(g).connect(out);
}

/** A 25 ms burst, high-passed at 3 kHz. 3 nodes. */
export function paperLift(ctx: Ctx, out: AudioNode, t: number, gain: number, r: () => number, hp = 3000): void {
  noiseSrc(ctx, t, 0.03, r).connect(filt(ctx, 'highpass', hp)).connect(env(ctx, t, gain * 0.4, 0.002, 0.025)).connect(out);
}
