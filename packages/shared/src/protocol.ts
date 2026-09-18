// WebSocket wire protocol shared by server and client. Kept deliberately small and
// explicit rather than routed through a framework, so the redaction boundary (see
// packages/engine/src/redact.ts) stays easy to audit: the server only ever sends a
// RedactedView, never raw GameState.

import type { Action, GameEvent, PowerVisibilityMode, RedactedView } from '@pescuit/engine';
import type { Locale } from './i18n.js';

export interface RoomPlayerSummary {
  id: string;
  name: string;
  connected: boolean;
  isHost: boolean;
}

export interface RoomConfig {
  powerVisibility: PowerVisibilityMode;
}

// ---- Client -> Server ----

export type ClientMessage =
  | { type: 'create_room'; name: string; locale: Locale; config: RoomConfig }
  | { type: 'join_room'; roomCode: string; name: string; locale: Locale }
  | { type: 'rejoin'; roomCode: string; token: string }
  | { type: 'start_game' }
  | { type: 'action'; action: Action }
  | { type: 'set_locale'; locale: Locale }
  | { type: 'ping' };

// ---- Server -> Client ----

export type ServerMessage =
  | { type: 'joined'; roomCode: string; playerId: string; token: string }
  | { type: 'room_update'; roomCode: string; players: RoomPlayerSummary[]; started: boolean; config: RoomConfig }
  | { type: 'game_state'; view: RedactedView; events: PublicGameEvent[] }
  | { type: 'error'; message: string; code?: string }
  | { type: 'room_closed'; reason: string }
  | { type: 'pong' };

// The server never has to filter GameEvent for safety (squid emits none), but this
// alias documents the boundary: only events that survived the engine's own log are
// ever forwarded, verbatim, to every player in the room.
export type PublicGameEvent = GameEvent;

export function isClientMessage(x: unknown): x is ClientMessage {
  return typeof x === 'object' && x !== null && typeof (x as any).type === 'string';
}
