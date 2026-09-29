import { useEffect, useState } from 'react';

function matches(query: string): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia(query).matches;
}

/** Re-renders when a media query flips. */
export function useMedia(query: string): boolean {
  const [on, setOn] = useState(() => matches(query));
  useEffect(() => {
    if (!window.matchMedia) return;
    const mq = window.matchMedia(query);
    const change = () => setOn(mq.matches);
    change();
    mq.addEventListener('change', change);
    return () => mq.removeEventListener('change', change);
  }, [query]);
  return on;
}

/** §5.2: the pond table on a desktop-sized window, the one-screen phone table below it. */
export const DESKTOP_QUERY = '(min-width: 900px)';
/** §5.2: below 1100 px the log folds into a drawer behind a tab. */
export const WIDE_QUERY = '(min-width: 1100px)';

export function useDesktop(): boolean {
  return useMedia(DESKTOP_QUERY);
}

export interface Size {
  w: number;
  h: number;
}

/** The window's inner size, following resizes, rotations and the mobile toolbars. */
export function useWindowSize(): Size {
  const read = (): Size => ({ w: window.innerWidth, h: window.innerHeight });
  const [size, setSize] = useState<Size>(read);
  useEffect(() => {
    const on = () => setSize(read());
    window.addEventListener('resize', on);
    window.visualViewport?.addEventListener('resize', on);
    return () => {
      window.removeEventListener('resize', on);
      window.visualViewport?.removeEventListener('resize', on);
    };
  }, []);
  return size;
}

/** §5.2/§5.3: 132x198 on a desktop; on a phone 116x174 from 660 px tall and 104x156 below it. */
export function cardSizeFor(desktop: boolean, height: number): { w: number; h: number } {
  if (desktop) return { w: 132, h: 198 };
  return height >= 660 ? { w: 116, h: 174 } : { w: 104, h: 156 };
}
