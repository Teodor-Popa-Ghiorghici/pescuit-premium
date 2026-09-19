/* §6.5 — a single game_state message can carry four events. They are played as a
 * sequence of beats, never all at once, and the authoritative view updates
 * immediately regardless: nothing here gates input or hides state. If the queue
 * ever backs up past the batch window it simply stops replaying and the table is
 * already correct, because the table was never waiting on it.
 *
 * Squid is absent from GameEvent by construction (see DECISIONS.md), so no beat
 * here can leak it — there is nothing to leak.
 */
import type { GameEvent } from '@pescuit/engine';
import { useEffect, useRef, type RefObject } from 'react';
import { DUR, shake } from '../motion.js';
import { buzz, play, type Cue } from '../sound.js';

const BEAT_GAP = 320;

function cueFor(e: GameEvent): { cue: Cue; shakePx?: number } | null {
  switch (e.type) {
    case 'REQUEST_SUCCEEDED':
      return { cue: 'stamp', shakePx: 1 };
    case 'SET_LAID':
      return { cue: 'stamp' };
    case 'POWER_GRANTED':
      return { cue: 'chime' };
    case 'POWER_USED':
      return { cue: 'knock' };
    case 'SET_DESTROYED':
      return { cue: 'splinter', shakePx: 3 };
    case 'SHARK_JUMP':
    case 'STICKLEBACK_STEAL':
      return { cue: 'knock', shakePx: 2 };
    case 'TORTOISE_BLOCK':
      return { cue: 'knock' };
    case 'DREW_FROM_POOL':
    case 'HAND_REFILLED':
      return { cue: 'stamp' };
    default:
      return null;
  }
}

/**
 * Plays the beats for whatever arrived since the last render, against `tableRef`
 * for the shakes. Never replays history: on first run it only marks where the log
 * had got to, so a reconnecting player is not hit by forty stamps at once.
 */
export function useEventBeats(events: GameEvent[], tableRef: RefObject<HTMLElement>) {
  const seen = useRef<number | null>(null);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    return () => {
      timers.current.forEach(clearTimeout);
      timers.current = [];
    };
  }, []);

  useEffect(() => {
    if (seen.current === null) {
      seen.current = events.length;
      return;
    }
    const fresh = events.slice(seen.current);
    seen.current = events.length;
    if (fresh.length === 0) return;

    let beat = 0;
    for (const e of fresh) {
      const spec = cueFor(e);
      if (!spec) continue;
      const at = beat * BEAT_GAP;
      // Past the batch window the beats would trail the table; drop to end-state.
      if (at > DUR.event + DUR.heavy) break;
      const id = window.setTimeout(() => {
        play(spec.cue);
        buzz(spec.cue === 'splinter' ? 24 : 10);
        if (spec.shakePx) shake(tableRef.current, spec.shakePx);
      }, at);
      timers.current.push(id);
      beat++;
    }
  }, [events, tableRef]);
}
