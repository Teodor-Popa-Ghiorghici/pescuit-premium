// How do games actually end? Compares the engine's random bots with memory bots
// (membot.ts). Reports, per player count: how games end (every real card laid, or the
// no-progress streak of 2N asks that capture or draw nothing), real cards left at the end,
// when the pool runs dry, how often the streak builds and resets in the dry second act,
// the final run of misses, and how many asks are played after the score is already final.
// Run from this directory: npx tsx ending.ts
import { play } from './membot.ts';

const med = (a: number[]) => a.slice().sort((x, y) => x - y)[Math.floor(a.length / 2)] ?? 0;
const p90 = (a: number[]) => a.slice().sort((x, y) => x - y)[Math.floor(a.length * 0.9)] ?? 0;
const pct = (x: number) => `${Math.round(x * 100)}%`;
const GAMES = 300;

for (const memory of [false, true]) {
  console.log(memory ? '\nMEMORY BOTS (remember what every public event reveals)' : 'RANDOM BOTS (the engine\'s own)');
  for (const n of [3, 4, 5, 6]) {
    let exhausted = 0;
    const left: number[] = [], dryAt: number[] = [], finalRun: number[] = [], resets: number[] = [], act2: number[] = [], deadAsks: number[] = [], turnsAll: number[] = [];
    let fails = 0, dryFails = 0, successes = 0, asks = 0, laidLate = 0, withDead = 0;
    for (let i = 0; i < GAMES; i++) {
      const { state, events, streaks, deadAsks: da, laidAfterDecided } = play(n, 31000 + i, memory);
      deadAsks.push(da);
      laidLate += laidAfterDecided;
      if (da > 0) withDead++;
      const realLeft = state.players.reduce((s, p) => s + p.hand.filter((c) => c.rank !== 'eggs').length, 0);
      left.push(realLeft);
      if (realLeft === 0) exhausted++;
      const turns = events.filter((e) => e.type === 'TURN_STARTED').length;
      turnsAll.push(turns);
      let turn = 0, dry = false, dryTurn = turns;
      for (const e of events) {
        if (e.type === 'TURN_STARTED') turn++;
        if (e.type === 'DREW_FROM_POOL' && e.poolEmpty && !dry) {
          dry = true;
          dryTurn = turn;
          dryAt.push(turn / turns);
        }
        if (e.type === 'REQUEST_MADE') asks++;
        if (e.type === 'REQUEST_SUCCEEDED') successes++;
        if (e.type === 'REQUEST_FAILED') {
          fails++;
          if (dry) dryFails++;
        }
      }
      let resetCount = 0;
      for (let k = 1; k < streaks.length; k++) if (streaks[k] < streaks[k - 1] && streaks[k - 1] >= n) resetCount++;
      const streak = streaks[streaks.length - 1] ?? 0;
      finalRun.push(streak);
      resets.push(resetCount);
      act2.push((turns - dryTurn) / turns);
    }
    console.log(
      `  ${n}p: ends with every real card laid ${pct(exhausted / GAMES)} | real cards left median ${med(left)} (p90 ${p90(left)}) | ` +
        `ask success ${pct(successes / asks)} | pool dry at ${pct(med(dryAt))} of turns; dry act = ${pct(med(act2))} | ` +
        `go-fish on a dry pool ${pct(dryFails / fails)} | final miss run median ${med(finalRun)} (limit ${2 * n}) | ` +
        `streak reached ≥${n} then reset: median ${med(resets)}×/game | turns median ${med(turnsAll)} | ` +
        `asks after the score was already final: median ${med(deadAsks)} (p90 ${p90(deadAsks)}), in ${pct(withDead / GAMES)} of games | ` +
        `sets laid or destroyed after the check fired: ${laidLate}`,
    );
  }
}
