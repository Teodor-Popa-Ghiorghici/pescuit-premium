import { describe, expect, it } from 'vitest';
import { reduce } from '../src/engine.js';
import {
  redactEventsForPlayer,
  redactEventsForSpectator,
  redactForPlayer,
  redactForSpectator,
} from '../src/redact.js';
import { card, cards, laidSet, makeState } from './helpers.js';
import { grantPower } from './powers/grantHelper.js';

const ids = ['a', 'b', 'c'];

describe('per-viewer event redaction (§6.1)', () => {
  it('DREW_FROM_POOL: the card id goes to the drawer only', () => {
    const state = makeState({
      playerIds: ids,
      hands: { a: [card('herring')], b: [card('mackerel')], c: [card('trout')] },
      pool: [card('carp')],
    });
    const asked = reduce(state, { type: 'REQUEST', playerId: 'a', targetId: 'b', rank: 'herring' });
    const { state: s, events } = reduce(asked.state, { type: 'SKIP_WINDOW', playerId: 'b' });
    const drew = events.find((e) => e.type === 'DREW_FROM_POOL') as any;
    expect(drew.cardId).toBeDefined();
    const forA = redactEventsForPlayer(s, events, 'a').find((e) => e.type === 'DREW_FROM_POOL') as any;
    const forB = redactEventsForPlayer(s, events, 'b').find((e) => e.type === 'DREW_FROM_POOL') as any;
    const spec = redactEventsForSpectator(s, events).find((e) => e.type === 'DREW_FROM_POOL') as any;
    expect(forA.cardId).toBe(drew.cardId);
    expect('cardId' in forB).toBe(false);
    expect('cardId' in spec).toBe(false);
    expect(forB.poolEmpty).toBe(true); // the public part stays
  });

  it('SET_LAID and POWER_GRANTED: the rank is hidden while the set is concealed, the grant id is the owner\'s', () => {
    const sharks = cards('shark', 4);
    const state = makeState({ playerIds: ids, hands: { a: sharks, b: [], c: [] }, powerVisibility: 'ascuns' });
    const { state: s, events } = reduce(state, { type: 'LAY_SET', playerId: 'a', rank: 'shark', cardIds: sharks.map((c) => c.id) });
    const truth = events.find((e) => e.type === 'POWER_GRANTED') as any;
    const own = redactEventsForPlayer(s, events, 'a');
    const other = redactEventsForPlayer(s, events, 'b');
    expect((own.find((e) => e.type === 'SET_LAID') as any).rank).toBe('shark');
    expect((own.find((e) => e.type === 'POWER_GRANTED') as any)).toMatchObject({ rank: 'shark', grantId: truth.grantId });
    expect((other.find((e) => e.type === 'SET_LAID') as any).rank).toBeNull();
    const og = other.find((e) => e.type === 'POWER_GRANTED') as any;
    expect(og.rank).toBeNull();
    expect('grantId' in og).toBe(false);
    expect(JSON.stringify(redactEventsForSpectator(s, events))).toBe(JSON.stringify(other));
  });

  it('Mode Deschis: a laid power set is public, but the grant id is still the owner\'s', () => {
    const sharks = cards('shark', 4);
    const state = makeState({ playerIds: ids, hands: { a: sharks, b: [], c: [] }, powerVisibility: 'deschis' });
    const { state: s, events } = reduce(state, { type: 'LAY_SET', playerId: 'a', rank: 'shark', cardIds: sharks.map((c) => c.id) });
    const other = redactEventsForPlayer(s, events, 'b');
    expect((other.find((e) => e.type === 'SET_LAID') as any).rank).toBe('shark');
    const og = other.find((e) => e.type === 'POWER_GRANTED') as any;
    expect(og.rank).toBe('shark');
    expect('grantId' in og).toBe(false);
  });

  it('an unbound Clownfish grant does not announce the concealed rank through `unbound`', () => {
    const fish = cards('clownfish', 4);
    const state = makeState({ playerIds: ids, hands: { a: fish, b: [], c: [] }, powerVisibility: 'ascuns' });
    const { state: s, events } = reduce(state, { type: 'LAY_SET', playerId: 'a', rank: 'clownfish', cardIds: fish.map((c) => c.id) });
    const own = redactEventsForPlayer(s, events, 'a').find((e) => e.type === 'POWER_GRANTED') as any;
    const other = redactEventsForPlayer(s, events, 'b').find((e) => e.type === 'POWER_GRANTED') as any;
    expect(own).toMatchObject({ rank: 'clownfish', unbound: true });
    expect(other).toMatchObject({ rank: null, unbound: false });
  });

  it('CLOWNFISH_BOUND: owner only in Ascuns, everyone in Deschis', () => {
    for (const mode of ['ascuns', 'deschis'] as const) {
      const fish = cards('clownfish', 4);
      const state = makeState({ playerIds: ids, hands: { a: fish, b: [], c: [] }, powerVisibility: mode });
      state.usedPowerHistory.push({ rank: 'shark', grantId: 'old', wasClownfishCopy: false });
      const { state: s, events } = reduce(state, { type: 'LAY_SET', playerId: 'a', rank: 'clownfish', cardIds: fish.map((c) => c.id) });
      expect(events.some((e) => e.type === 'CLOWNFISH_BOUND')).toBe(true);
      const own = redactEventsForPlayer(s, events, 'a').find((e) => e.type === 'CLOWNFISH_BOUND') as any;
      const other = redactEventsForPlayer(s, events, 'b').find((e) => e.type === 'CLOWNFISH_BOUND') as any;
      expect(own.boundRank).toBe('shark');
      expect(own.grantId).toBeDefined();
      if (mode === 'ascuns') expect(other).toBeUndefined();
      else {
        expect(other.boundRank).toBe('shark');
        expect('grantId' in other).toBe(false);
      }
    }
  });

  it('POWER_USED is public, its grant id is the owner\'s', () => {
    const state = makeState({
      playerIds: ids,
      hands: { a: [card('herring')], b: cards('herring', 2), c: [] },
      pool: [card('carp')],
    });
    const grantId = grantPower(state, 'b', 'lanternfish');
    const asked = reduce(state, { type: 'REQUEST', playerId: 'a', targetId: 'b', rank: 'herring' });
    expect(asked.state.pendingWindow?.type).toBe('REQUEST_DECLARED');
    const { state: s, events } = reduce(asked.state, { type: 'DECLARE_LANTERNFISH', playerId: 'b', grantId });
    const own = redactEventsForPlayer(s, events, 'b').find((e) => e.type === 'POWER_USED') as any;
    const other = redactEventsForPlayer(s, events, 'a').find((e) => e.type === 'POWER_USED') as any;
    expect(own).toMatchObject({ rank: 'lanternfish', grantId });
    expect(other.rank).toBe('lanternfish');
    expect('grantId' in other).toBe(false);
  });

  it('WINDOW_OPENED: youAreEligible instead of the eligibility list; SET_COMPLETED context loses a concealed rank', () => {
    const squids = cards('squid', 4);
    const state = makeState({ playerIds: ids, hands: { a: squids, b: [], c: [] }, powerVisibility: 'ascuns' });
    grantPower(state, 'b', 'mantisShrimp');
    const { state: s, events } = reduce(state, { type: 'LAY_SET', playerId: 'a', rank: 'squid', cardIds: squids.map((c) => c.id) });
    const raw = events.find((e) => e.type === 'WINDOW_OPENED') as any;
    expect(raw.eligiblePlayerIds).toEqual(['b']);
    const forB = redactEventsForPlayer(s, events, 'b').find((e) => e.type === 'WINDOW_OPENED') as any;
    const forC = redactEventsForPlayer(s, events, 'c').find((e) => e.type === 'WINDOW_OPENED') as any;
    const forA = redactEventsForPlayer(s, events, 'a').find((e) => e.type === 'WINDOW_OPENED') as any;
    expect(forB.youAreEligible).toBe(true);
    expect(forC.youAreEligible).toBe(false);
    expect('eligiblePlayerIds' in forB).toBe(false);
    expect(forB.context.rank).toBeUndefined();
    expect(forC.context.rank).toBeUndefined();
    expect(forA.context.rank).toBe('squid'); // the layer knows their own set
  });

  it('nothing in a redacted stream or view carries a seed, rngState or entropy', () => {
    const state = makeState({ playerIds: ids, hands: { a: [card('herring')], b: [], c: [] } });
    for (const v of [redactForPlayer(state, 'a'), redactForSpectator(state)]) {
      const text = JSON.stringify(v);
      for (const k of ['seed', 'rngState', 'entropy']) expect(text).not.toContain(`"${k}"`);
    }
  });

  it('carries the driver\'s seq stamp through, and drops events without placeholders', () => {
    const fish = cards('clownfish', 4);
    const state = makeState({ playerIds: ids, hands: { a: fish, b: [], c: [] }, powerVisibility: 'ascuns' });
    state.usedPowerHistory.push({ rank: 'shark', grantId: 'old', wasClownfishCopy: false });
    const { state: s, events } = reduce(state, { type: 'LAY_SET', playerId: 'a', rank: 'clownfish', cardIds: fish.map((c) => c.id) });
    const stamped = events.map((e, i) => ({ ...e, seq: 100 + i }));
    const own = redactEventsForPlayer(s, stamped, 'a');
    const other = redactEventsForPlayer(s, stamped, 'b');
    expect(own.map((e) => e.seq)).toEqual(stamped.map((e) => e.seq));
    expect(other.length).toBe(own.length - 1);
    for (let i = 1; i < other.length; i++) expect(other[i].seq!).toBeGreaterThan(other[i - 1].seq!);
  });

  it('the view carries the tally and the stall gate', () => {
    const state = makeState({ playerIds: ids, hands: { a: [card('herring')], b: [], c: [] } });
    state.staleRequestStreak = 4;
    state.laidSets.push(laidSet('a', 'herring', 3));
    const v = redactForPlayer(state, 'b', { seq: 9, serverNow: 1234, windowDeadlineAt: null });
    expect(v.sets).toEqual({ possible: 17, start: 18 });
    expect(v.endPressure).toEqual({ misses: 4, limit: 6 });
    expect(v.seq).toBe(9);
    expect(v.serverNow).toBe(1234);
  });

  it('the view carries the window deadline the driver armed', () => {
    const state = makeState({ playerIds: ids, hands: { a: [card('herring')], b: [card('carp')], c: [] } });
    const { state: s } = reduce(state, { type: 'REQUEST', playerId: 'a', targetId: 'b', rank: 'herring' });
    const v = redactForPlayer(s, 'b', { windowDeadlineAt: 5000, serverNow: 1000 });
    expect(v.pendingWindow).toMatchObject({ type: 'RESPONSE_PENDING', youAreEligible: true, deadlineAt: 5000 });
    expect(redactForPlayer(s, 'c', { windowDeadlineAt: 5000 }).pendingWindow?.youAreEligible).toBe(false);
  });
});
