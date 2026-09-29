import { describe, expect, it } from 'vitest';
import { createDynamics, DYNAMICS_DEFAULTS, runDynamics } from '../src/audio/dynamics.js';
import { db, fromDb } from '../src/audio/util.js';
import { peakOf, truePeakDb } from '../src/audio/measure.js';
import { createLimiter, workletSource } from '../src/audio/worklet.js';

const SR = 48000;
const sine = (f: number, amp: number, n: number, sr = SR) => Float32Array.from({ length: n }, (_, i) => amp * Math.sin((2 * Math.PI * f * i) / sr));

describe('dynamics: the limiter and the safety clip (§3.3)', () => {
  it('is unity below the ceiling: a mix that never reaches it passes through untouched', () => {
    const x = sine(440, fromDb(-6), SR);
    const { out, stats } = runDynamics([x], SR);
    let worst = 0;
    for (let i = 0; i < x.length; i++) worst = Math.max(worst, Math.abs(out[0][i] - x[i]));
    expect(worst).toBeLessThan(1e-6);
    expect(stats.grMaxDb).toBe(0);
    expect(stats.busyFrames).toBe(0);
    expect(stats.clipped).toBe(0);
  });

  it('is unity for stereo too, channels linked', () => {
    const l = sine(300, 0.3, SR), r = sine(900, 0.5, SR);
    const { out } = runDynamics([l, r], SR);
    for (let i = 0; i < SR; i += 97) {
      expect(out[0][i]).toBeCloseTo(l[i], 6);
      expect(out[1][i]).toBeCloseTo(r[i], 6);
    }
  });

  it('holds the true peak at or under -1 dBTP on a six-cue pile-up (and never engages the clip)', () => {
    // six loud decaying bursts landing within 50 ms of each other, summed at ~+6 dBFS
    const n = SR;
    const mix = new Float32Array(n);
    for (let k = 0; k < 6; k++) {
      const start = Math.round((0.1 + k * 0.01) * SR);
      const f = 180 * (k + 1) * 1.37;
      for (let i = 0; start + i < n && i < 0.3 * SR; i++) mix[start + i] += 0.55 * Math.exp(-i / (0.04 * SR)) * Math.sin((2 * Math.PI * f * i) / SR + k);
    }
    expect(db(peakOf(mix))).toBeGreaterThan(3); // it really is far over the ceiling
    const { out, stats } = runDynamics([mix], SR);
    expect(truePeakDb(out[0])).toBeLessThanOrEqual(-1);
    expect(db(peakOf(out[0]))).toBeLessThanOrEqual(DYNAMICS_DEFAULTS.ceilingDb + 1e-3);
    expect(stats.grMaxDb).toBeGreaterThan(3);
    expect(stats.clipped).toBe(0);
  });

  it('releases: the gain returns to unity after a peak', () => {
    const n = SR;
    const x = new Float32Array(n);
    x.fill(0.1);
    for (let i = 1000; i < 1100; i++) x[i] = 3;
    const { out } = runDynamics([x], SR);
    expect(out[0][n - 1]).toBeCloseTo(0.1, 4);
  });

  it('gives the same result whatever the block size (128 in a worklet, 1024 in a script processor)', () => {
    const x = Float32Array.from({ length: 6000 }, (_, i) => 1.4 * Math.sin(i * 0.05) * (i > 2000 ? 1 : 0.2));
    const a = runDynamics([x], SR, undefined, 128).out[0];
    const b = runDynamics([x], SR, undefined, 1024).out[0];
    const c = runDynamics([x], SR, undefined, 7).out[0];
    for (let i = 0; i < x.length; i++) {
      expect(a[i]).toBeCloseTo(b[i], 7);
      expect(a[i]).toBeCloseTo(c[i], 7);
    }
  });

  it('adds only its lookahead as latency', () => {
    const dyn = createDynamics(SR);
    expect(dyn.latency).toBe(Math.round(0.003 * SR));
  });

  it('the safety clip is the last net and never touches a limited signal', () => {
    // a ceiling above the clip forces the clip to act: proves it is wired, not that it is needed
    const x = sine(200, 1.2, 4800);
    const { stats } = runDynamics([x], SR, { ceilingDb: 0 });
    expect(stats.clipped).toBeGreaterThan(0);
  });

  it('runs identically as the worklet processor built from its source text', () => {
    let Processor: new (o?: unknown) => { process(i: Float32Array[][], o: Float32Array[][]): boolean };
    const g = globalThis as Record<string, unknown>;
    g.sampleRate = SR;
    g.AudioWorkletProcessor = class {
      port = { postMessage() {} };
    };
    g.registerProcessor = (_name: string, cls: typeof Processor) => {
      Processor = cls;
    };
    // eslint-disable-next-line no-new-func
    new Function(workletSource())();
    const p = new Processor!({ processorOptions: {} });
    const x = Float32Array.from({ length: 2048 }, (_, i) => 1.3 * Math.sin(i * 0.03));
    const ref = runDynamics([x, x], SR, undefined, 128);
    const got = [new Float32Array(2048 + 256), new Float32Array(2048 + 256)];
    for (let at = 0; at < 2048 + 256; at += 128) {
      const inp = [0, 1].map(() => {
        const b = new Float32Array(128);
        for (let i = 0; i < 128 && at + i < 2048; i++) b[i] = x[at + i];
        return b;
      });
      const outp = [new Float32Array(128), new Float32Array(128)];
      expect(p.process([inp], [outp])).toBe(true);
      got[0].set(outp[0], at);
      got[1].set(outp[1], at);
    }
    const lat = createDynamics(SR).latency;
    for (let i = 0; i < 2048; i += 13) expect(got[0][i + lat]).toBeCloseTo(ref.out[0][i], 7);
  });
});

describe('the limiter node degrades gracefully (§3.5)', () => {
  it('without an AudioWorklet it runs the same function in a script processor', async () => {
    let node: { onaudioprocess?: (e: unknown) => void } = {};
    const ctx = { sampleRate: SR, createScriptProcessor: () => (node = {}) } as unknown as BaseAudioContext;
    const lim = await createLimiter(ctx);
    expect(lim.kind).toBe('script');
    const n = 1024;
    const inp = Float32Array.from({ length: n }, (_, i) => 1.5 * Math.sin(i * 0.05));
    const out = [new Float32Array(n), new Float32Array(n)];
    for (let block = 0; block < 4; block++)
      node.onaudioprocess!({ inputBuffer: { numberOfChannels: 1, length: n, getChannelData: () => inp }, outputBuffer: { numberOfChannels: 2, getChannelData: (c: number) => out[c] } });
    expect(db(peakOf(out[0]))).toBeLessThanOrEqual(DYNAMICS_DEFAULTS.ceilingDb + 1e-3);
    expect(lim.stats()!.grMaxDb).toBeGreaterThan(3);
  });
  it('with neither, a static tanh clip at the ceiling still bounds the output', async () => {
    const ctx = { sampleRate: SR, createWaveShaper: () => ({ curve: null as Float32Array | null }) } as unknown as BaseAudioContext;
    const lim = await createLimiter(ctx);
    expect(lim.kind).toBe('shaper');
    const curve = (lim.node as unknown as { curve: Float32Array }).curve;
    expect(Math.max(...curve.map(Math.abs))).toBeLessThanOrEqual(fromDb(-1.5) + 1e-6);
    expect(lim.stats()).toBeNull();
  });
});
