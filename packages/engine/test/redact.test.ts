import { describe, expect, it } from 'vitest';
import { reduce } from '../src/engine.js';
import { redactForPlayer } from '../src/redact.js';
import { card, cards, findPlayer, makeState } from './helpers.js';

describe('redaction', () => {
  it('a viewer sees their own full hand but only hand-size counts for others', () => {
    const state = makeState({
      playerIds: ['a', 'b'],
      hands: { a: [card('herring')], b: cards('mackerel', 2) },
    });
    const view = redactForPlayer(state, 'a');
    expect(view.hand).toHaveLength(1);
    const bView = view.players.find((p) => p.id === 'b')!;
    expect(bView.handSize).toBe(2);
    expect((bView as any).hand).toBeUndefined();
  });

  it('a hidden power set (Mode A) shows isPowerSet but hides the rank from opponents, not from the owner', () => {
    const sharks = cards('shark', 4);
    const state = makeState({ playerIds: ['a', 'b'], hands: { a: sharks, b: [] }, powerVisibility: 'ascuns' });
    const { state: s1 } = reduce(state, {
      type: 'LAY_SET',
      playerId: 'a',
      rank: 'shark',
      cardIds: sharks.map((c) => c.id),
    });
    const opponentView = redactForPlayer(s1, 'b');
    const set = opponentView.laidSets[0];
    expect(set.isPowerSet).toBe(true);
    expect(set.rank).toBeNull();

    const ownerView = redactForPlayer(s1, 'a');
    expect(ownerView.laidSets[0].rank).toBe('shark');
  });

  it('a squid set never reveals its rank to opponents, even after use, in Mode A', () => {
    const squids = cards('squid', 4);
    const state = makeState({
      playerIds: ['a', 'b'],
      hands: { a: [card('herring')], b: [...squids, ...cards('herring', 1)] },
      powerVisibility: 'ascuns',
    });
    const { state: s1 } = reduce(state, {
      type: 'LAY_SET',
      playerId: 'b',
      rank: 'squid',
      cardIds: squids.map((c) => c.id),
    });
    const { state: s2 } = reduce(s1, { type: 'REQUEST', playerId: 'a', targetId: 'b', rank: 'herring' });
    const grantId = s2.powerGrants.find((g) => g.rank === 'squid')!.id;
    const { state: s3 } = reduce(s2, { type: 'DECLARE_SQUID', playerId: 'b', grantId, lie: 'deny' });

    const opponentView = redactForPlayer(s3, 'a');
    const set = opponentView.laidSets.find((s) => s.ownerId === 'b')!;
    expect(set.rank).toBeNull();
    expect(set.spent).toBe(false); // must not leak that it was used
  });

  it('does not expose other players raw power grants (protects clownfish binding privacy in Mode A)', () => {
    const state = makeState({ playerIds: ['a', 'b'], hands: { a: [], b: [] } });
    const view = redactForPlayer(state, 'b');
    expect((view as any).powerGrants).toBeUndefined();
  });

  it('the SET_COMPLETED window never leaks a concealed rank to a mantis-holding opponent', () => {
    const squids = cards('squid', 4);
    const state = makeState({ playerIds: ['a', 'b'], hands: { a: squids, b: [] }, powerVisibility: 'ascuns' });
    state.powerGrants.push({
      id: 'g1',
      ownerId: 'b',
      rank: 'mantisShrimp',
      sourceSetId: 'preexisting',
      used: false,
      bound: true,
      isClownfishCopy: false,
    });
    const { state: s1 } = reduce(state, {
      type: 'LAY_SET',
      playerId: 'a',
      rank: 'squid',
      cardIds: squids.map((c) => c.id),
    });
    expect(s1.pendingWindow?.type).toBe('SET_COMPLETED');
    // the engine's own authoritative context does carry the rank internally...
    expect(s1.pendingWindow?.context.rank).toBe('squid');
    // ...but the redacted view handed to the mantis holder must not.
    const opponentView = redactForPlayer(s1, 'b');
    expect(opponentView.pendingWindow?.context.rank).toBeUndefined();
    // the owner, laying their own set, is allowed to see it.
    const ownerView = redactForPlayer(s1, 'a');
    expect(ownerView.pendingWindow?.context.rank).toBe('squid');
  });
});
