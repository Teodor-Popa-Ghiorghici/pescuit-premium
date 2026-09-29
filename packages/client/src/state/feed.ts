/* The store's event feed as pure functions (§4.2): which events of a `game_state` are new, and what the
 * log keeps. Presentation is SEQ-based: every event newer than the last one applied is handed to the
 * presenter, whatever the log holds. `MAX_EVENTS` trims the log (the drawer), never what is presented -
 * a long game does not stop presenting at its 301st event. */
import type { WireEvent } from '@pescuit/shared';

export const MAX_EVENTS = 300;
const MAX_AWAY = 8;

/** the events with `afterSeq < seq <= upToSeq` were not presented: they are in the log, under a divider */
export interface AwayMark {
  afterSeq: number;
  upToSeq: number;
}

export interface FeedMessage {
  events: readonly WireEvent[];
  snapshot?: boolean;
  view: { seq: number };
}

export interface Fresh {
  /** the events to present, in order: only those newer than what was applied */
  fresh: WireEvent[];
  /** the highest seq applied after this message */
  lastSeq: number;
  seenBefore: number;
  /** the log gains a "while you were away" divider up to here (0: none) */
  gapTo: number;
  snapshot: boolean;
}

/** a resent or replayed event is never applied twice; a rejoin (snapshot) or a hidden tab presents nothing but logs the gap */
export function takeFresh(lastSeq: number, msg: FeedMessage, hidden: boolean): Fresh {
  const fresh = msg.events.filter((e) => e.seq > lastSeq);
  let next = lastSeq;
  for (const e of fresh) next = Math.max(next, e.seq);
  const snapshot = !!msg.snapshot;
  const gapTo = snapshot ? Math.max(next, msg.view.seq) : hidden && fresh.length ? next : 0;
  if (snapshot) next = Math.max(next, msg.view.seq);
  return { fresh, lastSeq: next, seenBefore: lastSeq, gapTo, snapshot };
}

/** the log after a message: the cap trims the oldest lines only */
export function appendLog(events: WireEvent[], away: AwayMark[], t: Fresh): { events: WireEvent[]; away: AwayMark[] } {
  return {
    events: t.fresh.length ? [...events, ...t.fresh].slice(-MAX_EVENTS) : events,
    away: t.gapTo > t.seenBefore && t.seenBefore > 0 ? [...away, { afterSeq: t.seenBefore, upToSeq: t.gapTo }].slice(-MAX_AWAY) : away,
  };
}
