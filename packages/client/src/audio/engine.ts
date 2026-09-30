/* The audio engine: context + mixer + voices + the lookahead scheduler (§3.5). One clock for
 * sight and sound: a scheduler at a 25 ms interval with a 100 ms horizon runs on
 * `AudioContext.currentTime`; requests carry an offset in ms from "now" and are synthesised only
 * when they fall inside the horizon, so live per-hit synthesis costs nothing until it sounds.
 *
 * `spawnVoice` is the one place a cue becomes nodes - recipe -> per-voice mastering shaper ->
 * cue level -> (seat pan) -> bus. The live engine and the offline harness both call it.
 */

import { Ambience, type AmbienceInputs } from './ambience.js';
import { CAL } from './calibration.js';
import { ServerClock, WindowClock } from './clock.js';
import { audioStatus, getContext, installLifecycle, onGesture, panningAvailable, unlock, visualDelayMs } from './context.js';
import type { CueRequest } from './cues.js';
import { BUSES, ECHO_EXEMPT, cueDef, type BusName, type Profile } from './cuesheet.js';
import { humanize } from './variation.js';
import { hapticsFor, playHaptics, type HapticRequest } from './haptics.js';
import { DEFAULT_SETTINGS, Mixer, loadSettings, masterCurve, saveSettings, type AudioSettings } from './mixer.js';
import { RECIPES, type CueParams } from './recipes.js';
import { fromDb } from './util.js';
import { VoicePool } from './voices.js';
import { loadRendered, preloadRendered } from './bank.js';
import type { Score, ScoreSource } from './score/index.js';

export interface VoiceEnv {
  ctx: BaseAudioContext;
  buses: Record<BusName, AudioNode>;
  profile: Profile;
  pool?: VoicePool;
  /** the lab's "before mastering": bypass the per-voice shaper */
  mastering?: boolean;
  /** the runtime safety net of §3.4: speaker variants fade out 250 -> 400 ms */
  safetyFade?: boolean;
  /** seat panning (desktop stereo and headphones only) */
  pan?: boolean;
  /** force the full (headphones) variant: the acting client in experiment E1 */
  full?: boolean;
  onSource?: (when: number) => void;
  onCeremony?: (when: number, seconds: number) => void;
  /** the background score ducks under this cue (its `scoreDuckDb`) */
  onScoreDuck?: (when: number, db: number, seconds: number) => void;
}

const SEAT_PAN = [-0.6, -0.36, -0.12, 0.12, 0.36, 0.6];

/** Builds one cue into the graph at `when` (context seconds). Returns false if it was refused. */
export function spawnVoice(e: VoiceEnv, id: string, params: CueParams, seed: number, when: number): boolean {
  const def = cueDef(id);
  const recipe = RECIPES[id];
  if (!def || !recipe) return false;
  const ctx = e.ctx;
  const dur = def.maxLenMs / 1000 + 0.1;
  let voiceId = 0;
  if (e.pool) {
    const a = e.pool.admit(def, when, dur);
    if (!a.ok) return false;
    voiceId = a.id;
  }
  const speaker = e.profile === 'speaker' && !e.full;
  const cal = CAL[e.profile][id];

  // the recipe writes into `input`: a per-voice mastering shaper, or a plain gain
  let input: AudioNode;
  const level = ctx.createGain();
  level.gain.value = fromDb(def.levelDb + (cal ? cal.norm : 0) + (params.gainDb ?? 0));
  if (cal && cal.c !== null && e.mastering !== false) {
    const shaper = ctx.createWaveShaper();
    shaper.curve = masterCurve(cal.c) as Float32Array<ArrayBuffer>;
    shaper.connect(level);
    input = shaper;
  } else input = level;

  let tail: AudioNode = level;
  if (e.pan && params.seat !== undefined && ctx.createStereoPanner) {
    const p = ctx.createStereoPanner();
    p.pan.value = SEAT_PAN[((params.seat % 6) + 6) % 6];
    level.connect(p);
    tail = p;
  }
  tail.connect(e.buses[def.bus]);

  recipe(ctx, input, when, seed, speaker, params);

  if (speaker && e.safetyFade && !ECHO_EXEMPT.has(id)) {
    const g = level.gain;
    const v = g.value;
    g.setValueAtTime(v, when + 0.25);
    g.linearRampToValueAtTime(0, when + 0.4);
  }
  if (def.env === 'src') e.onSource?.(when);
  if (def.env === 'ex') e.onCeremony?.(when, (def.duckMs ?? def.maxLenMs) / 1000);
  if (def.scoreDuckDb !== undefined) e.onScoreDuck?.(when, def.scoreDuckDb, (def.duckMs ?? def.maxLenMs) / 1000);
  if (e.pool && voiceId) {
    e.pool.attach(voiceId, () => {
      const now = ctx.currentTime;
      level.gain.cancelScheduledValues(now);
      level.gain.setTargetAtTime(0, now, 0.004);
    });
  }
  return true;
}

/* ------------------------------------------------------------------ the engine */

interface Queued {
  dueWall: number;
  id: string;
  params: CueParams;
  seed: number;
  full: boolean;
}

export class AudioEngine {
  settings: AudioSettings;
  readonly pool = new VoicePool();
  readonly trace: Array<{ at: number; id: string; played: boolean }> = [];
  private mixer: Mixer | null = null;
  private ambience: Ambience | null = null;
  private ready = false;
  private starting: Promise<void> | null = null;
  private queue: Queued[] = [];
  private timer: ReturnType<typeof setInterval> | undefined;
  private listeners = new Set<() => void>();
  readonly server = new ServerClock();
  readonly windowClock: WindowClock;
  private world: Partial<AmbienceInputs> | null = null;
  private dry = false;
  private step = 0;
  private worldQueue: Array<{ dueWall: number; patch: { dry?: boolean; step?: number } }> = [];
  private tracing = false;
  private afterPaintTick = false;
  /** the background score: loaded lazily (its own chunk) once the audio runs and the switch allows it */
  private score: Score | null = null;
  private scoreLoad: Promise<void> | null = null;
  /** what the score has been handed before it loaded, replayed into it in order (the public history it needs) */
  private scoreQueue: Array<{ src: ScoreSource; opts: { live: boolean; cues?: ReadonlyArray<{ id: string; at: number }> } }> = [];
  private scorePhase: 'lobby' | 'game' | null = null;

  constructor() {
    this.settings = loadSettings();
    installLifecycle();
    onGesture(() => void this.ensure());
    this.windowClock = new WindowClock({
      now: () => Date.now(),
      server: this.server,
      emit: (id, inMs) => this.play(id, undefined, { delayMs: inMs }),
    });
  }

  /* ------------------------------------------------------------ lifecycle */

  /** Creates the context and the chain if the browser allows it. Safe to call often. */
  ensure(): Promise<void> {
    if (this.starting) return this.starting;
    installLifecycle();
    const ctx = getContext();
    if (!ctx) return Promise.resolve();
    void loadRendered();
    this.mixer = new Mixer(ctx, this.settings);
    this.starting = this.mixer.start().then(() => {
      this.ready = true;
      // render the tonal families for the current profile in the background, in small slices
      setTimeout(() => void preloadRendered(this.settings.profile), 300);
      this.timer = setInterval(() => this.tick(), 25);
      this.syncWorld();
      this.syncScore();
    });
    return this.starting;
  }

  get status() {
    return audioStatus();
  }
  get context(): AudioContext | null {
    return this.mixer?.ctx ?? null;
  }
  get mixerNode(): Mixer | null {
    return this.mixer;
  }
  get limiterKind(): string | null {
    return this.mixer?.limiter?.kind ?? null;
  }
  limiterStats() {
    return this.mixer?.limiter?.stats() ?? null;
  }
  /** call from a pointerdown/keydown handler if the built-in unlock did not run */
  unlock(): void {
    unlock();
    void this.ensure();
  }
  subscribe(cb: () => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }
  private emit(): void {
    this.listeners.forEach((l) => l());
  }

  /* ------------------------------------------------------------- settings */

  update(patch: Partial<AudioSettings>): void {
    const profileChanged = patch.profile !== undefined && patch.profile !== this.settings.profile;
    this.settings = { ...this.settings, ...patch };
    saveSettings(this.settings);
    if (profileChanged && this.ready) void preloadRendered(this.settings.profile);
    this.mixer?.applySettings(this.settings);
    this.score?.configure({ profile: this.settings.profile, mode: this.scoreMode(), stereo: this.scoreStereo() });
    this.syncScore();
    this.syncWorld();
    this.emit();
  }
  get headphones(): boolean {
    return this.settings.profile === 'headphones';
  }
  /** how long visual impacts should wait so they land with the sound (§3.5) */
  visualDelayMs(): number {
    return visualDelayMs(this.settings.avOffsetMs);
  }

  /* -------------------------------------------------------------- playing */

  /** Plays one cue, `delayMs` from now. A cue the mapping layer placed already carries its take, pitch and gain; a local one
   * (a press, a toggle) gets them here from its seed, in the same way. */
  play(id: string, params?: CueParams, opts: { delayMs?: number; seed?: number; full?: boolean; afterPaint?: boolean } = {}): boolean {
    const def = cueDef(id);
    if (!def) return false;
    if (this.settings.muted) return false;
    void this.ensure();
    const seed = opts.seed ?? (Math.random() * 2 ** 31) >>> 0;
    let p = params ?? {};
    if (p.take === undefined || p.pitch === undefined || p.gainDb === undefined) {
      const h = humanize(seed, def.variation, 'exact');
      p = { take: h.take, pitch: h.pitch, gainDb: h.gainDb, ...p };
    }
    if (this.tracing) this.trace.push({ at: Date.now(), id, played: true });
    this.queue.push({ dueWall: performance.now() + (opts.delayMs ?? 0), id, params: p, seed, full: !!opts.full });
    if (!this.ready) return true;
    if (opts.afterPaint && typeof requestAnimationFrame === 'function') {
      // the sound of a press follows the frame that shows it: synthesising its voice (6-10 nodes) inside the input
      // handler would delay that frame (input -> visual <= 50 ms, §4.4); it costs the sound one frame (input -> audio <= 80 ms)
      if (!this.afterPaintTick) {
        this.afterPaintTick = true;
        requestAnimationFrame(() =>
          setTimeout(() => {
            this.afterPaintTick = false;
            this.tick();
          }, 0),
        );
      }
    } else this.tick();
    return true;
  }

  /** Plays the cues `cuesFor` returned for one presentation step. */
  playRequests(reqs: readonly CueRequest[], opts: { delayMs?: number; afterPaint?: boolean } = {}): void {
    for (const r of reqs) this.play(r.id, r.params, { delayMs: (opts.delayMs ?? 0) + r.at, seed: r.seed, afterPaint: opts.afterPaint });
  }

  playHaptics(reqs: readonly HapticRequest[], delayMs = 0): void {
    playHaptics(reqs, delayMs);
  }

  /** Starts recording an event -> cue trace for the lab. */
  traceOn(on: boolean): void {
    this.tracing = on;
    if (!on) this.trace.length = 0;
  }

  private tick(): void {
    const m = this.mixer;
    if (!this.ready || !m) return;
    const ctx = m.ctx;
    this.runWorld(performance.now());
    if (ctx.state !== 'running') {
      // nothing can be heard: drop what has gone stale rather than play it late on resume
      const now = performance.now();
      this.queue = this.queue.filter((q) => q.dueWall > now - 300);
      return;
    }
    const nowWall = performance.now();
    const horizon = nowWall + 100;
    const rest: Queued[] = [];
    for (const q of this.queue) {
      if (q.dueWall > horizon) {
        rest.push(q);
        continue;
      }
      const when = ctx.currentTime + Math.max(0.005, (q.dueWall - nowWall) / 1000);
      const ok = spawnVoice(
        {
          ctx,
          buses: m.graph.buses,
          profile: this.settings.profile,
          pool: this.pool,
          safetyFade: true,
          pan: !this.settings.mono && panningAvailable(this.settings.profile),
          full: q.full,
          onSource: (t) => m.bumpActivity(t),
          onCeremony: (t, s) => m.fadeAmbience(t, s),
          onScoreDuck: (t, db, s) => m.duckScore(t, db, s),
        },
        q.id,
        q.params,
        q.seed,
        when,
      );
      if (!ok && this.tracing) this.trace.push({ at: Date.now(), id: q.id, played: false });
    }
    this.queue = rest;
    this.ambience?.schedule(ctx.currentTime + 0.3);
    this.score?.tick();
  }

  /* ------------------------------------------------------ world and clock */

  /**
   * Drives the pond from public inputs (§3.9); null stops it. `dry` (the wind) and `step` (the darkening, 0-3) are set
   * here only when they are given - a first look, a rejoin, the lobby. During play they change on the beat of their own
   * event, through `worldAt`, so the ambience turns exactly when the table's picture does.
   */
  setWorld(inputs: (Partial<AmbienceInputs> & { step?: number }) | null): void {
    if (inputs === null) this.world = null;
    else {
      const { step, ...rest } = inputs;
      this.world = { ...(this.world ?? {}), ...rest };
      if (rest.dry !== undefined) this.dry = rest.dry;
      if (step !== undefined) this.applyStep(step, undefined, true);
    }
    this.syncWorld();
  }

  /** the ambience turns to wind, or steps one flat step darker, `delayMs` from now: on the beat of the event that says so */
  worldAt(patch: { dry?: boolean; step?: number }, delayMs = 0): void {
    this.worldQueue.push({ dueWall: performance.now() + delayMs, patch });
    if (delayMs <= 0) this.runWorld(performance.now());
  }

  /** applies what has come due; a change of state is never dropped, however late (a hidden tab, a suspended context) */
  private runWorld(nowWall: number): void {
    if (!this.worldQueue.length) return;
    const due = this.worldQueue.filter((q) => q.dueWall <= nowWall + 30);
    if (!due.length) return;
    this.worldQueue = this.worldQueue.filter((q) => !due.includes(q));
    for (const q of due) {
      const when = this.mixer ? this.mixer.ctx.currentTime + Math.max(0, (q.dueWall - nowWall) / 1000) : undefined;
      if (q.patch.dry !== undefined) {
        this.dry = q.patch.dry;
        this.ambience?.setDry(q.patch.dry, when);
      }
      if (q.patch.step !== undefined) this.applyStep(q.patch.step, when, false);
    }
  }

  private applyStep(step: number, when: number | undefined, immediate: boolean): void {
    this.step = Math.max(0, Math.min(3, Math.round(step)));
    this.mixer?.setDarkStep(this.step, when, immediate);
  }

  /** which scene the pond is playing, if any: the lobby hands over to the game without a gap */
  get worldScene(): string | null {
    return this.world?.scene ?? null;
  }

  private syncWorld(): void {
    const m = this.mixer;
    if (!m || !this.ready) return;
    const on = this.world !== null && this.settings.ambience > 0 && !this.settings.muted;
    const scoreOn = this.scoreAudible();
    if (on && !this.ambience) {
      this.ambience = new Ambience(m.ctx, m.graph.buses.Ambience, 5);
      this.ambience.update({ ...this.world, dry: this.dry, scoreOn }, true);
      this.ambience.start();
    }
    if (on && this.world) this.ambience?.update({ ...this.world, dry: this.dry, scoreOn });
    if (!on && this.ambience) {
      this.ambience.stop();
      this.ambience = null;
    }
    m.setDarkStep(this.step, undefined, true);
  }

  /* ------------------------------------------------------ the background score */

  /** the switch, as the score reads it: muted, or the Music slider at 0, is off */
  private scoreMode(): 'on' | 'lobby' | 'off' {
    return this.settings.muted || this.settings.music <= 0 ? 'off' : this.settings.scoreMode;
  }
  private scoreStereo(): boolean {
    return !this.settings.mono && this.settings.profile === 'headphones';
  }
  /** the score is sounding now (the pond makes room for it): loaded, and the switch allows the current phase */
  private scoreAudible(): boolean {
    if (!this.score || this.scorePhase === null) return false;
    const mode = this.scoreMode();
    return mode === 'on' || (mode === 'lobby' && this.scorePhase === 'lobby');
  }

  /**
   * Hands the score a public broadcast: the waiting room's update, or a game view (MUSIC_PLAN §5). `live` steps carry the
   * step's cues, ms from now, so a change of chord lands on the knock that marks it; a first look or a rejoin swells in.
   * null: the player left the room.
   */
  setScore(src: ScoreSource | null, opts: { live: boolean; cues?: ReadonlyArray<{ id: string; at: number }> } = { live: false }): void {
    if (src === null) {
      this.scoreQueue = [];
      this.scorePhase = null;
      this.score?.dispose();
      this.score = null;
      this.scoreLoad = null;
      this.syncWorld();
      return;
    }
    const phase = src.view ? 'game' : 'lobby';
    const changed = phase !== this.scorePhase;
    this.scorePhase = phase;
    if (this.score) this.score.update(src, opts);
    else {
      this.scoreQueue.push({ src, opts: { live: false } });
      if (this.scoreQueue.length > 400) this.scoreQueue.splice(1, this.scoreQueue.length - 400);
      this.syncScore();
    }
    if (changed) this.syncWorld();
  }

  /** loads the score's chunk when there is something to play and the switch allows it */
  private syncScore(): void {
    const m = this.mixer;
    if (!m || !this.ready || this.score || this.scoreLoad || !this.scoreQueue.length || this.scoreMode() === 'off') return;
    const ctx = m.ctx;
    this.scoreLoad = import('./score/index.js')
      .then(({ Score }) => Score.create(ctx, m.graph.buses.Score, { serverNow: () => this.server.serverNow(Date.now()) }, { profile: this.settings.profile, mode: this.scoreMode(), stereo: this.scoreStereo() }))
      .then((score) => {
        if (!score || this.scorePhase === null) {
          score?.dispose();
          return; // no AudioWorklet: no score on this client (D-e); or the player has left
        }
        this.score = score;
        for (const q of this.scoreQueue.splice(0)) score.update(q.src, q.opts);
        this.syncWorld();
      })
      .catch(() => {
        /* the chunk did not load: no score this session */
      });
  }

  /** hands a window's server deadline to the click scheduler; pass null when the answer window is gone */
  setAnswerWindow(target: { key: string; deadlineAt: number } | null): void {
    if (!target) this.windowClock.stop();
    else this.windowClock.start(target.deadlineAt, target.key);
  }

  /** every public volume in one place, for the lab and the settings sheet */
  get busLevelsDb(): Record<BusName, number> {
    const out = {} as Record<BusName, number>;
    for (const b of Object.keys(BUSES) as BusName[]) out[b] = BUSES[b].levelDb;
    return out;
  }
}

let singleton: AudioEngine | null = null;
export function getEngine(): AudioEngine {
  singleton ??= new AudioEngine();
  return singleton;
}

export { DEFAULT_SETTINGS, hapticsFor };
