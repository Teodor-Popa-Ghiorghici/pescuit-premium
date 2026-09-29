import { reduce } from '../src/engine.js';
import {
  Card,
  GameConfig,
  GameState,
  LaidSet,
  PlayerState,
  POWER_RANKS,
  PowerVisibilityMode,
  Rank,
} from '../src/types.js';

let cardSeq = 0;

export function card(rank: Rank): Card {
  cardSeq += 1;
  return { id: `t${cardSeq}_${rank}`, rank };
}

export function cards(rank: Rank, n: number): Card[] {
  return Array.from({ length: n }, () => card(rank));
}

/**
 * Builds a GameState directly with exact, caller-chosen hands, bypassing the
 * normal shuffle-and-deal in createGame(). This lets tests set up precise
 * scenarios (e.g. "player has exactly 4 sharks") without fighting a seed.
 */
export function makeState(opts: {
  playerIds: string[];
  hands: Record<string, Card[]>;
  pool?: Card[];
  powerVisibility?: PowerVisibilityMode;
  currentPlayerIndex?: number;
}): GameState {
  const players: PlayerState[] = opts.playerIds.map((id) => ({
    id,
    name: id,
    hand: opts.hands[id] ?? [],
    score: 0,
    connected: true,
    stunned: false,
  }));
  const config: GameConfig = {
    powerVisibility: opts.powerVisibility ?? 'ascuns',
    windowTimeoutMs: 12000,
  };
  return {
    players,
    turnOrder: opts.playerIds,
    pool: opts.pool ?? [],
    currentPlayerIndex: opts.currentPlayerIndex ?? 0,
    turnCounter: 0,
    pendingWindow: null,
    resume: { kind: 'AWAIT_REQUEST', playerId: opts.playerIds[opts.currentPlayerIndex ?? 0] },
    tortoiseProtections: [],
    laidSets: [],
    powerGrants: [],
    pendingClownfishBindings: [],
    usedPowerHistory: [],
    status: 'IN_PROGRESS',
    winners: [],
    config,
    idCounter: 0,
    staleRequestStreak: 0,
    endReason: null,
  };
}

export function findPlayer(state: GameState, id: string) {
  const p = state.players.find((x) => x.id === id);
  if (!p) throw new Error(`no such player ${id}`);
  return p;
}

export function handRanks(state: GameState, id: string): Rank[] {
  return findPlayer(state, id).hand.map((c) => c.rank).sort();
}

/** Closes the open window the way its first eligible player would: a truthful answer or a pass. */
export function skipWindow(state: GameState) {
  const w = state.pendingWindow;
  if (!w) throw new Error('no window open');
  return reduce(state, { type: 'SKIP_WINDOW', playerId: w.eligiblePlayerIds[0] });
}

let setSeq = 0;

/** A laid set with the given composition, dropped straight into a state (no engine call). */
export function laidSet(
  ownerId: string,
  rank: Rank,
  reals: number,
  eggs = 0,
  opts?: { faceUp?: boolean; id?: string },
): LaidSet {
  setSeq += 1;
  const id = opts?.id ?? `ls${setSeq}`;
  const isPower = (POWER_RANKS as readonly string[]).includes(rank);
  return {
    id,
    ownerId,
    rank,
    cardIds: Array.from({ length: reals + eggs }, (_, i) => `${id}_c${i}`),
    eggCount: eggs,
    isPowerSet: isPower,
    faceUp: opts?.faceUp ?? !isPower,
    spent: false,
    destroyedByMantis: false,
  };
}
