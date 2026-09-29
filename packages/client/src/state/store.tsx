import type { RedactedView } from '@pescuit/engine';
import type {
  ClientAction,
  ClientMessage,
  Locale,
  RoomConfig,
  RoomPlayerSummary,
  ServerMessage,
  WireEvent,
} from '@pescuit/shared';
import { DEFAULT_LOCALE } from '@pescuit/shared';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { createClient, type ConnectionStatus, type WsClient } from '../net/client.js';
import { loadSession, roomCodeFromUrl, saveSession, setRoomInUrl } from '../net/session.js';

const MAX_EVENTS = 300;

interface GameState {
  status: ConnectionStatus;
  locale: Locale;
  roomCode: string | null;
  playerId: string | null;
  players: RoomPlayerSummary[];
  started: boolean;
  config: RoomConfig;
  view: RedactedView | null;
  events: WireEvent[];
  error: string | null;
  joining: boolean;
}

interface GameApi extends GameState {
  setLocale: (l: Locale) => void;
  createRoom: (name: string, config: RoomConfig) => void;
  joinRoom: (roomCode: string, name: string) => void;
  startGame: () => void;
  sendAction: (action: ClientAction) => void;
  dismissError: () => void;
  leaveRoom: () => void;
}

const GameContext = createContext<GameApi | null>(null);

function loadLocale(): Locale {
  try {
    const stored = localStorage.getItem('pescuit:locale');
    if (stored === 'ro' || stored === 'en') return stored;
  } catch {
    /* ignore */
  }
  return DEFAULT_LOCALE;
}

export function GameProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<GameState>({
    status: 'connecting',
    locale: loadLocale(),
    roomCode: null,
    playerId: null,
    players: [],
    started: false,
    config: { powerVisibility: 'ascuns' },
    view: null,
    events: [],
    error: null,
    joining: false,
  });

  const clientRef = useRef<WsClient | null>(null);
  /** the room this tab is in (or was opened for by URL): what to rejoin whenever a socket opens */
  const activeRoom = useRef<string | null>(roomCodeFromUrl());
  /** the highest event seq already applied: a resent or replayed event is never applied twice */
  const lastSeq = useRef(0);

  useEffect(() => {
    // Rejoin on EVERY socket open, not just at mount (A15): a dropped socket that comes back
    // must re-attach to its seat, or the player is frozen out of the game.
    const client = createClient(onMessage, onStatus, (sendNow) => {
      const roomCode = activeRoom.current;
      if (!roomCode) return;
      const session = loadSession(roomCode);
      if (session) sendNow({ type: 'rejoin', roomCode: session.roomCode, token: session.token });
    });
    clientRef.current = client;

    return () => client.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onStatus(status: ConnectionStatus) {
    setState((s) => ({ ...s, status }));
  }

  function onMessage(msg: ServerMessage) {
    switch (msg.type) {
      case 'joined': {
        saveSession({ roomCode: msg.roomCode, token: msg.token, playerId: msg.playerId, name: '' });
        setRoomInUrl(msg.roomCode);
        if (activeRoom.current !== msg.roomCode) lastSeq.current = 0; // seq is per room
        activeRoom.current = msg.roomCode;
        setState((s) => ({ ...s, roomCode: msg.roomCode, playerId: msg.playerId, error: null, joining: false }));
        return;
      }
      case 'room_update': {
        setState((s) => ({ ...s, players: msg.players, started: msg.started, config: msg.config }));
        return;
      }
      case 'game_state': {
        // apply only events newer than the last one seen; a resync (rejoin) carries none, and
        // the missed lines are not replayed as choreography
        const fresh = msg.events.filter((e) => e.seq > lastSeq.current);
        for (const e of fresh) lastSeq.current = Math.max(lastSeq.current, e.seq);
        setState((s) => ({
          ...s,
          view: msg.view,
          events: fresh.length ? [...s.events, ...fresh].slice(-MAX_EVENTS) : s.events,
        }));
        return;
      }
      case 'error': {
        setState((s) => ({ ...s, error: msg.message, joining: false }));
        return;
      }
      case 'room_closed': {
        activeRoom.current = null;
        lastSeq.current = 0;
        setState((s) => ({ ...s, error: msg.reason, roomCode: null, view: null, started: false }));
        return;
      }
      case 'pong':
        return;
    }
  }

  const send = useCallback((msg: ClientMessage) => clientRef.current?.send(msg), []);

  const api: GameApi = useMemo(
    () => ({
      ...state,
      setLocale: (l) => {
        try {
          localStorage.setItem('pescuit:locale', l);
        } catch {
          /* ignore */
        }
        setState((s) => ({ ...s, locale: l }));
        send({ type: 'set_locale', locale: l });
      },
      createRoom: (name, config) => {
        setState((s) => ({ ...s, joining: true }));
        send({ type: 'create_room', name, locale: state.locale, config });
      },
      joinRoom: (roomCode, name) => {
        setState((s) => ({ ...s, joining: true }));
        send({ type: 'join_room', roomCode, name, locale: state.locale });
      },
      startGame: () => send({ type: 'start_game' }),
      sendAction: (action) => send({ type: 'action', action }),
      dismissError: () => setState((s) => ({ ...s, error: null })),
      leaveRoom: () => {
        activeRoom.current = null;
        lastSeq.current = 0;
        setRoomInUrl(null);
        setState((s) => ({ ...s, roomCode: null, playerId: null, view: null, started: false, players: [] }));
      },
    }),
    [state, send],
  );

  return <GameContext.Provider value={api}>{children}</GameContext.Provider>;
}

export function useGame(): GameApi {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame must be used inside GameProvider');
  return ctx;
}
