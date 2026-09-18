import { describe, expect, it } from 'vitest';
import { reduce } from '../../src/engine.js';
import { card, cards, findPlayer, makeState } from '../helpers.js';
import { grantPower } from './grantHelper.js';

describe('tortoise', () => {
  it('reactively cancels a successful transfer, protecting the rank until the start of the owner next turn', () => {
    const state = makeState({
      playerIds: ['b', 'a', 'c'], // seating order: after a's turn comes c, not b
      hands: { a: [card('herring')], b: cards('herring', 2), c: [card('carp')] },
      pool: [card('carp')],
      currentPlayerIndex: 1, // a's turn
    });
    const grantId = grantPower(state, 'b', 'tortoise');
    const { state: s1 } = reduce(state, { type: 'REQUEST', playerId: 'a', targetId: 'b', rank: 'herring' });
    expect(s1.pendingWindow?.type).toBe('TRANSFER_PENDING');
    const { state: s2, events } = reduce(s1, {
      type: 'DECLARE_TORTOISE',
      playerId: 'b',
      grantId,
      rank: 'herring',
    });
    // cards stay with b
    expect(findPlayer(s2, 'b').hand.filter((c) => c.rank === 'herring')).toHaveLength(2);
    expect(findPlayer(s2, 'a').hand.filter((c) => c.rank === 'herring')).toHaveLength(1);
    expect(events.some((e) => e.type === 'TORTOISE_BLOCK')).toBe(true);
    // a blocked transfer behaves like a failed ask: asker draws, no bonus turn
    expect(events.some((e) => e.type === 'DREW_FROM_POOL' && e.playerId === 'a')).toBe(true);
    expect(events.some((e) => e.type === 'BONUS_TURN')).toBe(false);
    expect(s2.tortoiseProtections).toHaveLength(1);
    expect(s2.tortoiseProtections[0]).toMatchObject({ ownerId: 'b', rank: 'herring' });
  });

  it('a standing protection auto-blocks future attempts without needing to redeclare', () => {
    const state = makeState({
      playerIds: ['a', 'b', 'c'],
      hands: { a: [card('herring')], b: cards('herring', 2), c: [card('herring')] },
    });
    state.tortoiseProtections.push({ id: 'tp1', ownerId: 'b', rank: 'herring', expiresAtNextTurnOf: 'b' });
    const { state: s1, events } = reduce(state, { type: 'REQUEST', playerId: 'a', targetId: 'b', rank: 'herring' });
    // no window needed, auto-blocked
    expect(s1.pendingWindow).toBeNull();
    expect(findPlayer(s1, 'b').hand.filter((c) => c.rank === 'herring')).toHaveLength(2);
    expect(events.some((e) => e.type === 'TORTOISE_BLOCK')).toBe(true);
  });

  it('protection expires when the owner next turn begins', () => {
    const state = makeState({
      playerIds: ['a', 'b'],
      hands: { a: [card('mackerel')], b: [card('herring')] },
      currentPlayerIndex: 0, // a's turn
    });
    state.tortoiseProtections.push({ id: 'tp1', ownerId: 'b', rank: 'herring', expiresAtNextTurnOf: 'b' });
    // a asks b for mackerel (b has none) -> fails -> turn passes to b -> b's turn begins -> protection clears
    const { state: s1 } = reduce(state, { type: 'REQUEST', playerId: 'a', targetId: 'b', rank: 'mackerel' });
    expect(s1.currentPlayerIndex).toBe(1);
    expect(s1.tortoiseProtections).toHaveLength(0);
  });
});
