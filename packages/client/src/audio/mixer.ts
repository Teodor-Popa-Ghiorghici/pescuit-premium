/* The mixer (§3.3, §3.5). Buses -> stems -> profile EQ -> program gain -> sum -> lookahead
 * limiter (-1.5 dBFS) -> safety clip (-1 dBFS) -> user volume. No bus compression, no ducking.
 *
 *   UI, Table, Power, Music -> main stem        Clock -> clock stem        Ambience -> ambience stem
 *
 * `buildStemGraph` is the part the offline harness shares with the live mixer: everything up to
 * the sum. Each cue is mastered per voice before it reaches a bus: c·tanh(x/c), with c set per
 * cue and profile from the calibration (see calibration.ts). Ambience follows a slow *table
 * activity* envelope - rising over 1.5 s, falling over 6 s, at most -4 dB - never a per-cue duck.
 * Settings are per device and persisted in localStorage (always behind try/catch).
 */

import { CAL, PROGRAM_DB } from './calibration.js';
import { BUS_NAMES, BUSES, type BusName, type Profile } from './cuesheet.js';
import { PROFILES } from './context.js';
import { createLimiter, type LimiterNode } from './worklet.js';
import { fromDb } from './util.js';

/* ---------------------------------------------------------------- settings */

export interface AudioSettings {
  master: number;
  effects: number;
  interface: number;
  ambience: number;
  music: number;
  muted: boolean;
  profile: Profile;
  mono: boolean;
  /** the "softer sounds" accessibility option: -3 dB and the highs taken down (-9 dB shelf at 4.5 kHz) */
  softer: boolean;
  /** manual A/V offset for Bluetooth, ms (positive delays the pictures) */
  avOffsetMs: number;
}

export const DEFAULT_SETTINGS: AudioSettings = {
  master: 1,
  effects: 1,
  interface: 1,
  ambience: 1, // default on, its own setting (playtest-gated, §3.9)
  music: 1,
  muted: false,
  profile: 'speaker',
  mono: false,
  softer: false,
  avOffsetMs: 0,
};

const KEY = 'pescuit:audio';
const LEGACY_KEY = 'pescuit:sound'; // the old on/off toggle

const clamp01 = (v: unknown, d: number): number => (typeof v === 'number' && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : d);

export function loadSettings(): AudioSettings {
  const s = { ...DEFAULT_SETTINGS };
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const j = JSON.parse(raw) as Partial<AudioSettings>;
      s.master = clamp01(j.master, s.master);
      s.effects = clamp01(j.effects, s.effects);
      s.interface = clamp01(j.interface, s.interface);
      s.ambience = clamp01(j.ambience, s.ambience);
      s.music = clamp01(j.music, s.music);
      s.muted = j.muted === true;
      s.profile = j.profile === 'headphones' ? 'headphones' : 'speaker';
      s.mono = j.mono === true;
      s.softer = j.softer === true;
      s.avOffsetMs = typeof j.avOffsetMs === 'number' && Number.isFinite(j.avOffsetMs) ? Math.min(400, Math.max(-100, j.avOffsetMs)) : 0;
    } else if (localStorage.getItem(LEGACY_KEY) === 'off') {
      s.muted = true;
    }
  } catch {
    /* private mode or blocked storage: defaults */
  }
  return s;
}

export function saveSettings(s: AudioSettings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* the toggles still work for this session */
  }
}

/* --------------------------------------------------------------- the graph */

/** The linear gain of a bus: its §3.5 level, the speaker boost, and the player's volume. */
export function busGain(bus: BusName, profile: Profile, s: Pick<AudioSettings, 'effects' | 'interface' | 'ambience' | 'music'>): number {
  const b = BUSES[bus];
  const user = bus === 'UI' ? s.interface : bus === 'Ambience' ? s.ambience : bus === 'Music' ? s.music : s.effects;
  return fromDb(b.levelDb + (profile === 'speaker' ? b.speakerBoostDb : 0)) * user;
}

export interface StemGraph {
  buses: Record<BusName, GainNode>;
  /** the three stems after their profile EQ */
  outputs: { main: AudioNode; clock: AudioNode; ambience: AudioNode };
  /** table activity (ambience, up to -4 dB) and ceremony (ambience fades under `ex` cues) */
  ambActivity: GainNode;
  ambCeremony: GainNode;
  setProfile(p: Profile): void;
}

/** Everything up to the sum: buses, stems, profile EQ. Shared by the live mixer and the offline harness. */
export function buildStemGraph(ctx: BaseAudioContext, profile: Profile): StemGraph {
  const buses = {} as Record<BusName, GainNode>;
  for (const n of BUS_NAMES) buses[n] = ctx.createGain();
  const stem = () => {
    const input = ctx.createGain();
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.Q.value = 0.707;
    const shelf = ctx.createBiquadFilter();
    shelf.type = 'highshelf';
    shelf.Q.value = 0.707;
    input.connect(hp).connect(shelf);
    return { input, hp, shelf, output: shelf as AudioNode };
  };
  const main = stem(), clock = stem(), amb = stem();
  for (const n of ['UI', 'Table', 'Power', 'Music'] as const) buses[n].connect(main.input);
  buses.Clock.connect(clock.input);
  const ambActivity = ctx.createGain();
  const ambCeremony = ctx.createGain();
  buses.Ambience.connect(ambActivity).connect(ambCeremony).connect(amb.input);
  const setProfile = (p: Profile) => {
    const pr = PROFILES[p];
    for (const s of [main, clock, amb]) {
      s.hp.frequency.value = pr.highPassHz;
      s.shelf.frequency.value = pr.shelfHz;
      s.shelf.gain.value = pr.shelfDb;
    }
  };
  setProfile(profile);
  return { buses, outputs: { main: main.output, clock: clock.output, ambience: amb.output }, ambActivity, ambCeremony, setProfile };
}

/* -------------------------------------------------------- per-voice mastering */

const CURVES = new Map<number, Float32Array>();
/** c·tanh(x/c) sampled on [-1, 1]; c in dBFS, rounded to 0.1 dB so curves are shared */
export function masterCurve(cDb: number): Float32Array {
  const key = Math.round(cDb * 10);
  let curve = CURVES.get(key);
  if (!curve) {
    const c = fromDb(key / 10);
    curve = new Float32Array(4097);
    for (let i = 0; i < curve.length; i++) curve[i] = c * Math.tanh((i / 2048 - 1) / c);
    CURVES.set(key, curve);
  }
  return curve;
}

export function calFor(profile: Profile, cue: string): { c: number | null; norm: number } | undefined {
  return CAL[profile][cue];
}

/* --------------------------------------------------------------- the live mixer */

export class Mixer {
  readonly graph: StemGraph;
  readonly program: GainNode;
  readonly user: GainNode;
  limiter: LimiterNode | null = null;
  private settings: AudioSettings;
  private soft: BiquadFilterNode;

  constructor(readonly ctx: AudioContext, settings: AudioSettings) {
    this.settings = settings;
    this.graph = buildStemGraph(ctx, settings.profile);
    this.program = ctx.createGain();
    this.user = ctx.createGain();
    this.soft = ctx.createBiquadFilter();
    // "softer sounds": a high shelf that is an exact identity at 0 dB, so the default chain is the harness's chain
    this.soft.type = 'highshelf';
    this.soft.frequency.value = 4500;
    this.soft.Q.value = 0.707;
    for (const o of Object.values(this.graph.outputs)) o.connect(this.program);
    this.applySettings(settings);
  }

  /** Connects the limiter and the output. Until it resolves the mix is silent, never unlimited. */
  async start(): Promise<void> {
    this.limiter = await createLimiter(this.ctx);
    // the limiter and the clip are the last processing: nothing may sit between them and the output but
    // the user's attenuation, or a filter could lift a limited peak back over the ceiling
    this.program.connect(this.soft).connect(this.limiter.node);
    this.limiter.node.connect(this.user).connect(this.ctx.destination);
  }

  applySettings(s: AudioSettings): void {
    this.settings = s;
    const t = this.ctx.currentTime;
    for (const n of BUS_NAMES) this.graph.buses[n].gain.setTargetAtTime(busGain(n, s.profile, s), t, 0.02);
    this.graph.setProfile(s.profile);
    this.program.gain.setTargetAtTime(fromDb(PROGRAM_DB[s.profile]), t, 0.02);
    this.soft.gain.setTargetAtTime(s.softer ? -9 : 0, t, 0.02);
    // user volume comes last and only attenuates: at most unity
    this.user.gain.setTargetAtTime(s.muted ? 0 : Math.min(1, s.master) * (s.softer ? fromDb(-3) : 1), t, 0.02);
    this.user.channelCount = s.mono ? 1 : 2;
    this.user.channelCountMode = 'explicit';
  }

  /** A source cue was heard: the ambience eases under the table's activity - up to -4 dB, in over
   * 1.5 s, back out over 6 s. It never ducks per cue. */
  bumpActivity(when: number): void {
    const g = this.graph.ambActivity.gain;
    const t = Math.max(when, this.ctx.currentTime);
    g.cancelScheduledValues(t);
    g.setTargetAtTime(fromDb(-4), t, 1.5 / 3);
    g.setTargetAtTime(1, t + 4, 6 / 3);
  }

  /** ceremony cues (`ex`): the ambience fades under them and returns */
  fadeAmbience(when: number, seconds: number): void {
    const g = this.graph.ambCeremony.gain;
    const t = Math.max(when, this.ctx.currentTime);
    g.cancelScheduledValues(t);
    g.setTargetAtTime(fromDb(-10), t, 0.3);
    g.setTargetAtTime(1, t + seconds, 1.2);
  }
}
