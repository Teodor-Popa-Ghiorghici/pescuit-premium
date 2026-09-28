// Two bot players for the plan's measurements. "Random" is the engine's own bot. "Memory"
// tracks what every public event reveals (who asked for what, who was found empty) and asks
// where it knows a match exists — closer to how people play. Shared by ending.ts and
// eventfreq.ts.
import { createGame, reduce } from '../../packages/engine/src/engine.ts';
import type { Action, GameEvent, GameState, Rank } from '../../packages/engine/src/types.ts';
import { makeBotRng, nextBotAction, type BotRng } from '../../packages/engine/src/cli/bot.ts';
import { askableRanks, legalRequestTargets } from '../../packages/engine/src/queries.ts';

type Mind = { has: Map<string, Set<Rank>>; lacks: Map<string, Set<Rank>> };

function learn(mind: Mind, e: GameEvent) {
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
      has(e.playerId).delete(e.rank);
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

export function play(n: number, seed: number, memory: boolean, trace?: Trace) {
  const ids = Array.from({ length: n }, (_, j) => `P${j + 1}`);
  let { state, events } = createGame(ids.map((id) => ({ id, name: id })), seed, { powerVisibility: 'ascuns' });
  const rng = makeBotRng(seed * 7 + 1);
  const mind: Mind = { has: new Map(ids.map((p) => [p, new Set()])), lacks: new Map(ids.map((p) => [p, new Set()])) };
  const all: GameEvent[] = [...events];
  const streaks: number[] = []; // the engine's own no-progress count after every action
  let deadAsks = 0; // asks made after the score could no longer change
  let deadTurns = 0;
  let laidAfterDecided = 0; // sets laid or destroyed after decided() fired — must stay 0
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
    const r = reduce(state, action);
    trace?.(state, action, r.state, r.events);
    state = r.state;
    if (wasDecided) {
      deadAsks += r.events.filter((e) => e.type === 'REQUEST_MADE').length;
      deadTurns += r.events.filter((e) => e.type === 'TURN_STARTED').length;
      laidAfterDecided += r.events.filter((e) => e.type === 'SET_LAID' || e.type === 'SET_DESTROYED').length;
    }
    for (const e of r.events) learn(mind, e);
    all.push(...r.events);
    streaks.push(state.staleRequestStreak);
  }
  return { state, events: all, streaks, deadAsks, deadTurns, laidAfterDecided };
}

/** True when the score can no longer change: no window is open, the pool is empty, and no
 *  rank can reach a set with the real cards and eggs still in hands, even if every card were
 *  in one hand. It can only be late, never early: once true, no set can be laid or destroyed
 *  (ending.ts counts any that are), so neither the score nor the power-set tie-break can move. */
export function decided(state: GameState): boolean {
  // Only at rest: while a window is open a Mantis can still destroy the set just laid.
  if (state.pool.length > 0 || state.pendingWindow !== null) return false;
  const hands = state.players.flatMap((p) => p.hand);
  const eggs = hands.filter((c) => c.rank === 'eggs').length;
  if (eggs >= 4) return false;
  const counts = new Map<string, number>();
  for (const c of hands) if (c.rank !== 'eggs') counts.set(c.rank, (counts.get(c.rank) ?? 0) + 1);
  for (const [rank, real] of counts) {
    const need = POWER.has(rank) ? 4 : 3;
    if (real >= 2 && real + Math.min(2, eggs) >= need) return false;
  }
  return true;
}
const POWER = new Set(['squid', 'shark', 'tortoise', 'jellyfish', 'lanternfish', 'stickleback', 'mantisShrimp', 'whale', 'clownfish']);

