import { describe, expect, it } from 'vitest';
import { reduce } from '../../src/engine.js';
import { card, cards, findPlayer, makeState } from '../helpers.js';
import { grantPower } from './grantHelper.js';

describe('shark', () => {
  it('jumps in after a successful ask, takes the cards from the asker, and the asker loses the bonus turn', () => {
    const state = makeState({
      playerIds: ['a', 'b', 'c'],
      hands: { a: [card('herring')], b: cards('herring', 2), c: [] },
    });
    const grantId = grantPower(state, 'c', 'shark');
    const { state: sReq } = reduce(state, { type: 'REQUEST', playerId: 'a', targetId: 'b', rank: 'herring' });
    // b holds no squid: responds truthfully via SKIP_WINDOW before TURN_END opens for the shark.
    const { state: s1 } = reduce(sReq, { type: 'SKIP_WINDOW' });
    expect(s1.pendingWindow?.type).toBe('TURN_END');
    const { state: s2, events } = reduce(s1, { type: 'DECLARE_SHARK', playerId: 'c', grantId });
    // shark takes only the cards that were just requested (b's 2), not a's original card
    expect(findPlayer(s2, 'c').hand.filter((c) => c.rank === 'herring')).toHaveLength(2);
    expect(findPlayer(s2, 'a').hand.filter((c) => c.rank === 'herring')).toHaveLength(1);
    expect(events.some((e) => e.type === 'SHARK_JUMP')).toBe(true);
    // no bonus turn: play passes to the player after the asker (b), not to the shark (c)
    expect(events.some((e) => e.type === 'BONUS_TURN')).toBe(false);
    // b is left with an empty hand (both cards were captured then stolen) and the pool is
    // empty too, so b has no legal move and is skipped straight through to c.
    expect(findPlayer(s2, 'b').hand).toHaveLength(0);
    expect(s2.currentPlayerIndex).toBe(2);
  });

  it('cannot jump its own gain', () => {
    const state = makeState({
      playerIds: ['a', 'b'],
      hands: { a: [card('herring')], b: cards('herring', 1) },
    });
    const grantId = grantPower(state, 'a', 'shark');
    const { state: sReq } = reduce(state, { type: 'REQUEST', playerId: 'a', targetId: 'b', rank: 'herring' });
    const { state: s1 } = reduce(sReq, { type: 'SKIP_WINDOW' }); // b's truthful RESPONSE_PENDING answer
    expect(() => reduce(s1, { type: 'DECLARE_SHARK', playerId: 'a', grantId })).toThrow();
  });

  it('only one shark may jump per turn: a second shark cannot also declare', () => {
    const state = makeState({
      playerIds: ['a', 'b', 'c', 'd'],
      hands: { a: [card('herring')], b: cards('herring', 1), c: [], d: [] },
    });
    const g1 = grantPower(state, 'c', 'shark');
    const g2 = grantPower(state, 'd', 'shark');
    const { state: sReq } = reduce(state, { type: 'REQUEST', playerId: 'a', targetId: 'b', rank: 'herring' });
    const { state: s1 } = reduce(sReq, { type: 'SKIP_WINDOW' }); // b's truthful RESPONSE_PENDING answer
    const { state: s2 } = reduce(s1, { type: 'DECLARE_SHARK', playerId: 'c', grantId: g1 });
    // window is closed now; d cannot also jump
    expect(s2.pendingWindow).toBeNull();
    expect(s2.powerGrants.find((g) => g.id === g2)?.used).toBe(false);
    expect(() => reduce(s2, { type: 'DECLARE_SHARK', playerId: 'd', grantId: g2 })).toThrow();
  });

  it('there is nothing to jump on a failed ask (no shark window opens)', () => {
    const state = makeState({
      playerIds: ['a', 'b', 'c'],
      hands: { a: [card('herring')], b: [card('mackerel')], c: [] },
    });
    grantPower(state, 'c', 'shark');
    const { state: sReq } = reduce(state, { type: 'REQUEST', playerId: 'a', targetId: 'b', rank: 'herring' });
    expect(sReq.pendingWindow?.type).toBe('RESPONSE_PENDING');
    const { state: s1 } = reduce(sReq, { type: 'SKIP_WINDOW' }); // b truthfully says "Pescuiește!"
    expect(s1.pendingWindow).toBeNull();
  });
});
