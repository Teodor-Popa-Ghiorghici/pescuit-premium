import { describe, expect, it } from 'vitest';
import { BEAT, DARK_AT, chainAfter, clockTarget, cuesFor, darkStepOf, localAnswerCue, type CueRequest, type PowerMode, type PublicEvent, type PublicRecord, type PublicView, type SeatFacts } from '../src/audio/cues.js';
import { CUES, FRAME_BREAKERS, cueDef, durationOf } from '../src/audio/cuesheet.js';
import { chainPitch } from '../src/audio/variation.js';

/* Four players at a table, a, b, c, d. Steps are built the way the UI's adapter builds them: the events that
 * arrived plus the public view before and after. */
const PLAYERS = ['a', 'b', 'c', 'd'];
const view = (over: Partial<PublicView> = {}): PublicView => ({ players: PLAYERS, currentPlayerId: 'a', poolCount: 10, window: null, setsPossible: 14, ...over });
const RP = (asker = 'a', target = 'b') => ({ type: 'RESPONSE_PENDING', askerId: asker, targetId: target, deadlineAt: 50_000 });
const rec = (seq: number, before: PublicView | null, after: PublicView, events: PublicEvent[] = [], mode: PowerMode = 'ascuns', extra: Partial<PublicRecord> = {}): PublicRecord => ({ seq, mode, before, after, events, ...extra });
const facts = (playerId: string, over: Partial<SeatFacts> = {}): SeatFacts => ({ playerId, headphones: false, ...over });
const ids = (c: CueRequest[]) => c.map((x) => x.id);
/** what a viewer hears from a step: the cue, when, for how long, and how it is played */
const audible = (c: CueRequest[]) => c.map(({ id, at, durMs, params, seed }) => ({ id, at, durMs, params, seed }));

describe('Law 1: presentation never adds information (§3.2, §6.5 test 1)', () => {
  const ask = rec(10, view(), view({ window: RP() }), [{ type: 'REQUEST_MADE', askerId: 'a', targetId: 'b' }, { type: 'WINDOW_OPENED' }]);
  const no = (mode: PowerMode = 'ascuns') =>
    rec(11, view({ window: RP() }), view({ currentPlayerId: 'b', poolCount: 9 }), [
      { type: 'WINDOW_CLOSED' }, { type: 'REQUEST_FAILED', askerId: 'a', targetId: 'b' }, { type: 'DREW_FROM_POOL', playerId: 'a', poolEmpty: false }, { type: 'TURN_STARTED', playerId: 'b' },
    ], mode);

  it('the same public record gives identical cues whatever the private facts, for every non-target viewer', () => {
    const bystander = (over: Partial<SeatFacts>) => audible(cuesFor(no(), facts('c', over)));
    const base = bystander({});
    expect(base.length).toBeGreaterThan(0);
    expect(bystander({ eligible: true, eligibleBefore: false })).toEqual(base);
    expect(bystander({ eligible: false, eligibleBefore: true })).toEqual(base);
    expect(bystander({ grantRank: () => 'squid' })).toEqual(base);
    expect(bystander({ grantRank: () => 'whale' })).toEqual(base);
    expect(bystander({ headphones: true })).toEqual(base);
  });

  /** The private states: everything a server might send one client and not another, or that a bug might add. */
  const worlds = [
    { extra: { rank: 'squid', cardId: 'card-egg', grantId: 'g-1', unbound: true, boundRank: 'squid', setId: 's-1', sourceSetId: 's-1', eligiblePlayerIds: ['c'], context: { rank: 'squid', trueHasCards: true }, seed: 1 }, seq: 900,
      viewExtra: { hand: [{ id: 'x1', rank: 'squid' }, { id: 'x2', rank: 'eggs' }], ownPowerGrants: [{ id: 'g-1', rank: 'squid', used: false }], youAreEligible: true, laidSets: [{ id: 's-1', ownerId: 'a', isPowerSet: true, rank: 'squid', cardCount: 4, spent: true, destroyed: false }] },
      facts: { eligible: true, eligibleBefore: false, grantRank: () => 'squid' } as Partial<SeatFacts> },
    { extra: { rank: 'herring', cardId: 'card-shark', grantId: 'g-9', unbound: false, boundRank: 'whale', setId: 's-7', sourceSetId: 's-7', eligiblePlayerIds: ['a', 'b'], context: { rank: 'carp', trueHasCards: false }, seed: 77 }, seq: 31,
      viewExtra: { hand: [{ id: 'y1', rank: 'shark' }], ownPowerGrants: [], youAreEligible: false, laidSets: [{ id: 's-7', ownerId: 'a', isPowerSet: false, rank: null, cardCount: 3, spent: false, destroyed: true }] },
      facts: { eligible: false, eligibleBefore: true, grantRank: () => 'whale' } as Partial<SeatFacts> },
  ];
  const withPrivate = (r: PublicRecord, w: (typeof worlds)[number]): PublicRecord => ({
    ...r,
    seq: w.seq,
    events: r.events.map((e) => ({ ...e, ...w.extra }) as PublicEvent),
    before: r.before && ({ ...r.before, ...w.viewExtra } as PublicView),
    after: { ...r.after, ...w.viewExtra } as PublicView,
  });

  // one public step per kind of event the client receives (Squid has none: it is absent by construction)
  const STEPS: Array<[string, PublicRecord]> = [
    ['GAME_STARTED', rec(1, null, view({ setsPossible: 18 }), [{ type: 'GAME_STARTED' }, { type: 'TURN_STARTED', playerId: 'a' }])],
    ['TURN_STARTED', rec(2, view(), view({ currentPlayerId: 'b' }), [{ type: 'TURN_STARTED', playerId: 'b' }])],
    ['BONUS_TURN', rec(3, view(), view(), [{ type: 'BONUS_TURN', playerId: 'a' }, { type: 'TURN_STARTED', playerId: 'a' }], 'ascuns', { chain: 2 })],
    ['TURN_SKIPPED_STUNNED', rec(4, view(), view(), [{ type: 'TURN_SKIPPED_STUNNED', playerId: 'b' }, { type: 'TURN_STARTED', playerId: 'c' }])],
    ['HAND_REFILLED', rec(5, view(), view(), [{ type: 'HAND_REFILLED', playerId: 'a', count: 3 }])],
    ['REQUEST_MADE', rec(6, view(), view({ window: RP() }), [{ type: 'REQUEST_MADE', askerId: 'a', targetId: 'b' }, { type: 'WINDOW_OPENED' }])],
    ['REQUEST_SUCCEEDED', rec(7, view({ window: RP() }), view(), [{ type: 'WINDOW_CLOSED' }, { type: 'REQUEST_SUCCEEDED', askerId: 'a', targetId: 'b', count: 2 }, { type: 'BONUS_TURN', playerId: 'a' }])],
    ['REQUEST_FAILED (wet)', rec(8, view({ window: RP() }), view({ poolCount: 9 }), [{ type: 'WINDOW_CLOSED' }, { type: 'REQUEST_FAILED', askerId: 'a', targetId: 'b' }, { type: 'DREW_FROM_POOL', playerId: 'a', poolEmpty: false }])],
    ['REQUEST_FAILED (dry)', rec(9, view({ window: RP(), poolCount: 0 }), view({ poolCount: 0 }), [{ type: 'WINDOW_CLOSED' }, { type: 'REQUEST_FAILED', askerId: 'a', targetId: 'b' }])],
    ['DREW_FROM_POOL (last card)', rec(10, view({ poolCount: 1 }), view({ poolCount: 0 }), [{ type: 'DREW_FROM_POOL', playerId: 'a', poolEmpty: true }])],
    ['SET_LAID, normal, 1 egg', rec(11, view({ setsPossible: 15 }), view({ setsPossible: 14 }), [{ type: 'SET_LAID', playerId: 'a', isPowerSet: false, eggCount: 1 }])],
    ['SET_LAID, power, hidden', rec(12, view(), view(), [{ type: 'SET_LAID', playerId: 'a', isPowerSet: true, eggCount: 2 }, { type: 'POWER_GRANTED', playerId: 'a' }])],
    ['SET_LAID, power, open', rec(13, view(), view(), [{ type: 'SET_LAID', playerId: 'a', isPowerSet: true, eggCount: 0 }, { type: 'POWER_GRANTED', playerId: 'a' }], 'deschis')],
    ['SET_DESTROYED', rec(14, view(), view(), [{ type: 'POWER_USED', playerId: 'a', rank: 'mantisShrimp' }, { type: 'SET_DESTROYED', setId: 's-1' }])],
    ['SHARK_JUMP', rec(15, view(), view(), [{ type: 'POWER_USED', playerId: 'a', rank: 'shark' }, { type: 'SHARK_JUMP', playerId: 'a' }], 'deschis')],
    ['LANTERNFISH_REFLECT', rec(16, view(), view(), [{ type: 'POWER_USED', playerId: 'b', rank: 'lanternfish' }, { type: 'LANTERNFISH_REFLECT', playerId: 'b', fromId: 'a' }])],
    ['TORTOISE_BLOCK', rec(17, view(), view(), [{ type: 'POWER_USED', playerId: 'b', rank: 'tortoise' }, { type: 'TORTOISE_BLOCK', playerId: 'b' }])],
    ['JELLYFISH_STUN', rec(18, view(), view(), [{ type: 'POWER_USED', playerId: 'a', rank: 'jellyfish' }, { type: 'JELLYFISH_STUN', playerId: 'a', targetId: 'b' }])],
    ['STICKLEBACK_STEAL', rec(19, view(), view(), [{ type: 'POWER_USED', playerId: 'a', rank: 'stickleback' }, { type: 'STICKLEBACK_STEAL', playerId: 'a', targetId: 'b' }])],
    ['STICKLEBACK_WASTED', rec(20, view(), view(), [{ type: 'POWER_USED', playerId: 'a', rank: 'stickleback' }, { type: 'STICKLEBACK_WASTED', playerId: 'a', targetId: 'b' }])],
    ['WHALE_SHUFFLE', rec(21, view(), view(), [{ type: 'POWER_USED', playerId: 'a', rank: 'whale' }, { type: 'WHALE_SHUFFLE', playerId: 'a' }], 'deschis')],
    ['CLOWNFISH_BOUND (open)', rec(22, view(), view(), [{ type: 'CLOWNFISH_BOUND', playerId: 'a' }], 'deschis')],
    ['CLOWNFISH_BOUND (owner only)', rec(23, view(), view(), [{ type: 'CLOWNFISH_BOUND', playerId: 'a' }])],
    ['the tally crosses 12', rec(24, view({ setsPossible: 13 }), view({ setsPossible: 12 }), [{ type: 'SET_LAID', playerId: 'a', isPowerSet: false }])],
    ['the last set', rec(25, view({ setsPossible: 2 }), view({ setsPossible: 1 }), [{ type: 'SET_LAID', playerId: 'a', isPowerSet: false }])],
    ['GAME_ENDED', rec(26, view({ setsPossible: 1 }), view({ setsPossible: 0, scores: { a: 4, b: 3, c: 3, d: 1 } }), [{ type: 'GAME_ENDED', winners: ['a'] }])],
    ['the answer window leaves', rec(27, view({ window: RP() }), view({ window: { type: 'TURN_END', askerId: 'a', targetId: 'b' } }), [{ type: 'WINDOW_CLOSED' }])],
  ];

  it.each(STEPS)('%s: two different private states, the same public event: the same cue ids, delays and durations - for every viewer', (_name, step) => {
    for (const viewer of PLAYERS) {
      const [w1, w2] = worlds;
      const one = cuesFor(withPrivate(step, w1), facts(viewer, w1.facts));
      const two = cuesFor(withPrivate(step, w2), facts(viewer, w2.facts));
      expect(two.map((c) => c.id), `${viewer} ids`).toEqual(one.map((c) => c.id));
      expect(two.map((c) => c.at), `${viewer} delays`).toEqual(one.map((c) => c.at));
      expect(two.map((c) => c.durMs), `${viewer} durations`).toEqual(one.map((c) => c.durMs));
      // and everything else about how they are played: take, pitch, gain, seed
      expect(audible(two), viewer).toEqual(audible(one));
      // the un-stuffed record is the same again: private fields are not inputs at all
      expect(audible(cuesFor(step, facts(viewer)))).toEqual(audible(one));
    }
  });

  it('two face-down power sets of different ranks sound the same in Mode Ascuns, to their owner and to everyone', () => {
    const grant = (rank: string | null) => rec(20, view(), view(), [
      { type: 'SET_LAID', playerId: 'a', isPowerSet: true },
      { type: 'POWER_GRANTED', playerId: 'a', grantId: 'g1', rank },
    ]);
    for (const viewer of ['a', 'b', 'c']) {
      const ref = audible(cuesFor(grant(null), facts(viewer)));
      for (const rank of ['squid', 'whale', 'shark', 'clownfish', 'mantisShrimp'])
        expect(audible(cuesFor(grant(rank), facts(viewer, { grantRank: () => rank }))), `${viewer} ${rank}`).toEqual(ref);
    }
    expect(ids(cuesFor(grant(null), facts('a')))).toEqual(['table.lay.hidden', 'power.granted']);
  });

  it('a set laid: hidden or open is the mode and the category, never the rank', () => {
    const lay = (mode: PowerMode, isPowerSet: boolean, rank: string | null) => rec(21, view(), view(), [{ type: 'SET_LAID', playerId: 'a', isPowerSet, rank }], mode);
    for (const rank of [null, 'squid', 'herring', 'whale']) {
      expect(ids(cuesFor(lay('ascuns', true, rank), facts('b')))).toEqual(['table.lay.hidden']);
      expect(ids(cuesFor(lay('deschis', true, rank), facts('b')))).toEqual(['table.lay.power']);
      expect(ids(cuesFor(lay('ascuns', false, rank), facts('b')))).toEqual(['table.lay']);
      expect(ids(cuesFor(lay('deschis', false, rank), facts('b')))).toEqual(['table.lay']);
    }
  });

  it('eggs: one clay tick per egg of the set laid, from the set laid only - never a draw, a refill, a hand-over', () => {
    const laid = (n: number) => rec(22, view(), view(), [{ type: 'SET_LAID', playerId: 'a', isPowerSet: false, eggCount: n }]);
    expect(ids(cuesFor(laid(0), facts('b')))).toEqual(['table.lay']);
    for (const n of [1, 2, 4]) {
      const egg = cuesFor(laid(n), facts('b')).find((c) => c.id === 'table.egg')!;
      expect(egg.params?.count).toBe(n);
      expect(egg.durMs).toBe(durationOf('table.egg', { count: n }));
    }
    expect(durationOf('table.egg', { count: 4 })).toBeGreaterThan(durationOf('table.egg', { count: 1 }));
    // a draw is a draw, whatever card it is
    for (const cardId of ['egg-1', 'shark-2', 'herring-3']) {
      const draw = rec(23, view(), view({ poolCount: 9 }), [{ type: 'DREW_FROM_POOL', playerId: 'a', cardId } as PublicEvent]);
      expect(ids(cuesFor(draw, facts('a')))).toEqual(['table.draw']);
    }
    expect(ids(cuesFor(rec(24, view(), view(), [{ type: 'HAND_REFILLED', playerId: 'a', count: 3 }]), facts('a')))).toEqual(['table.refill']);
    expect(ids(cuesFor(rec(25, view({ window: RP() }), view(), [{ type: 'REQUEST_SUCCEEDED', askerId: 'a', targetId: 'b', count: 2 }]), facts('a')))).not.toContain('table.egg');
  });

  it('there is no private tier: no cue is heard by one client and not another because of what only that client knows', () => {
    for (const c of CUES) expect(['all', 'local', 'you'], c.id).toContain(c.heard);
    for (const gone of ['clock.eligible', 'power.granted.mine']) expect(CUES.map((c) => c.id)).not.toContain(gone);
    const grant = rec(20, view(), view(), [{ type: 'POWER_GRANTED', playerId: 'a', grantId: 'g1', rank: null }]);
    for (const rank of ['whale', 'squid', 'shark']) for (const viewer of ['a', 'b']) expect(ids(cuesFor(grant, facts(viewer, { headphones: true, grantRank: () => rank })))).toEqual(['power.granted']);
    // a structural window opens: nothing, even for the player who could act in it
    const open = rec(7, view(), view({ window: { type: 'TURN_END', askerId: 'a', targetId: 'b' } }), [{ type: 'WINDOW_OPENED' }]);
    for (const viewer of PLAYERS) expect(cuesFor(open, facts(viewer, { eligible: true, eligibleBefore: false, headphones: true }))).toEqual([]);
  });

  it('a Clownfish bound: heard by everyone in Mode Deschis, and by no one in Ascuns (the event reaches only its owner, who says nothing either)', () => {
    const bound = (mode: PowerMode) => rec(30, view(), view(), [{ type: 'CLOWNFISH_BOUND', playerId: 'a', boundRank: 'shark' }], mode);
    for (const viewer of PLAYERS) {
      expect(cuesFor(bound('ascuns'), facts(viewer, { headphones: true }))).toEqual([]);
      expect(ids(cuesFor(bound('deschis'), facts(viewer)))).toEqual(['power.clownfish.bound']);
    }
  });

  it('different hands behind the same public actions: hand contents are not an input at all', () => {
    const a = cuesFor(no(), facts('c'));
    const b = cuesFor(no(), { ...facts('c'), hand: ['x', 'y'], hidden: 'squid' } as SeatFacts);
    expect(audible(b)).toEqual(audible(a));
  });

  it('the endgame pair: the same public tally gives the same sound, so the same end', () => {
    // two face-down 2+2 sets that are Squid+Squid in one history and Squid+Whale in the other: the public record
    // is identical, so is the tally, so is the last-set cue
    const step = (setsPossible: number) => rec(40, view({ setsPossible: 2 }), view({ setsPossible }), [{ type: 'SET_LAID', playerId: 'a', isPowerSet: false }]);
    expect(ids(cuesFor(step(1), facts('a')))).toEqual(['table.lay', 'world.notch', 'world.dark.01']);
    expect(ids(cuesFor(step(1), facts('c')))).toEqual(['table.lay', 'world.notch', 'world.dark.01']);
    expect(ids(cuesFor(step(2), facts('a')))).toEqual(['table.lay']);
  });

  it('viewers differ only by the public facts of their own seat: your turn, you were asked', () => {
    const turn = rec(50, view(), view({ currentPlayerId: 'b' }), [{ type: 'TURN_STARTED', playerId: 'b' }]);
    expect(ids(cuesFor(turn, facts('a')))).toEqual(['table.turn']);
    expect(ids(cuesFor(turn, facts('b')))).toEqual(['table.turn.you']);
    expect(cuesFor(turn, facts('a'))[0].params).toEqual(cuesFor(turn, facts('b'))[0].params); // same seat signature
    // the target hears the roll, nobody else does
    expect(ids(cuesFor(ask, facts('b')))).toEqual(['table.ask', 'table.asked']);
    for (const v of ['a', 'c', 'd']) expect(ids(cuesFor(ask, facts(v))), v).toEqual(['table.ask']);
  });

  it('the ask carries the target\'s seat signature and how it is played - nothing else about the ask', () => {
    const c = cuesFor(ask, facts('c'))[0];
    expect(Object.keys(c.params!).sort()).toEqual(['gainDb', 'pitch', 'seat', 'take']);
    expect(c.params!.seat).toBe(1);
  });
});

describe('Squid never sounds, in any form', () => {
  it('there is no Squid cue, and no rank is read to find one: Squid is silent because it has no event, not because a check catches it', () => {
    for (const c of CUES) expect(c.id).not.toMatch(/squid/i);
    // the engine emits no POWER_USED for a Squid (engine/test/powers/squid.test.ts); the mapping never looks at the rank of one
    for (const rank of ['squid', 'whale', 'anything'])
      expect(audible(cuesFor(rec(60, view(), view(), [{ type: 'POWER_USED', playerId: 'a', rank }], 'ascuns'), facts('a')))).toEqual(audible(cuesFor(rec(60, view(), view(), [{ type: 'POWER_USED', playerId: 'a', rank: 'shark' }], 'ascuns'), facts('a'))));
  });
  it('a Squid grant sounds exactly as any other grant does: the one uniform cue, in both modes', () => {
    const g = (mode: PowerMode, rank: string) => audible(cuesFor(rec(61, view(), view(), [{ type: 'POWER_GRANTED', playerId: 'a', rank }], mode), facts('b')));
    for (const mode of ['ascuns', 'deschis'] as PowerMode[]) {
      const squid = g(mode, 'squid');
      expect(squid.map((c) => c.id)).toEqual(['power.granted']);
      for (const rank of ['whale', 'shark', 'mantisShrimp', 'clownfish']) expect(g(mode, rank), `${mode} ${rank}`).toEqual(squid);
    }
  });
  it('no event can carry a Squid rank into a cue', () => {
    for (const mode of ['ascuns', 'deschis'] as PowerMode[])
      for (const e of [
        { type: 'POWER_USED', playerId: 'a', rank: 'squid' },
        { type: 'POWER_GRANTED', playerId: 'a', rank: 'squid', grantId: 'g' },
        { type: 'CLOWNFISH_BOUND', playerId: 'a', boundRank: 'squid' },
      ] as PublicEvent[])
        for (const viewer of ['a', 'b'])
          for (const c of cuesFor(rec(62, view(), view(), [e], mode), facts(viewer, { headphones: true, grantRank: () => 'squid' })))
            expect(JSON.stringify(c)).not.toMatch(/squid/i);
  });
  it('an honest "no", a Squid deny and a Squid claim are one public record, so they sound as one for every viewer', () => {
    // the engine emits WINDOW_CLOSED > REQUEST_FAILED > DREW_FROM_POOL > TURN_STARTED for all three (engine/test/powers/squid.test.ts);
    // what differs is private to the target, and a private difference is not an input
    const events: PublicEvent[] = [{ type: 'WINDOW_CLOSED' }, { type: 'REQUEST_FAILED', askerId: 'a', targetId: 'b' }, { type: 'DREW_FROM_POOL', playerId: 'a', poolEmpty: false }, { type: 'TURN_STARTED', playerId: 'b' }];
    const record = rec(63, view({ window: RP() }), view({ window: null, currentPlayerId: 'b', poolCount: 9 }), events);
    for (const viewer of PLAYERS) {
      const honest = audible(cuesFor(record, facts(viewer)));
      const deny = audible(cuesFor(record, facts(viewer, { grantRank: () => 'squid', eligible: true })));
      const claim = audible(cuesFor({ ...record, seq: 5, events: events.map((e) => ({ ...e, lie: 'claim' }) as unknown as PublicEvent) }, facts(viewer, { grantRank: () => 'squid' })));
      expect(deny).toEqual(honest);
      expect(claim).toEqual(honest);
    }
  });
});

describe('structural windows are never voiced; the answer window closes when it leaves the view (§6.5 test 2)', () => {
  const T = (s: string) => ({ type: s, askerId: 'a', targetId: 'b' });
  /** history A: the answer leads straight to the next turn. History B: a structural window comes between. */
  const answered = (structural: string | null) => {
    const step1 = rec(1, view(), view({ window: RP() }), [{ type: 'REQUEST_MADE', askerId: 'a', targetId: 'b' }]);
    const outcomeEvents: PublicEvent[] = [{ type: 'REQUEST_FAILED', askerId: 'a', targetId: 'b' }, { type: 'DREW_FROM_POOL', playerId: 'a', poolEmpty: false }];
    if (!structural) {
      const step2 = rec(2, view({ window: RP() }), view({ currentPlayerId: 'b', poolCount: 9 }), [{ type: 'WINDOW_CLOSED' }, ...outcomeEvents, { type: 'TURN_STARTED', playerId: 'b' }]);
      return [step1, step2];
    }
    const step2 = rec(2, view({ window: RP() }), view({ poolCount: 9, window: T(structural) }), [{ type: 'WINDOW_CLOSED' }, ...outcomeEvents, { type: 'WINDOW_OPENED' }]);
    const step3 = rec(3, step2.after, view({ currentPlayerId: 'b', poolCount: 9 }), [{ type: 'WINDOW_CLOSED' }, { type: 'TURN_STARTED', playerId: 'b' }]);
    return [step1, step2, step3];
  };
  /** the audible output of a sequence of steps, on an absolute clock: step `i` is presented at times[i]; the ordinal counts the cues handed out, as the presenter does */
  const play = (steps: PublicRecord[], viewer: string, times: number[]) => {
    let ordinal = 0;
    return steps.flatMap((s, i) => {
      const cues = cuesFor({ ...s, ordinal }, facts(viewer));
      ordinal += cues.length;
      return cues.map((c) => ({ id: c.id, params: c.params, durMs: c.durMs, seed: c.seed, t: times[i] + c.at }));
    }).sort((x, y) => x.t - y.t);
  };

  it.each(['TURN_END', 'TRANSFER_PENDING', 'TURN_START', 'REQUEST_DECLARED', 'SET_COMPLETED'])('%s in the way: same cue ids, parameters and order; times shifted only by its pause', (win) => {
    const A = answered(null);
    const B = answered(win);
    for (const viewer of ['a', 'b', 'c']) {
      const a = play(A, viewer, [0, 3000]);
      const pause = 1500; // the structural window's pause: step 3 lands later by this much
      const b = play(B, viewer, [0, 3000, 3000 + pause]);
      expect(b.map((x) => x.id), viewer).toEqual(a.map((x) => x.id));
      expect(b.map((x) => x.params), viewer).toEqual(a.map((x) => x.params));
      expect(b.map((x) => x.durMs), viewer).toEqual(a.map((x) => x.durMs));
      expect(b.map((x) => x.seed), viewer).toEqual(a.map((x) => x.seed));
      a.forEach((x, i) => {
        const shift = b[i].t - x.t;
        expect(shift === 0 || shift === pause, `${x.id} shifted by ${shift}`).toBe(true);
      });
      expect(b.some((x) => x.id === 'clock.close'), 'the close still fires').toBe(true);
    }
  });

  it('clock.close fires when RESPONSE_PENDING leaves the view, whatever replaces it - an answer, a timeout, a server skip', () => {
    const rp = view({ window: RP() });
    for (const replacement of [null, T('TURN_START'), T('TURN_END'), T('TRANSFER_PENDING'), T('SET_COMPLETED'), { type: 'RESPONSE_PENDING', askerId: 'a', targetId: 'c' }]) {
      const step = rec(3, rp, view({ window: replacement }), [{ type: 'WINDOW_CLOSED' }]);
      for (const viewer of ['a', 'b', 'c', 'd']) expect(ids(cuesFor(step, facts(viewer))).filter((i) => i === 'clock.close'), `${JSON.stringify(replacement)} for ${viewer}`).toHaveLength(1);
    }
    // ... and with no events at all: the close is a diff, not an event (a timeout has none of its own)
    expect(ids(cuesFor(rec(3, rp, view()), facts('c')))).toEqual(['clock.close']);
  });

  it('it fires once: not while the window stays, not when a structural window merely opens or closes', () => {
    const rp = view({ window: RP() });
    expect(cuesFor(rec(4, rp, rp, []), facts('c'))).toEqual([]);
    expect(cuesFor(rec(5, view(), view({ window: T('TURN_END') }), [{ type: 'WINDOW_OPENED' }]), facts('c'))).toEqual([]);
    expect(cuesFor(rec(6, view({ window: T('TURN_END') }), view(), [{ type: 'WINDOW_CLOSED' }]), facts('c'))).toEqual([]);
  });

  it('the answering device plays the same cue at its press, and then not again when the window leaves the view', () => {
    const leave = rec(3, view({ window: RP() }), view({ poolCount: 9 }), [{ type: 'WINDOW_CLOSED' }]);
    const other = cuesFor(leave, facts('c')).find((c) => c.id === 'clock.close')!;
    expect(localAnswerCue(3).id).toBe(other.id);
    expect(localAnswerCue(3).durMs).toBe(other.durMs);
    expect(cuesFor(leave, facts('b', { closePlayedLocally: true })).map((c) => c.id)).not.toContain('clock.close');
    // one close per answer for every viewer, whoever plays it
    const heard = (v: string, local: boolean) => cuesFor(leave, facts(v, { closePlayedLocally: local })).map((c) => c.id).filter((i) => i === 'clock.close').length + (local ? 1 : 0);
    expect(heard('b', true)).toBe(heard('c', false));
  });

  it('a structural window opens, closes or times out with no cue and no tick, for anyone', () => {
    const open = rec(7, view(), view({ window: T('TURN_END') }), [{ type: 'WINDOW_OPENED' }]);
    for (const viewer of ['a', 'b', 'c']) expect(cuesFor(open, facts(viewer, { eligible: viewer === 'c', eligibleBefore: false }))).toEqual([]);
    expect(clockTarget(open.after)).toBeNull();
    // the timeout closes it through the same path as a pass: a WINDOW_CLOSED and nothing that says "timeout"
    const closed = rec(8, open.after, view(), [{ type: 'WINDOW_CLOSED' }]);
    for (const viewer of ['a', 'b', 'c']) expect(cuesFor(closed, facts(viewer))).toEqual([]);
  });

  it('the window clock is bound to the answer window only', () => {
    expect(clockTarget(view({ window: RP() }))).toMatchObject({ deadlineAt: 50_000 });
    expect(clockTarget(view({ window: { type: 'TURN_END', deadlineAt: 9 } }))).toBeNull();
    expect(clockTarget(null)).toBeNull();
    expect(clockTarget(view())).toBeNull();
  });
});

describe('what each event sounds like (SOUND_DESIGN §2)', () => {
  const f = facts('c');
  it('a successful ask: the flight, then the give; the asker keeps the turn with the bonus', () => {
    const r = rec(70, view({ window: RP() }), view({ poolCount: 10 }), [
      { type: 'WINDOW_CLOSED' }, { type: 'REQUEST_SUCCEEDED', askerId: 'a', targetId: 'b', count: 2 }, { type: 'BONUS_TURN', playerId: 'a' },
    ]);
    const got = cuesFor(r, f);
    expect(ids(got)).toEqual(['clock.close', 'table.flight', 'table.give', 'table.bonus']);
    expect(got.find((c) => c.id === 'table.give')!.params?.count).toBe(2);
    expect(got.find((c) => c.id === 'table.bonus')!.params?.seat).toBe(0);
  });
  it('go fish: wet with water in the pool, dry without, neutral either way', () => {
    const wet = rec(71, view({ window: RP(), poolCount: 3 }), view({ poolCount: 2 }), [{ type: 'REQUEST_FAILED', askerId: 'a', targetId: 'b' }, { type: 'DREW_FROM_POOL', playerId: 'a', poolEmpty: false }]);
    expect(ids(cuesFor(wet, f))).toEqual(['clock.close', 'table.gofish', 'table.draw']);
    const dry = rec(72, view({ window: RP(), poolCount: 0 }), view({ poolCount: 0 }), [{ type: 'REQUEST_FAILED', askerId: 'a', targetId: 'b' }]);
    expect(ids(cuesFor(dry, f))).toEqual(['clock.close', 'table.gofish.dry']);
    const last = rec(73, view({ window: RP(), poolCount: 1 }), view({ poolCount: 0 }), [{ type: 'REQUEST_FAILED', askerId: 'a', targetId: 'b' }, { type: 'DREW_FROM_POOL', playerId: 'a', poolEmpty: true }]);
    expect(ids(cuesFor(last, f))).toEqual(['clock.close', 'table.gofish', 'table.poolEmpty']);
  });
  it('powers: reveal in Ascuns, none in Deschis; a riser into the strike and its weight on the table for the three frame-breakers only', () => {
    const used = (mode: PowerMode) => rec(74, view(), view(), [{ type: 'POWER_USED', playerId: 'a', rank: 'mantisShrimp' }, { type: 'SET_DESTROYED', ownerId: 'b' }], mode);
    expect(ids(cuesFor(used('ascuns'), f))).toEqual(['power.reveal', 'power.windup', 'power.mantis', 'table.impact']);
    expect(ids(cuesFor(used('deschis'), f))).toEqual(['power.windup', 'power.mantis', 'table.impact']);
    const at = (mode: PowerMode, id: string) => cuesFor(used(mode), f).find((c) => c.id === id)!.at;
    // the riser ends exactly on the strike (a hard cue: on the beat); the effect and the impact land together
    expect(at('ascuns', 'power.windup') + BEAT.windup).toBe(BEAT.effect);
    expect(at('ascuns', 'power.mantis')).toBe(BEAT.effect);
    expect(at('ascuns', 'table.impact')).toBe(BEAT.effect);
    expect(at('deschis', 'power.mantis')).toBe(BEAT.effectOpen);
    expect(at('deschis', 'power.windup') + BEAT.windup).toBe(BEAT.effectOpen);
    const shark = rec(75, view(), view(), [{ type: 'POWER_USED', playerId: 'a', rank: 'shark' }, { type: 'SHARK_JUMP', playerId: 'a' }], 'deschis');
    expect(ids(cuesFor(shark, f))).toEqual(['power.windup', 'power.shark', 'table.impact']);
    const whale = rec(76, view(), view(), [{ type: 'POWER_USED', playerId: 'a', rank: 'whale' }, { type: 'WHALE_SHUFFLE', playerId: 'a' }], 'deschis');
    expect(ids(cuesFor(whale, f))).toEqual(['power.windup', 'power.whale', 'table.impact']);
    // the other five stay inside the palette: no impact, no riser
    const others: Array<[PublicEvent, string]> = [
      [{ type: 'TORTOISE_BLOCK', playerId: 'b' }, 'power.tortoise'],
      [{ type: 'JELLYFISH_STUN', playerId: 'a', targetId: 'b' }, 'power.jellyfish'],
      [{ type: 'LANTERNFISH_REFLECT', playerId: 'b', fromId: 'a' }, 'power.lanternfish'],
      [{ type: 'STICKLEBACK_STEAL', playerId: 'a', targetId: 'b' }, 'power.stickleback'],
      [{ type: 'STICKLEBACK_WASTED', playerId: 'a', targetId: 'b' }, 'power.stickleback.miss'],
    ];
    for (const [e, cue] of others) {
      const got = cuesFor(rec(77, view(), view(), [{ type: 'POWER_USED', playerId: 'a', rank: 'x' }, e], 'deschis'), f);
      expect(ids(got), e.type).toEqual([cue]);
      expect(FRAME_BREAKERS.has(cue)).toBe(false);
    }
  });
  it('Lanternfish: the reflector\'s bar comes back first, the asker\'s answers - both seats are public', () => {
    const r = rec(78, view(), view(), [{ type: 'LANTERNFISH_REFLECT', playerId: 'c', fromId: 'a' }]);
    const c = cuesFor(r, f).find((x) => x.id === 'power.lanternfish')!;
    expect(c.params).toMatchObject({ seat: 0, seat2: 2 });
  });
  it('the grant: one cue for every rank and both modes', () => {
    const g = (mode: PowerMode, rank: string | null) => audible(cuesFor(rec(76, view(), view(), [{ type: 'POWER_GRANTED', playerId: 'a', rank }], mode), f));
    const ref = g('ascuns', null);
    expect(ref.map((c) => c.id)).toEqual(['power.granted']);
    for (const mode of ['ascuns', 'deschis'] as PowerMode[]) for (const rank of [null, 'lanternfish', 'mantisShrimp', 'squid', 'whale']) expect(g(mode, rank)).toEqual(ref);
  });
  it('the game: the call to the table, the podium for everyone - who won is the podium\'s to say', () => {
    expect(ids(cuesFor(rec(1, null, view(), [{ type: 'GAME_STARTED' }, { type: 'HAND_REFILLED', playerId: 'a', count: 7 }, { type: 'TURN_STARTED', playerId: 'a' }]), f))).toEqual(['mus.start', 'table.turn']);
    const end = (winners: string[]) => rec(80, view(), view({ scores: { a: 2, b: 1, c: 1, d: 0 } }), [{ type: 'GAME_ENDED', winners }]);
    const heard = (winners: string[], who: string) => audible(cuesFor(end(winners), facts(who)));
    expect(heard(['c'], 'c').map((c) => c.id)).toContain('mus.podium');
    for (const who of ['a', 'c', 'spectator']) expect(heard(['c'], who)).toEqual(heard(['a', 'c'], 'a'));
    for (const c of CUES) expect(c.id).not.toMatch(/^mus\.end/);
  });
  it('the stall gate: shuts from N misses (half the 2N limit), opens when a capture resets it', () => {
    const at = (misses: number) => view({ endPressure: { misses, limit: 8 } });
    expect(ids(cuesFor(rec(90, at(2), at(3), []), f))).toEqual([]);
    expect(ids(cuesFor(rec(91, at(3), at(4), []), f))).toEqual(['amb.gate']);
    expect(cuesFor(rec(91, at(3), at(4), []), f)[0].params?.open).toBe(false);
    expect(cuesFor(rec(92, at(5), at(0), []), f)[0].params?.open).toBe(true);
  });
});

describe('the world: the rim and the light (SOUND_DESIGN §1.1)', () => {
  const tally = (from: number, to: number) => rec(100, view({ setsPossible: from }), view({ setsPossible: to }), [{ type: 'SET_LAID', playerId: 'a', isPowerSet: false }]);
  const f = facts('c');
  it('the steps are 12, 6 and 1, counted down', () => {
    expect(DARK_AT).toEqual([12, 6, 1]);
    expect([18, 13, 12, 7, 6, 2, 1, 0].map(darkStepOf)).toEqual([0, 0, 1, 1, 2, 2, 3, 3]);
    expect(darkStepOf(null)).toBe(0);
  });
  it('one chisel tick per notch that counts down, up to three, from the public tally alone', () => {
    expect(ids(cuesFor(tally(15, 15), f))).toEqual(['table.lay']);
    expect(ids(cuesFor(tally(15, 14), f))).toEqual(['table.lay', 'world.notch']);
    expect(ids(cuesFor(tally(15, 13), f))).toEqual(['table.lay', 'world.notch', 'world.notch']);
    expect(ids(cuesFor(tally(20, 10), f)).filter((i) => i === 'world.notch')).toHaveLength(3);
    // the tally going up (it cannot, but a rejoin might seem to) ticks nothing
    expect(ids(cuesFor(tally(10, 12), f))).toEqual(['table.lay']);
  });
  it('the light steps darker at 12, 6 and 1 - each with its knock, after the ticks; the last adds the bare horn', () => {
    expect(ids(cuesFor(tally(13, 12), f))).toEqual(['table.lay', 'world.notch', 'world.dark.12']);
    expect(ids(cuesFor(tally(7, 6), f))).toEqual(['table.lay', 'world.notch', 'world.dark.06']);
    expect(ids(cuesFor(tally(2, 1), f))).toEqual(['table.lay', 'world.notch', 'world.dark.01']);
    expect(ids(cuesFor(tally(12, 11), f))).not.toContain('world.dark.12'); // already dark
    const c = cuesFor(tally(13, 12), f);
    expect(c.find((x) => x.id === 'world.dark.12')!.params?.step).toBe(1);
    expect(c.find((x) => x.id === 'world.dark.12')!.at).toBeGreaterThan(c.find((x) => x.id === 'world.notch')!.at);
    // a lay that takes two notches across a step plays both ticks and the one knock
    expect(ids(cuesFor(tally(13, 11), f))).toEqual(['table.lay', 'world.notch', 'world.notch', 'world.dark.12']);
    // the tally is the same for every viewer
    for (const v of PLAYERS) expect(audible(cuesFor(tally(7, 6), facts(v)))).toEqual(audible(cuesFor(tally(7, 6), f)));
  });
});

describe('feel and variation (SOUND_DESIGN §5)', () => {
  const f = facts('c');
  const step = (n: number) => rec(200 + n, view({ window: RP(), poolCount: 6 }), view({ poolCount: 5 }), [{ type: 'WINDOW_CLOSED' }, { type: 'REQUEST_MADE', askerId: 'a', targetId: 'b' }, { type: 'REQUEST_FAILED', askerId: 'a', targetId: 'b' }, { type: 'DREW_FROM_POOL', playerId: 'a', poolEmpty: false }, { type: 'TURN_STARTED', playerId: 'b' }], 'ascuns', { ordinal: n * 7 });
  const many = (n = 200) => Array.from({ length: n }, (_, i) => cuesFor(step(i), f)).flat();
  it('every cue carries its take, a pitch inside +-5 % (before the chain), a gain inside +-1.5 dB and a static duration', () => {
    for (const c of many()) {
      const def = cueDef(c.id)!;
      expect(c.params!.take, c.id).toBeGreaterThanOrEqual(0);
      expect(c.params!.take, c.id).toBeLessThan(def.variation);
      expect(c.params!.pitch!, c.id).toBeGreaterThanOrEqual(0.95 - 1e-9);
      expect(c.params!.pitch!, c.id).toBeLessThanOrEqual(1.05 + 1e-9);
      expect(Math.abs(c.params!.gainDb!), c.id).toBeLessThanOrEqual(1.5);
      expect(c.durMs, c.id).toBe(durationOf(c.id, c.params));
    }
  });
  it('a repeated cue uses all three takes', () => {
    for (const id of ['table.ask', 'table.turn', 'table.draw', 'table.gofish']) {
      const takes = new Set(many().filter((c) => c.id === id).map((c) => c.params!.take));
      expect([...takes].sort(), id).toEqual([0, 1, 2]);
    }
  });
  it('a hard knock lands on the beat; the answering knock lands 35-65 ms late', () => {
    for (const c of many()) {
      if (c.id === 'table.ask') expect(c.at).toBe(BEAT.askCue);
      if (c.id === 'table.gofish') {
        expect(c.at).toBeGreaterThanOrEqual(BEAT.gofish + 35);
        expect(c.at).toBeLessThanOrEqual(BEAT.gofish + 65);
      }
      if (c.id === 'clock.close') expect(c.at).toBe(0);
    }
    const give = cuesFor(rec(1, view({ window: RP() }), view(), [{ type: 'REQUEST_SUCCEEDED', askerId: 'a', targetId: 'b', count: 1 }]), f).find((c) => c.id === 'table.give')!;
    expect(give.at).toBeGreaterThanOrEqual(BEAT.give + 35);
    expect(give.at).toBeLessThanOrEqual(BEAT.give + 65);
  });
  it('the variation follows the cues handed out, not the room\'s seq: another seq, the same jitter; another ordinal, another', () => {
    const a = cuesFor(rec(100, view(), view(), [{ type: 'TURN_STARTED', playerId: 'b' }], 'ascuns', { ordinal: 5 }), f);
    const b = cuesFor(rec(9999, view(), view(), [{ type: 'TURN_STARTED', playerId: 'b' }], 'ascuns', { ordinal: 5 }), f);
    const c = cuesFor(rec(100, view(), view(), [{ type: 'TURN_STARTED', playerId: 'b' }], 'ascuns', { ordinal: 6 }), f);
    expect(a).toEqual(b);
    expect(a[0].seed).not.toBe(c[0].seed);
  });
  it('a chain of bonus turns rises a little in pitch: +1.2 % a step, five steps at most, back to the base with a new player', () => {
    const bonus = (chain: number) => cuesFor(rec(300, view(), view(), [{ type: 'BONUS_TURN', playerId: 'a' }], 'ascuns', { chain, ordinal: 3 }), f).find((c) => c.id === 'table.bonus')!.params!.pitch!;
    const base = bonus(0);
    let last = base;
    for (let k = 1; k <= 5; k++) {
      const p = bonus(k);
      expect(p).toBeGreaterThan(last);
      expect(p / base).toBeCloseTo(chainPitch(k), 3);
      last = p;
    }
    expect(bonus(9)).toBeCloseTo(bonus(5), 6); // capped
    expect(chainPitch(5)).toBeCloseTo(1.06, 6);
    // the run itself is kept from the public events: +1 per bonus, back to 0 when the totem moves on
    const b = (playerId: string): PublicEvent => ({ type: 'BONUS_TURN', playerId });
    expect(chainAfter(0, [b('a'), { type: 'TURN_STARTED', playerId: 'a' }])).toBe(1);
    expect(chainAfter(1, [b('a'), { type: 'TURN_STARTED', playerId: 'a' }])).toBe(2);
    expect(chainAfter(4, [{ type: 'REQUEST_FAILED', askerId: 'a', targetId: 'b' }, { type: 'TURN_STARTED', playerId: 'b' }])).toBe(0);
  });
  it('durations are static and short: every cue but the tulnic call and the podium is inside 1.4 s', () => {
    for (const c of CUES) {
      if (c.id === 'mus.start' || c.id === 'mus.podium') continue;
      expect(c.maxLenMs, c.id).toBeLessThanOrEqual(1400);
    }
    expect(durationOf('world.dark.01')).toBeLessThanOrEqual(1400);
    expect(durationOf('power.whale')).toBeLessThanOrEqual(1400);
    expect(durationOf('power.reveal')).toBeLessThanOrEqual(1400);
    expect(durationOf('mus.start')).toBeGreaterThan(1400); // the call may run long: it never blocks
  });
});

describe('the mapping only speaks in cue ids the sheet has', () => {
  it('every cue id it can emit exists on the sheet, and every one is heard by all, the acting client or the seat concerned', () => {
    const everything: PublicEvent[] = [
      { type: 'GAME_STARTED' }, { type: 'TURN_STARTED', playerId: 'a' }, { type: 'TURN_SKIPPED_STUNNED', playerId: 'b' }, { type: 'BONUS_TURN', playerId: 'a' },
      { type: 'HAND_REFILLED', playerId: 'a', count: 3 }, { type: 'REQUEST_MADE', askerId: 'a', targetId: 'b' }, { type: 'REQUEST_SUCCEEDED', askerId: 'a', targetId: 'b', count: 1 },
      { type: 'REQUEST_FAILED', askerId: 'a', targetId: 'b' }, { type: 'DREW_FROM_POOL', playerId: 'a' }, { type: 'SET_LAID', playerId: 'a', isPowerSet: true, eggCount: 2 },
      { type: 'SET_DESTROYED' }, { type: 'POWER_GRANTED', playerId: 'a', grantId: 'g' }, { type: 'POWER_USED', playerId: 'a', rank: 'whale' },
      { type: 'CLOWNFISH_BOUND', playerId: 'a', boundRank: 'shark' }, { type: 'SHARK_JUMP', playerId: 'a' }, { type: 'LANTERNFISH_REFLECT', playerId: 'a', fromId: 'b' },
      { type: 'TORTOISE_BLOCK', playerId: 'a' }, { type: 'JELLYFISH_STUN', playerId: 'a', targetId: 'b' }, { type: 'STICKLEBACK_STEAL', playerId: 'a', targetId: 'b' },
      { type: 'STICKLEBACK_WASTED', playerId: 'a', targetId: 'b' }, { type: 'WHALE_SHUFFLE', playerId: 'a' }, { type: 'GAME_ENDED', winners: ['a'] },
    ];
    for (const mode of ['ascuns', 'deschis'] as PowerMode[])
      for (const c of cuesFor(rec(1, view({ window: RP(), setsPossible: 14 }), view({ window: { type: 'TURN_END' }, setsPossible: 11, scores: { a: 3, b: 2 } }), everything, mode), facts('a', { headphones: true, eligible: true, grantRank: () => 'whale' }))) {
        const def = cueDef(c.id);
        expect(def, c.id).toBeDefined();
        expect(['all', 'you', 'local']).toContain(def!.heard);
      }
  });
});
