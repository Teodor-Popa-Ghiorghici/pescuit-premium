import { afterEach, describe, expect, it, vi } from 'vitest';
import { CLOCK_T_MS, ServerClock, WindowClock, tickPlan } from '../src/audio/clock.js';

describe('the window clock (§3.10)', () => {
  it('is silent until T = 5 s remain, clicks each second, then double clicks every 500 ms in the last 3 s', () => {
    expect(CLOCK_T_MS).toBe(5000);
    const plan = tickPlan(12000);
    expect(plan.map((t) => [t.remaining, t.id])).toEqual([
      [5000, 'clock.tick'], [4000, 'clock.tick'],
      [3000, 'clock.tick.urgent'], [2500, 'clock.tick.urgent'], [2000, 'clock.tick.urgent'], [1500, 'clock.tick.urgent'], [1000, 'clock.tick.urgent'], [500, 'clock.tick.urgent'],
    ]);
    expect(plan[0].inMs).toBe(7000); // silence for the first 7 s of a 12 s window
    expect(plan.every((t) => t.remaining <= CLOCK_T_MS)).toBe(true);
  });
  it('a window that opens late ticks only for what is left; one shorter than 3 s only urgent clicks', () => {
    expect(tickPlan(4200).map((t) => t.remaining)).toEqual([4000, 3000, 2500, 2000, 1500, 1000, 500]);
    expect(tickPlan(1200).map((t) => t.id)).toEqual(['clock.tick.urgent', 'clock.tick.urgent']);
    expect(tickPlan(0)).toEqual([]);
  });
  it('T is settable (re-set from playtest 1)', () => {
    expect(tickPlan(12000, 7000).slice(0, 2).map((t) => t.remaining)).toEqual([7000, 6000]);
  });
});

describe('the server clock', () => {
  it('takes the minimum of the last five samples, corrected by half the round trip', () => {
    const c = new ServerClock();
    for (const s of [120, 90, 100, 95, 110]) c.sample(1000 + s, 1000);
    expect(c.offset()).toBe(90);
    c.setRtt(60);
    expect(c.offset()).toBe(120);
    c.sample(1200, 1000); // the oldest (120) falls out; 200 comes in; the minimum is still 90
    expect(c.offset()).toBe(120);
    for (const s of [500, 500, 500, 500, 500]) c.sample(1000 + s, 1000);
    expect(c.offset()).toBe(530);
    expect(c.serverNow(2000)).toBe(2530);
  });
  it('is zero before any sample', () => expect(new ServerClock().offset()).toBe(0));
});

describe('WindowClock', () => {
  afterEach(() => vi.useRealTimers());
  it('emits each tick once, when it falls inside the 100 ms horizon, bound to the server deadline', () => {
    vi.useFakeTimers();
    let local = 1_000_000;
    const server = new ServerClock();
    server.sample(local + 500, local); // the server is 500 ms ahead of us
    const emitted: Array<[string, number, number]> = [];
    const wc = new WindowClock({ now: () => local, server, emit: (id, inMs) => emitted.push([id, Math.round(inMs), Math.round(local)]) });
    const deadlineAt = local + 500 + 12_000; // 12 s left on the server's clock
    wc.start(deadlineAt);
    for (let i = 0; i < 12_000 / 25 + 10; i++) {
      local += 25;
      vi.advanceTimersByTime(25);
    }
    expect(emitted.map((e) => e[0])).toEqual(['clock.tick', 'clock.tick', ...Array(6).fill('clock.tick.urgent')]);
    // each is due at its remaining value against the SERVER deadline: emitted within the horizon before it
    const dueAt = (remaining: number) => deadlineAt - 500 - remaining;
    const expected = [5000, 4000, 3000, 2500, 2000, 1500, 1000, 500].map(dueAt);
    emitted.forEach(([, inMs, at], i) => {
      expect(at + inMs).toBeGreaterThanOrEqual(expected[i] - 1);
      expect(at + inMs).toBeLessThanOrEqual(expected[i] + 25);
      expect(inMs).toBeLessThanOrEqual(100);
    });
    expect(wc.running).toBe(false); // it stops itself after the deadline
  });
  it('stop() silences it; a second start with the same key does not restart', () => {
    vi.useFakeTimers();
    const local = 0;
    const emitted: string[] = [];
    const wc = new WindowClock({ now: () => local, server: new ServerClock(), emit: (id) => emitted.push(id) });
    wc.start(30_000, 'k');
    wc.start(30_000, 'k');
    expect(wc.running).toBe(true);
    wc.stop();
    vi.advanceTimersByTime(5000);
    expect(emitted).toEqual([]);
  });
});
