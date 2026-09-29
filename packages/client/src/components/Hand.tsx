import type { Rank } from '@pescuit/engine';
import { EGGS } from '@pescuit/engine';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { buildGroups, layoutHand, type HandGroup } from '../game/handModel.js';
import { useT } from '../i18n/useT.js';
import { rankAbbr } from '@pescuit/shared';
import { Card } from './Card.js';
import { useGame } from '../state/store.js';

/** the pointer must travel this far before a press on a group becomes a drag (§4.4) */
const DRAG_THRESHOLD = 8;

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

  useLayoutEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const measure = () => setAvail(el.clientWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => onGroups?.(groups), [groups, onGroups]);

  const layout = useMemo(() => layoutHand(groups, size.w, avail || size.w * 6), [groups, size.w, avail]);

  /* ------------------------------------------------------------ drag (mouse) */
  const [drag, setDrag] = useState<{ rank: Rank; x: number; y: number } | null>(null);
  const dragging = useRef(false);
  const suppressClick = useRef(false);

  const startPress = useCallback(
    (e: React.PointerEvent, g: HandGroup) => {
      if (!dragEnabled || e.pointerType !== 'mouse' || e.button !== 0 || !canAsk || g.rank === EGGS) return;
      const sx = e.clientX;
      const sy = e.clientY;
      dragging.current = false;
      const move = (ev: PointerEvent) => {
        if (!dragging.current) {
          if (Math.hypot(ev.clientX - sx, ev.clientY - sy) < DRAG_THRESHOLD) return;
          dragging.current = true;
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
    [dragEnabled, canAsk, onPick, onDragOver, onDrop],
  );

  if (!view) return null;

  function press(g: HandGroup) {
    if (suppressClick.current) return;
    if (!canAsk) return;
    if (g.rank === EGGS) return onRefuse();
    onPick(g.rank);
  }

  const cardStyle = { ['--cw' as string]: `${size.w}px`, ['--ch' as string]: `${size.h}px` } as React.CSSProperties;

  return (
    <div className="hand" ref={boxRef} style={{ height: size.h + 26, ...cardStyle }} data-hand data-scrolls={layout.scrolls}>
      <div className="hand__row" style={{ width: layout.width, height: size.h, margin: layout.scrolls ? 0 : '0 auto' }}>
        {groups.map((g, gi) => {
          const selected = pickedRank === g.rank && canAsk && g.rank !== EGGS;
          const inStep = layout.inStep;
          const askable = canAsk && g.rank !== EGGS;
          return (
            <div
              key={g.key}
              className={['hgroup', g.layable ? 'is-layable' : '', selected ? 'is-selected' : '', askable ? 'is-askable' : ''].filter(Boolean).join(' ')}
              style={{ left: layout.lefts[gi], width: size.w + (g.cards.length - 1) * inStep, zIndex: gi + 1 }}
              data-hand-group={g.rank}
              data-group-index={gi}
              role={canAsk ? 'button' : 'group'}
              tabIndex={canAsk ? 0 : undefined}
              aria-pressed={canAsk ? selected : undefined}
              aria-label={t('hand.groupAria', { count: g.cards.length, rank: rank(g.rank) })}
              onPointerDown={(e) => startPress(e, g)}
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
      {drag && (
        <div className="hand__ghost" style={{ left: drag.x, top: drag.y, ['--cw' as string]: `${Math.round(size.w * 0.66)}px`, ['--ch' as string]: `${Math.round(size.h * 0.66)}px` }} aria-hidden="true">
          <Card rank={drag.rank} size="lg" />
        </div>
      )}
    </div>
  );
}
