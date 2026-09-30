/* cues.ts - PURE: (PublicRecord, SeatFacts) -> CueRequest[]. The one mapping layer from game events to sound, and the
 * leak-tested function (FEEL_VISUAL_SOUND_PLAN §6.5, SOUND_DESIGN §2-§4).
 *
 * Law 1 (§3.2): every client's sound is a function of only (a) the public record, with the rules' own tells erased;
 * (b) public facts about the viewer's own seat (your turn, you were asked). There is no private tier: nothing is
 * audible to one client that the others cannot hear.
 *
 * The input is PROJECTED before anything is decided: `soundInputOf` copies exactly the fields SOUND_DESIGN §3 lists
 * (`SOUND_FIELDS`) into a fresh object and nothing else exists after it. The mapping below cannot read a hand, a
 * card id, a grant, a rank of a concealed set, an eligibility flag, a window's context beyond the two players named
 * aloud, or the room's `seq` - those fields are not on the object it is given. The tests hand the raw record to a
 * Proxy that fails on any read outside the list.
 *
 * What is never voiced (the rules' own tells): a structural window opening, closing or timing out (TURN_START,
 * REQUEST_DECLARED, TRANSFER_PENDING, SET_COMPLETED, TURN_END), and Squid in any form - it has no event, no cue id
 * and no motif. The answer window has no open cue (the ask's landing is the opening); its close, `clock.close`,
 * fires when RESPONSE_PENDING leaves the view, whatever replaces it.
 */

import { cueDef, durationOf } from './cuesheet.js';
import type { CueParams } from './recipes.js';
import { chainPitch, humanize } from './variation.js';
import { mix } from './util.js';

/* ------------------------------------------------------------------ inputs (what the wire carries) */

export type PowerMode = 'ascuns' | 'deschis';

/** The window in the public view. Only its type and the two players named aloud matter here. */
export interface PublicWindow {
  type: string;
  askerId?: string;
  targetId?: string;
  /** server ms; used by the window clock, never by the cues */
  deadlineAt?: number;
}

/** What a spectator holding no cards could see of one moment of the table. */
export interface PublicView {
  /** seat order: the turn order */
  players: readonly string[];
  currentPlayerId?: string | null;
  poolCount: number;
  window?: PublicWindow | null;
  /** the public tally of sets still possible (§3.9) */
  setsPossible?: number | null;
  /** the stall gate: consecutive asks that captured and drew nothing, and the 2N limit */
  endPressure?: { misses: number; limit: number } | null;
  /** the laid sets: public facts only (owner, category, the rank once it is public, how many cards). Only the
   * choreography reads them - never the cues. */
  laidSets?: readonly PublicLaidSet[];
  /** every seat's hand size: public (the chips show it) */
  handSizes?: Readonly<Record<string, number>>;
  /** the game is over */
  ended?: boolean;
  /** every seat's score: public (the chips show it); the podium counts them up (§5.7) */
  scores?: Readonly<Record<string, number>>;
}

/** what any spectator can see of a laid set */
export interface PublicLaidSet {
  id: string;
  ownerId: string;
  isPowerSet: boolean;
  /** null while concealed */
  rank: string | null;
  cardCount: number;
  spent: boolean;
  destroyed: boolean;
}

/** The redacted event stream as the wire carries it. Sound reads only the fields `SOUND_FIELDS` lists. */
export type PublicEvent =
  | { type: 'GAME_STARTED' }
  | { type: 'TURN_STARTED'; playerId: string }
  | { type: 'TURN_SKIPPED_STUNNED'; playerId: string }
  | { type: 'BONUS_TURN'; playerId: string }
  | { type: 'HAND_REFILLED'; playerId: string; count: number }
  | { type: 'REQUEST_MADE'; askerId: string; targetId: string; rank?: string }
  | { type: 'REQUEST_SUCCEEDED'; askerId: string; targetId: string; count: number; rank?: string }
  | { type: 'REQUEST_FAILED'; askerId: string; targetId: string; rank?: string }
  | { type: 'DREW_FROM_POOL'; playerId: string; poolEmpty?: boolean }
  | { type: 'SET_LAID'; playerId: string; isPowerSet: boolean; setId?: string; rank?: string | null; eggCount?: number }
  | { type: 'SET_DESTROYED'; byPlayerId?: string; ownerId?: string; setId?: string }
  | { type: 'POWER_GRANTED'; playerId: string; grantId?: string; rank?: string | null; sourceSetId?: string; unbound?: boolean }
  | { type: 'POWER_USED'; playerId: string; rank: string }
  | { type: 'CLOWNFISH_BOUND'; playerId: string; boundRank?: string }
  | { type: 'SHARK_JUMP'; playerId: string; loserId?: string; fromId?: string; count?: number; rank?: string }
  | { type: 'LANTERNFISH_REFLECT'; playerId: string; fromId: string; count?: number; rank?: string }
  | { type: 'TORTOISE_BLOCK'; playerId: string; rank?: string }
  | { type: 'JELLYFISH_STUN'; playerId: string; targetId: string }
  | { type: 'STICKLEBACK_STEAL'; playerId: string; targetId: string; count?: number; rank?: string }
  | { type: 'STICKLEBACK_WASTED'; playerId: string; targetId: string; rank?: string }
  | { type: 'WHALE_SHUFFLE'; playerId: string; targetAId?: string; targetBId?: string }
  | { type: 'GAME_ENDED'; winners: readonly string[]; reason?: string }
  // never voiced: the rules' own tells
  | { type: 'WINDOW_OPENED' }
  | { type: 'WINDOW_CLOSED' };

/** One presentation step, in `seq` order. */
export interface PublicRecord {
  seq: number;
  mode: PowerMode;
  before: PublicView | null;
  after: PublicView;
  events: readonly PublicEvent[];
  /** consecutive bonus turns by the same player, counting this step's (0 after any change of player). Derived from
   * the public events only; kept by the presenter (`chainAfter`). */
  chain?: number;
  /** how many cues this client has been handed before this step. It seeds the variation: a count of PUBLIC voiced cues, so it
   * is the same for everyone who has watched the same public record, and it does not move when a silent structural
   * window splits a step in two. Never the room's `seq`, which counts events a client may not receive. */
  ordinal?: number;
}

/** Facts about the viewer. Only `playerId` and `closePlayedLocally` steer the cues; the rest is for haptics. */
export interface SeatFacts {
  playerId: string;
  /** headphones profile (an output setting: it changes the EQ, never what is played) */
  headphones: boolean;
  /** this device already played `clock.close` at the answering press (§3.2) */
  closePlayedLocally?: boolean;
  /** haptics only (an Android buzz that is opt-in): the server says you are eligible in the window that is open / was open */
  eligible?: boolean;
  eligibleBefore?: boolean;
  /** haptics only */
  grantRank?: (grantId: string) => string | undefined;
}

/* ----------------------------------------------------------------- outputs */

export interface CueRequest {
  id: string;
  /** ms from the moment the step is presented, including the cue's humanised lag */
  at: number;
  /** the seed of the hit: derived from the PUBLIC record, so renders reproduce and two clients agree */
  seed: number;
  /** how long the cue lasts, ms: static, from its definition and public parameters (`durationOf`) */
  durMs: number;
  params?: CueParams;
}

/** §4.1 beat times, ms from the answer (or the step). The choreography may retime them. */
export const BEAT = {
  askLands: 320, // the arrow-chip lands on the target's post
  askCue: 250, // the cue starts so its landing knock coincides with the chip landing
  askedRoll: 340, // the target's plank rises
  flight: 100, // backs fly target -> asker
  give: 450, // and land
  bonus: 620, // the totem settles back on the asker
  gofish: 300, // the chip dives / drops
  draw: 600, // a card rises and flies to the asker
  turn: 760, // the totem lands on the next seat
  gate: 300,
  gateOpen: 200,
  /** the set's eggs tick after the last pressing of the lay */
  eggs: 470,
  /** the first chisel tick of a rim notch counting down, and the gap between ticks when a lay takes several */
  notch: 300,
  notchGap: 70,
  /** the darkening knock follows the last tick */
  darkAfterNotch: 80,
  effect: 450, // a power's effect, under its reveal (Ascuns)
  effectOpen: 300, // Mode Deschis: no reveal, but the actor still gathers itself before the strike
  /** the windup's riser ends exactly on the strike */
  windup: 250,
  /** the score race's moment, after the lay's stamp (TIME.lead in the choreography); haptics only now */
  lead: 440,
  /** the last set's beat in the choreography (its ink, its hit-stop); the light's knock is placed by the notch */
  lastSet: 600,
  start: 2400, // the first turn after the call to the table
  /** when several seats stop the totem in one step (a stunned skip, a pass), each stop waits for the last one's cue */
  turnGap: 420,
  /** the beat the podium is shown after the last one: the last lay's stamp, one held beat, the gate doors */
  podium: 500,
  /** the podium's pips count up: the first pip this long after the podium shows, then one every `tallyStep` (`table.tally` per pip) */
  tallyStart: 900,
  tallyStep: 110,
} as const;

/** The tally of sets still possible at which the light, and the ambience with it, steps one flat step darker (§3.9). */
export const DARK_AT: readonly [number, number, number] = [12, 6, 1];
/** which darkening step the tally is in: 0 (dusk), 1, 2 or 3 (the last set) */
export const darkStepOf = (possible: number | null | undefined): 0 | 1 | 2 | 3 =>
  possible === null || possible === undefined ? 0 : possible <= DARK_AT[2] ? 3 : possible <= DARK_AT[1] ? 2 : possible <= DARK_AT[0] ? 1 : 0;
const DARK_ID = ['world.dark.12', 'world.dark.06', 'world.dark.01'] as const;

/* --------------------------------------------------- the projection: the only thing the mapping reads */

/**
 * The exact list of what sound may read (SOUND_DESIGN §3), by object. `soundInputOf` is the only code that touches the
 * raw record, and it touches only these; the Proxy test in test/soundfields.test.ts fails on anything else.
 */
export const SOUND_FIELDS = {
  record: ['mode', 'before', 'after', 'events', 'chain', 'ordinal'],
  view: ['players', 'poolCount', 'window', 'setsPossible', 'endPressure', 'scores'],
  window: ['type', 'askerId', 'targetId'],
  endPressure: ['misses', 'limit'],
  facts: ['playerId', 'closePlayedLocally'],
  events: {
    GAME_STARTED: [],
    TURN_STARTED: ['playerId'],
    TURN_SKIPPED_STUNNED: ['playerId'],
    BONUS_TURN: ['playerId'],
    HAND_REFILLED: ['count'],
    REQUEST_MADE: ['targetId'],
    REQUEST_SUCCEEDED: ['count'],
    REQUEST_FAILED: [],
    DREW_FROM_POOL: ['poolEmpty'],
    SET_LAID: ['isPowerSet', 'eggCount'],
    SET_DESTROYED: [],
    POWER_GRANTED: [],
    POWER_USED: [],
    CLOWNFISH_BOUND: [],
    SHARK_JUMP: [],
    LANTERNFISH_REFLECT: ['playerId', 'fromId'],
    TORTOISE_BLOCK: [],
    JELLYFISH_STUN: [],
    STICKLEBACK_STEAL: [],
    STICKLEBACK_WASTED: [],
    WHALE_SHUFFLE: [],
    GAME_ENDED: [],
  },
} as const;

interface SoundView {
  poolCount: number;
  setsPossible: number | null;
  misses: number;
  limit: number;
  /** the answer window, if one is open: the two players named aloud */
  answer: { askerId?: string; targetId?: string } | null;
  /** the highest score: the number of pips the podium counts up */
  scoreTop: number;
}

type SoundEvent =
  | { type: 'TURN_STARTED' | 'TURN_SKIPPED_STUNNED' | 'BONUS_TURN'; playerId: string }
  | { type: 'HAND_REFILLED' | 'REQUEST_SUCCEEDED'; count: number }
  | { type: 'REQUEST_MADE'; targetId: string }
  | { type: 'DREW_FROM_POOL'; poolEmpty: boolean }
  | { type: 'SET_LAID'; isPowerSet: boolean; eggCount: number }
  | { type: 'LANTERNFISH_REFLECT'; playerId: string; fromId: string }
  | { type: 'GAME_STARTED' | 'REQUEST_FAILED' | 'SET_DESTROYED' | 'POWER_GRANTED' | 'POWER_USED' | 'CLOWNFISH_BOUND' | 'SHARK_JUMP' | 'TORTOISE_BLOCK' | 'JELLYFISH_STUN' | 'STICKLEBACK_STEAL' | 'STICKLEBACK_WASTED' | 'WHALE_SHUFFLE' | 'GAME_ENDED' };

export interface SoundInput {
  me: string;
  closePlayedLocally: boolean;
  mode: PowerMode;
  players: readonly string[];
  before: SoundView | null;
  after: SoundView;
  events: SoundEvent[];
  chain: number;
  /** the count of cues this client has been handed before this step: what seeds the variation. NOT the room's `seq`. */
  ordinal: number;
}

function viewOf(v: PublicView): SoundView {
  const w = v.window;
  const answer = w && w.type === 'RESPONSE_PENDING' ? { askerId: w.askerId, targetId: w.targetId } : null;
  const scores = v.scores ? Object.values(v.scores) : [];
  return {
    poolCount: v.poolCount,
    setsPossible: v.setsPossible ?? null,
    misses: v.endPressure?.misses ?? 0,
    limit: v.endPressure?.limit ?? 0,
    answer,
    scoreTop: scores.length ? Math.max(...scores) : 0,
  };
}

function eventOf(e: PublicEvent): SoundEvent | null {
  switch (e.type) {
    case 'TURN_STARTED': case 'TURN_SKIPPED_STUNNED': case 'BONUS_TURN': return { type: e.type, playerId: e.playerId };
    case 'HAND_REFILLED': case 'REQUEST_SUCCEEDED': return { type: e.type, count: e.count };
    case 'REQUEST_MADE': return { type: e.type, targetId: e.targetId };
    case 'DREW_FROM_POOL': return { type: e.type, poolEmpty: !!e.poolEmpty };
    case 'SET_LAID': return { type: e.type, isPowerSet: !!e.isPowerSet, eggCount: Math.max(0, Math.min(4, e.eggCount ?? 0)) };
    case 'LANTERNFISH_REFLECT': return { type: e.type, playerId: e.playerId, fromId: e.fromId };
    case 'GAME_STARTED': case 'REQUEST_FAILED': case 'SET_DESTROYED': case 'POWER_GRANTED': case 'POWER_USED': case 'CLOWNFISH_BOUND':
    case 'SHARK_JUMP': case 'TORTOISE_BLOCK': case 'JELLYFISH_STUN': case 'STICKLEBACK_STEAL': case 'STICKLEBACK_WASTED': case 'WHALE_SHUFFLE': case 'GAME_ENDED':
      return { type: e.type };
    default:
      return null; // WINDOW_OPENED / WINDOW_CLOSED: the rules' own tells, never voiced
  }
}

/** The only reader of the raw record. Everything after it works on what it returns. */
export function soundInputOf(record: PublicRecord, facts: SeatFacts): SoundInput {
  const after = viewOf(record.after);
  const before = record.before ? viewOf(record.before) : null;
  const events: SoundEvent[] = [];
  for (const e of record.events) {
    const s = eventOf(e);
    if (s) events.push(s);
  }
  return {
    me: facts.playerId,
    closePlayedLocally: !!facts.closePlayedLocally,
    mode: record.mode,
    players: record.after.players,
    before,
    after,
    events,
    chain: Math.max(0, record.chain ?? 0),
    ordinal: Math.max(0, record.ordinal ?? 0),
  };
}

/** The chain of bonus turns after a step: +1 per `BONUS_TURN`, back to 0 when the totem moves to someone else. */
export function chainAfter(prev: number, events: readonly PublicEvent[]): number {
  const bonus = new Set(events.filter((e) => e.type === 'BONUS_TURN').map((e) => (e as { playerId: string }).playerId));
  let n = prev;
  for (const e of events) {
    if (e.type === 'BONUS_TURN') n += 1;
    else if (e.type === 'TURN_STARTED' && !bonus.has(e.playerId)) n = 0;
  }
  return n;
}

/* --------------------------------------------------------------- the function */

const seatIn = (players: readonly string[], id: string | undefined): number => {
  const i = id === undefined ? -1 : players.indexOf(id);
  return i < 0 ? 0 : i;
};
const sameAnswer = (a: NonNullable<SoundView['answer']>, b: NonNullable<SoundView['answer']>): boolean => a.askerId === b.askerId && a.targetId === b.targetId;

/** the frame-breakers' strike: Deschis has no reveal, so the actor gathers itself sooner */
const strikeAt = (mode: PowerMode, powered: boolean): number => (powered && mode !== 'ascuns' ? BEAT.effectOpen : BEAT.effect);
/** the cues whose pitch rises along a chain of bonus turns */
const CHAINED = new Set(['table.turn', 'table.turn.you', 'table.bonus']);

export function cuesFor(record: PublicRecord, facts: SeatFacts): CueRequest[] {
  const inp = soundInputOf(record, facts);
  const { before, after, events, mode, me, players } = inp;
  const seat = (id: string | undefined) => seatIn(players, id);
  const out: CueRequest[] = [];
  let n = 0;
  /** places a cue: its take, pitch, gain and lag come from the step's public seed; its duration from its definition */
  const add = (id: string, at: number, params?: CueParams) => {
    const def = cueDef(id);
    if (!def) return;
    // the seed is the cue's own place in the game's run of cues, so a silent window that splits a step in two moves nothing
    const seed = mix(inp.ordinal + n++, 0x51ed);
    const h = humanize(seed, def.variation, def.feel);
    const pitch = h.pitch * (CHAINED.has(id) ? chainPitch(inp.chain) : 1);
    const p: CueParams = { ...params, take: h.take, pitch, gainDb: h.gainDb };
    out.push({ id, at: Math.max(0, at + h.lagMs), seed, durMs: durationOf(id, p), params: p });
  };

  const has = (t: SoundEvent['type']) => events.some((e) => e.type === t);
  const started = has('GAME_STARTED');
  const wetNow = Math.min(1, 0.3 + after.poolCount / 20);

  /* ---- view diffs: the answer window (§3.2, §3.10) ---- */
  const wasAnswer = before?.answer ?? null;
  const isAnswerNow = after.answer;
  // it "closes" when RESPONSE_PENDING leaves the view, whatever replaces it (an answer, a timeout, a server skip)
  if (wasAnswer && (!isAnswerNow || !sameAnswer(wasAnswer, isAnswerNow)) && !inp.closePlayedLocally) add('clock.close', 0);
  // the ask's landing is the opening: no cue for the table; the asked seat gets its roll
  if (isAnswerNow && (!wasAnswer || !sameAnswer(wasAnswer, isAnswerNow)) && isAnswerNow.targetId === me) add('table.asked', BEAT.askedRoll);

  /* ---- the stall gate (public counts) ---- */
  const pressureBefore = before?.misses ?? 0;
  const pressureNow = after.misses;
  if (after.limit > 0 && pressureNow > pressureBefore && pressureNow >= Math.ceil(after.limit / 2)) add('amb.gate', BEAT.gate, { open: false });
  if (pressureBefore > 0 && pressureNow === 0) add('amb.gate', BEAT.gateOpen, { open: true });

  /* ---- events (they label the diff; structural windows are simply not in this list) ---- */
  const bonusFor = new Set(events.filter((e) => e.type === 'BONUS_TURN').map((e) => (e as { playerId: string }).playerId));
  // a power is used: every effect lands on one strike. The frame-breakers gather themselves into it and shake the table.
  const strike = strikeAt(mode, has('POWER_USED'));
  const breaker = (id: string, weight: number) => {
    add('power.windup', strike - BEAT.windup);
    add(id, strike);
    add('table.impact', strike, { weight });
  };
  let turnSlot = 0;
  for (const e of events) {
    switch (e.type) {
      case 'GAME_STARTED':
        add('mus.start', 0);
        break;
      case 'TURN_STARTED': {
        if (bonusFor.has(e.playerId)) break; // the asker keeps the turn: `table.bonus` says so
        const when = (started ? BEAT.start : BEAT.turn) + BEAT.turnGap * turnSlot++;
        if (e.playerId === me) add('table.turn.you', when, { seat: seat(e.playerId) });
        else add('table.turn', when, { seat: seat(e.playerId) });
        break;
      }
      case 'BONUS_TURN':
        add('table.bonus', BEAT.bonus, { seat: seat(e.playerId) });
        break;
      case 'TURN_SKIPPED_STUNNED':
        add('table.skipped', (started ? BEAT.start : BEAT.turn) + BEAT.turnGap * turnSlot++, { seat: seat(e.playerId) });
        break;
      case 'HAND_REFILLED':
        if (!started) add('table.refill', 0, { count: Math.min(4, e.count) });
        break;
      case 'REQUEST_MADE':
        add('table.ask', BEAT.askCue, { seat: seat(e.targetId) });
        break;
      case 'REQUEST_SUCCEEDED':
        add('table.flight', BEAT.flight);
        add('table.give', BEAT.give, { count: e.count });
        break;
      case 'REQUEST_FAILED': {
        // wet or dry is the public pool: the pool before the draw. A Squid deny, a Squid claim and an honest no are the same
        // event, so they are the same sound.
        const wet = before ? before.poolCount > 0 : has('DREW_FROM_POOL');
        if (wet) add('table.gofish', BEAT.gofish, { wet: wetNow });
        else add('table.gofish.dry', BEAT.gofish);
        break;
      }
      case 'DREW_FROM_POOL':
        // whatever the card is: the cue reads the pool, never the card
        if (e.poolEmpty) add('table.poolEmpty', BEAT.draw);
        else add('table.draw', BEAT.draw, { wet: wetNow });
        break;
      case 'SET_LAID':
        // hidden or open is the mode and the category - public - never the rank
        add(!e.isPowerSet ? 'table.lay' : mode === 'ascuns' ? 'table.lay.hidden' : 'table.lay.power', 0);
        if (e.eggCount > 0) add('table.egg', BEAT.eggs, { count: e.eggCount });
        break;
      case 'SET_DESTROYED':
        breaker('power.mantis', 1);
        break;
      case 'POWER_GRANTED':
        // the same cue for every rank in both modes: the rank is not an input
        add('power.granted', 0);
        break;
      case 'POWER_USED':
        // Ascuns: the face-down set flips. There is no Squid event, so nothing here can be Squid.
        if (mode === 'ascuns') add('power.reveal', 0);
        break;
      case 'CLOWNFISH_BOUND':
        // public in Deschis; in Ascuns the event reaches only its owner, so no client says anything
        if (mode === 'deschis') add('power.clownfish.bound', 0);
        break;
      case 'SHARK_JUMP':
        breaker('power.shark', 0.8);
        break;
      case 'LANTERNFISH_REFLECT':
        add('power.lanternfish', strike, { seat: seat(e.fromId), seat2: seat(e.playerId) });
        break;
      case 'TORTOISE_BLOCK':
        add('power.tortoise', strike);
        break;
      case 'JELLYFISH_STUN':
        add('power.jellyfish', strike);
        break;
      case 'STICKLEBACK_STEAL':
        add('power.stickleback', strike);
        break;
      case 'STICKLEBACK_WASTED':
        add('power.stickleback.miss', strike);
        break;
      case 'WHALE_SHUFFLE':
        breaker('power.whale', 1);
        break;
      case 'GAME_ENDED': {
        // the pips count up, one `table.tally` per pip, unpitched: the same for everyone (the scores are public);
        // `at` is from the podium showing (the choreography places it)
        const top = Math.min(18, Math.max(0, after.scoreTop));
        for (let k = 0; k < top; k++) add('table.tally', BEAT.tallyStart + k * BEAT.tallyStep, { pip: k });
        add('mus.podium', 0);
        break;
      }
      default:
        break;
    }
  }

  // the rim: a chisel tick for each notch that counts down, then the light steps darker at 12, 6 and 1 (public: the tally)
  if (before && before.setsPossible !== null && after.setsPossible !== null) {
    const took = Math.min(3, Math.max(0, before.setsPossible - after.setsPossible));
    for (let k = 0; k < took; k++) add('world.notch', BEAT.notch + k * BEAT.notchGap);
    const from = darkStepOf(before.setsPossible);
    const to = darkStepOf(after.setsPossible);
    for (let s = from + 1; s <= to; s++) add(DARK_ID[s - 1], BEAT.notch + BEAT.notchGap * Math.max(0, took - 1) + BEAT.darkAfterNotch + (s - from - 1) * 260, { step: s });
  }

  return out.sort((a, b) => a.at - b.at);
}

/** The score race's moment in one step, if there is one: the same rule the choreography draws (leadOf/leadTier
 * there; kept here as plain arithmetic so cues.ts stays free of the choreography). */
export function raceOf(record: PublicRecord): 'lead' | 'tie' | 'breakaway' | 'chase' | 'clinch' | null {
  const { before, after, events } = record;
  if (!before?.scores || !after.scores || events.some((e) => e.type === 'GAME_ENDED')) return null;
  const lays = events.filter((e) => e.type === 'SET_LAID') as Array<{ playerId: string }>;
  if (!lays.length) return null;
  const order = after.players;
  const lead = (sc: Readonly<Record<string, number>>, possible: number | null | undefined) => {
    const top = Math.max(0, ...order.map((p) => sc[p] ?? 0));
    const leaders = top > 0 ? order.filter((p) => (sc[p] ?? 0) === top) : [];
    const margin = leaders.length === 1 ? top - Math.max(0, ...order.filter((p) => p !== leaders[0]).map((p) => sc[p] ?? 0)) : 0;
    const tier = leaders.length !== 1 ? 0 : possible != null && margin > possible ? 9 : Math.min(3, margin);
    return { leaders, margin, tier };
  };
  const top = (sc: Readonly<Record<string, number>>) => Math.max(0, ...order.map((p) => sc[p] ?? 0));
  const a = lead(before.scores, before.setsPossible);
  const b = lead(after.scores, after.setsPossible);
  const scorer = lays[lays.length - 1].playerId;
  const x = b.leaders.length === 1 ? b.leaders[0] : null;
  const was = a.leaders.length === 1 ? a.leaders[0] : null;
  if (x && b.tier === 9 && !(was === x && a.tier === 9)) return 'clinch';
  if (x && x !== was) return 'lead';
  if (!x && b.leaders.length > 1 && top(after.scores) >= 2 && was && b.leaders.includes(scorer) && scorer !== was) return 'tie';
  if (x && x === was && b.tier !== 9 && a.tier !== 9 && b.tier > a.tier && b.tier >= 2) return 'breakaway';
  if (x && x === was && scorer !== x && a.margin >= 2 && b.margin === 1) return 'chase';
  return null;
}

/** The answering device's own close, at the press (§3.2): the same cue, earlier. The device then
 * marks `closePlayedLocally` so `cuesFor` does not play it a second time when the window leaves the
 * view. */
export function localAnswerCue(seq: number): CueRequest {
  const seed = mix(seq, 0x0c105e);
  const h = humanize(seed, cueDef('clock.close')!.variation, 'exact');
  const params: CueParams = { take: h.take, pitch: h.pitch, gainDb: h.gainDb };
  return { id: 'clock.close', at: 0, seed, durMs: durationOf('clock.close'), params };
}

/** The window clock's target: the answer window's deadline, or null. Structural windows never tick (§3.10). */
export function clockTarget(view: PublicView | null | undefined): { key: string; deadlineAt: number } | null {
  const w = view?.window;
  if (!w || w.type !== 'RESPONSE_PENDING' || typeof w.deadlineAt !== 'number') return null;
  return { key: `${w.askerId ?? ''}>${w.targetId ?? ''}@${w.deadlineAt}`, deadlineAt: w.deadlineAt };
}

/** Local cues that are not driven by the record (lobby, reconnect, idle nudge). */
export function metaCue(kind: 'join' | 'leave' | 'reconnected' | 'nudge', seat: number, seq: number): CueRequest {
  const id = kind === 'join' ? 'meta.join' : kind === 'leave' ? 'meta.leave' : kind === 'reconnected' ? 'meta.reconnected' : 'meta.nudge';
  const seed = mix(seq, 0x3e7a);
  const h = humanize(seed, cueDef(id)!.variation, 'exact');
  const params: CueParams = { seat, take: h.take, pitch: h.pitch, gainDb: h.gainDb };
  return { id, at: 0, seed, durMs: durationOf(id), params };
}

/**
 * The sound column of the event table as data: what is audible for each signal. Exported so the tests (and the lab)
 * can walk it. There is one column: no signal sounds different to a client because of what only that client knows.
 */
export const SOUND_COLUMN: ReadonlyArray<{ signal: string; sound: string }> = [
  { signal: 'GAME_STARTED', sound: 'mus.start (the tulnic, then the valley\'s three darker repeats)' },
  { signal: 'TURN_STARTED', sound: 'table.turn (the seat) / table.turn.you' },
  { signal: 'BONUS_TURN', sound: 'table.bonus, the totem rises a little along the chain' },
  { signal: 'TURN_SKIPPED_STUNNED', sound: 'table.skipped' },
  { signal: 'HAND_REFILLED', sound: 'table.refill' },
  { signal: 'REQUEST_MADE', sound: 'table.ask (the target\'s seat), on the beat' },
  { signal: 'the answer window opens', sound: 'none for the table; table.asked for the target' },
  { signal: 'the answer window leaves the view (answer, timeout or server skip)', sound: 'clock.close on every client (at the press on the answering one)' },
  { signal: 'a structural window opens, closes or times out', sound: 'none, for every client' },
  { signal: 'REQUEST_SUCCEEDED', sound: 'table.flight, table.give (a little late)' },
  { signal: 'REQUEST_FAILED, pool > 0', sound: 'table.gofish (a little late)' },
  { signal: 'REQUEST_FAILED, pool empty', sound: 'table.gofish.dry (a little late)' },
  { signal: 'DREW_FROM_POOL', sound: 'table.draw / table.poolEmpty (the pond turns to wind)' },
  { signal: 'SET_LAID, face up', sound: 'table.lay / table.lay.power (+ table.egg per egg)' },
  { signal: 'SET_LAID, power set in Mode Ascuns', sound: 'table.lay.hidden (+ table.egg per egg)' },
  { signal: 'SET_DESTROYED', sound: 'power.windup, power.mantis, table.impact' },
  { signal: 'POWER_GRANTED', sound: 'power.granted (uniform: every rank, both modes)' },
  { signal: 'POWER_USED, Mode Ascuns', sound: 'power.reveal, then the effect cue' },
  { signal: 'POWER_USED, Mode Deschis', sound: 'the effect cue' },
  { signal: 'CLOWNFISH_BOUND', sound: 'Deschis: power.clownfish.bound. Ascuns: nothing' },
  { signal: 'SHARK_JUMP / WHALE_SHUFFLE', sound: 'power.windup, power.shark / power.whale, table.impact' },
  { signal: 'LANTERNFISH_REFLECT / TORTOISE_BLOCK / JELLYFISH_STUN / STICKLEBACK_*', sound: 'power.lanternfish / tortoise / jellyfish / stickleback(.miss)' },
  { signal: 'the tally counts down', sound: 'world.notch, one chisel tick per notch' },
  { signal: 'the tally crosses 12 / 6 / 1', sound: 'world.dark.12 / .06 / .01 and the ambience one flat step darker (.01 adds the bare horn: the last set)' },
  { signal: 'the stall gate shuts / opens', sound: 'amb.gate' },
  { signal: 'GAME_ENDED', sound: 'mus.podium (everyone); table.tally, one unpitched tick per pip' },
  { signal: 'Squid, in any form', sound: 'silence' },
];
