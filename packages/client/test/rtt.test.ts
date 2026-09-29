import type { ClientMessage, ServerMessage } from '@pescuit/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ServerClock } from '../src/audio/clock.js';
import { PING_EVERY_MS, RttProbe } from '../src/net/rtt.js';

describe('the ping round trip (§3.10, A14)', () => {
  afterEach(() => vi.useRealTimers());

  it('pings on demand and every 5 s, and each pong sets the ServerClock\'s round trip', () => {
    vi.useFakeTimers();
    let now = 10_000;
    const sent: ClientMessage[] = [];
    const clock = new ServerClock();
    clock.sample(10_500, 10_000); // the server is 500 ms ahead
    const probe = new RttProbe({ send: (m) => sent.push(m), now: () => now, onRtt: (ms) => clock.setRtt(ms) });
    expect(PING_EVERY_MS).toBe(5000);

    probe.ping(); // on open
    expect(sent).toEqual([{ type: 'ping', t: 10_000 }]);
    now += 80;
    probe.onMessage({ type: 'pong', t: 10_000 });
    expect(clock.offset()).toBe(500 + 40); // half the 80 ms round trip

    probe.start();
    now += 5000;
    vi.advanceTimersByTime(5000);
    expect(sent).toHaveLength(2);
    expect(sent[1]).toMatchObject({ type: 'ping', t: now });
    now += 30;
    probe.onMessage({ type: 'pong', t: sent[1].type === 'ping' ? sent[1].t : 0 });
    expect(clock.offset()).toBe(500 + 15);

    now += 5000;
    vi.advanceTimersByTime(5000);
    expect(sent).toHaveLength(3);
    probe.stop();
    vi.advanceTimersByTime(20_000);
    expect(sent).toHaveLength(3); // stopped
  });

  it('ignores other messages, and measures a pong without an echo against the last ping', () => {
    let now = 0;
    const got: number[] = [];
    const probe = new RttProbe({ send: () => {}, now: () => now, onRtt: (ms) => got.push(ms) });
    probe.onMessage({ type: 'pong' }); // nothing sent yet: nothing to measure
    probe.onMessage({ type: 'room_closed', reason: 'x' } as ServerMessage);
    expect(got).toEqual([]);
    now = 100;
    probe.ping();
    now = 160;
    probe.onMessage({ type: 'pong' });
    expect(got).toEqual([60]);
    probe.onMessage({ type: 'pong', t: 1e9 }); // an echo from the future is not a measurement
    expect(got).toEqual([60]);
  });
});
