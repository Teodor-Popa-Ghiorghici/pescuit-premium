/* The world's voice (SOUND_DESIGN §1.1): a live pond while the pool lasts, wind once it is dry. All of it is
 * generated from a looped noise buffer, filters and scheduled one-shots - no long loops are stored, no oscillators,
 * no melody. It is driven only by public inputs: the pool count (how wet it is) and the pool-empty event (the switch).
 *
 *   pond  noise low-passed at 500 Hz whose level wanders on smoothed random (irregular, never a regular LFO),
 *         and sparse drips - one every 3-8 s, a resonant noise band falling 2400 -> 1300 Hz in 35 ms.
 *         No fish, reeds or birds: nothing that could be a cartoon.
 *   wind  noise through two narrow resonances (Q 18 at ~310 Hz, Q 30 at ~640 Hz), each drifting on its own slow
 *         random walk - wind finding the gaps in a wall of planks - and now and then a gust.
 *
 * The switch from pond to wind happens on the pool-empty event, as a fixed 400 ms equal-power crossfade. The
 * darkening (12, 6 and 1 sets remaining) is NOT here: it is a flat low-pass and level on the ambience stem
 * (mixer.ts, DARK_STEPS). Never compressed and never ducked per cue; the mixer shapes it with the slow activity
 * envelope and ducks it only under the rare signature cues. Default on, its own setting.
 */

import { rng } from './util.js';
import { type Ctx, filt, sharedNoise } from './live/common.js';
import { drip } from './live/water.js';

export interface AmbienceInputs {
  /** cards left in the pool, and how many there were at the start (how wet the pond still is) */
  poolCount: number;
  poolStart: number;
  /** the pool is empty: the wind. When absent it follows `poolCount`; the engine sets it from the pool-empty event. */
  dry?: boolean;
  /** 'lobby': the full pond, louder (the waiting room) */
  scene: 'lobby' | 'game';
}

export const BED_DB = 0; // the bed's level within the ambience bus
/** the switch from pond to wind, seconds */
export const CROSSFADE_S = 0.4;
/** the wind's two resonances: centre Hz and Q */
export const WIND_BANDS: ReadonlyArray<{ hz: number; q: number }> = [{ hz: 310, q: 18 }, { hz: 640, q: 30 }];
/** the wind is narrow, so its filters need making up */
const WIND_MAKEUP = 5.37;
const POND_MAKEUP = 10 ** (7.8 / 20);
/** a gust: +8 dB, 700 ms in, 1.1 s out, the resonances opening 30 % */
const GUST_GAIN = 10 ** (8 / 20);

export class Ambience {
  private inputs: AmbienceInputs = { poolCount: 1, poolStart: 1, scene: 'game' };
  private r: () => number;
  private dry = false;
  private level!: GainNode;
  private pondGain!: GainNode;
  private windGain!: GainNode;
  private gust!: GainNode;
  private bands: BiquadFilterNode[] = [];
  private dripBus!: GainNode;
  private next = { drip: 0, gust: 0, drift: [0, 0], whistle: 0 };
  private started = false;
  private sources: AudioScheduledSourceNode[] = [];

  constructor(private readonly ctx: Ctx, private readonly out: AudioNode, seed = 5) {
    this.r = rng(seed);
  }

  /** builds the persistent nodes at `t0`; one-shots are scheduled by `schedule` */
  start(t0 = this.ctx.currentTime): void {
    if (this.started) return;
    this.started = true;
    const c = this.ctx;
    const noise = (offset: number): AudioBufferSourceNode => {
      const s = c.createBufferSource();
      s.buffer = sharedNoise(c);
      s.loop = true;
      s.start(t0, offset);
      this.sources.push(s);
      return s;
    };
    this.level = c.createGain();
    this.level.gain.value = 10 ** (BED_DB / 20);
    this.level.connect(this.out);

    // the pond: low noise, its level wandering on smoothed random
    this.pondGain = c.createGain();
    const pondAm = c.createGain();
    // the pond is made up 7.8 dB over its first draft so that it, and the wind, sit inside the bed's window under the anchor
    pondAm.gain.value = 0.8 * POND_MAKEUP;
    const wander = c.createGain();
    wander.gain.value = 60 * POND_MAKEUP;
    noise(0.31).connect(filt(c, 'lowpass', 0.6, 0.5)).connect(wander).connect(pondAm.gain);
    noise(0).connect(filt(c, 'lowpass', 500)).connect(pondAm).connect(this.pondGain).connect(this.level);

    // the wind: two narrow resonances, a gust gain over both
    this.windGain = c.createGain();
    this.gust = c.createGain();
    const windSrc = noise(0.57);
    for (const b of WIND_BANDS) {
      const f = filt(c, 'bandpass', b.hz, b.q);
      windSrc.connect(f).connect(this.gust);
      this.bands.push(f);
    }
    const makeup = c.createGain();
    makeup.gain.value = WIND_MAKEUP;
    this.gust.connect(makeup).connect(this.windGain).connect(this.level);

    this.dripBus = c.createGain();
    this.dripBus.gain.value = 10 ** ((BED_DB + 4) / 20);
    this.dripBus.connect(this.out);

    const r = this.r;
    this.next = { drip: t0 + 2 + r() * 4, gust: t0 + 12 + r() * 18, drift: [t0 + 4 + r() * 8, t0 + 6 + r() * 8], whistle: t0 + 20 + r() * 25 };
    this.setDry(this.inputs.dry ?? this.inputs.poolCount <= 0, t0, true);
    this.update(this.inputs, true);
  }

  stop(): void {
    for (const s of this.sources) {
      try {
        s.stop();
      } catch {
        /* already stopped */
      }
    }
    this.sources = [];
    this.bands = [];
    this.started = false;
  }

  /**
   * Pond or wind. On the pool-empty event this is a fixed 400 ms equal-power crossfade at `at`; `immediate` (a first
   * look, a rejoin, the harness) sets it at once. The two gains are cos and sin of one angle, so their power sums to one.
   */
  setDry(dry: boolean, at = this.ctx.currentTime, immediate = false): void {
    const was = this.dry;
    this.dry = dry;
    if (!this.started) return;
    const t = Math.max(at, this.ctx.currentTime);
    const pond = this.pondGain.gain;
    const wind = this.windGain.gain;
    for (const p of [pond, wind]) p.cancelScheduledValues(t);
    if (immediate || was === dry) {
      pond.setValueAtTime(dry ? 0 : 1, t);
      wind.setValueAtTime(dry ? 1 : 0, t);
      return;
    }
    const N = 32;
    const down = new Float32Array(N);
    const up = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      const a = (i / (N - 1)) * (Math.PI / 2);
      down[i] = Math.cos(a);
      up[i] = Math.sin(a);
    }
    pond.setValueCurveAtTime(dry ? down : up, t, CROSSFADE_S);
    wind.setValueCurveAtTime(dry ? up : down, t, CROSSFADE_S);
  }

  get isDry(): boolean {
    return this.dry;
  }

  /** the public inputs: the pool. `immediate` skips the glide (offline renders). */
  update(inputs: Partial<AmbienceInputs>, immediate = false): void {
    this.inputs = { ...this.inputs, ...inputs };
    if (inputs.dry !== undefined) this.setDry(inputs.dry, undefined, immediate);
    if (!this.started) return;
    const { poolCount, poolStart, scene } = this.inputs;
    const t = this.ctx.currentTime;
    const wet = poolStart > 0 ? Math.min(1, poolCount / poolStart) : 1;
    // the water thins slowly as the pool drains; the wind does not (there is nothing left to drain)
    const level = (scene === 'lobby' ? 2.2 : 1) * (this.dry ? 0.7 : 0.8 + 0.2 * wet);
    const to = (p: AudioParam, v: number, tc: number) => (immediate ? (p.value = v) : p.setTargetAtTime(v, t, tc));
    to(this.level.gain, level * 10 ** (BED_DB / 20), 1.5);
  }

  /** Emits every one-shot due before `until` (audio-context seconds). Called by the lookahead scheduler. */
  schedule(until: number): void {
    if (!this.started) return;
    const c = this.ctx;
    const r = this.r;
    while (this.next.drip < until) {
      const at = Math.max(this.next.drip, c.currentTime);
      if (!this.dry) {
        drip(c, this.dripBus, at, r, 1, 0.95 + r() * 0.1);
        // now and then a second, smaller drip off the same reed
        if (r() < 0.1) drip(c, this.dripBus, at + 0.09, r, 0.45, 0.9 + r() * 0.1);
      }
      this.next.drip += 3 + r() * 5;
    }
    // the wind's resonances wander, each on its own slow random walk
    WIND_BANDS.forEach((b, i) => {
      while (this.next.drift[i] < until) {
        const at = Math.max(this.next.drift[i], c.currentTime);
        const span = 6 + r() * 8;
        this.bands[i]?.frequency.setTargetAtTime(b.hz * (1 + (r() * 2 - 1) * 0.12), at, span / 3);
        this.next.drift[i] += span;
      }
    });
    // an occasional gust while it is wind; while it is water the clock just moves on
    while (this.next.gust < until) {
      const at = Math.max(this.next.gust, c.currentTime);
      if (this.dry) {
        this.gust.gain.cancelScheduledValues(at);
        this.gust.gain.setTargetAtTime(GUST_GAIN, at, 0.7 / 3);
        this.gust.gain.setTargetAtTime(1, at + 1.0, 1.1 / 3);
        this.bands.forEach((f, i) => {
          f.frequency.setTargetAtTime(WIND_BANDS[i].hz * 1.3, at, 0.25);
          f.frequency.setTargetAtTime(WIND_BANDS[i].hz, at + 1.0, 0.4);
        });
      }
      this.next.gust += 12 + r() * 18;
    }
    // the 640 Hz resonance is unstable: a few times a minute it whistles for about 200 ms
    while (this.next.whistle < until) {
      const at = Math.max(this.next.whistle, c.currentTime);
      if (this.dry && this.bands[1]) {
        this.bands[1].Q.setValueAtTime(WIND_BANDS[1].q, at);
        this.bands[1].Q.linearRampToValueAtTime(WIND_BANDS[1].q * 2.2, at + 0.05);
        this.bands[1].Q.linearRampToValueAtTime(WIND_BANDS[1].q, at + 0.2);
      }
      this.next.whistle += 12 + r() * 30;
    }
  }
}
