// How often does each event fire in a full game? Repetition is what wears a sound out,
// so this sets the variation count and level of every cue in the plan's cue bible.
// Run from this directory: npx tsx eventfreq.ts
import { playRandomGame } from '../../packages/engine/src/cli/playGame.ts';

const GAMES = 300;
for (const n of [3, 6]) {
  const perGame = new Map<string, number[]>();
  const windowsByType = new Map<string, number[]>();
  for (let i = 0; i < GAMES; i++) {
    const ids = Array.from({ length: n }, (_, j) => `P${j + 1}`);
    const { events } = playRandomGame(ids, 11000 + i, 70000 + i * 17, { powerVisibility: 'ascuns' });
    const counts = new Map<string, number>();
    const wins = new Map<string, number>();
    for (const e of events) {
      counts.set(e.type, (counts.get(e.type) ?? 0) + 1);
      if (e.type === 'WINDOW_OPENED') wins.set(e.window, (wins.get(e.window) ?? 0) + 1);
    }
    for (const [k, v] of counts) perGame.set(k, [...(perGame.get(k) ?? []), v]);
    for (const [k, v] of wins) windowsByType.set(k, [...(windowsByType.get(k) ?? []), v]);
  }
  const mean = (a: number[]) => a.reduce((s, x) => s + x, 0) / GAMES; // absent in a game counts as 0
  console.log(`\n${n} players — mean occurrences per game (${GAMES} games)`);
  for (const [k, v] of [...perGame].sort((a, b) => mean(b[1]) - mean(a[1]))) {
    console.log(`  ${k.padEnd(22)} ${mean(v).toFixed(1)}`);
  }
  console.log('  windows opened, by type:');
  for (const [k, v] of [...windowsByType].sort((a, b) => mean(b[1]) - mean(a[1]))) {
    console.log(`    ${k.padEnd(20)} ${mean(v).toFixed(1)}`);
  }
}
