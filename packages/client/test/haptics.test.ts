import { describe, expect, it } from 'vitest';
import { hapticsFor, PATTERNS } from '../src/audio/haptics.js';
import type { PublicEvent, PublicRecord, PublicView, SeatFacts } from '../src/audio/cues.js';

const view = (over: Partial<PublicView> = {}): PublicView => ({ players: ['a', 'b', 'c'], poolCount: 5, window: null, ...over });
const rec = (before: PublicView | null, after: PublicView, events: PublicEvent[] = []): PublicRecord => ({ seq: 1, mode: 'ascuns', before, after, events });
const facts = (id: string, over: Partial<SeatFacts> = {}): SeatFacts => ({ playerId: id, headphones: false, ...over });
const signals = (r: ReturnType<typeof hapticsFor>) => r.map((h) => h.signal);

describe('the haptics map (§3.11)', () => {
  it('has the plan\'s patterns', () => {
    expect(PATTERNS.yourTurn).toEqual([16]);
    expect(PATTERNS.youWereAsked).toEqual([12, 60, 12]);
    expect(PATTERNS.cardLands).toEqual([6]);
    expect(PATTERNS.cardsTaken).toEqual([30]);
    expect(PATTERNS.stunned).toEqual([40]);
    expect(PATTERNS.setDestroyed).toEqual([20, 30, 40]);
  });
  it('your turn, you were asked, a card lands, cards taken, stunned, set destroyed', () => {
    expect(signals(hapticsFor(rec(view(), view(), [{ type: 'TURN_STARTED', playerId: 'a' }]), facts('a')))).toEqual(['yourTurn']);
    expect(hapticsFor(rec(view(), view(), [{ type: 'TURN_STARTED', playerId: 'b' }]), facts('a'))).toEqual([]);
    const ask = rec(view(), view({ window: { type: 'RESPONSE_PENDING', askerId: 'a', targetId: 'b' } }), [{ type: 'REQUEST_MADE', askerId: 'a', targetId: 'b' }]);
    expect(signals(hapticsFor(ask, facts('b')))).toEqual(['youWereAsked']);
    expect(hapticsFor(ask, facts('c'))).toEqual([]);
    expect(signals(hapticsFor(rec(view(), view(), [{ type: 'REQUEST_SUCCEEDED', askerId: 'a', targetId: 'b', count: 2 }]), facts('b')))).toEqual(['cardsTaken']);
    expect(signals(hapticsFor(rec(view(), view(), [{ type: 'DREW_FROM_POOL', playerId: 'a' }]), facts('a')))).toEqual(['cardLands']);
    expect(signals(hapticsFor(rec(view(), view(), [{ type: 'JELLYFISH_STUN', playerId: 'a', targetId: 'b' }]), facts('b')))).toEqual(['stunned']);
    expect(hapticsFor(rec(view(), view(), [{ type: 'SET_DESTROYED', ownerId: 'b' }]), facts('b'))[0].pattern).toEqual([20, 30, 40]);
  });
  it('Squid has no haptic; a structural window opens none for the table', () => {
    const w = view({ window: { type: 'TURN_END' } });
    expect(hapticsFor(rec(view(), w, [{ type: 'WINDOW_OPENED' }]), facts('b'))).toEqual([]);
    for (const rank of ['squid'])
      expect(hapticsFor(rec(view(), view(), [{ type: 'POWER_USED', playerId: 'a', rank }]), facts('a'))).toEqual([]);
  });
  it('the eligibility haptic is the private tier: only the eligible viewer, and marked private', () => {
    const w = view({ window: { type: 'TURN_END' } });
    const h = hapticsFor(rec(view(), w), facts('c', { eligible: true, eligibleBefore: false }));
    expect(h).toHaveLength(1);
    expect(h[0].tier).toBe('private');
    expect(hapticsFor(rec(view(), w), facts('b'))).toEqual([]);
  });
  it('public haptics depend on the public record alone', () => {
    const r = rec(view(), view(), [{ type: 'TURN_STARTED', playerId: 'a' }, { type: 'REQUEST_SUCCEEDED', askerId: 'b', targetId: 'a', count: 1 }]);
    const stuffed = { ...facts('a'), hand: ['x'], grantRank: () => 'squid' } as SeatFacts;
    expect(hapticsFor(r, stuffed)).toEqual(hapticsFor(r, facts('a')));
  });
});

describe('the haptics map reads the engine\'s real event fields', () => {
  it('a Shark jumps the cards away from `fromId`, the asker who had just received them', () => {
    const r = rec(view(), view(), [{ type: 'SHARK_JUMP', playerId: 'c', fromId: 'a', count: 2 }]);
    expect(signals(hapticsFor(r, facts('a')))).toEqual(['cardsTaken']);
    expect(hapticsFor(r, facts('b'))).toEqual([]);
    expect(hapticsFor(r, facts('c'))).toEqual([]);
  });
  it('the destroyed set\'s owner comes from the view before the event (the adapter), not from the event', async () => {
    const { publicEventsOf } = await import('../src/game/record.js');
    const before = view({ laidSets: [{ id: 's1', ownerId: 'b', isPowerSet: true, rank: null, cardCount: 4, spent: false, destroyed: false }] });
    const events = publicEventsOf([{ type: 'SET_DESTROYED', setId: 's1', byPlayerId: 'a' }] as never, before);
    expect(signals(hapticsFor(rec(before, view(), events), facts('b')))).toEqual(['setDestroyed']);
    expect(hapticsFor(rec(before, view(), events), facts('c'))).toEqual([]);
  });
  it('each stop of the totem has its own moment: a stunned skip then your turn', () => {
    const r = rec(view(), view(), [{ type: 'TURN_SKIPPED_STUNNED', playerId: 'b' }, { type: 'TURN_STARTED', playerId: 'a' }]);
    expect(hapticsFor(r, facts('a')).map((h) => [h.signal, h.at])).toEqual([['yourTurn', 760 + 420]]);
    expect(hapticsFor(r, facts('b')).map((h) => [h.signal, h.at])).toEqual([['stunned', 760]]);
  });
});
