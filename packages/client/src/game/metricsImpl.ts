/* `?metrics=1` (§9.2): what the playtests read out of a build - answer time (which sets the clock's
 * T), missed windows (timed-out eligible windows, and the total), and the time from the tally
 * reaching 0 to the podium (about one beat under §11.2) - plus the two timings the performance gate
 * reads (§9.1): answer to rest, and the frame rate. Everything lands in `window.__metrics` and a
 * small overlay; `report()` prints a table to the console. Off unless the URL (or the perf script)
 * asks: it never runs for a player who did not - and is never even downloaded: `metrics.ts` is the facade
 * the presenter calls, and it loads this module only when the URL (or the perf script) asks.
 */

import { getEngine } from '../audio/engine.js';

export interface MetricsState {
  /** ms from the answer window opening on you to your press */
  answerTimes: number[];
  /** windows you were eligible in, and the ones that ran out without you */
  eligibleWindows: number;
  missedWindows: number;
  /** ms from the tally reaching 0 to the podium showing */
  tallyToPodium: number[];
  /** ms from the answer window leaving the view to the table lane being free */
  answerToRest: number[];
  /** ms from your input to the next paint (Event Timing) */
  inputToPaint: number[];
  /** a rolling frame-time log the perf script reads */
  frames: number[];
  /** what each step was: its beats, how long the table lane took, how far behind it started */
  steps: { kinds: string[]; tableMs: number; queuedMs: number; at: number }[];
  /** the ambience opt-out (§3.9, §9.2: 5 or more of 15 switching it off ships it off): how many times this device
   *  turned the pond's bed off, and whether it is off now. Per device; a playtest pools the devices' counts. */
  ambienceOff: number;
  ambienceIsOff: boolean;
  /** the mute tab, for the same playtest ("muted by the end", ≤ 2 of 15) */
  mutedNow: boolean;
}

const empty = (): MetricsState => ({ answerTimes: [], eligibleWindows: 0, missedWindows: 0, tallyToPodium: [], answerToRest: [], inputToPaint: [], frames: [], steps: [], ambienceOff: 0, ambienceIsOff: false, mutedNow: false });

export function enabled(): boolean {
  try {
    return typeof location !== 'undefined' && (new URLSearchParams(location.search).get('metrics') === '1' || (window as unknown as { __perf?: boolean }).__perf === true);
  } catch {
    return false;
  }
}

const pct = (a: number[], p: number): number => {
  if (!a.length) return NaN;
  const s = [...a].sort((x, y) => x - y);
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))];
};

class Metrics {
  on = false;
  state: MetricsState = empty();
  private answerOpenAt: number | null = null;
  private answerKey: string | null = null;
  private windowKey: string | null = null;
  private windowActed = false;
  private windowDeadline = 0;
  private tallyZeroAt: number | null = null;
  private answerClosedAt: number | null = null;
  private overlay: HTMLElement | null = null;
  private frameRaf = 0;

  init(): void {
    if (this.on || !enabled()) return;
    this.on = true;
    (window as unknown as { __metrics: unknown }).__metrics = { ...this.api() };
    try {
      new PerformanceObserver((list) => {
        for (const e of list.getEntries()) if ('duration' in e && (e.entryType === 'event' || e.entryType === 'first-input')) this.state.inputToPaint.push(e.duration);
      }).observe({ type: 'event', durationThreshold: 16, buffered: true } as PerformanceObserverInit);
    } catch {
      /* Event Timing is not everywhere */
    }
    // the ambience opt-out: every switch of the pond's bed from on to off counts once
    try {
      const engine = getEngine();
      let ambOn = engine.settings.ambience > 0;
      this.state.ambienceIsOff = !ambOn;
      this.state.mutedNow = engine.settings.muted;
      engine.subscribe(() => {
        const on = engine.settings.ambience > 0;
        if (ambOn && !on) this.state.ambienceOff++;
        ambOn = on;
        this.state.ambienceIsOff = !on;
        this.state.mutedNow = engine.settings.muted;
      });
    } catch {
      /* no audio engine (a test): nothing to count */
    }
    let last = performance.now();
    const loop = (t: number): void => {
      this.state.frames.push(t - last);
      if (this.state.frames.length > 4000) this.state.frames.splice(0, 2000);
      last = t;
      this.frameRaf = requestAnimationFrame(loop);
    };
    this.frameRaf = requestAnimationFrame(loop);
    this.paint();
    setInterval(() => this.paint(), 1000);
  }

  private api() {
    return {
      get state() {
        return metrics.state;
      },
      report: () => this.report(),
      summary: () => this.summary(),
      reset: () => {
        this.state = empty();
      },
    };
  }

  summary() {
    const s = this.state;
    const fps = s.frames.length ? 1000 / (s.frames.reduce((a, b) => a + b, 0) / s.frames.length) : NaN;
    return {
      answerTime: { n: s.answerTimes.length, median: pct(s.answerTimes, 50), p90: pct(s.answerTimes, 90) },
      windows: { eligible: s.eligibleWindows, missed: s.missedWindows },
      tallyToPodium: { n: s.tallyToPodium.length, last: s.tallyToPodium[s.tallyToPodium.length - 1] ?? NaN },
      answerToRest: { n: s.answerToRest.length, p50: pct(s.answerToRest, 50), p95: pct(s.answerToRest, 95) },
      inputToPaint: { n: s.inputToPaint.length, p95: pct(s.inputToPaint, 95) },
      ambience: { turnedOff: s.ambienceOff, offNow: s.ambienceIsOff, muted: s.mutedNow },
      fps,
    };
  }

  report(): void {
    console.table(this.summary());
  }

  private paint(): void {
    if (typeof document === 'undefined') return;
    if (!this.overlay) {
      this.overlay = document.createElement('pre');
      this.overlay.setAttribute('data-metrics', '');
      this.overlay.style.cssText = 'position:fixed;left:4px;bottom:4px;z-index:500;margin:0;padding:4px 6px;font:10px/1.3 monospace;color:#efe2c8;background:rgba(23,18,14,.82);pointer-events:none;max-width:60vw';
      document.body.appendChild(this.overlay);
    }
    const m = this.summary();
    const f = (n: number): string => (Number.isFinite(n) ? String(Math.round(n)) : '-');
    this.overlay.textContent = `answer ${f(m.answerTime.median)}/${f(m.answerTime.p90)} ms (n${m.answerTime.n})  missed ${m.windows.missed}/${m.windows.eligible}\nrest p95 ${f(m.answerToRest.p95)} ms  input p95 ${f(m.inputToPaint.p95)} ms  ${f(m.fps)} fps\ntally0>podium ${f(m.tallyToPodium.last)} ms  ambience off x${m.ambience.turnedOff}${m.ambience.offNow ? ' (now)' : ''}${m.ambience.muted ? '  muted' : ''}`;
  }

  /* ---- fed by the presenter ---- */

  /** a new view: windows opening and closing on you, the tally reaching 0 */
  view(prevWindow: { key: string; answerOnMe: boolean; eligible: boolean; deadlineAt: number | null } | null, nextWindow: { key: string; answerOnMe: boolean; eligible: boolean; deadlineAt: number | null } | null, tally: { before: number | null; after: number }, now: number): void {
    if (!this.on) return;
    if (prevWindow && (!nextWindow || nextWindow.key !== prevWindow.key)) {
      if (prevWindow.eligible && !this.windowActed && this.windowKey === prevWindow.key && prevWindow.deadlineAt !== null && Date.now() >= this.windowDeadline - 600) this.state.missedWindows++;
      this.windowKey = null;
    }
    if (nextWindow && nextWindow.key !== this.windowKey && (!prevWindow || prevWindow.key !== nextWindow.key)) {
      this.windowKey = nextWindow.key;
      this.windowActed = false;
      this.windowDeadline = nextWindow.deadlineAt ?? 0;
      if (nextWindow.eligible) this.state.eligibleWindows++;
      if (nextWindow.answerOnMe) {
        this.answerOpenAt = now;
        this.answerKey = nextWindow.key;
      }
    }
    if (tally.before !== null && tally.before > 0 && tally.after === 0) this.tallyZeroAt = now;
  }

  /** you pressed something in the open window */
  pressed(now: number): void {
    if (!this.on) return;
    this.windowActed = true;
    if (this.answerOpenAt !== null && this.answerKey === this.windowKey) {
      this.state.answerTimes.push(now - this.answerOpenAt);
      this.answerOpenAt = null;
    }
  }

  /** the step that followed the answer has come to rest */
  atRest(now: number): void {
    if (!this.on || this.answerClosedAt === null) return;
    this.state.answerToRest.push(now - this.answerClosedAt);
    this.answerClosedAt = null;
  }

  /** the answer window has just left the view: the clock for answer-to-rest starts */
  answerLeft(now: number): void {
    if (!this.on) return;
    this.answerClosedAt = now;
    // the perf script measures the visual rest against this mark, independent of the presenter's own timers
    try {
      performance.mark('pescuit:answerLeft');
    } catch {
      /* no User Timing */
    }
  }

  step(kinds: string[], tableMs: number, queuedMs: number, now: number): void {
    if (!this.on) return;
    this.state.steps.push({ kinds, tableMs, queuedMs, at: now });
    if (this.state.steps.length > 400) this.state.steps.splice(0, 200);
  }

  podium(now: number): void {
    if (!this.on || this.tallyZeroAt === null) return;
    this.state.tallyToPodium.push(now - this.tallyZeroAt);
    this.tallyZeroAt = null;
  }
}

export const metrics = new Metrics();
