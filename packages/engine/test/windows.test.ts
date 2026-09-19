import { describe, expect, it } from 'vitest';
import { reduce, IllegalActionError } from '../src/engine.js';
import { card, cards, findPlayer, makeState } from './helpers.js';
import { grantPower } from './powers/grantHelper.js';

describe('windows', () => {
  it('a player with nothing playable is not notified: no window opens if nobody is eligible', () => {
    const state = makeState({
      playerIds: ['a', 'b'],
      hands: { a: [card('herring')], b: cards('herring', 1) },
    });
    const { state: sReq } = reduce(state, { type: 'REQUEST', playerId: 'a', targetId: 'b', rank: 'herring' });
    // no squid held by b: the RESPONSE_PENDING window still opens (b must say "Pescuiește!"
    // themselves), but no lanternfish/tortoise/shark exist anywhere, so once b responds
    // truthfully the rest of the chain resolves with no further window ever open.
    expect(sReq.pendingWindow?.type).toBe('RESPONSE_PENDING');
    const { state: s1 } = reduce(sReq, { type: 'SKIP_WINDOW' });
    expect(s1.pendingWindow).toBeNull();
  });

  it('interrupts do not nest: while TRANSFER_PENDING is open, a shark cannot jump in', () => {
    const state = makeState({
      playerIds: ['a', 'b', 'c'],
      hands: { a: [card('herring')], b: cards('herring', 2), c: [] },
    });
    const tGrant = grantPower(state, 'b', 'tortoise');
    const sGrant = grantPower(state, 'c', 'shark');
    const { state: sReq } = reduce(state, { type: 'REQUEST', playerId: 'a', targetId: 'b', rank: 'herring' });
    expect(sReq.pendingWindow?.type).toBe('RESPONSE_PENDING');
    // b holds no squid, so they respond truthfully via SKIP_WINDOW before TRANSFER_PENDING opens.
    const { state: s1 } = reduce(sReq, { type: 'SKIP_WINDOW' });
    expect(s1.pendingWindow?.type).toBe('TRANSFER_PENDING');
    // shark cannot act while the transfer window (not yet the turn-end window) is open
    expect(() => reduce(s1, { type: 'DECLARE_SHARK', playerId: 'c', grantId: sGrant })).toThrow(IllegalActionError);
  });

  it('only one power resolves per window: skipping is final, cannot then declare', () => {
    const state = makeState({
      playerIds: ['a', 'b'],
      hands: { a: [card('herring')], b: cards('herring', 2) },
    });
    const tGrant = grantPower(state, 'b', 'tortoise');
    const { state: sReq } = reduce(state, { type: 'REQUEST', playerId: 'a', targetId: 'b', rank: 'herring' });
    const { state: s1 } = reduce(sReq, { type: 'SKIP_WINDOW' }); // b's truthful RESPONSE_PENDING answer
    const { state: s2 } = reduce(s1, { type: 'SKIP_WINDOW' }); // b's TRANSFER_PENDING skip
    expect(s2.pendingWindow).toBeNull();
    expect(() => reduce(s2, { type: 'DECLARE_TORTOISE', playerId: 'b', grantId: tGrant, rank: 'herring' })).toThrow(
      IllegalActionError,
    );
  });

  it('a used power cannot be used again', () => {
    const state = makeState({ playerIds: ['a', 'b', 'c'], hands: { a: [card('herring')], b: [], c: [] } });
    const grantId = grantPower(state, 'a', 'jellyfish');
    state.powerGrants[0].used = true;
    state.pendingWindow = { type: 'TURN_START', eligiblePlayerIds: ['a'], context: {} };
    expect(() => reduce(state, { type: 'USE_JELLYFISH', playerId: 'a', grantId, targetId: 'b' })).toThrow(
      IllegalActionError,
    );
  });
});

describe('mid-turn empty hand', () => {
  it('refills immediately (not just at turn start) if laying a set empties the current player hand', () => {
    const herrings = cards('herring', 3);
    const state = makeState({
      playerIds: ['a', 'b'],
      hands: { a: herrings, b: [] },
      pool: cards('carp', 5),
    });
    const { state: s1, events } = reduce(state, {
      type: 'LAY_SET',
      playerId: 'a',
      rank: 'herring',
      cardIds: herrings.map((c) => c.id),
    });
    expect(events.some((e) => e.type === 'HAND_REFILLED' && e.playerId === 'a')).toBe(true);
    expect(findPlayer(s1, 'a').hand.length).toBe(3);
    expect(s1.currentPlayerIndex).toBe(0); // still a's turn, just refilled
  });

  it('with the pool also empty, a player who cannot act has their turn passed automatically', () => {
    const herrings = cards('herring', 3);
    const state = makeState({
      playerIds: ['a', 'b'],
      hands: { a: herrings, b: [card('mackerel')] },
      pool: [],
    });
    const { state: s1 } = reduce(state, {
      type: 'LAY_SET',
      playerId: 'a',
      rank: 'herring',
      cardIds: herrings.map((c) => c.id),
    });
    expect(findPlayer(s1, 'a').hand.length).toBe(0);
    expect(s1.currentPlayerIndex).toBe(1); // passed to b
    expect(s1.status).toBe('IN_PROGRESS'); // b still has a real card, game continues
  });
});
