import { useEffect, useRef } from 'react';
import { getEngine } from '../audio/engine.js';
import { metaCue } from '../audio/cues.js';
import { useGame } from '../state/store.js';

/**
 * The lobby and the waiting room have the full pond, louder (Appendix C, `amb.lobby`): the world in its
 * 'lobby' scene, which starts once the first knock has unlocked the audio. The game takes the world over
 * without a gap when it starts, so the cleanup only stops what is still the lobby's.
 */
export function useLobbyAmbience(): void {
  useEffect(() => {
    const engine = getEngine();
    engine.setWorld({ scene: 'lobby', poolCount: 20, poolStart: 20, dry: false, step: 0 });
    return () => {
      if (engine.worldScene === 'lobby') engine.setWorld(null);
    };
  }, []);
}

/** Each player's signature as they join the waiting room, the same damped as they leave or drop (`meta.join` / `meta.leave`). */
export function useJoinSignatures(): void {
  const { players } = useGame();
  const known = useRef<Map<string, { connected: boolean; seat: number }> | null>(null);
  useEffect(() => {
    const engine = getEngine();
    const now = new Map(players.map((p, i) => [p.id, { connected: p.connected, seat: i }]));
    const before = known.current;
    known.current = now;
    if (!before) return; // the first look at the room is not a join
    let n = 0;
    for (const [id, cur] of now) {
      const was = before.get(id);
      if (!was || (!was.connected && cur.connected)) engine.playRequests([metaCue('join', cur.seat, ++n)], { delayMs: n * 120 });
      else if (was.connected && !cur.connected) engine.playRequests([metaCue('leave', cur.seat, ++n)], { delayMs: n * 120 });
    }
    for (const [id, was] of before) if (!now.has(id)) engine.playRequests([metaCue('leave', was.seat, ++n)], { delayMs: n * 120 });
  }, [players]);
}
