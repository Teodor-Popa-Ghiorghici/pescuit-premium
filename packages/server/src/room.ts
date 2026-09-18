import { randomUUID } from 'node:crypto';
import type WebSocket from 'ws';
import { Action, createGame, GameEvent, GameState, reduce, redactForPlayer } from '@pescuit/engine';
import type { RoomConfig, RoomPlayerSummary, ServerMessage } from '@pescuit/shared';

export interface RoomPlayer {
  id: string;
  token: string;
  name: string;
  ws: WebSocket | null;
  connected: boolean;
  isHost: boolean;
}

function send(ws: WebSocket, msg: ServerMessage) {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
}

export class Room {
  code: string;
  config: RoomConfig;
  players: RoomPlayer[] = [];
  state: GameState | null = null;
  started = false;
  createdAt = Date.now();
  /** timestamp since the room has had zero connected players, or null while someone is connected */
  emptySince: number | null = Date.now();
  private windowTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(code: string, config: RoomConfig) {
    this.code = code;
    this.config = config;
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

  disconnect(playerId: string) {
    const player = this.players.find((p) => p.id === playerId);
    if (!player) return;
    player.connected = false;
    player.ws = null;
    if (this.state) {
      const sp = this.state.players.find((p) => p.id === playerId);
      if (sp) sp.connected = false;
    }
    if (this.isEmpty) this.emptySince = Date.now();
  }

  roomSummary(): RoomPlayerSummary[] {
    return this.players.map((p) => ({ id: p.id, name: p.name, connected: p.connected, isHost: p.isHost }));
  }

  start() {
    if (this.started) throw new Error('Game already started');
    if (this.players.length < 3) throw new Error('Need at least 3 players to start');
    const seed = (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
    const { state, events } = createGame(
      this.players.map((p) => ({ id: p.id, name: p.name })),
      seed,
      this.config,
    );
    this.state = state;
    this.started = true;
    this.broadcastRoomUpdate();
    this.broadcastState(events);
    this.armWindowTimer();
  }

  applyAction(action: Action) {
    if (!this.state) throw new Error('Game has not started');
    const { state, events } = reduce(this.state, action);
    this.state = state;
    this.broadcastState(events);
    this.armWindowTimer();
  }

  /** Enforces the spec's 12s (configurable) interrupt-window deadline: if nobody
   *  eligible declares in time, the room auto-submits SKIP_WINDOW on their behalf. */
  private armWindowTimer() {
    if (this.windowTimer) {
      clearTimeout(this.windowTimer);
      this.windowTimer = null;
    }
    if (!this.state || !this.state.pendingWindow) return;
    const ms = this.state.config.windowTimeoutMs;
    this.windowTimer = setTimeout(() => {
      try {
        this.applyAction({ type: 'SKIP_WINDOW' });
      } catch {
        // window may have already closed via a race with a real declaration; ignore
      }
    }, ms);
    this.windowTimer.unref?.();
  }

  broadcastState(events: GameEvent[]) {
    if (!this.state) return;
    for (const player of this.players) {
      if (!player.ws) continue;
      const view = redactForPlayer(this.state, player.id);
      send(player.ws, { type: 'game_state', view, events });
    }
  }

  broadcastRoomUpdate() {
    const msg: ServerMessage = {
      type: 'room_update',
      roomCode: this.code,
      players: this.roomSummary(),
      started: this.started,
      config: this.config,
    };
    for (const player of this.players) {
      if (player.ws) send(player.ws, msg);
    }
  }
}
