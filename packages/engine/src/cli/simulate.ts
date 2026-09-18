#!/usr/bin/env tsx
// Plays one full game with scripted bots and prints a readable log.
// Usage: npm run sim --workspace=packages/engine -- [seed] [playerCount]

import { formatLog } from './formatLog.js';
import { playRandomGame } from './playGame.js';

const seed = Number(process.argv[2] ?? 1);
const playerCount = Number(process.argv[3] ?? 4);

const playerIds = Array.from({ length: playerCount }, (_, i) => `P${i + 1}`);

const result = playRandomGame(playerIds, seed, seed * 7919 + 1);

console.log(formatLog(result.events));
console.log('');
console.log(`Total actions: ${result.actionCount}`);
console.log(`Final scores: ${JSON.stringify(Object.fromEntries(result.state.players.map((p) => [p.id, p.score])))}`);
console.log(`Winners: ${result.state.winners.join(', ')}`);
