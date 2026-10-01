/* Per-device presentation settings (§4.1): the table speed, 0.75x ("calm", the default since HAND_AND_TURN_PLAN #6),
 * 1x or 1.5x, which scales every table-lane duration (cues included, so sound and pixels stay locked). Kept in
 * localStorage behind try/catch; the page renders without it. */
const KEY = 'pescuit:tableSpeed';
export type TableSpeed = 0.75 | 1 | 1.5;
export const TABLE_SPEEDS: readonly TableSpeed[] = [0.75, 1, 1.5];
export const DEFAULT_TABLE_SPEED: TableSpeed = 0.75;
let speed: TableSpeed | null = null;
const listeners = new Set<() => void>();

export function getTableSpeed(): TableSpeed {
  if (speed === null) {
    speed = DEFAULT_TABLE_SPEED;
    try {
      const raw = Number(localStorage.getItem(KEY));
      if ((TABLE_SPEEDS as readonly number[]).includes(raw)) speed = raw as TableSpeed;
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
