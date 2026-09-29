/* The hand as the table draws it (§5.3): sorted by category (powers, normal, eggs) then rank;
 * duplicates share a group; a set that can be laid is tied with a rope and carries the eggs that
 * complete it. Pure, so the layout arithmetic is testable without a browser. */
import type { Card, Rank } from '@pescuit/engine';
import { EGGS, NORMAL_RANKS, POWER_RANKS } from '@pescuit/engine';
import { findLayableSets, type LayableSet } from './layable.js';

export interface HandGroup {
  /** stable across renders while the cards stay: the rank and the first card's id */
  key: string;
  rank: Rank;
  cards: Card[];
  /** set when this group is a set that can be laid now; `cardIds` is what LAY_SET should carry */
  layable: { rank: Rank; cardIds: string[]; eggCount: number } | null;
}

const ORDER: Rank[] = [...POWER_RANKS, ...NORMAL_RANKS, EGGS];

export function rankIndex(rank: Rank): number {
  return ORDER.indexOf(rank);
}

/** Groups the hand: layable sets first claim their cards (with the eggs that complete them), and
 *  what is left groups by rank. */
export function buildGroups(hand: readonly Card[]): HandGroup[] {
  const used = new Set<string>();
  const groups: HandGroup[] = [];
  const eggs = hand.filter((c) => c.rank === EGGS);
  const byId = new Map(hand.map((c) => [c.id, c]));

  const sets: LayableSet[] = findLayableSets(hand as Card[]);
  sets.sort((a, b) => rankIndex(a.rank) - rankIndex(b.rank));
  for (const set of sets) {
    let cards: Card[];
    let cardIds = set.cardIds;
    if (set.rank === EGGS) {
      cards = set.cardIds.map((id) => byId.get(id)!).filter((c) => !used.has(c.id));
      if (cards.length !== set.cardIds.length) continue; // its eggs went into another set
    } else {
      const reals = set.cardIds.map((id) => byId.get(id)!).filter((c) => c.rank !== EGGS);
      if (reals.some((c) => used.has(c.id))) continue;
      const free = eggs.filter((c) => !used.has(c.id)).slice(0, set.eggCount);
      // the eggs drawn beside the set are the ones the lay will spend, when there are enough of them
      if (free.length === set.eggCount) cardIds = [...reals.map((c) => c.id), ...free.map((c) => c.id)];
      cards = [...reals, ...free];
    }
    for (const c of cards) used.add(c.id);
    groups.push({ key: `L${set.rank}:${cards[0].id}`, rank: set.rank, cards, layable: { rank: set.rank, cardIds, eggCount: set.eggCount } });
  }

  const rest = new Map<Rank, Card[]>();
  for (const c of hand) {
    if (used.has(c.id)) continue;
    const list = rest.get(c.rank) ?? [];
    list.push(c);
    rest.set(c.rank, list);
  }
  for (const [rank, cards] of rest) groups.push({ key: `${rank}:${cards[0].id}`, rank, cards, layable: null });

  // rank order; within a rank the set that can be laid comes first
  groups.sort((a, b) => rankIndex(a.rank) - rankIndex(b.rank) || Number(!!b.layable) - Number(!!a.layable));
  return groups;
}

export interface HandLayout {
  /** the step between two cards of one group: 25 % of the card's width */
  inStep: number;
  /** the step between the left edges of two groups */
  gStep: number;
  /** the row's natural width; when it exceeds the room the dock scrolls sideways with snap */
  width: number;
  scrolls: boolean;
  /** the x of each group's left edge */
  lefts: number[];
}

/**
 * §5.3. Inside a group the step is 25 % of the card's width, which keeps the index strip clear. The
 * step between groups is computed from the room available, up to 60 % of the width; it never drops
 * below 30 %, the least that leaves each card's corner index uncovered - past that the dock
 * scrolls (with snap): with 104-px cards that is past eight groups at 360 px.
 */
export function layoutHand(groups: readonly HandGroup[], cardW: number, avail: number): HandLayout {
  const inStep = Math.round(cardW * 0.25);
  const extra = groups.reduce((s, g) => s + (g.cards.length - 1) * inStep, 0);
  const n = groups.length;
  const min = Math.round(cardW * 0.3);
  const max = Math.round(cardW * 0.6);
  let gStep = n > 1 ? Math.floor((avail - cardW - extra) / (n - 1)) : max;
  gStep = Math.max(min, Math.min(max, gStep));
  const lefts: number[] = [];
  let x = 0;
  for (const g of groups) {
    lefts.push(x);
    x += Math.max(gStep, 0) + (g.cards.length - 1) * inStep;
  }
  // the last group ends a full card after its left edge (plus its own inner steps, already added above)
  const width = n === 0 ? 0 : x - gStep + cardW;
  return { inStep, gStep, width, scrolls: width > avail + 0.5, lefts };
}
