/* variation.ts - PURE. How a repeated cue avoids being the same sound twice (SOUND_DESIGN §5).
 *
 * Every frequent cue has three discrete takes; on top of the take, a small continuous pitch (+-5 % in all),
 * gain (+-1.5 dB) and, for some cues, timing spread. Everything here is a function of a seed, and the seed is
 * derived from the PUBLIC record only (`publicSeed`, cues.ts) - so two clients that watched the same public
 * record hear the same jitter, and a hidden event (which advances the room's `seq` for its owner) cannot move it.
 *
 * Feel (SOUND_DESIGN §5): a hard knock lands on time; the answering knock lands a little late; a few frequent,
 * quiet cues get a few ms of spread; the clock and the ceremony are exact.
 */

import { rng } from './util.js';

export type Feel = 'exact' | 'hard' | 'answer' | 'spread';

export interface Humanized {
  /** which of the cue's takes: 0..takes-1 */
  take: number;
  /** a multiplier on the cue's pitches: 0.95..1.05 */
  pitch: number;
  /** dB, +-1.5 */
  gainDb: number;
  /** ms added to the cue's place on the beat */
  lagMs: number;
}

/** each take sits a little apart from the others in pitch; the continuous part stays inside +-3 % */
export const TAKE_PITCH = [-0.02, 0, 0.02] as const;
export const PITCH_SPREAD = 0.03;
export const GAIN_SPREAD_DB = 1.5;
/** the answering knock: 35..65 ms after the beat the question landed on */
export const ANSWER_LAG_MS: readonly [number, number] = [35, 65];
export const SPREAD_MS = 6;

export function humanize(seed: number, takes: number, feel: Feel, pitchSpread = PITCH_SPREAD): Humanized {
  const r = rng(seed ^ 0x5bd1e995);
  const take = takes > 1 ? Math.floor(r() * takes) % takes : 0;
  const pitch = 1 + (TAKE_PITCH[take % 3] ?? 0) * (takes > 1 ? 1 : 0) + (r() * 2 - 1) * pitchSpread;
  const gainDb = (r() * 2 - 1) * GAIN_SPREAD_DB;
  const u = r();
  const lagMs =
    feel === 'answer' ? Math.round(ANSWER_LAG_MS[0] + u * (ANSWER_LAG_MS[1] - ANSWER_LAG_MS[0])) : feel === 'spread' ? Math.round((u * 2 - 1) * SPREAD_MS) : 0;
  return { take, pitch: Math.round(pitch * 10000) / 10000, gainDb: Math.round(gainDb * 100) / 100, lagMs };
}

/** consecutive bonus turns raise the totem's pitch a little: +1.2 % each, five steps at most (+6 %) */
export const CHAIN_STEP = 0.012;
export const CHAIN_MAX = 5;
export const chainPitch = (chain: number): number => 1 + CHAIN_STEP * Math.min(CHAIN_MAX, Math.max(0, chain));
