/* voicing.ts - DATA (MUSIC_PLAN §4.1). What the hum holds in each state of the score, and how often a far horn calls.
 * Hum levels are dB re the state's loudest partial (the last set's lone dominant sits 3 dB under that); the whole hum's
 * level is the Score bus's (§6.1, set from the harness). Partials are of the 58 Hz fundamental.
 */

import type { Profile } from '../cuesheet.js';
import type { ScoreStage } from './phrases.js';

/**
 * The states of the score. `call` is the tulnic calling the table (the hum is silent under it); `gate` is the stall gate
 * shut; `last` is one set still possible; `finale` runs from the last lay's stamp through the podium; `post` is after the
 * podium, back to the waiting room's voicing.
 */
export type ScoreState = 'lobby' | 'call' | 'dusk' | 'evening' | 'night' | 'gate' | 'last' | 'finale' | 'post';
export const SCORE_STATES: readonly ScoreState[] = ['lobby', 'call', 'dusk', 'evening', 'night', 'gate', 'last', 'finale', 'post'];

export type HumPartial = readonly [partial: number, db: number];

/**
 * The hum per state and profile. Every state's hum carries the same total power (the conductor normalises it), so these are
 * the balance between the chord's notes, not its level: the harness measured the plan's first voicings (upper partials at
 * -6 to -12 dB) sitting 10 dB under the pond in their own bands (#18, as round 2 predicted), so they are flatter here.
 * The speaker arrangement keeps every in-play partial at or above 290 Hz (partial 5).
 */
export const HUM: Record<ScoreState, Record<Profile, readonly HumPartial[]>> = {
  lobby: { headphones: [[2, -6], [4, 0], [6, -2], [8, -4]], speaker: [[4, -2], [6, 0], [8, -3]] },
  call: { headphones: [], speaker: [] },
  dusk: { headphones: [[6, 0], [9, -2], [12, -1]], speaker: [[6, 0], [9, -2], [12, -1]] },
  evening: { headphones: [[5, -1], [6, 0], [10, -1]], speaker: [[5, -1], [6, 0], [10, -1]] },
  night: { headphones: [[5, -2], [7, 0], [9, -2]], speaker: [[5, -2], [7, 0], [9, -2]] },
  gate: { headphones: [[9, 0], [10, -1]], speaker: [[9, 0], [10, -1]] },
  last: { headphones: [[6, 0]], speaker: [[6, 0]] },
  finale: { headphones: [], speaker: [] },
  post: { headphones: [[2, -6], [4, 0], [6, -2], [8, -4]], speaker: [[4, -2], [6, 0], [8, -3]] },
};

/** the linear gains of a state's hum, normalised to unit total power */
export function humGains(state: ScoreState, profile: Profile): Array<[number, number]> {
  const lin = HUM[state][profile].map(([p, d]) => [p, 10 ** (d / 20)] as [number, number]);
  const power = lin.reduce((a, [, g]) => a + g * g, 0);
  return power > 0 ? lin.map(([p, g]) => [p, g / Math.sqrt(power)] as [number, number]) : [];
}

/** the stage whose phrase bag a state draws from; null where no horn calls */
export const BAG: Record<ScoreState, ScoreStage | null> = {
  lobby: 'lobby', post: 'lobby', dusk: 'dusk', evening: 'evening', night: 'night', call: null, gate: null, last: null, finale: null,
};

/** How often a slot is active, and how often an active call is answered. The waiting room calls at every slot for its
 * first three minutes (players arrive), then one slot in three. */
export interface Activity {
  call: number;
  answer: number;
  /** on the speaker arrangement, answers are heard only at night */
  speakerAnswers: boolean;
}
export const ACTIVITY: Record<ScoreState, Activity> = {
  lobby: { call: 1 / 3, answer: 1 / 3, speakerAnswers: false },
  post: { call: 1 / 3, answer: 1 / 3, speakerAnswers: false },
  dusk: { call: 3 / 8, answer: 0, speakerAnswers: false },
  evening: { call: 1 / 2, answer: 1 / 3, speakerAnswers: false },
  night: { call: 3 / 4, answer: 1 / 2, speakerAnswers: true },
  call: { call: 0, answer: 0, speakerAnswers: false },
  gate: { call: 0, answer: 0, speakerAnswers: false },
  last: { call: 0, answer: 0, speakerAnswers: false },
  finale: { call: 0, answer: 0, speakerAnswers: false },
};
/** the waiting room's first stretch: every slot calls */
export const LOBBY_BUSY_MS = 180_000;
/** no call in the first 40 s of dusk: the table has just been called */
export const DUSK_QUIET_MS = 40_000;

/** how long the tulnic's call to the table lasts, from the game's zero: the hum waits for its last repeat */
export const CALL_MS = 8_300;
/** the podium beat, the podium phrase and six seconds of silence, from the ending broadcast: then the waiting room's voicing */
export const POST_AFTER_MS = 500 + 2_600 + 6_000 + 1_000;

/** Swells (entrances from silence) and the cut (a change of chord, on a knock), seconds (§4.2, A5) */
export const SWELL_S = { dusk: 6, post: 4, rejoin: 1.5, lobby: 4 } as const;
export const CUT_S = 0.025;
/** a phrase in flight at a cut finishes if this little is left, else it fades over FADE_S */
export const FINISH_S = 1.5;
export const FADE_S = 0.3;
/** a slot's state is decided on the latest broadcast at least this long before it (§5.2) */
export const LOCK_MS = 2_000;
/** a slot whose chord has not been cut yet on this client waits this long for the cut, else it is dropped (D-g) */
export const DEFER_MS = 3_000;
/** no slot starts within this long after a ceremony ends (§4.2) */
export const CEREMONY_HOLD_MS = 10_000;

/** Distances (§3.6, Appendix B): a call is the near horn, an answer the far one */
export const CALL_LP_HZ = 900;
export const ANSWER_LP_HZ = 650;
export const ANSWER_DB = -6;
export const ANSWER_DELAY_S: readonly [number, number] = [0.9, 2.5];
/** headphones only: the valley's two discrete repeats of a far answer */
export const ANSWER_REPEATS: ReadonlyArray<{ at: number; db: number; lpHz: number }> = [
  { at: 1.3, db: -12, lpHz: 520 },
  { at: 2.9, db: -19, lpHz: 380 },
];
export const PAN = { near: -0.35, far: 0.55 } as const;
