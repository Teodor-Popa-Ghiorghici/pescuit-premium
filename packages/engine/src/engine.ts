import { buildDeck, isNormalRank, isPowerRank, setSizeForRank } from './deck.js';
import { findLayableSets } from './queries.js';
import { nextRandom, shuffle } from './rng.js';
import {
  Action,
  Card,
  EGGS,
  GameConfig,
  GameEvent,
  GameState,
  LaidSet,
  NormalRank,
  PlayerState,
  PowerGrant,
  PowerRank,
  Rank,
  RequestResume,
  TortoiseProtection,
  WindowType,
} from './types.js';

export class IllegalActionError extends Error {}

interface Ctx {
  s: GameState;
  events: GameEvent[];
}

function push(ctx: Ctx, e: GameEvent) {
  ctx.events.push(e);
}

function genId(ctx: Ctx, prefix: string): string {
  ctx.s.idCounter += 1;
  return `${prefix}_${ctx.s.idCounter}`;
}

function rand(ctx: Ctx): number {
  const { value, state } = nextRandom(ctx.s.rngState);
  ctx.s.rngState = state;
  return value;
}

function shuffleInPlace<T>(ctx: Ctx, arr: T[]): T[] {
  const { result, state } = shuffle(arr, ctx.s.rngState);
  ctx.s.rngState = state;
  return result;
}

function getPlayer(ctx: Ctx, id: string): PlayerState {
  const p = ctx.s.players.find((x) => x.id === id);
  if (!p) throw new IllegalActionError(`Unknown player ${id}`);
  return p;
}

function otherPlayerIds(ctx: Ctx, excludeId: string): string[] {
  return ctx.s.players.filter((p) => p.id !== excludeId).map((p) => p.id);
}

function findGrant(ctx: Ctx, id: string): PowerGrant {
  const g = ctx.s.powerGrants.find((x) => x.id === id);
  if (!g) throw new IllegalActionError(`Unknown power grant ${id}`);
  return g;
}

function findSet(ctx: Ctx, id: string): LaidSet | undefined {
  return ctx.s.laidSets.find((x) => x.id === id);
}

function hasNoRealCards(player: PlayerState): boolean {
  return player.hand.every((c) => c.rank === EGGS);
}

function findLayableSetsForPlayer(ctx: Ctx, playerId: string) {
  return findLayableSets(ctx.s, playerId);
}

function realCardsOfRank(player: PlayerState, rank: Rank): Card[] {
  return player.hand.filter((c) => c.rank === rank);
}

function hasRealCard(player: PlayerState, rank: Rank): boolean {
  return realCardsOfRank(player, rank).length > 0;
}

function grantsForPlayer(ctx: Ctx, playerId: string, rank: PowerRank): PowerGrant[] {
  return ctx.s.powerGrants.filter((g) => g.ownerId === playerId && g.bound && !g.used && g.rank === rank);
}

function grantsForRankAnyPlayer(ctx: Ctx, rank: PowerRank): PowerGrant[] {
  return ctx.s.powerGrants.filter((g) => g.bound && !g.used && g.rank === rank);
}

function activeTortoiseProtection(ctx: Ctx, ownerId: string, rank: Rank): TortoiseProtection | undefined {
  return ctx.s.tortoiseProtections.find((t) => t.ownerId === ownerId && t.rank === rank);
}

function isAdjacentSeats(turnOrder: string[], aId: string, bId: string): boolean {
  const n = turnOrder.length;
  const ai = turnOrder.indexOf(aId);
  const bi = turnOrder.indexOf(bId);
  if (ai < 0 || bi < 0 || ai === bi) return false;
  const diff = Math.abs(ai - bi);
  return diff === 1 || diff === n - 1;
}

// ---------------------------------------------------------------------------
// Game creation
// ---------------------------------------------------------------------------

export function createGame(
  players: { id: string; name: string }[],
  seed: number,
  configOverrides?: Partial<GameConfig>,
): { state: GameState; events: GameEvent[] } {
  if (players.length < 3 || players.length > 6) {
    throw new IllegalActionError('Pescuiește Extins requires 3 to 6 players');
  }
  const deckUnshuffled = buildDeck();
  const initialState: GameState = {
    seed,
    rngState: seed | 0,
    players: players.map((p) => ({ id: p.id, name: p.name, hand: [], score: 0, connected: true, stunned: false })),
    turnOrder: players.map((p) => p.id),
    pool: [],
    currentPlayerIndex: 0,
    turnCounter: 0,
    pendingWindow: null,
    resume: { kind: 'NONE' },
    tortoiseProtections: [],
    laidSets: [],
    powerGrants: [],
    pendingClownfishBindings: [],
    usedPowerHistory: [],
    status: 'IN_PROGRESS',
    winners: [],
    config: {
      powerVisibility: configOverrides?.powerVisibility ?? 'ascuns',
      windowTimeoutMs: configOverrides?.windowTimeoutMs ?? 12000,
    },
    idCounter: 0,
    staleRequestStreak: 0,
  };
  const ctx: Ctx = { s: initialState, events: [] };
  const deck = shuffleInPlace(ctx, deckUnshuffled);
  let idx = 0;
  for (let r = 0; r < 7; r++) {
    for (const p of ctx.s.players) {
      p.hand.push(deck[idx++]);
    }
  }
  ctx.s.pool = deck.slice(idx);
  push(ctx, { type: 'GAME_STARTED', playerIds: ctx.s.turnOrder, seed });
  beginTurn(ctx);
  return { state: ctx.s, events: ctx.events };
}

// ---------------------------------------------------------------------------
// Public reducer
// ---------------------------------------------------------------------------

export function reduce(inputState: GameState, action: Action): { state: GameState; events: GameEvent[] } {
  if (inputState.status === 'ENDED') {
    throw new IllegalActionError('Game has already ended');
  }
  const s: GameState = structuredClone(inputState);
  const ctx: Ctx = { s, events: [] };
  dispatch(ctx, action);
  return { state: ctx.s, events: ctx.events };
}

function dispatch(ctx: Ctx, action: Action) {
  switch (action.type) {
    case 'REQUEST':
      return handleRequest(ctx, action);
    case 'LAY_SET':
      return handleLaySet(ctx, action);
    case 'USE_JELLYFISH':
      return handleUseJellyfish(ctx, action);
    case 'USE_STICKLEBACK':
      return handleUseStickleback(ctx, action);
    case 'USE_WHALE':
      return handleUseWhale(ctx, action);
    case 'DECLARE_LANTERNFISH':
      return handleDeclareLanternfish(ctx, action);
    case 'DECLARE_SQUID':
      return handleDeclareSquid(ctx, action);
    case 'DECLARE_TORTOISE':
      return handleDeclareTortoise(ctx, action);
    case 'DECLARE_MANTIS':
      return handleDeclareMantis(ctx, action);
    case 'DECLARE_SHARK':
      return handleDeclareShark(ctx, action);
    case 'SKIP_WINDOW':
      return handleSkipWindow(ctx, action);
    default:
      throw new IllegalActionError(`Unknown action type`);
  }
}

// ---------------------------------------------------------------------------
// Turn lifecycle
// ---------------------------------------------------------------------------

function beginTurn(ctx: Ctx) {
  const n = ctx.s.players.length;
  let guard = 0;
  for (;;) {
    const player = ctx.s.players[ctx.s.currentPlayerIndex];
    if (player.stunned) {
      push(ctx, { type: 'TURN_SKIPPED_STUNNED', playerId: player.id });
      player.stunned = false;
      advancePlayerIndex(ctx);
      guard += 1;
      if (guard > n + 1) {
        // Safety valve: should be unreachable given power scarcity, but never hang forever.
        finalizeGame(ctx);
        return;
      }
      continue;
    }
    break;
  }

  const player = ctx.s.players[ctx.s.currentPlayerIndex];

  // Tortoise protections owned by this player expire as their turn begins.
  ctx.s.tortoiseProtections = ctx.s.tortoiseProtections.filter(
    (t) => !(t.expiresAtNextTurnOf === player.id),
  );

  ctx.s.turnCounter += 1;
  push(ctx, { type: 'TURN_STARTED', playerId: player.id, turn: ctx.s.turnCounter });

  // Rule 2.8: an empty hand refills up to 3 at turn start. We extend "empty" to mean
  // "no real (askable) card left" -- a hand of stray eggs alone can never make a legal
  // request either, and would otherwise strand the player with no possible action. See
  // DECISIONS.md.
  if (hasNoRealCards(player) && ctx.s.pool.length > 0) {
    const count = Math.min(3, ctx.s.pool.length);
    for (let i = 0; i < count; i++) {
      const card = ctx.s.pool.pop()!;
      player.hand.push(card);
    }
    push(ctx, { type: 'HAND_REFILLED', playerId: player.id, count });
    ctx.s.staleRequestStreak = 0;
  }

  if (checkGameEnd(ctx)) {
    finalizeGame(ctx);
    return;
  }

  if (hasNoRealCards(player) && findLayableSetsForPlayer(ctx, player.id).length === 0) {
    // Pool is empty (otherwise the refill above would have helped) and this player has
    // no legal request and nothing to lay. They cannot act: pass immediately.
    advancePlayerIndex(ctx);
    beginTurn(ctx);
    return;
  }

  const eligible = activePowersAvailable(ctx, player.id);
  ctx.s.resume = { kind: 'AWAIT_REQUEST', playerId: player.id };
  if (eligible.length > 0) {
    openWindow(ctx, 'TURN_START', [player.id], { playerId: player.id });
  } else {
    settleAwaitRequest(ctx, player.id);
  }
}

/**
 * Called once we've reached the AWAIT_REQUEST resting point with the TURN_START window
 * closed (or never opened). Handles the rare case where the current player holds real
 * cards but every other player is currently stunned (reachable via chained bonus turns
 * plus more than one jellyfish grant) -- with nobody legal to ask, they cannot act and
 * must be passed over, exactly like the no-real-cards case above. See DECISIONS.md.
 */
function settleAwaitRequest(ctx: Ctx, playerId: string) {
  if (ctx.s.resume.kind !== 'AWAIT_REQUEST' || ctx.s.resume.playerId !== playerId) return;
  const hasTarget = ctx.s.players.some((p) => p.id !== playerId && !p.stunned);
  if (hasTarget) return;
  advancePlayerIndex(ctx);
  beginTurn(ctx);
}

function advancePlayerIndex(ctx: Ctx) {
  ctx.s.currentPlayerIndex = (ctx.s.currentPlayerIndex + 1) % ctx.s.players.length;
}

function activePowersAvailable(ctx: Ctx, playerId: string): PowerGrant[] {
  const ranks: PowerRank[] = ['jellyfish', 'stickleback'];
  if (ctx.s.players.length >= 3) ranks.push('whale');
  const grants: PowerGrant[] = [];
  for (const r of ranks) grants.push(...grantsForPlayer(ctx, playerId, r));
  return grants;
}

function openWindow(ctx: Ctx, type: WindowType, eligiblePlayerIds: string[], context: Record<string, unknown>) {
  ctx.s.pendingWindow = { type, eligiblePlayerIds, context };
  push(ctx, { type: 'WINDOW_OPENED', window: type, eligiblePlayerIds, context });
}

function closeWindow(ctx: Ctx, type: WindowType) {
  ctx.s.pendingWindow = null;
  push(ctx, { type: 'WINDOW_CLOSED', window: type });
}

function requireWindow(ctx: Ctx, type: WindowType, playerId: string): void {
  const w = ctx.s.pendingWindow;
  if (!w || w.type !== type) throw new IllegalActionError(`No open ${type} window`);
  if (!w.eligiblePlayerIds.includes(playerId)) throw new IllegalActionError(`${playerId} is not eligible in this window`);
}

// ---------------------------------------------------------------------------
// Request flow: REQUEST -> (lanternfish?) -> (squid?) -> (tortoise?) -> transfer -> (shark?) -> end
// ---------------------------------------------------------------------------

function handleRequest(ctx: Ctx, action: Extract<Action, { type: 'REQUEST' }>) {
  if (ctx.s.pendingWindow !== null) throw new IllegalActionError('A window is open');
  if (ctx.s.resume.kind !== 'AWAIT_REQUEST') throw new IllegalActionError('Not awaiting a request');
  const current = ctx.s.players[ctx.s.currentPlayerIndex];
  if (action.playerId !== current.id) throw new IllegalActionError('Not your turn');
  if (action.targetId === action.playerId) throw new IllegalActionError('Cannot request from yourself');
  const target = getPlayer(ctx, action.targetId);
  const asker = getPlayer(ctx, action.playerId);
  if (target.stunned) throw new IllegalActionError('Target is stunned and cannot be requested from');
  if (action.rank === EGGS) throw new IllegalActionError('Eggs cannot be requested');
  if (!isPowerRank(action.rank) && !isNormalRank(action.rank)) throw new IllegalActionError('Invalid rank');
  if (!hasRealCard(asker, action.rank)) {
    throw new IllegalActionError('You must hold a real card of the requested rank to ask for it');
  }

  push(ctx, { type: 'REQUEST_MADE', askerId: asker.id, targetId: target.id, rank: action.rank });

  const request: RequestResume = { askerId: asker.id, targetId: target.id, rank: action.rank };
  ctx.s.resume = { kind: 'REQUEST_DECLARED', request };

  const lanternfishGrants = grantsForPlayer(ctx, target.id, 'lanternfish');
  if (lanternfishGrants.length > 0) {
    openWindow(ctx, 'REQUEST_DECLARED', [target.id], { askerId: asker.id, targetId: target.id, rank: action.rank });
  } else {
    afterRequestDeclared(ctx, false);
  }
}

function handleDeclareLanternfish(ctx: Ctx, action: Extract<Action, { type: 'DECLARE_LANTERNFISH' }>) {
  requireWindow(ctx, 'REQUEST_DECLARED', action.playerId);
  const grant = findGrant(ctx, action.grantId);
  if (grant.ownerId !== action.playerId || grant.rank !== 'lanternfish' || grant.used) {
    throw new IllegalActionError('Invalid lanternfish grant');
  }
  closeWindow(ctx, 'REQUEST_DECLARED');
  recordPowerUsed(ctx, grant);
  afterRequestDeclared(ctx, true);
}

function afterRequestDeclared(ctx: Ctx, reflected: boolean) {
  if (ctx.s.pendingWindow) closeWindow(ctx, 'REQUEST_DECLARED');
  if (ctx.s.resume.kind !== 'REQUEST_DECLARED') throw new IllegalActionError('Invalid state');
  const request = ctx.s.resume.request;
  const asker = getPlayer(ctx, request.askerId);
  const target = getPlayer(ctx, request.targetId);

  if (reflected) {
    request.reflectedTo = target.id;
    const askerHasCards = hasRealCard(asker, request.rank);
    if (askerHasCards) {
      request.outcome = 'reflected_success';
      request.loserId = asker.id;
      request.gainerId = target.id;
      request.movingCardIds = realCardsOfRank(asker, request.rank).map((c) => c.id);
    } else {
      request.outcome = 'reflected_fail';
      request.movingCardIds = [];
    }
    ctx.s.resume = { kind: 'TRANSFER_PENDING', request };
    openTransferPendingWindow(ctx);
    return;
  }

  const trueHasCards = hasRealCard(target, request.rank);
  ctx.s.resume = { kind: 'RESPONSE_PENDING', request, trueHasCards };
  const squidGrants = grantsForPlayer(ctx, target.id, 'squid');
  if (squidGrants.length > 0) {
    openWindow(ctx, 'RESPONSE_PENDING', [target.id], {
      askerId: asker.id,
      targetId: target.id,
      rank: request.rank,
    });
  } else {
    afterResponsePending(ctx, null);
  }
}

function handleDeclareSquid(ctx: Ctx, action: Extract<Action, { type: 'DECLARE_SQUID' }>) {
  requireWindow(ctx, 'RESPONSE_PENDING', action.playerId);
  if (ctx.s.resume.kind !== 'RESPONSE_PENDING') throw new IllegalActionError('Invalid state');
  const grant = findGrant(ctx, action.grantId);
  if (grant.ownerId !== action.playerId || grant.rank !== 'squid' || grant.used) {
    throw new IllegalActionError('Invalid squid grant');
  }
  const { trueHasCards } = ctx.s.resume;
  if (action.lie === 'deny' && !trueHasCards) throw new IllegalActionError('Nothing to deny');
  if (action.lie === 'claim' && trueHasCards) throw new IllegalActionError('Nothing to claim falsely');
  // No WINDOW_CLOSED/POWER_USED event for squid: absolute secrecy, no exceptions.
  ctx.s.pendingWindow = null;
  recordPowerUsed(ctx, grant);
  afterResponsePending(ctx, action.lie);
}

function afterResponsePending(ctx: Ctx, lie: 'deny' | 'claim' | null) {
  if (ctx.s.pendingWindow) closeWindow(ctx, 'RESPONSE_PENDING');
  if (ctx.s.resume.kind !== 'RESPONSE_PENDING') throw new IllegalActionError('Invalid state');
  const { request, trueHasCards } = ctx.s.resume;
  const target = getPlayer(ctx, request.targetId);

  const success = lie === null && trueHasCards;
  if (success) {
    request.outcome = 'success';
    request.loserId = target.id;
    request.gainerId = request.askerId;
    request.movingCardIds = realCardsOfRank(target, request.rank).map((c) => c.id);
  } else {
    request.outcome = 'fail';
    request.movingCardIds = [];
  }
  ctx.s.resume = { kind: 'TRANSFER_PENDING', request };
  openTransferPendingWindow(ctx);
}

function openTransferPendingWindow(ctx: Ctx) {
  if (ctx.s.resume.kind !== 'TRANSFER_PENDING') throw new IllegalActionError('Invalid state');
  const { request } = ctx.s.resume;
  const hasMovement =
    (request.outcome === 'success' || request.outcome === 'reflected_success') &&
    (request.movingCardIds?.length ?? 0) > 0;

  if (!hasMovement) {
    afterTransferPending(ctx, false);
    return;
  }

  const loserId = request.loserId!;
  const standing = activeTortoiseProtection(ctx, loserId, request.rank);
  if (standing) {
    afterTransferPending(ctx, true);
    return;
  }

  const tortoiseGrants = grantsForPlayer(ctx, loserId, 'tortoise');
  if (tortoiseGrants.length > 0) {
    openWindow(ctx, 'TRANSFER_PENDING', [loserId], {
      askerId: request.askerId,
      targetId: request.targetId,
      rank: request.rank,
      loserId,
    });
  } else {
    afterTransferPending(ctx, false);
  }
}

function handleDeclareTortoise(ctx: Ctx, action: Extract<Action, { type: 'DECLARE_TORTOISE' }>) {
  requireWindow(ctx, 'TRANSFER_PENDING', action.playerId);
  if (ctx.s.resume.kind !== 'TRANSFER_PENDING') throw new IllegalActionError('Invalid state');
  const grant = findGrant(ctx, action.grantId);
  if (grant.ownerId !== action.playerId || grant.rank !== 'tortoise' || grant.used) {
    throw new IllegalActionError('Invalid tortoise grant');
  }
  if (action.rank !== ctx.s.resume.request.rank) {
    throw new IllegalActionError('Tortoise must protect the rank under attack');
  }
  closeWindow(ctx, 'TRANSFER_PENDING');
  recordPowerUsed(ctx, grant);
  ctx.s.tortoiseProtections.push({
    id: genId(ctx, 'tp'),
    ownerId: action.playerId,
    rank: action.rank,
    expiresAtNextTurnOf: action.playerId,
  });
  afterTransferPending(ctx, true);
}

function afterTransferPending(ctx: Ctx, blocked: boolean) {
  if (ctx.s.pendingWindow) closeWindow(ctx, 'TRANSFER_PENDING');
  if (ctx.s.resume.kind !== 'TRANSFER_PENDING') throw new IllegalActionError('Invalid state');
  const { request } = ctx.s.resume;

  if (blocked) {
    push(ctx, { type: 'TORTOISE_BLOCK', playerId: request.loserId ?? request.askerId, rank: request.rank });
    request.outcome = 'blocked';
    request.movingCardIds = [];
  } else if (request.outcome === 'success' || request.outcome === 'reflected_success') {
    const loser = getPlayer(ctx, request.loserId!);
    const gainer = getPlayer(ctx, request.gainerId!);
    const ids = new Set(request.movingCardIds);
    const moving = loser.hand.filter((c) => ids.has(c.id));
    loser.hand = loser.hand.filter((c) => !ids.has(c.id));
    gainer.hand.push(...moving);
    if (request.outcome === 'success') {
      push(ctx, {
        type: 'REQUEST_SUCCEEDED',
        askerId: request.askerId,
        targetId: request.targetId,
        rank: request.rank,
        count: moving.length,
      });
    } else {
      push(ctx, {
        type: 'LANTERNFISH_REFLECT',
        playerId: gainer.id,
        fromId: loser.id,
        rank: request.rank,
        count: moving.length,
      });
    }
  } else if (request.outcome === 'fail') {
    push(ctx, { type: 'REQUEST_FAILED', askerId: request.askerId, targetId: request.targetId, rank: request.rank });
  }
  // reflected_fail: nothing to report, no cards moved, no draw.

  ctx.s.resume = { kind: 'TURN_END', request };

  const canSteal = request.outcome === 'success' || request.outcome === 'reflected_success';
  if (canSteal) {
    const gainerId = request.gainerId!;
    const sharkEligible = ctx.s.players
      .filter((p) => p.id !== gainerId)
      .filter((p) => grantsForPlayer(ctx, p.id, 'shark').length > 0)
      .map((p) => p.id);
    if (sharkEligible.length > 0) {
      openWindow(ctx, 'TURN_END', sharkEligible, {
        askerId: request.askerId,
        targetId: request.targetId,
        rank: request.rank,
        gainerId,
      });
      return;
    }
  }
  afterTurnEnd(ctx, false);
}

function handleDeclareShark(ctx: Ctx, action: Extract<Action, { type: 'DECLARE_SHARK' }>) {
  requireWindow(ctx, 'TURN_END', action.playerId);
  if (ctx.s.resume.kind !== 'TURN_END') throw new IllegalActionError('Invalid state');
  const request = ctx.s.resume.request;
  const grant = findGrant(ctx, action.grantId);
  if (grant.ownerId !== action.playerId || grant.rank !== 'shark' || grant.used) {
    throw new IllegalActionError('Invalid shark grant');
  }
  if (action.playerId === request.gainerId) throw new IllegalActionError('Cannot jump your own gain');
  closeWindow(ctx, 'TURN_END');
  recordPowerUsed(ctx, grant);

  const gainer = getPlayer(ctx, request.gainerId!);
  const sharkPlayer = getPlayer(ctx, action.playerId);
  const ids = new Set(request.movingCardIds);
  const moving = gainer.hand.filter((c) => ids.has(c.id));
  gainer.hand = gainer.hand.filter((c) => !ids.has(c.id));
  sharkPlayer.hand.push(...moving);
  push(ctx, {
    type: 'SHARK_JUMP',
    playerId: sharkPlayer.id,
    fromId: gainer.id,
    rank: request.rank,
    count: moving.length,
  });
  afterTurnEnd(ctx, true);
}

function afterTurnEnd(ctx: Ctx, sharkJumped: boolean) {
  if (ctx.s.pendingWindow) closeWindow(ctx, 'TURN_END');
  if (ctx.s.resume.kind !== 'TURN_END') throw new IllegalActionError('Invalid state');
  const { request } = ctx.s.resume;
  const askerId = request.askerId;

  let bonusTurn = false;
  let drawsFromPool = false;

  if (request.reflectedTo) {
    // Lanternfish path: turn always ends, never a bonus, never a pool draw.
  } else if (sharkJumped) {
    // Shark stole the capture; asker's bonus is forfeit, no consolation draw.
  } else if (request.outcome === 'success') {
    bonusTurn = true;
    push(ctx, { type: 'BONUS_TURN', playerId: askerId });
  } else if (request.outcome === 'fail' || request.outcome === 'blocked') {
    drawsFromPool = true;
  }

  let actuallyDrew = false;
  if (drawsFromPool && ctx.s.pool.length > 0) {
    const asker = getPlayer(ctx, askerId);
    const card = ctx.s.pool.pop()!;
    asker.hand.push(card);
    push(ctx, { type: 'DREW_FROM_POOL', playerId: askerId, cardId: card.id, poolEmpty: ctx.s.pool.length === 0 });
    actuallyDrew = true;
  }

  // See DECISIONS.md: a request that neither captures anything nor draws a card is a
  // no-op. If every player's hand is deadlocked (nobody shares a rank with anybody, and
  // the pool is empty), such no-ops could recur forever even though each individual ask
  // is technically "legal" -- so we track a streak and end the game once it's clear no
  // further progress is possible.
  const madeProgress = bonusTurn || sharkJumped || request.outcome === 'reflected_success' || actuallyDrew;
  ctx.s.staleRequestStreak = madeProgress ? 0 : ctx.s.staleRequestStreak + 1;

  ctx.s.resume = { kind: 'NONE' };

  if (checkGameEnd(ctx) || ctx.s.staleRequestStreak >= ctx.s.players.length * 2) {
    finalizeGame(ctx);
    return;
  }

  if (!bonusTurn) {
    advancePlayerIndex(ctx);
  }
  beginTurn(ctx);
}

// ---------------------------------------------------------------------------
// Active powers (TURN_START window)
// ---------------------------------------------------------------------------

function requireTurnStartGrant(ctx: Ctx, playerId: string, grantId: string, rank: PowerRank): PowerGrant {
  requireWindow(ctx, 'TURN_START', playerId);
  const grant = findGrant(ctx, grantId);
  if (grant.ownerId !== playerId || grant.rank !== rank || grant.used || !grant.bound) {
    throw new IllegalActionError(`Invalid ${rank} grant`);
  }
  return grant;
}

function handleUseJellyfish(ctx: Ctx, action: Extract<Action, { type: 'USE_JELLYFISH' }>) {
  const grant = requireTurnStartGrant(ctx, action.playerId, action.grantId, 'jellyfish');
  if (action.targetId === action.playerId) throw new IllegalActionError('Cannot stun yourself');
  const target = getPlayer(ctx, action.targetId);
  closeWindow(ctx, 'TURN_START');
  target.stunned = true;
  recordPowerUsed(ctx, grant);
  push(ctx, { type: 'JELLYFISH_STUN', playerId: action.playerId, targetId: target.id });
  settleAwaitRequest(ctx, action.playerId);
}

function handleUseStickleback(ctx: Ctx, action: Extract<Action, { type: 'USE_STICKLEBACK' }>) {
  const grant = requireTurnStartGrant(ctx, action.playerId, action.grantId, 'stickleback');
  if (action.targetId === action.playerId) throw new IllegalActionError('Cannot target yourself');
  if (!isNormalRank(action.rank)) throw new IllegalActionError('Stickleback can only target normal fish ranks');
  const target = getPlayer(ctx, action.targetId);
  closeWindow(ctx, 'TURN_START');
  const stolen = realCardsOfRank(target, action.rank);
  if (stolen.length > 0) {
    const ids = new Set(stolen.map((c) => c.id));
    target.hand = target.hand.filter((c) => !ids.has(c.id));
    getPlayer(ctx, action.playerId).hand.push(...stolen);
    push(ctx, {
      type: 'STICKLEBACK_STEAL',
      playerId: action.playerId,
      targetId: target.id,
      rank: action.rank,
      count: stolen.length,
    });
    ctx.s.staleRequestStreak = 0;
  } else {
    push(ctx, { type: 'STICKLEBACK_WASTED', playerId: action.playerId, targetId: target.id, rank: action.rank });
  }
  recordPowerUsed(ctx, grant);
  settleAwaitRequest(ctx, action.playerId);
}

function handleUseWhale(ctx: Ctx, action: Extract<Action, { type: 'USE_WHALE' }>) {
  const grant = requireTurnStartGrant(ctx, action.playerId, action.grantId, 'whale');
  if (ctx.s.players.length < 3) throw new IllegalActionError('Whale requires at least 3 players');
  if (!isAdjacentSeats(ctx.s.turnOrder, action.targetAId, action.targetBId)) {
    throw new IllegalActionError('Whale targets must be seated next to each other');
  }
  const a = getPlayer(ctx, action.targetAId);
  const b = getPlayer(ctx, action.targetBId);
  closeWindow(ctx, 'TURN_START');

  const protectedRanks = (playerId: string) =>
    new Set(ctx.s.tortoiseProtections.filter((t) => t.ownerId === playerId).map((t) => t.rank));

  const aProtectedRanks = protectedRanks(a.id);
  const bProtectedRanks = protectedRanks(b.id);
  const aProtected = a.hand.filter((c) => aProtectedRanks.has(c.rank));
  const aFree = a.hand.filter((c) => !aProtectedRanks.has(c.rank));
  const bProtected = b.hand.filter((c) => bProtectedRanks.has(c.rank));
  const bFree = b.hand.filter((c) => !bProtectedRanks.has(c.rank));

  const combined = shuffleInPlace(ctx, [...aFree, ...bFree]);
  const newAFree = combined.slice(0, aFree.length);
  const newBFree = combined.slice(aFree.length);

  a.hand = [...aProtected, ...newAFree];
  b.hand = [...bProtected, ...newBFree];

  recordPowerUsed(ctx, grant);
  push(ctx, { type: 'WHALE_SHUFFLE', playerId: action.playerId, targetAId: a.id, targetBId: b.id });
  ctx.s.staleRequestStreak = 0;
  settleAwaitRequest(ctx, action.playerId);
}

function handleSkipWindow(ctx: Ctx, action: Extract<Action, { type: 'SKIP_WINDOW' }>) {
  const w = ctx.s.pendingWindow;
  if (!w) throw new IllegalActionError('No window open to skip');
  switch (w.type) {
    case 'TURN_START': {
      const playerId = w.eligiblePlayerIds[0];
      closeWindow(ctx, 'TURN_START');
      settleAwaitRequest(ctx, playerId);
      return;
    }
    case 'REQUEST_DECLARED':
      afterRequestDeclared(ctx, false);
      return;
    case 'RESPONSE_PENDING':
      afterResponsePending(ctx, null);
      return;
    case 'TRANSFER_PENDING':
      afterTransferPending(ctx, false);
      return;
    case 'TURN_END':
      afterTurnEnd(ctx, false);
      return;
    case 'SET_COMPLETED':
      resolveSetCompleted(ctx, false);
      return;
  }
}

// ---------------------------------------------------------------------------
// Sets, eggs, power grants
// ---------------------------------------------------------------------------

function handleLaySet(ctx: Ctx, action: Extract<Action, { type: 'LAY_SET' }>) {
  if (ctx.s.pendingWindow !== null) throw new IllegalActionError('Cannot lay a set while a window is open');
  const player = getPlayer(ctx, action.playerId);
  const rank = action.rank;
  const ids = action.cardIds;
  const uniqueIds = new Set(ids);
  if (uniqueIds.size !== ids.length) throw new IllegalActionError('Duplicate card ids');

  const handById = new Map(player.hand.map((c) => [c.id, c]));
  for (const id of ids) {
    if (!handById.has(id)) throw new IllegalActionError('Card not in hand');
  }

  let eggCount = 0;
  let realCount = 0;
  for (const id of ids) {
    const card = handById.get(id)!;
    if (card.rank === EGGS) eggCount += 1;
    else if (card.rank === rank) realCount += 1;
    else throw new IllegalActionError('Card does not belong to this set');
  }

  const expectedSize = setSizeForRank(rank);
  if (ids.length !== expectedSize) throw new IllegalActionError(`${rank} sets must have ${expectedSize} cards`);

  if (rank === EGGS) {
    if (eggCount !== 4 || realCount !== 0) throw new IllegalActionError('An eggs set must be exactly 4 eggs');
  } else {
    if (eggCount > 2) throw new IllegalActionError('At most 2 eggs may substitute in a set');
    if (realCount < 2) throw new IllegalActionError('At least 2 real cards of the rank are required');
  }

  const isPower = isPowerRank(rank);
  player.hand = player.hand.filter((c) => !uniqueIds.has(c.id));
  player.score += 1;

  const faceUp = rank === 'squid' ? ctx.s.config.powerVisibility === 'deschis' : ctx.s.config.powerVisibility === 'deschis' || !isPower;

  const set: LaidSet = {
    id: genId(ctx, 'set'),
    ownerId: player.id,
    rank,
    cardIds: ids,
    eggCount,
    isPowerSet: isPower,
    faceUp,
    spent: false,
    destroyedByMantis: false,
  };
  ctx.s.laidSets.push(set);
  push(ctx, { type: 'SET_LAID', playerId: player.id, setId: set.id, rank, isPowerSet: isPower, eggCount });
  ctx.s.staleRequestStreak = 0;

  if (!isPower) {
    afterLayResolved(ctx, player.id);
    return;
  }

  const mantisEligible = ctx.s.players
    .filter((p) => grantsForPlayer(ctx, p.id, 'mantisShrimp').length > 0)
    .map((p) => p.id);
  if (mantisEligible.length > 0) {
    openWindow(ctx, 'SET_COMPLETED', mantisEligible, { setId: set.id, ownerId: player.id, rank });
  } else {
    grantPowerFromSet(ctx, set.id);
    afterLayResolved(ctx, player.id);
  }
}

function handleDeclareMantis(ctx: Ctx, action: Extract<Action, { type: 'DECLARE_MANTIS' }>) {
  requireWindow(ctx, 'SET_COMPLETED', action.playerId);
  const grant = findGrant(ctx, action.grantId);
  if (grant.ownerId !== action.playerId || grant.rank !== 'mantisShrimp' || grant.used) {
    throw new IllegalActionError('Invalid mantis shrimp grant');
  }
  resolveSetCompleted(ctx, true, grant);
}

function resolveSetCompleted(ctx: Ctx, destroyed: boolean, grant?: PowerGrant) {
  const w = ctx.s.pendingWindow;
  if (!w || w.type !== 'SET_COMPLETED') throw new IllegalActionError('No SET_COMPLETED window open');
  const setId = w.context.setId as string;
  closeWindow(ctx, 'SET_COMPLETED');
  const set = findSet(ctx, setId);
  if (destroyed && grant && set) {
    recordPowerUsed(ctx, grant);
    set.destroyedByMantis = true;
    set.spent = true;
    if (set.rank !== 'squid') set.faceUp = true;
    push(ctx, { type: 'SET_DESTROYED', setId: set.id, byPlayerId: grant.ownerId });
  }
  grantPowerFromSet(ctx, setId);
  if (set) afterLayResolved(ctx, set.ownerId);
}

/**
 * Rule 2.8 says a player draws up to 3 at the *start* of their turn if their hand is
 * empty. Laying a set can also empty a player's hand mid-turn; without a top-up here
 * they'd be stuck (no cards to request with, no explicit "pass" action exists), so we
 * apply the same refill immediately when that happens to the player currently on the
 * clock. See DECISIONS.md.
 */
function afterLayResolved(ctx: Ctx, playerId: string) {
  const current = ctx.s.players[ctx.s.currentPlayerIndex];
  if (!current || current.id !== playerId) return;
  if (ctx.s.resume.kind !== 'AWAIT_REQUEST') return;
  if (!hasNoRealCards(current)) return;
  if (findLayableSetsForPlayer(ctx, current.id).length > 0) return; // they still have something to lay

  if (ctx.s.pool.length > 0) {
    const count = Math.min(3, ctx.s.pool.length);
    for (let i = 0; i < count; i++) current.hand.push(ctx.s.pool.pop()!);
    push(ctx, { type: 'HAND_REFILLED', playerId: current.id, count });
    ctx.s.staleRequestStreak = 0;
    return;
  }

  if (checkGameEnd(ctx)) {
    finalizeGame(ctx);
    return;
  }
  // No cards, no pool: this player has no legal request. Pass the turn onward.
  advancePlayerIndex(ctx);
  beginTurn(ctx);
}

function grantPowerFromSet(ctx: Ctx, setId: string) {
  const set = findSet(ctx, setId);
  if (!set || set.destroyedByMantis || set.rank === EGGS) return;

  if (set.rank === 'clownfish') {
    const grant: PowerGrant = {
      id: genId(ctx, 'grant'),
      ownerId: set.ownerId,
      rank: 'clownfish',
      sourceSetId: set.id,
      used: false,
      bound: false,
      isClownfishCopy: false,
    };
    ctx.s.powerGrants.push(grant);
    push(ctx, {
      type: 'POWER_GRANTED',
      playerId: set.ownerId,
      grantId: grant.id,
      rank: 'clownfish',
      sourceSetId: set.id,
      unbound: true,
    });
    const lastDistinct = [...ctx.s.usedPowerHistory].reverse().find((h) => !h.wasClownfishCopy);
    if (lastDistinct) {
      bindClownfish(ctx, grant, lastDistinct.rank);
    } else {
      ctx.s.pendingClownfishBindings.push(grant.id);
    }
    return;
  }

  const grant: PowerGrant = {
    id: genId(ctx, 'grant'),
    ownerId: set.ownerId,
    rank: set.rank as PowerRank,
    sourceSetId: set.id,
    used: false,
    bound: true,
    isClownfishCopy: false,
  };
  ctx.s.powerGrants.push(grant);
  push(ctx, {
    type: 'POWER_GRANTED',
    playerId: set.ownerId,
    grantId: grant.id,
    rank: grant.rank,
    sourceSetId: set.id,
    unbound: false,
  });
}

function bindClownfish(ctx: Ctx, grant: PowerGrant, rank: PowerRank) {
  grant.rank = rank;
  grant.bound = true;
  grant.isClownfishCopy = true;
  push(ctx, { type: 'CLOWNFISH_BOUND', playerId: grant.ownerId, grantId: grant.id, boundRank: rank });
}

/** Marks a grant as used, updates history/clownfish bindings, and flips the source set's visibility.
 *  Emits no POWER_USED event when the effective rank is squid: absolute secrecy, no exceptions. */
function recordPowerUsed(ctx: Ctx, grant: PowerGrant) {
  grant.used = true;
  ctx.s.usedPowerHistory.push({ rank: grant.rank, grantId: grant.id, wasClownfishCopy: grant.isClownfishCopy });

  if (!grant.isClownfishCopy && ctx.s.pendingClownfishBindings.length > 0) {
    const pending = ctx.s.pendingClownfishBindings;
    ctx.s.pendingClownfishBindings = [];
    for (const gid of pending) {
      const g = findGrant(ctx, gid);
      bindClownfish(ctx, g, grant.rank);
    }
  }

  const set = findSet(ctx, grant.sourceSetId);
  if (set) {
    set.spent = true;
    if (grant.rank !== 'squid') {
      set.faceUp = ctx.s.config.powerVisibility === 'ascuns';
    }
  }

  if (grant.rank !== 'squid') {
    push(ctx, { type: 'POWER_USED', playerId: grant.ownerId, grantId: grant.id, rank: grant.rank });
  }
}

// ---------------------------------------------------------------------------
// Game end
// ---------------------------------------------------------------------------

function checkGameEnd(ctx: Ctx): boolean {
  if (ctx.s.pool.length > 0) return false;
  return ctx.s.players.every((p) => p.hand.every((c) => c.rank === EGGS));
}

function finalizeGame(ctx: Ctx) {
  ctx.s.status = 'ENDED';
  ctx.s.pendingWindow = null;
  ctx.s.resume = { kind: 'NONE' };
  const scores: Record<string, number> = {};
  for (const p of ctx.s.players) scores[p.id] = p.score;
  const maxScore = Math.max(...ctx.s.players.map((p) => p.score));
  let contenders = ctx.s.players.filter((p) => p.score === maxScore).map((p) => p.id);
  if (contenders.length > 1) {
    const powerSetCount = (id: string) => ctx.s.laidSets.filter((s) => s.ownerId === id && s.isPowerSet).length;
    const maxPower = Math.max(...contenders.map(powerSetCount));
    contenders = contenders.filter((id) => powerSetCount(id) === maxPower);
  }
  ctx.s.winners = contenders;
  push(ctx, { type: 'GAME_ENDED', scores, winners: contenders });
}
