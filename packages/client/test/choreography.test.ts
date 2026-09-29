import { describe, expect, it } from 'vitest';
import type { PowerMode, PublicEvent, PublicRecord, PublicView, SeatFacts } from '../src/audio/cues.js';
import { BEAT } from '../src/audio/cues.js';
import { choreograph, DEFAULT_OPTIONS, flightMs, summarize, TIME, type Beat, type Choreography } from '../src/game/choreography.js';

const PLAYERS = ['a', 'b', 'c', 'd'];
const view = (over: Partial<PublicView> = {}): PublicView => ({ players: PLAYERS, currentPlayerId: 'a', poolCount: 10, window: null, setsPossible: 12, endPressure: { misses: 0, limit: 8 }, laidSets: [], handSizes: { a: 5, b: 5, c: 5, d: 5 }, ...over });
const RP = (asker = 'a', target = 'b') => ({ type: 'RESPONSE_PENDING', askerId: asker, targetId: target, deadlineAt: 50_000 });
const rec = (seq: number, before: PublicView | null, after: PublicView, events: PublicEvent[] = [], mode: PowerMode = 'ascuns'): PublicRecord => ({ seq, mode, before, after, events });
const facts = (playerId: string, over: Partial<SeatFacts> = {}): SeatFacts => ({ playerId, headphones: false, ...over });
const ch = (r: PublicRecord, who = 'c', o = DEFAULT_OPTIONS): Choreography => choreograph(r, facts(who), o);
const kinds = (c: Choreography): string[] => c.beats.map((b) => b.kind);
const beat = (c: Choreography, k: Beat['kind']): Beat => c.beats.find((b) => b.kind === k)!;

const askStep = rec(10, view(), view({ window: RP() }), [{ type: 'REQUEST_MADE', askerId: 'a', targetId: 'b', rank: 'herring' }, { type: 'WINDOW_OPENED' }]);
const yes = (count: number) =>
  rec(11, view({ window: RP() }), view(), [
    { type: 'WINDOW_CLOSED' }, { type: 'REQUEST_SUCCEEDED', askerId: 'a', targetId: 'b', rank: 'herring', count }, { type: 'BONUS_TURN', playerId: 'a' }, { type: 'TURN_STARTED', playerId: 'a' },
  ]);
const wet = rec(12, view({ window: RP() }), view({ currentPlayerId: 'b', poolCount: 9 }), [
  { type: 'WINDOW_CLOSED' }, { type: 'REQUEST_FAILED', askerId: 'a', targetId: 'b', rank: 'herring' }, { type: 'DREW_FROM_POOL', playerId: 'a', poolEmpty: false }, { type: 'TURN_STARTED', playerId: 'b' },
]);
const dry = rec(13, view({ window: RP(), poolCount: 0 }), view({ currentPlayerId: 'b', poolCount: 0 }), [
  { type: 'WINDOW_CLOSED' }, { type: 'REQUEST_FAILED', askerId: 'a', targetId: 'b', rank: 'herring' }, { type: 'TURN_STARTED', playerId: 'b' },
]);

describe('the ask, beat by beat (§4.1)', () => {
  it('beat 1: the arrow-chip flies asker to target and lands at 320 ms with table.ask; the target\'s post wobbles', () => {
    const c = ch(askStep);
    const b = beat(c, 'ask');
    expect(b.lane).toBe('table');
    expect(b.cls).toBe('light');
    expect(b.flights).toHaveLength(1);
    expect(b.flights[0]).toMatchObject({ what: 'chip', rank: 'herring', from: { k: 'seat', id: 'a' }, to: { k: 'seat', id: 'b' }, land: 320, end: 'stay' });
    expect(b.ops.some((o) => o.op === 'wobble' && o.at === 320)).toBe(true);
    expect(b.cues.map((x) => x.id)).toEqual(['table.ask']);
    expect(c.tableMs).toBe(320);
  });

  it('beat 2: the hold - the plank rises at 340 with the asked roll for the target; everyone else gets the same beat, without the cue', () => {
    const target = ch(askStep, 'b');
    const other = ch(askStep, 'c');
    for (const c of [target, other]) {
      const h = beat(c, 'hold');
      expect(h).toMatchObject({ lane: 'hud', anchor: 'arrival', at: 340, dur: 0 });
      expect(h.masks).toEqual([{ target: 'plank', until: 340 }]);
    }
    expect(beat(target, 'hold').cues.map((x) => x.id)).toEqual(['table.asked']);
    expect(beat(target, 'hold').haptics.map((x) => x.signal)).toEqual(['youWereAsked']);
    expect(beat(other, 'hold').cues).toEqual([]);
    expect(summarize(target)).toEqual(summarize(other));
  });

  it('beat 3: the answer window closes with the uniform 220 ms whenever RESPONSE_PENDING leaves the view', () => {
    for (const r of [yes(2), wet, dry]) {
      const b = beat(ch(r), 'close');
      expect(b).toMatchObject({ lane: 'hud', anchor: 'arrival', at: 0, dur: 220, cls: 'light' });
      expect(b.cues.map((x) => x.id)).toEqual(['clock.close']);
    }
  });

  it('the close is view-driven: no WINDOW_CLOSED event is needed, and a replacement window changes nothing', () => {
    const noEvents = rec(11, view({ window: RP() }), view({ currentPlayerId: 'b' }), [{ type: 'TURN_STARTED', playerId: 'b' }]);
    expect(beat(ch(noEvents), 'close').dur).toBe(220);
    expect(ch(noEvents).cues.filter((x) => x.id === 'clock.close')).toHaveLength(1);
    // RESPONSE_PENDING -> TRANSFER_PENDING (a Tortoise may act): still exactly one close, same time
    const replaced = rec(11, view({ window: RP() }), view({ window: { type: 'TRANSFER_PENDING', askerId: 'a', targetId: 'b' } }), [{ type: 'WINDOW_CLOSED' }, { type: 'WINDOW_OPENED' }]);
    expect(beat(ch(replaced), 'close').cues.map((x) => x.id)).toEqual(['clock.close']);
    // a structural window closing gets the same animation and no sound
    const structural = rec(12, view({ window: { type: 'TURN_END', askerId: 'a', targetId: 'b' } }), view(), [{ type: 'WINDOW_CLOSED' }]);
    const sb = beat(ch(structural), 'close');
    expect(sb).toMatchObject({ dur: 220, lane: 'hud' });
    expect(sb.cues).toEqual([]);
  });

  it('beat 4a yes: the chip flips at +100, backs fly target to asker (460 ms, 60 ms stagger), the totem settles at 640; rest at about 700 ms up to three cards', () => {
    for (const n of [1, 2, 3]) {
      const c = ch(yes(n));
      const g = beat(c, 'give');
      expect(g.cls).toBe('medium');
      expect(g.flights).toHaveLength(n);
      g.flights.forEach((f, i) => {
        expect(f).toMatchObject({ what: 'back', from: { k: 'seat', id: 'b' }, to: { k: 'seat', id: 'a' } });
        expect(f.start).toBe(120 + 60 * i);
        expect(f.land - f.start).toBe(460);
      });
      expect(g.ops.find((o) => o.op === 'chipFlip')).toMatchObject({ at: 100 });
      expect(beat(c, 'bonus').ops[0]).toMatchObject({ op: 'settle', at: 640 });
      expect(c.tableMs).toBe(700);
      expect(g.cues.map((x) => x.id)).toEqual(['table.flight', 'table.give']);
      expect(beat(c, 'bonus').cues.map((x) => x.id)).toEqual(['table.bonus']);
    }
    // +60 ms per further card
    expect(ch(yes(4)).tableMs).toBe(760);
    expect(ch(yes(5)).tableMs).toBe(820);
  });

  it('beat 4b wet go fish: the chip dives at +300 (plop and ripple), a card rises to the asker (620), the totem lands at 760; rest at about 800 ms', () => {
    const c = ch(wet);
    const g = beat(c, 'gofish');
    expect(g.flights[0]).toMatchObject({ what: 'chip', to: { k: 'pool' }, land: 300, end: 'dive' });
    expect(g.vfx).toEqual([{ kind: 'waterRing', at: 300, anchor: { k: 'pool' } }]);
    expect(g.cues.map((x) => x.id)).toEqual(['table.gofish']);
    const d = beat(c, 'draw');
    expect(d.flights[0]).toMatchObject({ what: 'back', from: { k: 'pool' }, to: { k: 'seat', id: 'a' }, land: 620 });
    const t = beat(c, 'turn');
    expect(t.flights[0]).toMatchObject({ what: 'totem', from: { k: 'seat', id: 'a' }, to: { k: 'seat', id: 'b' }, start: 300, land: 760 });
    expect(t.cues.map((x) => x.id)).toEqual(['table.turn']);
    expect(c.tableMs).toBe(800);
  });

  it('beat 4c dry: the chip drops onto the basin floor - a puff of dust, no card, neutral; rest at about 800 ms', () => {
    const c = ch(dry);
    const b = beat(c, 'dry');
    expect(b.flights[0]).toMatchObject({ what: 'chip', to: { k: 'basin' }, land: 300, end: 'drop' });
    expect(b.vfx.map((v) => v.kind)).toEqual(['dustPuff']);
    expect(b.cues.map((x) => x.id)).toEqual(['table.gofish.dry']);
    expect(kinds(c)).not.toContain('draw');
    expect(c.tableMs).toBe(800);
  });

  it('a wet and a dry answer differ only by the public pool: same close, same totem', () => {
    const a = ch(wet);
    const b = ch(dry);
    expect({ ...beat(a, 'close'), id: '', cues: [] }).toEqual({ ...beat(b, 'close'), id: '', cues: [] });
    const bare = (c: Choreography) => beat(c, 'turn').flights.map(({ key: _k, ...f }) => f);
    expect(bare(a)).toEqual(bare(b));
  });

  it('the last card leaving the pool is a heavy beat: hit-stop, trauma, one impact frame, table.poolEmpty', () => {
    const last = rec(14, view({ window: RP(), poolCount: 1 }), view({ currentPlayerId: 'b', poolCount: 0 }), [
      { type: 'WINDOW_CLOSED' }, { type: 'REQUEST_FAILED', askerId: 'a', targetId: 'b' }, { type: 'DREW_FROM_POOL', playerId: 'a', poolEmpty: true }, { type: 'TURN_STARTED', playerId: 'b' },
    ]);
    const c = ch(last);
    const b = beat(c, 'poolEmpty');
    expect(b.cls).toBe('heavy');
    expect(b.juice).toMatchObject({ hitStopMs: 70, impact: true });
    expect(b.juice!.trauma).toBeGreaterThanOrEqual(0.4);
    expect(b.juice!.trauma).toBeLessThanOrEqual(0.6);
    expect(b.cues.map((x) => x.id)).toEqual(['table.poolEmpty']);
  });
});

describe('the totem and your turn (§4.5)', () => {
  it('a stunned skip: the totem visits the stunned seat, then the next; each stop waits for the last cue', () => {
    const r = rec(20, view({ currentPlayerId: 'a' }), view({ currentPlayerId: 'c' }), [{ type: 'TURN_SKIPPED_STUNNED', playerId: 'b' }, { type: 'TURN_STARTED', playerId: 'c' }]);
    const c = ch(r, 'd');
    const lands = c.beats.filter((b) => b.flights.some((f) => f.what === 'totem')).map((b) => b.flights[0].land);
    expect(lands).toEqual([BEAT.turn, BEAT.turn + BEAT.turnGap]);
    expect(c.cues.map((x) => [x.id, x.at])).toEqual([['table.skipped', BEAT.turn], ['table.turn', BEAT.turn + BEAT.turnGap]]);
  });

  it('your turn: the totem lands at 760, with table.turn.you and the 16 ms haptic at the same moment, and turnLanded moves the chrome', () => {
    const r = rec(21, view({ currentPlayerId: 'a' }), view({ currentPlayerId: 'c' }), [{ type: 'TURN_STARTED', playerId: 'c' }]);
    const mine = ch(r, 'c');
    const t = beat(mine, 'turn');
    expect(t.cues.map((x) => [x.id, x.at])).toEqual([['table.turn.you', 760]]);
    expect(t.haptics.map((x) => [x.signal, x.pattern, x.at])).toEqual([['yourTurn', [16], 760]]);
    expect(t.ops).toEqual([{ op: 'turnLanded', at: 760, playerId: 'c' }]);
    expect(t.masks).toEqual([{ target: 'totem', until: 760 }]);
    // someone else's turn: the travel and the signature, the same beat
    const other = ch(r, 'd');
    expect(summarize(other)).toEqual(summarize(mine));
    expect(beat(other, 'turn').cues.map((x) => x.id)).toEqual(['table.turn']);
    expect(beat(other, 'turn').haptics).toEqual([]);
  });

  it('game start: the ceremony is 2.4 s on the hud lane, never blocking; the first turn lands at its end', () => {
    const r = rec(1, null, view({ currentPlayerId: 'a' }), [{ type: 'GAME_STARTED' }, { type: 'HAND_REFILLED', playerId: 'c', count: 7 }, { type: 'TURN_STARTED', playerId: 'a' }]);
    const c = ch(r, 'c');
    const s = beat(c, 'start');
    expect(s).toMatchObject({ lane: 'hud', cls: 'ceremony', dur: 2400 });
    expect(s.vfx.map((v) => v.kind)).toEqual(['gateDoors']);
    expect(beat(c, 'turn').flights[0].land).toBe(2400);
    // seven cards fly to your hand while the posts carve in
    expect(beat(c, 'refill').flights).toHaveLength(7);
    expect(beat(c, 'refill').flights.every((f) => f.toHand)).toBe(true);
  });
});

describe('sets, powers, signature moments (§5.7, Appendix A)', () => {
  const laid = (over: Partial<PublicView> = {}) => view({ laidSets: [{ id: 's1', ownerId: 'a', isPowerSet: true, rank: null, cardCount: 4, spent: false, destroyed: false }], ...over });

  it('a lay presses the group flat under the post; a notch is knocked from the rim; a power set ignites its core identically for every hidden rank', () => {
    const r = rec(30, view({ setsPossible: 5 }), laid({ setsPossible: 4 }), [
      { type: 'SET_LAID', playerId: 'a', isPowerSet: true, setId: 's1', rank: null }, { type: 'POWER_GRANTED', playerId: 'a', sourceSetId: 's1', rank: null },
    ]);
    const c = ch(r);
    const b = beat(c, 'lay');
    expect(b.cls).toBe('medium');
    expect(b.flights).toHaveLength(4);
    expect(b.flights.every((f) => f.to.k === 'set' && f.end === 'press')).toBe(true);
    expect(b.ops.some((o) => o.op === 'notch' && o.from === 5 && o.to === 4)).toBe(true);
    expect(b.masks.map((m) => m.target).sort()).toEqual(['set', 'tally']);
    expect(beat(c, 'grant').ops[0]).toMatchObject({ op: 'ignite', owner: 'a', setId: 's1' });
    // the same beats whatever the hidden rank is: the record is all there is
    const other = choreograph({ ...r, events: r.events.map((e) => (e.type === 'POWER_GRANTED' ? { ...e, grantId: 'g-secret', rank: null } : e)) }, facts('b', { grantRank: () => 'squid' }));
    expect(summarize(other)).toEqual(summarize(c));
  });

  it('the last set: heavy, hit-stop, an impact frame, its notch inked', () => {
    const r = rec(31, view({ setsPossible: 2 }), laid({ setsPossible: 1 }), [{ type: 'SET_LAID', playerId: 'a', isPowerSet: false, setId: 's1', rank: 'herring' }]);
    const b = beat(ch(r), 'lastSet');
    expect(b.cls).toBe('heavy');
    expect(b.juice).toMatchObject({ hitStopMs: 70, impact: true });
  });

  it('the reveal (Ascuns, first use): ~1.3 s on the hud lane, never blocking; the effect follows under its motif', () => {
    const r = rec(40, view(), view(), [{ type: 'POWER_USED', playerId: 'a', rank: 'whale' }, { type: 'WHALE_SHUFFLE', playerId: 'a', targetAId: 'b', targetBId: 'c' }]);
    const c = ch(r);
    expect(beat(c, 'reveal')).toMatchObject({ lane: 'hud', dur: 1300, cls: 'medium' });
    expect(beat(c, 'reveal').ops[0]).toMatchObject({ op: 'reveal', owner: 'a', rank: 'whale' });
    // Deschis: no reveal, the plate flips to spent
    const d = ch(rec(40, view(), view(), [...r.events], 'deschis'));
    expect(kinds(d)).toContain('spent');
    expect(kinds(d)).not.toContain('reveal');
  });

  it('the whale: twelve backs spiral at the pond\'s centre, then the redeal; heavy', () => {
    const r = rec(41, view({ handSizes: { a: 3, b: 6, c: 6, d: 3 } }), view({ handSizes: { a: 3, b: 6, c: 6, d: 3 } }), [{ type: 'POWER_USED', playerId: 'a', rank: 'whale' }, { type: 'WHALE_SHUFFLE', playerId: 'a', targetAId: 'b', targetBId: 'c' }]);
    const w = beat(ch(r), 'whale');
    expect(w.cls).toBe('heavy');
    expect(w.flights.filter((f) => f.to.k === 'center')).toHaveLength(12);
    expect(w.flights.filter((f) => f.from.k === 'center')).toHaveLength(12);
    expect(w.vfx.map((v) => v.kind)).toEqual(['spiralChips']);
    expect(w.juice).toMatchObject({ hitStopMs: 70, impact: true });
  });

  it('the shark: cards turn at a hard corner at 55 % of their path; heavy with an impact frame', () => {
    const r = rec(42, view(), view(), [{ type: 'POWER_USED', playerId: 'c', rank: 'shark' }, { type: 'SHARK_JUMP', playerId: 'c', fromId: 'a', count: 3 }]);
    const s = beat(ch(r), 'shark');
    expect(s.cls).toBe('heavy');
    expect(s.flights).toHaveLength(3);
    expect(s.flights.every((f) => f.corner === 0.55 && f.from.k === 'seat' && (f.from as { id: string }).id === 'a' && (f.to as { id: string }).id === 'c')).toBe(true);
    expect(s.juice!.impact).toBe(true);
  });

  it('the mantis: hit-stop, an impact frame, splinters; the crack stays (masked until the strike)', () => {
    const r = rec(43, laid(), laid(), [{ type: 'POWER_USED', playerId: 'c', rank: 'mantisShrimp' }, { type: 'SET_DESTROYED', setId: 's1', byPlayerId: 'c' }]);
    const m = beat(ch(r), 'mantis');
    expect(m.cls).toBe('heavy');
    expect(m.vfx.map((v) => v.kind)).toEqual(['woodChips']);
    expect(m.masks).toEqual([{ target: 'crack', ref: 's1', until: BEAT.effect + 40 }]);
    expect(m.juice).toMatchObject({ hitStopMs: 70, impact: true, trauma: 0.6 });
  });

  it('lanternfish, tortoise, jellyfish, stickleback: one beat each, medium (a miss is light)', () => {
    const used = (rank: string) => ({ type: 'POWER_USED', playerId: 'c', rank }) as PublicEvent;
    const one = (rank: string, e: PublicEvent) => ch(rec(50, view(), view(), [used(rank), e]));
    expect(beat(one('lanternfish', { type: 'LANTERNFISH_REFLECT', playerId: 'c', fromId: 'a', count: 2, rank: 'herring' }), 'reflect').cls).toBe('medium');
    expect(beat(one('tortoise', { type: 'TORTOISE_BLOCK', playerId: 'b', rank: 'herring' }), 'block').vfx[0].kind).toBe('shellClamp');
    expect(beat(one('jellyfish', { type: 'JELLYFISH_STUN', playerId: 'c', targetId: 'a' }), 'stun').vfx[0].kind).toBe('bellStamp');
    expect(beat(one('stickleback', { type: 'STICKLEBACK_STEAL', playerId: 'c', targetId: 'a', count: 2, rank: 'carp' }), 'steal').vfx[0].kind).toBe('barbedHook');
    expect(beat(one('stickleback', { type: 'STICKLEBACK_WASTED', playerId: 'c', targetId: 'a', rank: 'carp' }), 'miss').cls).toBe('light');
  });

  it('Squid: nothing - no reveal, no motif, no effect beat, whatever the mode', () => {
    for (const mode of ['ascuns', 'deschis'] as PowerMode[]) {
      const c = ch(rec(60, view(), view(), [{ type: 'POWER_USED', playerId: 'a', rank: 'squid' }], mode));
      expect(c.beats.filter((b) => b.kind !== 'log')).toEqual([]);
      expect(c.cues).toEqual([]);
    }
  });

  it('a clownfish bound: the owner\'s slot fills (owner only in Ascuns); everyone in Deschis', () => {
    const ev: PublicEvent[] = [{ type: 'CLOWNFISH_BOUND', playerId: 'a', boundRank: 'shark' }];
    expect(kinds(ch(rec(61, view(), view(), ev), 'a'))).toContain('bound');
    expect(kinds(ch(rec(61, view(), view(), ev), 'c'))).not.toContain('bound');
    expect(kinds(ch(rec(61, view(), view(), ev, 'deschis'), 'c'))).toContain('bound');
  });

  it('the stall gate: a notch shuts from N misses; a capture throws it open', () => {
    const shut = rec(70, view({ endPressure: { misses: 3, limit: 8 } }), view({ endPressure: { misses: 4, limit: 8 } }), []);
    expect(beat(ch(shut), 'gate').vfx[0].kind).toBe('gateNotch');
    const open = rec(71, view({ endPressure: { misses: 5, limit: 8 } }), view({ endPressure: { misses: 0, limit: 8 } }), []);
    expect(beat(ch(open), 'gate').ops[0]).toMatchObject({ op: 'gate', open: true });
  });

  it('the end: the last lay\'s stamp, one held beat, the gate doors, then the podium; the ceremony\'s cue waits for it', () => {
    const r = rec(80, view({ setsPossible: 1 }), view({ setsPossible: 0, ended: true }), [
      { type: 'SET_LAID', playerId: 'a', isPowerSet: false, setId: 's1', rank: 'herring' }, { type: 'GAME_ENDED', winners: ['c'], reason: 'decided' },
    ]);
    const c = ch(r, 'c');
    expect(c.podiumAt).not.toBeNull();
    expect(c.podiumAt!).toBeLessThanOrEqual(1000);
    const e = beat(c, 'end');
    expect(e.cls).toBe('ceremony');
    expect(e.masks).toEqual([{ target: 'podium', until: c.podiumAt }]);
    expect(e.cues[0]).toMatchObject({ id: 'mus.end.win', at: c.podiumAt });
  });
});

describe('juice classes (§4.3)', () => {
  it('light beats carry no juice; medium at most a 1 px shake; heavy beats hit-stop 60-80 ms, trauma 0.4-0.6 and at most one impact frame per step', () => {
    const steps = [askStep, yes(3), wet, dry, rec(1, view(), view(), [{ type: 'POWER_USED', playerId: 'c', rank: 'shark' }, { type: 'SHARK_JUMP', playerId: 'c', fromId: 'a', count: 2 }])];
    for (const r of steps) {
      const c = ch(r);
      for (const b of c.beats) {
        if (b.cls === 'light') expect(b.juice?.hitStopMs, b.kind).toBeUndefined();
        if (b.cls === 'medium' && b.juice?.trauma) expect(b.juice.trauma ** 2 * 6, b.kind).toBeLessThanOrEqual(1);
        if (b.cls === 'heavy' && b.juice) {
          expect(b.juice.hitStopMs).toBeGreaterThanOrEqual(60);
          expect(b.juice.hitStopMs).toBeLessThanOrEqual(80);
          expect(b.juice.trauma).toBeGreaterThanOrEqual(0.4);
          expect(b.juice.trauma).toBeLessThanOrEqual(0.6);
        }
      }
      expect(c.beats.filter((b) => b.juice?.impact).length).toBeLessThanOrEqual(1);
    }
  });

  it('light beats fit 320 ms of table time (the ask) - the totem hop is its own beat', () => {
    expect(beat(ch(askStep), 'ask').dur).toBeLessThanOrEqual(320);
  });
});

describe('backlog, speed and reduced motion (§4.2)', () => {
  it('more than 1.2 s queued: 1.5x with each cue\'s short variant', () => {
    const slow = ch(yes(3));
    const fast = ch(yes(3), 'c', { ...DEFAULT_OPTIONS, speed: 1.5, short: true });
    expect(fast.tableMs).toBe(Math.round(slow.tableMs / 1.5));
    expect(fast.cues.length).toBe(slow.cues.length);
    expect(fast.cues.every((c) => c.params?.short === true)).toBe(true);
    expect(slow.cues.every((c) => c.params?.short !== true)).toBe(true);
    // every landing scales, the order is kept
    expect(fast.beats.map((b) => b.kind)).toEqual(slow.beats.map((b) => b.kind));
    const lands = (c: Choreography) => c.beats.flatMap((b) => b.flights.map((f) => f.land));
    expect(lands(fast)).toEqual(lands(slow).map((l) => Math.round(l / 1.5)));
  });

  it('more than 2.5 s queued: flush to the end state and play only the last landing', () => {
    const f = ch(yes(3), 'c', { ...DEFAULT_OPTIONS, flush: true });
    const flying = f.beats.filter((b) => b.lane === 'table' && b.flights.length);
    expect(flying).toHaveLength(1);
    expect(flying[0].flights).toHaveLength(1);
    expect(f.tableMs).toBeLessThan(200);
    // the close and the plank still happen: input is never blocked
    expect(kinds(f)).toContain('close');
  });

  it('reduced motion: order kept, travel instant, no hit-stop, shake or impact frame; audio unchanged', () => {
    const r = rec(1, view(), view(), [{ type: 'POWER_USED', playerId: 'c', rank: 'mantisShrimp' }, { type: 'SET_DESTROYED', setId: 's1', byPlayerId: 'c' }]);
    const normal = ch(r);
    const reduced = ch(r, 'c', { ...DEFAULT_OPTIONS, reduced: true });
    expect(reduced.beats.map((b) => b.kind)).toEqual(normal.beats.map((b) => b.kind));
    expect(reduced.beats.every((b) => !b.juice)).toBe(true);
    expect(normal.beats.some((b) => b.juice)).toBe(true);
    expect(reduced.cues).toEqual(normal.cues);
    const y = ch(yes(3), 'c', { ...DEFAULT_OPTIONS, reduced: true });
    expect(y.beats.flatMap((b) => b.flights).every((f) => f.instant)).toBe(true);
    expect(y.tableMs).toBe(ch(yes(3)).tableMs);
  });
});

describe('cards in flight (§4.3)', () => {
  it('duration is clamp(distance / 1.8, 260, 460) ms', () => {
    expect(flightMs(100)).toBe(260);
    expect(flightMs(1000)).toBe(460);
    expect(flightMs(720)).toBe(400);
  });

  it('at most twelve flights of one step are ever asked for', () => {
    const c = ch(yes(12));
    expect(c.beats.reduce((n, b) => n + b.flights.length, 0)).toBeLessThanOrEqual(12);
    const big = ch(yes(40));
    expect(beat(big, 'give').flights.length).toBeLessThanOrEqual(12);
  });

  it('the lane clock: hud and log beats never extend the table lane', () => {
    const c = ch(askStep);
    expect(c.tableMs).toBe(320);
    expect(beat(c, 'hold').lane).toBe('hud');
    expect(TIME.close).toBe(220);
  });
});
