/* A thin compatibility facade over the audio engine (src/audio/). The four legacy cues map onto
 * the cue sheet; nothing here synthesises anything. A later change rewires the UI to `cuesFor`
 * and the presentation timeline, and this file goes away.
 *
 * Law 1 (§3.2): the legacy 'chime' was played on eligible clients only (a tell, A7) and by every
 * client for a grant. It now maps to the private-tier `clock.eligible`, which the engine plays
 * in headphones mode only - so, by default, both uses are silent rather than a leak.
 *
 * §6.6: sound is deliberately *not* disabled by prefers-reduced-motion.
 */

import { getEngine } from './audio/engine.js';
import { hapticSettings, hapticsSupported, vibrate } from './audio/haptics.js';

// Building the engine registers the first-gesture unlock; the chain itself waits for a gesture.
getEngine();

export type Cue = 'stamp' | 'knock' | 'splinter' | 'chime';

const LEGACY: Record<Cue, string> = {
  stamp: 'ui.press',
  knock: 'ui.press.soft',
  splinter: 'power.mantis',
  chime: 'clock.eligible',
};

export function soundEnabled(): boolean {
  return !getEngine().settings.muted;
}

export function setSoundEnabled(on: boolean): void {
  getEngine().update({ muted: !on });
  if (on) getEngine().unlock();
}

export function play(cue: Cue): void {
  getEngine().play(LEGACY[cue]);
}

/** Haptics travel with the sound where the device has them (§6.6); Android only, own toggle. */
export function buzz(ms = 12): void {
  if (!soundEnabled() || !hapticSettings().public || !hapticsSupported()) return;
  vibrate([ms]);
}
