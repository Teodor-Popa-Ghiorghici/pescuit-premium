/* Small shared helpers for the audio engine: a seeded PRNG (the seed of a hit is the
 * event's seq, so renders reproduce), decibel maths and pitch. Plain TypeScript, no DOM. */

/** mulberry32 — the prototype's generator. */
export function rng(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), t | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export const db = (x: number): number => 20 * Math.log10(Math.max(x, 1e-12));
export const fromDb = (d: number): number => 10 ** (d / 20);
export const midi = (n: number): number => 440 * 2 ** ((n - 69) / 12);
export const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

/** A stable 32-bit hash of a few numbers — used to derive a per-cue seed from a seq. */
export function mix(...parts: number[]): number {
  let h = 0x811c9dc5;
  for (const p of parts) {
    h ^= p | 0;
    h = Math.imul(h, 0x01000193);
    h ^= h >>> 13;
  }
  return h >>> 0;
}
