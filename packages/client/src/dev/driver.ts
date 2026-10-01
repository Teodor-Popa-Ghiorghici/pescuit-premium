/* A table that runs in this tab (§7.1-§7.2): the real engine, a bot population, and seat N's
 * redacted view and events fed into the real store through the same message path a WebSocket
 * uses. It plays the room's part: it stamps events with a seq, arms the window deadline and submits
 * the server-only skip when it passes, attaches the Whale's entropy, and binds the human's actions.
 * Lazy-loaded from main.tsx: nothing here is in the normal bundle. */
import {
  askableRanks,
  createGame,
  createMemoryBot,
  findLayableSets,
  legalRequestTargets,
  makeBotRng,
  nextBotAction,
  redactEventsForPlayer,
  redactForPlayer,
  reduce,
  type Action,
  type BotRng,
  type GameEvent,
  type GameState,
  type MemoryBot,
  type RedactedView,
} from '@pescuit/engine';
import type { ClientMessage, RoomConfig, RoomPlayerSummary, ServerMessage, WireEvent } from '@pescuit/shared';
import type { LocalSource } from '../state/store.js';

export const NAMES = ['Ana', 'Bogdan', 'Cezar', 'Dana', 'Elena', 'Florin'];

export interface DriverOptions {
  state: GameState;
  events?: GameEvent[];
  humanId: string;
  bots: 'random' | 'memory';
  /** 0 = paused */
  speed: number;
  /** the human's seat is played by a bot too: watch */
  auto?: boolean;
  seed: number;
  /** what the human's actions do in a fixture: nothing is executed, only logged */
  frozen?: boolean;
  /** the first message is a snapshot: no choreography for the events it carries */
  openAsSnapshot?: boolean;
  /** rewrites every view before it is delivered (a fixture pins the tally or the gate) */
  viewPatch?: (v: RedactedView) => RedactedView;
  /** the human's turn clock, ms per ask (`turn=`; the room's 45 s by default) and its rope (`rope=`, 15 s) */
  turnMs?: number;
  ropeMs?: number;
}

export interface DriverInfo {
  paused: boolean;
  speed: number;
  auto: boolean;
  seq: number;
  turn: number;
  pool: number;
  sets: number;
  misses: number;
  limit: number;
  status: string;
  last: string;
}

/** how long the local room takes to answer a human's action */
const REPLY_MS = 24;

const pick = <T,>(rng: BotRng, a: T[]): T => a[Math.floor(rng.next() * a.length)];

export class LocalDriver implements LocalSource {
  roomCode = 'BOTS';
  players: RoomPlayerSummary[];
  config: RoomConfig;
  playerId: string;
  state: GameState;
  seq = 0;
  paused: boolean;
  speed: number;
  auto: boolean;
  readonly actionLog: string[] = [];
  private deliver: ((m: ServerMessage) => void) | null = null;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private deadline: number | null = null;
  /** the human's turn clock, as the room keeps it (HAND_AND_TURN_PLAN #4): one allowance per ask, paused by a window */
  private turnDeadline: number | null = null;
  private turnLeft = 0;
  private askSlot = 0;
  private armedSlot = -1;
  private pausedAt = 0;
  private rng: BotRng;
  private memory: MemoryBot | null;
  private started = false;
  /** the score clock's zero, as the room would set it */
  private readonly startedAt = Date.now();
  private pending: GameEvent[];
  private listeners = new Set<() => void>();
  lastText = '';

  constructor(private o: DriverOptions) {
    this.state = o.state;
    this.playerId = o.humanId;
    this.players = o.state.players.map((p, i) => ({ id: p.id, name: p.name, connected: true, isHost: i === 0 }));
    this.config = { powerVisibility: o.state.config.powerVisibility };
    this.speed = o.speed || 1;
    this.paused = o.speed === 0;
    this.auto = !!o.auto;
    this.rng = makeBotRng(o.seed * 7 + 1);
    this.memory = o.bots === 'memory' ? createMemoryBot(o.state.players.map((p) => p.id), o.state.config.powerVisibility === 'ascuns') : null;
    this.pending = o.events ?? [];
    this.memory?.observe(this.pending);
    if (this.state.pendingWindow) this.deadline = Date.now() + this.state.config.windowTimeoutMs;
  }

  /* ------------------------------------------------------------ LocalSource */

  start(deliver: (m: ServerMessage) => void): () => void {
    this.deliver = deliver;
    if (!this.started) {
      this.started = true;
      // a table reached on purpose (a fixture, `until=`) opens as a snapshot: the last few lines are in the
      // log, but nothing replays. A fresh bot game opens with its GAME_STARTED, and the ceremony plays.
      this.emit(this.pending, this.o.openAsSnapshot);
      this.pending = [];
    } else this.emit([], true);
    this.schedule();
    return () => {
      this.deliver = null;
      clearTimeout(this.timer);
      clearInterval(this.hold);
    };
  }

  send(msg: ClientMessage): void {
    if (msg.type !== 'action') return;
    const a = { ...msg.action, playerId: this.playerId } as Action;
    if (a.type === 'USE_WHALE') a.entropy = Array.from(crypto.getRandomValues(new Uint32Array(4)));
    if (this.o.frozen) {
      this.actionLog.push(JSON.stringify(msg.action));
      this.tellListeners();
      return;
    }
    // the room answers like a server a LAN away, not inside the tap's own task: the input's first paint is
    // the plank locking, and the reply is processed after it (that cost is measured as answer -> rest)
    setTimeout(() => {
      try {
        this.act(a);
      } catch (e) {
        this.deliver?.({ type: 'error', message: e instanceof Error ? e.message : String(e) });
      }
    }, REPLY_MS);
  }

  /* ------------------------------------------------------------- control */

  subscribe(cb: () => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }
  private tellListeners() {
    this.listeners.forEach((l) => l());
  }

  pause(): void {
    if (this.paused) return;
    this.paused = true;
    this.pausedAt = Date.now();
    clearTimeout(this.timer);
    this.tellListeners();
  }
  resume(): void {
    if (!this.paused) return;
    this.paused = false;
    // the window clock does not run while paused
    if (this.deadline !== null) this.deadline += Date.now() - this.pausedAt;
    this.emit([], true);
    this.schedule();
    this.tellListeners();
  }
  /** performs one bot action now, paused or not */
  step(): void {
    const was = this.paused;
    this.paused = false;
    this.advance(true);
    this.paused = was;
    this.tellListeners();
  }
  setSpeed(v: number): void {
    this.speed = v;
    this.tellListeners();
    if (!this.paused) this.schedule();
  }
  setAuto(v: boolean): void {
    this.auto = v;
    this.tellListeners();
    if (!this.paused) this.schedule();
  }

  info(): DriverInfo {
    const v = this.view();
    return {
      paused: this.paused,
      speed: this.speed,
      auto: this.auto,
      seq: this.seq,
      turn: this.state.turnCounter,
      pool: v.poolCount,
      sets: v.sets.possible,
      misses: v.endPressure.misses,
      limit: v.endPressure.limit,
      status: this.state.status + (this.state.endReason ? `:${this.state.endReason}` : ''),
      last: this.lastText,
    };
  }

  /* ---------------------------------------------------------------- engine */

  private view(): RedactedView {
    const turnClock = this.turnDeadline === null ? null : { deadlineAt: this.turnDeadline, totalMs: this.turnMs, ropeMs: this.o.ropeMs ?? 15_000 };
    const v = redactForPlayer(this.state, this.playerId, { seq: this.seq, serverNow: Date.now(), windowDeadlineAt: this.state.pendingWindow ? this.deadline : null, startedAt: this.startedAt, turnClock });
    return this.o.viewPatch ? this.o.viewPatch(v) : v;
  }

  private get turnMs(): number {
    return this.o.turnMs ?? 45_000;
  }

  /** the room's turn clock, for the human's asks only (bots answer at once) */
  private armTurn(events: readonly GameEvent[]): void {
    if (events.some((e) => e.type === 'TURN_STARTED' || e.type === 'REQUEST_MADE')) this.askSlot++;
    const s = this.state;
    const now = Date.now();
    if (this.armedSlot !== this.askSlot) {
      this.armedSlot = this.askSlot;
      this.turnLeft = this.turnMs;
      this.turnDeadline = null;
    }
    const cur = s.players[s.currentPlayerIndex];
    const awaiting = s.status === 'IN_PROGRESS' && !s.pendingWindow && s.resume.kind === 'AWAIT_REQUEST' && cur?.id === this.playerId && !this.auto;
    if (!awaiting) {
      if (this.turnDeadline !== null) this.turnLeft = Math.max(0, this.turnDeadline - now);
      this.turnDeadline = null;
      return;
    }
    if (this.turnDeadline === null) this.turnDeadline = now + this.turnLeft;
  }

  private emit(events: readonly GameEvent[], snapshot = false): void {
    this.armTurn(events);
    const stamped = events.map((e) => ({ ...e, seq: ++this.seq }));
    const wire = redactEventsForPlayer(this.state, stamped, this.playerId) as WireEvent[];
    const msg: ServerMessage = { type: 'game_state', view: this.view(), events: wire };
    if (snapshot) msg.snapshot = true;
    this.deliver?.(msg);
    this.tellListeners();
  }

  /** applies one action as the room would */
  act(a: Action): void {
    const r = reduce(this.state, a);
    this.state = r.state;
    this.memory?.observe(r.events);
    this.deadline = this.state.pendingWindow ? Date.now() + this.state.config.windowTimeoutMs : null;
    const last = r.events[r.events.length - 1];
    this.lastText = last ? last.type : this.lastText;
    this.emit(r.events);
  }

  private controlled(id: string): boolean {
    return this.auto || id !== this.playerId;
  }

  /** the next action a bot (or the room's timeout) would take, or null when the table waits for the human */
  nextAction(everyone = false): Action | null {
    const s = this.state;
    if (s.status !== 'IN_PROGRESS') return null;
    const ctl = (id: string) => everyone || this.controlled(id);
    const w = s.pendingWindow;
    if (w) {
      if (this.deadline !== null && Date.now() >= this.deadline) return { type: 'SERVER_SKIP_WINDOW' };
      const humanIn = w.eligiblePlayerIds.includes(this.playerId);
      if (humanIn && !ctl(this.playerId)) return null;
      return nextBotAction(s, this.rng);
    }
    for (const p of s.players) {
      if (!ctl(p.id)) continue;
      const set = findLayableSets(s, p.id)[0];
      if (set) return { type: 'LAY_SET', playerId: p.id, rank: set.rank, cardIds: set.cardIds };
    }
    if (s.resume.kind !== 'AWAIT_REQUEST') return null;
    const cur = s.players[s.currentPlayerIndex];
    // the human's clock ran out: the room asks for them, at random, as the server does
    const timedOut = cur.id === this.playerId && this.turnDeadline !== null && Date.now() >= this.turnDeadline;
    if (!ctl(cur.id) && !timedOut) return null;
    if (timedOut) this.turnDeadline = null;
    if (this.memory) return this.memory.ask(s, this.rng);
    const ranks = askableRanks(cur);
    const targets = legalRequestTargets(s, cur.id);
    if (!ranks.length || !targets.length) return null;
    return { type: 'REQUEST', playerId: cur.id, targetId: pick(this.rng, targets), rank: pick(this.rng, ranks) };
  }

  private advance(force = false): boolean {
    if (this.paused && !force) return false;
    const a = this.nextAction();
    if (!a) return false;
    try {
      this.act(a);
    } catch (e) {
      console.warn('[bot table]', e);
      return false;
    }
    return true;
  }

  /** runs everyone (the human included) as bots until `pred` holds: for `until=` and fixtures */
  fastForward(pred: (s: GameState) => boolean, cap = 6000): boolean {
    this.deadline = null;
    const done = (ok: boolean) => {
      // keep the last few events so the log is not empty; the rest is "while you were away"
      this.pending = this.pending.slice(-8);
      this.deadline = this.state.pendingWindow ? Date.now() + this.state.config.windowTimeoutMs : null;
      return ok;
    };
    for (let i = 0; i < cap; i++) {
      if (pred(this.state)) return done(true);
      const a = this.nextAction(true);
      if (!a) return done(false);
      const r = reduce(this.state, a);
      this.state = r.state;
      this.memory?.observe(r.events);
      this.pending.push(...r.events);
    }
    return done(pred(this.state));
  }

  private hold: ReturnType<typeof setInterval> | undefined;

  private schedule(): void {
    clearTimeout(this.timer);
    clearInterval(this.hold);
    if (this.paused && this.deliver) {
      // a paused table keeps an open window's clock at a readable value, so a fixture stays as it was set up
      this.hold = setInterval(() => {
        if (!this.state.pendingWindow) return;
        this.deadline = Date.now() + 8000;
        this.emit([], true);
      }, 1500);
      if (this.state.pendingWindow) this.deadline = Date.now() + 8000;
    }
    if (this.paused || !this.deliver) return;
    const tick = () => {
      const acted = this.advance();
      this.timer = setTimeout(tick, acted ? 850 / this.speed : 120);
    };
    this.timer = setTimeout(tick, 400 / this.speed);
  }
}
