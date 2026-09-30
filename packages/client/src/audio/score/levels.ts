/* levels.ts - the score's levels (MUSIC_PLAN §6.1). Kept apart from the lazy score chunk so the mixer can read them.
 * "Measured, not set": `npm run audio:check` measures the world stem, the hum's presence and the calls against the anchor
 * (checks #17-#19, #22) and these are the values it passed with. */

import type { ScoreSynthOptions } from './synth.js';

/** the player's switch under the Music slider (MUSIC_PLAN A12): on, in the waiting room only, or off */
export type ScoreMode = 'on' | 'lobby' | 'off';

/** the Score bus, dB re Table (the ambience sits at -26) */
export const SCORE_BUS_DB = -26;

/** the hum against the horn inside the synth */
export const SCORE_SYNTH: Partial<ScoreSynthOptions> = { humDb: 0, hornDb: 0, bandwidthHz: 3 };

/** with the score on in play, the pond gives up this much to make room for the hum (A2) */
export const POND_WITH_SCORE_DB = -2;
/** the waiting room's pond factor: 2.2 alone, 1.6 with the score under it (§6.1) */
export const LOBBY_POND = { alone: 2.2, withScore: 1.6 } as const;
