import { describe, expect, it } from 'vitest';
import { reduce } from '../src/engine.js';
import { publicSetFacts, publicSetsPossible, PublicSetFact, setsPossible, SETS_AT_START } from '../src/setsPossible.js';
import { redactForPlayer, redactForSpectator } from '../src/redact.js';
import { GameState, NORMAL_RANKS, POWER_RANKS } from '../src/types.js';
import { card, cards, laidSet, makeState } from './helpers.js';
import { endgame } from './endgamePair.js';

/** The same facts with every true rank — the server's knowledge. TEST ONLY: a rule that read this
 *  would leak (that is the whole point of the endgame pair). */
function trueFacts(state: GameState): PublicSetFact[] {
  return state.laidSets.map((s) => ({ rank: s.rank, reals: s.cardIds.length - s.eggCount, eggs: s.eggCount }));
}

describe('sets still possible — the public tally', () => {
  it('starts at 18: eight normal sets, nine power sets and the eggs', () => {
    expect(SETS_AT_START).toBe(18);
    expect(setsPossible([])).toBe(18);
  });

  it('every laid set takes one off, until the deck is spent', () => {
    const facts: PublicSetFact[] = [];
    let last = 18;
    for (const r of NORMAL_RANKS) {
      facts.push({ rank: r, reals: 3, eggs: 0 });
      const k = setsPossible(facts);
      expect(k).toBeLessThanOrEqual(last);
      last = k;
    }
    for (const r of POWER_RANKS) {
      facts.push({ rank: r, reals: 4, eggs: 0 });
      const k = setsPossible(facts);
      expect(k).toBeLessThanOrEqual(last);
      last = k;
    }
    facts.push({ rank: 'eggs', reals: 0, eggs: 4 });
    expect(setsPossible(facts)).toBe(0);
  });

  it('a face-down set is placed on whichever rank leaves the most sets', () => {
    // one hidden 4-real power set: it sits on one of nine ranks; the rest stay available
    const k = setsPossible([{ rank: null, reals: 4, eggs: 0 }]);
    expect(k).toBe(17);
  });

  it('the endgame pair: two face-down 2+2 sets give both worlds the SAME count, and the same end', () => {
    const A = endgame(['squid', 'squid']);
    const B = endgame(['squid', 'whale']);
    // byte-identical public records
    expect(JSON.stringify(redactForSpectator(A))).toBe(JSON.stringify(redactForSpectator(B)));
    expect(JSON.stringify(publicSetFacts(A))).toBe(JSON.stringify(publicSetFacts(B)));
    // the omniscient count differs — checking true ranks would end B at once and not A
    expect(setsPossible(trueFacts(A))).toBeGreaterThan(0);
    expect(setsPossible(trueFacts(B))).toBe(0);
    // the public count cannot tell them apart, and is not 0 (a set is possible as far as the record shows)
    expect(publicSetsPossible(A)).toBe(publicSetsPossible(B));
    expect(publicSetsPossible(A)).toBeGreaterThan(0);
    // the views every player would be sent agree on it too
    for (const s of [A, B]) for (const id of ['a', 'b', 'c']) expect(redactForPlayer(s, id).sets.possible).toBe(publicSetsPossible(A));
  });

  it('the count is an upper bound: never below the true count, in the pair', () => {
    for (const hidden of [['squid', 'squid'], ['squid', 'whale']] as const) {
      const s = endgame([...hidden]);
      expect(publicSetsPossible(s)).toBeGreaterThanOrEqual(setsPossible(trueFacts(s)));
    }
  });

  it('a garbled record (a hand-built set with no cards) never ends a game early', () => {
    const s = makeState({ playerIds: ['a', 'b', 'c'], hands: {} });
    s.laidSets.push({ ...laidSet('a', 'squid', 4, 0, { faceUp: false }), cardIds: [] });
    expect(publicSetsPossible(s)).toBeGreaterThan(0);
  });

  it('Mode Deschis: a used power set turns face down but its rank stays counted (the count never rises)', () => {
    const s = makeState({ playerIds: ['a', 'b', 'c'], hands: {}, powerVisibility: 'deschis' });
    s.laidSets.push(laidSet('a', 'shark', 4, 0, { faceUp: true }));
    const before = publicSetsPossible(s);
    // the shark is used: the set flips face down (spent) and the view stops naming its rank...
    s.laidSets[0].faceUp = false;
    s.laidSets[0].spent = true;
    expect(redactForPlayer(s, 'b').laidSets[0].rank).toBeNull();
    // ...but the rank was public when it was laid, so the count must not forget it
    expect(publicSetsPossible(s)).toBe(before);
    expect(before).toBe(17);
  });

  it('Mode Ascuns: a face-down set that is never revealed keeps its rank hidden', () => {
    const s = makeState({ playerIds: ['a', 'b', 'c'], hands: {}, powerVisibility: 'ascuns' });
    s.laidSets.push(laidSet('a', 'shark', 4, 0, { faceUp: false }));
    expect(publicSetFacts(s)[0].rank).toBeNull();
  });
});

describe('the public end rule (§11.2)', () => {
  /** Everything laid except a herring set in a's hand; b holds two stranded cards. */
  function almostDone(): GameState {
    const herrings = cards('herring', 3);
    const s = makeState({
      playerIds: ['a', 'b', 'c'],
      hands: { a: herrings, b: [card('carp'), card('whale')], c: [card('eggs')] },
      pool: [],
    });
    for (const r of NORMAL_RANKS) {
      if (r === 'herring') continue;
      if (r === 'carp') s.laidSets.push(laidSet('a', r, 2, 1)); // one carp is stranded
      else s.laidSets.push(laidSet('a', r, 3));
    }
    for (const r of POWER_RANKS) {
      if (r === 'whale') s.laidSets.push(laidSet('a', r, 3, 1, { faceUp: true })); // one whale is stranded
      else s.laidSets.push(laidSet('a', r, 4, 0, { faceUp: true }));
    }
    s.laidSets.push(laidSet('a', 'eggs', 0, 4)); // eggs so far: 1 + 1 + 4 = 6
    return s;
  }

  it('the last set is announced (the count is 1), and laying it ends the game as "decided"', () => {
    const s = almostDone();
    expect(publicSetsPossible(s)).toBe(1);
    const { state, events } = reduce(s, {
      type: 'LAY_SET',
      playerId: 'a',
      rank: 'herring',
      cardIds: s.players[0].hand.map((c) => c.id),
    });
    expect(state.status).toBe('ENDED');
    expect(state.endReason).toBe('decided');
    expect(events[events.length - 1]).toMatchObject({ type: 'GAME_ENDED', reason: 'decided' });
    // b still holds real cards: this was not the "exhausted" rule
    expect(state.players[1].hand.length).toBe(2);
    expect(redactForPlayer(state, 'b').sets.possible).toBe(0);
  });

  it('does not end while a window is open, only once the last lay has fully resolved', () => {
    const s = almostDone();
    // a Mantis holder exists, but herring is a normal set, so no SET_COMPLETED window opens;
    // open a request window by hand instead and lay nothing: no reduce may end the game.
    expect(s.status).toBe('IN_PROGRESS');
    const r = reduce(s, { type: 'REQUEST', playerId: 'a', targetId: 'b', rank: 'herring' });
    expect(r.state.pendingWindow?.type).toBe('RESPONSE_PENDING');
    expect(r.state.status).toBe('IN_PROGRESS');
  });

  it('a game is not ended while a set is still possible as far as the record shows', () => {
    const A = endgame(['squid', 'squid']);
    const r = reduce(A, { type: 'REQUEST', playerId: 'a', targetId: 'c', rank: 'whale' });
    expect(r.state.status).toBe('IN_PROGRESS');
  });

  it('the 2N rule now reports "streak" and running out of cards reports "exhausted"', () => {
    let s = endgame(['squid', 'squid']);
    let events = [] as ReturnType<typeof reduce>['events'];
    // players a, b ask c for a whale (c holds none) until 2N = 6 misses: the game stalls
    for (let i = 0; i < 12 && s.status === 'IN_PROGRESS'; i++) {
      const asker = s.players[s.currentPlayerIndex].id;
      const target = asker === 'c' ? 'a' : 'c';
      const asked = reduce(s, { type: 'REQUEST', playerId: asker, targetId: target, rank: 'whale' });
      const closed = reduce(asked.state, { type: 'SKIP_WINDOW', playerId: target });
      s = closed.state;
      events = closed.events;
    }
    expect(s.status).toBe('ENDED');
    expect(s.endReason).toBe('streak');
    expect(events.find((e) => e.type === 'GAME_ENDED')).toMatchObject({ reason: 'streak' });

    const herrings = cards('herring', 3);
    const done = makeState({ playerIds: ['a', 'b'], hands: { a: herrings, b: [] }, pool: [] });
    const { state } = reduce(done, { type: 'LAY_SET', playerId: 'a', rank: 'herring', cardIds: herrings.map((c) => c.id) });
    expect(state.endReason).toBe('exhausted');
  });
});
