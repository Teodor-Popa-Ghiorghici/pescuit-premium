/* choreography.ts - PURE. The presentation timeline's brain (FEEL_VISUAL_SOUND_PLAN §4.1-§4.3, §5.7).
 *
 *   (PublicRecord, SeatFacts, options) -> Choreography
 *
 * A record is one presentation step: the events that arrived (they only LABEL the diff) and the public
 * view before and after it. Transitions are view-driven: the answer window "closes" when RESPONSE_PENDING
 * leaves the view, whatever replaces it, and every window closes with the same 220 ms animation.
 * The function reads nothing that is not public: no hand, no card id, no eligibility, no grant, no
 * window context beyond the two players named aloud. With `cues.ts` and the haptics map it is what
 * the leak tests compare (§6.5): for any two histories with the same public record, every non-owner's
 * beats, durations, classes, cues and haptics are identical.
 *
 * Nothing here touches the DOM. Beats name *anchors* (a seat, the pool, the basin, the held arrow-chip)
 * and the presenter resolves them against the page; card ids never appear, so a flight to your own hand
 * is matched to the arriving cards by the presenter, from your own view.
 *
 * Times are ms from the step's start. Cue times come from cuesFor and are the audio truth; the visuals
 * are placed so their landings coincide with them (BEAT constants). Lanes: `table` plays in order;
 * `hud` and `log` play in parallel. A beat whose `anchor` is `arrival` starts when the message arrives
 * (input must never wait for a flight); the rest start when the table lane is free.
 */

import { SILENT_RANKS } from '../audio/cuesheet.js';
import { BEAT, cuesFor, type CueRequest, type PublicEvent, type PublicLaidSet, type PublicRecord, type PublicView, type SeatFacts } from '../audio/cues.js';
import { hapticsFor, type HapticRequest } from '../audio/haptics.js';

export type Lane = 'table' | 'hud' | 'log';
export type JuiceClass = 'light' | 'medium' | 'heavy' | 'ceremony';

export type BeatKind =
  | 'start' | 'turn' | 'skip' | 'bonus' | 'refill' | 'ask' | 'hold' | 'close' | 'give' | 'gofish' | 'dry' | 'draw' | 'poolEmpty'
  | 'lay' | 'lastSet' | 'grant' | 'reveal' | 'spent' | 'bound' | 'shark' | 'reflect' | 'block' | 'stun' | 'steal' | 'miss'
  | 'mantis' | 'whale' | 'gate' | 'end' | 'log' | 'meta';

/** Where a flight starts or lands. Resolved against the page by the presenter. */
export type Anchor =
  | { k: 'seat'; id: string }
  | { k: 'pool' }
  | { k: 'basin' }
  | { k: 'center' }
  /** the arrow-chip that is resting on the target's post */
  | { k: 'chip' }
  | { k: 'set'; owner: string; id?: string }
  | { k: 'tally' }
  | { k: 'gate' };

export type VfxKind =
  | 'inkBurst' | 'woodChips' | 'waterRing' | 'dustPuff' | 'gateNotch' | 'speedGrooves' | 'shellClamp'
  | 'bellStamp' | 'mirrorGlint' | 'barbedHook' | 'spiralChips' | 'roeBurst' | 'gateDoors';

export interface Vfx {
  kind: VfxKind;
  at: number;
  anchor: Anchor;
}

export interface Flight {
  key: string;
  what: 'chip' | 'back' | 'totem';
  /** chip: the seal it bears (the rank asked for is spoken aloud, so it is public) */
  rank?: string;
  from: Anchor;
  to: Anchor;
  start: number;
  land: number;
  /** cards: index among the flights of one batch (the stagger) */
  index?: number;
  /** the fraction of the path at which it turns at a hard corner (the Shark's interception) */
  corner?: number;
  /** what becomes of the flier when it lands */
  end: 'stay' | 'vanish' | 'settle' | 'dive' | 'drop' | 'press';
  /** the flight ends at one of your own hand's cards: the presenter matches it to an arriving card */
  toHand?: boolean;
  /** the flight starts at one of your own hand's cards: it is drawn as a ghost until it takes off */
  fromHand?: boolean;
  /** a straight, fast line: no arc (the Stickleback's yank) */
  straight?: boolean;
  /** the chip is drawn mirrored: the Lanternfish sends the ask back */
  mirror?: boolean;
  /** travel is instant (reduced motion) */
  instant?: boolean;
}

export type MaskTarget = 'totem' | 'plank' | 'set' | 'crack' | 'tally' | 'podium';
export interface Mask {
  target: MaskTarget;
  ref?: string;
  /** ms from the step's start until the pixels may show */
  until: number;
}

export type Op =
  | { op: 'wobble'; at: number; anchor: Anchor }
  | { op: 'plankRise'; at: number }
  | { op: 'closeWindow'; at: number }
  | { op: 'chipFlip'; at: number }
  | { op: 'chipRelease'; at: number }
  | { op: 'settle'; at: number; anchor: Anchor }
  | { op: 'turnLanded'; at: number; playerId: string }
  | { op: 'ignite'; at: number; owner: string; setId?: string }
  | { op: 'reveal'; at: number; owner: string; rank: string }
  | { op: 'spent'; at: number; owner: string }
  | { op: 'notch'; at: number; from: number; to: number }
  | { op: 'press'; at: number; owner: string; setId?: string }
  | { op: 'brand'; at: number; anchor: Anchor }
  | { op: 'slot'; at: number; owner: string }
  | { op: 'crack'; at: number; setId?: string; owner?: string }
  | { op: 'gate'; at: number; open: boolean }
  | { op: 'carve'; at: number }
  | { op: 'podium'; at: number }
  | { op: 'stamp'; at: number };

export interface Juice {
  /** table-lane animations pause this long at impact (audio does not) */
  hitStopMs?: number;
  /** trauma 0..1: the table shakes trauma^2 x 6 px (4 px on a phone) */
  trauma?: number;
  /** one impact frame: ink and paper swap for two frames */
  impact?: boolean;
  /** when it happens, ms from the step's start */
  at: number;
}

export interface Beat {
  id: string;
  kind: BeatKind;
  lane: Lane;
  cls: JuiceClass;
  /** `arrival`: starts when the message arrives; `table`: when the table lane is free */
  anchor: 'arrival' | 'table';
  /** lead-in from the step's start */
  at: number;
  dur: number;
  flights: Flight[];
  vfx: Vfx[];
  ops: Op[];
  masks: Mask[];
  cues: CueRequest[];
  haptics: HapticRequest[];
  juice?: Juice;
}

export interface Choreography {
  seq: number;
  beats: Beat[];
  /** how long this step keeps the table lane busy */
  tableMs: number;
  /** when the podium may show, for the step that ends the game */
  podiumAt: number | null;
  /** the step's cues and haptics as one flat, time-ordered list: what the tests and the lab compare */
  cues: CueRequest[];
  haptics: HapticRequest[];
}

export interface ChoreoOptions {
  /** the table speed setting times the backlog factor: 1, 1.5 */
  speed: number;
  /** more than 1.2 s queued: 1.5x, with each cue's short variant */
  short: boolean;
  /** more than 2.5 s queued: flush to the end state and play only the last landing */
  flush: boolean;
  /** reduced motion: order kept, travel instant, no hit-stop, shake or impact frame */
  reduced: boolean;
}
export const DEFAULT_OPTIONS: ChoreoOptions = { speed: 1, short: false, flush: false, reduced: false };

/** §4.1 / §4.3 numbers, ms */
export const TIME = {
  close: 220,
  ask: BEAT.askLands, // the arrow-chip's flight: 320
  hold: BEAT.askedRoll, // the target's plank rises: 340
  answerLead: 100, // beat 4 starts this long after the answer
  backStart: 120,
  backFly: 460,
  backStagger: 60,
  settle: 640, // the totem settles back on the asker (bonus)
  settleMs: 60,
  dive: 300, // the chip meets the pond / the basin floor
  draw: 620, // the drawn card lands
  turnHop: 460, // the totem's travel
  rest: 40, // after the totem lands
  reveal: 1300,
  hitStop: 70,
  layFirst: 80,
  layStep: 70,
  stamp: 300,
  notch: 320,
  effectFly: 300,
} as const;

/** A flight's nominal length, capped by §4.3's distance rule when the presenter knows the distance. */
export const flightMs = (distancePx: number): number => Math.round(Math.min(TIME.backFly, Math.max(260, distancePx / 1.8)));

/* ---------------------------------------------------------------- helpers */

const isAnswer = (w: PublicView['window']): boolean => !!w && w.type === 'RESPONSE_PENDING';
const sameWindow = (a: PublicView['window'], b: PublicView['window']): boolean => !!a && !!b && a.type === b.type && a.askerId === b.askerId && a.targetId === b.targetId;

const LOG_WORTHY = new Set<string>([
  'REQUEST_MADE', 'REQUEST_SUCCEEDED', 'REQUEST_FAILED', 'HAND_REFILLED', 'SET_LAID', 'SET_DESTROYED', 'POWER_GRANTED', 'POWER_USED', 'SHARK_JUMP',
  'LANTERNFISH_REFLECT', 'TORTOISE_BLOCK', 'JELLYFISH_STUN', 'STICKLEBACK_STEAL', 'STICKLEBACK_WASTED', 'WHALE_SHUFFLE', 'BONUS_TURN', 'TURN_SKIPPED_STUNNED', 'GAME_ENDED',
]);

/** which beat a cue belongs to, in order of preference: the first kind present wins */
function cueBeatKinds(id: string): BeatKind[] {
  if (id === 'clock.close') return ['close'];
  if (id === 'table.asked' || id === 'clock.eligible') return ['hold', 'close'];
  if (id === 'table.ask') return ['ask'];
  if (id === 'table.flight' || id === 'table.give') return ['give'];
  if (id === 'table.gofish') return ['gofish'];
  if (id === 'table.gofish.dry') return ['dry'];
  if (id === 'table.draw') return ['draw'];
  if (id === 'table.poolEmpty') return ['poolEmpty', 'draw'];
  if (id === 'table.turn' || id === 'table.turn.you') return ['turn', 'skip'];
  if (id === 'table.skipped') return ['skip', 'turn'];
  if (id === 'table.bonus') return ['bonus'];
  if (id === 'table.refill') return ['refill'];
  if (id.startsWith('table.lay')) return ['lay'];
  if (id === 'mus.lastset') return ['lastSet', 'lay'];
  if (id === 'mus.start') return ['start'];
  if (id.startsWith('mus.end')) return ['end'];
  if (id === 'amb.gate') return ['gate'];
  if (id === 'power.reveal') return ['reveal'];
  if (id.startsWith('power.granted')) return ['grant', 'lay'];
  if (id === 'power.clownfish.bound') return ['bound'];
  if (id.startsWith('power.used.')) return ['reveal', 'spent', 'shark', 'reflect', 'block', 'stun', 'steal', 'miss', 'mantis', 'whale'];
  if (id === 'power.shark') return ['shark'];
  if (id === 'power.lanternfish') return ['reflect'];
  if (id === 'power.tortoise') return ['block'];
  if (id === 'power.jellyfish') return ['stun'];
  if (id.startsWith('power.stickleback')) return ['steal', 'miss'];
  if (id === 'power.mantis') return ['mantis'];
  if (id === 'power.whale') return ['whale'];
  return [];
}

function hapticBeatKinds(signal: string): BeatKind[] {
  switch (signal) {
    case 'yourTurn': return ['turn', 'skip'];
    case 'youWereAsked': return ['hold'];
    case 'eligible': return ['hold', 'close'];
    case 'cardLands': return ['give', 'draw', 'refill'];
    case 'cardsTaken': return ['give', 'shark', 'reflect', 'steal'];
    case 'stunned': return ['stun', 'skip'];
    case 'setDestroyed': return ['mantis'];
    case 'whale': return ['whale'];
    default: return [];
  }
}

const laidSetOf = (v: PublicView | null | undefined, id: string | undefined): PublicLaidSet | undefined => (id ? v?.laidSets?.find((s) => s.id === id) : undefined);

/* ------------------------------------------------------------- the function */

export function choreograph(record: PublicRecord, facts: SeatFacts, opts: ChoreoOptions = DEFAULT_OPTIONS): Choreography {
  const { before, after, events, seq } = record;
  const me = facts.playerId;
  const beats: Beat[] = [];
  const has = (t: PublicEvent['type']): boolean => events.some((e) => e.type === t);
  const started = has('GAME_STARTED');
  const ascuns = record.mode === 'ascuns';

  let n = 0;
  const beat = (kind: BeatKind, over: Partial<Beat> & Pick<Beat, 'lane' | 'cls' | 'at' | 'dur'>): Beat => {
    const b: Beat = { id: `${seq}:${kind}:${n++}`, kind, anchor: over.lane === 'table' ? 'table' : 'arrival', flights: [], vfx: [], ops: [], masks: [], cues: [], haptics: [], ...over };
    beats.push(b);
    return b;
  };

  /* ---- view-driven transitions: windows ---- */
  const w0 = before?.window ?? null;
  const w1 = after.window ?? null;
  const windowLeft = !!w0 && !sameWindow(w0, w1);
  const answerOpened = isAnswer(w1) && !(isAnswer(w0) && sameWindow(w0, w1));
  // every window closes the same way: 220 ms, whatever it was and whatever replaces it (§4.2)
  if (windowLeft) beat('close', { lane: 'hud', cls: 'light', at: 0, dur: TIME.close, ops: [{ op: 'closeWindow', at: 0 }] });

  /* ---- the ask: beat 1 (the chip flies), beat 2 (the hold) ---- */
  for (const e of events) {
    if (e.type !== 'REQUEST_MADE') continue;
    beat('ask', {
      lane: 'table', cls: 'light', at: 0, dur: TIME.ask,
      flights: [{ key: `chip:${e.askerId}>${e.targetId}`, what: 'chip', rank: e.rank, from: { k: 'seat', id: e.askerId }, to: { k: 'seat', id: e.targetId }, start: 0, land: TIME.ask, end: 'stay' }],
      ops: [{ op: 'wobble', at: TIME.ask, anchor: { k: 'seat', id: e.targetId } }],
    });
  }
  if (answerOpened) {
    // the target's plank rises with the roll; everyone else's banner is already up. Input never waits.
    beat('hold', { lane: 'hud', cls: 'light', at: TIME.hold, dur: 0, ops: [{ op: 'plankRise', at: TIME.hold }], masks: [{ target: 'plank', until: TIME.hold }] });
  }

  /* ---- beat 4: the answer's consequence ---- */
  const answerAt = TIME.answerLead;
  const wet = before ? before.poolCount > 0 : has('DREW_FROM_POOL');
  for (const e of events) {
    if (e.type === 'REQUEST_SUCCEEDED') {
      const count = Math.max(1, Math.min(12, e.count));
      const flights: Flight[] = Array.from({ length: count }, (_, i) => {
        const start = TIME.backStart + i * TIME.backStagger;
        return { key: `give:${seq}:${i}`, what: 'back', from: { k: 'seat', id: e.targetId }, to: { k: 'seat', id: e.askerId }, start, land: start + TIME.backFly, index: i, end: 'vanish', toHand: e.askerId === me, fromHand: e.targetId === me } as Flight;
      });
      const lastLand = flights[flights.length - 1].land;
      beat('give', {
        lane: 'table', cls: 'medium', at: 0, dur: lastLand,
        flights,
        ops: [{ op: 'chipFlip', at: answerAt }, { op: 'chipRelease', at: lastLand }],
        vfx: [{ kind: 'speedGrooves', at: TIME.backStart, anchor: { k: 'seat', id: e.targetId } }],
        juice: { at: lastLand, trauma: 0.4 },
      });
    } else if (e.type === 'REQUEST_FAILED') {
      if (wet) {
        beat('gofish', {
          lane: 'table', cls: 'light', at: 0, dur: TIME.dive + TIME.rest,
          flights: [{ key: `dive:${seq}`, what: 'chip', from: { k: 'chip' }, to: { k: 'pool' }, start: answerAt, land: TIME.dive, end: 'dive' }],
          vfx: [{ kind: 'waterRing', at: TIME.dive, anchor: { k: 'pool' } }],
        });
      } else {
        beat('dry', {
          lane: 'table', cls: 'light', at: 0, dur: TIME.dive + TIME.rest,
          flights: [{ key: `drop:${seq}`, what: 'chip', from: { k: 'chip' }, to: { k: 'basin' }, start: answerAt, land: TIME.dive, end: 'drop' }],
          vfx: [{ kind: 'dustPuff', at: TIME.dive, anchor: { k: 'basin' } }],
        });
      }
    } else if (e.type === 'DREW_FROM_POOL') {
      const drawer = e.playerId;
      const last = !!e.poolEmpty;
      const b = beat('draw', {
        lane: 'table', cls: 'light', at: 0, dur: TIME.draw + TIME.rest,
        flights: [{ key: `draw:${seq}:${drawer}`, what: 'back', from: { k: 'pool' }, to: { k: 'seat', id: drawer }, start: TIME.dive, land: TIME.draw, end: 'vanish', toHand: drawer === me }],
      });
      if (last) {
        b.kind = 'poolEmpty';
        b.cls = 'heavy';
        b.vfx.push({ kind: 'waterRing', at: TIME.draw, anchor: { k: 'pool' } });
        b.juice = { at: TIME.draw, hitStopMs: TIME.hitStop, trauma: 0.5, impact: true };
      }
    }
  }

  /* ---- refills and the deal ---- */
  for (const e of events) {
    if (e.type !== 'HAND_REFILLED') continue;
    const count = Math.max(1, Math.min(7, e.count));
    if (started) {
      // the deal: seven cards fly to your hand while the posts carve in
      if (e.playerId !== me) continue;
      beat('refill', {
        lane: 'table', cls: 'ceremony', at: 0, dur: 380 + 60 * count,
        flights: Array.from({ length: count }, (_, i) => ({ key: `deal:${seq}:${i}`, what: 'back', from: { k: 'pool' }, to: { k: 'seat', id: me }, start: 100 + 60 * i, land: 380 + 60 * i, index: i, end: 'vanish', toHand: true }) as Flight),
      });
    } else {
      beat('refill', {
        lane: 'table', cls: 'light', at: 0, dur: 250 + 90 * count + TIME.rest,
        flights: Array.from({ length: count }, (_, i) => ({ key: `refill:${seq}:${e.playerId}:${i}`, what: 'back', from: { k: 'pool' }, to: { k: 'seat', id: e.playerId }, start: 90 * i, land: 250 + 90 * i, index: i, end: 'vanish', toHand: e.playerId === me }) as Flight),
      });
    }
  }

  /* ---- the totem: every stop it makes (§4.5) ---- */
  const bonusFor = new Set(events.filter((e) => e.type === 'BONUS_TURN').map((e) => (e as { playerId: string }).playerId));
  const base = started ? BEAT.start : BEAT.turn;
  let slot = 0;
  let from: string | null = before?.currentPlayerId ?? null;
  for (const e of events) {
    if (e.type === 'BONUS_TURN') {
      beat('bonus', {
        lane: 'table', cls: 'light', at: 0, dur: TIME.settle + TIME.settleMs,
        ops: [{ op: 'settle', at: TIME.settle, anchor: { k: 'seat', id: e.playerId } }],
      });
      continue;
    }
    if (e.type !== 'TURN_STARTED' && e.type !== 'TURN_SKIPPED_STUNNED') continue;
    if (e.type === 'TURN_STARTED' && bonusFor.has(e.playerId)) continue; // the asker keeps the turn
    const land = base + BEAT.turnGap * slot++;
    const stop = e.playerId;
    const hopFrom = from && from !== stop ? from : null;
    // a stop while the ask is still resolving waits for it: the totem leaves at +300 (§4.1)
    const startAt = Math.max(0, land - TIME.turnHop);
    const isSkip = e.type === 'TURN_SKIPPED_STUNNED';
    beat(isSkip ? 'skip' : 'turn', {
      lane: 'table', cls: 'light', at: 0, dur: land + TIME.rest,
      flights: hopFrom || started ? [{ key: `totem:${seq}:${stop}:${slot}`, what: 'totem', from: hopFrom ? { k: 'seat', id: hopFrom } : { k: 'center' }, to: { k: 'seat', id: stop }, start: startAt, land, end: 'settle' }] : [],
      ops: [{ op: 'turnLanded', at: land, playerId: stop }],
      masks: isSkip ? [] : [{ target: 'totem', until: land }],
    });
    from = stop;
  }

  /* ---- sets laid and powers granted ---- */
  for (const e of events) {
    if (e.type === 'SET_LAID') {
      const set = laidSetOf(after, e.setId);
      const count = Math.max(2, Math.min(6, set?.cardCount ?? 3));
      const lastLand = TIME.layFirst + TIME.layStep * (count - 1) + 40;
      const flights: Flight[] = Array.from({ length: count }, (_, i) => ({ key: `lay:${seq}:${i}`, what: 'back', from: { k: 'seat', id: e.playerId }, to: { k: 'set', owner: e.playerId, id: e.setId }, start: i * 30, land: TIME.layFirst + TIME.layStep * i + 40, index: i, end: 'press', fromHand: e.playerId === me }) as Flight);
      const notchFrom = before?.setsPossible ?? null;
      const notchTo = after.setsPossible ?? null;
      const b = beat('lay', {
        lane: 'table', cls: 'medium', at: 0, dur: Math.max(lastLand, TIME.stamp) + TIME.rest,
        flights,
        masks: [{ target: 'set', ref: e.setId, until: lastLand }],
        ops: [{ op: 'press', at: lastLand, owner: e.playerId, setId: e.setId }],
        vfx: [{ kind: 'inkBurst', at: TIME.stamp, anchor: { k: 'set', owner: e.playerId, id: e.setId } }],
      });
      if (notchFrom !== null && notchTo !== null && notchTo < notchFrom) {
        b.ops.push({ op: 'notch', at: TIME.notch, from: notchFrom, to: notchTo });
        b.masks.push({ target: 'tally', until: TIME.notch });
        b.vfx.push({ kind: 'woodChips', at: TIME.notch, anchor: { k: 'tally' } });
      }
    } else if (e.type === 'POWER_GRANTED') {
      const layed = has('SET_LAID');
      // the collar or rosette core ignites - the same for every hidden rank (§5.7)
      beat('grant', {
        lane: 'hud', cls: 'medium', at: layed ? TIME.stamp + 40 : 0, dur: 320, anchor: 'table',
        ops: [{ op: 'ignite', at: layed ? TIME.stamp + 40 : 0, owner: e.playerId, setId: e.sourceSetId }],
      });
    }
  }
  // the tally reaches 1: the last set in the pond - the pulse quickens, its notch is inked (heavy)
  if (after.setsPossible === 1 && (before?.setsPossible ?? null) !== 1) {
    beat('lastSet', {
      lane: 'table', cls: 'heavy', at: has('SET_LAID') ? BEAT.lastSet : 0, dur: 320,
      ops: [{ op: 'stamp', at: has('SET_LAID') ? BEAT.lastSet : 0 }],
      vfx: [{ kind: 'inkBurst', at: has('SET_LAID') ? BEAT.lastSet : 0, anchor: { k: 'tally' } }],
      juice: { at: has('SET_LAID') ? BEAT.lastSet : 0, hitStopMs: TIME.hitStop, trauma: 0.45, impact: true },
    });
  }

  /* ---- powers: the reveal, then the effects (§5.7, Appendix A) ---- */
  const used = events.find((e) => e.type === 'POWER_USED' && !SILENT_RANKS.has(e.rank));
  const usedAt: number | null = used ? (ascuns ? BEAT.effect : 0) : null;
  const E = usedAt ?? BEAT.effect;
  if (used && used.type === 'POWER_USED') {
    if (ascuns) {
      // the plate lifts, flips in three stepped frames, rises to the pond's centre with its seal, holds 400 ms, presses flat
      beat('reveal', { lane: 'hud', cls: 'medium', at: 0, dur: TIME.reveal, ops: [{ op: 'reveal', at: 0, owner: used.playerId, rank: used.rank }] });
    } else {
      beat('spent', { lane: 'hud', cls: 'light', at: 0, dur: 220, ops: [{ op: 'spent', at: 0, owner: used.playerId }] });
    }
  }
  for (const e of events) {
    switch (e.type) {
      case 'SHARK_JUMP': {
        const count = Math.max(1, Math.min(8, e.count ?? 2));
        const loser = e.fromId ?? e.loserId ?? '';
        const hit = E + 50;
        const dur = 240;
        beat('shark', {
          lane: 'table', cls: 'heavy', at: 0, dur: hit + 240,
          // the cards turn at a hard corner at 55 % of their path; the water churns
          flights: Array.from({ length: count }, (_, i) => ({ key: `shark:${seq}:${i}`, what: 'back', from: { k: 'seat', id: loser }, to: { k: 'seat', id: e.playerId }, start: Math.max(0, hit - Math.round(dur * 0.55)) + i * 40, land: Math.max(dur, hit - Math.round(dur * 0.55) + dur) + i * 40, corner: 0.55, index: i, end: 'vanish', toHand: e.playerId === me, fromHand: loser === me }) as Flight),
          vfx: [{ kind: 'waterRing', at: hit, anchor: { k: 'center' } }, { kind: 'speedGrooves', at: hit - 100, anchor: { k: 'seat', id: loser } }],
          juice: { at: hit, hitStopMs: TIME.hitStop, trauma: 0.55, impact: true },
        });
        break;
      }
      case 'LANTERNFISH_REFLECT': {
        const count = Math.max(1, Math.min(8, e.count ?? 2));
        beat('reflect', {
          lane: 'table', cls: 'medium', at: 0, dur: E + 60 + TIME.effectFly + 120,
          // the chip mirrors and returns: the ask comes back
          flights: [
            { key: `mirror:${seq}`, what: 'chip', rank: e.rank, from: { k: 'seat', id: e.playerId }, to: { k: 'seat', id: e.fromId }, start: E, land: E + 220, end: 'vanish', mirror: true },
            ...Array.from({ length: count }, (_, i) => ({ key: `reflect:${seq}:${i}`, what: 'back', from: { k: 'seat', id: e.fromId }, to: { k: 'seat', id: e.playerId }, start: E + 200 + i * 50, land: E + 200 + i * 50 + TIME.effectFly, index: i, end: 'vanish', toHand: e.playerId === me, fromHand: e.fromId === me }) as Flight),
          ],
          vfx: [{ kind: 'mirrorGlint', at: E + 100, anchor: { k: 'seat', id: e.playerId } }],
        });
        break;
      }
      case 'TORTOISE_BLOCK':
        beat('block', {
          lane: 'table', cls: 'medium', at: 0, dur: E + 400,
          vfx: [{ kind: 'shellClamp', at: E + 60, anchor: { k: 'seat', id: e.playerId } }],
          ops: [{ op: 'wobble', at: E + 60, anchor: { k: 'seat', id: e.playerId } }, { op: 'chipRelease', at: E + 300 }],
          juice: { at: E + 60, trauma: 0.4 },
        });
        break;
      case 'JELLYFISH_STUN':
        beat('stun', {
          lane: 'table', cls: 'medium', at: 0, dur: E + 400,
          // the bell brands the target's plate
          vfx: [{ kind: 'bellStamp', at: E + 160, anchor: { k: 'seat', id: e.targetId } }],
          ops: [{ op: 'brand', at: E + 160, anchor: { k: 'seat', id: e.targetId } }],
          juice: { at: E + 160, trauma: 0.4 },
        });
        break;
      case 'STICKLEBACK_STEAL': {
        const count = Math.max(1, Math.min(8, e.count ?? 1));
        beat('steal', {
          lane: 'table', cls: 'medium', at: 0, dur: E + 260 + 40 * count,
          // a straight, fast yank
          flights: Array.from({ length: count }, (_, i) => ({ key: `yank:${seq}:${i}`, what: 'back', from: { k: 'seat', id: e.targetId }, to: { k: 'seat', id: e.playerId }, start: E + i * 40, land: E + 200 + i * 40, index: i, end: 'vanish', straight: true, toHand: e.playerId === me, fromHand: e.targetId === me }) as Flight),
          vfx: [{ kind: 'barbedHook', at: E, anchor: { k: 'seat', id: e.targetId } }],
          juice: { at: E + 200, trauma: 0.4 },
        });
        break;
      }
      case 'STICKLEBACK_WASTED':
        // a yank that catches nothing
        beat('miss', { lane: 'table', cls: 'light', at: 0, dur: E + 300, vfx: [{ kind: 'barbedHook', at: E, anchor: { k: 'seat', id: e.targetId } }] });
        break;
      case 'SET_DESTROYED': {
        const owner = e.ownerId ?? laidSetOf(before, e.setId)?.ownerId;
        beat('mantis', {
          lane: 'table', cls: 'heavy', at: 0, dur: E + 420,
          // hit-stop, an impact frame, splinters; the crack stays
          masks: [{ target: 'crack', ref: e.setId, until: E + 40 }],
          ops: [{ op: 'crack', at: E + 40, setId: e.setId, owner }],
          vfx: [{ kind: 'woodChips', at: E + 40, anchor: owner ? { k: 'set', owner, id: e.setId } : { k: 'center' } }],
          juice: { at: E + 40, hitStopMs: TIME.hitStop, trauma: 0.6, impact: true },
        });
        break;
      }
      case 'WHALE_SHUFFLE': {
        const a = e.targetAId ?? '';
        const b = e.targetBId ?? '';
        const sizeA = Math.min(6, before?.handSizes?.[a] ?? after.handSizes?.[a] ?? 4);
        const sizeB = Math.min(6, before?.handSizes?.[b] ?? after.handSizes?.[b] ?? 4);
        const total = Math.min(12, sizeA + sizeB);
        const outA = Math.min(6, after.handSizes?.[a] ?? sizeA);
        const outB = Math.min(6, after.handSizes?.[b] ?? sizeB);
        const spiral: Flight[] = Array.from({ length: total }, (_, i) => ({ key: `spiral:${seq}:${i}`, what: 'back', from: { k: 'seat', id: i < sizeA ? a : b }, to: { k: 'center' }, start: E + i * 25, land: E + 380 + i * 25, index: i, end: 'stay', fromHand: (i < sizeA ? a : b) === me }) as Flight);
        const redeal: Flight[] = [
          ...Array.from({ length: outA }, (_, i) => ({ key: `redeal:${seq}:a:${i}`, what: 'back', from: { k: 'center' }, to: { k: 'seat', id: a }, start: E + 760 + i * 30, land: E + 1040 + i * 30, index: i, end: 'vanish', toHand: a === me }) as Flight),
          ...Array.from({ length: outB }, (_, i) => ({ key: `redeal:${seq}:b:${i}`, what: 'back', from: { k: 'center' }, to: { k: 'seat', id: b }, start: E + 790 + i * 30, land: E + 1070 + i * 30, index: i, end: 'vanish', toHand: b === me }) as Flight),
        ];
        beat('whale', {
          lane: 'table', cls: 'heavy', at: 0, dur: E + 1070 + 30 * Math.max(outA, outB) + TIME.rest,
          // twelve backs spiral at the pond's centre, then the redeal
          flights: [...spiral, ...redeal],
          vfx: [{ kind: 'spiralChips', at: E + 400, anchor: { k: 'center' } }],
          juice: { at: E + 420, hitStopMs: TIME.hitStop, trauma: 0.5, impact: true },
        });
        break;
      }
      case 'CLOWNFISH_BOUND':
        if (record.mode === 'deschis' || e.playerId === me) beat('bound', { lane: 'hud', cls: 'light', at: 0, dur: 220, ops: [{ op: 'slot', at: 0, owner: e.playerId }] });
        break;
      default:
        break;
    }
  }

  /* ---- the stall gate (§3.9): a notch shuts, or a lay throws it open ---- */
  const missesBefore = before?.endPressure?.misses ?? 0;
  const missesNow = after.endPressure?.misses ?? 0;
  if (after.endPressure && missesNow > missesBefore && missesNow >= Math.ceil(after.endPressure.limit / 2)) {
    beat('gate', { lane: 'table', cls: 'light', at: BEAT.gate, dur: 200, ops: [{ op: 'gate', at: BEAT.gate, open: false }], vfx: [{ kind: 'gateNotch', at: BEAT.gate, anchor: { k: 'gate' } }] });
  }
  if (missesBefore > 0 && missesNow === 0) {
    beat('gate', { lane: 'table', cls: 'light', at: BEAT.gateOpen, dur: 260, ops: [{ op: 'gate', at: BEAT.gateOpen, open: true }], vfx: [{ kind: 'gateNotch', at: BEAT.gateOpen, anchor: { k: 'gate' } }] });
  }

  /* ---- ceremonies ---- */
  if (started) {
    beat('start', {
      lane: 'hud', cls: 'ceremony', at: 0, dur: BEAT.start, ops: [{ op: 'carve', at: 0 }],
      // the gate opens, the posts carve in, the tally is carved on the rim
      vfx: [{ kind: 'gateDoors', at: 0, anchor: { k: 'center' } }],
    });
  }
  let podiumAt: number | null = null;
  const ended = events.find((e) => e.type === 'GAME_ENDED');
  if (ended) {
    // the last lay's stamp, one held beat, the gate doors, then the podium - never blocking input
    const settled = beats.filter((b) => b.lane === 'table').reduce((m, b) => Math.max(m, b.at + b.dur), 0);
    podiumAt = Math.max(settled, TIME.stamp) + BEAT.podium;
    beat('end', {
      lane: 'hud', cls: 'ceremony', at: Math.max(settled, TIME.stamp), dur: BEAT.podium, anchor: 'table',
      ops: [{ op: 'podium', at: podiumAt }],
      vfx: [{ kind: 'gateDoors', at: Math.max(settled, TIME.stamp), anchor: { k: 'center' } }, ...(ended.type === 'GAME_ENDED' && ended.winners.length ? [{ kind: 'roeBurst' as const, at: podiumAt, anchor: { k: 'center' as const } }] : [])],
      masks: [{ target: 'podium', until: podiumAt }],
    });
  }

  /* ---- the log: the line stamps in as its beat lands ---- */
  if (events.some((e) => LOG_WORTHY.has(e.type))) {
    const first = beats.filter((b) => b.lane === 'table' && b.flights.length).map((b) => b.flights.reduce((m, f) => Math.min(m, f.land), Infinity))[0];
    beat('log', { lane: 'log', cls: 'light', at: Number.isFinite(first) ? first : 0, dur: TIME.close, ops: [{ op: 'stamp', at: Number.isFinite(first) ? first : 0 }] });
  }

  /* ---- cues and haptics: from the audio truth, placed on their beats ---- */
  const cues = cuesFor(record, facts);
  const haptics = hapticsFor(record, facts);
  const place = <T>(list: T[], kinds: (x: T) => BeatKind[], put: (b: Beat, x: T) => void): void => {
    for (const x of list) {
      const wanted = kinds(x);
      const target = wanted.map((k) => beats.find((b) => b.kind === k)).find(Boolean) ?? beats.find((b) => b.lane === 'hud') ?? beat('meta', { lane: 'hud', cls: 'light', at: 0, dur: 0 });
      put(target, x);
    }
  };
  place(cues, (c) => cueBeatKinds(c.id), (b, c) => b.cues.push(c));
  place(haptics, (h) => hapticBeatKinds(h.signal), (b, h) => b.haptics.push(h));

  // the podium: the ceremony's cue waits for it
  for (const b of beats) if (b.kind === 'end' && podiumAt !== null) b.cues = b.cues.map((c) => (c.id.startsWith('mus.end') ? { ...c, at: podiumAt! } : c));

  return finish({ seq, beats, tableMs: 0, podiumAt, cues: [], haptics: [] }, opts);
}

/* ---------------------------------------------- backlog, speed, reduced motion */

function finish(ch: Choreography, o: ChoreoOptions): Choreography {
  let beats = ch.beats;

  // more than 2.5 s queued: flush to the end state and play only the last landing (§4.2)
  if (o.flush) {
    const table = beats.filter((b) => b.lane === 'table' && b.flights.length);
    const lastTable = table[table.length - 1];
    beats = beats
      .filter((b) => b === lastTable || b.kind === 'close' || b.kind === 'end' || b.kind === 'hold' || b.kind === 'start')
      .map((b) => {
        if (b !== lastTable) return b;
        const last = b.flights[b.flights.length - 1];
        return { ...b, at: 0, flights: last ? [{ ...last, start: 0, land: TIME.rest }] : [], vfx: [], ops: b.ops.filter((x) => x.op === 'turnLanded').map((x) => ({ ...x, at: TIME.rest })), juice: undefined, dur: TIME.rest + TIME.rest };
      });
  }

  const k = 1 / (o.speed > 0 ? o.speed : 1);
  const s = (v: number): number => Math.round(v * k);
  beats = beats.map((b) => ({
    ...b,
    at: s(b.at),
    dur: s(b.dur),
    flights: b.flights.map((f) => ({ ...f, start: s(f.start), land: s(f.land), ...(o.reduced ? { instant: true } : {}) })),
    vfx: b.vfx.map((v) => ({ ...v, at: s(v.at) })),
    ops: b.ops.map((x) => ({ ...x, at: s(x.at) })),
    masks: b.masks.map((m) => ({ ...m, until: s(m.until) })),
    cues: b.cues.map((c) => ({ ...c, at: s(c.at), ...(o.short ? { params: { ...c.params, short: true } } : {}) })),
    haptics: b.haptics.map((h) => ({ ...h, at: s(h.at) })),
    // reduced motion: no hit-stop, no shake, no impact frame
    juice: b.juice && !o.reduced ? { ...b.juice, at: s(b.juice.at) } : undefined,
  }));

  const tableMs = beats.filter((b) => b.lane === 'table').reduce((m, b) => Math.max(m, b.at + b.dur), 0);
  const cues = beats.flatMap((b) => b.cues).sort((a, b) => a.at - b.at);
  const haptics = beats.flatMap((b) => b.haptics).sort((a, b) => a.at - b.at);
  return { ...ch, beats, tableMs, podiumAt: ch.podiumAt === null ? null : s(ch.podiumAt), cues, haptics };
}

/** A stable, viewer-independent summary of what a step will do: the leak tests compare these. */
export function summarize(ch: Choreography): unknown {
  return {
    tableMs: ch.tableMs,
    podiumAt: ch.podiumAt,
    beats: ch.beats.map((b) => ({ kind: b.kind, lane: b.lane, cls: b.cls, anchor: b.anchor, at: b.at, dur: b.dur, flights: b.flights.map((f) => ({ what: f.what, rank: f.rank, from: f.from, to: f.to, start: f.start, land: f.land, corner: f.corner, end: f.end })), vfx: b.vfx, ops: b.ops, masks: b.masks, juice: b.juice })),
  };
}
