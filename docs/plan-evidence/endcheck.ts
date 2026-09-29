// Why the §11.2 end check must read only the public record. Two endgames with byte-identical
// public records in Mode Ascuns: every set is laid face up except two face-down power sets,
// each 2 real cards + 2 eggs, and one egg is left in play. In world A both hidden sets are
// Squid, so the four Whale cards still make a set; in world B they are Squid and Whale, so
// two Squid and two Whale remain with one egg between them and nothing can be completed.
// A check that reads the true ranks (v3's) ends world B at once and lets world A play on —
// so the table learns that the hidden sets share a rank, and that one is Squid. The public
// check gives both worlds the same answer. Run from this directory: npx tsx endcheck.ts
import { NORMAL_RANKS, POWER_RANKS } from '../../packages/engine/src/types.ts';
import type { Rank } from '../../packages/engine/src/types.ts';
import { setsStillPossible, type LaidFacts } from './membot.ts';

function endgame(hidden: [Rank, Rank]) {
  const truth: LaidFacts[] = [];
  NORMAL_RANKS.forEach((r, i) => truth.push({ rank: r, reals: i === 0 ? 2 : 3, eggs: i === 0 ? 1 : 0 }));
  for (const r of POWER_RANKS) if (r !== 'squid' && r !== 'whale') truth.push({ rank: r, reals: 4, eggs: 0 });
  for (const r of hidden) truth.push({ rank: r, reals: 2, eggs: 2 });
  // the spectator sees the same sets with the two power ranks hidden
  const seen = truth.map((l, i) => (i >= truth.length - 2 ? { ...l, rank: null } : l));
  return { truth, seen };
}

const worlds = { 'A: squid + squid': endgame(['squid', 'squid']), 'B: squid + whale': endgame(['squid', 'whale']) };
let samePublic = true;
const [a, b] = Object.values(worlds);
samePublic = JSON.stringify(a.seen) === JSON.stringify(b.seen);
console.log(`public records identical: ${samePublic}`);
for (const [name, w] of Object.entries(worlds)) {
  const omniscient = setsStillPossible(w.truth);
  const publicCount = setsStillPossible(w.seen);
  console.log(
    `${name} — omniscient: ${omniscient} set(s) possible → ${omniscient === 0 ? 'ENDS NOW' : 'plays on'} | ` +
      `public: ${publicCount} set(s) possible → ${publicCount === 0 ? 'ends now' : 'plays on'}`,
  );
}
const leak = setsStillPossible(a.truth) !== setsStillPossible(b.truth);
const safe = setsStillPossible(a.seen) === setsStillPossible(b.seen);
console.log(leak && safe && samePublic ? 'PASS — the omniscient check leaks the hidden ranks; the public check does not' : 'FAIL');
process.exit(leak && safe && samePublic ? 0 : 1);
