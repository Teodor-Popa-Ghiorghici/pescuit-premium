/* cues.ts — PURE: (PublicRecord, SeatFacts) -> CueRequest[]. The leak-tested function (§6.5).
 *
 * Law 1 (§3.2): every client's sound is a function of only (a) the public record, with the
 * rules' own tells erased; (b) public facts about the viewer's own seat (your turn, you were
 * asked); (c) the viewer's inputs whose *possibility* was already public. Everything else is the
 * private tier: silent by default, audible only in headphones mode.
 *
 * The input types are local and structural so the UI can feed them from whatever the server's
 * redacted events and view turn out to be: a `PublicRecord` is one presentation step - the
 * events that arrived (they only *label* the diff) and the public view before and after it.
 * Nothing here reads a hand, a grant id's rank, an eligibility list or a window's context; the
 * tests hand it objects stuffed with such fields and check the answer does not move.
 *
 * What is never voiced (the rules' own tells): a structural window opening or closing (TURN_START,
 * REQUEST_DECLARED, TRANSFER_PENDING, SET_COMPLETED, TURN_END), and Squid in any form. The answer
 * window has no open cue - the ask's landing is the opening - and its close, `clock.close`, fires
 * when RESPONSE_PENDING leaves the view, whatever replaces it.
 */

import { RANK_TO_MOTIF, SILENT_RANKS, cueDef } from './cuesheet.js';
import type { CueParams } from './recipes.js';
import { mix } from './util.js';

/* ------------------------------------------------------------------ inputs */

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

/** The redacted event stream, keeping only the fields sound may read. */
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
  | { type: 'POWER_USED'; playerId: string; rank: string; viaClownfish?: boolean }
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
}

/** Facts about the viewer. Public ones (playerId) may steer sound; the private ones may only
 * steer the private tier, and only in headphones mode. */
export interface SeatFacts {
  playerId: string;
  /** headphones mode: unlocks the private tier */
  headphones: boolean;
  /** this device already played `clock.close` at the answering press (§3.2) */
  closePlayedLocally?: boolean;
  /** private: the server says you are eligible in the window that is open / was open */
  eligible?: boolean;
  eligibleBefore?: boolean;
  /** private: the rank of one of your own grants, by the grant id the event carried to you */
  grantRank?: (grantId: string) => string | undefined;
}

/* ----------------------------------------------------------------- outputs */

export interface CueRequest {
  id: string;
  /** ms from the moment the step is presented */
  at: number;
  /** the seed of the hit: derived from the step's seq, so renders reproduce */
  seed: number;
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
  lastSet: 600,
  effect: 450, // a power's effect, under its motif (Ascuns: after the reveal)
  effectOpen: 300, // Mode Deschis: no reveal, but the actor still gathers itself before the strike
  /** the windup's riser ends exactly on the strike */
  windup: 250,
  /** the score race's moment, after the lay's stamp (TIME.lead in the choreography) */
  lead: 440,
  start: 2400, // the first turn after the call to the table
  /** when several seats stop the totem in one step (a stunned skip, a pass), each stop waits for the last one's cue */
  turnGap: 420,
  /** the beat the podium is shown after the last one: the last lay's stamp, one held beat, the gate doors */
  podium: 500,
  /** the podium's pips count up: the first pip this long after the podium shows, then one every `tallyStep` (`table.tally` per pip) */
  tallyStart: 900,
  tallyStep: 110,
} as const;

/* --------------------------------------------------------------- the function */

const seatIn = (players: readonly string[], id: string | undefined): number => {
  const i = id === undefined ? -1 : players.indexOf(id);
  return i < 0 ? 0 : i;
};

const isAnswer = (w: PublicWindow | null | undefined): w is PublicWindow => !!w && w.type === 'RESPONSE_PENDING';
const sameAnswer = (a: PublicWindow, b: PublicWindow): boolean => a.askerId === b.askerId && a.targetId === b.targetId;

/** the short cue-id name of a public rank; undefined for Squid and anything unknown */
const motifName = (rank: string | null | undefined): string | undefined => (rank && !SILENT_RANKS.has(rank) ? RANK_TO_MOTIF[rank] : undefined);

export function cuesFor(record: PublicRecord, facts: SeatFacts): CueRequest[] {
  const { before, after, events, mode, seq } = record;
  const players = after.players.length ? after.players : before?.players ?? [];
  const seat = (id: string | undefined) => seatIn(players, id);
  const me = facts.playerId;
  const out: CueRequest[] = [];
  let n = 0;
  const add = (id: string, at: number, params?: CueParams) => {
    out.push({ id, at, seed: mix(seq, n++), ...(params ? { params } : {}) });
  };

  const has = (t: PublicEvent['type']) => events.some((e) => e.type === t);
  const started = has('GAME_STARTED');
  const wetNow = Math.min(1, 0.3 + after.poolCount / 20);

  /* ---- view diffs: the answer window (§3.2, §3.10) ---- */
  const wasAnswer = before?.window && isAnswer(before.window) ? before.window : null;
  const isAnswerNow = isAnswer(after.window) ? after.window : null;
  // it "closes" when RESPONSE_PENDING leaves the view, whatever replaces it
  if (wasAnswer && (!isAnswerNow || !sameAnswer(wasAnswer, isAnswerNow)) && !facts.closePlayedLocally) add('clock.close', 0);
  // the ask's landing is the opening: no cue for the table; the asked seat gets its roll
  if (isAnswerNow && (!wasAnswer || !sameAnswer(wasAnswer, isAnswerNow)) && isAnswerNow.targetId === me) add('table.asked', BEAT.askedRoll);
  // private tier: a plank appears where you are eligible (structural windows only)
  if (after.window && !isAnswer(after.window) && facts.eligible && !facts.eligibleBefore) add('clock.eligible', 0);

  /* ---- the stall gate and the last set (public counts) ---- */
  const pressureBefore = before?.endPressure?.misses ?? 0;
  const pressureNow = after.endPressure?.misses ?? 0;
  if (after.endPressure && pressureNow > pressureBefore && pressureNow >= Math.ceil(after.endPressure.limit / 2)) add('amb.gate', BEAT.gate, { open: false });
  if (pressureBefore > 0 && pressureNow === 0) add('amb.gate', BEAT.gateOpen, { open: true });

  /* ---- events (they label the diff; structural windows are simply not in this list) ---- */
  const bonusFor = new Set(events.filter((e) => e.type === 'BONUS_TURN').map((e) => (e as { playerId: string }).playerId));
  // the strike: every effect lands here, with the table-top impact under it
  const usedEv = events.find((e) => e.type === 'POWER_USED' && !!motifName(e.rank));
  const strike = usedEv && mode !== 'ascuns' ? BEAT.effectOpen : BEAT.effect;
  const impact = (weight: number) => add('table.impact', strike, { weight });
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
        // wet or dry is the public pool: the pool before the draw
        const wet = before ? before.poolCount > 0 : has('DREW_FROM_POOL');
        if (wet) add('table.gofish', BEAT.gofish, { wet: wetNow });
        else add('table.gofish.dry', BEAT.gofish);
        break;
      }
      case 'DREW_FROM_POOL':
        if (e.poolEmpty) add('table.poolEmpty', BEAT.draw);
        else add('table.draw', BEAT.draw, { wet: wetNow });
        break;
      case 'SET_LAID':
        add(e.isPowerSet ? 'table.lay.power' : 'table.lay', 0);
        break;
      case 'SET_DESTROYED':
        add('power.mantis', strike);
        impact(1);
        break;
      case 'POWER_GRANTED': {
        // Mode Deschis: the rank is public, so its motif plays - and Squid's motif is a rest.
        // Mode Ascuns: the grant is public, its rank is not: the uniform cue only, whatever the
        // event happens to carry.
        if (mode === 'deschis') {
          const m = motifName(e.rank);
          if (m) add(`power.granted.${m}`, 0);
        } else {
          add('power.granted', 0);
          const own = e.grantId && facts.grantRank ? facts.grantRank(e.grantId) : undefined;
          const m = motifName(own);
          if (facts.headphones && e.playerId === me && m) add('power.granted.mine', 500, { rank: m });
        }
        break;
      }
      case 'POWER_USED': {
        const m = motifName(e.rank);
        if (!m) break; // Squid has no motif, no reveal: silence
        const reveal = mode === 'ascuns';
        if (reveal) add('power.reveal', 0);
        // the motif is the power's call: after the reveal (Ascuns), at once (Deschis); the riser gathers into the strike
        const call = reveal ? BEAT.effect : 0;
        if (e.viaClownfish) add('power.used.clownfish', call, { rank: m });
        else add(`power.used.${m}`, call);
        add('power.windup', strike - BEAT.windup);
        break;
      }
      case 'CLOWNFISH_BOUND': {
        // public in Deschis; private in Ascuns (and then only for the owner, who has headphones on)
        if (mode === 'deschis' || (e.playerId === me && facts.headphones)) {
          const c = motifName(e.boundRank);
          add('power.clownfish.bound', 0, { ...(c ? { rank: c } : {}), ...(mode === 'deschis' ? {} : { private: true }) });
        }
        break;
      }
      case 'SHARK_JUMP':
        add('power.shark', strike);
        impact(1);
        break;
      case 'LANTERNFISH_REFLECT':
        add('power.lanternfish', strike, { seat: seat(e.fromId) });
        impact(0.55);
        break;
      case 'TORTOISE_BLOCK':
        add('power.tortoise', strike);
        impact(0.75);
        break;
      case 'JELLYFISH_STUN':
        add('power.jellyfish', strike);
        impact(0.7);
        break;
      case 'STICKLEBACK_STEAL':
        add('power.stickleback', strike);
        impact(0.7);
        break;
      case 'STICKLEBACK_WASTED':
        add('power.stickleback.miss', strike);
        break;
      case 'WHALE_SHUFFLE':
        add('power.whale', strike);
        impact(0.9);
        break;
      case 'GAME_ENDED': {
        // the pips count up, one `table.tally` per pip, a step higher each: the same for everyone (the scores are public);
        // `at` is from the podium showing (the choreography places it)
        const top = Math.min(18, Math.max(0, ...Object.values(after.scores ?? {})));
        for (let k = 0; k < top; k++) add('table.tally', BEAT.tallyStart + k * BEAT.tallyStep, { pip: k });
        if (!players.includes(me)) break; // a spectator has no result of their own
        const won = e.winners.includes(me);
        add(won ? (e.winners.length > 1 ? 'mus.end.tie' : 'mus.end.win') : 'mus.end.lose', 0);
        break;
      }
      default:
        break; // WINDOW_OPENED / WINDOW_CLOSED: the rules' own tells, never voiced
    }
  }

  // the score race (public: every chip shows the scores): a new leader, a tie, a breakaway, a chase, out of reach
  const race = raceOf(record);
  if (race) add(race === 'clinch' ? 'table.clinch' : race === 'lead' || race === 'tie' ? 'table.lead' : race === 'breakaway' ? 'table.breakaway' : 'table.chase', BEAT.lead, race === 'tie' ? { count: 1 } : undefined);

  // the tally reaches 1: the last set in the pond
  const before1 = before?.setsPossible ?? null;
  if (after.setsPossible === 1 && before1 !== 1) add('mus.lastset', has('SET_LAID') ? BEAT.lastSet : 0);

  // the private tier is silent unless headphones mode is on: enforced here as well as in the engine
  return out.filter((c) => (cueDef(c.id)?.heard !== 'private' && !c.params?.private) || facts.headphones).sort((a, b) => a.at - b.at);
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
 * marks `closePlayedLocally` so `cuesFor` does not play it a second time when the window leaves
 * the view. */
export function localAnswerCue(seq: number): CueRequest {
  return { id: 'clock.close', at: 0, seed: mix(seq, 0x0c105e) };
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
  return { id, at: 0, seed: mix(seq, 0x3e7a), params: { seat } };
}

/**
 * The sound column of Appendix A as data: what is audible by default and what headphones mode
 * adds. Exported so the tests (and the lab) can walk it.
 */
export const SOUND_COLUMN: ReadonlyArray<{ signal: string; byDefault: string; headphones?: string }> = [
  { signal: 'GAME_STARTED', byDefault: 'mus.start' },
  { signal: 'TURN_STARTED', byDefault: 'table.turn (the seat) / table.turn.you' },
  { signal: 'BONUS_TURN', byDefault: 'table.bonus' },
  { signal: 'TURN_SKIPPED_STUNNED', byDefault: 'table.skipped' },
  { signal: 'HAND_REFILLED', byDefault: 'table.refill' },
  { signal: 'REQUEST_MADE', byDefault: 'table.ask (the target\'s seat)' },
  { signal: 'the answer window opens', byDefault: 'none for the table; table.asked for the target' },
  { signal: 'the answer window leaves the view', byDefault: 'clock.close on every client (at the press on the answering one)' },
  { signal: 'a structural window opens or closes', byDefault: 'none', headphones: 'clock.eligible, if you are eligible' },
  { signal: 'REQUEST_SUCCEEDED', byDefault: 'table.flight, table.give' },
  { signal: 'REQUEST_FAILED, pool > 0', byDefault: 'table.gofish' },
  { signal: 'REQUEST_FAILED, pool empty', byDefault: 'table.gofish.dry' },
  { signal: 'DREW_FROM_POOL', byDefault: 'table.draw / table.poolEmpty' },
  { signal: 'SET_LAID', byDefault: 'table.lay / table.lay.power' },
  { signal: 'SET_DESTROYED', byDefault: 'power.mantis' },
  { signal: 'POWER_GRANTED, Ascuns', byDefault: 'power.granted (uniform)', headphones: 'power.granted.mine (your own grant)' },
  { signal: 'POWER_GRANTED, Deschis', byDefault: 'power.granted.<rank>; Squid: silence' },
  { signal: 'POWER_USED', byDefault: 'power.reveal (Ascuns), power.used.<rank>' },
  { signal: 'CLOWNFISH_BOUND', byDefault: 'Deschis: power.clownfish.bound', headphones: 'Ascuns, owner: power.clownfish.bound' },
  { signal: 'the effect events', byDefault: 'power.shark / lanternfish / tortoise / jellyfish / stickleback / stickleback.miss / whale' },
  { signal: 'a power strikes', byDefault: 'power.windup (the riser into the strike), table.impact (its weight on the table top)' },
  { signal: 'the score race: a new leader or a tie / a breakaway / a chase / out of reach', byDefault: 'table.lead / table.breakaway / table.chase / table.clinch' },
  { signal: 'the tally reaches 1', byDefault: 'mus.lastset' },
  { signal: 'the stall gate shuts / opens', byDefault: 'amb.gate' },
  { signal: 'GAME_ENDED', byDefault: 'mus.end.win / tie / lose (you); table.tally, one per pip counted up (everyone)' },
  { signal: 'Squid, in any form', byDefault: 'silence' },
];
