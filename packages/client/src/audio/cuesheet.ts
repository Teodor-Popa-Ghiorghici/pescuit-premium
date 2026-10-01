/* The cue sheet as DATA (Appendix D, reshaped by SOUND_DESIGN.md). Levels are dB relative to
 * the bus, after class normalisation and mastering (§3.3). `Prio` runs 0-5. A unit test
 * (test/cuesheet.test.ts) enforces §3.7 on this table: play band, variation, maximum length and
 * bus. There is no cue for Squid, in any form: silence has no id. There is no private tier: every cue is
 * heard by everyone it concerns, so no client hears something another cannot.
 */

import type { Feel } from './variation.js';
import { SCORE_BUS_DB } from './score/levels.js';

export type BusName = 'UI' | 'Table' | 'Power' | 'Clock' | 'Music' | 'Ambience' | 'Score';
export const BUS_NAMES: readonly BusName[] = ['UI', 'Table', 'Power', 'Clock', 'Music', 'Ambience', 'Score'];

/** §3.5: levels re Table = 0 dB; UI and Clock get +4 dB on speakers, the Clock +2 dB on headphones; the ambience is
 * activity-shaped on top of its -26 dB. `voices` is the per-bus cap. */
export const BUSES: Record<BusName, { levelDb: number; speakerBoostDb: number; headphonesBoostDb: number; voices: number }> = {
  UI: { levelDb: -10, speakerBoostDb: 4, headphonesBoostDb: 0, voices: 2 },
  Table: { levelDb: 0, speakerBoostDb: 0, headphonesBoostDb: 0, voices: 6 },
  Power: { levelDb: 1, speakerBoostDb: 0, headphonesBoostDb: 0, voices: 3 },
  // +2 dB in headphones (MUSIC_PLAN A9): the clock keeps its margin over the world when the score is under it
  Clock: { levelDb: -8, speakerBoostDb: 4, headphonesBoostDb: 2, voices: 2 },
  Music: { levelDb: -2, speakerBoostDb: 0, headphonesBoostDb: 0, voices: 2 },
  Ambience: { levelDb: -26, speakerBoostDb: 0, headphonesBoostDb: 0, voices: 3 },
  // the background score (MUSIC_PLAN A7): its own stem, its own duck and darkening gain; no cue plays on it. Its level is
  // measured, not set: the harness puts the hum 3 dB under the pond (check #17-#18). The Music slider scales it.
  Score: { levelDb: SCORE_BUS_DB, speakerBoostDb: 0, headphonesBoostDb: 0, voices: 0 },
};

/** The global voice cap and the priority order it steals in (§3.5). */
export const GLOBAL_VOICES = 14;

/** Who hears it: every client / the acting client / the seat a public fact concerns. There is no private tier: a
 * cue that only one client can hear is a tell (SOUND_DESIGN §4, D3). */
export type Heard = 'all' | 'local' | 'you';

/** transient (< 200 ms: normalised by K-weighted level over its active span) or sustained
 * (normalised by maximum momentary loudness) */
export type CueClass = 'T' | 'S';

/** 'src': the table is active (the ambience eases under it); 'ex': a rare signature moment (the ambience ducks under it) */
export type Env = 'src' | 'ex' | null;

/** Which cue a power's use is voiced by. Squid is not in the table, so it cannot sound. */
export const POWER_CUE: Readonly<Record<string, string | undefined>> = {
  shark: 'power.shark',
  tortoise: 'power.tortoise',
  lanternfish: 'power.lanternfish',
  mantisShrimp: 'power.mantis',
  jellyfish: 'power.jellyfish',
  stickleback: 'power.stickleback',
  whale: 'power.whale',
  clownfish: 'power.clownfish.bound',
};

/** The only three cues allowed to leave the palette: the cards that break the rope frame (SOUND_DESIGN §1.3) */
export const FRAME_BREAKERS: ReadonlySet<string> = new Set(['power.shark', 'power.mantis', 'power.whale']);

export interface CueDef {
  id: string;
  bus: BusName;
  heard: Heard;
  /** plays per game across both bot populations (§1.1); null where it is per input, rare or set by T */
  plays: [number, number] | null;
  levelDb: number;
  prio: 0 | 1 | 2 | 3 | 4 | 5;
  /** Inst.: at most this many at once */
  inst: number;
  cooldownMs: number;
  /** how many takes: three for anything heard often (variation.ts adds a little pitch, gain and timing on top) */
  variation: number;
  maxLenMs: number;
  /** the backlog variant, as the sheet words it (null = none) */
  short: string | null;
  env: Env;
  /** how long the ambience stays ducked under an 'ex' cue, ms (the cue's length if absent) */
  duckMs?: number;
  /** the background score ducks this far under the cue, for its `duckMs` (MUSIC_PLAN §4.2); never on a cut point */
  scoreDuckDb?: number;
  cls: CueClass;
  /** where it sits on the beat: exact, hard (on time), answer (a little late), spread (a few ms either way) */
  feel: Feel;
  /** may strike a ringing plank A, B or C: the only cues that carry a seat signature */
  seat?: boolean;
}

type Row = Omit<CueDef, 'cooldownMs' | 'inst' | 'env' | 'cls' | 'short' | 'seat' | 'feel' | 'duckMs' | 'scoreDuckDb'> &
  Partial<Pick<CueDef, 'cooldownMs' | 'inst' | 'env' | 'cls' | 'short' | 'seat' | 'feel' | 'duckMs' | 'scoreDuckDb'>>;
const row = (r: Row): CueDef => ({ cooldownMs: 0, inst: 1, env: null, cls: 'T', short: null, feel: 'exact', ...r });

/** a rare signature moment: the ambience ducks under it */
const EX = { env: 'ex' as const };

export const CUES: readonly CueDef[] = [
  // interface
  row({ id: 'ui.press', bus: 'UI', heard: 'local', plays: null, levelDb: 0, prio: 1, inst: 2, cooldownMs: 40, variation: 3, maxLenMs: 60, short: 'same' }),
  row({ id: 'ui.press.soft', bus: 'UI', heard: 'local', plays: null, levelDb: -4, prio: 1, inst: 2, cooldownMs: 40, variation: 3, maxLenMs: 60, short: 'same' }),
  row({ id: 'ui.select', bus: 'UI', heard: 'local', plays: [12, 26], levelDb: -2, prio: 1, inst: 2, cooldownMs: 60, variation: 3, maxLenMs: 90, short: 'same' }),
  row({ id: 'ui.drop', bus: 'UI', heard: 'local', plays: [12, 26], levelDb: -4, prio: 1, inst: 2, cooldownMs: 60, variation: 3, maxLenMs: 90, short: 'same' }),
  row({ id: 'ui.target', bus: 'UI', heard: 'local', plays: [12, 26], levelDb: -2, prio: 1, inst: 2, cooldownMs: 60, variation: 3, maxLenMs: 90, short: 'same', seat: true }),
  row({ id: 'ui.error', bus: 'UI', heard: 'local', plays: null, levelDb: 0, prio: 2, cooldownMs: 250, variation: 3, maxLenMs: 120, short: 'same' }),
  row({ id: 'ui.toggle', bus: 'UI', heard: 'local', plays: null, levelDb: -3, prio: 1, cooldownMs: 100, variation: 3, maxLenMs: 120, short: 'same' }),
  row({ id: 'ui.copy', bus: 'UI', heard: 'local', plays: null, levelDb: -3, prio: 1, cooldownMs: 250, variation: 3, maxLenMs: 120, short: 'same' }),

  // the table
  row({ id: 'table.turn', bus: 'Table', heard: 'all', plays: [78, 99], levelDb: -6, prio: 2, cooldownMs: 150, variation: 3, maxLenMs: 200, short: 'same', env: 'src', seat: true, feel: 'spread' }),
  row({ id: 'table.ask', bus: 'Table', heard: 'all', plays: [75, 95], levelDb: -4, prio: 2, cooldownMs: 150, variation: 3, maxLenMs: 200, short: 'knock', env: 'src', seat: true, feel: 'hard' }),
  row({ id: 'table.turn.you', bus: 'Table', heard: 'you', plays: [13, 27], levelDb: -2, prio: 3, cooldownMs: 300, variation: 3, maxLenMs: 190, short: 'signature', env: 'src', seat: true, feel: 'spread' }),
  row({ id: 'table.bonus', bus: 'Table', heard: 'all', plays: [21, 28], levelDb: -4, prio: 2, cooldownMs: 200, variation: 3, maxLenMs: 200, short: 'one knock', env: 'src', seat: true, feel: 'spread' }),
  row({ id: 'table.skipped', bus: 'Table', heard: 'all', plays: null, levelDb: -4, prio: 2, cooldownMs: 200, variation: 3, maxLenMs: 400, short: 'same', env: 'src', seat: true }),
  row({ id: 'table.asked', bus: 'Table', heard: 'you', plays: [12, 26], levelDb: -2, prio: 3, variation: 3, maxLenMs: 120, short: 'one tap' }),
  row({ id: 'table.flight', bus: 'Table', heard: 'all', plays: [22, 29], levelDb: -10, prio: 1, inst: 2, cooldownMs: 100, variation: 3, maxLenMs: 260, short: 'dropped' }),
  row({ id: 'table.give', bus: 'Table', heard: 'all', plays: [22, 29], levelDb: -2, prio: 3, variation: 3, maxLenMs: 340, short: 'landing', env: 'src', feel: 'answer' }),
  row({ id: 'table.gofish', bus: 'Table', heard: 'all', plays: [24, 45], levelDb: -2.5, prio: 3, variation: 3, maxLenMs: 350, short: 'thud', env: 'src', feel: 'answer' }),
  row({ id: 'table.gofish.dry', bus: 'Table', heard: 'all', plays: [8, 48], levelDb: -2, prio: 3, variation: 3, maxLenMs: 190, short: 'thud', env: 'src', feel: 'answer' }),
  row({ id: 'table.draw', bus: 'Table', heard: 'all', plays: [23, 45], levelDb: -6, prio: 2, inst: 3, cooldownMs: 60, variation: 3, maxLenMs: 140, short: 'drip', env: 'src', feel: 'spread' }),
  row({ id: 'table.refill', bus: 'Table', heard: 'all', plays: [2, 12], levelDb: -6, prio: 2, variation: 3, maxLenMs: 360, short: 'drip', env: 'src', feel: 'spread' }),
  row({ id: 'table.poolEmpty', bus: 'Table', heard: 'all', plays: [1, 1], levelDb: 2, prio: 4, variation: 1, maxLenMs: 1200, short: 'gurgle', env: 'src', cls: 'S' }),
  // a set laid: face up, a power set face up, and a power set laid face down (Mode Ascuns). Which one plays is a function of the
  // mode and `isPowerSet` only; the rank is never an input.
  row({ id: 'table.lay', bus: 'Table', heard: 'all', plays: [6, 9], levelDb: 0, prio: 3, variation: 3, maxLenMs: 450, short: 'stamp', env: 'src', feel: 'spread' }),
  row({ id: 'table.lay.power', bus: 'Table', heard: 'all', plays: [6, 9], levelDb: 0, prio: 3, variation: 3, maxLenMs: 450, short: 'stamp', env: 'src', feel: 'spread' }),
  row({ id: 'table.lay.hidden', bus: 'Table', heard: 'all', plays: [6, 9], levelDb: 0, prio: 3, variation: 3, maxLenMs: 450, short: 'thump', env: 'src', feel: 'spread' }),
  // one clay tick per egg in the set laid (its `eggCount` is public); never on a draw or a hand-over
  row({ id: 'table.egg', bus: 'Table', heard: 'all', plays: [4, 20], levelDb: -8, prio: 2, variation: 3, maxLenMs: 330, short: 'one tick', env: 'src', feel: 'spread' }),
  // the weight of a frame-breaker's strike on the table top: Shark, Mantis Shrimp and Whale only
  row({ id: 'table.impact', bus: 'Table', heard: 'all', plays: [3, 7], levelDb: 0, prio: 4, variation: 3, maxLenMs: 380, short: 'boom', env: 'src', feel: 'hard' }),
  row({ id: 'table.tally', bus: 'Table', heard: 'all', plays: null, levelDb: -6, prio: 2, inst: 2, cooldownMs: 60, variation: 3, maxLenMs: 90, short: 'same', feel: 'spread' }),

  // the world: the tally of sets still possible crossing 12, 6 and 1 (the light steps darker, the ambience one flat step with it),
  // and a chisel tick for each notch that counts down the rim
  row({ id: 'world.dark.12', bus: 'Table', heard: 'all', plays: [0, 1], levelDb: -2, prio: 4, variation: 1, maxLenMs: 180, ...EX, duckMs: 600 }),
  row({ id: 'world.dark.06', bus: 'Table', heard: 'all', plays: [0, 1], levelDb: -2, prio: 4, variation: 1, maxLenMs: 180, ...EX, duckMs: 600 }),
  // the last set's knock is a table sound (MUSIC_PLAN A8): a music slider at 0 must not silence an informative knock
  row({ id: 'world.dark.01', bus: 'Table', heard: 'all', plays: [0, 1], levelDb: -2, prio: 4, variation: 1, maxLenMs: 180, ...EX, duckMs: 600 }),
  row({ id: 'world.notch', bus: 'Table', heard: 'all', plays: [15, 30], levelDb: -12, prio: 2, inst: 3, cooldownMs: 50, variation: 3, maxLenMs: 50, short: 'same', feel: 'spread' }),

  // ceremony: the tulnic calls the table, and returns at the podium
  row({ id: 'mus.start', bus: 'Music', heard: 'all', plays: [1, 1], levelDb: 0, prio: 5, variation: 1, maxLenMs: 8300, cls: 'S', ...EX, duckMs: 3300 }),
  row({ id: 'mus.podium', bus: 'Music', heard: 'all', plays: [1, 1], levelDb: 0, prio: 5, variation: 1, maxLenMs: 2600, cls: 'S', ...EX, duckMs: 2600 }),
  // the last set: one bare low note of the tulnic, partial 4, on the knock of world.dark.01 - the first tonic since the lobby
  row({ id: 'mus.home', bus: 'Music', heard: 'all', plays: [0, 1], levelDb: 0, prio: 5, variation: 1, maxLenMs: 1320, cls: 'S', ...EX, duckMs: 1400 }),

  // the clock (the answer window only)
  row({ id: 'clock.tick', bus: 'Clock', heard: 'all', plays: null, levelDb: -1.2, prio: 5, cooldownMs: 900, variation: 3, maxLenMs: 60, short: 'same' }),
  // tightened by spacing, not by volume: the same level as the tick
  row({ id: 'clock.tick.urgent', bus: 'Clock', heard: 'all', plays: null, levelDb: -1.2, prio: 5, cooldownMs: 400, variation: 3, maxLenMs: 60, short: 'same' }),
  row({ id: 'clock.close', bus: 'Clock', heard: 'all', plays: [74, 94], levelDb: -2, prio: 5, variation: 3, maxLenMs: 60, short: 'same' }),

  // the turn's rope (HAND_AND_TURN_PLAN #5): the last 15 s of an ask burn as a rope, for everyone at the table. Rope and paper
  // only - the fuse is lit (the rope takes the load, a match scratches the paper), it smoulders once a second, strains twice
  // a second in the last five, and parts when it burns through. Per turn, not per game: no play band.
  row({ id: 'clock.rope', bus: 'Clock', heard: 'all', plays: null, levelDb: -2, prio: 4, cooldownMs: 1000, variation: 3, maxLenMs: 420, short: 'same' }),
  row({ id: 'clock.rope.burn', bus: 'Clock', heard: 'all', plays: null, levelDb: -7, prio: 3, cooldownMs: 700, variation: 3, maxLenMs: 160, short: 'same' }),
  row({ id: 'clock.rope.urgent', bus: 'Clock', heard: 'all', plays: null, levelDb: -4, prio: 4, cooldownMs: 350, variation: 3, maxLenMs: 200, short: 'same' }),
  row({ id: 'clock.rope.out', bus: 'Clock', heard: 'all', plays: null, levelDb: -1, prio: 5, cooldownMs: 1000, variation: 3, maxLenMs: 450, short: 'same' }),

  // powers. A power was granted: the same cue for every rank in both modes.
  row({ id: 'power.granted', bus: 'Power', heard: 'all', plays: [5, 8], levelDb: -2, prio: 4, variation: 3, maxLenMs: 320, short: '250 ms', env: 'src', feel: 'spread' }),
  // the power gathers itself: a swell that ends exactly on the strike (the three frame-breakers only)
  row({ id: 'power.windup', bus: 'Power', heard: 'all', plays: [3, 7], levelDb: -5, prio: 4, variation: 3, maxLenMs: 260, short: 'none', env: 'src', cls: 'S' }),
  row({ id: 'power.reveal', bus: 'Power', heard: 'all', plays: [1, 6], levelDb: 0, prio: 4, variation: 3, maxLenMs: 400, short: 'clacks', ...EX, duckMs: 500 , scoreDuckDb: -10 }),
  row({ id: 'power.shark', bus: 'Power', heard: 'all', plays: [0, 1], levelDb: 0, prio: 4, variation: 2, maxLenMs: 460, short: 'bite', ...EX, duckMs: 700, feel: 'hard' , scoreDuckDb: -10 }),
  row({ id: 'power.mantis', bus: 'Power', heard: 'all', plays: [0, 1], levelDb: -4.5, prio: 4, variation: 2, maxLenMs: 320, short: 'club', ...EX, duckMs: 600, feel: 'hard' , scoreDuckDb: -10 }),
  row({ id: 'power.lanternfish', bus: 'Power', heard: 'all', plays: [0, 1], levelDb: -1.5, prio: 4, variation: 2, maxLenMs: 400, short: 'first hit', env: 'src', seat: true, feel: 'hard' }),
  row({ id: 'power.tortoise', bus: 'Power', heard: 'all', plays: [0, 1], levelDb: -1.5, prio: 4, variation: 2, maxLenMs: 450, short: 'first hit', env: 'src', feel: 'hard' }),
  row({ id: 'power.jellyfish', bus: 'Power', heard: 'all', plays: [0, 1], levelDb: 0, prio: 4, variation: 2, maxLenMs: 460, short: 'first hit', env: 'src', feel: 'hard' }),
  row({ id: 'power.stickleback', bus: 'Power', heard: 'all', plays: [0, 1], levelDb: 0, prio: 4, variation: 2, maxLenMs: 280, short: 'first hit', env: 'src', feel: 'hard' }),
  row({ id: 'power.stickleback.miss', bus: 'Power', heard: 'all', plays: [0, 1], levelDb: 0, prio: 4, variation: 2, maxLenMs: 200, short: 'first hit', env: 'src', feel: 'hard' }),
  row({ id: 'power.whale', bus: 'Power', heard: 'all', plays: [0, 1], levelDb: 1, prio: 4, variation: 1, maxLenMs: 1400, short: '400 ms', ...EX, duckMs: 1400, cls: 'S', feel: 'hard' , scoreDuckDb: -10 }),
  row({ id: 'power.clownfish.bound', bus: 'Power', heard: 'all', plays: [0, 1], levelDb: -4, prio: 3, variation: 1, maxLenMs: 220, short: 'peg' }),

  // world and meta
  // 0-6 a game, stalls only (Appendix D): a stall is a state, not a play count, so §3.7's bands do not apply
  row({ id: 'amb.gate', bus: 'Ambience', heard: 'all', plays: null, levelDb: -20, prio: 1, cooldownMs: 200, variation: 3, maxLenMs: 400 }),
  row({ id: 'meta.join', bus: 'Table', heard: 'all', plays: null, levelDb: -4, prio: 2, cooldownMs: 200, variation: 3, maxLenMs: 200, short: 'same', seat: true }),
  row({ id: 'meta.leave', bus: 'Table', heard: 'all', plays: null, levelDb: -4, prio: 2, cooldownMs: 200, variation: 3, maxLenMs: 200, short: 'same', seat: true }),
  row({ id: 'meta.reconnected', bus: 'UI', heard: 'you', plays: null, levelDb: -4, prio: 2, cooldownMs: 200, variation: 3, maxLenMs: 200, short: 'same' }),
  row({ id: 'meta.nudge', bus: 'Table', heard: 'you', plays: null, levelDb: -4, prio: 2, cooldownMs: 200, variation: 3, maxLenMs: 200, short: 'same', seat: true }),
];

/**
 * How long a cue lasts, ms: a static function of its definition and its PUBLIC parameters - never of anything rendered
 * or measured. Two clients that hold the same public record agree on it, and so do two worlds that differ only in a
 * hidden card; the leak tests compare it.
 */
export function durationOf(id: string, p: { count?: number } = {}): number {
  const def = INDEX.get(id);
  if (!def) return 0;
  const n = Math.max(1, Math.floor(p.count ?? 1));
  switch (id) {
    case 'table.refill': return 90 * (Math.min(4, n) - 1) + 140;
    case 'table.egg': return 40 + 65 * (Math.min(4, n) - 1);
    default: return def.maxLenMs;
  }
}

export type CueId = string;

const INDEX: ReadonlyMap<string, CueDef> = new Map(CUES.map((c) => [c.id, c]));
export const cueDef = (id: string): CueDef | undefined => INDEX.get(id);

/** the cues that carry a seat signature: the only ones allowed to ring a plank A, B or C */
export const SEAT_CUES: ReadonlySet<string> = new Set(CUES.filter((c) => c.seat).map((c) => c.id));

export type PlayBand = 'gt60' | '15-60' | '3-15' | 'lt3';
/** §3.7: the band a cue falls in is set by the most it can play in a game */
export function bandOf(plays: [number, number]): PlayBand {
  const max = plays[1];
  return max > 60 ? 'gt60' : max >= 15 ? '15-60' : max >= 3 ? '3-15' : 'lt3';
}

/** The class targets of the class normalisation (§3.3), LUFS. */
export const CLASS_TARGET_LUFS: Record<CueClass, number> = { T: -20, S: -23 };

/** The anchor cue and the loudness it is calibrated to per profile (§3.3, provisional until
 * the call test). */
export const ANCHOR_CUE = 'table.turn';
export type Profile = 'speaker' | 'headphones';
export const ANCHOR_LUFS: Record<Profile, number> = { speaker: -21, headphones: -25 };

/** Mastering (§3.3): peaks are rounded until they sit at most this far over the cue's class
 * loudness. */
export const MASTER_CAP_DB: Record<Profile, number> = { speaker: 12, headphones: 16 };

/** Cues exempt from the 250 ms echo budget: heard once a game (§3.4). */
export const ECHO_EXEMPT: ReadonlySet<string> = new Set(['mus.start', 'mus.podium', 'mus.home']);

/** Squid has no cue and no motif: any request naming it is silence. */
export const SILENT_RANKS: ReadonlySet<string> = new Set(['squid']);
