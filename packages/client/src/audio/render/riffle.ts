/* The riffle: 30-45 clicks, each high-passed at 2.5-4 kHz, sparse-dense-sparse over 0.8 s
 * (170 ms in the speaker variant). */

import { rng } from '../util.js';
import { Biquad, expEnv, hp, RENDER_SR } from './dsp.js';

export function renderRiffle(dur: number, seed: number, gain = 1, sr = RENDER_SR): Float32Array {
  const r = rng(seed);
  const out = new Float32Array(Math.ceil((dur + 0.02) * sr));
  const n = 30 + Math.floor(r() * 16);
  for (let i = 0; i < n; i++) {
    const u = i / (n - 1);
    const at = dur * (0.4 * u + 0.6 * (0.5 + 4 * (u - 0.5) ** 3));
    const g = gain * (0.5 + 0.5 * Math.sin(Math.PI * u)) * (0.7 + 0.3 * r());
    const filter = new Biquad(hp(2500 + r() * 1500, 0.7071, sr));
    const first = Math.floor(at * sr);
    const len = Math.ceil(0.006 * sr);
    for (let k = 0; k < len && first + k < out.length; k++) out[first + k] += filter.tick(r() * 2 - 1) * expEnv(k / sr, 0.0005, g * 0.5, 0.0005, 0.0035);
  }
  return out;
}
