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
  | 'mantis' | 'whale' | 'gate' | 'end' | 'log' | 'meta'
  /** a power's moment: the table dims to the seats involved, the actor charges, the proclamation slams in */
  | 'power'
  /** the score race: a new leader, a tie, a breakaway, a chase, a leader out of reach */
  | 'lead';

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
  | { k: 'gate' }
  /** a point `t` of the way from one seat to another (the Tortoise's cards lift toward the asker and drop back) */
  | { k: 'between'; from: string; to: string; t: number }
  /** a point `dy` px above another anchor (a shell or a club drops from here) */
  | { k: 'above'; of: Anchor; dy: number };

/** the embodiment of a power (or the leader's crown) that travels from cause to effect */
export type Sprite = 'fin' | 'bell' | 'hook' | 'lantern' | 'shell' | 'club' | 'whale' | 'crown' | 'plus';

/** a drawn connection between two anchors: the fishing line, the lantern's beam, the whale's wake */
export type TetherStyle = 'line' | 'slack' | 'beam' | 'wake';

export type CalloutKind = 'power' | 'guard' | 'miss' | 'lead' | 'tie' | 'chase' | 'breakaway' | 'clinch';
/** The proclamation: a banner at the pond's centre that says, in words, what just happened. Only public
 * facts: who, to whom, how many, which rank (all said aloud by the events). The presenter localises it. */
export interface Callout {
  kind: CalloutKind;
  /** the i18n family: `callout.<key>.title` / `.line` */
  key: string;
  /** the power whose seal the banner bears */
  rank?: string;
  /** the power was copied: Clownfish */
  via?: string;
  actor?: string;
  target?: string;
  other?: string;
  count?: number;
  cardRank?: string;
  score?: number;
  margin?: number;
}

export type VfxKind =
  | 'inkBurst' | 'woodChips' | 'waterRing' | 'dustPuff' | 'gateNotch' | 'speedGrooves' | 'shellClamp'
  | 'bellStamp' | 'mirrorGlint' | 'barbedHook' | 'spiralChips' | 'roeBurst' | 'gateDoors'
  | 'jaws' | 'shockRing' | 'zap';

export interface Vfx {
  kind: VfxKind;
  at: number;
  anchor: Anchor;
  /** px; 64 when absent */
  size?: number;
}

export interface Flight {
  key: string;
  what: 'chip' | 'back' | 'totem' | 'fx';
  /** fx: what travels */
  sprite?: Sprite;
  /** fx: scale at take-off and at landing */
  scale?: [number, number];
  /** the arc's height, px (40-80 when absent) */
  lift?: number;
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
  end: 'stay' | 'vanish' | 'settle' | 'dive' | 'drop' | 'press' | 'fade';
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

export type MaskTarget = 'totem' | 'plank' | 'set' | 'crack' | 'tally' | 'lastnotch' | 'podium'
  /** a seat's stunned brand / shell shows when the sting / the clamp lands (ref: the seat) */
  | 'stun' | 'shield'
  /** the leader's crown shows when it has flown there */
  | 'crown'
  /** a seat's score keeps its old number until the set is pressed (ref: "seat:old") */
  | 'score';
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
  /** the pool's last card has gone: the basin drains to a dry floor */
  | { op: 'drain'; at: number }
  | { op: 'press'; at: number; owner: string; setId?: string }
  | { op: 'brand'; at: number; anchor: Anchor }
  | { op: 'slot'; at: number; owner: string }
  | { op: 'crack'; at: number; setId?: string; owner?: string }
  | { op: 'gate'; at: number; open: boolean }
  | { op: 'carve'; at: number }
  | { op: 'podium'; at: number }
  | { op: 'stamp'; at: number }
  /** the table dims to these seats (and the pond) until `until` */
  | { op: 'focus'; at: number; until: number; seats: string[] }
  /** the actor's seat gathers itself: a ring in the power's colour closes on it */
  | { op: 'charge'; at: number; seat: string; rank: string }
  | { op: 'tether'; at: number; dur: number; from: Anchor; to: Anchor; style: TetherStyle }
  | { op: 'callout'; at: number; dur: number; callout: Callout }
  /** a seat is struck: a hard, stepped shake of that seat alone */
  | { op: 'jolt'; at: number; anchor: Anchor }
  /** a score ticks up: the number stamps in and bumps */
  | { op: 'scorePop'; at: number; owner: string };

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
  /** the actor gathers itself this long before the strike */
  windup: 300,
  /** the proclamation stays up this long */
  callout: 1900,
  /** the table stays dimmed to the seats involved this long after the strike */
  focusHold: 900,
  /** a power's hit-stop: longer than a heavy table beat's, the strike should be felt */
  powerStop: 110,
  /** the lead moment lands after the lay's stamp */
  lead: 440,
} as const;

/** The score race (public: every seat's score is on its chip). `margin` is the sole leader's lead over the next
 * seat; 0 when the lead is shared or nobody has scored. */
export interface Lead {
  leaders: string[];
  top: number;
  margin: number;
}
export function leadOf(scores: Readonly<Record<string, number>> | undefined, order?: readonly string[]): Lead {
  const ids = order ?? Object.keys(scores ?? {});
  const vals = ids.map((id) => scores?.[id] ?? 0);
  const top = vals.length ? Math.max(...vals) : 0;
  if (top <= 0) return { leaders: [], top: 0, margin: 0 };
  const leaders = ids.filter((id) => (scores?.[id] ?? 0) === top);
  const rest = ids.filter((id) => (scores?.[id] ?? 0) < top).map((id) => scores?.[id] ?? 0);
  return { leaders, top, margin: leaders.length === 1 ? top - (rest.length ? Math.max(...rest) : 0) : 0 };
}
/** the lead's tier: 0 shared, 1 by one, 2 by two, 3 by three or more; `clinched` once no one can catch up */
export function leadTier(l: Lead, setsPossible: number | null | undefined): 0 | 1 | 2 | 3 | 'clinched' {
  if (l.leaders.length !== 1) return 0;
  if (setsPossible !== null && setsPossible !== undefined && l.margin > setsPossible) return 'clinched';
  return l.margin >= 3 ? 3 : l.margin === 2 ? 2 : 1;
}

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
  if (id.startsWith('mus.end') || id === 'table.tally') return ['end'];
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
  if (id === 'power.windup' || id === 'table.impact') return ['shark', 'reflect', 'block', 'stun', 'steal', 'miss', 'mantis', 'whale'];
  if (id === 'table.lead' || id === 'table.breakaway' || id === 'table.chase' || id === 'table.clinch') return ['lead'];
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
    case 'lead': return ['lead'];
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
        // the last card leaves the pool: the basin drains to a dry floor, in step with `table.poolEmpty`'s gurgle
        b.ops.push({ op: 'drain', at: TIME.draw });
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
        // a lay that also strands another set's cards takes two notches, and the tally says so (§3.9)
        if (notchFrom - notchTo >= 2) b.vfx.push({ kind: 'woodChips', at: TIME.notch + 90, anchor: { k: 'tally' } });
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
      // the last notch is inked when the beat lands, not when the view arrives
      masks: [{ target: 'lastnotch', until: has('SET_LAID') ? BEAT.lastSet : 0 }],
      vfx: [{ kind: 'inkBurst', at: has('SET_LAID') ? BEAT.lastSet : 0, anchor: { k: 'tally' } }],
      juice: { at: has('SET_LAID') ? BEAT.lastSet : 0, hitStopMs: TIME.hitStop, trauma: 0.45, impact: true },
    });
  }

  /* ---- the score race: the point ticks in when the set is pressed; a new leader, a tie, a breakaway, a chase
   * and a leader out of reach each get their moment. Scores are public (every chip shows them), the tally too. */
  const ended0 = has('GAME_ENDED');
  const lays = events.filter((e): e is Extract<PublicEvent, { type: 'SET_LAID' }> => e.type === 'SET_LAID');
  if (lays.length && before?.scores && after.scores) {
    const pressAt = (count: number) => TIME.layFirst + TIME.layStep * (Math.max(2, Math.min(6, count)) - 1) + 40;
    const pops = beats.filter((b) => b.kind === 'lay');
    lays.forEach((e, i) => {
      const b = pops[i];
      if (!b) return;
      const at = pressAt(laidSetOf(after, e.setId)?.cardCount ?? 3);
      b.ops.push({ op: 'scorePop', at, owner: e.playerId });
      b.masks.push({ target: 'score', ref: `${e.playerId}:${before.scores![e.playerId] ?? 0}`, until: at });
    });
    const order = after.players;
    const L0 = leadOf(before.scores, order);
    const L1 = leadOf(after.scores, order);
    const scorer = lays[lays.length - 1].playerId;
    const t0 = leadTier(L0, before.setsPossible);
    const t1 = leadTier(L1, after.setsPossible);
    const x = L1.leaders.length === 1 ? L1.leaders[0] : null;
    const was = L0.leaders.length === 1 ? L0.leaders[0] : null;
    const second = (sc: Readonly<Record<string, number>>, id: string) => Math.max(0, ...order.filter((p) => p !== id).map((p) => sc[p] ?? 0));
    let c: Callout | null = null;
    let crowns: Flight[] = [];
    let cls: JuiceClass = 'medium';
    const L = TIME.lead;
    if (!ended0) {
      if (x && t1 === 'clinched' && !(was === x && t0 === 'clinched')) {
        c = { kind: 'clinch', key: x === me ? 'clinchYou' : 'clinch', actor: x, score: L1.top, margin: L1.margin };
        cls = 'heavy';
      } else if (x && x !== was) {
        c = { kind: 'lead', key: x === me ? 'leadYou' : 'lead', actor: x, score: L1.top, other: undefined, margin: L1.margin };
        c.count = second(after.scores, x);
        // the crown flies to the new leader from the seats that shared it (or rises from the pond)
        const from = L0.leaders.filter((id) => id !== x);
        crowns = (from.length ? from : [null]).map((id, i) => ({ key: `crown:${seq}:${i}`, what: 'fx', sprite: 'crown', from: id ? { k: 'seat', id } : { k: 'center' }, to: { k: 'seat', id: x }, start: L - 60 + i * 40, land: L + 300 + i * 40, lift: 50, scale: [0.9, 1.4], end: 'fade' }) as Flight);
      } else if (!x && L1.leaders.length > 1 && L1.top >= 2 && was && L1.leaders.includes(scorer) && scorer !== was) {
        c = { kind: 'tie', key: scorer === me ? 'tieYou' : 'tie', actor: scorer, other: was, score: L1.top };
        crowns = [{ key: `crown:${seq}:tie`, what: 'fx', sprite: 'crown', from: { k: 'seat', id: was }, to: { k: 'seat', id: scorer }, start: L - 60, land: L + 300, lift: 50, scale: [1, 0.9], end: 'fade' }];
      } else if (x && x === was && typeof t1 === 'number' && typeof t0 === 'number' && t1 > t0 && t1 >= 2) {
        c = { kind: 'breakaway', key: x === me ? 'breakawayYou' : 'breakaway', actor: x, margin: L1.margin, score: L1.top };
        cls = t1 >= 3 ? 'heavy' : 'medium';
      } else if (x && x === was && scorer !== x && L0.margin >= 2 && L1.margin === 1) {
        c = { kind: 'chase', key: scorer === me ? 'chaseYou' : 'chase', actor: scorer, other: x, score: after.scores[scorer] };
      }
    }
    if (c) {
      const who = c.actor!;
      beat('lead', {
        lane: 'table', cls, at: 0, dur: L + 360 + TIME.rest,
        flights: crowns,
        masks: crowns.length ? [{ target: 'crown', until: L + 300 }] : [],
        vfx: [{ kind: c.kind === 'chase' ? 'speedGrooves' : 'roeBurst', at: L + (crowns.length ? 300 : 0), anchor: { k: 'seat', id: who }, size: cls === 'heavy' ? 150 : 110 }],
        ops: [
          { op: 'callout', at: L, dur: TIME.callout, callout: c },
          { op: 'jolt', at: L + (crowns.length ? 300 : 0), anchor: { k: 'seat', id: who } },
          ...(cls === 'heavy' ? [{ op: 'focus' as const, at: L - 100, until: L + TIME.focusHold, seats: [who] }] : []),
        ],
        juice: { at: L + (crowns.length ? 300 : 0), trauma: cls === 'heavy' ? 0.55 : 0.35, ...(cls === 'heavy' ? { hitStopMs: 80 } : {}) },
      });
    }
  }

  /* ---- powers (§5.7, Appendix A): the reveal, the windup, the strike, the consequence, the proclamation ----
   * Cause travels to effect: the actor's seat gathers itself (a ring closes on it) while the table dims to the
   * seats involved; the power's embodiment - a fin, a bell, a hook on its line, a shell, a club, the whale -
   * travels from the actor to what it acts on and lands ON the strike (E), with the effect's cue, the hit-stop
   * and the shake; the cards follow in its wake; a state it leaves behind (the stun, the shell) is inked when
   * it lands, not when the view arrives; and a banner says in words what happened. Everything here is read
   * from the public events: the power used is announced, and so are its actor, its target and the cards. */
  const used = events.find((e) => e.type === 'POWER_USED' && !SILENT_RANKS.has(e.rank));
  const E = used && !ascuns ? BEAT.effectOpen : BEAT.effect;
  const W = Math.max(0, E - TIME.windup);
  const via = used && used.type === 'POWER_USED' && used.viaClownfish ? 'clownfish' : undefined;
  if (used && used.type === 'POWER_USED') {
    if (ascuns) {
      // the plate flips at its owner's seat, then rises into the proclamation at the strike
      beat('reveal', { lane: 'hud', cls: 'medium', at: 0, dur: TIME.reveal, ops: [{ op: 'reveal', at: 0, owner: used.playerId, rank: used.rank }] });
    } else {
      beat('spent', { lane: 'hud', cls: 'light', at: 0, dur: 220, ops: [{ op: 'spent', at: 0, owner: used.playerId }] });
    }
  }
  const seat = (id: string): Anchor => ({ k: 'seat', id });
  const fx = (key: string, sprite: Sprite, from: Anchor, to: Anchor, start: number, land: number, o: Partial<Flight> = {}): Flight => ({ key: `${sprite}:${seq}:${key}`, what: 'fx', sprite, from, to, start, land, end: 'fade', ...o });
  let moments = 0;
  /** the power's moment: focus, charge, proclamation. One per step. */
  const moment = (rank: string, actor: string, involved: string[], callout: Omit<Callout, 'rank' | 'via'>): void => {
    if (moments++) return;
    const seats = [...new Set([actor, ...involved].filter(Boolean))];
    beat('power', {
      lane: 'hud', cls: 'heavy', at: W, dur: E + TIME.callout - W, anchor: 'table',
      ops: [
        { op: 'focus', at: W, until: E + TIME.focusHold, seats },
        { op: 'charge', at: W, seat: actor, rank },
        { op: 'callout', at: E, dur: TIME.callout, callout: { ...callout, rank, ...(via ? { via } : {}) } },
      ],
    });
  };
  const strikeJuice = (at: number, trauma: number, hit: number = TIME.powerStop, impact = true): Juice => ({ at, hitStopMs: hit, trauma, impact });
  for (const e of events) {
    switch (e.type) {
      case 'SHARK_JUMP': {
        const count = Math.max(1, Math.min(8, e.count ?? 2));
        const loser = e.fromId ?? e.loserId ?? '';
        const out = E + 90;
        beat('shark', {
          lane: 'table', cls: 'heavy', at: 0, dur: out + 420 + 40 * count + TIME.rest,
          flights: [
            // the fin cuts across the table to the seat that was just paid, low and fast
            fx('in', 'fin', seat(e.playerId), seat(loser), W + 40, E, { lift: 10, scale: [0.8, 1.2] }),
            // and drags the cards back in its wake
            fx('out', 'fin', seat(loser), seat(e.playerId), out, out + 400, { lift: 10, scale: [1.2, 0.9], mirror: true }),
            ...Array.from({ length: count }, (_, i) => ({ key: `shark:${seq}:${i}`, what: 'back', from: seat(loser), to: seat(e.playerId), start: out + 40 + i * 40, land: out + 420 + i * 40, lift: 12, index: i, end: 'vanish', toHand: e.playerId === me, fromHand: loser === me }) as Flight),
          ],
          vfx: [{ kind: 'jaws', at: E, anchor: seat(loser), size: 104 }, { kind: 'shockRing', at: E, anchor: seat(loser), size: 150 }, { kind: 'waterRing', at: out + 420, anchor: seat(e.playerId), size: 90 }],
          ops: [{ op: 'jolt', at: E, anchor: seat(loser) }],
          juice: strikeJuice(E, 0.75),
        });
        moment('shark', e.playerId, [loser], { kind: 'power', key: 'shark', actor: e.playerId, target: loser, count: e.count ?? count, cardRank: e.rank });
        break;
      }
      case 'LANTERNFISH_REFLECT': {
        const count = Math.max(0, Math.min(8, e.count ?? 2));
        const back = E + 200;
        beat('reflect', {
          lane: 'table', cls: 'heavy', at: 0, dur: back + 50 * count + TIME.effectFly + 120,
          flights: [
            // the lure rises over the asked seat and lights
            fx('lure', 'lantern', seat(e.playerId), { k: 'above', of: seat(e.playerId), dy: 46 }, W, E, { lift: 0, scale: [0.5, 1.25], straight: true }),
            // the ask comes back, mirrored, along the beam
            { key: `mirror:${seq}`, what: 'chip', rank: e.rank, from: seat(e.playerId), to: seat(e.fromId), start: E, land: E + 220, end: 'vanish', mirror: true },
            ...Array.from({ length: count }, (_, i) => ({ key: `reflect:${seq}:${i}`, what: 'back', from: seat(e.fromId), to: seat(e.playerId), start: back + i * 50, land: back + i * 50 + TIME.effectFly, index: i, lift: 8, end: 'vanish', toHand: e.playerId === me, fromHand: e.fromId === me }) as Flight),
          ],
          vfx: [{ kind: 'mirrorGlint', at: E, anchor: { k: 'above', of: seat(e.playerId), dy: 46 }, size: 110 }, { kind: 'shockRing', at: E + 220, anchor: seat(e.fromId), size: 110 }],
          ops: [{ op: 'tether', at: E - 60, dur: 260 + 50 * count + TIME.effectFly + 260, from: { k: 'above', of: seat(e.playerId), dy: 46 }, to: seat(e.fromId), style: 'beam' }, { op: 'jolt', at: E + 220, anchor: seat(e.fromId) }],
          juice: strikeJuice(E + 220, 0.5, 80, false),
        });
        moment('lanternfish', e.playerId, [e.fromId], { kind: 'power', key: count ? 'lanternfish' : 'lanternfishEmpty', actor: e.playerId, target: e.fromId, count, cardRank: e.rank });
        break;
      }
      case 'TORTOISE_BLOCK': {
        // "the cards drop back" (Appendix A): the public record does not say how many cards were about to move, so ONE
        // back lifts from the shell toward the asker, strikes the shell's rim and drops back - the same for any count
        const asker = before?.currentPlayerId ?? null;
        const drop: Flight[] =
          asker && asker !== e.playerId
            ? [
                { key: `lift:${seq}`, what: 'back', from: seat(e.playerId), to: { k: 'between', from: e.playerId, to: asker, t: 0.45 }, start: E + 60, land: E + 230, end: 'vanish' },
                { key: `drop:${seq}`, what: 'back', from: { k: 'between', from: e.playerId, to: asker, t: 0.45 }, to: seat(e.playerId), start: E + 270, land: E + 460, end: 'vanish' },
              ]
            : [];
        beat('block', {
          lane: 'table', cls: 'heavy', at: 0, dur: E + 520,
          // the shell drops out of the air onto the seat and clamps shut
          flights: [fx('drop', 'shell', { k: 'above', of: seat(e.playerId), dy: 120 }, seat(e.playerId), W + 60, E, { straight: true, scale: [1.7, 1] }), ...drop],
          vfx: [{ kind: 'shellClamp', at: E, anchor: seat(e.playerId), size: 104 }, { kind: 'shockRing', at: E, anchor: seat(e.playerId), size: 130 }, ...(drop.length ? [{ kind: 'dustPuff' as const, at: E + 230, anchor: { k: 'between' as const, from: e.playerId, to: asker!, t: 0.45 } }] : [])],
          masks: [{ target: 'shield', ref: e.playerId, until: E }],
          ops: [{ op: 'wobble', at: E, anchor: seat(e.playerId) }, { op: 'chipRelease', at: E + 300 }],
          juice: strikeJuice(E, 0.55, 90, false),
        });
        moment('tortoise', e.playerId, asker ? [asker] : [], { kind: 'guard', key: 'tortoise', actor: e.playerId, target: asker ?? undefined, cardRank: e.rank });
        break;
      }
      case 'JELLYFISH_STUN':
        beat('stun', {
          lane: 'table', cls: 'heavy', at: 0, dur: E + 520,
          // the bell drifts over the table and settles on its target: the sting, then the brand
          flights: [fx('drift', 'bell', seat(e.playerId), { k: 'above', of: seat(e.targetId), dy: 8 }, W, E, { lift: 60, scale: [0.6, 1.3] })],
          vfx: [{ kind: 'zap', at: E, anchor: seat(e.targetId), size: 110 }, { kind: 'bellStamp', at: E + 120, anchor: seat(e.targetId), size: 90 }],
          masks: [{ target: 'stun', ref: e.targetId, until: E }],
          ops: [{ op: 'jolt', at: E, anchor: seat(e.targetId) }, { op: 'brand', at: E + 120, anchor: seat(e.targetId) }],
          juice: strikeJuice(E, 0.6, 90),
        });
        moment('jellyfish', e.playerId, [e.targetId], { kind: 'power', key: 'jellyfish', actor: e.playerId, target: e.targetId });
        break;
      case 'STICKLEBACK_STEAL': {
        const count = Math.max(1, Math.min(8, e.count ?? 1));
        const yank = E + 90;
        beat('steal', {
          lane: 'table', cls: 'heavy', at: 0, dur: yank + 240 + 40 * count + TIME.rest,
          // the line is cast, the hook bites, and everything is yanked back straight along the line
          flights: [
            fx('cast', 'hook', seat(e.playerId), seat(e.targetId), W, E, { straight: true, scale: [0.7, 1.1] }),
            fx('yank', 'hook', seat(e.targetId), seat(e.playerId), yank, yank + 220, { straight: true, scale: [1.1, 0.7] }),
            ...Array.from({ length: count }, (_, i) => ({ key: `yank:${seq}:${i}`, what: 'back', from: seat(e.targetId), to: seat(e.playerId), start: yank + 20 + i * 40, land: yank + 240 + i * 40, index: i, end: 'vanish', straight: true, toHand: e.playerId === me, fromHand: e.targetId === me }) as Flight),
          ],
          vfx: [{ kind: 'barbedHook', at: E, anchor: seat(e.targetId), size: 96 }, { kind: 'shockRing', at: E, anchor: seat(e.targetId), size: 110 }],
          ops: [{ op: 'tether', at: W, dur: yank + 240 - W, from: seat(e.playerId), to: seat(e.targetId), style: 'line' }, { op: 'jolt', at: E, anchor: seat(e.targetId) }],
          juice: strikeJuice(E, 0.6, 90, false),
        });
        moment('stickleback', e.playerId, [e.targetId], { kind: 'power', key: 'stickleback', actor: e.playerId, target: e.targetId, count: e.count ?? count, cardRank: e.rank });
        break;
      }
      case 'STICKLEBACK_WASTED':
        // a cast that catches nothing: the hook lands in dust, the line goes slack, the hook sinks
        beat('miss', {
          lane: 'table', cls: 'medium', at: 0, dur: E + 520,
          flights: [fx('cast', 'hook', seat(e.playerId), seat(e.targetId), W, E, { straight: true, scale: [0.7, 1.1] }), fx('sink', 'hook', seat(e.targetId), { k: 'above', of: seat(e.targetId), dy: -34 }, E + 160, E + 480, { straight: true, scale: [1.1, 0.8] })],
          vfx: [{ kind: 'dustPuff', at: E, anchor: seat(e.targetId), size: 80 }],
          ops: [{ op: 'tether', at: W, dur: E + 420 - W, from: seat(e.playerId), to: seat(e.targetId), style: 'slack' }],
          juice: { at: E, trauma: 0.25 },
        });
        moment('stickleback', e.playerId, [e.targetId], { kind: 'miss', key: 'sticklebackMiss', actor: e.playerId, target: e.targetId, cardRank: e.rank });
        break;
      case 'SET_DESTROYED': {
        const owner = e.ownerId ?? laidSetOf(before, e.setId)?.ownerId;
        const by = e.byPlayerId;
        const at: Anchor = owner ? { k: 'set', owner, id: e.setId } : { k: 'center' };
        beat('mantis', {
          lane: 'table', cls: 'heavy', at: 0, dur: E + 480,
          // the club is thrown from the mantis's seat and smashes the new set: hit-stop, an impact frame, splinters; the crack stays
          flights: by ? [fx('club', 'club', seat(by), at, W, E, { lift: 70, scale: [0.7, 1.5] })] : [],
          masks: [{ target: 'crack', ref: e.setId, until: E }],
          ops: [{ op: 'crack', at: E, setId: e.setId, owner }, ...(owner ? [{ op: 'jolt' as const, at: E, anchor: seat(owner) }] : [])],
          vfx: [{ kind: 'woodChips', at: E, anchor: at, size: 110 }, { kind: 'shockRing', at: E, anchor: at, size: 160 }],
          juice: strikeJuice(E, 0.85, 130),
        });
        if (by) moment('mantisShrimp', by, owner ? [owner] : [], { kind: 'power', key: 'mantis', actor: by, target: owner });
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
        const spiral: Flight[] = Array.from({ length: total }, (_, i) => ({ key: `spiral:${seq}:${i}`, what: 'back', from: seat(i < sizeA ? a : b), to: { k: 'center' }, start: E + i * 25, land: E + 380 + i * 25, index: i, end: 'stay', fromHand: (i < sizeA ? a : b) === me }) as Flight);
        const redeal: Flight[] = [
          ...Array.from({ length: outA }, (_, i) => ({ key: `redeal:${seq}:a:${i}`, what: 'back', from: { k: 'center' }, to: seat(a), start: E + 760 + i * 30, land: E + 1040 + i * 30, index: i, end: 'vanish', toHand: a === me }) as Flight),
          ...Array.from({ length: outB }, (_, i) => ({ key: `redeal:${seq}:b:${i}`, what: 'back', from: { k: 'center' }, to: seat(b), start: E + 790 + i * 30, land: E + 1070 + i * 30, index: i, end: 'vanish', toHand: b === me }) as Flight),
        ];
        beat('whale', {
          lane: 'table', cls: 'heavy', at: 0, dur: E + 1070 + 30 * Math.max(outA, outB) + TIME.rest,
          // the whale breaches from one seat to the other, over the pond; the two hands are swallowed into its spiral
          // it dives from one seat into the pond, swallowing both hands into its spiral, and surfaces at the other
          flights: [fx('dive', 'whale', seat(a), { k: 'center' }, W, E + 380, { lift: 30, scale: [0.6, 1.25] }), fx('rise', 'whale', { k: 'center' }, seat(b), E + 460, E + 900, { lift: 30, scale: [1.25, 0.6] }), ...spiral, ...redeal],
          vfx: [{ kind: 'shockRing', at: E + 380, anchor: { k: 'center' }, size: 190 }, { kind: 'spiralChips', at: E + 400, anchor: { k: 'center' }, size: 120 }, { kind: 'waterRing', at: E + 420, anchor: { k: 'center' }, size: 170 }],
          ops: [{ op: 'tether', at: W, dur: E + 1100 - W, from: seat(a), to: seat(b), style: 'wake' }, { op: 'jolt', at: E, anchor: seat(a) }, { op: 'jolt', at: E, anchor: seat(b) }],
          juice: strikeJuice(E + 420, 0.7, 100),
        });
        moment('whale', e.playerId, [a, b], { kind: 'power', key: 'whale', actor: e.playerId, target: a, other: b });
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
  for (const b of beats) if (b.kind === 'end' && podiumAt !== null) b.cues = b.cues.map((c) => (c.id.startsWith('mus.end') ? { ...c, at: podiumAt! } : c.id === 'table.tally' ? { ...c, at: podiumAt! + c.at } : c));

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
