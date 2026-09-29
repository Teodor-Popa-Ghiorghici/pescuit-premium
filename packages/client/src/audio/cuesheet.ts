/* The cue sheet as DATA (Appendix D, with the cues Appendix C adds). Levels are dB relative to
 * the bus, after class normalisation and mastering (§3.3). `Prio` runs 0-5. A unit test
 * (test/cuesheet.test.ts) enforces §3.7 on this table: play band, variation, maximum length and
 * bus. Appendix D is generated from it. Cue ids are exactly those of Appendix C/D; there is no
 * cue for Squid, in any form: silence has no id.
 */

export type BusName = 'UI' | 'Table' | 'Power' | 'Clock' | 'Music' | 'Ambience';
export const BUS_NAMES: readonly BusName[] = ['UI', 'Table', 'Power', 'Clock', 'Music', 'Ambience'];

/** §3.5: levels re Table = 0 dB; UI and Clock get +4 dB on speakers; the ambience is
 * activity-shaped on top of its -26 dB. `voices` is the per-bus cap. */
export const BUSES: Record<BusName, { levelDb: number; speakerBoostDb: number; voices: number }> = {
  UI: { levelDb: -10, speakerBoostDb: 4, voices: 2 },
  Table: { levelDb: 0, speakerBoostDb: 0, voices: 6 },
  Power: { levelDb: 1, speakerBoostDb: 0, voices: 3 },
  Clock: { levelDb: -8, speakerBoostDb: 4, voices: 2 },
  Music: { levelDb: -2, speakerBoostDb: 0, voices: 2 },
  Ambience: { levelDb: -26, speakerBoostDb: 0, voices: 3 },
};

/** The global voice cap and the priority order it steals in (§3.5). */
export const GLOBAL_VOICES = 14;

/** Who hears it (Appendix C): every client / the acting client / the seat a public fact
 * concerns / headphones mode only. */
export type Heard = 'all' | 'local' | 'you' | 'private';

/** transient (< 200 ms: normalised by K-weighted level over its active span) or sustained
 * (normalised by maximum momentary loudness) */
export type CueClass = 'T' | 'S';

export type Env = 'src' | 'ex' | null;

/** The nine powers, minus the one that has no motif. Ids use these short names. */
export const MOTIF_RANKS = ['shark', 'tortoise', 'lanternfish', 'mantis', 'jellyfish', 'stickleback', 'whale', 'clownfish'] as const;
export type MotifRank = (typeof MOTIF_RANKS)[number];

/** Engine rank keys -> the short names cue ids use. `squid` is deliberately absent: a rest. */
export const RANK_TO_MOTIF: Record<string, MotifRank | undefined> = {
  shark: 'shark',
  tortoise: 'tortoise',
  lanternfish: 'lanternfish',
  mantisShrimp: 'mantis',
  mantis: 'mantis',
  jellyfish: 'jellyfish',
  stickleback: 'stickleback',
  whale: 'whale',
  clownfish: 'clownfish',
};

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
  /** 'live' = continuous seeded variation; a number = takes */
  variation: 'live' | number;
  maxLenMs: number;
  /** the backlog variant, as the sheet words it (null = none) */
  short: string | null;
  env: Env;
  cls: CueClass;
  /** may strike a ringing plank A, B or C: the only cues that carry a seat signature */
  seat?: boolean;
}

type Row = Omit<CueDef, 'cooldownMs' | 'inst' | 'env' | 'cls' | 'short' | 'seat'> & Partial<Pick<CueDef, 'cooldownMs' | 'inst' | 'env' | 'cls' | 'short' | 'seat'>>;
const row = (r: Row): CueDef => ({ cooldownMs: 0, inst: 1, env: null, cls: 'T', short: null, ...r });

const P = (rank: MotifRank, kind: 'used' | 'granted'): CueDef =>
  row(kind === 'used'
    ? { id: `power.used.${rank}`, bus: 'Power', heard: 'all', plays: [0, 1], levelDb: 0, prio: 4, variation: 1, maxLenMs: 1200, short: '2 notes', env: 'src', cls: 'S' }
    : { id: `power.granted.${rank}`, bus: 'Power', heard: 'all', plays: [0, 1], levelDb: -4, prio: 4, variation: 1, maxLenMs: 1000, short: '2 notes', env: 'src', cls: 'S' });

export const CUES: readonly CueDef[] = [
  // interface
  row({ id: 'ui.press', bus: 'UI', heard: 'local', plays: null, levelDb: 0, prio: 1, inst: 2, cooldownMs: 40, variation: 'live', maxLenMs: 60, short: 'same' }),
  row({ id: 'ui.press.soft', bus: 'UI', heard: 'local', plays: null, levelDb: -4, prio: 1, inst: 2, cooldownMs: 40, variation: 'live', maxLenMs: 60, short: 'same' }),
  row({ id: 'ui.select', bus: 'UI', heard: 'local', plays: [12, 26], levelDb: -2, prio: 1, inst: 2, cooldownMs: 60, variation: 'live', maxLenMs: 90, short: 'same' }),
  row({ id: 'ui.drop', bus: 'UI', heard: 'local', plays: [12, 26], levelDb: -4, prio: 1, inst: 2, cooldownMs: 60, variation: 'live', maxLenMs: 90, short: 'same' }),
  row({ id: 'ui.target', bus: 'UI', heard: 'local', plays: [12, 26], levelDb: -2, prio: 1, inst: 2, cooldownMs: 60, variation: 'live', maxLenMs: 90, short: 'same', seat: true }),
  row({ id: 'ui.error', bus: 'UI', heard: 'local', plays: null, levelDb: 0, prio: 2, cooldownMs: 250, variation: 2, maxLenMs: 120, short: 'same' }),
  row({ id: 'ui.toggle', bus: 'UI', heard: 'local', plays: null, levelDb: -3, prio: 1, cooldownMs: 100, variation: 3, maxLenMs: 120, short: 'same' }),
  row({ id: 'ui.copy', bus: 'UI', heard: 'local', plays: null, levelDb: -3, prio: 1, cooldownMs: 250, variation: 2, maxLenMs: 120, short: 'same' }),
  row({ id: 'clock.eligible', bus: 'UI', heard: 'private', plays: null, levelDb: 0, prio: 4, variation: 1, maxLenMs: 400, cls: 'S' }),

  // the table
  row({ id: 'table.turn', bus: 'Table', heard: 'all', plays: [78, 99], levelDb: -6, prio: 2, cooldownMs: 150, variation: 'live', maxLenMs: 200, short: 'same', env: 'src', seat: true }),
  row({ id: 'table.ask', bus: 'Table', heard: 'all', plays: [75, 95], levelDb: -4, prio: 2, cooldownMs: 150, variation: 'live', maxLenMs: 200, short: 'knock', env: 'src', seat: true }),
  row({ id: 'table.turn.you', bus: 'Table', heard: 'you', plays: [13, 27], levelDb: -2, prio: 3, cooldownMs: 300, variation: 'live', maxLenMs: 190, short: 'signature', env: 'src', seat: true }),
  row({ id: 'table.bonus', bus: 'Table', heard: 'all', plays: [21, 28], levelDb: -4, prio: 2, cooldownMs: 200, variation: 'live', maxLenMs: 200, short: 'one knock', env: 'src', seat: true }),
  row({ id: 'table.skipped', bus: 'Table', heard: 'all', plays: null, levelDb: -4, prio: 2, cooldownMs: 200, variation: 'live', maxLenMs: 400, short: 'same', env: 'src', seat: true }),
  row({ id: 'table.asked', bus: 'Table', heard: 'you', plays: [12, 26], levelDb: -2, prio: 3, variation: 'live', maxLenMs: 120, short: 'one tap' }),
  row({ id: 'table.flight', bus: 'Table', heard: 'all', plays: [22, 29], levelDb: -10, prio: 1, inst: 2, cooldownMs: 100, variation: 'live', maxLenMs: 260, short: 'dropped' }),
  row({ id: 'table.give', bus: 'Table', heard: 'all', plays: [22, 29], levelDb: -2, prio: 3, variation: 'live', maxLenMs: 340, short: 'landing', env: 'src' }),
  row({ id: 'table.gofish', bus: 'Table', heard: 'all', plays: [24, 45], levelDb: 0, prio: 3, variation: 'live', maxLenMs: 350, short: 'plop', env: 'src' }),
  row({ id: 'table.gofish.dry', bus: 'Table', heard: 'all', plays: [8, 48], levelDb: -2, prio: 3, variation: 'live', maxLenMs: 190, short: 'thud', env: 'src' }),
  row({ id: 'table.draw', bus: 'Table', heard: 'all', plays: [23, 45], levelDb: -6, prio: 2, inst: 3, cooldownMs: 60, variation: 'live', maxLenMs: 140, short: 'drip', env: 'src' }),
  row({ id: 'table.refill', bus: 'Table', heard: 'all', plays: [2, 12], levelDb: -6, prio: 2, variation: 3, maxLenMs: 360, short: 'drip', env: 'src' }),
  row({ id: 'table.poolEmpty', bus: 'Table', heard: 'all', plays: [1, 1], levelDb: 2, prio: 4, variation: 1, maxLenMs: 1200, short: 'gurgle', env: 'src', cls: 'S' }),
  row({ id: 'table.lay', bus: 'Table', heard: 'all', plays: [6, 9], levelDb: 0, prio: 3, variation: 4, maxLenMs: 450, short: 'stamp', env: 'src' }),
  row({ id: 'table.lay.power', bus: 'Table', heard: 'all', plays: [6, 9], levelDb: 0, prio: 3, variation: 3, maxLenMs: 450, short: 'stamp', env: 'src' }),
  row({ id: 'table.tally', bus: 'Table', heard: 'all', plays: null, levelDb: -6, prio: 2, inst: 2, cooldownMs: 60, variation: 'live', maxLenMs: 90, short: 'same' }),

  // ceremony
  row({ id: 'mus.start', bus: 'Music', heard: 'all', plays: [1, 1], levelDb: 0, prio: 5, variation: 1, maxLenMs: 3000, env: 'ex', cls: 'S' }),
  row({ id: 'mus.lastset', bus: 'Music', heard: 'all', plays: [1, 1], levelDb: 0, prio: 5, variation: 1, maxLenMs: 3000, env: 'ex', cls: 'S' }),
  row({ id: 'mus.end.win', bus: 'Music', heard: 'you', plays: [1, 1], levelDb: 0, prio: 5, variation: 1, maxLenMs: 3000, env: 'ex', cls: 'S' }),
  row({ id: 'mus.end.tie', bus: 'Music', heard: 'you', plays: [1, 1], levelDb: 0, prio: 5, variation: 1, maxLenMs: 3000, env: 'ex', cls: 'S' }),
  row({ id: 'mus.end.lose', bus: 'Music', heard: 'you', plays: [1, 1], levelDb: 0, prio: 5, variation: 1, maxLenMs: 3000, env: 'ex', cls: 'S' }),

  // the clock (the answer window only)
  row({ id: 'clock.tick', bus: 'Clock', heard: 'all', plays: null, levelDb: -2, prio: 5, cooldownMs: 900, variation: 'live', maxLenMs: 60, short: 'same' }),
  row({ id: 'clock.tick.urgent', bus: 'Clock', heard: 'all', plays: null, levelDb: 0, prio: 5, cooldownMs: 400, variation: 'live', maxLenMs: 60, short: 'same' }),
  row({ id: 'clock.close', bus: 'Clock', heard: 'all', plays: [74, 94], levelDb: -2, prio: 5, variation: 'live', maxLenMs: 60, short: 'same' }),

  // powers
  row({ id: 'power.granted', bus: 'Power', heard: 'all', plays: [5, 8], levelDb: -2, prio: 4, variation: 3, maxLenMs: 1400, short: '250 ms', env: 'src', cls: 'S' }),
  ...MOTIF_RANKS.map((r) => P(r, 'granted')),
  row({ id: 'power.granted.mine', bus: 'Power', heard: 'private', plays: [0, 1], levelDb: -4, prio: 4, variation: 1, maxLenMs: 1000, short: '2 notes', env: 'src', cls: 'S' }),
  ...MOTIF_RANKS.map((r) => P(r, 'used')),
  row({ id: 'power.reveal', bus: 'Power', heard: 'all', plays: [1, 6], levelDb: 0, prio: 4, variation: 3, maxLenMs: 400, short: 'clacks', env: 'src' }),
  row({ id: 'power.shark', bus: 'Power', heard: 'all', plays: [0, 1], levelDb: 0, prio: 4, variation: 2, maxLenMs: 460, short: 'bite', env: 'src' }),
  row({ id: 'power.mantis', bus: 'Power', heard: 'all', plays: [0, 1], levelDb: -2, prio: 4, variation: 2, maxLenMs: 460, short: 'club', env: 'src' }),
  row({ id: 'power.lanternfish', bus: 'Power', heard: 'all', plays: [0, 1], levelDb: 0, prio: 4, variation: 2, maxLenMs: 500, short: 'first hit', env: 'src', seat: true }),
  row({ id: 'power.tortoise', bus: 'Power', heard: 'all', plays: [0, 1], levelDb: 0, prio: 4, variation: 2, maxLenMs: 450, short: 'first hit', env: 'src' }),
  row({ id: 'power.jellyfish', bus: 'Power', heard: 'all', plays: [0, 1], levelDb: 0, prio: 4, variation: 2, maxLenMs: 700, short: 'first hit', env: 'src', cls: 'S' }),
  row({ id: 'power.stickleback', bus: 'Power', heard: 'all', plays: [0, 1], levelDb: 0, prio: 4, variation: 2, maxLenMs: 280, short: 'first hit', env: 'src' }),
  row({ id: 'power.stickleback.miss', bus: 'Power', heard: 'all', plays: [0, 1], levelDb: 0, prio: 4, variation: 2, maxLenMs: 180, short: 'first hit', env: 'src' }),
  row({ id: 'power.whale', bus: 'Power', heard: 'all', plays: [0, 1], levelDb: 1, prio: 4, variation: 1, maxLenMs: 1400, short: '400 ms', env: 'src', cls: 'S' }),
  row({ id: 'power.clownfish.bound', bus: 'Power', heard: 'private', plays: [0, 1], levelDb: -4, prio: 3, variation: 1, maxLenMs: 600, short: 'peg' }),

  // world and meta
  // 0-6 a game, stalls only (Appendix D): a stall is a state, not a play count, so §3.7's bands do not apply
  row({ id: 'amb.gate', bus: 'Ambience', heard: 'all', plays: null, levelDb: -20, prio: 1, cooldownMs: 200, variation: 'live', maxLenMs: 400 }),
  row({ id: 'meta.join', bus: 'Table', heard: 'all', plays: null, levelDb: -4, prio: 2, cooldownMs: 200, variation: 'live', maxLenMs: 200, short: 'same', seat: true }),
  row({ id: 'meta.leave', bus: 'Table', heard: 'all', plays: null, levelDb: -4, prio: 2, cooldownMs: 200, variation: 'live', maxLenMs: 200, short: 'same', seat: true }),
  row({ id: 'meta.reconnected', bus: 'UI', heard: 'you', plays: null, levelDb: -4, prio: 2, cooldownMs: 200, variation: 'live', maxLenMs: 200, short: 'same' }),
  row({ id: 'meta.nudge', bus: 'Table', heard: 'you', plays: null, levelDb: -4, prio: 2, cooldownMs: 200, variation: 'live', maxLenMs: 200, short: 'same', seat: true }),
];

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
export const ECHO_EXEMPT: ReadonlySet<string> = new Set(['mus.start', 'mus.lastset', 'mus.end.win', 'mus.end.tie', 'mus.end.lose']);

/** Squid has no cue and no motif: any request naming it is silence. */
export const SILENT_RANKS: ReadonlySet<string> = new Set(['squid']);
