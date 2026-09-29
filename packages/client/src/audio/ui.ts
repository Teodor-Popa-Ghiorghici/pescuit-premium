/* The interface's two quiet cues (§3.2 Interface): `ui.press.soft` for a secondary button (a sheet or
 * panel closed, a settings choice made) and `ui.drop` for a group put back (a pick cleared). Both are
 * local, both play after the next paint like every other press (perf, §9.1).
 *
 * LAW 1: neither is ever played from a structural window. `components/Windows.tsx` declares and
 * passes in silence - a sound on the one device that holds a power would be a tell - and imports
 * neither of these (presentation-leak.test.ts guards the file). */
import { getEngine } from './engine.js';

export function softPress(): void {
  getEngine().play('ui.press.soft', undefined, { afterPaint: true });
}

export function dropGroup(): void {
  getEngine().play('ui.drop', undefined, { afterPaint: true });
}
