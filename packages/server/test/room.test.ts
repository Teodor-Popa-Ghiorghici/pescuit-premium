import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ServerMessage } from '@pescuit/shared';
import { bindAction } from '../src/bindAction.js';
import { FakeSocket, makeRoom } from './support.js';

type GameStateMsg = Extract<ServerMessage, { type: 'game_state' }>;
const lastState = (ws: FakeSocket) => ws.messages.filter((m): m is GameStateMsg => m.type === 'game_state').at(-1)!;

describe('action binding (§6.4)', () => {
  it('overwrites whatever playerId the client claimed', () => {
    const a = bindAction('me', { type: 'REQUEST', playerId: 'someone-else', targetId: 't', rank: 'herring' });
    expect(a).toMatchObject({ type: 'REQUEST', playerId: 'me' });
    expect(bindAction('me', { type: 'SKIP_WINDOW' })).toEqual({ type: 'SKIP_WINDOW', playerId: 'me' });
  });

  it('never takes entropy from a client: a Whale action gets the server\'s fresh bits', () => {
    const forged = { type: 'USE_WHALE', grantId: 'g', targetAId: 'a', targetBId: 'b', entropy: [0, 0, 0, 0] } as never;
    const a = bindAction('me', forged, () => [11, 22, 33, 44]) as { entropy: number[] };
    expect(a.entropy).toEqual([11, 22, 33, 44]);
    // and a non-whale action carries no entropy at all
    expect(JSON.stringify(bindAction('me', { type: 'REQUEST', targetId: 't', rank: 'herring', entropy: [1, 2, 3, 4] } as never))).not.toContain('entropy');
  });

  it('refuses the driver\'s own action type and anything unknown', () => {
    expect(() => bindAction('me', { type: 'SERVER_SKIP_WINDOW' } as never)).toThrow();
    expect(() => bindAction('me', { type: 'DROP_TABLE' } as never)).toThrow();
    expect(() => bindAction('me', null as never)).toThrow();
  });

  it('through the room: a client cannot ask, answer or skip in another player\'s name', () => {
    const { room } = makeRoom(3);
    room.start();
    const s = room.state!;
    const asker = s.players[s.currentPlayerIndex];
    const other = s.players.find((p) => p.id !== asker.id)!;
    const rank = asker.hand.find((c) => c.rank !== 'eggs')!.rank;
    // `other` claims to be the asker: the action is bound to `other`, who is not on turn
    expect(() => room.applyAction(other.id, { type: 'REQUEST', playerId: asker.id, targetId: other.id, rank })).toThrow();
    room.applyAction(asker.id, { type: 'REQUEST', targetId: other.id, rank });
    expect(room.state!.pendingWindow?.type).toBe('RESPONSE_PENDING');
    // the asker (or a bystander) cannot answer for the target, even claiming to be them
    const bystander = s.players.find((p) => p.id !== asker.id && p.id !== other.id)!;
    expect(() => room.applyAction(asker.id, { type: 'SKIP_WINDOW', playerId: other.id })).toThrow();
    expect(() => room.applyAction(bystander.id, { type: 'SKIP_WINDOW', playerId: other.id })).toThrow();
    expect(room.state!.pendingWindow?.type).toBe('RESPONSE_PENDING');
    room.applyAction(other.id, { type: 'SKIP_WINDOW' });
    expect(room.state!.pendingWindow?.type).not.toBe('RESPONSE_PENDING');
    room.dispose();
  });
});

describe('the window clock and timeouts (§3.10, §4.4)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  function toAnswerWindow(now: () => number) {
    const made = makeRoom(3, { now });
    made.room.start();
    const s = made.room.state!;
    const asker = s.players[s.currentPlayerIndex];
    const target = s.players.find((p) => p.id !== asker.id)!;
    const rank = asker.hand.find((c) => c.rank !== 'eggs')!.rank;
    made.room.applyAction(asker.id, { type: 'REQUEST', targetId: target.id, rank });
    return { ...made, asker, target };
  }

  it('the view carries the window deadline and the server clock', () => {
    vi.setSystemTime(1_000_000);
    const { room, sockets, target } = toAnswerWindow(() => Date.now());
    const idx = room.players.findIndex((p) => p.id === target.id);
    const view = lastState(sockets[idx]).view;
    expect(view.pendingWindow).toMatchObject({ type: 'RESPONSE_PENDING', youAreEligible: true });
    expect(view.serverNow).toBe(1_000_000);
    expect(view.pendingWindow!.deadlineAt).toBe(1_000_000 + room.state!.config.windowTimeoutMs);
    // every viewer sees the same deadline; only the target is eligible
    for (const ws of sockets) expect(lastState(ws).view.pendingWindow!.deadlineAt).toBe(view.pendingWindow!.deadlineAt);
    room.dispose();
  });

  it('the score clock (MUSIC_PLAN §7.3): startedAt, and room_update serverNow/createdAt, are identical for every viewer', () => {
    vi.setSystemTime(500_000);
    const made = makeRoom(4, { now: () => Date.now() });
    vi.setSystemTime(740_000);
    made.room.start();
    const ups = made.sockets.map((ws) => ws.messages.filter((m) => m.type === 'room_update').at(-1) as Extract<ServerMessage, { type: 'room_update' }>);
    for (const u of ups) expect(u).toMatchObject({ serverNow: 740_000, createdAt: 500_000, started: true });
    const views = made.sockets.map((ws) => lastState(ws).view);
    for (const v of views) expect(v.startedAt).toBe(740_000);
    // later views keep the same zero
    vi.setSystemTime(800_000);
    const s = made.room.state!;
    const asker = s.players[s.currentPlayerIndex];
    const target = s.players.find((p) => p.id !== asker.id)!;
    made.room.applyAction(asker.id, { type: 'REQUEST', targetId: target.id, rank: asker.hand.find((c) => c.rank !== 'eggs')!.rank });
    for (const ws of made.sockets) expect(lastState(ws).view).toMatchObject({ startedAt: 740_000, serverNow: 800_000 });
    made.room.dispose();
  });

  it('when nobody answers in time the server answers truthfully for them (an absent player, too)', () => {
    vi.setSystemTime(0);
    const { room, sockets, target } = toAnswerWindow(() => Date.now());
    room.disconnect(target.id);
    const before = room.seq;
    vi.advanceTimersByTime(room.state!.config.windowTimeoutMs + 1);
    expect(room.state!.pendingWindow?.type).not.toBe('RESPONSE_PENDING');
    expect(room.seq).toBeGreaterThan(before);
    const seen = sockets.filter((s) => s.readyState).flatMap((s) => s.messages.filter((m): m is GameStateMsg => m.type === 'game_state'));
    // the timeout is one ordinary answer: WINDOW_CLOSED(RESPONSE_PENDING) is on the wire
    expect(seen.some((m) => m.events.some((e) => e.type === 'WINDOW_CLOSED' && e.window === 'RESPONSE_PENDING'))).toBe(true);
    room.dispose();
  });

  it('answering in time cancels the timeout, and the next window gets a fresh deadline', () => {
    vi.setSystemTime(0);
    const { room, sockets, target } = toAnswerWindow(() => Date.now());
    vi.advanceTimersByTime(5_000);
    room.applyAction(target.id, { type: 'SKIP_WINDOW' });
    const after = room.seq;
    // (less than the next player's turn clock, which would make their ask for them)
    vi.advanceTimersByTime(room.turnTimeoutMs - 1_000);
    // no window is open now (a fail passes the turn), so nothing was skipped on anybody's behalf
    expect(room.seq).toBe(after);
    expect(lastState(sockets[0]).view.pendingWindow).toBeNull();
    room.dispose();
  });
});

describe('the turn clock and the rope (HAND_AND_TURN_PLAN #4-#5)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  /** a started room whose current player is awaiting their ask with no window open */
  function atRest() {
    vi.setSystemTime(2_000_000);
    const made = makeRoom(3, { now: () => Date.now() });
    made.room.start();
    // an opening TURN_START window (an active power in hand) is passed first
    while (made.room.state!.pendingWindow) made.room.applyAction(made.room.state!.pendingWindow.eligiblePlayerIds[0], { type: 'SKIP_WINDOW' });
    return made;
  }

  it('every viewer gets the same public clock while the player is awaiting their ask', () => {
    const { room, sockets } = atRest();
    const clocks = sockets.map((ws) => lastState(ws).view.turnClock);
    expect(clocks[0]).toMatchObject({ totalMs: room.turnTimeoutMs, ropeMs: room.ropeMs });
    expect(clocks[0]!.deadlineAt).toBe(room.turnDeadlineAt);
    for (const c of clocks) expect(c).toEqual(clocks[0]);
    room.dispose();
  });

  it('when the clock runs out the room makes a legal ask for the player (an absent player, too)', () => {
    const { room, sockets } = atRest();
    const s = room.state!;
    const asker = s.players[s.currentPlayerIndex];
    room.disconnect(asker.id);
    vi.advanceTimersByTime(room.turnTimeoutMs - 1);
    expect(room.state!.resume.kind).toBe('AWAIT_REQUEST');
    vi.advanceTimersByTime(2);
    const seen = sockets.flatMap((ws) => ws.messages.filter((m): m is GameStateMsg => m.type === 'game_state'));
    const made = seen.flatMap((m) => m.events).find((e) => e.type === 'REQUEST_MADE');
    expect(made).toMatchObject({ type: 'REQUEST_MADE', askerId: asker.id });
    room.dispose();
  });

  it('a window pauses the clock and it resumes with what was left; laying a set does not restart it', () => {
    const { room } = atRest();
    const first = room.turnDeadlineAt!;
    vi.advanceTimersByTime(10_000);
    // a lay that changes nothing about the ask keeps the same deadline: re-publish the same state
    (room as unknown as { publish(e: unknown[]): void }).publish([]);
    expect(room.turnDeadlineAt).toBe(first);
    // a window opens: the clock is off the view, and comes back with the 35 s that were left
    const s = room.state!;
    (s as { pendingWindow: unknown }).pendingWindow = { type: 'SET_COMPLETED', eligiblePlayerIds: [s.players[0].id], context: {} };
    (room as unknown as { publish(e: unknown[]): void }).publish([]);
    expect(room.turnDeadlineAt).toBeNull();
    vi.advanceTimersByTime(8_000);
    (s as { pendingWindow: unknown }).pendingWindow = null;
    (room as unknown as { publish(e: unknown[]): void }).publish([]);
    expect(room.turnDeadlineAt).toBe(Date.now() + room.turnTimeoutMs - 10_000);
    room.dispose();
  });

  it('a new ask (a bonus turn, or the next player) gets a full allowance', () => {
    const { room } = atRest();
    vi.advanceTimersByTime(20_000);
    const s = room.state!;
    const asker = s.players[s.currentPlayerIndex];
    const target = s.players.find((p) => p.id !== asker.id)!;
    room.applyAction(asker.id, { type: 'REQUEST', targetId: target.id, rank: asker.hand.find((c) => c.rank !== 'eggs')!.rank });
    expect(room.turnDeadlineAt).toBeNull(); // the answer window has the floor
    while (room.state!.pendingWindow) room.applyAction(room.state!.pendingWindow.eligiblePlayerIds[0], { type: 'SKIP_WINDOW' });
    if (room.state!.status === 'IN_PROGRESS' && room.state!.resume.kind === 'AWAIT_REQUEST') expect(room.turnDeadlineAt).toBe(Date.now() + room.turnTimeoutMs);
    room.dispose();
  });
});

describe('reconnection (§4.6, A15)', () => {
  it('a rejoin gets the current view and its seq as a snapshot, with no events to replay', () => {
    const { room, sockets } = makeRoom(3);
    room.start();
    const s = room.state!;
    const asker = s.players[s.currentPlayerIndex];
    const target = s.players.find((p) => p.id !== asker.id)!;
    room.applyAction(asker.id, { type: 'REQUEST', targetId: target.id, rank: asker.hand.find((c) => c.rank !== 'eggs')!.rank });
    const p0 = room.players[0];
    expect(room.disconnect(p0.id, sockets[0] as never)).toBe(true);

    const fresh = new FakeSocket();
    room.rejoin(p0.token, fresh as never);
    room.broadcastState([], p0.id);
    const m = lastState(fresh);
    expect(m.snapshot).toBe(true);
    expect(m.events).toEqual([]);
    expect(m.view.seq).toBe(room.seq);
    expect(m.view.pendingWindow?.type).toBe('RESPONSE_PENDING');
    // the others got a plain view (their copy of p0's `connected` flag changed) with no snapshot flag
    expect(lastState(sockets[1]).snapshot).toBeUndefined();
    room.dispose();
  });

  it('a stale socket closing after the player has rejoined does not mark them absent', () => {
    const { room, sockets } = makeRoom(3);
    room.start();
    const p0 = room.players[0];
    const fresh = new FakeSocket();
    room.rejoin(p0.token, fresh as never);
    expect(room.disconnect(p0.id, sockets[0] as never)).toBe(false);
    expect(p0.connected).toBe(true);
    expect(room.state!.players.find((p) => p.id === p0.id)!.connected).toBe(true);
    expect(room.disconnect(p0.id, fresh as never)).toBe(true);
    room.dispose();
  });
});
