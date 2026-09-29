// WebSocket wire protocol shared by server and client. Kept deliberately small and
// explicit rather than routed through a framework, so the redaction boundary (see
// packages/engine/src/redact.ts) stays easy to audit: the server only ever sends a
// RedactedView, never raw GameState.

import type { PlayerAction, PowerVisibilityMode, PublicEvent, RedactedView } from '@pescuit/engine';
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

// ---- Actions on the wire ----

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

/**
 * What a client may send. The server binds every action to the socket's player: `playerId` is
 * optional here and ALWAYS overwritten (FEEL_VISUAL_SOUND_PLAN §6.4), and the Whale's `entropy`
 * is attached by the server, never accepted from a client (§6.3).
 */
export type ClientAction = DistributiveOmit<PlayerAction, 'playerId' | 'entropy'> & { playerId?: string };

// ---- Client -> Server ----

export type ClientMessage =
  | { type: 'create_room'; name: string; locale: Locale; config: RoomConfig }
  | { type: 'join_room'; roomCode: string; name: string; locale: Locale }
  | { type: 'rejoin'; roomCode: string; token: string }
  | { type: 'start_game' }
  | { type: 'action'; action: ClientAction }
  | { type: 'set_locale'; locale: Locale }
  | { type: 'ping' };

// ---- Server -> Client ----

export type ServerMessage =
  | { type: 'joined'; roomCode: string; playerId: string; token: string }
  | { type: 'room_update'; roomCode: string; players: RoomPlayerSummary[]; started: boolean; config: RoomConfig }
  | {
      type: 'game_state';
      view: RedactedView;
      /** this viewer's redacted events, each stamped with the room's `seq` (gaps are events that are not theirs to see) */
      events: WireEvent[];
      /**
       * true when this is a resync (a rejoin) rather than the result of an action: `events` is
       * empty and `view.seq` says where the room is, so the client must not replay choreography
       * for what it missed.
       */
      snapshot?: boolean;
    }
  | { type: 'error'; message: string; code?: string }
  | { type: 'room_closed'; reason: string }
  | { type: 'pong' };

/** A public event and its per-room sequence number: strictly increasing within a room. */
export type WireEvent = PublicEvent & { seq: number };

/** @deprecated alias of WireEvent, kept for older imports */
export type PublicGameEvent = WireEvent;

export function isClientMessage(x: unknown): x is ClientMessage {
  return typeof x === 'object' && x !== null && typeof (x as any).type === 'string';
}
