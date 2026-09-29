/* Loudness and confusability measurement — the prototype's BS.1770 meter and its rhythm /
 * timbre distances, ported to typed functions. Used by the offline harness
 * (tools/audio-check.cjs), the unit tests and the lab's meters; never by the game itself,
 * so a production bundle that does not open the lab does not carry it. */

import { db } from './util.js';

/** BS.1770 K-weighting: a high shelf, then the RLB high-pass. Coefficients per sample rate. */
export function kWeight(x: Float32Array, sr: number): Float32Array {
  const stage = (f0: number, Q: number, G: number | null): number[] => {
    const K = Math.tan((Math.PI * f0) / sr);
    const a0 = 1 + K / Q + K * K;
    if (G === null) return [1, -2, 1, (2 * (K * K - 1)) / a0, (1 - K / Q + K * K) / a0];
    const Vh = 10 ** (G / 20);
    const Vb = Vh ** 0.4996667741545416;
    return [
      (Vh + (Vb * K) / Q + K * K) / a0,
      (2 * (K * K - Vh)) / a0,
      (Vh - (Vb * K) / Q + K * K) / a0,
      (2 * (K * K - 1)) / a0,
      (1 - K / Q + K * K) / a0,
    ];
  };
  const stages = [stage(1681.9744509555319, 0.7071752369554196, 3.999843853973347), stage(38.13547087602444, 0.5003270373238773, null)];
  let y = x;
  for (const [b0, b1, b2, a1, a2] of stages) {
    const out = new Float32Array(y.length);
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    for (let n = 0; n < y.length; n++) {
      const v = b0 * y[n] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
      x2 = x1; x1 = y[n]; y2 = y1; y1 = v;
      out[n] = v;
    }
    y = out;
  }
  return y;
}

export const lufsOf = (ms: number): number => -0.691 + 10 * Math.log10(Math.max(ms, 1e-12));

export function meanSquare(k: Float32Array, a: number, b: number): number {
  let s = 0;
  for (let i = a; i < b; i++) s += k[i] * k[i];
  return s / Math.max(1, b - a);
}

export const peakOf = (x: Float32Array): number => {
  let p = 0;
  for (let i = 0; i < x.length; i++) p = Math.max(p, Math.abs(x[i]));
  return p;
};

export interface Measured {
  peakDb: number;
  activeMs: number;
  activeLufs: number;
  momentaryMax: number;
  /** energy after 250 ms of the active span against the first 250 ms, dB */
  tailVsHeadDb: number;
}

export function measure(x: Float32Array, sr: number): Measured {
  const k = kWeight(x, sr);
  const peak = peakOf(x);
  const thr = peak * 1e-3; // the active span: first to last sample above -60 dB of the peak
  let a = 0, b = x.length - 1;
  while (a < b && Math.abs(x[a]) < thr) a++;
  while (b > a && Math.abs(x[b]) < thr) b--;
  const win = Math.floor(0.4 * sr), hop = Math.floor(0.1 * sr);
  let momentary = -Infinity;
  for (let i = 0; i + win <= k.length; i += hop) momentary = Math.max(momentary, lufsOf(meanSquare(k, i, i + win)));
  if (k.length < win) momentary = lufsOf(meanSquare(k, 0, k.length) * (k.length / win));
  const q = Math.floor(0.25 * sr);
  const head = meanSquare(x, a, Math.min(a + q, b + 1)) * Math.min(q, b + 1 - a);
  const tail = b + 1 - (a + q) > 0 ? meanSquare(x, a + q, b + 1) * (b + 1 - (a + q)) : 0;
  return {
    peakDb: db(peak),
    activeMs: ((b - a) / sr) * 1000,
    activeLufs: lufsOf(meanSquare(k, a, b + 1)),
    momentaryMax: momentary,
    tailVsHeadDb: tail > 0 ? 10 * Math.log10(tail / head) : -Infinity,
  };
}

export function integrated(x: Float32Array, sr: number): number {
  const k = kWeight(x, sr);
  const win = Math.floor(0.4 * sr), hop = Math.floor(0.1 * sr);
  const blocks: number[] = [];
  for (let i = 0; i + win <= k.length; i += hop) blocks.push(meanSquare(k, i, i + win));
  const abs = blocks.filter((m) => lufsOf(m) > -70);
  if (!abs.length) return -Infinity;
  const avgAbs = abs.reduce((s, m) => s + m, 0) / abs.length;
  const rel = abs.filter((m) => lufsOf(m) > lufsOf(avgAbs) - 10);
  return lufsOf(rel.reduce((s, m) => s + m, 0) / Math.max(1, rel.length));
}

export function shortTermMax(x: Float32Array, sr: number): number {
  const k = kWeight(x, sr), win = 3 * sr;
  let m = -Infinity;
  for (let i = 0; i + win <= k.length; i += Math.round(sr / 10)) m = Math.max(m, lufsOf(meanSquare(k, i, i + win)));
  return m;
}

/** True peak by 4x oversampling with a windowed sinc: enough to see inter-sample peaks. */
export function truePeakDb(x: Float32Array): number {
  let peak = 0;
  const taps = 16;
  for (let n = 0; n < x.length; n++) {
    peak = Math.max(peak, Math.abs(x[n]));
    if (n < taps || n >= x.length - taps) continue;
    for (const frac of [0.25, 0.5, 0.75]) {
      let v = 0;
      for (let k = -taps + 1; k <= taps; k++) {
        const d = k - frac;
        const w = 0.5 + 0.5 * Math.cos((Math.PI * d) / taps);
        v += x[n + k] * (d === 0 ? 1 : Math.sin(Math.PI * d) / (Math.PI * d)) * w;
      }
      peak = Math.max(peak, Math.abs(v));
    }
  }
  return db(peak);
}

/* ----------------------------------------------------------- confusability (§3.1) */
// Rhythm: the onsets in the first 300 ms (a rise of 9 dB within 20 ms, at most 30 dB under the
// peak, 25 ms apart at least). Two rhythms match when they have as many onsets and every gap
// agrees within 25 ms. Timbre: the log-mel pattern of the first 50 ms after the first onset
// (5 frames x 32 bands, 100 Hz-12 kHz, in dB under its loudest cell, floored at -50 dB),
// compared by mean absolute difference over the cells where either has energy.

export function fft(re: Float32Array, im: Float32Array): void {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    for (let i = 0; i < n; i += len) {
      for (let k = 0; k < len / 2; k++) {
        const wr = Math.cos(ang * k), wi = Math.sin(ang * k);
        const ur = re[i + k], ui = im[i + k];
        const vr = re[i + k + len / 2] * wr - im[i + k + len / 2] * wi;
        const vi = re[i + k + len / 2] * wi + im[i + k + len / 2] * wr;
        re[i + k] = ur + vr; im[i + k] = ui + vi;
        re[i + k + len / 2] = ur - vr; im[i + k + len / 2] = ui - vi;
      }
    }
  }
}

const MEL_EDGES = (() => {
  const mel = (f: number) => 2595 * Math.log10(1 + f / 700), inv = (m: number) => 700 * (10 ** (m / 2595) - 1);
  return Array.from({ length: 34 }, (_, i) => inv(mel(100) + ((mel(12000) - mel(100)) * i) / 33));
})();

export function onsets(x: Float32Array, sr: number): number[] {
  const hop = Math.round(sr * 0.005), frames = Math.min(Math.floor(x.length / hop), 60); // 5 ms frames over 300 ms
  const lv: number[] = [];
  for (let f = 0; f < frames; f++) {
    let e = 1e-20;
    for (let i = f * hop; i < (f + 1) * hop; i++) e += x[i] * x[i];
    lv.push(10 * Math.log10(e / hop));
  }
  const top = Math.max(...lv), found: number[] = [];
  for (let f = 0; f < frames; f++) {
    const floor = f === 0 ? -200 : Math.min(...lv.slice(Math.max(0, f - 4), f));
    if (lv[f] > top - 30 && lv[f] - floor >= 9 && (!found.length || f * 5 - found[found.length - 1] >= 25)) found.push(f * 5);
  }
  return found.map((t) => t - found[0]);
}

export const sameRhythm = (a: number[], b: number[]): boolean => a.length === b.length && a.every((t, i) => Math.abs(t - b[i]) <= 25);

export function timbre(x: Float32Array, sr: number): number[] {
  const peak = peakOf(x);
  let on = 0;
  while (on < x.length && Math.abs(x[on]) < peak * 0.01) on++;
  const N = 1024, P: number[] = [], step = Math.round(sr * 0.01);
  for (let f = 0; f < 5; f++) {
    const re = new Float32Array(N), im = new Float32Array(N);
    for (let i = 0; i < N; i++) re[i] = (x[on + f * step + i] || 0) * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / N));
    fft(re, im);
    for (let b = 0; b < 32; b++) {
      const [f0, f1, f2] = [MEL_EDGES[b], MEL_EDGES[b + 1], MEL_EDGES[b + 2]];
      let e = 1e-20;
      for (let k = Math.floor((f0 / sr) * N); k <= Math.ceil((f2 / sr) * N); k++) {
        const fk = (k * sr) / N, w = fk < f1 ? (fk - f0) / (f1 - f0) : (f2 - fk) / (f2 - f1);
        if (w > 0) e += w * (re[k] * re[k] + im[k] * im[k]);
      }
      P.push(10 * Math.log10(e));
    }
  }
  const top = Math.max(...P);
  return P.map((v) => Math.max(v - top, -50));
}

export function timbreDistance(p: number[], q: number[]): number {
  let sum = 0, cnt = 0;
  for (let i = 0; i < p.length; i++) {
    if (p[i] < -40 && q[i] < -40) continue;
    sum += Math.abs(p[i] - q[i]);
    cnt++;
  }
  return sum / Math.max(1, cnt);
}
