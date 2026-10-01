import { randomInt, randomUUID } from 'node:crypto';
import type WebSocket from 'ws';
import {
  Action,
  askableRanks,
  createGame,
  GameEvent,
  GameState,
  legalRequestTargets,
  redactEventsForPlayer,
  redactForPlayer,
  reduce,
} from '@pescuit/engine';
import type { ClientAction, RoomConfig, RoomPlayerSummary, ServerMessage, WireEvent } from '@pescuit/shared';
import { bindAction } from './bindAction.js';
import { secureDeck } from './random.js';

export interface RoomPlayer {
  id: string;
  token: string;
  name: string;
  ws: WebSocket | null;
  connected: boolean;
  isHost: boolean;
}

const envMs = (name: string, fallback: number): number => {
  const v = Number(typeof process !== 'undefined' ? process.env[name] : undefined);
  return Number.isFinite(v) && v >= 1000 ? v : fallback;
};
/** Every ask gets this long (HAND_AND_TURN_PLAN #4); `PESCUIT_TURN_MS` overrides it. Paused while a window is open; laying a
 *  set does not restart it. */
export const TURN_TIMEOUT_MS = envMs('PESCUIT_TURN_MS', 45_000);
/** The last stretch of the turn clock burns as the rope (#5); `PESCUIT_ROPE_MS` overrides it (never longer than the turn). */
export const ROPE_MS = Math.min(TURN_TIMEOUT_MS, envMs('PESCUIT_ROPE_MS', 15_000));

function send(ws: WebSocket, msg: ServerMessage) {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
}

export class Room {
  code: string;
  config: RoomConfig;
  players: RoomPlayer[] = [];
  state: GameState | null = null;
  started = false;
  createdAt: number;
  /** server ms when the game started; the background score's zero (MUSIC_PLAN §5.1) */
  startedAt = 0;
  /** timestamp since the room has had zero connected players, or null while someone is connected */
  emptySince: number | null = Date.now();
  /** per-room, strictly increasing: every event is stamped with the next value, every view carries the last */
  seq = 0;
  /** the server clock (ms) at which the currently open window will be closed by the timeout, or null */
  windowDeadlineAt: number | null = null;
  private windowTimer: ReturnType<typeof setTimeout> | null = null;
  /** a full ask's allowance and the rope's share of it; tests shorten them */
  turnTimeoutMs = TURN_TIMEOUT_MS;
  ropeMs = ROPE_MS;
  /** the server clock (ms) at which the current ask will be made for the player, or null while no turn clock runs */
  turnDeadlineAt: number | null = null;
  private turnTimer: ReturnType<typeof setTimeout> | null = null;
  /** counts asks: a new turn or a new request starts a new ask, with a full allowance */
  private askSlot = 0;
  private armedSlot = -1;
  /** what is left of the current ask's allowance while a window has it paused */
  private turnRemainingMs = 0;

  constructor(code: string, config: RoomConfig, private now: () => number = Date.now) {
    this.code = code;
    this.config = config;
    this.createdAt = now();
  }

  get isEmpty(): boolean {
    return this.players.every((p) => !p.connected);
  }

  addPlayer(name: string, ws: WebSocket): RoomPlayer {
    if (this.started) throw new Error('Game already started');
    if (this.players.length >= 6) throw new Error('Room is full (6 players max)');
    const player: RoomPlayer = {
      id: randomUUID(),
      token: randomUUID(),
      name: name.slice(0, 24) || 'Player',
      ws,
      connected: true,
      isHost: this.players.length === 0,
    };
    this.players.push(player);
    this.emptySince = null;
    return player;
  }

  rejoin(token: string, ws: WebSocket): RoomPlayer | null {
    const player = this.players.find((p) => p.token === token);
    if (!player) return null;
    player.ws = ws;
    player.connected = true;
    this.emptySince = null;
    if (this.state) {
      const sp = this.state.players.find((p) => p.id === player.id);
      if (sp) sp.connected = true;
    }
    return player;
  }

  /**
   * A socket closed. If the player has already rejoined on a newer socket (a half-dead old socket
   * whose close event arrives late), that is not a disconnect and nothing changes.
   */
  disconnect(playerId: string, ws?: WebSocket): boolean {
    const player = this.players.find((p) => p.id === playerId);
    if (!player) return false;
    if (ws && player.ws !== ws) return false;
    player.connected = false;
    player.ws = null;
    if (this.state) {
      const sp = this.state.players.find((p) => p.id === playerId);
      if (sp) sp.connected = false;
    }
    if (this.isEmpty) this.emptySince = this.now();
    return true;
  }

  roomSummary(): RoomPlayerSummary[] {
    return this.players.map((p) => ({ id: p.id, name: p.name, connected: p.connected, isHost: p.isHost }));
  }

  start() {
    if (this.started) throw new Error('Game already started');
    if (this.players.length < 3) throw new Error('Need at least 3 players to start');
    // The deal comes from the OS CSPRNG; card ids are random UUIDs. No seed exists (§6.3).
    const { state, events } = createGame(
      this.players.map((p) => ({ id: p.id, name: p.name })),
      secureDeck(),
      this.config,
    );
    this.state = state;
    this.started = true;
    this.startedAt = this.now();
    this.broadcastRoomUpdate();
    this.publish(events);
  }

  /**
   * Applies a client's action. The action is bound to the submitting player (§6.4): whatever
   * `playerId` the client claimed is overwritten with the socket's own, `entropy` is never taken
   * from a client, and only client action types are accepted.
   */
  applyAction(playerId: string, raw: ClientAction) {
    if (!this.state) throw new Error('Game has not started');
    if (!this.state.players.some((p) => p.id === playerId)) throw new Error('Not a player in this game');
    this.commit(bindAction(playerId, raw));
  }

  private commit(action: Action) {
    if (!this.state) throw new Error('Game has not started');
    const { state, events } = reduce(this.state, action);
    this.state = state;
    this.publish(events);
  }

  private publish(events: GameEvent[]) {
    if (events.some((e) => e.type === 'TURN_STARTED' || e.type === 'REQUEST_MADE')) this.askSlot++;
    // arm first: the views sent below carry this window's deadline and the turn clock
    this.armWindowTimer();
    this.armTurnTimer();
    this.broadcastState(events);
  }

  /** the current player is at rest, awaiting their ask, with no window open */
  private awaitingAsk(): boolean {
    const s = this.state;
    return !!s && s.status === 'IN_PROGRESS' && !s.pendingWindow && s.resume.kind === 'AWAIT_REQUEST';
  }

  /**
   * The turn clock (HAND_AND_TURN_PLAN #4, closes DECISIONS.md "Absent players"). Each ask gets `turnTimeoutMs`. The
   * clock runs only while the player is awaiting their ask: an open window pauses it (the window has its own 12 s),
   * and it resumes with what was left. Laying a set leaves it running. When it runs out the room makes the ask for the
   * player - a random legal request, as a bot would - so a player who stepped away or dropped never freezes the table.
   */
  private armTurnTimer() {
    const now = this.now();
    if (this.armedSlot !== this.askSlot) {
      this.clearTurnTimer();
      this.armedSlot = this.askSlot;
      this.turnRemainingMs = this.turnTimeoutMs;
    }
    if (!this.awaitingAsk()) {
      if (this.turnDeadlineAt !== null) this.turnRemainingMs = Math.max(0, this.turnDeadlineAt - now);
      this.clearTurnTimer();
      return;
    }
    if (this.turnTimer) return; // still running for this ask (a set was laid): keep the deadline
    const ms = Math.max(0, this.turnRemainingMs);
    const slot = this.askSlot;
    this.turnDeadlineAt = now + ms;
    this.turnTimer = setTimeout(() => {
      this.turnTimer = null;
      if (slot !== this.askSlot || !this.awaitingAsk()) return;
      this.turnDeadlineAt = null;
      this.turnRemainingMs = 0;
      const action = this.autoAsk();
      if (!action) return;
      try {
        this.commit(action);
      } catch {
        // the state moved in a race with the player's own ask; ignore
      }
    }, ms);
    this.turnTimer.unref?.();
  }

  private clearTurnTimer() {
    if (this.turnTimer) clearTimeout(this.turnTimer);
    this.turnTimer = null;
    this.turnDeadlineAt = null;
  }

  /** The ask the room makes for a player whose clock ran out: one of their askable ranks, of one legal target. */
  autoAsk(): Action | null {
    const s = this.state;
    if (!s || s.resume.kind !== 'AWAIT_REQUEST') return null;
    const player = s.players[s.currentPlayerIndex];
    const ranks = askableRanks(player);
    const targets = legalRequestTargets(s, player.id);
    if (!ranks.length || !targets.length) return null;
    return { type: 'REQUEST', playerId: player.id, targetId: targets[randomInt(targets.length)], rank: ranks[randomInt(ranks.length)] };
  }

  /**
   * Enforces the interrupt-window deadline (windowTimeoutMs, 12 s by default). If nobody eligible
   * answers in time, the room submits the server-only skip, which is the truthful, non-declaring
   * answer: it is also how an absent (disconnected) player's answer is given. A player who is
   * away on their own TURN is still waited for (DECISIONS.md, "Absent players").
   */
  private armWindowTimer() {
    if (this.windowTimer) {
      clearTimeout(this.windowTimer);
      this.windowTimer = null;
    }
    this.windowDeadlineAt = null;
    if (!this.state || this.state.status !== 'IN_PROGRESS' || !this.state.pendingWindow) return;
    const ms = this.state.config.windowTimeoutMs;
    this.windowDeadlineAt = this.now() + ms;
    this.windowTimer = setTimeout(() => {
      this.windowTimer = null;
      try {
        this.commit({ type: 'SERVER_SKIP_WINDOW' });
      } catch {
        // the window may have closed in a race with a real declaration; ignore
      }
    }, ms);
    this.windowTimer.unref?.();
  }

  /** Stops the room's timer (used when a room is dropped, and by tests). */
  dispose() {
    if (this.windowTimer) clearTimeout(this.windowTimer);
    this.windowTimer = null;
    this.clearTurnTimer();
  }

  /**
   * Sends every player the current view and their own redacted slice of `events`. Events are
   * stamped with the room's next seq BEFORE redaction, so a given event has the same seq for
   * everyone, and a viewer who may not see an event just has a gap. Views carry the seq of the
   * last event stamped. `snapshotTo` marks one player's message as a resync (a rejoin).
   */
  broadcastState(events: GameEvent[], snapshotTo?: string) {
    if (!this.state) return;
    const stamped = events.map((e) => ({ ...e, seq: ++this.seq }));
    const serverNow = this.now();
    for (const player of this.players) {
      if (!player.ws) continue;
      const view = redactForPlayer(this.state, player.id, {
        seq: this.seq,
        serverNow,
        windowDeadlineAt: this.windowDeadlineAt,
        startedAt: this.startedAt,
        turnClock: this.turnDeadlineAt === null ? null : { deadlineAt: this.turnDeadlineAt, totalMs: this.turnTimeoutMs, ropeMs: this.ropeMs },
      });
      const msg: ServerMessage = {
        type: 'game_state',
        view,
        events: redactEventsForPlayer(this.state, stamped, player.id) as WireEvent[],
      };
      if (player.id === snapshotTo) {
        msg.snapshot = true;
        msg.events = [];
      }
      send(player.ws, msg);
    }
  }

  broadcastRoomUpdate() {
    const msg: ServerMessage = {
      type: 'room_update',
      roomCode: this.code,
      players: this.roomSummary(),
      started: this.started,
      config: this.config,
      serverNow: this.now(),
      createdAt: this.createdAt,
    };
    for (const player of this.players) {
      if (player.ws) send(player.ws, msg);
    }
  }
}
