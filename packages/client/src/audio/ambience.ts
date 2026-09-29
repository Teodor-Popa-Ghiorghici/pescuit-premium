/* The world's voice (§3.9): a live pond bed, its life, and the last act, all generated from a
 * looped noise buffer, modulated filters and scheduled one-shots - no long loops are stored.
 * It is driven only by public inputs: the pool count (the water: it laps and the fish jump while
 * the pool lasts, and drains to wind once it is dry) and the tally of sets still possible (the
 * last act: a low dobă pulse from 3, quickening at 1). Never compressed and never ducked per
 * cue; the mixer shapes it with the slow activity envelope. Default on, its own setting.
 *
 *   water  the bed and its drips              life  fish jumps, reeds, distant birds
 *   lastact a low dobă pulse
 */

import { rng } from './util.js';
import { type Ctx, env, filt, sharedNoise } from './live/common.js';
import { doba } from './live/tabletop.js';
import { bubble, drip, splash } from './live/water.js';

export interface AmbienceInputs {
  /** cards left in the pool, and how many there were at the start */
  poolCount: number;
  poolStart: number;
  /** the public tally of sets still possible (18 at the start), or null when unknown */
  setsPossible: number | null;
  /** 'lobby': the full pond, louder (the waiting room) */
  scene: 'lobby' | 'game';
}

export const BED_DB = 0; // the bed's level within the ambience bus (the prototype used +1; the product's dry wind is louder, so it sits 1 dB lower)

export class Ambience {
  private inputs: AmbienceInputs = { poolCount: 1, poolStart: 1, setsPossible: null, scene: 'game' };
  private r: () => number;
  private bedGain!: GainNode;
  private lp!: BiquadFilterNode;
  private wind!: GainNode;
  private dripBus!: GainNode;
  private lifeBus!: GainNode;
  private pulseBus!: GainNode;
  private next = { drip: 0, fish: 0, reeds: 0, bird: 0, pulse: 0 };
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
    const bed = c.createBufferSource();
    bed.buffer = sharedNoise(c);
    bed.loop = true;
    this.lp = filt(c, 'lowpass', 600);
    const drift = c.createOscillator();
    drift.frequency.value = 0.05;
    const depth = c.createGain();
    depth.gain.value = 150;
    drift.connect(depth).connect(this.lp.frequency);
    this.bedGain = c.createGain();
    this.bedGain.gain.value = 10 ** (BED_DB / 20);
    // wind gusts: the dry basin's bed is slowly amplitude-modulated
    this.wind = c.createGain();
    this.wind.gain.value = 0;
    const gust = c.createOscillator();
    gust.frequency.value = 0.13;
    gust.connect(this.wind);
    bed.connect(this.lp).connect(this.bedGain).connect(this.out);
    this.wind.connect(this.bedGain.gain);
    this.dripBus = c.createGain();
    this.lifeBus = c.createGain();
    this.pulseBus = c.createGain();
    this.dripBus.gain.value = 10 ** ((BED_DB + 4) / 20);
    this.lifeBus.gain.value = 10 ** ((BED_DB + 2) / 20);
    this.pulseBus.gain.value = 0.9;
    for (const b of [this.dripBus, this.lifeBus, this.pulseBus]) b.connect(this.out);
    for (const s of [bed, drift, gust]) {
      s.start(t0);
      this.sources.push(s);
    }
    const r = this.r;
    this.next = { drip: t0 + 2 + r() * 4, fish: t0 + 12 + r() * 20, reeds: t0 + 6 + r() * 10, bird: t0 + 15 + r() * 25, pulse: t0 };
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
    this.started = false;
  }

  /** the public inputs: the pool and the tally. `immediate` skips the glide (offline renders). */
  update(inputs: Partial<AmbienceInputs>, immediate = false): void {
    this.inputs = { ...this.inputs, ...inputs };
    if (!this.started) return;
    const { poolCount, poolStart, scene } = this.inputs;
    const dry = poolCount <= 0;
    const t = this.ctx.currentTime;
    const wet = poolStart > 0 ? Math.min(1, poolCount / poolStart) : 1;
    // the water thins as the pool drains; once dry it is wind: brighter, gusting, no lapping
    const level = (scene === 'lobby' ? 2.2 : 1) * (dry ? 0.7 : 0.8 + 0.2 * wet);
    const to = (p: AudioParam, v: number, tc: number) => (immediate ? (p.value = v) : p.setTargetAtTime(v, t, tc));
    to(this.bedGain.gain, level * 10 ** (BED_DB / 20), 1.5);
    to(this.lp.frequency, dry ? 900 : 600, 2);
    to(this.wind.gain, dry ? 0.15 * level : 0, 2);
  }

  /** Emits every one-shot due before `until` (audio-context seconds). Called by the lookahead scheduler. */
  schedule(until: number): void {
    if (!this.started) return;
    const c = this.ctx;
    const r = this.r;
    const { poolCount, setsPossible, scene } = this.inputs;
    const dry = poolCount <= 0;
    while (this.next.drip < until) {
      if (!dry) drip(c, this.dripBus, Math.max(this.next.drip, c.currentTime), r);
      this.next.drip += 3 + r() * 5;
    }
    if (!dry || scene === 'lobby') {
      while (this.next.fish < until) {
        const at = Math.max(this.next.fish, c.currentTime);
        bubble(c, this.lifeBus, at, 420 + r() * 80, 0.09, 1);
        splash(c, this.lifeBus, at + 0.01, r, 0.5, 1800, 0.25);
        this.next.fish += 15 + r() * 25;
      }
      while (this.next.reeds < until) {
        const at = Math.max(this.next.reeds, c.currentTime);
        const g = env(c, at, 0.35, 0.3, 0.5);
        const src = c.createBufferSource();
        src.buffer = sharedNoise(c);
        src.start(at, r() * 0.8, 0.9);
        src.connect(filt(c, 'bandpass', 2600 + r() * 800, 0.7)).connect(g).connect(this.lifeBus);
        this.next.reeds += 8 + r() * 12;
      }
      while (this.next.bird < until) {
        const at = Math.max(this.next.bird, c.currentTime);
        const n = 2 + Math.floor(r() * 2);
        const f = 2600 + r() * 900;
        for (let i = 0; i < n; i++) {
          const o = c.createOscillator();
          o.frequency.setValueAtTime(f, at + i * 0.11);
          o.frequency.exponentialRampToValueAtTime(f * 1.25, at + i * 0.11 + 0.07);
          o.connect(env(c, at + i * 0.11, 0.06, 0.01, 0.06)).connect(this.lifeBus);
          o.start(at + i * 0.11);
          o.stop(at + i * 0.11 + 0.1);
        }
        this.next.bird += 20 + r() * 30;
      }
    } else {
      this.next.fish = Math.max(this.next.fish, until);
      this.next.reeds = Math.max(this.next.reeds, until);
      this.next.bird = Math.max(this.next.bird, until);
    }
    // the last act: a low dobă pulse from 3 sets, quickening at 1
    if (setsPossible !== null && setsPossible <= 3 && setsPossible >= 1) {
      const period = setsPossible === 1 ? 1.6 : 3.2;
      while (this.next.pulse < until) {
        const at = Math.max(this.next.pulse, c.currentTime);
        doba(c, this.pulseBus, at, 0.5, r, 0.3);
        this.next.pulse = at + period;
      }
    } else this.next.pulse = Math.max(this.next.pulse, until);
  }
}
