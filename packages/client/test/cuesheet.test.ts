import { describe, expect, it } from 'vitest';
import { BUSES, CUES, FRAME_BREAKERS, POWER_CUE, SEAT_CUES, bandOf, cueDef, durationOf, type CueDef } from '../src/audio/cuesheet.js';
import { RECIPES } from '../src/audio/recipes.js';

const withPlays = CUES.filter((c): c is CueDef & { plays: [number, number] } => c.plays !== null);

describe('the cue sheet enforces §3.7', () => {
  it('has unique ids, all named as SOUND_DESIGN names them', () => {
    const ids = CUES.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of [
      'ui.press', 'ui.press.soft', 'ui.select', 'ui.drop', 'ui.target', 'ui.error', 'ui.toggle', 'ui.copy',
      'table.turn', 'table.turn.you', 'table.bonus', 'table.skipped', 'table.ask', 'table.asked', 'table.flight', 'table.give',
      'table.gofish', 'table.gofish.dry', 'table.draw', 'table.refill', 'table.poolEmpty', 'table.lay', 'table.lay.power', 'table.lay.hidden', 'table.egg', 'table.impact', 'table.tally',
      'world.dark.12', 'world.dark.06', 'world.dark.01', 'world.notch',
      'mus.start', 'mus.podium', 'mus.home',
      'clock.tick', 'clock.tick.urgent', 'clock.close',
      'power.granted', 'power.windup', 'power.reveal', 'power.shark', 'power.lanternfish', 'power.tortoise', 'power.jellyfish',
      'power.stickleback', 'power.stickleback.miss', 'power.mantis', 'power.whale', 'power.clownfish.bound',
      'amb.gate', 'meta.join', 'meta.leave', 'meta.reconnected', 'meta.nudge',
    ]) expect(ids, id).toContain(id);
  });

  it('the melodies, the strings and the score race are gone', () => {
    const ids = CUES.map((c) => c.id);
    for (const gone of ['table.lead', 'table.breakaway', 'table.chase', 'table.clinch', 'mus.lastset', 'mus.end.win', 'mus.end.tie', 'mus.end.lose', 'clock.eligible', 'power.granted.mine'])
      expect(ids, gone).not.toContain(gone);
    expect(ids.filter((i) => /^power\.(used|granted)\./.test(i))).toEqual([]);
  });

  it('every cue has a recipe and every recipe a cue', () => {
    expect(Object.keys(RECIPES).sort()).toEqual(CUES.map((c) => c.id).sort());
  });

  it('play band -> variation mode, maximum length and level', () => {
    for (const c of withPlays) {
      const band = bandOf(c.plays);
      if (band === 'gt60') {
        expect(c.variation, `${c.id} is heard > 60 times: three takes`).toBe(3);
        expect(c.maxLenMs, `${c.id}: <= 250 ms`).toBeLessThanOrEqual(250);
        expect(c.levelDb, `${c.id}: the lowest levels`).toBeLessThanOrEqual(-2);
      } else if (band === '15-60') {
        expect(c.variation, `${c.id} is heard 15-60 times: three takes`).toBe(3);
        expect(c.maxLenMs, `${c.id}: <= 450 ms`).toBeLessThanOrEqual(450);
      } else if (band === '3-15') {
        expect(typeof c.variation, `${c.id}: takes`).toBe('number');
        expect(c.variation as number, `${c.id}: 3-4 takes`).toBeGreaterThanOrEqual(3);
        expect(c.variation as number, `${c.id}: 3-4 takes`).toBeLessThanOrEqual(4);
      } else {
        expect(typeof c.variation, `${c.id}: premium takes`).toBe('number');
        expect(c.variation as number, `${c.id}: 1-2 premium takes`).toBeLessThanOrEqual(2);
      }
    }
  });

  it('the frequent cues are the ones the plan names (§3.7)', () => {
    const band = (id: string) => bandOf(cueDef(id)!.plays!);
    for (const id of ['table.turn', 'table.ask', 'clock.close']) expect(band(id)).toBe('gt60');
    for (const id of ['table.gofish', 'table.gofish.dry', 'table.give', 'table.flight', 'table.bonus', 'table.draw', 'table.asked', 'ui.select', 'ui.target', 'table.turn.you']) expect(band(id)).toBe('15-60');
    for (const id of ['table.lay', 'table.lay.power', 'table.lay.hidden', 'power.granted', 'power.reveal']) expect(band(id)).toBe('3-15');
    for (const id of ['world.notch', 'table.egg']) expect(band(id)).toBe('15-60');
    for (const id of ['table.poolEmpty', 'power.whale', 'power.shark', 'mus.start', 'power.lanternfish', 'world.dark.01', 'mus.podium', 'mus.home']) expect(band(id)).toBe('lt3');
  });

  it('bus by family', () => {
    for (const c of CUES) {
      const fam = c.id.split('.')[0];
      const expected: string[] = { ui: ['UI'], table: ['Table'], clock: ['Clock'], power: ['Power'], mus: ['Music'], world: ['Table', 'Music'], amb: ['Ambience'], meta: ['Table', 'UI'] }[fam]!;
      expect(expected, `${c.id} on ${c.bus}`).toContain(c.bus);
    }
  });

  it('carries the §3.5 bus table', () => {
    expect(BUSES.UI).toMatchObject({ levelDb: -10, speakerBoostDb: 4, voices: 2 });
    expect(BUSES.Table).toMatchObject({ levelDb: 0, voices: 6 });
    expect(BUSES.Power).toMatchObject({ levelDb: 1, voices: 3 });
    expect(BUSES.Clock).toMatchObject({ levelDb: -8, speakerBoostDb: 4, headphonesBoostDb: 2, voices: 2 });
    expect(BUSES.Music).toMatchObject({ levelDb: -2, voices: 2 });
    expect(BUSES.Ambience).toMatchObject({ levelDb: -26, voices: 3 });
  });

  it('follows Appendix D on the rows that carry the design', () => {
    const d = (id: string) => cueDef(id)!;
    expect(d('table.turn')).toMatchObject({ levelDb: -6, prio: 2, inst: 1, cooldownMs: 150, maxLenMs: 200 });
    expect(d('table.ask')).toMatchObject({ levelDb: -4, cooldownMs: 150 });
    expect(d('clock.close')).toMatchObject({ prio: 5, levelDb: -2, maxLenMs: 60 });
    expect(d('clock.tick')).toMatchObject({ levelDb: -1.2, cooldownMs: 900 });
    // tightened by spacing, not by volume: the urgent double click is no louder than the tick
    expect(d('clock.tick.urgent')).toMatchObject({ levelDb: d('clock.tick').levelDb, cooldownMs: 400 });
    expect(d('table.draw')).toMatchObject({ inst: 3, cooldownMs: 60 });
    expect(d('table.flight')).toMatchObject({ levelDb: -10, inst: 2, cooldownMs: 100 });
    expect(d('power.whale')).toMatchObject({ levelDb: 1 });
    expect(d('table.lay').variation).toBe(3);
    expect(d('table.lay.power').variation).toBe(3);
    expect(d('amb.gate')).toMatchObject({ levelDb: -20, bus: 'Ambience' });
  });

  it('only seat cues may carry a signature (the ringing planks)', () => {
    expect([...SEAT_CUES].sort()).toEqual(['meta.join', 'meta.leave', 'meta.nudge', 'power.lanternfish', 'table.ask', 'table.bonus', 'table.skipped', 'table.turn', 'table.turn.you', 'ui.target'].sort());
  });

  it('has no cue for Squid, in any form: silence has no id', () => {
    expect(CUES.filter((c) => /squid/i.test(c.id))).toEqual([]);
    expect(Object.keys(POWER_CUE)).not.toContain('squid');
    expect(Object.keys(RECIPES).filter((k) => /squid/i.test(k))).toEqual([]);
  });

  it('there is no private tier: every cue is heard by everyone it concerns', () => {
    for (const c of CUES) expect(['all', 'local', 'you'], c.id).toContain(c.heard);
  });

  it('the rare signature cues duck the ambience; the frequent ones never do (it would pump)', () => {
    const ducking = CUES.filter((c) => c.env === 'ex').map((c) => c.id).sort();
    expect(ducking).toEqual(['mus.home', 'mus.podium', 'mus.start', 'power.mantis', 'power.reveal', 'power.shark', 'power.whale', 'world.dark.01', 'world.dark.06', 'world.dark.12'].sort());
    for (const c of CUES.filter((x) => x.env === 'ex')) expect(c.plays![1], `${c.id} is rare`).toBeLessThanOrEqual(6);
  });

  it('three cues may leave the palette, and they are Shark, Mantis Shrimp and Whale', () => {
    expect([...FRAME_BREAKERS].sort()).toEqual(['power.mantis', 'power.shark', 'power.whale']);
    for (const id of FRAME_BREAKERS) expect(cueDef(id)!.bus).toBe('Power');
  });

  it('every cue lasts at most 1.4 s but the tulnic\'s call and the podium, and durations are static', () => {
    for (const c of CUES) {
      if (c.id === 'mus.start' || c.id === 'mus.podium') continue;
      expect(durationOf(c.id, { count: 4 }), c.id).toBeLessThanOrEqual(1400);
    }
    expect(durationOf('nonesuch')).toBe(0);
  });
});

describe('the score bus and its ducks (MUSIC_PLAN A7, §4.2)', () => {
  it('the score ducks 10 dB under the powers\' strikes only - never under a cut point (the darkenings) or mus.home', () => {
    const ducks = CUES.filter((c) => c.scoreDuckDb !== undefined);
    expect(ducks.map((c) => c.id).sort()).toEqual(['power.mantis', 'power.reveal', 'power.shark', 'power.whale']);
    for (const c of ducks) expect(c.scoreDuckDb).toBe(-10);
    for (const id of ['world.dark.12', 'world.dark.06', 'world.dark.01', 'mus.home']) expect(CUES.find((c) => c.id === id)!.scoreDuckDb, id).toBeUndefined();
  });
  it('no cue plays on the Score bus: it is the score\'s alone', () => {
    expect(CUES.filter((c) => c.bus === 'Score')).toEqual([]);
    expect(BUSES.Score.voices).toBe(0);
  });
});
