/* HAND_AND_TURN_PLAN #7 - an opponent's hand, as the table sees it: a fan of card backs (the real back on a post, a plain
 * small back on a phone chip), arced, with the count. A card slides in when they gain one and lifts out when they lose
 * one; the seat whose turn it is lifts its hand and turns one card over and over. Reads only the public hand size. */
import { memo, useEffect, useRef, useState } from 'react';
import { prefersReducedMotion } from '../motion.js';
import { CardBack } from './CardBack.js';

const MAX = { post: 10, mini: 5 } as const;
const STEP = { post: 9, mini: 5 } as const;
const CARD_W = { post: 18, mini: 10 } as const;
const OUT_MS = 420;

/** a plain small back for the phone chip: the board's dark stock, an ink edge, the totem's ochre diamond */
const MiniBack = memo(function MiniBack() {
  return (
    <svg className="card__plate" viewBox="0 0 10 15" aria-hidden="true" focusable="false">
      <rect x="0.5" y="0.5" width="9" height="14" fill="#3f4f8a" stroke="#17120e" strokeWidth="1" />
      <polygon points="5,3.5 7.5,7.5 5,11.5 2.5,7.5" fill="#d99a2b" stroke="#17120e" strokeWidth="0.6" />
    </svg>
  );
});

interface Slot {
  key: number;
  fresh: boolean;
}

function OppFanImpl({ count, variant, thinking, label }: { count: number; variant: 'post' | 'mini'; thinking: boolean; label?: string }) {
  const shown = Math.min(count, MAX[variant]);
  const next = useRef(0);
  const [slots, setSlots] = useState<Slot[]>(() => Array.from({ length: shown }, () => ({ key: next.current++, fresh: false })));
  const [ghosts, setGhosts] = useState<Array<{ key: number; left: number; rot: number; sink: number }>>([]);
  const first = useRef(true);

  const slotsRef = useRef(slots);
  slotsRef.current = slots;
  // the cards come and go one by one: the new ones slide in at the right, the leaving ones lift out from where they sat
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const cur = slotsRef.current;
    if (shown === cur.length) return;
    if (shown > cur.length) {
      setSlots([...cur.map((s) => ({ ...s, fresh: false })), ...Array.from({ length: shown - cur.length }, () => ({ key: next.current++, fresh: true }))]);
      return;
    }
    if (!prefersReducedMotion()) {
      const gone = cur.slice(shown).map((s, i) => ({ key: s.key, ...geometry(shown + i, cur.length, variant) }));
      setGhosts((gs) => [...gs, ...gone]);
      const keys = new Set(gone.map((g) => g.key));
      setTimeout(() => setGhosts((gs) => gs.filter((g) => !keys.has(g.key))), OUT_MS);
    }
    setSlots(cur.slice(0, shown));
  }, [shown, variant]);

  const n = slots.length;
  const width = n === 0 ? 0 : CARD_W[variant] + (n - 1) * STEP[variant];
  const pondered = Math.floor(n / 2);
  const back = () => (variant === 'post' ? <CardBack width={18} height={27} /> : <MiniBack />);
  return (
    <span className={`ofan ofan--${variant} ${thinking ? 'is-thinking' : ''}`} style={{ width: Math.max(width, CARD_W[variant]) }} role="img" aria-label={label} title={label} data-fan>
      {slots.map((s, i) => {
        const g = geometry(i, n, variant);
        return (
          <span
            key={s.key}
            className={`ofan__card ${s.fresh ? 'is-in' : ''} ${i === pondered ? 'is-pondered' : ''}`}
            style={{ left: g.left, transform: `translateY(${g.sink}px) rotate(${g.rot}deg)`, zIndex: i + 1 }}
          >
            {back()}
          </span>
        );
      })}
      {ghosts.map((g) => (
        <span key={`g${g.key}`} className="ofan__ghost" style={{ left: g.left, rotate: `${g.rot}deg` }} aria-hidden="true">
          {back()}
        </span>
      ))}
      {count > 0 && <span className="ofan__count num">{count}</span>}
    </span>
  );
}

function geometry(i: number, n: number, variant: 'post' | 'mini'): { left: number; rot: number; sink: number } {
  const u = n <= 1 ? 0 : (i - (n - 1) / 2) / ((n - 1) / 2);
  const spread = variant === 'post' ? 14 : 12;
  return { left: i * STEP[variant], rot: Math.round(u * spread * Math.min(1, n / 5) * 10) / 10, sink: Math.round(u * u * (variant === 'post' ? 4 : 2)) };
}

export const OppFan = memo(OppFanImpl);
