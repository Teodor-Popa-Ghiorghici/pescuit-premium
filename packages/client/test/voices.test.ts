import { describe, expect, it } from 'vitest';
import { GLOBAL_VOICES, cueDef } from '../src/audio/cuesheet.js';
import { VoicePool } from '../src/audio/voices.js';

const d = (id: string) => cueDef(id)!;

describe('the voice pool (§3.5)', () => {
  it('caps the whole engine at 14 voices', () => {
    expect(GLOBAL_VOICES).toBe(14);
    const pool = new VoicePool();
    // seven table cues on different ids (Table holds 6), then power, ui, clock, music fill the rest
    const ids = ['table.turn', 'table.give', 'table.gofish', 'table.lay', 'table.asked', 'table.draw', 'power.whale', 'power.shark', 'power.mantis', 'ui.press', 'ui.select', 'clock.close', 'mus.start', 'clock.tick'];
    let started = 0;
    for (const id of ids) if (pool.admit(d(id), 0, 10).ok) started++;
    expect(pool.count(0.01)).toBeLessThanOrEqual(14);
    expect(started).toBe(ids.length);
    // the 15th needs a steal: only equal-or-higher priority gets in
    const low = pool.admit({ ...d('amb.gate'), id: 'amb.layer', prio: 0 }, 0, 1);
    expect(low.ok).toBe(false);
    const high = pool.admit(d('clock.close'), 0.001, 1);
    expect(pool.count(0.002)).toBeLessThanOrEqual(14);
    expect(high.ok).toBe(true);
  });

  it('steals the oldest voice of the lowest priority: Clock > Power > Table > UI > Ambience', () => {
    const pool = new VoicePool(3);
    pool.admit(d('table.give'), 0, 10); // prio 3
    pool.admit(d('ui.press'), 0.1, 10); // prio 1
    pool.admit(d('ui.select'), 0.2, 10); // prio 1, newer
    const a = pool.admit(d('power.shark'), 0.3, 10); // prio 4
    expect(a.ok).toBe(true);
    if (a.ok) {
      expect(a.steal.map((v) => v.cue)).toEqual(['ui.press']);
    }
    const b = pool.admit(d('clock.close'), 0.4, 10); // prio 5
    expect(b.ok && b.steal.map((v) => v.cue)).toEqual(['ui.select']);
  });

  it('refuses a lower-priority cue rather than steal from a higher one', () => {
    const pool = new VoicePool(2);
    pool.admit(d('clock.close'), 0, 10);
    pool.admit(d('power.shark'), 0, 10);
    const r = pool.admit(d('ui.press'), 0.1, 10);
    expect(r).toEqual({ ok: false, reason: 'priority' });
  });

  it('per-bus caps: UI 2, Clock 2, Music 2, Table 6, Power 3', () => {
    const pool = new VoicePool();
    expect(pool.admit(d('ui.press'), 0, 5).ok).toBe(true);
    expect(pool.admit(d('ui.select'), 0.1, 5).ok).toBe(true);
    const third = pool.admit(d('ui.error'), 0.2, 5); // a third UI voice must steal a UI voice
    expect(third.ok && third.steal.length).toBe(1);
    expect(pool.count(0.3, 'UI')).toBe(2);
  });

  it('per-cue instance caps and cooldowns (Appendix D)', () => {
    const pool = new VoicePool();
    expect(pool.admit(d('table.turn'), 0, 0.3).ok).toBe(true);
    expect(pool.admit(d('table.turn'), 0.1, 0.3)).toEqual({ ok: false, reason: 'cooldown' }); // 150 ms
    const second = pool.admit(d('table.turn'), 0.16, 0.3); // inst 1: the first (still sounding) makes room
    expect(second.ok && second.steal.map((v) => v.cue)).toEqual(['table.turn']);
    expect(pool.admit(d('clock.tick'), 0, 0.1).ok).toBe(true);
    expect(pool.admit(d('clock.tick'), 0.5, 0.1)).toEqual({ ok: false, reason: 'cooldown' }); // 900 ms
    expect(pool.admit(d('clock.tick'), 0.95, 0.1).ok).toBe(true);
  });

  it('voices expire and free their slot', () => {
    const pool = new VoicePool(1);
    expect(pool.admit(d('table.give'), 0, 0.3).ok).toBe(true);
    expect(pool.count(0.2)).toBe(1);
    expect(pool.count(0.4)).toBe(0);
    expect(pool.admit(d('table.gofish'), 0.4, 0.3).ok).toBe(true);
  });

  it('calls stop() on what it steals', () => {
    const pool = new VoicePool(1);
    const first = pool.admit(d('ui.press'), 0, 5);
    let stopped = 0;
    if (first.ok) pool.attach(first.id, () => stopped++);
    pool.admit(d('power.shark'), 0.1, 5);
    expect(stopped).toBe(1);
  });
});
