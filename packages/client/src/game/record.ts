/* The adapter between what the wire carries and what the pure functions read (§3.2, §4.2).
 *
 * `publicViewOf` keeps only what a spectator holding no cards could see of a view: the turn order,
 * whose turn it is, the pool, the answer window's two named players, the public tally and gate, the
 * laid sets' public faces and every hand's size. It never reads the hand, an eligibility flag, a
 * grant, a window's context beyond the two players named aloud, or a card id. `recordOf` pairs two
 * of them with the events that arrived (which only label the diff). `factsOf` is where the viewer's
 * own seat enters: public facts (their id), and the private ones that may steer only the private
 * tier (eligibility, the rank of their own grant), gated by headphones mode inside cuesFor.
 *
 * The client imports PublicEvent and nothing else from the engine's event types.
 */
import type { PublicEvent as WireEventBody, RedactedView } from '@pescuit/engine';
import { chainAfter, type PowerMode, type PublicEvent, type PublicRecord, type PublicView, type SeatFacts } from '../audio/cues.js';

type Ctx = Record<string, unknown>;
const str = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined);

export function publicViewOf(v: RedactedView): PublicView {
  const w = v.pendingWindow;
  const ctx = (w?.context ?? {}) as Ctx;
  const handSizes: Record<string, number> = {};
  const scores: Record<string, number> = {};
  for (const p of v.players) {
    handSizes[p.id] = p.handSize;
    scores[p.id] = p.score;
  }
  return {
    players: v.turnOrder,
    currentPlayerId: v.currentPlayerId,
    poolCount: v.poolCount,
    window: w ? { type: w.type, askerId: str(ctx.askerId), targetId: str(ctx.targetId), ...(w.deadlineAt != null ? { deadlineAt: w.deadlineAt } : {}) } : null,
    setsPossible: v.sets.possible,
    endPressure: v.endPressure,
    laidSets: v.laidSets.map((s) => ({ id: s.id, ownerId: s.ownerId, isPowerSet: s.isPowerSet, rank: s.rank, cardCount: s.cardCount, spent: s.spent, destroyed: s.destroyedByMantis })),
    handSizes,
    scores,
    ended: v.status === 'ENDED',
  };
}

/** The events of one message as the pure functions read them. A destroyed set's owner is public in the
 * view that came before it; the event itself does not carry it. */
export function publicEventsOf(events: readonly WireEventBody[], before: PublicView | null): PublicEvent[] {
  // The engine emits no POWER_USED for a Squid, ever (the server would be leaking); if one somehow arrived, the picture and the
  // sound would both have to stay silent, and the simplest way to keep both silent is that nothing downstream ever sees it.
  return events.filter((e) => !(e.type === 'POWER_USED' && e.rank === 'squid')).map((e) => {
    if (e.type === 'SET_DESTROYED') {
      const owner = before?.laidSets?.find((s) => s.id === e.setId)?.ownerId;
      return (owner ? { ...e, ownerId: owner } : e) as PublicEvent;
    }
    return e as unknown as PublicEvent;
  });
}

/** `chain` is the run of bonus turns before this step; the record carries the run after it (public: BONUS_TURN is an event everyone gets) */
export function recordOf(prev: RedactedView | null, next: RedactedView, events: readonly WireEventBody[], seq: number, chain = 0, ordinal = 0): PublicRecord {
  const before = prev ? publicViewOf(prev) : null;
  const pub = publicEventsOf(events, before);
  return { seq, mode: next.config.powerVisibility as PowerMode, before, after: publicViewOf(next), events: pub, chain: chainAfter(chain, pub), ordinal };
}

export interface FactOptions {
  headphones: boolean;
  /** this device already played `clock.close` at the answering press (§3.2) */
  closePlayedLocally?: boolean;
}

export function factsOf(prev: RedactedView | null, next: RedactedView, playerId: string, o: FactOptions): SeatFacts {
  const grants = next.ownPowerGrants ?? [];
  return {
    playerId,
    headphones: o.headphones,
    closePlayedLocally: !!o.closePlayedLocally,
    eligible: !!next.pendingWindow?.youAreEligible,
    eligibleBefore: !!prev?.pendingWindow?.youAreEligible,
    grantRank: (id) => grants.find((g) => g.id === id)?.rank,
  };
}
