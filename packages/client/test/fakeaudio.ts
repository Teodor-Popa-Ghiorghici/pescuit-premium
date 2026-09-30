/* A counting stand-in for a BaseAudioContext: enough of the surface for the live recipes to
 * run in Node, and a tally of every node they create. */

export interface Tally {
  total: number;
  byType: Record<string, number>;
  /** every biquad the recipe made, with the type and centre it ended up with */
  filters: Array<{ type: string; frequency: number }>;
  /** every oscillator, with when it was started and stopped (Infinity if it never was) */
  oscillators: Array<{ start: number; stop: number }>;
}

export function fakeCtx(sampleRate = 48000) {
  const nodes: Array<Record<string, unknown>> = [];
  const tally: Tally = {
    total: 0,
    byType: {},
    get filters() {
      return nodes.filter((n) => n.kind === 'biquad').map((n) => ({ type: n.type as string, frequency: (n.frequency as { value: number }).value }));
    },
    get oscillators() {
      return nodes.filter((n) => n.kind === 'osc').map((n) => ({ start: (n.startAt as number | undefined) ?? Infinity, stop: (n.stopAt as number | undefined) ?? Infinity }));
    },
  };
  const param = () => {
    const p: Record<string, unknown> = { value: 0 };
    for (const m of ['setValueAtTime', 'exponentialRampToValueAtTime', 'linearRampToValueAtTime', 'setTargetAtTime', 'cancelScheduledValues']) p[m] = () => p;
    return p;
  };
  const node = (type: string) => {
    tally.total++;
    tally.byType[type] = (tally.byType[type] ?? 0) + 1;
    const n: Record<string, unknown> = {
      kind: type,
      type,
      frequency: param(), gain: param(), Q: param(), detune: param(), pan: param(),
      curve: null, buffer: null, loop: false,
      start: (t?: number) => { n.startAt = t ?? 0; },
      stop: (t?: number) => { n.stopAt = t ?? Infinity; },
      disconnect: () => undefined,
    };
    nodes.push(n);
    n.connect = (dest: unknown) => {
      edges.push([n, dest]);
      return dest;
    };
    return n;
  };
  const buffers: Array<{ length: number; sampleRate: number }> = [];
  const edges: Array<[unknown, unknown]> = [];
  const ctx = {
    sampleRate,
    currentTime: 0,
    destination: node('destination'),
    createGain: () => node('gain'),
    createOscillator: () => node('osc'),
    createBiquadFilter: () => node('biquad'),
    createBufferSource: () => node('source'),
    createWaveShaper: () => node('shaper'),
    createStereoPanner: () => node('panner'),
    createPeriodicWave: () => ({}),
    createBuffer: (_ch: number, length: number, sr: number) => {
      const data = new Float32Array(length);
      const b = { length, sampleRate: sr, getChannelData: () => data, copyToChannel: (src: Float32Array) => data.set(src) };
      buffers.push(b);
      return b;
    },
  };
  // creating the destination and shared buffers is not a hit's cost
  tally.total = 0;
  tally.byType = {};
  nodes.length = 0;
  return { ctx: ctx as unknown as BaseAudioContext, tally, edges, reset: () => { tally.total = 0; tally.byType = {}; nodes.length = 0; }, fake: ctx };
}
