/* HAND_AND_TURN_PLAN #3 - the inspector: what a card in your hand is and does, after a dwell (mouse) or a long press
 * (finger). The card at 1.5x and a paper plaque: the name, its kind and window, the rule in plain words, the set it
 * needs and how many you hold. Reads only your own hand (the count is handed in) and the rules. A lazy chunk. */
import type { Rank } from '@pescuit/engine';
import { EGGS } from '@pescuit/engine';
import { useLayoutEffect, useRef, useState } from 'react';
import { useT } from '../i18n/useT.js';
import { inspectText } from '../i18n/inspectStrings.js';
import { Card, categoryOf } from './Card.js';
import type { InspectTarget } from './Hand.js';

/** each power's kind and the window it acts in (RULES.md §5-§6) */
const POWER_KIND: Record<string, { kind: 'active' | 'reactive' | 'special'; window: string }> = {
  squid: { kind: 'reactive', window: 'RESPONSE_PENDING' },
  shark: { kind: 'reactive', window: 'TURN_END' },
  tortoise: { kind: 'reactive', window: 'TRANSFER_PENDING' },
  jellyfish: { kind: 'active', window: 'TURN_START' },
  lanternfish: { kind: 'reactive', window: 'REQUEST_DECLARED' },
  stickleback: { kind: 'active', window: 'TURN_START' },
  mantisShrimp: { kind: 'reactive', window: 'SET_COMPLETED' },
  whale: { kind: 'active', window: 'TURN_START' },
  clownfish: { kind: 'special', window: 'special' },
};

const MARGIN = 8;

export default function CardInspect({ target, cardW, cardH }: { target: InspectTarget; cardW: number; cardH: number }) {
  const { rank: rankName, locale } = useT();
  const tx = (key: string, params?: Record<string, string | number>) => inspectText(locale, key, params);
  const ref = useRef<HTMLDivElement>(null);
  const narrow = typeof window !== 'undefined' && window.innerWidth < 560;
  const scale = narrow ? 1.05 : 1.5;
  const icw = Math.round(cardW * scale);
  const ich = Math.round(cardH * scale);
  const [pos, setPos] = useState<{ left: number; bottom: number } | null>(null);

  // above the group, centred on it, kept on the screen
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const w = el.offsetWidth;
    const vw = window.innerWidth;
    const centre = target.box.left + target.box.width / 2;
    const left = Math.max(MARGIN, Math.min(vw - w - MARGIN, centre - w / 2));
    const bottom = Math.max(MARGIN, window.innerHeight - target.box.top + 14);
    setPos({ left, bottom });
  }, [target]);

  const r: Rank = target.rank;
  const cat = categoryOf(r);
  const power = POWER_KIND[r];
  const setOf = cat === 'power' ? 4 : cat === 'normal' ? 3 : 4;
  const text = cat === 'power' ? tx(`inspect.${r}`) : cat === 'normal' ? tx('inspect.normalText') : tx('inspect.eggsText');

  return (
    <div
      ref={ref}
      className={`inspect ${narrow ? 'inspect--narrow' : ''}`}
      style={{ left: pos?.left ?? -9999, bottom: pos?.bottom ?? 0, visibility: pos ? 'visible' : 'hidden', ['--icw' as string]: `${icw}px`, ['--ich' as string]: `${ich}px` } as React.CSSProperties}
      role="tooltip"
      data-inspect={r}
    >
      <div className="inspect__card">
        <Card rank={r} size="lg" />
      </div>
      <div className="inspect__plaque">
        <div className="inspect__name">{rankName(r)}</div>
        <div className="inspect__kind">
          {cat === 'power' && power && (
            <>
              <span className="inspect__tag inspect__tag--power">{tx('inspect.power')}</span>
              <span className="inspect__tag">{tx(`inspect.${power.kind}`)}</span>
            </>
          )}
          {cat === 'normal' && <span className="inspect__tag inspect__tag--normal">{tx('inspect.normal')}</span>}
          {cat === 'eggs' && <span className="inspect__tag inspect__tag--eggs">{tx('inspect.eggs')}</span>}
        </div>
        <div className="inspect__rule" aria-hidden="true" />
        <div className="inspect__text">{text}</div>
        {power && <div className="inspect__window">{tx(`inspect.window.${power.window}`)}</div>}
        <div className="inspect__foot">
          <span>{tx('inspect.setOf', { n: setOf })}</span>
          {r !== EGGS || target.held > 0 ? <span className="inspect__held num">{tx('inspect.held', { n: target.held })}</span> : null}
        </div>
      </div>
    </div>
  );
}
