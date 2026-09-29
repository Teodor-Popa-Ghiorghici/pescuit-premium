import { describe, expect, it } from 'vitest';
import { BUSES, CUES, MOTIF_RANKS, SEAT_CUES, bandOf, cueDef, type CueDef } from '../src/audio/cuesheet.js';
import { RECIPES } from '../src/audio/recipes.js';

const withPlays = CUES.filter((c): c is CueDef & { plays: [number, number] } => c.plays !== null);

describe('the cue sheet enforces §3.7', () => {
  it('has unique ids, all named as Appendix C / D name them', () => {
    const ids = CUES.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of [
      'ui.press', 'ui.press.soft', 'ui.select', 'ui.drop', 'ui.target', 'ui.error', 'ui.toggle', 'ui.copy',
      'table.turn', 'table.turn.you', 'table.bonus', 'table.skipped', 'table.ask', 'table.asked', 'table.flight', 'table.give',
      'table.gofish', 'table.gofish.dry', 'table.draw', 'table.refill', 'table.poolEmpty', 'table.lay', 'table.lay.power', 'table.tally',
      'mus.start', 'mus.lastset', 'mus.end.win', 'mus.end.tie', 'mus.end.lose',
      'clock.tick', 'clock.tick.urgent', 'clock.close', 'clock.eligible',
      'power.granted', 'power.granted.mine', 'power.reveal', 'power.shark', 'power.lanternfish', 'power.tortoise', 'power.jellyfish',
      'power.stickleback', 'power.stickleback.miss', 'power.mantis', 'power.whale', 'power.clownfish.bound',
      'amb.gate', 'meta.join', 'meta.leave', 'meta.reconnected', 'meta.nudge',
    ]) expect(ids, id).toContain(id);
    for (const r of ['shark', 'tortoise', 'lanternfish', 'mantis', 'jellyfish', 'stickleback', 'whale', 'clownfish']) {
      expect(ids).toContain(`power.used.${r}`);
      expect(ids).toContain(`power.granted.${r}`);
    }
  });

  it('every cue has a recipe and every recipe a cue', () => {
    expect(Object.keys(RECIPES).sort()).toEqual(CUES.map((c) => c.id).sort());
  });

  it('play band -> variation mode, maximum length and level', () => {
    for (const c of withPlays) {
      const band = bandOf(c.plays);
      if (band === 'gt60') {
        expect(c.variation, `${c.id} is heard > 60 times: live`).toBe('live');
        expect(c.maxLenMs, `${c.id}: <= 250 ms`).toBeLessThanOrEqual(250);
        expect(c.levelDb, `${c.id}: the lowest levels`).toBeLessThanOrEqual(-2);
      } else if (band === '15-60') {
        expect(c.variation, `${c.id} is heard 15-60 times: live`).toBe('live');
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
    for (const id of ['table.lay', 'table.lay.power', 'power.granted', 'power.reveal']) expect(band(id)).toBe('3-15');
    for (const id of ['table.poolEmpty', 'power.whale', 'power.shark', 'mus.start', 'power.used.lanternfish']) expect(band(id)).toBe('lt3');
  });

  it('bus by family', () => {
    for (const c of CUES) {
      const fam = c.id.split('.')[0];
      const expected: string[] = { ui: ['UI'], table: ['Table'], clock: c.id === 'clock.eligible' ? ['UI'] : ['Clock'], power: ['Power'], mus: ['Music'], amb: ['Ambience'], meta: ['Table', 'UI'] }[fam]!;
      expect(expected, `${c.id} on ${c.bus}`).toContain(c.bus);
    }
  });

  it('carries the §3.5 bus table', () => {
    expect(BUSES.UI).toMatchObject({ levelDb: -10, speakerBoostDb: 4, voices: 2 });
    expect(BUSES.Table).toMatchObject({ levelDb: 0, voices: 6 });
    expect(BUSES.Power).toMatchObject({ levelDb: 1, voices: 3 });
    expect(BUSES.Clock).toMatchObject({ levelDb: -8, speakerBoostDb: 4, voices: 2 });
    expect(BUSES.Music).toMatchObject({ levelDb: -2, voices: 2 });
    expect(BUSES.Ambience).toMatchObject({ levelDb: -26, voices: 3 });
  });

  it('follows Appendix D on the rows that carry the design', () => {
    const d = (id: string) => cueDef(id)!;
    expect(d('table.turn')).toMatchObject({ levelDb: -6, prio: 2, inst: 1, cooldownMs: 150, maxLenMs: 200 });
    expect(d('table.ask')).toMatchObject({ levelDb: -4, cooldownMs: 150 });
    expect(d('clock.close')).toMatchObject({ prio: 5, levelDb: -2, maxLenMs: 60 });
    expect(d('clock.tick')).toMatchObject({ levelDb: -2, cooldownMs: 900 });
    expect(d('clock.tick.urgent')).toMatchObject({ levelDb: 0, cooldownMs: 400 });
    expect(d('table.draw')).toMatchObject({ inst: 3, cooldownMs: 60 });
    expect(d('table.flight')).toMatchObject({ levelDb: -10, inst: 2, cooldownMs: 100 });
    expect(d('power.whale')).toMatchObject({ levelDb: 1 });
    expect(d('table.lay').variation).toBe(4);
    expect(d('table.lay.power').variation).toBe(3);
    expect(d('amb.gate')).toMatchObject({ levelDb: -20, bus: 'Ambience' });
    expect(d('clock.eligible')).toMatchObject({ bus: 'UI', heard: 'private' });
  });

  it('only seat cues may carry a signature (the ringing planks)', () => {
    expect([...SEAT_CUES].sort()).toEqual(['meta.join', 'meta.leave', 'meta.nudge', 'power.lanternfish', 'table.ask', 'table.bonus', 'table.skipped', 'table.turn', 'table.turn.you', 'ui.target'].sort());
  });

  it('has no cue for Squid, in any form: silence has no id', () => {
    expect(CUES.filter((c) => /squid/i.test(c.id))).toEqual([]);
    expect(MOTIF_RANKS as readonly string[]).not.toContain('squid');
    expect(Object.keys(RECIPES).filter((k) => /squid/i.test(k))).toEqual([]);
  });

  it('the private tier is exactly what §3.2 names', () => {
    expect(CUES.filter((c) => c.heard === 'private').map((c) => c.id).sort()).toEqual(['clock.eligible', 'power.clownfish.bound', 'power.granted.mine']);
  });
});
