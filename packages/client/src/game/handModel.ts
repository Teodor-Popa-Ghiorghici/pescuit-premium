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
  /** the fan (HAND_AND_TURN_PLAN #2): each group's tilt in degrees and its sink along the arc in px; flat when it scrolls */
  tilts: number[];
  sinks: number[];
}

/** the fan's limits: the outermost group tilts this far, and the arc drops it this far below the middle one */
export const FAN_MAX_TILT = 7;
export const FAN_MAX_SINK = 8;
export interface FanShape {
  tilt: number;
  sink: number;
}
/** the desktop's held hand */
export const FAN_FULL: FanShape = { tilt: FAN_MAX_TILT, sink: FAN_MAX_SINK };
/** the phone's dock has no room for an arc: a gentle tilt only */
export const FAN_PHONE: FanShape = { tilt: 4, sink: 0 };

const rad = (deg: number) => (deg * Math.PI) / 180;

/** how far a card of `w` x `h` tilted by `deg` about its centre reaches past its own box: sideways and downwards, px */
export function tiltReach(w: number, h: number, deg: number): { x: number; y: number } {
  const t = rad(Math.abs(deg));
  return { x: (w / 2) * Math.cos(t) + (h / 2) * Math.sin(t) - w / 2, y: (w / 2) * Math.sin(t) + (h / 2) * Math.cos(t) - h / 2 };
}

/**
 * The fan, as a held hand (HAND_AND_TURN_PLAN #2): each group turns about its centre away from the middle, and the
 * groups follow an arc - the middle highest. The arc is lifted so that the lowest tilted corner sits on the row's
 * baseline: the fan never reaches below the hand. A few groups barely fan; the full tilt is reached at seven. A hand
 * that scrolls sideways lies flat (a tilted card would ride over its neighbour while it scrolls).
 */
export function fanOf(n: number, flat: boolean, shape: FanShape = FAN_FULL, card = { w: 132, h: 198 }): { tilts: number[]; sinks: number[] } {
  if (flat || n <= 1) return { tilts: Array(n).fill(0), sinks: Array(n).fill(0) };
  const k = Math.min(1, (n - 1) / 6);
  const tilts: number[] = [];
  const arc: number[] = [];
  for (let i = 0; i < n; i++) {
    const u = (i - (n - 1) / 2) / ((n - 1) / 2);
    tilts.push(Math.round(u * shape.tilt * k * 10) / 10 || 0);
    arc.push(u * u * shape.sink * k);
  }
  const lowest = Math.max(...arc.map((y, i) => y + tiltReach(card.w, card.h, tilts[i]).y));
  return { tilts, sinks: arc.map((y) => Math.round(y - lowest)) };
}

export function layoutHand(groups: readonly HandGroup[], cardW: number, avail: number, fan: FanShape = FAN_FULL): HandLayout {
  // the outermost cards' tilted corners need room at both ends of the row; where that room would make the dock scroll,
  // the hand lies flat instead (eight groups still fit at 360 px, §5.3)
  const margin = Math.ceil(tiltReach(cardW, cardW * 1.5, fan.tilt).x);
  const fanned = rowOf(groups, cardW, avail - 2 * margin);
  if (!fanned.scrolls && groups.length > 1 && fan.tilt > 0) return { ...fanned, ...fanOf(groups.length, false, fan, { w: cardW, h: cardW * 1.5 }) };
  const flat = rowOf(groups, cardW, avail);
  return { ...flat, ...fanOf(groups.length, true) };
}

function rowOf(groups: readonly HandGroup[], cardW: number, avail: number): Omit<HandLayout, 'tilts' | 'sinks'> {
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
