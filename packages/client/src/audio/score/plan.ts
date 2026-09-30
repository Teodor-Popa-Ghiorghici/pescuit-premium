/* plan.ts - PURE. The score's schedule (MUSIC_PLAN §4, §5.2): which state the score is in, and which far horn calls when.
 *
 * One clock: server milliseconds. Candidate slots fall every 18-42 s from the score clock's zero (seeded, uniform); the
 * state of slot i is decided on the latest broadcast whose `serverNow` is at least 2 s before it, and everything else about
 * the slot (is it active, which phrase, which take, is it answered, does the speaker arrangement play it) is a pure
 * function of (seed, state, i). Nothing depends on another slot's outcome, so one client's mismatch cannot cascade.
 *
 * The score is a pure function of the public broadcasts and their `serverNow`. Two histories that carry the same public
 * values at the same server times give the same schedule; a history in which a structural window paused the table shifts
 * later changes in server time, and the schedule follows those public timestamps - the pause is already public.
 */

import { mix } from '../util.js';
import { bagOf, TAKES, type ScoreStage } from './phrases.js';
import type { ScoreInput, ScorePhase } from './input.js';
import { ACTIVITY, ANSWER_DELAY_S, BAG, CALL_MS, CEREMONY_HOLD_MS, DUSK_QUIET_MS, LOBBY_BUSY_MS, LOCK_MS, PAN, POST_AFTER_MS, type ScoreState } from './voicing.js';
import { LIGHT_AT } from '../../game/world.js';

/** one public broadcast, as the score keeps it */
export interface Snapshot {
  /** its serverNow */
  at: number;
  phase: ScorePhase;
  setsPossible: number | null;
  misses: number;
  limit: number;
}

export interface ScoreHistory {
  seed: number;
  /** the score clock's zero, server ms */
  zero: number;
  /** in server-time order */
  snapshots: readonly Snapshot[];
}

export const snapshotOf = (i: ScoreInput): Snapshot => ({ at: i.at, phase: i.phase, setsPossible: i.setsPossible, misses: i.misses, limit: i.limit });

/** murmur3's finaliser: util's `mix` is a fine seed but its last bits do not avalanche, which biases a threshold on it */
const fmix = (h: number): number => {
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
};
/** a uniform number in [0, 1) from the seed and a few integers */
export const u01 = (...parts: number[]): number => fmix(mix(...parts)) / 4294967296;

/** the stall gate is shut: the count has reached half the limit (cues.ts voices the same moment with `amb.gate`) */
export const gateShut = (s: Pick<Snapshot, 'misses' | 'limit'>): boolean => s.limit > 0 && s.misses >= Math.ceil(s.limit / 2);

/** the stage of the evening by the public tally (world.ts's stages) */
export function stageOf(possible: number | null): ScoreStage {
  if (possible === null) return 'dusk';
  if (possible <= LIGHT_AT.night) return 'night';
  if (possible <= LIGHT_AT.evening) return 'evening';
  return 'dusk';
}

/**
 * The state one broadcast puts the score in at server time `t`. Precedence (§4.1): finale > the last set > the gate > the
 * call > the stage. `endedAt` is the first broadcast of the ended game: the podium, then (POST_AFTER_MS later) the waiting
 * room's voicing.
 */
export function stateOf(s: Snapshot, zero: number, t: number, endedAt: number | null = null): ScoreState {
  if (s.phase === 'lobby') return 'lobby';
  if (s.phase === 'ended') return t >= (endedAt ?? s.at) + POST_AFTER_MS ? 'post' : 'finale';
  if (s.setsPossible !== null && s.setsPossible <= 0) return 'finale';
  if (s.setsPossible !== null && s.setsPossible <= LIGHT_AT.last) return 'last';
  if (gateShut(s)) return 'gate';
  if (t < zero + CALL_MS) return 'call';
  return stageOf(s.setsPossible);
}

/** the latest snapshot at or before server time `t` (they are in order); null if none */
export function snapshotAt(h: ScoreHistory, t: number): Snapshot | null {
  let found: Snapshot | null = null;
  for (const s of h.snapshots) {
    if (s.at <= t) found = s;
    else break;
  }
  return found;
}

export const endedAtOf = (h: ScoreHistory): number | null => h.snapshots.find((s) => s.phase === 'ended')?.at ?? null;

/** the state at server time `t` on the broadcasts sent up to `t - lockMs` (a slot uses the 2 s lock; the hum uses 0) */
export function stateAt(h: ScoreHistory, t: number, lockMs = 0): ScoreState | null {
  const s = snapshotAt(h, t - lockMs);
  return s ? stateOf(s, h.zero, t, endedAtOf(h)) : null;
}

/* ------------------------------------------------------------------ ceremonies: the horn never talks over the horn */

export interface Ceremony {
  /** server ms: the broadcast that carried it */
  from: number;
  /** server ms: when it has surely ended (its beat offset and length, with the choreography's slack) */
  to: number;
}

/** the Music-bus ceremonies of this history, by the broadcasts that carried them: the call to the table, the last set's
 *  note (`mus.home`) and the podium */
export function ceremoniesOf(h: ScoreHistory): Ceremony[] {
  const out: Ceremony[] = [];
  if (h.snapshots.some((s) => s.phase !== 'lobby')) out.push({ from: h.zero, to: h.zero + CALL_MS });
  const home = h.snapshots.find((s) => s.phase === 'game' && s.setsPossible !== null && s.setsPossible <= LIGHT_AT.last && s.setsPossible > 0);
  if (home) out.push({ from: home.at, to: home.at + 2_000 });
  const end = endedAtOf(h);
  if (end !== null) out.push({ from: end, to: end + 500 + 2_600 + 1_000 });
  return out;
}

/* ------------------------------------------------------------------ slots */

/** candidate slots fall every 18-42 s */
export const GAP_MS: readonly [number, number] = [18_000, 42_000];

/** the i-th gap, ms: seeded, uniform */
export const gapOf = (seed: number, i: number): number => GAP_MS[0] + (GAP_MS[1] - GAP_MS[0]) * u01(seed, i, 0x9a9);

/** slot times from the zero: T_0 = zero + gap_0, T_i = T_(i-1) + gap_i. Returns the slots with T in [from, to). */
export function slotTimes(seed: number, zero: number, from: number, to: number): Array<{ i: number; t: number }> {
  const out: Array<{ i: number; t: number }> = [];
  let t = zero;
  // at most ~80 hours of slots: a room left open longer than that has no score
  for (let i = 0; i < 10_000; i++) {
    t += gapOf(seed, i);
    if (t >= to) break;
    if (t >= from) out.push({ i, t });
  }
  return out;
}

/** a seeded permutation of 0..n-1, fixed for the game and the stage: a stage's bag is walked in this order, cyclically */
export function permutation(seed: number, tag: number, n: number): number[] {
  const p = Array.from({ length: n }, (_, k) => k);
  for (let k = n - 1; k > 0; k--) {
    const j = Math.floor(u01(seed, tag, k) * (k + 1));
    [p[k], p[j]] = [p[j], p[k]];
  }
  return p;
}

const STAGE_TAG: Record<ScoreStage, number> = { lobby: 1, dusk: 2, evening: 3, night: 4 };

export interface SlotAnswer {
  id: string;
  take: number;
  /** seconds after the call's last note begins */
  delayS: number;
  /** heard on the speaker arrangement too */
  speaker: boolean;
}

export interface Slot {
  i: number;
  /** server ms */
  t: number;
  state: ScoreState;
  active: boolean;
  phrase: string | null;
  take: number;
  /** the speaker arrangement plays this slot (the headphones one plays every active slot) */
  speaker: boolean;
  answer: SlotAnswer | null;
}

/**
 * Everything about slot `i` at `t` in `state`: a pure function of (seed, state, i) and the public ceremony times. The
 * phrase of global slot i in a stage is `perm(seed, stage)[i mod 10]`: one fixed walk per game and stage, so no phrase
 * recurs within ten consecutive slots, and a phrase that comes round again takes the next take.
 */
export function slotOf(seed: number, zero: number, i: number, t: number, state: ScoreState, ceremonies: readonly Ceremony[] = []): Slot {
  const idle: Slot = { i, t, state, active: false, phrase: null, take: 0, speaker: false, answer: null };
  const stage = BAG[state];
  if (!stage) return idle;
  const calls = bagOf(stage, 'call');
  if (!calls.length) return idle;
  if (state === 'dusk' && t < zero + CALL_MS + DUSK_QUIET_MS) return idle;
  if (ceremonies.some((c) => t >= c.from && t < c.to + CEREMONY_HOLD_MS)) return idle;
  const act = ACTIVITY[state];
  const p = state === 'lobby' && t - zero < LOBBY_BUSY_MS ? 1 : act.call;
  if (u01(seed, i, 0xac7) >= p) return idle;
  const tag = STAGE_TAG[stage];
  const n = calls.length;
  const phrase = calls[permutation(seed, tag, n)[i % n]].id;
  const take = (Math.floor(i / n) + Math.floor(u01(seed, tag, 0x7a6e) * TAKES.length)) % TAKES.length;
  const speaker = u01(seed, i, 0x5b6) < 0.5;
  let answer: SlotAnswer | null = null;
  const answers = bagOf(stage, 'answer');
  if (answers.length && act.answer > 0 && u01(seed, i, 0xa25) < act.answer) {
    const m = answers.length;
    answer = {
      id: answers[permutation(seed, tag + 16, m)[i % m]].id,
      take: (Math.floor(i / m) + 1 + Math.floor(u01(seed, tag, 0x7a6f) * TAKES.length)) % TAKES.length,
      delayS: ANSWER_DELAY_S[0] + (ANSWER_DELAY_S[1] - ANSWER_DELAY_S[0]) * u01(seed, i, 0xde1),
      speaker: act.speakerAnswers,
    };
  }
  return { i, t, state, active: true, phrase, take, speaker, answer };
}

/** the slots with T in [from, to), each decided on the 2 s lock (§5.2) */
export function planSlots(h: ScoreHistory, from: number, to: number): Slot[] {
  const ceremonies = ceremoniesOf(h);
  return slotTimes(h.seed, h.zero, from, to).map(({ i, t }) => {
    const state = stateAt(h, t, LOCK_MS);
    return state ? slotOf(h.seed, h.zero, i, t, state, ceremonies) : { i, t, state: 'call' as ScoreState, active: false, phrase: null, take: 0, speaker: false, answer: null };
  });
}

/** the two horns' places in headphones, seeded per game: the near one on one side, the far one on the other */
export function pansOf(seed: number): { near: number; far: number } {
  const s = u01(seed, 0x9a4) < 0.5 ? 1 : -1;
  return { near: PAN.near * s, far: PAN.far * s };
}

/* ------------------------------------------------------------------ cuts: where a change of chord lands (§4.2) */

/** the cue whose transient carries each change of state, in order of preference */
const LAY = ['table.lay', 'table.lay.power', 'table.lay.hidden'];
const CAPTURE = ['table.give', ...LAY];
/**
 * A power's strike: the stall gate also shuts on a power (a Tortoise's block is a miss) and opens on one (a Shark, a Whale,
 * a Lanternfish capture). The strikes that do not duck the score come first; the frame-breakers' own cues last (a cut
 * under their duck is masked twice over).
 */
const STRIKES = ['power.lanternfish', 'power.tortoise', 'power.jellyfish', 'power.stickleback', 'power.stickleback.miss', 'table.impact', 'power.shark', 'power.whale', 'power.mantis'];
export function cutCuesFor(from: ScoreState, to: ScoreState): string[] {
  if (to === 'last') return ['world.dark.01'];
  if (to === 'night') return from === 'gate' ? ['world.dark.06', ...CAPTURE, ...STRIKES] : ['world.dark.06'];
  if (to === 'evening') return from === 'gate' ? ['world.dark.12', ...CAPTURE, ...STRIKES] : ['world.dark.12'];
  if (to === 'dusk') return [...CAPTURE, ...STRIKES];
  if (to === 'gate') return ['table.gofish.dry', 'table.gofish', ...STRIKES];
  if (to === 'finale') return [...LAY, 'table.gofish.dry', 'table.gofish', ...STRIKES];
  return [];
}

/**
 * Where, in one presentation step, the score's change from `from` to `to` lands: the named cue's time (ms from the step's
 * presentation), `named` false when the step carries none of them and the change falls back to the step's first cue (or 0).
 */
export function cutOf(from: ScoreState, to: ScoreState, cues: ReadonlyArray<{ id: string; at: number }>): { at: number; cue: string | null; named: boolean } {
  for (const id of cutCuesFor(from, to)) {
    const c = cues.find((x) => x.id === id);
    if (c) return { at: c.at, cue: id, named: true };
  }
  const first = [...cues].sort((a, b) => a.at - b.at)[0];
  return { at: first ? first.at : 0, cue: first ? first.id : null, named: false };
}
