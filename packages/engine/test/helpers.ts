import { Card, GameConfig, GameState, PlayerState, PowerVisibilityMode, Rank } from '../src/types.js';

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
    seed: 1,
    rngState: 1,
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
