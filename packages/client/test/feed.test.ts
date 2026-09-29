// The store's event feed and the presentation adapter under a long game: presentation is seq-based, and the
// log's 300-event cap only trims the log. A game that runs past its 300th event must keep presenting.
import { createGame, makeBotRng, nextBotAction, redactEventsForPlayer, redactForPlayer, reduce, type GameEvent, type RedactedView } from '@pescuit/engine';
import type { ServerMessage, WireEvent } from '@pescuit/shared';
import { describe, expect, it } from 'vitest';
import { cuesFor } from '../src/audio/cues.js';
import { choreograph, DEFAULT_OPTIONS } from '../src/game/choreography.js';
import { factsOf, recordOf } from '../src/game/record.js';
import { appendLog, MAX_EVENTS, takeFresh, type AwayMark } from '../src/state/feed.js';

type GameStateMsg = Extract<ServerMessage, { type: 'game_state' }>;

/** real bot games, one server message per action, exactly as the room would send it to `viewer`; games follow one
 * another (as rematches in one room would) with `seq` running on, until there are `minEvents` events */
function messages(viewer: string, minEvents: number): GameStateMsg[] {
  const out: GameStateMsg[] = [];
  let seq = 0;
  for (let seed = 1; seq < minEvents && seed < 200; seed++) {
    const ids = ['p0', 'p1', 'p2', 'p3'];
    let { state, events: first } = createGame(ids.map((id) => ({ id, name: id })), seed);
    const rng = makeBotRng(seed);
    const push = (events: GameEvent[]) => {
      const stamped = events.map((e) => ({ ...e, seq: ++seq })) as (GameEvent & { seq: number })[];
      const view = redactForPlayer(state, viewer, { seq, serverNow: 1000 + seq, windowDeadlineAt: state.pendingWindow ? 1e9 : null });
      out.push({ type: 'game_state', view, events: redactEventsForPlayer(state, stamped, viewer) as unknown as WireEvent[] });
    };
    push(first);
    for (let i = 0; i < 5000 && state.status === 'IN_PROGRESS'; i++) {
      const action = nextBotAction(state, rng);
      if (!action) break;
      const r = reduce(state, action);
      state = r.state;
      push(r.events);
    }
  }
  if (seq < minEvents) throw new Error(`only ${seq} events`);
  return out;
}

describe('the event feed, seq-based (§4.2)', () => {
  it('a real game of more than 1,000 events: every event is presented, the log keeps only the last 300', () => {
    const msgs = messages("p0", 1000);
    let lastSeq = 0;
    let log: WireEvent[] = [];
    let away: AwayMark[] = [];
    let presented = 0;
    let delivered = 0;
    let prev: RedactedView | null = null;
    let turnBeats = 0;
    let expectedTurns = 0;
    let cues = 0;
    const seen: number[] = [];
    for (const msg of msgs) {
      delivered += msg.events.length;
      const t = takeFresh(lastSeq, msg, false);
      lastSeq = t.lastSeq;
      // what the presenter is handed is what arrived: nothing dropped by the log's cap
      expect(t.fresh).toEqual(msg.events);
      presented += t.fresh.length;
      seen.push(...t.fresh.map((e) => e.seq));
      ({ events: log, away } = appendLog(log, away, t));
      // and the adapter: the record and the choreography read every one of them
      const record = recordOf(prev, msg.view, t.fresh, msg.view.seq);
      expect(record.events).toHaveLength(t.fresh.length);
      const ch = choreograph(record, factsOf(prev, msg.view, 'p0', { headphones: false }), DEFAULT_OPTIONS);
      cues += cuesFor(record, factsOf(prev, msg.view, 'p0', { headphones: false })).length;
      const bonus = new Set(t.fresh.filter((e) => e.type === 'BONUS_TURN').map((e) => (e as { playerId: string }).playerId));
      expectedTurns += t.fresh.filter((e) => e.type === 'TURN_SKIPPED_STUNNED' || (e.type === 'TURN_STARTED' && !bonus.has(e.playerId))).length;
      turnBeats += ch.beats.filter((b) => b.kind === 'turn' || b.kind === 'skip').length;
      prev = msg.view;
    }
    expect(delivered).toBeGreaterThan(MAX_EVENTS * 3);
    expect(presented).toBe(delivered); // the cap trims the log, never what is presented
    expect(seen).toEqual([...seen].sort((a, b) => a - b)); // in order, each once
    expect(new Set(seen).size).toBe(seen.length);
    expect(lastSeq).toBe(seen[seen.length - 1]);
    expect(turnBeats).toBe(expectedTurns); // the totem still moves at event 1,000
    expect(expectedTurns).toBeGreaterThan(MAX_EVENTS / 4);
    expect(cues).toBeGreaterThan(0);
    expect(log).toHaveLength(MAX_EVENTS);
    expect(log[log.length - 1].seq).toBe(lastSeq); // the log keeps the newest
    expect(away).toEqual([]);
  });

  it('events already applied are never applied twice, even when a message resends them past the cap', () => {
    const msgs = messages('p1', 400);
    let lastSeq = 0;
    let presented = 0;
    for (const msg of msgs) {
      const t = takeFresh(lastSeq, msg, false);
      lastSeq = t.lastSeq;
      presented += t.fresh.length;
      // the same message delivered again presents nothing
      expect(takeFresh(lastSeq, msg, false).fresh).toEqual([]);
    }
    expect(presented).toBe(msgs.reduce((n, m) => n + m.events.length, 0)); // gaps in seq are events that are not this viewer's to see
    expect(presented).toBeGreaterThan(MAX_EVENTS);
  });

  it('a rejoin presents nothing and leaves a divider; a hidden tab logs the gap; the cap still applies', () => {
    const msgs = messages('p0', 350);
    const last = msgs[msgs.length - 1];
    const snap = takeFresh(5, { ...last, events: [], snapshot: true }, false);
    expect(snap.fresh).toEqual([]);
    expect(snap.snapshot).toBe(true);
    expect(snap.lastSeq).toBe(last.view.seq);
    expect(appendLog([], [], snap).away).toEqual([{ afterSeq: 5, upToSeq: last.view.seq }]);
    const hidden = takeFresh(0, msgs[1], true);
    expect(hidden.fresh.length).toBeGreaterThan(0);
    expect(hidden.gapTo).toBe(hidden.lastSeq);
    expect(appendLog([], [], hidden).away).toEqual([]); // nothing seen before: no divider
    const later = takeFresh(msgs[0].view.seq, msgs[1], true);
    expect(appendLog([], [], later).away).toEqual([{ afterSeq: msgs[0].view.seq, upToSeq: later.lastSeq }]);
  });
});
