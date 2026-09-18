import { describe, expect, it } from 'vitest';
import { reduce } from '../../src/engine.js';
import { card, cards, findPlayer, makeState } from '../helpers.js';
import { grantPower, grantUnboundClownfish } from './grantHelper.js';

describe('clownfish', () => {
  it('binds immediately to the most recently used power when laid after another power has been used', () => {
    const state = makeState({
      playerIds: ['a', 'b'],
      hands: { a: [], b: [card('mackerel')] },
    });
    const jGrant = grantPower(state, 'a', 'jellyfish');
    state.pendingWindow = { type: 'TURN_START', eligiblePlayerIds: ['a'], context: {} };
    const { state: s1 } = reduce(state, { type: 'USE_JELLYFISH', playerId: 'a', grantId: jGrant, targetId: 'b' });
    expect(s1.usedPowerHistory).toHaveLength(1);

    const clownfishCards = cards('clownfish', 4);
    findPlayer(s1, 'a').hand.push(...clownfishCards);
    const { state: s2, events } = reduce(s1, {
      type: 'LAY_SET',
      playerId: 'a',
      rank: 'clownfish',
      cardIds: clownfishCards.map((c) => c.id),
    });
    const grant = s2.powerGrants.find((g) => g.isClownfishCopy);
    expect(grant?.rank).toBe('jellyfish');
    expect(grant?.bound).toBe(true);
    expect(events.some((e) => e.type === 'CLOWNFISH_BOUND' && e.boundRank === 'jellyfish')).toBe(true);
  });

  it('stays unbound if no power has been used yet, then binds to the first power used afterward by anyone', () => {
    const state = makeState({
      playerIds: ['a', 'b'],
      hands: { a: cards('clownfish', 4), b: [card('mackerel')] },
    });
    const { state: s1 } = reduce(state, {
      type: 'LAY_SET',
      playerId: 'a',
      rank: 'clownfish',
      cardIds: state.players[0].hand.map((c) => c.id),
    });
    const grant = s1.powerGrants.find((g) => g.rank === 'clownfish');
    expect(grant).toBeTruthy();
    expect(grant?.bound).toBe(false);
    expect(s1.pendingClownfishBindings).toContain(grant!.id);

    // now b uses a jellyfish; the unbound clownfish should immediately bind to jellyfish
    const jGrant = grantPower(s1, 'b', 'jellyfish');
    s1.pendingWindow = { type: 'TURN_START', eligiblePlayerIds: ['b'], context: {} };
    const { state: s2, events } = reduce(s1, { type: 'USE_JELLYFISH', playerId: 'b', grantId: jGrant, targetId: 'a' });
    const boundGrant = s2.powerGrants.find((g) => g.id === grant!.id);
    expect(boundGrant?.bound).toBe(true);
    expect(boundGrant?.rank).toBe('jellyfish');
    expect(events.some((e) => e.type === 'CLOWNFISH_BOUND' && e.boundRank === 'jellyfish')).toBe(true);
    expect(s2.pendingClownfishBindings).toHaveLength(0);
  });

  it('an unbound clownfish cannot be used', () => {
    const state = makeState({ playerIds: ['a', 'b'], hands: { a: [], b: [] } });
    const grantId = grantUnboundClownfish(state, 'a');
    state.pendingWindow = { type: 'TURN_START', eligiblePlayerIds: ['a'], context: {} };
    // an unbound clownfish has rank 'clownfish', not a usable active power rank -> USE_JELLYFISH etc. will reject it
    expect(() =>
      reduce(state, { type: 'USE_JELLYFISH', playerId: 'a', grantId, targetId: 'b' }),
    ).toThrow();
  });

  it('never binds to another clownfish: it skips back to the most recent distinct power', () => {
    const state = makeState({
      playerIds: ['a', 'b'],
      hands: { a: [], b: [card('mackerel')] },
    });
    // jellyfish used first (distinct power)
    const jGrant = grantPower(state, 'a', 'jellyfish');
    state.pendingWindow = { type: 'TURN_START', eligiblePlayerIds: ['a'], context: {} };
    const { state: s1 } = reduce(state, { type: 'USE_JELLYFISH', playerId: 'a', grantId: jGrant, targetId: 'b' });

    // a clownfish binds to jellyfish (most recent distinct power) and is used, becoming a "clownfish copy" of jellyfish
    const cf1 = grantPower(s1, 'a', 'stickleback'); // unrelated grant just to open a TURN_START window later; not used here
    const clownfishGrantId = (() => {
      const g = { id: 'cf_bound', ownerId: 'a', rank: 'jellyfish' as const, sourceSetId: 'none', used: false, bound: true, isClownfishCopy: true };
      s1.powerGrants.push(g);
      return g.id;
    })();
    s1.pendingWindow = { type: 'TURN_START', eligiblePlayerIds: ['a'], context: {} };
    const { state: s2 } = reduce(s1, {
      type: 'USE_JELLYFISH',
      playerId: 'a',
      grantId: clownfishGrantId,
      targetId: 'b',
    });
    // history now: [jellyfish(real), jellyfish(clownfish copy)]
    expect(s2.usedPowerHistory.map((h) => h.wasClownfishCopy)).toEqual([false, true]);

    // a second clownfish laid now must skip the clownfish-copy entry and bind to the real jellyfish use
    const clownfishCards2 = cards('clownfish', 4);
    findPlayer(s2, 'b').hand.push(...clownfishCards2);
    const { state: s3 } = reduce(s2, {
      type: 'LAY_SET',
      playerId: 'b',
      rank: 'clownfish',
      cardIds: clownfishCards2.map((c) => c.id),
    });
    const newGrant = s3.powerGrants.find((g) => g.ownerId === 'b' && g.sourceSetId !== 'none');
    expect(newGrant?.rank).toBe('jellyfish');
    expect(newGrant?.bound).toBe(true);
  });
});
