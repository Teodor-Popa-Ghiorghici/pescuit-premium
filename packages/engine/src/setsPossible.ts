// "Sets still possible" — the public tally of FEEL_VISUAL_SOUND_PLAN §3.9, and the input of the
// §11.2 end rule ("decided"). Reference algorithms: docs/plan-evidence/membot.ts, ending.ts.
//
// THE ONE RULE: the only input is what a spectator holding no cards already knows. No hand, no
// pool order, no hidden rank. That is what makes the value — and the moment it reaches 0 — the
// same in any two games with the same public record (the "endgame pair", endcheck.ts).
//
// WHAT IT COMPUTES. The most sets that ANY assignment of ranks to the face-down power sets
// consistent with the public record could still yield, if every card not yet laid — in hands and
// in the pool — could be gathered into one hand. Two consequences:
//
//  * It is an UPPER BOUND on the sets that can really still be laid: it ignores who holds what,
//    the turn order and every rule of play. It is therefore SAFE — 0 means no set can ever be laid
//    again, so ending the game there can never cut a game that could still change — but it is
//    not exact. A game can sit at k > 0 with nothing left to lay (a stall) and end on the 2N
//    streak rule instead. Copy that shows the number must say "at most k sets", never "k sets".
//  * It never rises in Mode Ascuns (a face-down set only ever turns face up, which can only
//    remove options) and, with the rank rule below, not in Mode Deschis either.
//
// WHEN IS A LAID SET'S RANK PUBLIC? (`isRankPublic`)
//  * Ascuns: exactly while it is face up (`faceUp` only ever goes false -> true there: a power
//    set is laid face down, and turns face up when used or destroyed — except Squid, which never
//    does).
//  * Deschis: always. Every set is laid face up, so its rank is in the public SET_LAID event.
//    A used power set turns face down for display (RULES §4) and the redacted view then omits
//    the rank, but the rank was already public and forgetting it would only loosen the bound
//    (round-4 review: the count rose 13 times in 300 Deschis games). Reading it back is not a
//    hidden read: it comes from the public record, not from the server's secrets.
//
// Real and egg counts of a laid set are public for every set, face down or not (redact.ts).

import { EGG_COUNT, NORMAL_COPIES, POWER_COPIES } from './deck.js';
import { EGGS, GameState, LaidSet, NORMAL_RANKS, POWER_RANKS, Rank } from './types.js';

/** What anyone at the table knows about one laid set. */
export interface PublicSetFact {
  /** the rank, or null while it is not public */
  rank: Rank | null;
  /** real (non-egg) cards in the set */
  reals: number;
  eggs: number;
}

/** Whether the spectator can read this set's rank (see the header comment). */
export function isRankPublic(state: Pick<GameState, 'config'>, set: LaidSet): boolean {
  return state.config.powerVisibility === 'deschis' || set.faceUp;
}

/**
 * The spectator's facts about every laid set — the end check's only input. It is built from the
 * same fields `redactForSpectator` publishes (owner and set ids are irrelevant to the count).
 */
export function publicSetFacts(state: Pick<GameState, 'config' | 'laidSets'>): PublicSetFact[] {
  return state.laidSets.map((s) => ({
    rank: isRankPublic(state, s) ? s.rank : null,
    reals: s.cardIds.length - s.eggCount,
    eggs: s.eggCount,
  }));
}

/** The most sets one rank can still make from `real` cards and at most `eggs` eggs. A normal set
 *  is 3 real or 2 real + 1 egg; a power set is 4 real, 3 + 1 egg or 2 + 2 eggs. */
function fromRank(power: boolean, real: number, eggs: number): number {
  let best = 0;
  if (power) {
    for (let c = 0; 2 * c <= Math.min(real, eggs); c++)
      for (let b = 0; 2 * c + 3 * b <= real && 2 * c + b <= eggs; b++)
        best = Math.max(best, c + b + Math.floor((real - 2 * c - 3 * b) / 4));
  } else {
    for (let b = 0; 2 * b <= real && b <= eggs; b++) best = Math.max(best, b + Math.floor((real - 2 * b) / 3));
  }
  return best;
}

/**
 * Sets still possible, from the public record only. See the header for the exact meaning.
 *
 * Malformed input (a set with fewer than 2 or more than 4 real cards; only hand-built test
 * states have those) is ignored rather than trusted: dropping a constraint can only raise the
 * bound, so a garbled record never ends a game early.
 */
export function setsPossible(laid: readonly PublicSetFact[]): number {
  let eggsLeft = EGG_COUNT;
  const used = new Map<string, number>();
  const hidden = [0, 0, 0]; // face-down sets holding 2, 3 and 4 real cards
  for (const l of laid) {
    eggsLeft -= l.eggs;
    if (l.rank === EGGS) continue;
    if (l.reals < 2 || l.reals > POWER_COPIES) continue;
    if (l.rank === null) hidden[l.reals - 2]++;
    else used.set(l.rank, (used.get(l.rank) ?? 0) + l.reals);
  }
  eggsLeft = Math.max(0, eggsLeft);

  // Normal sets are always face up: normal[e] = the most normal sets using at most e eggs.
  let normal: number[] = new Array(eggsLeft + 1).fill(0);
  for (const r of NORMAL_RANKS) {
    const real = Math.max(0, NORMAL_COPIES - (used.get(r) ?? 0));
    const prev = normal;
    normal = prev.map((_, e) => {
      let best = 0;
      for (let k = 0; k <= e; k++) best = Math.max(best, prev[e - k] + fromRank(false, real, k));
      return best;
    });
  }

  // Power ranks: every face-down set must sit on some rank with room for its real cards.
  const memo = new Map<string, number>();
  const power = (i: number, h2: number, h3: number, h4: number, e: number): number => {
    if (i === POWER_RANKS.length) return h2 + h3 + h4 === 0 ? 0 : -Infinity;
    const key = `${i},${h2},${h3},${h4},${e}`;
    const seen = memo.get(key);
    if (seen !== undefined) return seen;
    const room = Math.max(0, POWER_COPIES - (used.get(POWER_RANKS[i]) ?? 0));
    let best = -Infinity;
    for (let x2 = 0; x2 <= h2; x2++)
      for (let x3 = 0; x3 <= h3; x3++)
        for (let x4 = 0; x4 <= h4; x4++) {
          const placed = 2 * x2 + 3 * x3 + 4 * x4;
          if (placed > room) continue;
          for (let k = 0; k <= e; k++) {
            const rest = power(i + 1, h2 - x2, h3 - x3, h4 - x4, e - k);
            if (rest === -Infinity) continue;
            best = Math.max(best, fromRank(true, room - placed, k) + rest);
          }
        }
    memo.set(key, best);
    return best;
  };

  let best = 0;
  let placeable = false;
  for (let eP = 0; eP <= eggsLeft; eP++) {
    const p = power(0, hidden[0], hidden[1], hidden[2], eP);
    if (p === -Infinity) continue;
    placeable = true;
    for (let eN = 0; eP + eN <= eggsLeft; eN++) {
      best = Math.max(best, p + normal[eN] + Math.floor((eggsLeft - eP - eN) / 4));
    }
  }
  if (!placeable) {
    // The face-down sets fit on no rank: the record is impossible (only a hand-built state can
    // get here). Return a bound that ignores them and lets every rank use every egg: larger
    // than any honest answer, so it can never end a game.
    let loose = normal[eggsLeft] + Math.floor(eggsLeft / 4);
    for (const r of POWER_RANKS) loose += fromRank(true, Math.max(0, POWER_COPIES - (used.get(r) ?? 0)), eggsLeft);
    return loose;
  }
  return best;
}

/** The tally at the start of a game: 18. */
export const SETS_AT_START: number = setsPossible([]);

/** The public count for a state — what every viewer's `sets.possible` shows. */
export function publicSetsPossible(state: Pick<GameState, 'config' | 'laidSets'>): number {
  return setsPossible(publicSetFacts(state));
}
