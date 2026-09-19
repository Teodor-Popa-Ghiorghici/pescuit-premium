/* The furniture of the table: the totem that answers "whose turn", the pool stack
 * that answers "how close is the end", and the small counters carved into every
 * post (§8.4's three glance questions). */
import { CardBack } from '../components/Card.js';
import { useStampOn } from '../motion.js';

/** The totem travels to the post whose turn it is. One element, readable across a room. */
export function Totem({ size = 34 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size * (46 / 34)}
      viewBox="0 0 34 46"
      aria-hidden="true"
      focusable="false"
      style={{ display: 'block' }}
    >
      <g fill="#d99a2b" stroke="#17120e" strokeWidth="3">
        <polygon points="17,2 32,12 17,22 2,12" />
        <polygon points="17,22 32,32 17,42 2,32" />
      </g>
    </svg>
  );
}

/** Balta. The stack loses height as the pool drains — the end of the game, at a glance. */
export function PoolStack({ count, label }: { count: number; label: string }) {
  const layers = Math.max(0, Math.min(3, Math.ceil(count / 8)));
  const plaque = useStampOn(count);
  return (
    <div className="pool">
      <div className="pool__stack" style={{ height: 116 + layers * 4 }}>
        {Array.from({ length: layers }, (_, i) => (
          <svg
            key={i}
            className="pool__shim"
            width="88"
            height="132"
            viewBox="0 0 264 396"
            style={{ left: (layers - i) * 4, top: i * 4 }}
            aria-hidden="true"
            focusable="false"
          >
            <polygon
              points="28,0 236,0 264,28 264,368 236,396 28,396 0,368 0,28"
              fill={i % 2 === 0 ? '#40291a' : '#5a3d26'}
            />
          </svg>
        ))}
        <div className="pool__top" style={{ top: layers * 4 }}>
          {count > 0 ? <CardBack width={88} height={132} /> : <div className="pool__empty" />}
        </div>
      </div>
      <div className="pool__plaque" ref={plaque}>
        <div className="pool__count">{count}</div>
        <div className="pool__label">{label}</div>
      </div>
    </div>
  );
}

/** Scor — one roe per point, ochre when earned. Five slots minimum so an empty
 *  post still has the shape of a score. */
export function RoePips({ score, title }: { score: number; title?: string }) {
  const slots = Math.max(5, score);
  return (
    <div className="pips" title={title} aria-label={title}>
      {Array.from({ length: slots }, (_, i) => (
        <svg key={i} width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
          <circle cx="8" cy="8" r="7" fill={i < score ? '#d99a2b' : 'none'} stroke="#40291a" strokeWidth="2" />
        </svg>
      ))}
    </div>
  );
}

/** Hand size, as the edges of the cards someone is holding. */
export function HandFan({ count, title }: { count: number; title?: string }) {
  const shown = Math.min(count, 9);
  return (
    <div className="fan" title={title} aria-label={title}>
      {Array.from({ length: shown }, (_, i) => (
        <svg
          key={i}
          width="14"
          height="22"
          viewBox="0 0 14 22"
          aria-hidden="true"
          focusable="false"
          style={{ transform: `rotate(${-9 + i * 5}deg)`, marginLeft: i === 0 ? 0 : -5 }}
        >
          {/* the lighter edge is the gap between two cards held together */}
          <rect x="0.75" y="0.75" width="12.5" height="21" fill="#40291a" stroke="#6b4a2f" strokeWidth="1.5" />
        </svg>
      ))}
      {count > shown && <span className="fan__overflow">+{count - shown}</span>}
    </div>
  );
}

/**
 * §5.5 · §9.4 — twelve notches burning down. Past three the numeral doubles in
 * weight and what is left of the clock turns --roșu.
 */
export function NotchClock({
  secondsLeft,
  total,
  compact,
}: {
  secondsLeft: number;
  total: number;
  compact?: boolean;
}) {
  const notches = 12;
  const lit = Math.max(0, Math.min(notches, Math.ceil((secondsLeft / Math.max(total, 1)) * notches)));
  const urgent = secondsLeft <= 3;
  return (
    <div className={`clock ${compact ? 'clock--compact' : ''} ${urgent ? 'is-urgent' : ''}`}>
      <div className="clock__notches">
        {Array.from({ length: notches }, (_, i) => (
          <span key={i} className={`clock__notch ${i < lit ? 'is-lit' : ''}`} />
        ))}
      </div>
      <span className="clock__numeral">{secondsLeft}</span>
    </div>
  );
}
