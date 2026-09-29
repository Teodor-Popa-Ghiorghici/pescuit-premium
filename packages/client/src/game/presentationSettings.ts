/* Per-device presentation settings (§4.1): the table speed, 1x or 1.5x, which scales every
 * table-lane duration. Kept in localStorage behind try/catch; the page renders without it. */
const KEY = 'pescuit:tableSpeed';
export type TableSpeed = 1 | 1.5;
let speed: TableSpeed | null = null;
const listeners = new Set<() => void>();

export function getTableSpeed(): TableSpeed {
  if (speed === null) {
    speed = 1;
    try {
      const raw = localStorage.getItem(KEY);
      if (raw === '1.5') speed = 1.5;
    } catch {
      /* private mode: the default */
    }
  }
  return speed;
}

export function setTableSpeed(v: TableSpeed): void {
  speed = v;
  try {
    localStorage.setItem(KEY, String(v));
  } catch {
    /* session only */
  }
  listeners.forEach((l) => l());
}

export function subscribeTableSpeed(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
