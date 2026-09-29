/* Haptics (§3.11): Android Chrome only (`navigator.vibrate`), every haptic has an audio or
 * visual twin and its own toggle. Two tiers: public patterns, and the private one - a window where
 * you are eligible - which is opt-in until the desk test picks a pattern per motor class, because
 * a phone buzzing on a desk is audible to a laptop microphone (§3.2). Squid: none.
 *
 * `hapticsFor` is pure and, like `cuesFor`, a function of the public record and the seat's public
 * facts (plus the private tier, gated by its toggle); `playHaptics` is the only side effect.
 */

import { BEAT, raceOf, type PublicRecord, type SeatFacts } from './cues.js';

export type HapticTier = 'public' | 'private';

export interface HapticRequest {
  signal: string;
  /** navigator.vibrate pattern: vibrate, pause, vibrate... in ms */
  pattern: number[];
  tier: HapticTier;
  /** ms from the moment the step is presented */
  at: number;
}

/** §3.11 */
export const PATTERNS = {
  yourTurn: [16],
  youWereAsked: [12, 60, 12],
  /** placeholder until the desk test sets it per motor class */
  eligible: [8, 50, 8],
  cardLands: [6],
  cardsTaken: [30],
  stunned: [40],
  setDestroyed: [20, 30, 40],
  whale: [20],
  /** you take the lead, or put yourself out of reach */
  lead: [14, 50, 28],
} as const;

export function hapticsFor(record: PublicRecord, facts: SeatFacts): HapticRequest[] {
  const me = facts.playerId;
  const { before, after, events } = record;
  const out: HapticRequest[] = [];
  const add = (signal: string, pattern: readonly number[], at = 0, tier: HapticTier = 'public') => out.push({ signal, pattern: [...pattern], at, tier });

  const bonus = new Set(events.filter((e) => e.type === 'BONUS_TURN').map((e) => (e as { playerId: string }).playerId));
  const base = events.some((e) => e.type === 'GAME_STARTED') ? BEAT.start : BEAT.turn;
  let turnSlot = 0; // the same stops as cuesFor: each seat the totem visits waits for the last one
  // a power's effect is felt on its strike: after the reveal in Ascuns, sooner in Deschis (cuesFor's rule)
  const powered = events.some((e) => e.type === 'POWER_USED' && e.rank !== 'squid');
  const S = powered && record.mode !== 'ascuns' ? BEAT.effectOpen : BEAT.effect;
  for (const e of events) {
    switch (e.type) {
      case 'TURN_STARTED': {
        if (bonus.has(e.playerId)) break;
        const at = base + BEAT.turnGap * turnSlot++;
        if (e.playerId === me) add('yourTurn', PATTERNS.yourTurn, at);
        break;
      }
      case 'TURN_SKIPPED_STUNNED': {
        const at = base + BEAT.turnGap * turnSlot++;
        if (e.playerId === me) add('stunned', PATTERNS.stunned, at);
        break;
      }
      case 'HAND_REFILLED':
        if (e.playerId === me) add('cardLands', PATTERNS.cardLands);
        break;
      case 'DREW_FROM_POOL':
        if (e.playerId === me) add('cardLands', PATTERNS.cardLands, 600);
        break;
      case 'REQUEST_SUCCEEDED':
        if (e.targetId === me) add('cardsTaken', PATTERNS.cardsTaken, 450);
        if (e.askerId === me) add('cardLands', PATTERNS.cardLands, 450);
        break;
      case 'SHARK_JUMP':
        // the engine's SHARK_JUMP names the player the cards were jumped away from as `fromId`
        if ((e.fromId ?? e.loserId) === me) add('cardsTaken', PATTERNS.cardsTaken, S);
        break;
      case 'LANTERNFISH_REFLECT':
        if (e.fromId === me) add('cardsTaken', PATTERNS.cardsTaken, S);
        break;
      case 'STICKLEBACK_STEAL':
        if (e.targetId === me) add('cardsTaken', PATTERNS.cardsTaken, S);
        break;
      case 'JELLYFISH_STUN':
        if (e.targetId === me) add('stunned', PATTERNS.stunned, S);
        break;
      case 'SET_DESTROYED':
        if (e.ownerId === me) add('setDestroyed', PATTERNS.setDestroyed, S);
        break;
      case 'WHALE_SHUFFLE':
        if (e.playerId === me || e.targetAId === me || e.targetBId === me) add('whale', PATTERNS.whale, S);
        break;
      default:
        break; // Squid has no event and no haptic
    }
  }
  const race = raceOf(record);
  if ((race === 'lead' || race === 'clinch' || race === 'breakaway') && after.scores) {
    const top = Math.max(...Object.values(after.scores));
    if ((after.scores[me] ?? 0) === top && Object.values(after.scores).filter((v) => v === top).length === 1) add('lead', PATTERNS.lead, BEAT.lead);
  }
  const w = after.window;
  const was = before?.window;
  const answering = w && w.type === 'RESPONSE_PENDING' && w.targetId === me && !(was && was.type === 'RESPONSE_PENDING' && was.targetId === w.targetId && was.askerId === w.askerId);
  if (answering) add('youWereAsked', PATTERNS.youWereAsked, 340);
  // private tier: a structural window where you are eligible
  if (w && w.type !== 'RESPONSE_PENDING' && facts.eligible && !facts.eligibleBefore) add('eligible', PATTERNS.eligible, 0, 'private');
  return out.sort((a, b) => a.at - b.at);
}

/* ------------------------------------------------------------------ playback */

export interface HapticSettings {
  public: boolean;
  /** opt-in until the desk test (§9.3) */
  private: boolean;
}
const KEY = 'pescuit:haptics';
let settings: HapticSettings | null = null;

export function hapticSettings(): HapticSettings {
  if (!settings) {
    settings = { public: true, private: false };
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const j = JSON.parse(raw) as Partial<HapticSettings>;
        settings = { public: j.public !== false, private: j.private === true };
      }
    } catch {
      /* blocked storage: defaults */
    }
  }
  return settings;
}

export function setHapticSettings(patch: Partial<HapticSettings>): void {
  settings = { ...hapticSettings(), ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    /* session only */
  }
}

/** Only Android Chrome has a usable motor (iOS Safari has none; desktop Chrome has the API and no motor). */
export function hapticsSupported(): boolean {
  try {
    return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function' && /Android/i.test(navigator.userAgent);
  } catch {
    return false;
  }
}

export function vibrate(pattern: readonly number[]): boolean {
  if (!hapticsSupported()) return false;
  try {
    return navigator.vibrate([...pattern]);
  } catch {
    return false;
  }
}

/** Fires a step's haptics through the per-tier toggles. `delayMs` is the presentation delay. */
export function playHaptics(reqs: readonly HapticRequest[], delayMs = 0): void {
  const s = hapticSettings();
  for (const r of reqs) {
    if (r.tier === 'public' ? !s.public : !s.private) continue;
    const go = () => vibrate(r.pattern);
    const wait = delayMs + r.at;
    if (wait <= 0) go();
    else setTimeout(go, wait);
  }
}
