/* The plan's output dynamics (§3.3): a lookahead brick-wall limiter at -1.5 dBFS and a
 * safety clip at -1 dBFS. No bus compression. PURE plain JS with unity gain below the
 * ceiling, so a mix that never reaches the ceiling passes through bit-for-bit (delayed by
 * the lookahead). The product runs `createDynamics` inside an AudioWorklet; the offline
 * harness and the unit tests run the very same function on rendered buffers.
 *
 * `createDynamics` is deliberately one self-contained closure — no module-level helpers —
 * so `worklet.ts` can ship it to the audio thread as source text (`fn.toString()`).
 */

export interface DynamicsOptions {
  /** limiter ceiling, dBFS */
  ceilingDb: number;
  /** lookahead, ms (also the latency it adds) */
  lookaheadMs: number;
  /** release time constant, ms */
  releaseMs: number;
  /** safety clip, dBFS: the last net; the checks require it never to engage */
  clipDb: number;
}

export const DYNAMICS_DEFAULTS: DynamicsOptions = { ceilingDb: -1.5, lookaheadMs: 3, releaseMs: 80, clipDb: -1 };

export interface DynamicsStats {
  frames: number;
  /** frames whose gain reduction exceeded 1 dB */
  busyFrames: number;
  /** deepest gain reduction so far, dB (positive) */
  grMaxDb: number;
  /** samples the safety clip had to touch */
  clipped: number;
}

export interface Dynamics {
  /** the lookahead in samples: every output is this many samples late */
  latency: number;
  /** processes `n` frames of up to two linked channels. `inputs` and `outputs` may alias. */
  process(inputs: Float32Array[], outputs: Float32Array[], n: number): void;
  stats(): DynamicsStats;
  resetStats(): void;
}

export function createDynamics(sampleRate: number, options?: Partial<DynamicsOptions>): Dynamics {
  const o = { ceilingDb: -1.5, lookaheadMs: 3, releaseMs: 80, clipDb: -1, ...options };
  const c = Math.pow(10, o.ceilingDb / 20);
  const L = Math.max(1, Math.round((o.lookaheadMs / 1000) * sampleRate));
  const aR = Math.exp(-1 / ((o.releaseMs / 1000) * sampleRate));
  const clipC = Math.pow(10, o.clipDb / 20);
  const clipK = Math.pow(10, (o.clipDb - 0.3) / 20);

  // audio delay line, two channels, L samples
  const dl: Float32Array[] = [new Float32Array(L), new Float32Array(L)];
  let dlPos = 0;
  // sliding minimum of the per-sample gain need over the last L + 1 input samples
  const cap = L + 2;
  const dqIdx = new Float64Array(cap);
  const dqVal = new Float64Array(cap);
  let head = 0;
  let tail = 0;
  // the window minima of the last L samples, for the moving average
  const hist = new Float64Array(L).fill(1);
  let histPos = 0;
  let acc = L;
  let g = 1;
  let n = 0; // input samples seen
  let frames = 0;
  let busy = 0;
  let grMax = 0;
  let clipped = 0;

  function process(inputs: Float32Array[], outputs: Float32Array[], count: number): void {
    const chs = Math.min(2, outputs.length);
    for (let s = 0; s < count; s++) {
      let peak = 0;
      for (let ch = 0; ch < chs; ch++) {
        const a = inputs[ch] ? Math.abs(inputs[ch][s]) : 0;
        if (a > peak) peak = a;
      }
      const need = Math.min(1, c / (peak + 1e-12));
      // push into the monotonic deque, then drop what left the window (index <= n - L - 1)
      while (tail > head && dqVal[(tail - 1) % cap] >= need) tail--;
      dqIdx[tail % cap] = n;
      dqVal[tail % cap] = need;
      tail++;
      while (dqIdx[head % cap] < n - L) head++;
      const win = dqVal[head % cap];
      // the moving average of the last L window minima: each window contains the sample being
      // output, so the average never exceeds what that sample needs and the ramp alone holds
      // the ceiling
      acc += win - hist[histPos];
      hist[histPos] = win;
      histPos = histPos + 1 === L ? 0 : histPos + 1;
      const avg = acc / L;
      const rel = aR * g + (1 - aR);
      g = avg < rel ? avg : rel;
      const gr = -20 * Math.log10(g < 1e-12 ? 1e-12 : g);
      if (gr > grMax) grMax = gr;
      if (gr > 1) busy++;
      frames++;
      for (let ch = 0; ch < chs; ch++) {
        const line = dl[ch];
        const delayed = line[dlPos];
        line[dlPos] = inputs[ch] ? inputs[ch][s] : 0;
        let y = delayed * g;
        const ay = y < 0 ? -y : y;
        if (ay > clipK) {
          clipped++;
          const e = Math.tanh((ay - clipK) / (clipC - clipK));
          y = (y < 0 ? -1 : 1) * (clipK + (clipC - clipK) * e);
        }
        outputs[ch][s] = y;
      }
      dlPos = dlPos + 1 === L ? 0 : dlPos + 1;
      n++;
    }
  }

  return {
    latency: L,
    process,
    stats: () => ({ frames, busyFrames: busy, grMaxDb: grMax, clipped }),
    resetStats: () => {
      frames = 0;
      busy = 0;
      grMax = 0;
      clipped = 0;
    },
  };
}

/**
 * Runs the dynamics over whole rendered channels (the offline harness and the tests): pads
 * with the lookahead so the output lines up with the input sample for sample.
 */
export function runDynamics(
  channels: Float32Array[],
  sampleRate: number,
  options?: Partial<DynamicsOptions>,
  chunk = 128,
): { out: Float32Array[]; stats: DynamicsStats } {
  const dyn = createDynamics(sampleRate, options);
  const len = channels[0].length;
  const total = len + dyn.latency;
  const outs = channels.map(() => new Float32Array(total));
  for (let at = 0; at < total; at += chunk) {
    const n = Math.min(chunk, total - at);
    const ins = channels.map((ch) => {
      const b = new Float32Array(n);
      for (let i = 0; i < n && at + i < len; i++) b[i] = ch[at + i];
      return b;
    });
    const os = outs.map((w) => w.subarray(at, at + n));
    dyn.process(ins, os, n);
  }
  return { out: outs.map((w) => w.slice(dyn.latency)), stats: dyn.stats() };
}
