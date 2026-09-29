/* The AudioWorklet that runs dynamics.ts (§3.3, §3.5): the same pure function the offline
 * harness and the unit tests run, so the chain behaves the same in every engine. The processor's
 * source is built from `createDynamics.toString()` and loaded from a Blob, so no separate worklet
 * file has to survive the bundler.
 *
 * Fallbacks, in order: an AudioWorklet; a ScriptProcessorNode running the same function on the
 * main thread; a static tanh clip at the ceiling (no lookahead - only if neither exists). */

import { createDynamics, DYNAMICS_DEFAULTS, type DynamicsOptions, type DynamicsStats } from './dynamics.js';

export const PROCESSOR_NAME = 'pescuit-limiter';

export type LimiterKind = 'worklet' | 'script' | 'shaper';

export interface LimiterNode {
  node: AudioNode;
  kind: LimiterKind;
  /** the dynamics' running statistics, refreshed about once a second (null for the shaper) */
  stats(): DynamicsStats | null;
}

/** The processor module's source text. Exported for the tests. */
export function workletSource(): string {
  return `
const createDynamics = ${createDynamics.toString()};
class PescuitLimiter extends AudioWorkletProcessor {
  constructor(options) {
    super();
    this.dyn = createDynamics(sampleRate, (options && options.processorOptions) || {});
    this.blocks = 0;
  }
  process(inputs, outputs) {
    const input = inputs[0], output = outputs[0];
    if (!output || !output.length) return true;
    const n = output[0].length;
    if (!input || !input.length) {
      for (let c = 0; c < output.length; c++) output[c].fill(0);
    } else {
      this.dyn.process(input, output, n);
    }
    if (++this.blocks % 375 === 0) this.port.postMessage(this.dyn.stats());
    return true;
  }
}
registerProcessor('${PROCESSOR_NAME}', PescuitLimiter);
`;
}

const loaded = new WeakMap<BaseAudioContext, Promise<void>>();

export async function createLimiter(ctx: BaseAudioContext, options: Partial<DynamicsOptions> = {}): Promise<LimiterNode> {
  const opts = { ...DYNAMICS_DEFAULTS, ...options };
  const ac = ctx as AudioContext;
  try {
    if (ac.audioWorklet && typeof AudioWorkletNode !== 'undefined') {
      let p = loaded.get(ctx);
      if (!p) {
        const url = URL.createObjectURL(new Blob([workletSource()], { type: 'text/javascript' }));
        p = ac.audioWorklet.addModule(url).finally(() => URL.revokeObjectURL(url));
        loaded.set(ctx, p);
      }
      await p;
      const node = new AudioWorkletNode(ctx, PROCESSOR_NAME, {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        outputChannelCount: [2],
        channelCount: 2,
        channelCountMode: 'explicit',
        processorOptions: opts,
      });
      let last: DynamicsStats | null = null;
      node.port.onmessage = (e) => {
        last = e.data as DynamicsStats;
      };
      return { node, kind: 'worklet', stats: () => last };
    }
  } catch {
    /* fall through to the main-thread copy */
  }
  try {
    if (typeof ac.createScriptProcessor === 'function') {
      const dyn = createDynamics(ctx.sampleRate, opts);
      const node = ac.createScriptProcessor(1024, 2, 2);
      node.onaudioprocess = (e) => {
        const ins = [e.inputBuffer.getChannelData(0), e.inputBuffer.getChannelData(Math.min(1, e.inputBuffer.numberOfChannels - 1))];
        const outs = [e.outputBuffer.getChannelData(0), e.outputBuffer.getChannelData(Math.min(1, e.outputBuffer.numberOfChannels - 1))];
        dyn.process(ins, outs, e.inputBuffer.length);
      };
      return { node, kind: 'script', stats: () => dyn.stats() };
    }
  } catch {
    /* fall through to the static clip */
  }
  const shaper = ctx.createWaveShaper();
  const c = 10 ** (opts.ceilingDb / 20);
  const curve = new Float32Array(2049);
  for (let i = 0; i < curve.length; i++) curve[i] = c * Math.tanh((i / 1024 - 1) / c);
  shaper.curve = curve;
  return { node: shaper, kind: 'shaper', stats: () => null };
}
