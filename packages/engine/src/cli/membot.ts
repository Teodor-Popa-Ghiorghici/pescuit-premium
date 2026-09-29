// A "memory" bot for the bot table (FEEL_VISUAL_SOUND_PLAN §7.1) and the plan's measurements: it
// remembers what the PUBLIC record reveals - who asked for what, who was found empty, which face-up
// sets were laid - and asks where it knows a match exists. It never reads a hidden rank. That makes
// it close to how people play, and it produces realistic endings (memory bots end 95-97 % of games
// on the public end check, DECISIONS.md "Deciding the game").
//
// Adapted from docs/plan-evidence/membot.ts; that file keeps the harness around it (the end-check
// measurements). Pure: no I/O, no clock, nothing seeded but the caller's BotRng.

import { askableRanks, legalRequestTargets } from '../queries.js';
import type { Action, GameEvent, GameState, Rank } from '../types.js';
import type { BotRng } from './bot.js';

interface Mind {
  has: Map<string, Set<Rank>>;
  lacks: Map<string, Set<Rank>>;
}

export interface MemoryBot {
  /** feed it the events of every action, in order */
  observe(events: readonly GameEvent[]): void;
  /** the ask the current player would make, or null when they cannot ask */
  ask(state: GameState, rng: BotRng): Action | null;
}

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

export function createMemoryBot(playerIds: readonly string[], powerSetsFaceDown: boolean): MemoryBot {
  const mind: Mind = {
    has: new Map(playerIds.map((p) => [p, new Set<Rank>()])),
    lacks: new Map(playerIds.map((p) => [p, new Set<Rank>()])),
  };
  return {
    observe(events) {
      for (const e of events) learn(mind, e, powerSetsFaceDown);
    },
    ask(state, rng) {
      const me = state.players[state.currentPlayerIndex];
      const ranks = askableRanks(me);
      const targets = legalRequestTargets(state, me.id);
      if (ranks.length === 0 || targets.length === 0) return null;
      const count = (r: Rank) => me.hand.filter((c) => c.rank === r).length;
      const known: [string, Rank][] = [];
      for (const t of targets) for (const r of ranks) if (mind.has.get(t)?.has(r)) known.push([t, r]);
      if (known.length > 0) {
        known.sort((a, b) => count(b[1]) - count(a[1]) || rng.next() - 0.5);
        return { type: 'REQUEST', playerId: me.id, targetId: known[0][0], rank: known[0][1] };
      }
      const byCount = [...ranks].sort((a, b) => count(b) - count(a) || rng.next() - 0.5);
      for (const r of byCount) {
        const open = targets.filter((t) => !mind.lacks.get(t)?.has(r));
        if (open.length > 0) return { type: 'REQUEST', playerId: me.id, targetId: open[Math.floor(rng.next() * open.length)], rank: r };
      }
      return { type: 'REQUEST', playerId: me.id, targetId: targets[Math.floor(rng.next() * targets.length)], rank: byCount[0] };
    },
  };
}
