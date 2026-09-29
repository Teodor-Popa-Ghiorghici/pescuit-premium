// Test 3 of FEEL_VISUAL_SOUND_PLAN §6.5 — the end check is safe. Over seeded bot games:
//  * the public count is never below the true count (the most sets the cards really left could
//    form if every unlaid card were gathered into one hand), after every action;
//  * it never rises (the Mode Deschis fix: a used power set turns face down, its rank stays counted);
//  * the game is never left at rest with a count of 0 (no set is ever laid after 0);
//  * a game that ends "decided" really has nothing left to lay.
import { describe, expect, it } from 'vitest';
import { makeBotRng, nextBotAction } from '../src/cli/bot.js';
import { EGG_COUNT, NORMAL_COPIES, POWER_COPIES } from '../src/deck.js';
import { createGame, reduce } from '../src/engine.js';
import { publicSetsPossible } from '../src/setsPossible.js';
import { EGGS, GameState, NORMAL_RANKS, POWER_RANKS, Rank } from '../src/types.js';

/** Independent of setsPossible.ts: enumerates set kinds instead of using its closed form. */
function trueMax(state: GameState): number {
  const left = new Map<Rank, number>();
  for (const r of [...POWER_RANKS, ...NORMAL_RANKS]) left.set(r, POWER_RANKS.includes(r as never) ? POWER_COPIES : NORMAL_COPIES);
  let eggs = EGG_COUNT;
  for (const s of state.laidSets) {
    eggs -= s.eggCount;
    if (s.rank !== EGGS) left.set(s.rank, (left.get(s.rank) ?? 0) - (s.cardIds.length - s.eggCount));
  }
  const ranks = [...left.keys()];
  const memo = new Map<string, number>();
  const go = (i: number, e: number): number => {
    if (i === ranks.length) return Math.floor(e / 4); // pure eggs sets with what nobody else used
    const key = `${i},${e}`;
    const hit = memo.get(key);
    if (hit !== undefined) return hit;
    const real = left.get(ranks[i])!;
    const power = (POWER_RANKS as readonly string[]).includes(ranks[i]);
    let best = 0;
    if (power) {
      // t4: 4 real; t3: 3 real + 1 egg; t2: 2 real + 2 eggs
      for (let t2 = 0; t2 * 2 <= real && t2 * 2 <= e; t2++)
        for (let t3 = 0; t2 * 2 + t3 * 3 <= real && t2 * 2 + t3 <= e; t3++) {
          const t4 = Math.floor((real - t2 * 2 - t3 * 3) / 4);
          best = Math.max(best, t2 + t3 + t4 + go(i + 1, e - t2 * 2 - t3));
        }
    } else {
      // t3: 3 real; t2: 2 real + 1 egg
      for (let t2 = 0; t2 * 2 <= real && t2 <= e; t2++) {
        const t3 = Math.floor((real - t2 * 2) / 3);
        best = Math.max(best, t2 + t3 + go(i + 1, e - t2));
      }
    }
    memo.set(key, best);
    return best;
  };
  return go(0, Math.max(0, eggs));
}

function playChecked(n: number, seed: number, mode: 'ascuns' | 'deschis') {
  const ids = Array.from({ length: n }, (_, j) => `P${j + 1}`);
  let { state } = createGame(ids.map((id) => ({ id, name: id })), seed, { powerVisibility: mode });
  const rng = makeBotRng(seed * 13 + 5);
  let last = publicSetsPossible(state);
  let steps = 0;
  const problems: string[] = [];
  for (; state.status === 'IN_PROGRESS' && steps < 20000; steps++) {
    const action = nextBotAction(state, rng);
    if (!action) break;
    state = reduce(state, action).state;
    const pub = publicSetsPossible(state);
    const truth = trueMax(state);
    if (pub < truth) problems.push(`step ${steps}: public ${pub} below true ${truth}`);
    if (pub > last) problems.push(`step ${steps}: count rose ${last} -> ${pub}`);
    if (state.status === 'IN_PROGRESS' && state.pendingWindow === null && pub === 0) problems.push(`step ${steps}: at rest with 0`);
    last = pub;
  }
  if (state.status === 'ENDED' && state.endReason === 'decided') {
    if (trueMax(state) !== 0) problems.push('ended decided with a set still formable');
    if (publicSetsPossible(state) !== 0) problems.push('ended decided with a non-zero count');
  }
  return { state, problems };
}

describe('the end check is safe (test 3)', () => {
  it('holds over seeded bot games in both modes at 3-6 players', () => {
    const reasons: Record<string, number> = { decided: 0, streak: 0, exhausted: 0 };
    let games = 0;
    for (const mode of ['ascuns', 'deschis'] as const) {
      for (let n = 3; n <= 6; n++) {
        for (let i = 0; i < 12; i++) {
          const { state, problems } = playChecked(n, 40000 + n * 100 + i, mode);
          expect(problems, `${mode} ${n}p seed ${40000 + n * 100 + i}`).toEqual([]);
          expect(state.status).toBe('ENDED');
          reasons[state.endReason!]++;
          games++;
        }
      }
    }
    expect(games).toBe(96);
    // the rule fires in practice, and the older rules still end the rest
    expect(reasons.decided).toBeGreaterThan(5);
    expect(reasons.streak).toBeGreaterThan(0);
  }, 120_000);
});
