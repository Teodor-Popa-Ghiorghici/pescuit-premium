/* input.ts - the score's projection (MUSIC_PLAN §5.1, Law 1). `scoreInputOf` is the only code in the score that touches
 * what the store holds; it copies the fields `SCORE_FIELDS` lists into a fresh object, exactly as `soundInputOf` does for
 * the cues, and nothing after it can read anything else. test/scorefields.test.ts hands it a Proxy that fails on any
 * other read.
 *
 *   S1  the phase: waiting room / game / ended (the view's status; no view is the waiting room)
 *   S2  the public tally of sets still possible
 *   S3  the stall gate's count and limit
 *   S4  the server clock of the broadcast that carried them
 *   S5  the score clock's zero: the game's `startedAt`, or the room's `createdAt` in the waiting room
 *   S6  the seed: a hash of the room code and S5 - public, and independent of the deal
 *
 * Not read, and not readable after this function: whose turn it is, "you", the mode, the players, a hand, a grant, a
 * window, the pool, the scores, the winners, the laid sets, the room's seq.
 */

import { mix } from '../util.js';

/** what the store holds, as the score may see it: a room and, once the game has started, the latest view */
export interface ScoreSource {
  roomCode: string;
  /** room_update.createdAt (server ms) */
  createdAt?: number | null;
  /** room_update.serverNow (server ms): the waiting room's broadcasts */
  serverNow?: number | null;
  /** the redacted view; only the fields in SCORE_FIELDS.view are read */
  view?: {
    status: string;
    sets: { possible: number };
    endPressure: { misses: number; limit: number };
    serverNow: number;
    startedAt?: number;
  } | null;
}

export const SCORE_FIELDS = {
  source: ['roomCode', 'createdAt', 'serverNow', 'view'],
  view: ['status', 'sets', 'endPressure', 'serverNow', 'startedAt'],
  sets: ['possible'],
  endPressure: ['misses', 'limit'],
} as const;

export type ScorePhase = 'lobby' | 'game' | 'ended';

export interface ScoreInput {
  phase: ScorePhase;
  setsPossible: number | null;
  misses: number;
  limit: number;
  /** the server clock of the broadcast that carried this (S4); 0 if unknown */
  at: number;
  /** the score clock's zero (S5); 0 if unknown */
  zero: number;
  /** S6 */
  seed: number;
}

/** a string's 32-bit hash (FNV-1a), for the room code */
export function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

const num = (v: unknown, d: number): number => (typeof v === 'number' && Number.isFinite(v) ? v : d);

/** The only reader of the source. Everything in the score works on what it returns. */
export function scoreInputOf(src: ScoreSource): ScoreInput {
  const roomCode = String(src.roomCode ?? '');
  const view = src.view ?? null;
  if (!view) {
    const zero = num(src.createdAt, 0);
    return { phase: 'lobby', setsPossible: null, misses: 0, limit: 0, at: num(src.serverNow, 0), zero, seed: mix(hashString(roomCode), Math.floor(zero / 1000)) };
  }
  const status = view.status;
  const sets = view.sets;
  const ep = view.endPressure;
  const zero = num(view.startedAt, 0);
  return {
    phase: status === 'ENDED' ? 'ended' : 'game',
    setsPossible: sets ? num(sets.possible, 0) : null,
    misses: ep ? Math.max(0, num(ep.misses, 0)) : 0,
    limit: ep ? Math.max(0, num(ep.limit, 0)) : 0,
    at: num(view.serverNow, 0),
    zero,
    seed: mix(hashString(roomCode), Math.floor(zero / 1000)),
  };
}
