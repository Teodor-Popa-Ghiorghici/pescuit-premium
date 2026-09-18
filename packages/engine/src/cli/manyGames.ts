#!/usr/bin/env tsx
// Runs N complete random-bot games through the engine and asserts no illegal states,
// no thrown IllegalActionError, and no deadlocks (bounded action count). This is the
// M1 exit criterion: "a thousand random bot games run to completion with no illegal
// states and no deadlocks."
//
// Usage: npm run sim:many --workspace=packages/engine -- [gameCount]

import { assertInvariants } from './invariants.js';
import { playRandomGame } from './playGame.js';

const gameCount = Number(process.argv[2] ?? 1000);

let totalActions = 0;
let maxActions = 0;
const playerCounts = [3, 4, 5, 6];
const visibilityModes: Array<'ascuns' | 'deschis'> = ['ascuns', 'deschis'];
const winsByPlayerCount: Record<number, number> = {};
let sharedVictories = 0;

const start = Date.now();

for (let i = 0; i < gameCount; i++) {
  const playerCount = playerCounts[i % playerCounts.length];
  const visibility = visibilityModes[i % visibilityModes.length];
  const playerIds = Array.from({ length: playerCount }, (_, j) => `P${j + 1}`);
  const seed = 1000 + i;
  const botSeed = 500000 + i * 31;

  let result;
  try {
    result = playRandomGame(playerIds, seed, botSeed, { powerVisibility: visibility });
  } catch (err) {
    console.error(`Game ${i} (seed ${seed}, players ${playerCount}, mode ${visibility}) FAILED:`);
    console.error(err);
    process.exit(1);
  }

  try {
    assertInvariants(result.state, `game ${i} seed ${seed}`);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }

  if (result.state.status !== 'ENDED') {
    console.error(`Game ${i} (seed ${seed}) did not reach ENDED status`);
    process.exit(1);
  }

  totalActions += result.actionCount;
  maxActions = Math.max(maxActions, result.actionCount);
  winsByPlayerCount[playerCount] = (winsByPlayerCount[playerCount] ?? 0) + 1;
  if (result.state.winners.length > 1) sharedVictories += 1;

  if ((i + 1) % 100 === 0) {
    console.log(`  ...${i + 1}/${gameCount} games OK`);
  }
}

const elapsedMs = Date.now() - start;

console.log('');
console.log(`All ${gameCount} games completed with no illegal states and no deadlocks.`);
console.log(`Average actions/game: ${(totalActions / gameCount).toFixed(1)}, max: ${maxActions}`);
console.log(`Shared victories: ${sharedVictories} (${((sharedVictories / gameCount) * 100).toFixed(1)}%)`);
console.log(`Games per player count: ${JSON.stringify(winsByPlayerCount)}`);
console.log(`Elapsed: ${elapsedMs}ms`);
