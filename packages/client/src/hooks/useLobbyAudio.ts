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

/**
 * The waiting room's score (MUSIC_PLAN §2.4, §4.1): the horn at home, on the room's own clock (`createdAt`). It needs the
 * room's code and creation time, so it runs in the waiting room only - the lobby before a room exists has the pond alone.
 * The game takes the score over when the first view arrives.
 */
export function useLobbyScore(): void {
  const { roomCode, createdAt, started } = useGame();
  useEffect(() => {
    if (!roomCode || !createdAt || started) return;
    const engine = getEngine();
    engine.setScore({ roomCode, createdAt, serverNow: engine.server.serverNow(Date.now()) }, { live: false });
  }, [roomCode, createdAt, started]);
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
