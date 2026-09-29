/* The metrics facade (§9.1, §9.2). The presenter calls this on every step; it does nothing - and the real
 * module (`metricsImpl.ts`, ~4 KB of playtest read-outs) is never downloaded - unless the URL says `?metrics=1`
 * or the perf script sets `window.__perf`. When it does, the calls made while the module is loading are replayed
 * in order, so nothing is lost. Keeping it out of the first load is part of the 125 KB budget (DECISIONS.md). */

type Impl = (typeof import('./metricsImpl.js'))['metrics'];

const enabled = (): boolean => {
  try {
    return typeof location !== 'undefined' && (new URLSearchParams(location.search).get('metrics') === '1' || (window as unknown as { __perf?: boolean }).__perf === true);
  } catch {
    return false;
  }
};

class LazyMetrics {
  private impl: Impl | null = null;
  private loading = false;
  private queue: Array<(m: Impl) => void> = [];

  private run(f: (m: Impl) => void): void {
    if (this.impl) f(this.impl);
    else if (this.loading) this.queue.push(f);
  }

  init(): void {
    if (this.impl || this.loading || !enabled()) return;
    this.loading = true;
    void import('./metricsImpl.js').then(({ metrics }) => {
      metrics.init();
      this.impl = metrics;
      for (const f of this.queue.splice(0)) f(metrics);
    });
  }

  view(...a: Parameters<Impl['view']>): void {
    this.run((m) => m.view(...a));
  }
  pressed(now: number): void {
    this.run((m) => m.pressed(now));
  }
  atRest(now: number): void {
    this.run((m) => m.atRest(now));
  }
  answerLeft(now: number): void {
    this.run((m) => m.answerLeft(now));
  }
  step(...a: Parameters<Impl['step']>): void {
    this.run((m) => m.step(...a));
  }
  podium(now: number): void {
    this.run((m) => m.podium(now));
  }
}

export const metrics = new LazyMetrics();
