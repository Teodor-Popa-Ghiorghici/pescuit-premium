/* Shared plumbing for the live families: one noise buffer per context read at random
 * offsets (continuous seeded variation, no buffer memory), envelopes, filters and the
 * tanh harmonic layer that gives phone speakers something to play below 150 Hz. */

import { fromDb } from '../util.js';

export type Ctx = BaseAudioContext;

const NOISE = new WeakMap<BaseAudioContext, AudioBuffer>();

/** One shared 1 s white-noise buffer per context, filled from a fixed seed. */
export function sharedNoise(ctx: Ctx): AudioBuffer {
  let b = NOISE.get(ctx);
  if (!b) {
    b = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = b.getChannelData(0);
    let t = 99 >>> 0; // mulberry32(99), inlined so the noise is identical everywhere
    for (let i = 0; i < d.length; i++) {
      t += 0x6d2b79f5;
      let r = Math.imul(t ^ (t >>> 15), t | 1);
      r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
      d[i] = (((r ^ (r >>> 14)) >>> 0) / 4294967296) * 2 - 1;
    }
    NOISE.set(ctx, b);
  }
  return b;
}

/** A burst of the shared noise from a random offset, started at `t`. */
export function noiseSrc(ctx: Ctx, t: number, dur: number, r: () => number): AudioBufferSourceNode {
  const s = ctx.createBufferSource();
  s.buffer = sharedNoise(ctx);
  s.start(t, r() * 0.8, dur + 0.02);
  return s;
}

/** An exponential attack-decay envelope as a gain node. */
export function env(ctx: Ctx, t: number, peak: number, attack: number, decay: number): GainNode {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  return g;
}

export function filt(ctx: Ctx, type: BiquadFilterType, f: number, q = 0.707, gainDb = 0): BiquadFilterNode {
  const b = ctx.createBiquadFilter();
  b.type = type;
  b.frequency.value = f;
  b.Q.value = q;
  b.gain.value = gainDb;
  return b;
}

let TANH: Float32Array | null = null;
/** tanh(3x) on [-1, 1]: the saturating layer of the table top, the stamp and the skin. */
export function tanhCurve(): Float32Array {
  if (!TANH) {
    TANH = new Float32Array(1024);
    for (let i = 0; i < 1024; i++) TANH[i] = Math.tanh(3 * (i / 511.5 - 1));
  }
  return TANH;
}

/** Weight below 150 Hz gets a saturated harmonic layer at 120-400 Hz (§3.3). 2 nodes. */
export function harmonics(ctx: Ctx, source: AudioNode, into: AudioNode, dbGain = -10): void {
  const shaper = ctx.createWaveShaper();
  shaper.curve = tanhCurve() as Float32Array<ArrayBuffer>;
  const g = ctx.createGain();
  g.gain.value = fromDb(dbGain);
  source.connect(shaper).connect(g).connect(into);
}

/** Observers used by the tests and the harness: the plank grammar counts every wood strike, and the palette rule counts every
 * way a frame breaks (a cracked-wood transient, splintering fibres, a hull's groan): only Shark, Mantis and Whale may use them. */
export const hooks: {
  strike?: (plank: 'A' | 'B' | 'C' | 'D', damping: number) => void;
  breaks?: (kind: 'crack' | 'fibres' | 'groan') => void;
} = {};
