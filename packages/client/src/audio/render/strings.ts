/* Strings (țambal): Karplus-Strong computed in JS. Three strings per course, detuned +-4 cents,
 * decay 0.996. The speaker variant is damped by hand at 180 ms. */

import { rng } from '../util.js';
import { RENDER_SR } from './dsp.js';

/** One struck course, `seconds` long. `dampAt` (seconds) stops the strings by hand. */
export function renderStrings(f: number, seconds: number, seed: number, dampAt?: number, sr = RENDER_SR): Float32Array {
  const len = Math.floor(seconds * sr);
  const out = new Float32Array(len);
  const r = rng(seed);
  for (const cents of [-4, 0, 4]) {
    const ff = f * 2 ** (cents / 1200);
    const N = Math.max(2, Math.round(sr / ff));
    const buf = new Float32Array(N);
    let prev = 0;
    for (let i = 0; i < N; i++) {
      prev += 0.35 * (r() * 2 - 1 - prev);
      buf[i] = prev;
    }
    let idx = 0;
    for (let n = 0; n < len; n++) {
      const a = buf[idx];
      buf[idx] = 0.996 * 0.5 * (a + buf[(idx + 1) % N]);
      out[n] += a / 3;
      idx = (idx + 1) % N;
    }
  }
  if (dampAt !== undefined) {
    // hand on the strings: hold to dampAt, then fall 60 dB over 60 ms
    const a = Math.floor(dampAt * sr), b = Math.min(len, a + Math.floor(0.06 * sr));
    for (let n = a; n < len; n++) out[n] *= n < b ? 0.001 ** ((n - a) / (b - a)) : 0;
  }
  return out;
}
