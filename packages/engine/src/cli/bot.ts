// A simple, deterministic (given a seeded RNG) bot policy used to drive full games
// end-to-end for the CLI simulator and the 1000-game validation script.

import { Action, GameState, PowerRank } from '../types.js';
import { askableRanks, findLayableSets, legalRequestTargets } from '../queries.js';

export interface BotRng {
  next(): number;
}

// A tiny local PRNG for bot decisions; independent from the engine's own seeded RNG
// (bots are a driver-layer concern, not part of the pure rules engine).
export function makeBotRng(seed: number): BotRng {
  let state = seed | 0;
  return {
    next() {
      state = (state + 0x6d2b79f5) | 0;
      let t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
  };
}

function pick<T>(rng: BotRng, arr: T[]): T {
  return arr[Math.floor(rng.next() * arr.length)];
}

const ACTIVE_RANKS: PowerRank[] = ['jellyfish', 'stickleback', 'whale'];
const NORMAL_FISH = ['herring', 'mackerel', 'anchovy', 'sardine', 'carp', 'trout', 'perch', 'catfish'] as const;

/** Opportunistically lays every set any player can currently lay. Returns actions taken. */
export function nextLayAction(state: GameState): Action | null {
  if (state.pendingWindow !== null) return null;
  for (const p of state.players) {
    const layable = findLayableSets(state, p.id);
    if (layable.length > 0) {
      const choice = layable[0];
      return { type: 'LAY_SET', playerId: p.id, rank: choice.rank, cardIds: choice.cardIds };
    }
  }
  return null;
}

/** Decides the next action for whatever the engine is currently waiting on. */
export function nextBotAction(state: GameState, rng: BotRng): Action | null {
  const layAction = nextLayAction(state);
  if (layAction) return layAction;

  const w = state.pendingWindow;
  if (w) {
    return decideWindowAction(state, w.type, rng);
  }

  if (state.resume.kind === 'AWAIT_REQUEST') {
    const current = state.players[state.currentPlayerIndex];
    const ranks = askableRanks(current);
    const targets = legalRequestTargets(state, current.id);
    if (ranks.length === 0 || targets.length === 0) return null; // engine should have auto-passed; nothing to do
    const rank = pick(rng, ranks);
    const targetId = pick(rng, targets);
    return { type: 'REQUEST', playerId: current.id, targetId, rank };
  }

  return null;
}

function decideWindowAction(state: GameState, windowType: string, rng: BotRng): Action | null {
  const w = state.pendingWindow!;
  const declareChance = 0.5;

  switch (windowType) {
    case 'TURN_START': {
      const playerId = w.eligiblePlayerIds[0];
      if (rng.next() > declareChance) return { type: 'SKIP_WINDOW' };
      const player = state.players.find((p) => p.id === playerId)!;
      const grants = state.powerGrants.filter(
        (g) => g.ownerId === playerId && g.bound && !g.used && ACTIVE_RANKS.includes(g.rank),
      );
      if (grants.length === 0) return { type: 'SKIP_WINDOW' };
      const grant = pick(rng, grants);
      const others = state.players.filter((p) => p.id !== playerId);
      if (grant.rank === 'jellyfish') {
        return { type: 'USE_JELLYFISH', playerId, grantId: grant.id, targetId: pick(rng, others).id };
      }
      if (grant.rank === 'stickleback') {
        return {
          type: 'USE_STICKLEBACK',
          playerId,
          grantId: grant.id,
          targetId: pick(rng, others).id,
          rank: pick(rng, [...NORMAL_FISH]),
        };
      }
      if (grant.rank === 'whale' && state.players.length >= 3) {
        const idx = state.turnOrder.indexOf(playerId);
        const n = state.turnOrder.length;
        const neighborIdx = rng.next() < 0.5 ? (idx + 1) % n : (idx - 1 + n) % n;
        return {
          type: 'USE_WHALE',
          playerId,
          grantId: grant.id,
          targetAId: playerId,
          targetBId: state.turnOrder[neighborIdx],
        };
      }
      return { type: 'SKIP_WINDOW' };
    }
    case 'REQUEST_DECLARED': {
      const playerId = w.eligiblePlayerIds[0];
      if (rng.next() > declareChance) return { type: 'SKIP_WINDOW' };
      const grant = state.powerGrants.find((g) => g.ownerId === playerId && g.rank === 'lanternfish' && !g.used);
      if (!grant) return { type: 'SKIP_WINDOW' };
      return { type: 'DECLARE_LANTERNFISH', playerId, grantId: grant.id };
    }
    case 'RESPONSE_PENDING': {
      const playerId = w.eligiblePlayerIds[0];
      if (rng.next() > 0.35) return { type: 'SKIP_WINDOW' };
      const grant = state.powerGrants.find((g) => g.ownerId === playerId && g.rank === 'squid' && !g.used);
      if (!grant) return { type: 'SKIP_WINDOW' };
      const target = state.players.find((p) => p.id === playerId)!;
      const rank = (w.context as any).rank;
      const trueHasCards = target.hand.some((c) => c.rank === rank);
      return { type: 'DECLARE_SQUID', playerId, grantId: grant.id, lie: trueHasCards ? 'deny' : 'claim' };
    }
    case 'TRANSFER_PENDING': {
      const playerId = w.eligiblePlayerIds[0];
      if (rng.next() > declareChance) return { type: 'SKIP_WINDOW' };
      const grant = state.powerGrants.find((g) => g.ownerId === playerId && g.rank === 'tortoise' && !g.used);
      if (!grant) return { type: 'SKIP_WINDOW' };
      const rank = (w.context as any).rank;
      return { type: 'DECLARE_TORTOISE', playerId, grantId: grant.id, rank };
    }
    case 'SET_COMPLETED': {
      const playerId = pick(rng, w.eligiblePlayerIds);
      if (rng.next() > declareChance) return { type: 'SKIP_WINDOW' };
      const grant = state.powerGrants.find((g) => g.ownerId === playerId && g.rank === 'mantisShrimp' && !g.used);
      if (!grant) return { type: 'SKIP_WINDOW' };
      return { type: 'DECLARE_MANTIS', playerId, grantId: grant.id };
    }
    case 'TURN_END': {
      const playerId = pick(rng, w.eligiblePlayerIds);
      if (rng.next() > declareChance) return { type: 'SKIP_WINDOW' };
      const grant = state.powerGrants.find((g) => g.ownerId === playerId && g.rank === 'shark' && !g.used);
      if (!grant) return { type: 'SKIP_WINDOW' };
      return { type: 'DECLARE_SHARK', playerId, grantId: grant.id };
    }
    default:
      return { type: 'SKIP_WINDOW' };
  }
}
