// Two bot players for the plan's measurements, and the §11.2 end check. "Random" is the
// engine's own bot. "Memory" tracks what the public record reveals (who asked for what, who
// was found empty, which face-up sets were laid) and asks where it knows a match exists —
// closer to how people play. Shared by ending.ts, eventfreq.ts and endcheck.ts.
import { createGame, reduce } from '../../packages/engine/src/engine.ts';
import { NORMAL_RANKS, POWER_RANKS } from '../../packages/engine/src/types.ts';
import type { Action, GameEvent, GameState, Rank } from '../../packages/engine/src/types.ts';
import { makeBotRng, nextBotAction, type BotRng } from '../../packages/engine/src/cli/bot.ts';
import { askableRanks, legalRequestTargets } from '../../packages/engine/src/queries.ts';

type Mind = { has: Map<string, Set<Rank>>; lacks: Map<string, Set<Rank>> };

function learn(mind: Mind, e: GameEvent, powerSetsFaceDown: boolean) {
  const has = (p: string) => mind.has.get(p)!;
  const lacks = (p: string) => mind.lacks.get(p)!;
  switch (e.type) {
    case 'REQUEST_MADE':
      has(e.askerId).add(e.rank);
      break;
    case 'REQUEST_SUCCEEDED':
      has(e.askerId).add(e.rank);
      has(e.targetId).delete(e.rank);
      lacks(e.targetId).add(e.rank);
      break;
    case 'REQUEST_FAILED':
      lacks(e.targetId).add(e.rank);
      has(e.targetId).delete(e.rank);
      break;
    case 'SET_LAID':
      // a face-down power set's rank is not public, so a fair bot cannot use it
      if (!(e.isPowerSet && powerSetsFaceDown)) has(e.playerId).delete(e.rank);
      break;
    case 'SHARK_JUMP':
    case 'LANTERNFISH_REFLECT':
      has(e.playerId).add(e.rank);
      has(e.fromId).delete(e.rank);
      lacks(e.fromId).add(e.rank);
      break;
    case 'STICKLEBACK_STEAL':
      has(e.playerId).add(e.rank);
      has(e.targetId).delete(e.rank);
      lacks(e.targetId).add(e.rank);
      break;
    case 'WHALE_SHUFFLE':
      for (const p of [e.targetAId, e.targetBId]) {
        has(p).clear();
        lacks(p).clear();
      }
      break;
    case 'DREW_FROM_POOL':
    case 'HAND_REFILLED':
      lacks(e.playerId).clear(); // they may now hold anything
      break;
  }
}

function memoryAsk(state: GameState, mind: Mind, rng: BotRng): Action | null {
  const me = state.players[state.currentPlayerIndex];
  const ranks = askableRanks(me);
  const targets = legalRequestTargets(state, me.id);
  if (ranks.length === 0 || targets.length === 0) return null;
  const count = (r: Rank) => me.hand.filter((c) => c.rank === r).length;
  const known: [string, Rank][] = [];
  for (const t of targets) for (const r of ranks) if (mind.has.get(t)!.has(r)) known.push([t, r]);
  if (known.length > 0) {
    known.sort((a, b) => count(b[1]) - count(a[1]) || rng.next() - 0.5);
    return { type: 'REQUEST', playerId: me.id, targetId: known[0][0], rank: known[0][1] };
  }
  const byCount = [...ranks].sort((a, b) => count(b) - count(a) || rng.next() - 0.5);
  for (const r of byCount) {
    const open = targets.filter((t) => !mind.lacks.get(t)!.has(r));
    if (open.length > 0) return { type: 'REQUEST', playerId: me.id, targetId: open[Math.floor(rng.next() * open.length)], rank: r };
  }
  return { type: 'REQUEST', playerId: me.id, targetId: targets[Math.floor(rng.next() * targets.length)], rank: byCount[0] };
}

type Trace = (before: GameState, action: Action, after: GameState, events: GameEvent[]) => void;

export function play(
  n: number,
  seed: number,
  memory: boolean,
  { mode = 'ascuns', trace }: { mode?: 'ascuns' | 'deschis'; trace?: Trace } = {},
) {
  const ids = Array.from({ length: n }, (_, j) => `P${j + 1}`);
  let { state, events } = createGame(ids.map((id) => ({ id, name: id })), seed, { powerVisibility: mode });
  const rng = makeBotRng(seed * 7 + 1);
  const mind: Mind = { has: new Map(ids.map((p) => [p, new Set()])), lacks: new Map(ids.map((p) => [p, new Set()])) };
  const all: GameEvent[] = [...events];
  const streaks: number[] = []; // the engine's own no-progress count after every action
  const clock: [number, number][] = []; // [turn, sets still possible] as each turn starts
  let turn = 0;
  let deadAsks = 0; // asks made after the public check fired: what §11.2 removes
  let deadAsksTrue = 0; // the same for the omniscient check (v3's, which leaks)
  let deadTurns = 0;
  let laidAfterDecided = 0; // sets laid after the public check fired — must stay 0
  let publicBelowTrue = 0; // actions after which the public count fell below the truth — must stay 0
  let decidedAt: number | null = null; // the turn on which the public check first fired
  let decidedTrueAt: number | null = null;
  for (let steps = 0; state.status === 'IN_PROGRESS' && steps < 20000; steps++) {
    let action: Action | null = null;
    if (memory && state.pendingWindow === null && state.resume.kind === 'AWAIT_REQUEST') {
      const lay = nextBotAction(state, rng);
      action = lay && lay.type === 'LAY_SET' ? lay : memoryAsk(state, mind, rng);
    } else {
      action = nextBotAction(state, rng);
    }
    if (!action) break;
    const wasDecided = decided(state);
    const wasDecidedTrue = decidedTrue(state);
    const r = reduce(state, action);
    trace?.(state, action, r.state, r.events);
    state = r.state;
    const asks = r.events.filter((e) => e.type === 'REQUEST_MADE').length;
    if (wasDecided) {
      deadAsks += asks;
      deadTurns += r.events.filter((e) => e.type === 'TURN_STARTED').length;
      laidAfterDecided += r.events.filter((e) => e.type === 'SET_LAID').length;
    }
    if (wasDecidedTrue) deadAsksTrue += asks;
    const k = setsStillPossible(publicLaid(state));
    if (k < setsStillPossible(trueLaid(state))) publicBelowTrue++;
    for (const e of r.events) {
      learn(mind, e, mode === 'ascuns');
      if (e.type === 'TURN_STARTED') clock.push([++turn, k]);
    }
    if (decidedAt === null && decided(state)) decidedAt = turn;
    if (decidedTrueAt === null && decidedTrue(state)) decidedTrueAt = turn;
    all.push(...r.events);
    streaks.push(state.staleRequestStreak);
  }
  return { state, events: all, streaks, clock, turns: turn, deadAsks, deadAsksTrue, deadTurns, laidAfterDecided, publicBelowTrue, decidedAt, decidedTrueAt };
}

// ---------------------------------------------------------------- the end check (§11.2)

const DECK_EGGS = 6;

/** What anyone at the table knows about one laid set: its rank if it is face up, and its
 *  real and egg counts, which are public for every set, face down or not (redact.ts). */
export type LaidFacts = { rank: Rank | null; reals: number; eggs: number };

/** The spectator's view of the laid sets — the check's only input, so it cannot depend on
 *  a hand, the pool's order or a hidden rank. */
export function publicLaid(state: GameState): LaidFacts[] {
  return state.laidSets.map((s) => ({ rank: s.faceUp ? s.rank : null, reals: s.cardIds.length - s.eggCount, eggs: s.eggCount }));
}

/** The server's view, every rank known. For comparison only: a rule that reads it leaks. */
export function trueLaid(state: GameState): LaidFacts[] {
  return state.laidSets.map((s) => ({ rank: s.rank, reals: s.cardIds.length - s.eggCount, eggs: s.eggCount }));
}

/** The most sets one rank can still make from `real` cards with at most `eggs` eggs. A
 *  normal set is 3 real or 2 real + 1 egg; a power set is 4 real, 3 + 1 egg or 2 + 2 eggs. */
function fromRank(power: boolean, real: number, eggs: number): number {
  let best = 0;
  if (power) {
    for (let c = 0; 2 * c <= Math.min(real, eggs); c++)
      for (let b = 0; 2 * c + 3 * b <= real && 2 * c + b <= eggs; b++) best = Math.max(best, c + b + Math.floor((real - 2 * c - 3 * b) / 4));
  } else {
    for (let b = 0; 2 * b <= real && b <= eggs; b++) best = Math.max(best, b + Math.floor((real - 2 * b) / 3));
  }
  return best;
}

/** Sets that can still be laid, as far as the public record can tell: the most that any
 *  assignment of ranks to the face-down sets allows, if every card not yet laid (in hands
 *  or the pool) could be gathered into one hand. It is never below the truth, so a rule
 *  built on it never ends a game that could still change; and it reads only the public
 *  record, so its value — and the moment it reaches 0 — cannot leak anything hidden. */
export function setsStillPossible(laid: LaidFacts[]): number {
  const eggsLeft = DECK_EGGS - laid.reduce((sum, l) => sum + l.eggs, 0);
  const used = new Map<string, number>();
  const hidden = [0, 0, 0]; // face-down sets holding 2, 3 and 4 real cards
  for (const l of laid) {
    if (l.rank === null) hidden[l.reals - 2]++;
    else if (l.rank !== 'eggs') used.set(l.rank, (used.get(l.rank) ?? 0) + l.reals);
  }
  // Normal sets are always face up: normal[e] = the most normal sets using at most e eggs.
  let normal: number[] = new Array(eggsLeft + 1).fill(0);
  for (const r of NORMAL_RANKS) {
    const real = 3 - (used.get(r) ?? 0);
    normal = normal.map((_, e) => Math.max(...Array.from({ length: e + 1 }, (_, k) => normal[e - k] + fromRank(false, real, k))));
  }
  // Power ranks: every face-down set must sit on some rank with room for its real cards.
  const memo = new Map<string, number>();
  const power = (i: number, h2: number, h3: number, h4: number, e: number): number => {
    if (i === POWER_RANKS.length) return h2 + h3 + h4 === 0 ? 0 : -Infinity;
    const key = `${i},${h2},${h3},${h4},${e}`;
    const seen = memo.get(key);
    if (seen !== undefined) return seen;
    const room = 4 - (used.get(POWER_RANKS[i]) ?? 0);
    let best = -Infinity;
    for (let x2 = 0; x2 <= h2; x2++)
      for (let x3 = 0; x3 <= h3; x3++)
        for (let x4 = 0; x4 <= h4; x4++) {
          const placed = 2 * x2 + 3 * x3 + 4 * x4;
          if (placed > room) continue;
          for (let k = 0; k <= e; k++) best = Math.max(best, fromRank(true, room - placed, k) + power(i + 1, h2 - x2, h3 - x3, h4 - x4, e - k));
        }
    memo.set(key, best);
    return best;
  };
  let best = 0;
  for (let eP = 0; eP <= eggsLeft; eP++)
    for (let eN = 0; eP + eN <= eggsLeft; eN++)
      best = Math.max(best, power(0, hidden[0], hidden[1], hidden[2], eP) + normal[eN] + Math.floor((eggsLeft - eP - eN) / 4));
  return best;
}

/** §11.2: the score is final when, at rest, the public count of sets still possible is 0.
 *  (A Mantis cannot change a score — a destroyed set still counts, RULES §7 — so resting
 *  first only lets the last lay's windows and choreography finish.) */
export function decided(state: GameState): boolean {
  return state.pendingWindow === null && setsStillPossible(publicLaid(state)) === 0;
}

/** The same test on the server's full knowledge: v3's rule. Its timing reveals hidden ranks. */
export function decidedTrue(state: GameState): boolean {
  return state.pendingWindow === null && setsStillPossible(trueLaid(state)) === 0;
}
