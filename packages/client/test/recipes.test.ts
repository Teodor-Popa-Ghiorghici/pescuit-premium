import { beforeAll, describe, expect, it } from 'vitest';
import { CUES, MOTIF_RANKS, SEAT_CUES } from '../src/audio/cuesheet.js';
import { RECIPES } from '../src/audio/recipes.js';
import { hooks } from '../src/audio/live/common.js';
import { click, signature, wood } from '../src/audio/live/wood.js';
import { paperLift, paperSlide } from '../src/audio/live/paper.js';
import { doba, slap, stamp, thud } from '../src/audio/live/tabletop.js';
import { bubble, drip, splash } from '../src/audio/live/water.js';
import { loadRendered, preloadRendered } from '../src/audio/bank.js';
import { rng } from '../src/audio/util.js';
import { fakeCtx } from './fakeaudio.js';

describe('the live families stay inside the node budget (§3.5: at most 10 nodes a hit)', () => {
  const hit = (name: string, fn: (ctx: BaseAudioContext, out: AudioNode) => void, max = 10) =>
    it(`${name} <= ${max}`, () => {
      const { ctx, tally } = fakeCtx();
      fn(ctx, ctx.destination);
      expect(tally.total).toBeLessThanOrEqual(max);
      expect(tally.total).toBeGreaterThan(0);
    });
  for (const plank of ['A', 'B', 'C', 'D'] as const)
    for (const damping of [0, 0.3, 0.9]) for (const hard of [false, true]) hit(`wood ${plank} damping ${damping}${hard ? ' hard' : ''}`, (c, o) => wood(c, o, 0, { plank, damping, hard }));
  hit('click', (c, o) => click(c, o, 0, 1));
  hit('paper slide', (c, o) => paperSlide(c, o, 0, 0.2, 1, rng(1)));
  hit('paper lift', (c, o) => paperLift(c, o, 0, 1, rng(1)));
  hit('thud', (c, o) => thud(c, o, 0, 1, rng(1)));
  hit('slap', (c, o) => slap(c, o, 0, 1, rng(1)));
  hit('stamp', (c, o) => stamp(c, o, 0, 1, rng(1)));
  hit('doba', (c, o) => doba(c, o, 0, 1, rng(1)));
  hit('bubble', (c, o) => bubble(c, o, 0, 500, 0.05, 1));
  hit('drip', (c, o) => drip(c, o, 0, rng(1)));
  hit('splash', (c, o) => splash(c, o, 0, rng(1), 1));
  hit('a seat knock (signature, one)', (c, o) => signature(c, o, 0, 0, 1));
  it('a two-knock signature is two hits', () => {
    const { ctx, tally } = fakeCtx();
    signature(ctx, ctx.destination, 0, 3, 1);
    expect(tally.total).toBeLessThanOrEqual(20);
  });
});

describe('the plank grammar (§3.1): a ringing A, B or C means a seat', () => {
  beforeAll(async () => {
    await loadRendered();
    await preloadRendered();
  });
  it('no recipe but the seat cues strikes plank A, B or C, in any variant', () => {
    const offenders: string[] = [];
    for (const c of CUES) {
      for (const speaker of [false, true]) {
        for (const short of [false, true]) {
          const struck = new Set<string>();
          hooks.strike = (p) => struck.add(p);
          const { ctx } = fakeCtx();
          const params = { seat: 4, rank: 'shark', count: 2, on: true, open: true, wet: 1, pip: 2, short };
          RECIPES[c.id](ctx, ctx.destination, 0, 3, speaker, params);
          hooks.strike = undefined;
          const ringing = [...struck].filter((p) => 'ABC'.includes(p));
          if (ringing.length && !SEAT_CUES.has(c.id)) offenders.push(`${c.id} strikes ${ringing.join('')}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
  it('the seat cues really do strike a ringing plank (the grammar is not vacuous)', () => {
    for (const id of ['table.turn', 'table.ask', 'table.bonus', 'ui.target', 'power.lanternfish', 'meta.join']) {
      const struck = new Set<string>();
      hooks.strike = (p) => struck.add(p);
      const { ctx } = fakeCtx();
      RECIPES[id](ctx, ctx.destination, 0, 3, false, { seat: 1 });
      hooks.strike = undefined;
      expect([...struck].some((p) => 'ABC'.includes(p)), id).toBe(true);
    }
  });
  it('the clock and the hand use plank D only', () => {
    for (const id of ['clock.tick', 'clock.tick.urgent', 'clock.close', 'table.asked', 'ui.press', 'ui.press.soft', 'table.gofish.dry', 'power.reveal', 'power.mantis', 'power.shark']) {
      const struck = new Set<string>();
      hooks.strike = (p) => struck.add(p);
      const { ctx } = fakeCtx();
      RECIPES[id](ctx, ctx.destination, 0, 3, false, {});
      hooks.strike = undefined;
      expect([...struck].every((p) => p === 'D'), id).toBe(true);
    }
  });
});

describe('every recipe builds without throwing, in every variant', () => {
  it('builds the whole sheet', async () => {
    await loadRendered();
    for (const c of CUES)
      for (const speaker of [false, true])
        for (const short of [false, true]) {
          const { ctx, tally } = fakeCtx();
          RECIPES[c.id](ctx, ctx.destination, 0, 7, speaker, { seat: 2, rank: 'whale', count: 3, on: false, open: false, short });
          expect(tally.total, `${c.id} builds nodes`).toBeLessThan(80);
        }
    expect(MOTIF_RANKS.length).toBe(8);
  });
});
