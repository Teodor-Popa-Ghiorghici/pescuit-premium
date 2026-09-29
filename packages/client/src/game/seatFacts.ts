/* What the table can say about a seat, read only from the redacted view. */
import type { Rank, RedactedView } from '@pescuit/engine';

export interface SeatFacts {
  /** power sets not yet used (hidden or face up): the filled diamonds */
  unused: number;
  /** power sets used or destroyed: the open diamonds */
  used: number;
  /** ranks of the power sets that are face up and unused (Mode Deschis), for the sheet */
  faceUpUnused: Rank[];
}

export function seatFacts(view: RedactedView, playerId: string): SeatFacts {
  let unused = 0;
  let used = 0;
  const faceUpUnused: Rank[] = [];
  for (const s of view.laidSets) {
    if (s.ownerId !== playerId || !s.isPowerSet) continue;
    if (s.spent || s.destroyedByMantis) used++;
    else {
      unused++;
      if (s.rank) faceUpUnused.push(s.rank);
    }
  }
  return { unused, used, faceUpUnused };
}

/** Opponents in turn order starting after `me`, so the next to act stands leftmost. */
export function opponentsInOrder(view: RedactedView, me: string) {
  const order = view.turnOrder;
  const at = Math.max(0, order.indexOf(me));
  const ids = [...order.slice(at + 1), ...order.slice(0, at)];
  return ids.map((id) => view.players.find((p) => p.id === id)!).filter(Boolean);
}

/** The first word of a long name: what fits a 60-px chip. The full name is on the sheet and in the drawer. */
export function shortName(name: string): string {
  return name.length <= 8 ? name : (name.split(/[\s-]/)[0] ?? name);
}
