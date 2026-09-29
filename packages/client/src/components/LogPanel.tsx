import type { RedactedView } from '@pescuit/engine';
import { useLayoutEffect, useMemo, useRef } from 'react';
import { Mark, markForSeat } from '../art/marks.js';
import { Seal } from '../art/seals.js';
import { logLines } from '../game/logLines.js';
import { useT } from '../i18n/useT.js';
import { useGame } from '../state/store.js';

/** Sets that have been laid, per player, as small chips: a face-down power set is a wooden back and
 *  nothing more (Mode Ascuns); a spent one is struck through; a destroyed one is cracked. */
function LaidSummary({ view }: { view: RedactedView }) {
  const { t, rank } = useT();
  const owners = view.turnOrder.filter((id) => view.laidSets.some((s) => s.ownerId === id));
  if (owners.length === 0) return null;
  return (
    <div className="dk-sets" data-laid-sets>
      <h4 className="dk-sets__title">{t('log.sets')}</h4>
      {owners.map((id) => {
        const p = view.players.find((x) => x.id === id);
        return (
          <div key={id} className="dk-sets__row">
            <Mark id={markForSeat(view.turnOrder, id)} size={13} title={p?.name} />
            <span className="dk-sets__name">{p?.name}</span>
            <span className="dk-sets__chips">
              {view.laidSets
                .filter((s) => s.ownerId === id)
                .map((s) => (
                  <span
                    key={s.id}
                    className={`setchip ${s.rank === null ? 'is-hidden' : ''} ${s.spent ? 'is-spent' : ''} ${s.destroyedByMantis ? 'is-destroyed' : ''}`}
                    title={s.rank ? rank(s.rank) : t('log.hiddenSet')}
                  >
                    {s.rank ? <Seal rank={s.rank} size={13} color="currentColor" /> : <span aria-hidden="true">?</span>}
                  </span>
                ))}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/**
 * The log: a tally board (§5.2) - marks, seals, the last three lines at full ink - on the desktop's
 * right, and in a drawer on the phone. It scrolls only itself (A12): never the document.
 */
export function LogPanel({ onClose, className = '' }: { onClose?: () => void; className?: string }) {
  const { t, rank } = useT();
  const { events, view } = useGame();
  const linesRef = useRef<HTMLDivElement>(null);
  const stick = useRef(true);

  const nameOf = useMemo(() => {
    const map = new Map((view?.players ?? []).map((p) => [p.id, p.name]));
    return (id: string) => map.get(id) ?? id;
  }, [view?.players]);

  const lines = useMemo(() => logLines(events, nameOf, rank, t), [events, nameOf, rank, t]);

  // scroll the log's own container to the newest line - never scrollIntoView, which drags the page
  useLayoutEffect(() => {
    const el = linesRef.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [lines.length]);

  return (
    <aside className={`dk-log ${className}`} data-log aria-label={t('log.title')}>
      <div className="dk-log__head">
        <h3 className="dk-log__title">{t('log.title')}</h3>
        {onClose && (
          <button type="button" className="dk-log__close" onClick={onClose} aria-label={t('nav.close')}>
            ×
          </button>
        )}
      </div>
      {view && <LaidSummary view={view} />}
      <div
        className="dk-log__lines"
        ref={linesRef}
        onScroll={(e) => {
          const el = e.currentTarget;
          stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
        }}
      >
        {lines.length === 0 && <p className="dk-log__empty">{t('log.empty')}</p>}
        {lines.map((l, i) => (
          <div key={l.id} className={`dk-log__line ${i >= lines.length - 3 ? 'is-recent' : ''}`}>
            {view && l.actorId ? <Mark id={markForSeat(view.turnOrder, l.actorId)} size={13} /> : <span style={{ width: 13, flex: 'none' }} />}
            {l.seal ? <Seal rank={l.seal} size={14} color="currentColor" /> : <span style={{ width: 14, flex: 'none' }} />}
            <span>{l.text}</span>
          </div>
        ))}
      </div>
    </aside>
  );
}
