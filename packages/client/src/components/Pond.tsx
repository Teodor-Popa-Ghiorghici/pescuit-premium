import type { RedactedView } from '@pescuit/engine';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Seal } from '../art/seals.js';
import { useT } from '../i18n/useT.js';
import { useStampOn } from '../motion.js';
import { worldStage } from '../game/world.js';
import { CardBack } from './Card.js';

/** The fallback "closing gate" (§3.9): one notch per miss toward the 2N limit. It appears only in a
 *  stall, once N asks in a row have captured and drawn nothing. */
export function Gate({ misses, limit, thrown = false }: { misses: number; limit: number; thrown?: boolean }) {
  const { t } = useT();
  const left = Math.max(0, limit - misses);
  return (
    <div className={`gate ${thrown ? 'is-thrown' : ''}`} data-gate role={thrown ? undefined : 'status'} aria-hidden={thrown || undefined}>
      <div className="gate__notches" aria-hidden="true">
        {Array.from({ length: limit }, (_, i) => (
          <span key={i} className={`gate__notch ${i < misses ? 'is-shut' : ''}`} />
        ))}
      </div>
      <span className="gate__label">{thrown ? '' : left === 1 ? t('game.stallGateOne') : <>{t('game.stallGate', { count: left })}</>}</span>
    </div>
  );
}

/** The tally of sets still possible (§3.9): one notch per set on the basin's rim, from the public
 *  record. A lay knocks its notch out (two, if it strands another set's cards, and the tally says so);
 *  at 1 the last notch is inked and labelled. The label is §4.5's "încă N seturi" / "ultimul set". The
 *  count is an UPPER BOUND (DECISIONS.md, "The world arc"), so the honest wording - "at most N" - stays
 *  on the title and the screen-reader label. */
export function Tally({ possible, start }: { possible: number; start: number }) {
  const { t } = useT();
  const label = possible === 0 ? t('game.setsNone') : possible === 1 ? t('game.setsMoreOne') : t('game.setsMore', { count: possible });
  const honest = possible === 0 ? t('game.setsNone') : t('pond.tallyAria', { count: possible });
  const stage = worldStage(possible);
  return (
    <div className="tally" data-tally={possible} data-stage={stage} role="img" aria-label={`${label}. ${honest}`} title={honest}>
      <span className="tally__rim">
        <span className="tally__notches" aria-hidden="true">
          {Array.from({ length: start }, (_, i) => (
            <span key={i} className={`tally__notch ${i >= possible ? 'is-gone' : ''} ${possible === 1 && i === 0 ? 'is-last' : ''}`} />
          ))}
        </span>
      </span>
      <span className="tally__label">{label}</span>
      <span className="tally__delta" data-tally-delta aria-hidden="true" />
    </div>
  );
}

/** Balta: the pool stack on the basin, its count ("N în baltă": cards, distinct from the tally's
 *  sets), the tally on the rim, the gate in a stall, and the one-line ticker or window banner. */
export function Pond({ view, ticker, className = '' }: { view: RedactedView; ticker: ReactNode; className?: string }) {
  const { t } = useT();
  const count = view.poolCount;
  const dry = count === 0;
  const plaque = useStampOn(count);
  const gate = view.endPressure.limit > 0 && view.endPressure.misses * 2 >= view.endPressure.limit;
  const thrown = useGateThrown(gate, view.endPressure.limit);
  return (
    <div className={`ph-pond ${className}`} data-pond>
      <div className={`pond__basin ${dry ? 'is-dry' : ''}`} data-basin>
        <div className="pond__well" data-pool>
        {dry ? (
          <svg className="pond__dry" width="150" height="92" viewBox="0 0 150 92" aria-hidden="true">
            <path d="M10,64 Q75,86 140,64" fill="none" stroke="#40291a" strokeWidth="5" />
            <path d="M34,62 L48,54 L60,63 M88,66 L99,57 L114,64" fill="none" stroke="#6b4a2f" strokeWidth="3" />
            <g transform="translate(62,50) rotate(24)">
              <circle r="13" fill="#d99a2b" stroke="#17120e" strokeWidth="3" />
            </g>
            <g transform="translate(55,43)">
              <Seal rank="tortoise" size={14} color="#17120e" />
            </g>
          </svg>
        ) : (
          <div className="pond__stack" role="img" aria-label={t('pond.stackAria', { count })}>
            <span className="pond__shim" style={{ left: 6, top: 0 }} />
            <span className="pond__shim" style={{ left: 3, top: 3 }} />
            <div className="pond__top">
              <CardBack width={60} height={90} />
            </div>
          </div>
        )}
        </div>
        <div className="pond__plaque" ref={plaque}>
          <span className="pond__count num">{count}</span>
          <span className="pond__label">{t('game.inPool')}</span>
        </div>
      </div>
      <Tally possible={view.sets.possible} start={view.sets.start} />
      {gate ? <Gate misses={view.endPressure.misses} limit={view.endPressure.limit} /> : thrown ? <Gate misses={0} limit={thrown} thrown /> : null}
      <div className="pond__ticker" data-ticker>
        {ticker}
      </div>
    </div>
  );
}

/** A capture or a lay throws the gate open again (a wooden creak, `amb.gate`): it swings open for a moment
 *  before it goes. Returns the gate's limit while it swings, else 0. */
function useGateThrown(gate: boolean, limit: number): number {
  const was = useRef(false);
  const [swing, setSwing] = useState(0);
  useEffect(() => {
    if (was.current && !gate && limit > 0) {
      setSwing(limit);
      const id = window.setTimeout(() => setSwing(0), 520);
      was.current = gate;
      return () => window.clearTimeout(id);
    }
    was.current = gate;
    return undefined;
  }, [gate, limit]);
  return gate ? 0 : swing;
}
