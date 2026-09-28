// Which clock should the session's audio-visual arc follow? The pool empties early in
// big games, so this measures, per player count: when the pool runs dry (as a fraction
// of the game's turns), how many go-fish outcomes land on an empty pool, and how the
// count of real cards still in play (60 minus real cards laid) falls over the game.
// Run from this directory: npx tsx arc.ts
import { playRandomGame } from '../../packages/engine/src/cli/playGame.ts';

const GAMES = 300;
const med = (a: number[]) => a.slice().sort((x, y) => x - y)[Math.floor(a.length / 2)] ?? 0;
const pct = (x: number) => `${Math.round(x * 100)}%`;

for (const n of [3, 4, 5, 6]) {
  const dryAt: number[] = [];
  let failsDry = 0;
  let failsTotal = 0;
  // real cards remaining at 25/50/75% of the game's turns
  const remainingAt: number[][] = [[], [], []];
  for (let i = 0; i < GAMES; i++) {
    const ids = Array.from({ length: n }, (_, j) => `P${j + 1}`);
    const { events } = playRandomGame(ids, 21000 + i, 50000 + i * 29, { powerVisibility: 'ascuns' });
    const turnsTotal = events.filter((e) => e.type === 'TURN_STARTED').length;
    let turn = 0;
    let poolEmpty = false;
    let realLaid = 0;
    const marks = [0.25, 0.5, 0.75].map((f) => Math.round(f * turnsTotal));
    let markIdx = 0;
    for (const e of events) {
      if (e.type === 'TURN_STARTED') {
        turn++;
        while (markIdx < marks.length && turn >= marks[markIdx]) {
          remainingAt[markIdx].push(60 - realLaid);
          markIdx++;
        }
      }
      if (e.type === 'DREW_FROM_POOL' && e.poolEmpty && !poolEmpty) {
        poolEmpty = true;
        dryAt.push(turn / turnsTotal);
      }
      if (e.type === 'REQUEST_FAILED') {
        failsTotal++;
        if (poolEmpty) failsDry++;
      }
      if (e.type === 'SET_LAID') {
        const size = e.rank === 'eggs' ? 4 : e.isPowerSet ? 4 : 3;
        realLaid += e.rank === 'eggs' ? 0 : size - e.eggCount;
      }
    }
  }
  console.log(
    `${n}p: pool dry at median ${pct(med(dryAt))} of the game; ${pct(failsDry / failsTotal)} of go-fish land on a dry pool; ` +
      `real cards in play at 25/50/75% of turns: ${remainingAt.map((a) => med(a)).join(' / ')} (of 60)`,
  );
}
