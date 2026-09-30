/* The AudioWorkletProcessor that runs synth.ts (MUSIC_PLAN §7.1), shipped as a Blob exactly as audio/worklet.ts ships
 * dynamics.ts: the processor's source is built from `createScoreSynth.toString()`, so no separate worklet file has to
 * survive the bundler. There is no main-thread fallback (§5.3): a ScriptProcessor score would tie its timing to the main
 * thread's work - a private panel opening could delay it - so a browser without AudioWorklet has no score (D-e).
 */

import { createScoreSynth, type ScoreSynthOptions, type SynthMessage } from './synth.js';

export const SCORE_PROCESSOR = 'pescuit-score';

/** The processor module's source text. Exported for the tests. */
export function scoreWorkletSource(): string {
  return `
const createScoreSynth = ${createScoreSynth.toString()};
class PescuitScore extends AudioWorkletProcessor {
  constructor(options) {
    super();
    this.syn = createScoreSynth(sampleRate, (options && options.processorOptions) || {});
    this.port.onmessage = (e) => {
      const list = Array.isArray(e.data) ? e.data : [e.data];
      for (const m of list) this.syn.post(m);
    };
  }
  process(inputs, outputs) {
    const out = outputs[0];
    if (!out || !out.length) return true;
    this.syn.process(out[0], out[1] || out[0], out[0].length, currentFrame);
    return true;
  }
}
registerProcessor('${SCORE_PROCESSOR}', PescuitScore);
`;
}

export interface ScoreNode {
  node: AudioWorkletNode;
  post(msgs: SynthMessage[]): void;
}

const loaded = new WeakMap<BaseAudioContext, Promise<void>>();

/** the score's worklet node, or null where there is no AudioWorklet (no score on that client) */
export async function createScoreNode(ctx: BaseAudioContext, options: Partial<ScoreSynthOptions> = {}): Promise<ScoreNode | null> {
  const ac = ctx as AudioContext;
  try {
    if (!ac.audioWorklet || typeof AudioWorkletNode === 'undefined') return null;
    let p = loaded.get(ctx);
    if (!p) {
      const url = URL.createObjectURL(new Blob([scoreWorkletSource()], { type: 'text/javascript' }));
      p = ac.audioWorklet.addModule(url).finally(() => URL.revokeObjectURL(url));
      loaded.set(ctx, p);
    }
    await p;
    const node = new AudioWorkletNode(ctx, SCORE_PROCESSOR, { numberOfInputs: 0, numberOfOutputs: 1, outputChannelCount: [2], processorOptions: options });
    return { node, post: (msgs) => msgs.length && node.port.postMessage(msgs) };
  } catch {
    return null;
  }
}
