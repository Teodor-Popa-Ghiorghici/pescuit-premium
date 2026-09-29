import type { Rank } from '@pescuit/engine';
import { EGGS } from '@pescuit/engine';
import type { ClientAction } from '@pescuit/shared';
import { lazy, Suspense, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { getEngine } from '../audio/engine.js';
import { dropGroup } from '../audio/ui.js';
import { Mark, markForSeat, PowerPips } from '../art/marks.js';
import { Totem } from '../art/table.js';
import { logLines } from '../game/logLines.js';
import { opponentsInOrder, seatFacts } from '../game/seatFacts.js';
import type { HandGroup } from '../game/handModel.js';
import { cardSizeFor, useDesktop, useMedia, useWindowSize, WIDE_QUERY } from '../hooks/useViewport.js';
import { useT } from '../i18n/useT.js';
import { usePresenter } from '../hooks/usePresenter.js';
import { presenter } from '../game/presenter.js';
import { useGame } from '../state/store.js';
import { Announcer } from './Announcer.js';
import { AskSheet } from './AskSheet.js';
import { FlightLayer } from './FlightLayer.js';
import { Hand } from './Hand.js';
import { LogPanel } from './LogPanel.js';
import { Pond } from './Pond.js';
import { LaidRow } from './LaidSets.js';
import { Chip, Crown, Post, useLead } from './Seats.js';
import { HeadphonesPrompt, MenuSheet, SoundSettings } from './Sheets.js';
import { TopBar } from './TopBar.js';
import { Plank, WindowBanner, windowKeyOf, tooLateText } from './Windows.js';

// the podium is a chunk of its own: fetched as soon as a game is on, shown when the last beat has landed
const loadPodium = () => import('./Podium.js');
const Podium = lazy(loadPodium);
const RulesPanel = lazy(() => import('./RulesPanel.js'));

const CONNECTION_GRACE_MS = 1500;
const REINK_MS = 460;

/** §4.6: under 1.5 s disconnected show nothing; longer, drain to --ink-soft with a plaque; on rejoin a 460 ms re-ink. */
function useConnectionFeel(status: string): 'ok' | 'drained' | 'reink' {
  const [feel, setFeel] = useState<'ok' | 'drained' | 'reink'>('ok');
  const feelRef = useRef(feel);
  feelRef.current = feel;
  useEffect(() => {
    if (status === 'open') {
      if (feelRef.current !== 'drained') return;
      setFeel('reink');
      getEngine().play('meta.reconnected');
      const id = window.setTimeout(() => setFeel('ok'), REINK_MS);
      return () => window.clearTimeout(id);
    }
    const id = window.setTimeout(() => setFeel('drained'), CONNECTION_GRACE_MS);
    return () => window.clearTimeout(id);
  }, [status]);
  return feel;
}

function readStored(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}
function writeStored(key: string, value: string) {
  try {
    sessionStorage.setItem(key, value);
  } catch {
    /* fine: it will just ask again */
  }
}

/** The pond's arc: the outer posts stand lower (§5.2). */
function liftFor(i: number, n: number): number {
  if (n <= 1) return 0;
  const t = (i - (n - 1) / 2) / ((n - 1) / 2);
  return Math.round(30 * t * t * Math.min(1, (n - 1) / 4));
}

export function GameTable() {
  const { t, rank, locale } = useT();
  presenter.locale = locale;
  const { view, playerId, status, sendAction, events, error, dismissError, leaveRoom } = useGame();
  const desktop = useDesktop();
  const wide = useMedia(WIDE_QUERY);
  const { h: winH } = useWindowSize();
  const cardSize = cardSizeFor(desktop, winH);

  const [showRules, setShowRules] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showSound, setShowSound] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [muted, setMuted] = useState(() => getEngine().settings.muted);
  const [headphones, setHeadphones] = useState(() => getEngine().headphones);
  const [picked, setPicked] = useState<Rank | null>(null);
  const pickedRef = useRef<Rank | null>(null);
  pickedRef.current = picked;
  const [kbTarget, setKbTarget] = useState<string | null>(null);
  const [dragTarget, setDragTarget] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [askedHeadphones, setAskedHeadphones] = useState(false);

  const tableRef = useRef<HTMLDivElement>(null);
  const groupsRef = useRef<HandGroup[]>([]);
  const declared = useRef<{ key: string; seq: number } | null>(null);

  const feel = useConnectionFeel(status);
  useEffect(() => {
    void loadPodium();
  }, []);

  // the settings sheet and the engine share one truth: follow it (headphones glyph, mute)
  useEffect(() => {
    const engine = getEngine();
    const sync = () => {
      setHeadphones(engine.headphones);
      setMuted(engine.settings.muted);
    };
    sync();
    return engine.subscribe(sync);
  }, []);

  // §4.2 - the presenter plays the timeline (it is fed by the store, message by message); this returns the
  // seat whose turn the table has SHOWN: the totem lands there, and the chrome follows it (§4.5)
  const shownTurn = usePresenter(playerId, view?.currentPlayerId);

  const isGameOver = view?.status === 'ENDED';
  const isMyTurn = !!view && view.currentPlayerId === playerId;
  const shownMine = !!view && shownTurn === playerId;
  const canAsk = !!view && !isGameOver && isMyTurn && view.pendingWindow === null;
  // the lift answers first (beat 0, 50 ms); the sheet that takes the pond's row is mounted right behind it, in the next frame
  const sheetRank = useDeferredValue(canAsk && picked !== null ? picked : null);
  const winKey = windowKeyOf(view);
  const myWindow = !!view?.pendingWindow?.youAreEligible;

  const targets = useMemo(() => (view && playerId ? opponentsInOrder(view, playerId).filter((p) => !p.stunned) : []), [view, playerId]);

  // an ask that is no longer possible (the turn moved on, the last card of that rank left) closes itself
  useEffect(() => {
    if (!view) return;
    if (picked && (!canAsk || !view.hand.some((c) => c.rank === picked))) {
      setPicked(null);
      setKbTarget(null);
      setDragTarget(null);
    }
  }, [view, canAsk, picked]);

  // a plank taking over the screen closes the log drawer
  useEffect(() => {
    if (myWindow) setDrawer(false);
  }, [myWindow]);

  // §4.4 - "Prea târziu": we declared, the window closed, and it was not our declaration that did it
  useEffect(() => {
    const d = declared.current;
    if (!d || !view) return;
    if (winKey === d.key) return;
    declared.current = null;
    const since = events.filter((e) => e.seq > d.seq);
    if (since.some((e) => e.type === 'POWER_USED' && e.playerId === playerId)) return;
    const other = since.find((e) => e.type === 'POWER_USED' && e.playerId !== playerId);
    const name = other && 'playerId' in other ? (view.players.find((p) => p.id === other.playerId)?.name ?? null) : null;
    setToast(tooLateText(t, name));
  }, [winKey, events, view, playerId, t]);

  // a server refusal reads on the pond too
  useEffect(() => {
    if (!error) return;
    declared.current = null;
    setToast(error);
    dismissError();
  }, [error, dismissError]);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 4200);
    return () => window.clearTimeout(id);
  }, [toast]);

  // §3.2 - "Still on headphones?", once per game, in headphones mode
  const gameKey = view ? `pescuit:hp:${view.turnOrder.join('.')}` : null;
  const showHpPrompt = !!gameKey && headphones && !askedHeadphones && readStored(gameKey) === null;
  useEffect(() => {
    setAskedHeadphones(false);
  }, [gameKey]);

  const pick = useCallback(
    (r: Rank) => {
      if (r === EGGS) return;
      // picking the group that is already up puts it back
      if (pickedRef.current === r) dropGroup();
      else getEngine().play('ui.select', undefined, { afterPaint: true });
      setPicked((cur) => (cur === r ? null : r));
      setKbTarget(null);
    },
    [],
  );

  /** the player puts the group back (the sheet's close, Escape): a pick cleared by hand, not by the table */
  const putBack = useCallback(() => {
    dropGroup();
    setPicked(null);
    setKbTarget(null);
  }, []);

  const refuse = useCallback(() => getEngine().play('ui.error', undefined, { afterPaint: true }), []);

  const ask = useCallback(
    (targetId: string, r: Rank) => {
      if (!view || !playerId) return;
      const seat = Math.max(0, view.turnOrder.indexOf(targetId));
      getEngine().play('ui.target', { seat }, { afterPaint: true });
      sendAction({ type: 'REQUEST', playerId, targetId, rank: r } as ClientAction);
      setPicked(null);
      setKbTarget(null);
      setDragTarget(null);
    },
    [view, playerId, sendAction],
  );

  const lay = useCallback(
    (set: { rank: Rank; cardIds: string[] }) => {
      if (!playerId) return;
      getEngine().play('ui.press', undefined, { afterPaint: true });
      sendAction({ type: 'LAY_SET', playerId, rank: set.rank, cardIds: set.cardIds } as ClientAction);
    },
    [playerId, sendAction],
  );

  // the log drawer closes on Escape (§5.9)
  useEffect(() => {
    if (!drawer) return;
    const on = (e: KeyboardEvent) => e.key === 'Escape' && setDrawer(false);
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, [drawer]);

  // §4.4 keyboard: 1-9 pick a group, ←/→ cycle targets, Enter asks. (Space, D and Esc belong to the plank.)
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || showRules || showMenu || showSound) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT')) return;
      if (!canAsk) return;
      if (/^[1-9]$/.test(e.key)) {
        const g = groupsRef.current[Number(e.key) - 1];
        if (!g) return;
        if (g.rank === EGGS) refuse();
        else pick(g.rank);
        e.preventDefault();
      } else if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && picked && targets.length > 0) {
        const at = targets.findIndex((p) => p.id === kbTarget);
        const step = e.key === 'ArrowRight' ? 1 : -1;
        const next = targets[at < 0 ? (step > 0 ? 0 : targets.length - 1) : (at + step + targets.length) % targets.length];
        setKbTarget(next.id);
        getEngine().play('ui.select', undefined, { afterPaint: true });
        e.preventDefault();
      } else if (e.key === 'Enter' && picked && kbTarget) {
        e.preventDefault();
        ask(kbTarget, picked);
      } else if (e.key === 'Escape' && picked) {
        putBack();
      }
    };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, [canAsk, picked, kbTarget, targets, pick, ask, refuse, putBack, showRules, showMenu, showSound]);

  const onGroups = useCallback((g: HandGroup[]) => {
    groupsRef.current = g;
  }, []);

  const toggleMute = () => {
    const engine = getEngine();
    const next = !engine.settings.muted;
    setMuted(next);
    engine.update({ muted: next });
    if (!next) {
      engine.unlock();
      engine.play('ui.toggle', { on: true });
    }
  };

  const lines = useMemo(() => {
    if (!view) return [];
    const nameOf = (id: string) => view.players.find((p) => p.id === id)?.name ?? id;
    return logLines(events.slice(-12), nameOf, rank, t, true);
  }, [events, view, rank, t]);

  if (!view || !playerId) {
    return (
      <div className="screen screen--centered">
        <p className="muted">{t('game.reconnecting')}</p>
      </div>
    );
  }

  const me = view.players.find((p) => p.id === playerId)!;
  const myFacts = seatFacts(view, playerId);
  const myLead = useLead(view, playerId);
  const opponents = opponentsInOrder(view, playerId);
  const current = view.players.find((p) => p.id === (shownTurn ?? view.currentPlayerId));
  const turnText = isGameOver ? t('game.gameOver') : shownMine ? t('game.yourTurn') : t('game.turnOf', { name: current?.name ?? '' });
  const askOpen = canAsk && picked !== null;
  const activeTarget = dragTarget ?? kbTarget;
  const lastLine = lines[lines.length - 1];

  const ticker = toast ? (
    <span className="ticker__toast" role="status">
      {toast}
    </span>
  ) : view.pendingWindow && !myWindow ? (
    <WindowBanner view={view} />
  ) : lastLine ? (
    <>
      {lastLine.actorId && <Mark id={markForSeat(view.turnOrder, lastLine.actorId)} size={11} color="#9db3bd" />}
      <span className="ticker__text">{lastLine.text}</span>
    </>
  ) : null;

  const dockHint = canAsk ? (picked ? t('dock.pickTarget') : t('dock.pickCard')) : '';

  const seatProps = (p: (typeof opponents)[number]) => ({
    view,
    player: p,
    current: p.id === view.currentPlayerId && !isGameOver,
    hot: p.id === shownTurn && !isGameOver,
    askable: canAsk && picked !== null && !p.stunned,
    target: activeTarget === p.id,
    onPick: () => picked && ask(p.id, picked),
    onHover: (over: boolean) => {
      if (desktop && picked && !p.stunned) setDragTarget(over ? p.id : null);
    },
  });

  const hand = (
    <Hand
      size={cardSize}
      pickedRank={picked}
      canAsk={canAsk}
      onPick={pick}
      onLay={lay}
      onDragOver={setDragTarget}
      onDrop={(id, r) => ask(id, r)}
      onRefuse={refuse}
      dragEnabled={desktop}
      onGroups={onGroups}
    />
  );

  const meLine = (
    <>
      {isMyTurn && !isGameOver && (
        <span className="dock__totem" data-totem>
          <Totem size={desktop ? 18 : 14} />
        </span>
      )}
      <Mark id={markForSeat(view.turnOrder, playerId)} size={desktop ? 16 : 13} color="#17120e" />
      <span className="dock__name">{t('dock.me')}</span>
      {myLead.leads && <Crown tier={myLead.tier} size={desktop ? 1 : 0.85} />}
      <span className="dock__score num" data-score-owner={playerId}>
        <span className="score__now">{me.score}</span>
      </span>
      <PowerPips unused={myFacts.unused} used={myFacts.used} />
      <LaidRow view={view} owner={playerId} className="laid--me" max={desktop ? undefined : 5} />
      <span className="dock__hand">
        · <span className="num">{me.handSize}</span> {t('dock.cards')}
      </span>
    </>
  );

  const topBar = (
    <TopBar
      text={turnText}
      mine={shownMine && !isGameOver}
      muted={muted}
      headphones={headphones}
      logOpen={drawer}
      showLog={!desktop}
      onMute={toggleMute}
      onMixer={() => setShowSound(true)}
      onLog={() => setDrawer((d) => !d)}
      onRules={() => setShowRules(true)}
      onMenu={() => setShowMenu(true)}
      className={desktop ? 'dk-top' : ''}
    />
  );

  const overlays = (
    <>
      {view.pendingWindow?.youAreEligible && !isGameOver && (
        <>
          <div className="window-frame" aria-hidden="true" />
          <Plank view={view} onDeclared={(key) => (declared.current = { key, seq: view.seq })} />
        </>
      )}
      {drawer && (
        <>
          <div className="scrim" onClick={() => setDrawer(false)} />
          <LogPanel className="dk-log--drawer" onClose={() => setDrawer(false)} />
        </>
      )}
      {feel === 'drained' && (
        <div className="plaque" role="status" data-plaque>
          {t('conn.reconnecting')}
        </div>
      )}
      {isGameOver && (
        <Suspense fallback={null}>
          <Podium onNewGame={leaveRoom} />
        </Suspense>
      )}
      {showRules && (
        <Suspense fallback={null}>
          <RulesPanel onClose={() => setShowRules(false)} />
        </Suspense>
      )}
      {showMenu && (
        <MenuSheet
          onClose={() => setShowMenu(false)}
          onSound={() => {
            setShowMenu(false);
            setShowSound(true);
          }}
        />
      )}
      {showSound && <SoundSettings onClose={() => setShowSound(false)} />}
      <FlightLayer />
      <Announcer />
    </>
  );

  const hpPrompt = showHpPrompt ? (
    <HeadphonesPrompt
      onDone={() => {
        if (gameKey) writeStored(gameKey, '1');
        setAskedHeadphones(true);
      }}
    />
  ) : null;

  const rootClass = `table ${feel === 'drained' ? 'is-drained' : ''} ${feel === 'reink' ? 'is-reink' : ''}`;

  /* ------------------------------------------------------------ the pond table (desktop) */
  if (desktop) {
    return (
      <div className={`dk ${rootClass}`} data-table="desktop">
        {topBar}
        <main className="dk-main">
          <section className="dk-table" ref={tableRef} data-table-layer>
            <div className="dk-posts">
              {opponents.map((p, i) => (
                <Post key={p.id} {...seatProps(p)} lift={liftFor(i, opponents.length)} />
              ))}
            </div>
            <div className="dk-stage">
              <Pond view={view} ticker={ticker} />
              {hpPrompt}
            </div>
            <div className={`dk-me ${shownMine && !isGameOver ? 'is-turn' : ''}`} data-me={playerId}>
              <div className="dk-me__post">
                {meLine}
                <span className="dk-me__hint">{canAsk ? t('dock.drag') : ''}</span>
              </div>
              {hand}
            </div>
          </section>
          {wide ? (
            <LogPanel />
          ) : (
            <button type="button" className="dk-log-tab" aria-label={t('nav.log')} aria-pressed={drawer} onClick={() => setDrawer((d) => !d)}>
              {t('log.title')}
            </button>
          )}
        </main>
        {overlays}
      </div>
    );
  }

  /* ----------------------------------------------------------------- one screen (phone) */
  return (
    <div className={`ph ${rootClass}`} data-table="phone">
      {topBar}
      <div className="ph-strip" data-strip>
        {opponents.map((p) => (
          <Chip key={p.id} {...seatProps(p)} />
        ))}
      </div>
      <div className="ph-mid" ref={tableRef} data-table-layer role="main" aria-label={t('a11y.table')}>
        {sheetRank && <AskSheet view={view} me={playerId} rank={sheetRank} keyTarget={kbTarget} onAsk={(id) => ask(id, sheetRank)} onClose={putBack} />}
        {/* the pond stays mounted while the sheet takes its row (display: none): opening and closing the sheet is a style
            flip, not a rebuild of the basin, the pool stack and the tally on every tap (input -> visual, §4.4) */}
        <div className="ph-pond-slot" style={{ display: sheetRank ? 'none' : 'contents' }}>
          <Pond view={view} ticker={ticker} />
        </div>
        {hpPrompt}
      </div>
      <section className={`ph-dock ${shownMine && !isGameOver ? 'is-turn' : ''}`} data-dock data-me={playerId}>
        <div className="dock__head">
          <div className="dock__me">{meLine}</div>
          <span className="dock__hint">{dockHint}</span>
        </div>
        {hand}
      </section>
      {overlays}
    </div>
  );
}
