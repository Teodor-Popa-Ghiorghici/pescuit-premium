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
import { getEngine } from '../audio/engine.js';
import { presenter } from '../game/presenter.js';
import { createClient, type ConnectionStatus, type WsClient } from '../net/client.js';
import { RttProbe } from '../net/rtt.js';
import { loadSession, roomCodeFromUrl, saveSession, setRoomInUrl } from '../net/session.js';
import { appendLog, takeFresh, type AwayMark } from './feed.js';

export type { AwayMark } from './feed.js';

interface GameState {
  status: ConnectionStatus;
  locale: Locale;
  roomCode: string | null;
  playerId: string | null;
  players: RoomPlayerSummary[];
  started: boolean;
  config: RoomConfig;
  /** when the room was created (server ms): the waiting room's score clock (MUSIC_PLAN §5.1, S5); null until the server says */
  createdAt: number | null;
  view: RedactedView | null;
  events: WireEvent[];
  /** stretches of the log the player did not watch (a rejoin, a hidden tab): "while you were away" */
  away: AwayMark[];
  error: string | null;
  joining: boolean;
}

/**
 * A table that runs in this tab instead of on the server (the bot table and the scenario fixtures,
 * §7.1-§7.2). The provider feeds whatever `start`'s `deliver` receives through the very same
 * message path a WebSocket would, so the real store, views and events drive the real UI. Loaded
 * lazily: the normal bundle never contains a source.
 */
export interface LocalSource {
  roomCode: string;
  playerId: string;
  players: RoomPlayerSummary[];
  config: RoomConfig;
  /** wire it up; returns the cleanup. `deliver` takes server messages. */
  start(deliver: (msg: ServerMessage) => void): () => void;
  /** whatever the UI would have sent to the server */
  send(msg: ClientMessage): void;
}

interface GameApi extends GameState {
  setLocale: (l: Locale) => void;
  createRoom: (name: string, config: RoomConfig) => void;
  joinRoom: (roomCode: string, name: string) => void;
  startGame: () => void;
  sendAction: (action: ClientAction) => void;
  dismissError: () => void;
  leaveRoom: () => void;
  /** true while the table runs from a LocalSource (bot table / fixtures) */
  local: boolean;
  /** dev only: pretend the socket dropped or came back, to see §4.6 without pulling a cable */
  devSetStatus: (s: ConnectionStatus) => void;
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

export function GameProvider({ children, source }: { children: React.ReactNode; source?: LocalSource }) {
  const [state, setState] = useState<GameState>({
    status: source ? 'open' : 'connecting',
    locale: loadLocale(),
    roomCode: source?.roomCode ?? null,
    playerId: source?.playerId ?? null,
    players: source?.players ?? [],
    started: !!source,
    config: source?.config ?? { powerVisibility: 'ascuns' },
    createdAt: null,
    view: null,
    events: [],
    away: [],
    error: null,
    joining: false,
  });

  const clientRef = useRef<WsClient | null>(null);
  /** the room this tab is in (or was opened for by URL): what to rejoin whenever a socket opens */
  const activeRoom = useRef<string | null>(roomCodeFromUrl());
  /** the highest event seq already applied: a resent or replayed event is never applied twice */
  const lastSeq = useRef(0);

  const sourceRef = useRef<LocalSource | undefined>(source);
  /** the ping round trip feeds the engine's ServerClock (§3.10, A14) */
  const rttRef = useRef<RttProbe | null>(null);
  const statusRef = useRef<ConnectionStatus>('connecting');

  useEffect(() => {
    if (sourceRef.current) {
      presenter.reset();
      presenter.setSelf(sourceRef.current.playerId);
      presenter.setRoom(sourceRef.current.roomCode);
      const stop = sourceRef.current.start(onMessage);
      return stop;
    }
    // Rejoin on EVERY socket open, not just at mount (A15): a dropped socket that comes back
    // must re-attach to its seat, or the player is frozen out of the game.
    const client = createClient(onMessage, onStatus, (sendNow) => {
      const roomCode = activeRoom.current;
      const session = roomCode ? loadSession(roomCode) : null;
      if (session) sendNow({ type: 'rejoin', roomCode: session.roomCode, token: session.token });
      rttRef.current?.ping(); // on every open, then every 5 s (the probe's timer)
    });
    clientRef.current = client;
    const probe = new RttProbe({
      send: (m) => {
        if (statusRef.current === 'open') client.send(m); // a closed socket must not queue pings
      },
      now: () => Date.now(),
      onRtt: (ms) => getEngine().server.setRtt(ms),
    });
    rttRef.current = probe;
    probe.start();

    return () => {
      probe.stop();
      rttRef.current = null;
      client.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onStatus(status: ConnectionStatus) {
    statusRef.current = status;
    setState((s) => ({ ...s, status }));
  }

  function onMessage(msg: ServerMessage) {
    switch (msg.type) {
      case 'joined': {
        saveSession({ roomCode: msg.roomCode, token: msg.token, playerId: msg.playerId, name: '' });
        setRoomInUrl(msg.roomCode);
        if (activeRoom.current !== msg.roomCode) {
          lastSeq.current = 0; // seq is per room
          presenter.reset();
        }
        presenter.setSelf(msg.playerId);
        presenter.setRoom(msg.roomCode);
        activeRoom.current = msg.roomCode;
        setState((s) => ({ ...s, roomCode: msg.roomCode, playerId: msg.playerId, error: null, joining: false }));
        return;
      }
      case 'room_update': {
        // the room's clock is the server's: an update samples it like a view does (the waiting room has no views)
        if (msg.serverNow > 0) getEngine().server.sample(msg.serverNow, Date.now());
        setState((s) => ({ ...s, players: msg.players, started: msg.started, config: msg.config, createdAt: msg.createdAt > 0 ? msg.createdAt : null }));
        return;
      }
      case 'game_state': {
        // apply only events newer than the last one seen (seq-based: the log's cap never limits what is
        // presented); a resync (rejoin) carries none, and the missed lines are not replayed as choreography
        const hidden = typeof document !== 'undefined' && document.hidden;
        const t = takeFresh(lastSeq.current, msg, hidden);
        lastSeq.current = t.lastSeq;
        // the window clock reads the server's time through the engine's ServerClock (§3.10)
        if (msg.view.serverNow > 0) getEngine().server.sample(msg.view.serverNow, Date.now());
        // a rejoin never replays choreography; the lines it carries (or the gap it leaves) go to the log
        // under "while you were away". So does whatever arrives while the tab is hidden.
        presenter.present({ view: msg.view, events: t.fresh, snapshot: t.snapshot });
        setState((s) => ({ ...s, view: msg.view, ...appendLog(s.events, s.away, t) }));
        return;
      }
      case 'error': {
        setState((s) => ({ ...s, error: msg.message, joining: false }));
        return;
      }
      case 'room_closed': {
        activeRoom.current = null;
        lastSeq.current = 0;
        presenter.reset();
        presenter.setRoom(null);
        getEngine().setScore(null);
        setState((s) => ({ ...s, error: msg.reason, roomCode: null, view: null, started: false }));
        return;
      }
      case 'pong':
        rttRef.current?.onMessage(msg);
        return;
    }
  }

  const send = useCallback((msg: ClientMessage) => (sourceRef.current ? sourceRef.current.send(msg) : clientRef.current?.send(msg)), []);

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
      local: !!source,
      devSetStatus: (status) => setState((s) => ({ ...s, status })),
      leaveRoom: () => {
        activeRoom.current = null;
        lastSeq.current = 0;
        presenter.reset();
        presenter.setRoom(null);
        getEngine().setScore(null);
        setRoomInUrl(null);
        setState((s) => ({ ...s, roomCode: null, playerId: null, view: null, started: false, players: [], events: [], away: [], createdAt: null }));
      },
    }),
    [state, send, source],
  );

  return <GameContext.Provider value={api}>{children}</GameContext.Provider>;
}

export function useGame(): GameApi {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame must be used inside GameProvider');
  return ctx;
}
