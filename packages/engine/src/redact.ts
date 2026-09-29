// Builds the per-player redacted view AND the per-player redacted event stream the server is
// allowed to send over the wire. This is the single source of truth for "safe to reveal" —
// squid's absolute secrecy depends on nobody else ever serializing GameState or GameEvent
// directly to a client (FEEL_VISUAL_SOUND_PLAN §6.1).
//
// "The public record" (§3.2) is what a spectator holding no cards would receive: the redacted
// view sequence and the redacted event stream, ordered by seq. redactForSpectator and
// redactEventsForSpectator produce exactly that.

import { publicSetsPossible, SETS_AT_START } from './setsPossible.js';
import { Card, EndReason, GameEvent, GameState, PowerRank, PowerVisibilityMode, Rank, WindowType } from './types.js';

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
  pendingWindow: {
    type: string;
    youAreEligible: boolean;
    context: Record<string, unknown>;
    /** server clock (ms since the epoch) at which the driver will close the window; null if unknown */
    deadlineAt: number | null;
  } | null;
  config: { powerVisibility: PowerVisibilityMode; windowTimeoutMs: number };
  winners: string[];
  /** why the game ended; null while it is in progress */
  endReason: EndReason | null;
  /**
   * The public tally (§3.9): the most sets any assignment of ranks the public record allows
   * could still yield, if every unlaid card could be gathered into one hand. An UPPER BOUND on
   * the sets that can really still be laid (say "at most"), computed from the public record
   * only, so it is the same for every viewer. `start` is its value before the first lay (18).
   */
  sets: { possible: number; start: number };
  /** The stall gate (§3.9): consecutive asks that captured and drew nothing, and the 2N limit. */
  endPressure: { misses: number; limit: number };
  /** per-room monotonically increasing sequence number of the last event this view includes */
  seq: number;
  /** the server's clock when this view was built (ms since the epoch); pairs with deadlineAt */
  serverNow: number;
}

/** What only the driver knows: the room's sequence number and clock. The engine has no clock. */
export interface ViewMeta {
  seq?: number;
  serverNow?: number;
  /** the deadline the driver armed for the currently open window */
  windowDeadlineAt?: number | null;
}

// ---- The public event stream ----

/** An event as a client may see it. Every secret is gone: no seed (there is none), no card id but
 *  the drawer's own, no grant id but the owner's, no rank of a concealed set, no eligibility list. */
export type PublicEvent =
  | Exclude<
      GameEvent,
      {
        type:
          | 'DREW_FROM_POOL'
          | 'SET_LAID'
          | 'POWER_GRANTED'
          | 'POWER_USED'
          | 'CLOWNFISH_BOUND'
          | 'WINDOW_OPENED';
      }
    >
  /** `cardId` is present for the drawer only */
  | { type: 'DREW_FROM_POOL'; playerId: string; cardId?: string; poolEmpty: boolean }
  /** `rank` is null while the set is concealed from the viewer */
  | { type: 'SET_LAID'; playerId: string; setId: string; rank: Rank | null; isPowerSet: boolean; eggCount: number }
  /** `rank` is null while the source set is concealed; `grantId` is present for the owner only */
  | {
      type: 'POWER_GRANTED';
      playerId: string;
      grantId?: string;
      rank: PowerRank | null;
      sourceSetId: string;
      unbound: boolean;
    }
  /** `grantId` is present for the owner only */
  | { type: 'POWER_USED'; playerId: string; grantId?: string; rank: PowerRank }
  /** owner only in Mode Ascuns; everyone in Mode Deschis (grantId still owner only) */
  | { type: 'CLOWNFISH_BOUND'; playerId: string; grantId?: string; boundRank: PowerRank }
  | { type: 'WINDOW_OPENED'; window: WindowType; youAreEligible: boolean; context: Record<string, unknown> };


/** The one concealment predicate for laid sets: a set is concealed from every viewer but its
 *  owner while it is not face up. Views and events both use it. A null viewer is a spectator. */
function isConcealed(set: { faceUp: boolean; ownerId: string }, viewerId: string | null): boolean {
  return !set.faceUp && set.ownerId !== viewerId;
}

function concealedBySetId(state: GameState, setId: string | undefined, viewerId: string | null): boolean {
  const set = setId ? state.laidSets.find((s) => s.id === setId) : undefined;
  // an unknown set is treated as concealed: the safe direction
  return set ? isConcealed(set, viewerId) : true;
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
  viewerId: string | null,
): Record<string, unknown> {
  if (windowType !== 'SET_COMPLETED') return context;
  const setId = context.setId as string | undefined;
  const set = setId ? state.laidSets.find((s) => s.id === setId) : undefined;
  if (!set) return context;
  if (!isConcealed(set, viewerId)) return context;
  const { rank: _omit, ...rest } = context;
  return rest;
}

function buildView(state: GameState, viewer: PlayerViewer | null, meta: ViewMeta): RedactedView {
  const viewerId = viewer ? viewer.id : null;

  const laidSets: RedactedLaidSet[] = state.laidSets.map((set) => {
    const concealed = isConcealed(set, viewerId);
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
        youAreEligible: viewerId !== null && state.pendingWindow.eligiblePlayerIds.includes(viewerId),
        context: redactWindowContext(state, state.pendingWindow.type, state.pendingWindow.context, viewerId),
        deadlineAt: meta.windowDeadlineAt ?? null,
      }
    : null;

  return {
    viewerId: viewerId ?? '',
    status: state.status,
    turnOrder: state.turnOrder,
    currentPlayerId: state.players[state.currentPlayerIndex]?.id,
    turnCounter: state.turnCounter,
    poolCount: state.pool.length,
    hand: viewer ? viewer.hand.slice() : [],
    players,
    laidSets,
    ownPowerGrants,
    pendingWindow,
    config: { powerVisibility: state.config.powerVisibility, windowTimeoutMs: state.config.windowTimeoutMs },
    winners: state.winners,
    endReason: state.endReason,
    sets: { possible: publicSetsPossible(state), start: SETS_AT_START },
    endPressure: { misses: state.staleRequestStreak, limit: state.players.length * 2 },
    seq: meta.seq ?? 0,
    serverNow: meta.serverNow ?? 0,
  };
}

type PlayerViewer = GameState['players'][number];

export function redactForPlayer(state: GameState, viewerId: string, meta: ViewMeta = {}): RedactedView {
  const viewer = state.players.find((p) => p.id === viewerId);
  if (!viewer) throw new Error(`Unknown player ${viewerId}`);
  return buildView(state, viewer, meta);
}

/** The public record's view: what a spectator holding no cards sees. Its `viewerId` is ''. */
export function redactForSpectator(state: GameState, meta: ViewMeta = {}): RedactedView {
  return buildView(state, null, meta);
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

function redactEvent(state: GameState, e: GameEvent, viewerId: string | null): PublicEvent | null {
  switch (e.type) {
    case 'DREW_FROM_POOL': {
      const { cardId, ...rest } = e;
      return e.playerId === viewerId ? { ...rest, cardId } : rest;
    }
    case 'SET_LAID':
      return concealedBySetId(state, e.setId, viewerId) ? { ...e, rank: null } : e;
    case 'POWER_GRANTED': {
      const { grantId, ...rest } = e;
      const owner = e.playerId === viewerId;
      const concealed = concealedBySetId(state, e.sourceSetId, viewerId);
      const out = concealed ? { ...rest, rank: null, unbound: false } : rest;
      return owner ? { ...out, grantId } : out;
    }
    case 'POWER_USED': {
      const { grantId, ...rest } = e;
      return e.playerId === viewerId ? { ...rest, grantId } : rest;
    }
    case 'CLOWNFISH_BOUND': {
      const { grantId, ...rest } = e;
      const owner = e.playerId === viewerId;
      if (!owner && state.config.powerVisibility === 'ascuns') return null;
      return owner ? { ...rest, grantId } : rest;
    }
    case 'WINDOW_OPENED': {
      const { eligiblePlayerIds, context, ...rest } = e;
      return {
        ...rest,
        youAreEligible: viewerId !== null && eligiblePlayerIds.includes(viewerId),
        context: redactWindowContext(state, e.window, context, viewerId),
      };
    }
    default:
      return e;
  }
}

/** A GameEvent, optionally stamped by the driver with its per-room sequence number. */
export type SequencedGameEvent = GameEvent & { seq?: number };
export type SequencedPublicEvent = PublicEvent & { seq?: number };

/**
 * The events one viewer may see, in order. `state` is the state AFTER the events were produced
 * (the concealment predicate is the same one the view uses). Events dropped for a viewer leave
 * a gap in their `seq` numbers, never a placeholder: for two viewers who are not the owner the
 * streams are byte-identical (§6.5, test 1). The driver's `seq` stamp is carried through.
 */
export function redactEventsForPlayer(
  state: GameState,
  events: readonly SequencedGameEvent[],
  viewerId: string,
): SequencedPublicEvent[] {
  if (!state.players.some((p) => p.id === viewerId)) throw new Error(`Unknown player ${viewerId}`);
  return redactMany(state, events, viewerId);
}

/** The public record's event stream: what a spectator holding no cards receives. */
export function redactEventsForSpectator(state: GameState, events: readonly SequencedGameEvent[]): SequencedPublicEvent[] {
  return redactMany(state, events, null);
}

function redactMany(
  state: GameState,
  events: readonly SequencedGameEvent[],
  viewerId: string | null,
): SequencedPublicEvent[] {
  const out: SequencedPublicEvent[] = [];
  for (const e of events) {
    const r = redactEvent(state, e, viewerId);
    if (!r) continue;
    out.push(e.seq === undefined ? r : { ...r, seq: e.seq });
  }
  return out;
}
