/* The world arc (§3.9) and the ceremony (§5.7): the stages, the notches, the drain, the podium's count-up. */
import { describe, expect, it } from 'vitest';
import type { PublicEvent, PublicRecord, PublicView, SeatFacts } from '../src/audio/cues.js';
import { BEAT, cuesFor } from '../src/audio/cues.js';
import { cueDef } from '../src/audio/cuesheet.js';
import { choreograph, DEFAULT_OPTIONS, summarize, TIME } from '../src/game/choreography.js';
import { lightOf, notchesTaken, stageChanged, worldStage } from '../src/game/world.js';

const PLAYERS = ['a', 'b', 'c', 'd'];
const view = (over: Partial<PublicView> = {}): PublicView => ({ players: PLAYERS, currentPlayerId: 'a', poolCount: 10, window: null, setsPossible: 12, endPressure: { misses: 0, limit: 8 }, laidSets: [], handSizes: { a: 5, b: 5, c: 5, d: 5 }, ...over });
const rec = (seq: number, before: PublicView | null, after: PublicView, events: PublicEvent[] = []): PublicRecord => ({ seq, mode: 'ascuns', before, after, events });
const facts = (playerId: string): SeatFacts => ({ playerId, headphones: false });

describe('the stages (§3.9)', () => {
  it('follow the public count: dusk 18-13, evening 12-7, night 6-2, the last set 1, the finale 0', () => {
    const at = (n: number) => worldStage(n);
    for (const n of [18, 17, 13]) expect(at(n)).toBe('dusk');
    for (const n of [12, 9, 7]) expect(at(n)).toBe('evening');
    for (const n of [6, 4, 2]) expect(at(n)).toBe('night');
    expect(at(1)).toBe('last');
    expect(at(0)).toBe('finale');
    expect(worldStage(null)).toBe('dusk');
    expect(worldStage(5, true)).toBe('finale');
  });

  it('--apa steps one flat step darker at 12, 6 and 1 sets - and only there', () => {
    expect([18, 13, 12, 7, 6, 2, 1, 0].map((n) => lightOf(worldStage(n)))).toEqual(['dusk', 'dusk', 'evening', 'evening', 'night', 'night', 'last', 'last']);
  });

  it('announces a stage only when the count crosses into it', () => {
    expect(stageChanged(13, 12)).toBe('evening');
    expect(stageChanged(12, 11)).toBeNull();
    expect(stageChanged(7, 6)).toBe('night');
    expect(stageChanged(2, 1)).toBe('last');
    expect(stageChanged(2, 0)).toBe('finale');
  });

  it('counts the notches a lay takes: one, or two when it strands another set\'s cards', () => {
    expect(notchesTaken(5, 4)).toBe(1);
    expect(notchesTaken(5, 3)).toBe(2);
    expect(notchesTaken(5, 5)).toBe(0);
    expect(notchesTaken(null, 3)).toBe(0);
  });
});

describe('the rim, the drain and the light in the choreography', () => {
  const laid = (over: Partial<PublicView>) => view({ laidSets: [{ id: 's1', ownerId: 'a', isPowerSet: false, rank: 'herring', cardCount: 3, spent: false, destroyed: false }], ...over });
  const lay = (from: number, to: number) => rec(30, view({ setsPossible: from }), laid({ setsPossible: to }), [{ type: 'SET_LAID', playerId: 'a', isPowerSet: false, setId: 's1', rank: 'herring' }]);

  it('a lay that strands another set\'s cards takes two notches: two chips fly, and the notch op says from -> to', () => {
    const one = choreograph(lay(5, 4), facts('b'), DEFAULT_OPTIONS).beats.find((b) => b.kind === 'lay')!;
    const two = choreograph(lay(5, 3), facts('b'), DEFAULT_OPTIONS).beats.find((b) => b.kind === 'lay')!;
    expect(one.vfx.filter((v) => v.kind === 'woodChips')).toHaveLength(1);
    expect(two.vfx.filter((v) => v.kind === 'woodChips')).toHaveLength(2);
    expect(two.ops.find((o) => o.op === 'notch')).toMatchObject({ from: 5, to: 3 });
  });

  it('the last set inks its notch when the beat lands, not when the view arrives', () => {
    const b = choreograph(lay(2, 1), facts('b'), DEFAULT_OPTIONS).beats.find((x) => x.kind === 'lastSet')!;
    expect(b.masks).toEqual([{ target: 'lastnotch', until: BEAT.lastSet }]);
  });

  it('the pool\'s last card drains the basin to a dry floor, in step with table.poolEmpty', () => {
    const r = rec(20, view({ poolCount: 1, window: { type: 'RESPONSE_PENDING', askerId: 'a', targetId: 'b' } }), view({ poolCount: 0, currentPlayerId: 'b' }), [
      { type: 'WINDOW_CLOSED' }, { type: 'REQUEST_FAILED', askerId: 'a', targetId: 'b' }, { type: 'DREW_FROM_POOL', playerId: 'a', poolEmpty: true }, { type: 'TURN_STARTED', playerId: 'b' },
    ]);
    const c = choreograph(r, facts('b'), DEFAULT_OPTIONS);
    const b = c.beats.find((x) => x.kind === 'poolEmpty')!;
    expect(b.ops.find((o) => o.op === 'drain')).toMatchObject({ at: TIME.draw });
    expect(b.cues.map((x) => x.id)).toContain('table.poolEmpty');
  });

  it('the Tortoise\'s cards drop back the same way for any count: one back lifts toward the asker and returns', () => {
    const r = rec(50, view({ window: { type: 'TRANSFER_PENDING', askerId: 'a', targetId: 'b' } }), view(), [{ type: 'TORTOISE_BLOCK', playerId: 'b', rank: 'herring' }]);
    const b = choreograph(r, facts('c'), DEFAULT_OPTIONS).beats.find((x) => x.kind === 'block')!;
    // the shell drops onto the seat first; then one back lifts toward the asker, strikes it and drops back
    expect(b.flights).toHaveLength(3);
    expect(b.flights[0]).toMatchObject({ what: 'fx', sprite: 'shell', to: { k: 'seat', id: 'b' } });
    const cards = b.flights.filter((x) => x.what === 'back');
    expect(cards[0]).toMatchObject({ what: 'back', from: { k: 'seat', id: 'b' }, to: { k: 'between', from: 'b', to: 'a' } });
    expect(cards[1]).toMatchObject({ what: 'back', to: { k: 'seat', id: 'b' } });
    // the same for every viewer, the owner included
    expect(summarize(choreograph(r, facts('b'), DEFAULT_OPTIONS))).toEqual(summarize(choreograph(r, facts('c'), DEFAULT_OPTIONS)));
  });
});

describe('the podium (§5.7)', () => {
  const ended = (scores: Record<string, number>, winners: string[], reason: string, who = 'c'): { c: ReturnType<typeof choreograph>; cues: ReturnType<typeof cuesFor> } => {
    const r = rec(90, view({ setsPossible: 1 }), view({ setsPossible: 0, ended: true, scores }), [
      { type: 'SET_LAID', playerId: 'a', isPowerSet: false, setId: 's1', rank: 'herring' },
      { type: 'GAME_ENDED', scores, winners, reason } as PublicEvent,
    ]);
    return { c: choreograph(r, facts(who), DEFAULT_OPTIONS), cues: cuesFor(r, facts(who)) };
  };

  it('counts the pips up with table.tally, one cue per pip, a step higher each - the same for every viewer', () => {
    const scores = { a: 5, b: 3, c: 2, d: 0 };
    const tallies = (who: string) => ended(scores, ['a'], 'decided', who).cues.filter((c) => c.id === 'table.tally');
    const mine = tallies('c');
    expect(mine).toHaveLength(5);
    expect(mine.map((c) => c.params?.pip)).toEqual([0, 1, 2, 3, 4]);
    expect(mine.map((c) => c.at)).toEqual([0, 1, 2, 3, 4].map((k) => BEAT.tallyStart + k * BEAT.tallyStep));
    // the winner and a loser hear the same pips (only the ceremony's cue differs)
    expect(tallies('a')).toEqual(mine);
    expect(tallies('b')).toEqual(mine);
    expect(cueDef('table.tally')?.heard).toBe('all');
  });

  it('places the count-up on the end beat, after the podium shows, with the ceremony cue', () => {
    const { c } = ended({ a: 3, b: 3, c: 1, d: 0 }, ['a', 'b'], 'decided');
    const e = c.beats.find((b) => b.kind === 'end')!;
    const tally = e.cues.filter((x) => x.id === 'table.tally');
    expect(tally).toHaveLength(3);
    expect(tally[0].at).toBe(c.podiumAt! + BEAT.tallyStart);
    expect(e.cues.some((x) => x.id.startsWith('mus.end'))).toBe(true);
  });

  it('a tie is the tie ceremony for both winners, the loss for the rest; no reason gets a different beat length', () => {
    const tie = { a: 4, b: 4, c: 1, d: 0 };
    expect(ended(tie, ['a', 'b'], 'decided', 'a').cues.map((c) => c.id)).toContain('mus.end.tie');
    expect(ended(tie, ['a', 'b'], 'decided', 'c').cues.map((c) => c.id)).toContain('mus.end.lose');
    const lengths = ['decided', 'streak', 'exhausted'].map((r) => ended(tie, ['a', 'b'], r).c.podiumAt);
    expect(new Set(lengths).size).toBe(1);
  });

  it('never counts more than 18 pips (the deck holds 18 sets)', () => {
    expect(ended({ a: 40, b: 0, c: 0, d: 0 }, ['a'], 'decided').cues.filter((c) => c.id === 'table.tally')).toHaveLength(18);
  });
});
