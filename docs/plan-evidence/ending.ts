// How do games actually end, and what would the §11.2 rule change? Compares the engine's
// random bots with memory bots (membot.ts), in Mode Ascuns, at 3–6 players. Reports:
// - how games end (every real card laid, or the no-progress streak of 2N asks that capture
//   or draw nothing), real cards left at the end, when the pool runs dry, the dry share of
//   go-fish, and the final run of misses;
// - the §11.2 check, computed from the public record only: how often it fires before the
//   end, how many asks it removes, and two guards that must read 0 — sets laid after it
//   fires, and moments where the public count fell below the truth;
// - the same for the omniscient check (v3's, which leaks), to show what secrecy costs;
// - the public countdown "sets still possible" as a clock: where in the game it passes
//   12, 6, 3 and 1, and how often the last set is announced (the count passes through 1).
// Run from this directory: npx tsx ending.ts
import { play } from './membot.ts';

const q = (a: number[], p: number) => (a.length ? a.slice().sort((x, y) => x - y)[Math.min(a.length - 1, Math.floor(a.length * p))] : NaN);
const med = (a: number[]) => q(a, 0.5);
const pct = (x: number) => `${Math.round(x * 100)}%`;
const GAMES = 300;
const MARKS = [12, 6, 3, 1];

for (const memory of [false, true]) {
  console.log(memory ? '\nMEMORY BOTS (learn only what the public record reveals)' : "RANDOM BOTS (the engine's own)");
  for (const n of [3, 4, 5, 6]) {
    let exhausted = 0, fails = 0, dryFails = 0, laidLate = 0, below = 0, fired = 0, firedTrue = 0, announced = 0;
    const left: number[] = [], dryAt: number[] = [], finalRun: number[] = [], dead: number[] = [], deadTrue: number[] = [], kAtDry: number[] = [];
    const at: number[][] = MARKS.map(() => []);
    for (let i = 0; i < GAMES; i++) {
      const g = play(n, 31000 + i, memory);
      const realLeft = g.state.players.reduce((s, p) => s + p.hand.filter((c) => c.rank !== 'eggs').length, 0);
      left.push(realLeft);
      if (realLeft === 0) exhausted++;
      let turn = 0, dry = false;
      for (const e of g.events) {
        if (e.type === 'TURN_STARTED') turn++;
        if (e.type === 'DREW_FROM_POOL' && e.poolEmpty && !dry) {
          dry = true;
          dryAt.push(turn / g.turns);
          kAtDry.push(g.clock.find(([t]) => t >= turn)?.[1] ?? 0);
        }
        if (e.type === 'REQUEST_FAILED') {
          fails++;
          if (dry) dryFails++;
        }
      }
      finalRun.push(g.streaks[g.streaks.length - 1] ?? 0);
      laidLate += g.laidAfterDecided;
      below += g.publicBelowTrue;
      if (g.decidedAt !== null) fired++;
      if (g.decidedTrueAt !== null) firedTrue++;
      dead.push(g.deadAsks);
      deadTrue.push(g.deadAsksTrue);
      // the countdown, on the game's length under §11.2
      const end = g.decidedAt ?? g.turns;
      MARKS.forEach((m, j) => {
        const hit = g.clock.find(([, k]) => k <= m);
        if (hit && hit[0] <= end) at[j].push(hit[0] / end);
      });
      if (g.decidedAt !== null && g.clock.some(([t, k]) => k === 1 && t <= g.decidedAt!)) announced++;
    }
    console.log(
      `  ${n}p: ends with every real card laid ${pct(exhausted / GAMES)} | real cards left median ${med(left)} (p90 ${q(left, 0.9)}) | ` +
        `pool dry at ${pct(med(dryAt))} of turns | go-fish on a dry pool ${pct(dryFails / fails)} | final miss run median ${med(finalRun)} (limit ${2 * n})`,
    );
    console.log(
      `      §11.2, public check: fires before the end in ${pct(fired / GAMES)} of games; asks it removes: median ${med(dead)} (p90 ${q(dead, 0.9)}) | ` +
        `guards: sets laid after it fires ${laidLate}, public count below the truth ${below}`,
    );
    console.log(
      `      omniscient check (leaks): fires in ${pct(firedTrue / GAMES)}; asks it would remove: median ${med(deadTrue)} (p90 ${q(deadTrue, 0.9)})`,
    );
    console.log(
      `      countdown: 18 sets at the start, median ${med(kAtDry)} when the pool runs dry | share of the game when it first reaches ` +
        MARKS.map((m, j) => `≤${m}: ${pct(q(at[j], 0.1))}–${pct(q(at[j], 0.9))} (median ${pct(med(at[j]))})`).join(', ') +
        ` | the last set announced (count passes 1) in ${pct(announced / Math.max(1, fired))} of decided games`,
    );
  }
}
