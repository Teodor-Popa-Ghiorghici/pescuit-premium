/* Plain-JS sample rendering helpers. The rendered families (strings, riffle, breath, drâmbă)
 * are computed here rather than in the graph because a DelayNode in a feedback cycle is
 * clamped to one 128-frame render quantum, so a native Karplus-Strong loop cannot sound above
 * ~375 Hz. They render at 32 kHz. */

export const RENDER_SR = 32000;

export type Coef = [number, number, number, number, number]; // b0 b1 b2 a1 a2 (a0 normalised)

/** RBJ band-pass, constant 0 dB peak gain: the same shape as Web Audio's `bandpass`. */
export function bp(f: number, Q: number, sr = RENDER_SR): Coef {
  const w = (2 * Math.PI * f) / sr, alpha = Math.sin(w) / (2 * Q), a0 = 1 + alpha;
  return [alpha / a0, 0, -alpha / a0, (-2 * Math.cos(w)) / a0, (1 - alpha) / a0];
}
export function lp(f: number, Q = 0.7071, sr = RENDER_SR): Coef {
  const w = (2 * Math.PI * f) / sr, alpha = Math.sin(w) / (2 * Q), c = Math.cos(w), a0 = 1 + alpha;
  return [((1 - c) / 2) / a0, (1 - c) / a0, ((1 - c) / 2) / a0, (-2 * c) / a0, (1 - alpha) / a0];
}
export function hp(f: number, Q = 0.7071, sr = RENDER_SR): Coef {
  const w = (2 * Math.PI * f) / sr, alpha = Math.sin(w) / (2 * Q), c = Math.cos(w), a0 = 1 + alpha;
  return [((1 + c) / 2) / a0, (-(1 + c)) / a0, ((1 + c) / 2) / a0, (-2 * c) / a0, (1 - alpha) / a0];
}

/** A direct-form-I biquad whose coefficients may change between samples. */
export class Biquad {
  private x1 = 0;
  private x2 = 0;
  private y1 = 0;
  private y2 = 0;
  constructor(public c: Coef) {}
  tick(x: number): number {
    const [b0, b1, b2, a1, a2] = this.c;
    const y = b0 * x + b1 * this.x1 + b2 * this.x2 - a1 * this.y1 - a2 * this.y2;
    this.x2 = this.x1; this.x1 = x; this.y2 = this.y1; this.y1 = y;
    return y;
  }
}

/** Exponential attack, hold, exponential release — the envelope every breath and horn shares. */
export function expEnv(tau: number, attack: number, peak: number, holdEnd: number, dur: number): number {
  const floor = 1e-4;
  if (tau < 0) return 0;
  if (tau < attack) return floor * (peak / floor) ** (tau / attack);
  if (tau < holdEnd) return peak;
  if (tau >= dur) return 0;
  return peak * (floor / peak) ** ((tau - holdEnd) / Math.max(1e-6, dur - holdEnd));
}
