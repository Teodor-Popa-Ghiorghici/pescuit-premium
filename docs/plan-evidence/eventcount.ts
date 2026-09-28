// How many events does a full game emit, and when does the client's 300-event cap bite?
import { playRandomGame } from '../../packages/engine/src/cli/playGame.ts';

const CAP = 300;
for (const n of [3, 4, 5, 6]) {
  const totals: number[] = [];
  const turnsAtCap: number[] = [];
  const turnTotals: number[] = [];
  let over = 0;
  for (let i = 0; i < 200; i++) {
    const ids = Array.from({ length: n }, (_, j) => `P${j + 1}`);
    const { events } = playRandomGame(ids, 7000 + i, 90000 + i * 13, { powerVisibility: 'ascuns' });
    totals.push(events.length);
    const turnIdx = events.map((e, k) => (e.type === 'TURN_STARTED' ? k : -1)).filter((k) => k >= 0);
    turnTotals.push(turnIdx.length);
    if (events.length > CAP) {
      over++;
      turnsAtCap.push(turnIdx.filter((k) => k < CAP).length);
    }
  }
  const med = (a: number[]) => a.slice().sort((x, y) => x - y)[Math.floor(a.length / 2)] ?? 0;
  console.log(
    `${n}p: median events/game ${med(totals)}, median turns/game ${med(turnTotals)}, games over ${CAP}: ${over}/200, ` +
      `median turn at which the cap is hit: ${med(turnsAtCap)} (of ${med(turnTotals)})`,
  );
}
