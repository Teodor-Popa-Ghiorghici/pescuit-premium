import type { Rank } from '@pescuit/engine';
import { EGGS } from '@pescuit/engine';
import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { buildGroups, FAN_FULL, FAN_PHONE, layoutHand, type HandGroup } from '../game/handModel.js';
import { useT } from '../i18n/useT.js';
import { rankAbbr } from '@pescuit/shared';
import { Card } from './Card.js';
import { presenter } from '../game/presenter.js';
import { useGame } from '../state/store.js';

/** the pointer must travel this far before a press on a group becomes a drag (§4.4) */
const DRAG_THRESHOLD = 8;
/** HAND_AND_TURN_PLAN #3: a mouse resting on a group this long opens the inspector; a finger held this long, too */
const DWELL_MS = 700;
const LONG_PRESS_MS = 450;
/** #1: the hovered group's neighbours part by this share of a card */
const PART = 0.18;

/** hover belongs to a fine pointer that can hover: a phone's emulated mouse events never part the hand */
const canHover = (): boolean => typeof window !== 'undefined' && !!window.matchMedia?.('(hover: hover) and (pointer: fine)').matches;

const loadInspect = () => import('./CardInspect.js');
const CardInspect = lazy(loadInspect);

export interface InspectTarget {
  rank: Rank;
  /** how many of the rank the hand holds (not counting eggs tied beside it) */
  held: number;
  /** the group's box when the inspector opened */
  box: { left: number; top: number; width: number; height: number };
}

export interface HandProps {
  size: { w: number; h: number };
  /** the rank picked to ask for, if any */
  pickedRank: Rank | null;
  /** it is your turn and no window is open: groups may be asked with */
  canAsk: boolean;
  onPick: (rank: Rank) => void;
  onLay: (set: { rank: Rank; cardIds: string[] }) => void;
  /** a mouse drag is over this post (or over nothing) */
  onDragOver: (playerId: string | null) => void;
  onDrop: (playerId: string, rank: Rank) => void;
  /** the pressed egg group, or anything that cannot be asked, was tried */
  onRefuse: () => void;
  /** desktop only: mouse drags. Touch taps; a finger drag scrolls the dock. */
  dragEnabled: boolean;
  /** the groups, so that the keyboard (1-9) can address them */
  onGroups?: (groups: HandGroup[]) => void;
}

/**
 * §5.3 - the hand as a hand: sorted by category then rank, duplicates stacked in a group with a
 * 25 % step and a ×N badge, a corner index (the seal is carved into the card; the three-letter
 * abbreviation stands under it) so nine cards identify at 360 px, and a set that can be laid tied
 * with an ochre rope and a "Pune jos" tab. The dock scrolls sideways with snap past eight groups.
 */
export function Hand({ size, pickedRank, canAsk, onPick, onLay, onDragOver, onDrop, onRefuse, dragEnabled, onGroups }: HandProps) {
  const { t, rank, locale } = useT();
  const { view } = useGame();
  const hand = view?.hand;
  const groups = useMemo(() => buildGroups(hand ?? []), [hand]);
  const boxRef = useRef<HTMLDivElement>(null);
  const [avail, setAvail] = useState(0);
  const [settled, setSettled] = useState(false);

  useLayoutEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const measure = () => setAvail(el.clientWidth);
    measure();
    // the groups glide when the hand changes, never into their first places
    const raf = requestAnimationFrame(() => requestAnimationFrame(() => setSettled(true)));
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => {
      ro.disconnect();
      cancelAnimationFrame(raf);
    };
  }, []);

  useEffect(() => onGroups?.(groups), [groups, onGroups]);

  // the desktop holds a full fan; the phone's dock, tight on height, a gentle one (HAND_AND_TURN_PLAN #2)
  const layout = useMemo(() => layoutHand(groups, size.w, avail || size.w * 6, dragEnabled ? FAN_FULL : FAN_PHONE), [groups, size.w, avail, dragEnabled]);

  /* ----------------------------------------------- hover, dwell, long press (#1, #3) */
  const [hovered, setHovered] = useState<number | null>(null);
  const [inspect, setInspect] = useState<InspectTarget | null>(null);
  const dwell = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const longPressed = useRef(false);
  const cancelDwell = useCallback(() => {
    clearTimeout(dwell.current);
    dwell.current = undefined;
  }, []);
  const closeInspect = useCallback(() => {
    cancelDwell();
    setInspect(null);
  }, [cancelDwell]);
  const openInspect = useCallback((g: HandGroup, el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    setInspect({ rank: g.rank, held: g.cards.filter((c) => c.rank === g.rank).length, box: { left: r.left, top: r.top, width: r.width, height: r.height } });
  }, []);
  // the hand changed under the inspector (a card came or left - not merely a new message): it closes; so does Escape
  const handKey = useMemo(() => (hand ?? []).map((c) => c.id).join(), [hand]);
  useEffect(() => closeInspect(), [handKey, closeInspect]);
  useEffect(() => {
    if (!inspect) return;
    const on = (e: KeyboardEvent) => e.key === 'Escape' && closeInspect();
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, [inspect, closeInspect]);
  useEffect(() => cancelDwell, [cancelDwell]);

  /* ----------------------------------------------------------------- the deal (#2) */
  const [dealing, setDealing] = useState(false);
  useEffect(() => {
    let id: ReturnType<typeof setTimeout> | undefined;
    const deal = () => {
      setDealing(true);
      clearTimeout(id);
      id = setTimeout(() => setDealing(false), 600 + 90 * 12);
    };
    // the table is usually mounted by the very message that starts the game: it deals if that was a moment ago
    if (performance.now() - presenter.dealtAt < 1500) deal();
    const off = presenter.onDeal(deal);
    return () => {
      off();
      clearTimeout(id);
    };
  }, []);

  /* ------------------------------------------------------------ drag (mouse) */
  const [drag, setDrag] = useState<{ rank: Rank; x: number; y: number } | null>(null);
  const dragging = useRef(false);
  const suppressClick = useRef(false);

  const startPress = useCallback(
    (e: React.PointerEvent, g: HandGroup) => {
      cancelDwell();
      setInspect(null);
      if (e.pointerType !== 'mouse') {
        // a finger held still on a group opens the inspector; lifting it closes it (and the lift is not a tap)
        const el = e.currentTarget as HTMLElement;
        const sx = e.clientX;
        const sy = e.clientY;
        longPressed.current = false;
        dwell.current = setTimeout(() => {
          longPressed.current = true;
          void loadInspect();
          openInspect(g, el);
        }, LONG_PRESS_MS);
        const move = (ev: PointerEvent) => {
          if (Math.hypot(ev.clientX - sx, ev.clientY - sy) > DRAG_THRESHOLD) end();
        };
        const end = () => {
          cancelDwell();
          if (longPressed.current) {
            setInspect(null);
            suppressClick.current = true;
            setTimeout(() => (suppressClick.current = false), 0);
          }
          window.removeEventListener('pointermove', move);
          window.removeEventListener('pointerup', end);
          window.removeEventListener('pointercancel', end);
        };
        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', end);
        window.addEventListener('pointercancel', end);
        return;
      }
      if (!dragEnabled || e.button !== 0 || !canAsk || g.rank === EGGS) return;
      const sx = e.clientX;
      const sy = e.clientY;
      dragging.current = false;
      const move = (ev: PointerEvent) => {
        if (!dragging.current) {
          if (Math.hypot(ev.clientX - sx, ev.clientY - sy) < DRAG_THRESHOLD) return;
          dragging.current = true;
          setHovered(null);
          onPick(g.rank);
        }
        setDrag({ rank: g.rank, x: ev.clientX, y: ev.clientY });
        const over = document.elementFromPoint(ev.clientX, ev.clientY)?.closest<HTMLElement>('[data-player-id]');
        onDragOver(over?.dataset.askable === 'true' ? (over.dataset.playerId ?? null) : null);
      };
      const up = (ev: PointerEvent) => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        window.removeEventListener('pointercancel', up);
        if (dragging.current) {
          suppressClick.current = true;
          setTimeout(() => (suppressClick.current = false), 0);
          const over = document.elementFromPoint(ev.clientX, ev.clientY)?.closest<HTMLElement>('[data-player-id]');
          if (over?.dataset.askable === 'true' && over.dataset.playerId) onDrop(over.dataset.playerId, g.rank);
        }
        dragging.current = false;
        setDrag(null);
        onDragOver(null);
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
      window.addEventListener('pointercancel', up);
    },
    [dragEnabled, canAsk, onPick, onDragOver, onDrop, cancelDwell, openInspect],
  );

  const enter = (e: React.PointerEvent, g: HandGroup, gi: number) => {
    if (e.pointerType !== 'mouse' || drag || !canHover()) return;
    setHovered(gi);
    void loadInspect();
    cancelDwell();
    const el = e.currentTarget as HTMLElement;
    dwell.current = setTimeout(() => openInspect(g, el), DWELL_MS);
  };
  const leave = (e: React.PointerEvent, gi: number) => {
    if (e.pointerType !== 'mouse') return;
    setHovered((h) => (h === gi ? null : h));
    closeInspect();
  };

  if (!view) return null;

  function press(g: HandGroup) {
    if (suppressClick.current) return;
    if (!canAsk) return;
    if (g.rank === EGGS) return onRefuse();
    onPick(g.rank);
  }

  const cardStyle = { ['--cw' as string]: `${size.w}px`, ['--ch' as string]: `${size.h}px` } as React.CSSProperties;

  return (
    <div
      className={`hand ${dealing ? 'is-dealing' : ''}`}
      ref={boxRef}
      style={{ height: size.h + (dragEnabled ? 44 : 30), ...cardStyle }}
      data-hand
      data-scrolls={layout.scrolls}
      data-settled={settled || undefined}
      onScroll={inspect ? closeInspect : undefined}
    >
      <div className="hand__row" style={{ width: layout.width, height: size.h, margin: layout.scrolls ? 0 : '0 auto' }}>
        {groups.map((g, gi) => {
          const selected = pickedRank === g.rank && canAsk && g.rank !== EGGS;
          const inStep = layout.inStep;
          const askable = canAsk && g.rank !== EGGS;
          const parted = hovered !== null && hovered !== gi && Math.abs(hovered - gi) <= 2;
          const part = parted ? Math.sign(gi - hovered!) * Math.round(size.w * PART * (Math.abs(hovered! - gi) === 1 ? 1 : 0.55)) : 0;
          return (
            <div
              key={g.key}
              className={['hgroup', g.layable ? 'is-layable' : '', selected ? 'is-selected' : '', askable ? 'is-askable' : '', hovered === gi ? 'is-hovered' : '', parted ? 'is-parted' : '']
                .filter(Boolean)
                .join(' ')}
              style={
                {
                  left: layout.lefts[gi],
                  width: size.w + (g.cards.length - 1) * inStep,
                  zIndex: gi + 1,
                  ['--fan-r' as string]: `${layout.tilts[gi]}deg`,
                  ['--fan-y' as string]: `${layout.sinks[gi]}px`,
                  ['--part-x' as string]: `${part}px`,
                  ['--gi' as string]: gi,
                } as React.CSSProperties
              }
              data-hand-group={g.rank}
              data-group-index={gi}
              role={canAsk ? 'button' : 'group'}
              tabIndex={canAsk ? 0 : undefined}
              aria-pressed={canAsk ? selected : undefined}
              aria-label={t('hand.groupAria', { count: g.cards.length, rank: rank(g.rank) })}
              onPointerDown={(e) => startPress(e, g)}
              onPointerEnter={(e) => enter(e, g, gi)}
              onPointerLeave={(e) => leave(e, gi)}
              onContextMenu={(e) => longPressed.current && e.preventDefault()}
              onClick={() => press(g)}
              onKeyDown={(e) => {
                if (e.key === ' ' || e.key === 'Enter') {
                  if (e.target !== e.currentTarget) return; // the "lay down" tab inside the group has its own keys
                  e.preventDefault();
                  press(g);
                }
              }}
            >
              {g.layable && (
                <button
                  type="button"
                  className="hgroup__tab"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    onLay(g.layable!);
                  }}
                >
                  {t('hand.layDown')}
                </button>
              )}
              {g.cards.length > 1 && !g.layable && <div className="hgroup__count num">×{g.cards.length}</div>}
              {g.cards.map((c, ci) => (
                <div key={c.id} className="hcard" style={{ left: ci * inStep, zIndex: ci + 1 }} data-hand-card-id={c.id}>
                  <Card rank={c.rank} size="lg" />
                  <span className={`hcard__index ${c.rank === EGGS ? 'is-light' : ''}`}>{rankAbbr(c.rank, locale)}</span>
                </div>
              ))}
              {g.layable && <div className="hgroup__rope" />}
            </div>
          );
        })}
      </div>
      {inspect && !drag && (
        <Suspense fallback={null}>
          <CardInspect target={inspect} cardW={size.w} cardH={size.h} />
        </Suspense>
      )}
      {drag && (
        <div className="hand__ghost" style={{ left: drag.x, top: drag.y, ['--cw' as string]: `${Math.round(size.w * 0.66)}px`, ['--ch' as string]: `${Math.round(size.h * 0.66)}px` }} aria-hidden="true">
          <Card rank={drag.rank} size="lg" />
        </div>
      )}
    </div>
  );
}
