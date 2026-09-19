/* D3 — Ștanțat, nu glisat.
 *
 * A woodcut world has no smooth glides. Things are pressed into place: they arrive
 * at 1.05 with the ink thin, compress to 0.99 on contact, and settle at 1.0 as the
 * ink saturates. Every duration and curve here is a token from §6.2; if you need a
 * new one, add it there first.
 *
 * §6.6: under prefers-reduced-motion every travel becomes an instant state change
 * and every stamp becomes a one-frame ink saturation. Screen shake is off entirely.
 * The 700ms resolution beat is *not* motion — it is a secrecy device — so it stays.
 */
import { useEffect, useRef, useState } from 'react';

export const DUR = {
  snap: 120,
  stamp: 220,
  place: 320,
  heavy: 460,
  event: 700,
} as const;

export const EASE = {
  strike: 'cubic-bezier(0.2,0.9,0.25,1)',
  settle: 'cubic-bezier(0.34,1.32,0.64,1)',
  gouge: 'steps(3,end)',
} as const;

const QUERY = '(prefers-reduced-motion: reduce)';

export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia(QUERY).matches;
}

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(prefersReducedMotion);
  useEffect(() => {
    if (!window.matchMedia) return;
    const mq = window.matchMedia(QUERY);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return reduced;
}

function canAnimate(el: Element | null | undefined): el is HTMLElement {
  return !!el && typeof (el as HTMLElement).animate === 'function';
}

/** §6.1 — the impression. The standard 220ms beat for anything that arrives. */
export function stamp(el: Element | null | undefined): void {
  if (!canAnimate(el)) return;
  if (prefersReducedMotion()) {
    el.animate([{ opacity: 0.5 }, { opacity: 1 }], { duration: 60 });
    return;
  }
  el.animate(
    [
      { transform: 'scale(1.05)', opacity: 0.45 },
      { transform: 'scale(0.99)', opacity: 1, offset: 0.45 },
      { transform: 'scale(1)', opacity: 1 },
    ],
    { duration: DUR.stamp, easing: EASE.strike },
  );
}

/** A short travel that lands with a knock — §6.4's totem, and anything it carries. */
export function place(el: Element | null | undefined, fromX: number, fromY = 0): void {
  if (!canAnimate(el) || prefersReducedMotion()) return;
  el.animate(
    [{ transform: `translate(${fromX}px, ${fromY}px)` }, { transform: 'translate(0,0)' }],
    { duration: DUR.heavy, easing: EASE.settle },
  );
}

/** Never under reduced motion — §6.6 turns screen shake off entirely. */
export function shake(el: Element | null | undefined, px = 2): void {
  if (!canAnimate(el) || prefersReducedMotion()) return;
  el.animate(
    [
      { transform: 'translateX(0)' },
      { transform: `translateX(-${px}px)` },
      { transform: `translateX(${px}px)` },
      { transform: 'translateX(0)' },
    ],
    { duration: DUR.snap, easing: EASE.gouge },
  );
}

/** Stamps the element whenever `value` changes — never on first paint. */
export function useStampOn(value: unknown) {
  const ref = useRef<HTMLDivElement | null>(null);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    stamp(ref.current);
  }, [value]);
  return ref;
}
