// Builds the per-player redacted view the server is allowed to send over the wire.
// This is the single source of truth for "safe to reveal" — squid's absolute secrecy
// depends on nobody else ever serializing GameState directly to a client.

import { Card, GameState, PowerVisibilityMode, Rank } from './types.js';

export interface RedactedLaidSet {
  id: string;
  ownerId: string;
  isPowerSet: boolean;
  cardCount: number;
  eggCount: number;
  /** null while concealed from this viewer */
  rank: Rank | null;
  /** always false while concealed from this viewer, even if truly spent (squid) */
  spent: boolean;
  destroyedByMantis: boolean;
}

export interface RedactedPlayerView {
  id: string;
  name: string;
  handSize: number;
  score: number;
  connected: boolean;
  stunned: boolean;
  protectedRanks: Rank[]; // ranks currently tortoise-protected (rank hidden card counts not needed)
}

export interface RedactedOwnPower {
  id: string;
  rank: string; // 'clownfish' while unbound
  used: boolean;
  bound: boolean;
  sourceSetId: string;
}

export interface RedactedView {
  viewerId: string;
  status: GameState['status'];
  turnOrder: string[];
  currentPlayerId: string;
  turnCounter: number;
  poolCount: number;
  hand: Card[];
  players: RedactedPlayerView[];
  laidSets: RedactedLaidSet[];
  ownPowerGrants: RedactedOwnPower[];
  pendingWindow: { type: string; youAreEligible: boolean; context: Record<string, unknown> } | null;
  config: { powerVisibility: PowerVisibilityMode; windowTimeoutMs: number };
  winners: string[];
}

/**
 * Every window context is otherwise public (the rank in a REQUEST/RESPONSE/TRANSFER/
 * TURN_END window is the rank someone just asked for out loud). SET_COMPLETED is the
 * one exception: its context names the rank of the power set that was just laid, which
 * for a concealed set (squid always, or any hidden power set in Mode Ascuns before its
 * first use) must not leak to Mantis Shrimp holders just because a window opened.
 */
function redactWindowContext(
  state: GameState,
  windowType: string,
  context: Record<string, unknown>,
  viewerId: string,
): Record<string, unknown> {
  if (windowType !== 'SET_COMPLETED') return context;
  const setId = context.setId as string | undefined;
  const set = setId ? state.laidSets.find((s) => s.id === setId) : undefined;
  if (!set) return context;
  const concealed = !set.faceUp && set.ownerId !== viewerId;
  if (!concealed) return context;
  const { rank: _omit, ...rest } = context;
  return rest;
}

export function redactForPlayer(state: GameState, viewerId: string): RedactedView {
  const viewer = state.players.find((p) => p.id === viewerId);
  if (!viewer) throw new Error(`Unknown player ${viewerId}`);

  const laidSets: RedactedLaidSet[] = state.laidSets.map((set) => {
    const concealed = !set.faceUp && set.ownerId !== viewerId;
    return {
      id: set.id,
      ownerId: set.ownerId,
      isPowerSet: set.isPowerSet,
      cardCount: set.cardIds.length,
      eggCount: set.eggCount,
      rank: concealed ? null : set.rank,
      spent: concealed ? false : set.spent,
      destroyedByMantis: concealed ? false : set.destroyedByMantis,
    };
  });

  const players: RedactedPlayerView[] = state.players.map((p) => ({
    id: p.id,
    name: p.name,
    handSize: p.hand.length,
    score: p.score,
    connected: p.connected,
    stunned: p.stunned,
    protectedRanks: state.tortoiseProtections.filter((t) => t.ownerId === p.id).map((t) => t.rank),
  }));

  const ownPowerGrants: RedactedOwnPower[] = state.powerGrants
    .filter((g) => g.ownerId === viewerId)
    .map((g) => ({ id: g.id, rank: g.rank, used: g.used, bound: g.bound, sourceSetId: g.sourceSetId }));

  const pendingWindow = state.pendingWindow
    ? {
        type: state.pendingWindow.type,
        youAreEligible: state.pendingWindow.eligiblePlayerIds.includes(viewerId),
        context: redactWindowContext(state, state.pendingWindow.type, state.pendingWindow.context, viewerId),
      }
    : null;

  return {
    viewerId,
    status: state.status,
    turnOrder: state.turnOrder,
    currentPlayerId: state.players[state.currentPlayerIndex]?.id,
    turnCounter: state.turnCounter,
    poolCount: state.pool.length,
    hand: viewer.hand.slice(),
    players,
    laidSets,
    ownPowerGrants,
    pendingWindow,
    config: { powerVisibility: state.config.powerVisibility, windowTimeoutMs: state.config.windowTimeoutMs },
    winners: state.winners,
  };
}
