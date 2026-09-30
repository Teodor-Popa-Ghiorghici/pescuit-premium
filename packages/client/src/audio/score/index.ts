/* The background score (MUSIC_PLAN.md): the Score class the engine loads lazily once the audio has unlocked. It projects
 * what the store holds (input.ts), lets the conductor decide (conductor.ts), and posts the decisions to the synth on the
 * audio thread (worklet.ts) ahead of time. Nothing waits on it: the main thread only computes schedules, and a browser
 * without AudioWorklet simply has no score.
 */

import type { Profile } from '../cuesheet.js';
import { ScoreConductor, type ScoreMode, type TimedMessage } from './conductor.js';
import { scoreInputOf, type ScoreSource } from './input.js';
import { createScoreNode, type ScoreNode } from './worklet.js';
import { SCORE_SYNTH } from './levels.js';

export type { ScoreMode } from './conductor.js';
export type { ScoreSource } from './input.js';

export interface ScoreDeps {
  /** the server's clock now, ms */
  serverNow(): number;
}

/** how far ahead far calls are posted: late enough that every broadcast 2 s before a slot has arrived (§5.2) */
const HORIZON_MS = 400;
/** a hidden tab's timers run about once a second: look further ahead then */
const HIDDEN_HORIZON_MS = 1_600;

export class Score {
  readonly conductor: ScoreConductor;
  private lastClock = 0;
  private wasRunning = true;

  private constructor(private readonly ctx: AudioContext, private readonly node: ScoreNode, private readonly deps: ScoreDeps, o: { profile: Profile; mode: ScoreMode; stereo: boolean }) {
    this.conductor = new ScoreConductor({ ...o, salt: (Math.random() * 2 ** 32) >>> 0 });
  }

  /** null where the browser has no AudioWorklet (D-e): no score on that client, for the session */
  static async create(ctx: AudioContext, out: AudioNode, deps: ScoreDeps, o: { profile: Profile; mode: ScoreMode; stereo: boolean }): Promise<Score | null> {
    const node = await createScoreNode(ctx, SCORE_SYNTH);
    if (!node) return null;
    node.node.connect(out);
    return new Score(ctx, node, deps, o);
  }

  /** a public broadcast (a view, or the waiting room's update); `cues` are the step's cues, ms from now, when it is live */
  update(src: ScoreSource, opts: { live: boolean; cues?: ReadonlyArray<{ id: string; at: number }> }): void {
    const now = this.deps.serverNow();
    this.send(this.conductor.update(scoreInputOf(src), { nowMs: now, live: opts.live, cues: opts.cues }), now);
  }

  configure(o: Partial<{ profile: Profile; mode: ScoreMode; stereo: boolean }>): void {
    const now = this.deps.serverNow();
    this.send(this.conductor.configure(o, now), now);
  }

  /** the engine's 25 ms scheduler */
  tick(): void {
    const now = this.deps.serverNow();
    const running = this.ctx.state === 'running';
    if (!running) {
      this.wasRunning = false;
      return;
    }
    if (!this.wasRunning) {
      // the context was suspended (a hidden tab on a phone, an interruption): come back with a swell (D-d)
      this.wasRunning = true;
      this.send(this.conductor.resume(now), now);
    }
    if (now - this.lastClock > 1000) {
      this.lastClock = now;
      this.node.post([{ type: 'clock', frame: Math.round(this.ctx.currentTime * this.ctx.sampleRate), serverMs: now }]);
    }
    const hidden = typeof document !== 'undefined' && document.hidden;
    this.send(this.conductor.tick(now, hidden ? HIDDEN_HORIZON_MS : HORIZON_MS), now);
  }

  /** the output latency the browser reports: a far call is posted this much early, so it leaves the speaker on time */
  private latency(): number {
    const c = this.ctx as AudioContext & { outputLatency?: number };
    return Math.max(0, (c.outputLatency ?? 0) + (c.baseLatency ?? 0));
  }

  private send(list: TimedMessage[], now: number): void {
    if (!list.length) return;
    const sr = this.ctx.sampleRate;
    const t0 = this.ctx.currentTime;
    const lat = this.latency();
    this.node.post(
      list.map((m) => {
        const when = t0 + (m.atMs - now) / 1000 - (m.aligned ? lat : 0);
        return { ...m.msg, frame: Math.max(0, Math.round(when * sr)) } as typeof m.msg;
      }),
    );
  }

  dispose(): void {
    this.node.post([{ type: 'silence', frame: 0, rampS: 0.3 }]);
    setTimeout(() => {
      try {
        this.node.node.disconnect();
      } catch {
        /* already gone */
      }
    }, 500);
  }
}
