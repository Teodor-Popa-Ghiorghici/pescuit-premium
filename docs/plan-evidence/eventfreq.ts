// How often does each event fire in a full game? Repetition is what wears a sound out,
// so this sets the variation count and level of every cue in the plan's cue sheet.
// Random bots and memory bots (membot.ts) bracket human play.
// Run from this directory: npx tsx eventfreq.ts
import { play } from './membot.ts';

const GAMES = 300;
for (const memory of [false, true]) {
  console.log(memory ? '\nMEMORY BOTS' : 'RANDOM BOTS');
  for (const n of [3, 6]) {
    const sum = new Map<string, number>();
    const add = (k: string, v = 1) => sum.set(k, (sum.get(k) ?? 0) + v);
    for (let i = 0; i < GAMES; i++) {
      const { events } = play(n, 11000 + i, memory);
      let dry = false;
      for (const e of events) {
        if (e.type === 'DREW_FROM_POOL' && e.poolEmpty) dry = true;
        add(e.type);
        if (e.type === 'WINDOW_OPENED') add(`window ${e.window}`);
        if (e.type === 'REQUEST_FAILED') add(dry ? 'go fish, pool dry' : 'go fish, pool wet');
        if (e.type === 'SET_LAID') add(e.isPowerSet ? 'set laid (power)' : 'set laid (normal/eggs)');
      }
    }
    console.log(`  ${n} players — mean per game`);
    for (const [k, v] of [...sum].sort((a, b) => b[1] - a[1])) console.log(`    ${k.padEnd(26)} ${(v / GAMES).toFixed(1)}`);
  }
}
