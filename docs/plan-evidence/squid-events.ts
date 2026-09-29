// Does a Squid lie look, at the event level, exactly like an honest "no"? Every client
// receives these events, so any difference is visible to the whole table.
// Run from this directory: npx tsx squid-events.ts
import { reduce } from '../../packages/engine/src/engine.ts';
import type { GameState } from '../../packages/engine/src/types.ts';
import { card, cards, makeState } from '../../packages/engine/test/helpers.ts';
import { grantPower } from '../../packages/engine/test/powers/grantHelper.ts';

function answer(state: GameState, respond: (s: GameState) => Parameters<typeof reduce>[1]) {
  const asked = reduce(state, { type: 'REQUEST', playerId: 'a', targetId: 'b', rank: 'herring' });
  const answered = reduce(asked.state, respond(asked.state));
  return answered.events.map((e) => ('window' in e ? `${e.type}(${e.window})` : e.type)).join(' > ');
}

const pool = () => [card('carp'), card('perch')];

// 1. Honest "no": b holds no herring and answers truthfully.
const honest = makeState({ playerIds: ['a', 'b', 'c'], hands: { a: [card('herring')], b: [card('mackerel')], c: [card('trout')] }, pool: pool() });
console.log('honest no   :', answer(honest, () => ({ type: 'SKIP_WINDOW', playerId: 'b' })));

// 2. Squid deny: b holds two herring and lies.
const deny = makeState({ playerIds: ['a', 'b', 'c'], hands: { a: [card('herring')], b: cards('herring', 2), c: [card('trout')] }, pool: pool() });
const denyGrant = grantPower(deny, 'b', 'squid');
console.log('squid deny  :', answer(deny, () => ({ type: 'DECLARE_SQUID', playerId: 'b', grantId: denyGrant, lie: 'deny' })));

// 3. Squid claim: b holds no herring and falsely claims some.
const claim = makeState({ playerIds: ['a', 'b', 'c'], hands: { a: [card('herring')], b: [card('mackerel')], c: [card('trout')] }, pool: pool() });
const claimGrant = grantPower(claim, 'b', 'squid');
console.log('squid claim :', answer(claim, () => ({ type: 'DECLARE_SQUID', playerId: 'b', grantId: claimGrant, lie: 'claim' })));
