/* A counting stand-in for a BaseAudioContext: enough of the surface for the live recipes to
 * run in Node, and a tally of every node they create. */

export interface Tally {
  total: number;
  byType: Record<string, number>;
}

export function fakeCtx(sampleRate = 48000) {
  const tally: Tally = { total: 0, byType: {} };
  const param = () => {
    const p: Record<string, unknown> = { value: 0 };
    for (const m of ['setValueAtTime', 'exponentialRampToValueAtTime', 'linearRampToValueAtTime', 'setTargetAtTime', 'cancelScheduledValues']) p[m] = () => p;
    return p;
  };
  const node = (type: string) => {
    tally.total++;
    tally.byType[type] = (tally.byType[type] ?? 0) + 1;
    const n: Record<string, unknown> = {
      type,
      frequency: param(), gain: param(), Q: param(), detune: param(), pan: param(),
      curve: null, buffer: null, loop: false,
      start: () => undefined, stop: () => undefined, disconnect: () => undefined,
    };
    n.connect = (dest: unknown) => dest;
    return n;
  };
  const buffers: Array<{ length: number; sampleRate: number }> = [];
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
  return { ctx: ctx as unknown as BaseAudioContext, tally, reset: () => { tally.total = 0; tally.byType = {}; }, fake: ctx };
}
