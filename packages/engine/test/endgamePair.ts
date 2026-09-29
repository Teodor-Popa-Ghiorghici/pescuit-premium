// The "endgame pair" of docs/plan-evidence/endcheck.ts, built as real engine states.
//
// Mode Ascuns. Every set is laid face up except two face-down power sets, each 2 real cards +
// 2 eggs; one egg is left in play. In world A both hidden sets are Squid, so the four Whale cards
// still make a set; in world B they are Squid and Whale, so two Squid and two Whale remain with
// one egg between them and nothing can be completed. The two worlds have byte-identical public
// records (same face-up sets, same hand sizes, same face-down counts).
//
// A check that read the true ranks would end world B at once and let world A play on, telling
// the table that the hidden sets share a rank and that one is Squid.
import { GameState, NORMAL_RANKS, POWER_RANKS, Rank } from '../src/types.js';
import { card, laidSet, makeState } from './helpers.js';

export function endgame(hidden: [Rank, Rank]): GameState {
  const remaining: Rank[] =
    hidden[0] === hidden[1] ? ['whale', 'whale', 'whale', 'whale'] : ['squid', 'squid', 'whale', 'whale'];
  // hand sizes are identical in both worlds: 2, 2, 1 (the last is the lone egg)
  const state = makeState({
    playerIds: ['a', 'b', 'c'],
    hands: {
      a: [card(remaining[0]), card(remaining[2])],
      b: [card(remaining[1]), card(remaining[3])],
      c: [card('eggs')],
    },
    pool: [],
  });
  const owners = ['a', 'b', 'c'];
  let k = 0;
  const own = () => owners[k++ % 3];
  NORMAL_RANKS.forEach((r, i) => state.laidSets.push(laidSet(own(), r, i === 0 ? 2 : 3, i === 0 ? 1 : 0, { id: `set_${state.laidSets.length + 1}` })));
  for (const r of POWER_RANKS) if (r !== 'squid' && r !== 'whale') state.laidSets.push(laidSet(own(), r, 4, 0, { faceUp: true, id: `set_${state.laidSets.length + 1}` }));
  for (const r of hidden) state.laidSets.push(laidSet('a', r, 2, 2, { faceUp: false, id: `set_${state.laidSets.length + 1}` }));
  return state;
}
