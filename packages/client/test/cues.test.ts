import { describe, expect, it } from 'vitest';
import { cuesFor, clockTarget, localAnswerCue, type CueRequest, type PublicEvent, type PublicRecord, type PublicView, type SeatFacts, type PowerMode } from '../src/audio/cues.js';
import { CUES, cueDef } from '../src/audio/cuesheet.js';

/* Three players at a table, a, b, c. Steps are built the way the UI's adapter will build them: the
 * events that arrived plus the public view before and after. */
const PLAYERS = ['a', 'b', 'c', 'd'];
const view = (over: Partial<PublicView> = {}): PublicView => ({ players: PLAYERS, currentPlayerId: 'a', poolCount: 10, window: null, setsPossible: 12, ...over });
const RP = (asker = 'a', target = 'b') => ({ type: 'RESPONSE_PENDING', askerId: asker, targetId: target, deadlineAt: 50_000 });
const rec = (seq: number, before: PublicView | null, after: PublicView, events: PublicEvent[] = [], mode: PowerMode = 'ascuns'): PublicRecord => ({ seq, mode, before, after, events });
const facts = (playerId: string, over: Partial<SeatFacts> = {}): SeatFacts => ({ playerId, headphones: false, ...over });
const ids = (c: CueRequest[]) => c.map((x) => x.id);
/** what a viewer hears from a step: the cues, without the seed's identity of the viewer */
const audible = (c: CueRequest[]) => c.map(({ id, at, params, seed }) => ({ id, at, params, seed }));

/** The events of a stuffed server message: fields the redaction may leave or a bug may add. */
const stuff = <T extends object>(e: T): T => ({ ...e, grantId: 'g-secret', cardId: 'card-xyz', eligiblePlayerIds: ['c'], context: { rank: 'squid', trueHasCards: true }, seed: 42 }) as T;

describe('Law 1: presentation never adds information (§3.2, §6.5 test 1)', () => {
  const ask = rec(10, view(), view({ window: RP() }), [{ type: 'REQUEST_MADE', askerId: 'a', targetId: 'b' }, { type: 'WINDOW_OPENED' }]);
  const no = (mode: PowerMode = 'ascuns') =>
    rec(11, view({ window: RP() }), view({ currentPlayerId: 'b', poolCount: 9 }), [
      { type: 'WINDOW_CLOSED' }, { type: 'REQUEST_FAILED', askerId: 'a', targetId: 'b' }, { type: 'DREW_FROM_POOL', playerId: 'a', poolEmpty: false }, { type: 'TURN_STARTED', playerId: 'b' },
    ], mode);

  it('the same public record gives identical cues whatever the private facts, for every non-target viewer', () => {
    // honest "no" vs Squid deny vs Squid claim are the same public record by construction (§6.2); what differs
    // between viewers is only what the server tells each of them privately
    const bystander = (over: Partial<SeatFacts>) => audible(cuesFor(no(), facts('c', over)));
    const base = bystander({});
    expect(base.length).toBeGreaterThan(0);
    expect(bystander({ eligible: true, eligibleBefore: false })).toEqual(base);
    expect(bystander({ eligible: false, eligibleBefore: true })).toEqual(base);
    expect(bystander({ grantRank: () => 'squid' })).toEqual(base);
    expect(bystander({ grantRank: () => 'whale' })).toEqual(base);
    expect(bystander({ closePlayedLocally: false })).toEqual(base);
  });

  it('stuffed events (rank, grantId, cardId, eligiblePlayerIds, context, seed) never move the sound', () => {
    const plain = audible(cuesFor(no(), facts('c')));
    const r = no();
    const stuffed: PublicRecord = { ...r, events: r.events.map(stuff) };
    expect(audible(cuesFor(stuffed, facts('c')))).toEqual(plain);
    const a = ask;
    expect(audible(cuesFor({ ...a, events: a.events.map(stuff) }, facts('c')))).toEqual(audible(cuesFor(a, facts('c'))));
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
    expect(ids(cuesFor(grant(null), facts('a')))).toEqual(['table.lay.power', 'power.granted']);
  });

  it('headphones mode is the only thing that lets an owner hear their own rank (private tier)', () => {
    const grant = rec(20, view(), view(), [{ type: 'POWER_GRANTED', playerId: 'a', grantId: 'g1', rank: null }]);
    const own = (rank: string) => cuesFor(grant, facts('a', { headphones: true, grantRank: () => rank }));
    expect(ids(own('whale'))).toEqual(['power.granted', 'power.granted.mine']);
    expect(own('whale')[1].params).toEqual({ rank: 'whale' });
    expect(ids(own('squid'))).toEqual(['power.granted']); // Squid: a rest
    expect(ids(cuesFor(grant, facts('b', { headphones: true, grantRank: () => 'whale' })))).toEqual(['power.granted']); // not yours
    expect(ids(cuesFor(grant, facts('a', { headphones: false, grantRank: () => 'whale' })))).toEqual(['power.granted']);
  });

  it('a clownfish bound to different powers is silent in Ascuns (public) and private in headphones', () => {
    const bound = (rank: string) => rec(30, view(), view(), [{ type: 'CLOWNFISH_BOUND', playerId: 'a', boundRank: rank }]);
    for (const rank of ['shark', 'whale', 'squid']) {
      expect(cuesFor(bound(rank), facts('a')), rank).toEqual([]);
      expect(cuesFor(bound(rank), facts('b', { headphones: true })), rank).toEqual([]);
    }
    expect(ids(cuesFor(bound('shark'), facts('a', { headphones: true })))).toEqual(['power.clownfish.bound']);
    // in Deschis it is public: every viewer hears it
    expect(ids(cuesFor(rec(30, view(), view(), [{ type: 'CLOWNFISH_BOUND', playerId: 'a', boundRank: 'shark' }], 'deschis'), facts('c')))).toEqual(['power.clownfish.bound']);
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
    expect(ids(cuesFor(step(1), facts('a')))).toEqual(['table.lay', 'mus.lastset']);
    expect(ids(cuesFor(step(1), facts('c')))).toEqual(['table.lay', 'mus.lastset']);
    expect(ids(cuesFor(step(2), facts('a')))).toEqual(['table.lay']);
  });

  it('viewers differ only by the public facts of their own seat: your turn, you were asked, your result', () => {
    const turn = rec(50, view(), view({ currentPlayerId: 'b' }), [{ type: 'TURN_STARTED', playerId: 'b' }]);
    expect(ids(cuesFor(turn, facts('a')))).toEqual(['table.turn']);
    expect(ids(cuesFor(turn, facts('b')))).toEqual(['table.turn.you']);
    expect(cuesFor(turn, facts('a'))[0].params).toEqual(cuesFor(turn, facts('b'))[0].params); // same seat signature
    // the target hears the roll, nobody else does
    expect(ids(cuesFor(ask, facts('b')))).toEqual(['table.ask', 'table.asked']);
    for (const v of ['a', 'c', 'd']) expect(ids(cuesFor(ask, facts(v))), v).toEqual(['table.ask']);
  });

  it('the ask carries the target\'s seat signature and nothing else about the ask', () => {
    const c = cuesFor(ask, facts('c'))[0];
    expect(c.params).toEqual({ seat: 1 });
  });
});

describe('Squid never sounds, in any form', () => {
  it('silent in both modes: granted, used, bound, reveal, and as the clownfish\'s copy', () => {
    for (const mode of ['ascuns', 'deschis'] as PowerMode[]) {
      const events: PublicEvent[] = [
        { type: 'POWER_USED', playerId: 'a', rank: 'squid' },
        { type: 'POWER_USED', playerId: 'a', rank: 'squid', viaClownfish: true },
        { type: 'CLOWNFISH_BOUND', playerId: 'a', boundRank: 'squid' },
      ];
      const got = cuesFor(rec(60, view(), view(), events, mode), facts('a', { headphones: true }));
      expect(got.filter((c) => /squid/i.test(c.id) || /reveal|used/.test(c.id))).toEqual([]);
    }
    // a Squid grant in Deschis: its motif is a rest, and there is no uniform cue to stand in for it
    expect(cuesFor(rec(61, view(), view(), [{ type: 'POWER_GRANTED', playerId: 'a', rank: 'squid' }], 'deschis'), facts('b'))).toEqual([]);
    for (const c of CUES) expect(c.id).not.toMatch(/squid/i);
  });
  it('no request can carry a Squid rank into a cue', () => {
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
  /** the audible output of a sequence of steps, on an absolute clock: step `i` is presented at times[i] */
  const play = (steps: PublicRecord[], viewer: string, times: number[]) =>
    steps.flatMap((s, i) => cuesFor(s, facts(viewer)).map((c) => ({ id: c.id, params: c.params, t: times[i] + c.at }))).sort((x, y) => x.t - y.t);

  it.each(['TURN_END', 'TRANSFER_PENDING', 'TURN_START', 'REQUEST_DECLARED', 'SET_COMPLETED'])('%s in the way: same cue ids, parameters and order; times shifted only by its pause', (win) => {
    const A = answered(null);
    const B = answered(win);
    for (const viewer of ['a', 'b', 'c']) {
      const a = play(A, viewer, [0, 3000]);
      const pause = 1500; // the structural window's pause: step 3 lands later by this much
      const b = play(B, viewer, [0, 3000, 3000 + pause]);
      expect(b.map((x) => x.id), viewer).toEqual(a.map((x) => x.id));
      expect(b.map((x) => x.params), viewer).toEqual(a.map((x) => x.params));
      a.forEach((x, i) => {
        const shift = b[i].t - x.t;
        expect(shift === 0 || shift === pause, `${x.id} shifted by ${shift}`).toBe(true);
      });
      expect(b.some((x) => x.id === 'clock.close'), 'the close still fires').toBe(true);
    }
  });

  it('clock.close fires when RESPONSE_PENDING leaves the view, whatever replaces it', () => {
    const rp = view({ window: RP() });
    for (const replacement of [null, T('TURN_START'), T('TURN_END'), T('TRANSFER_PENDING'), T('SET_COMPLETED'), { type: 'RESPONSE_PENDING', askerId: 'a', targetId: 'c' }]) {
      const step = rec(3, rp, view({ window: replacement }), [{ type: 'WINDOW_CLOSED' }]);
      for (const viewer of ['a', 'b', 'c', 'd']) expect(ids(cuesFor(step, facts(viewer))).filter((i) => i === 'clock.close'), `${JSON.stringify(replacement)} for ${viewer}`).toHaveLength(1);
    }
    // ... and with no events at all: the close is a diff, not an event
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
    expect(cuesFor(leave, facts('b', { closePlayedLocally: true })).map((c) => c.id)).not.toContain('clock.close');
    // one close per answer for every viewer, whoever plays it
    const heard = (v: string, local: boolean) => cuesFor(leave, facts(v, { closePlayedLocally: local })).map((c) => c.id).filter((i) => i === 'clock.close').length + (local ? 1 : 0);
    expect(heard('b', true)).toBe(heard('c', false));
  });

  it('a structural window opens no cue and no tick, for anyone; eligibility is private', () => {
    const open = rec(7, view(), view({ window: T('TURN_END') }), [{ type: 'WINDOW_OPENED' }]);
    for (const viewer of ['a', 'b', 'c']) expect(cuesFor(open, facts(viewer, { eligible: viewer === 'c', eligibleBefore: false }))).toEqual([]);
    expect(ids(cuesFor(open, facts('c', { eligible: true, eligibleBefore: false, headphones: true })))).toEqual(['clock.eligible']);
    expect(cuesFor(open, facts('a', { eligible: false, headphones: true }))).toEqual([]);
    expect(clockTarget(open.after)).toBeNull();
  });

  it('the window clock is bound to the answer window only', () => {
    expect(clockTarget(view({ window: RP() }))).toMatchObject({ deadlineAt: 50_000 });
    expect(clockTarget(view({ window: { type: 'TURN_END', deadlineAt: 9 } }))).toBeNull();
    expect(clockTarget(null)).toBeNull();
    expect(clockTarget(view())).toBeNull();
  });
});

describe('what each event sounds like (Appendix A, the sound column)', () => {
  const f = facts('c');
  it('a successful ask: the flight, then the give; the asker keeps the turn with the bonus', () => {
    const r = rec(70, view({ window: RP() }), view({ poolCount: 10 }), [
      { type: 'WINDOW_CLOSED' }, { type: 'REQUEST_SUCCEEDED', askerId: 'a', targetId: 'b', count: 2 }, { type: 'BONUS_TURN', playerId: 'a' },
    ]);
    const got = cuesFor(r, f);
    expect(ids(got)).toEqual(['clock.close', 'table.flight', 'table.give', 'table.bonus']);
    expect(got.find((c) => c.id === 'table.give')!.params).toEqual({ count: 2 });
    expect(got.find((c) => c.id === 'table.bonus')!.params).toEqual({ seat: 0 });
  });
  it('go fish: wet with water in the pool, dry without, neutral either way', () => {
    const wet = rec(71, view({ window: RP(), poolCount: 3 }), view({ poolCount: 2 }), [{ type: 'REQUEST_FAILED', askerId: 'a', targetId: 'b' }, { type: 'DREW_FROM_POOL', playerId: 'a', poolEmpty: false }]);
    expect(ids(cuesFor(wet, f))).toEqual(['clock.close', 'table.gofish', 'table.draw']);
    const dry = rec(72, view({ window: RP(), poolCount: 0 }), view({ poolCount: 0 }), [{ type: 'REQUEST_FAILED', askerId: 'a', targetId: 'b' }]);
    expect(ids(cuesFor(dry, f))).toEqual(['clock.close', 'table.gofish.dry']);
    const last = rec(73, view({ window: RP(), poolCount: 1 }), view({ poolCount: 0 }), [{ type: 'REQUEST_FAILED', askerId: 'a', targetId: 'b' }, { type: 'DREW_FROM_POOL', playerId: 'a', poolEmpty: true }]);
    expect(ids(cuesFor(last, f))).toEqual(['clock.close', 'table.gofish', 'table.poolEmpty']);
  });
  it('powers: reveal then motif in Ascuns, motif only in Deschis; the effect cue under it', () => {
    const used = (mode: PowerMode) => rec(74, view(), view(), [{ type: 'POWER_USED', playerId: 'a', rank: 'mantisShrimp' }, { type: 'SET_DESTROYED', ownerId: 'b' }], mode);
    expect(ids(cuesFor(used('ascuns'), f))).toEqual(['power.reveal', 'power.used.mantis', 'power.mantis']);
    expect(ids(cuesFor(used('deschis'), f))).toEqual(['power.used.mantis', 'power.mantis']);
    const shark = rec(75, view(), view(), [{ type: 'POWER_USED', playerId: 'a', rank: 'shark' }, { type: 'SHARK_JUMP', playerId: 'a' }], 'deschis');
    expect(ids(cuesFor(shark, f))).toEqual(['power.used.shark', 'power.shark']);
  });
  it('Deschis: the rank is public, so a grant plays its motif; Ascuns plays the uniform cue whatever the event carries', () => {
    const g = (mode: PowerMode, rank: string | null) => rec(76, view(), view(), [{ type: 'POWER_GRANTED', playerId: 'a', rank }], mode);
    expect(ids(cuesFor(g('deschis', 'lanternfish'), f))).toEqual(['power.granted.lanternfish']);
    expect(ids(cuesFor(g('deschis', 'mantisShrimp'), f))).toEqual(['power.granted.mantis']);
    expect(ids(cuesFor(g('ascuns', 'lanternfish'), f))).toEqual(['power.granted']);
  });
  it('the game: the call to the table, the last set, the result for you only', () => {
    expect(ids(cuesFor(rec(1, null, view(), [{ type: 'GAME_STARTED' }, { type: 'HAND_REFILLED', playerId: 'a', count: 7 }, { type: 'TURN_STARTED', playerId: 'a' }]), f))).toEqual(['mus.start', 'table.turn']);
    const end = rec(80, view(), view(), [{ type: 'GAME_ENDED', winners: ['c'] }]);
    expect(ids(cuesFor(end, facts('c')))).toEqual(['mus.end.win']);
    expect(ids(cuesFor(end, facts('a')))).toEqual(['mus.end.lose']);
    expect(ids(cuesFor(rec(81, view(), view(), [{ type: 'GAME_ENDED', winners: ['a', 'c'] }]), facts('c')))).toEqual(['mus.end.tie']);
    expect(cuesFor(end, facts('spectator'))).toEqual([]);
  });
  it('the stall gate: shuts from N misses (half the 2N limit), opens when a capture resets it', () => {
    const at = (misses: number) => view({ endPressure: { misses, limit: 8 } });
    expect(ids(cuesFor(rec(90, at(2), at(3), []), f))).toEqual([]);
    expect(ids(cuesFor(rec(91, at(3), at(4), []), f))).toEqual(['amb.gate']);
    expect(cuesFor(rec(91, at(3), at(4), []), f)[0].params).toEqual({ open: false });
    expect(cuesFor(rec(92, at(5), at(0), []), f)[0].params).toEqual({ open: true });
  });
  it('the seed is the step\'s seq, so renders reproduce', () => {
    const a = cuesFor(rec(100, view(), view(), [{ type: 'TURN_STARTED', playerId: 'b' }]), f);
    const b = cuesFor(rec(100, view(), view(), [{ type: 'TURN_STARTED', playerId: 'b' }]), f);
    const c = cuesFor(rec(101, view(), view(), [{ type: 'TURN_STARTED', playerId: 'b' }]), f);
    expect(a).toEqual(b);
    expect(a[0].seed).not.toBe(c[0].seed);
  });
  it('every cue id it can emit exists on the sheet, and private ones are dropped without headphones', () => {
    const everything: PublicEvent[] = [
      { type: 'GAME_STARTED' }, { type: 'TURN_STARTED', playerId: 'a' }, { type: 'TURN_SKIPPED_STUNNED', playerId: 'b' }, { type: 'BONUS_TURN', playerId: 'a' },
      { type: 'HAND_REFILLED', playerId: 'a', count: 3 }, { type: 'REQUEST_MADE', askerId: 'a', targetId: 'b' }, { type: 'REQUEST_SUCCEEDED', askerId: 'a', targetId: 'b', count: 1 },
      { type: 'REQUEST_FAILED', askerId: 'a', targetId: 'b' }, { type: 'DREW_FROM_POOL', playerId: 'a' }, { type: 'SET_LAID', playerId: 'a', isPowerSet: true },
      { type: 'SET_DESTROYED' }, { type: 'POWER_GRANTED', playerId: 'a', grantId: 'g' }, { type: 'POWER_USED', playerId: 'a', rank: 'whale' },
      { type: 'CLOWNFISH_BOUND', playerId: 'a', boundRank: 'shark' }, { type: 'SHARK_JUMP', playerId: 'a' }, { type: 'LANTERNFISH_REFLECT', playerId: 'a', fromId: 'b' },
      { type: 'TORTOISE_BLOCK', playerId: 'a' }, { type: 'JELLYFISH_STUN', playerId: 'a', targetId: 'b' }, { type: 'STICKLEBACK_STEAL', playerId: 'a', targetId: 'b' },
      { type: 'STICKLEBACK_WASTED', playerId: 'a', targetId: 'b' }, { type: 'WHALE_SHUFFLE', playerId: 'a' }, { type: 'GAME_ENDED', winners: ['a'] },
    ];
    for (const headphones of [false, true])
      for (const c of cuesFor(rec(1, view({ window: RP() }), view({ window: { type: 'TURN_END' } }), everything), facts('a', { headphones, eligible: true, grantRank: () => 'whale' }))) {
        const def = cueDef(c.id);
        expect(def, c.id).toBeDefined();
        if (!headphones) { expect(def!.heard, c.id).not.toBe('private'); expect(c.params?.private, c.id).toBeFalsy(); }
      }
  });
});
