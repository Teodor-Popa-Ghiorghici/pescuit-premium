import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { BUS_NAMES, CUES, type BusName } from '../src/audio/cuesheet.js';
import { CAL } from '../src/audio/calibration.js';
import { getEngine, spawnVoice } from '../src/audio/engine.js';
import { DEFAULT_SETTINGS, busGain, loadSettings, masterCurve, saveSettings } from '../src/audio/mixer.js';
import { loadRendered } from '../src/audio/bank.js';
import { panningAvailable, seatPanning } from '../src/audio/context.js';
import { VoicePool } from '../src/audio/voices.js';
import { fakeCtx } from './fakeaudio.js';

const fakeStorage = (init: Record<string, string> = {}, throws = false) => {
  const m = new Map(Object.entries(init));
  return {
    getItem: (k: string) => { if (throws) throw new Error('blocked'); return m.get(k) ?? null; },
    setItem: (k: string, v: string) => { if (throws) throw new Error('blocked'); m.set(k, v); },
  };
};
const g = globalThis as Record<string, unknown>;
afterEach(() => { delete g.localStorage; });

describe('settings (§3.5): per device, persisted, always behind try/catch', () => {
  it('round-trips master, effects, interface, ambience, music, mute, profile, mono, softer and the A/V offset', () => {
    g.localStorage = fakeStorage();
    const s = { ...DEFAULT_SETTINGS, master: 0.5, effects: 0.7, interface: 0.4, ambience: 0, music: 0.25, muted: true, profile: 'headphones' as const, mono: true, softer: true, avOffsetMs: 180 };
    saveSettings(s);
    expect(loadSettings()).toEqual(s);
  });
  it('ambience is on by default, and its own setting', () => {
    g.localStorage = fakeStorage();
    expect(loadSettings().ambience).toBe(1);
    expect(loadSettings().profile).toBe('speaker');
  });
  it('survives blocked storage (private window) and garbage', () => {
    g.localStorage = fakeStorage({}, true);
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
    expect(() => saveSettings(DEFAULT_SETTINGS)).not.toThrow();
    g.localStorage = fakeStorage({ 'pescuit:audio': '{not json' });
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
    g.localStorage = fakeStorage({ 'pescuit:audio': JSON.stringify({ master: 9, avOffsetMs: 'x', profile: 'cathedral' }) });
    expect(loadSettings()).toMatchObject({ master: 1, avOffsetMs: 0, profile: 'speaker' });
  });
  it('the old on/off toggle still mutes', () => {
    g.localStorage = fakeStorage({ 'pescuit:sound': 'off' });
    expect(loadSettings().muted).toBe(true);
  });
  it('bus gains follow §3.5: Table 0 dB, Power +1, Music -2, Ambience -26; UI and Clock +4 on speakers; Clock +2 on headphones (MUSIC_PLAN A9)', () => {
    const db = (bus: BusName, p: 'speaker' | 'headphones') => 20 * Math.log10(busGain(bus, p, DEFAULT_SETTINGS));
    expect(db('Table', 'speaker')).toBeCloseTo(0, 6);
    expect(db('Power', 'headphones')).toBeCloseTo(1, 6);
    expect(db('Music', 'speaker')).toBeCloseTo(-2, 6);
    expect(db('Ambience', 'headphones')).toBeCloseTo(-26, 6);
    expect(db('UI', 'headphones')).toBeCloseTo(-10, 6);
    expect(db('UI', 'speaker')).toBeCloseTo(-6, 6);
    expect(db('Clock', 'headphones')).toBeCloseTo(-6, 6);
    expect(db('Clock', 'speaker')).toBeCloseTo(-4, 6);
    expect(busGain('Table', 'speaker', { ...DEFAULT_SETTINGS, effects: 0.5 })).toBeCloseTo(0.5, 6);
  });
  it('the per-voice mastering curve is c·tanh(x/c): odd, saturating at c, near-linear well inside it', () => {
    const c = masterCurve(-10);
    const lin = 10 ** (-10 / 20);
    expect(c.length).toBe(4097);
    expect(c[2048]).toBeCloseTo(0, 9);
    expect(c[4096]).toBeCloseTo(lin * Math.tanh(1 / lin), 6);
    expect(c[4096]).toBeLessThanOrEqual(lin + 1e-9);
    expect(c[0]).toBeCloseTo(-c[4096], 9);
    const x = 20 / 2048; // well inside the ceiling: c·tanh(x/c) ≈ x
    expect(c[2048 + 20]).toBeCloseTo(x, 4);
  });
});

describe('the engine has no private tier (Law 1, SOUND_DESIGN §4)', () => {
  it('plays a cue for everyone or for no one: mute is the only thing that silences it, and nothing in a cue\'s parameters can', () => {
    g.localStorage = fakeStorage();
    const e = getEngine();
    e.update({ profile: 'speaker', muted: false });
    expect(e.play('power.clownfish.bound')).toBe(true);
    expect(e.play('table.turn', { seat: 1 })).toBe(true);
    // a `private` flag no longer exists: even if a caller passed one, the cue plays as any other
    expect(e.play('power.clownfish.bound', { private: true } as never)).toBe(true);
    e.update({ profile: 'headphones' });
    expect(e.play('power.clownfish.bound')).toBe(true);
    e.update({ muted: true });
    expect(e.play('table.turn')).toBe(false);
    e.update({ profile: 'speaker', muted: false });
    expect(e.play('no.such.cue')).toBe(false);
    for (const gone of ['clock.eligible', 'power.granted.mine']) expect(e.play(gone)).toBe(false);
  });
});

describe('spawnVoice', () => {
  beforeAll(loadRendered);
  it('puts every cue on its own bus, through the mastering shaper when calibrated', () => {
    for (const c of CUES) {
      const { ctx, edges } = fakeCtx();
      const buses = Object.fromEntries(BUS_NAMES.map((b) => [b, { bus: b, connect: (d: unknown) => d }])) as unknown as Record<BusName, AudioNode>;
      const ok = spawnVoice({ ctx, buses, profile: 'speaker', mastering: true, pan: false }, c.id, { seat: 1, seat2: 2 }, 3, 0.1);
      expect(ok, c.id).toBe(true);
      const reached = new Set(edges.filter(([, to]) => (to as { bus?: string }).bus).map(([, to]) => (to as { bus: string }).bus));
      expect([...reached], c.id).toEqual([c.bus]);
      const cal = CAL.speaker[c.id];
      const shapers = edges.filter(([from]) => (from as { type?: string }).type === 'shaper').length;
      if (cal && cal.c !== null) expect(shapers, `${c.id} is mastered`).toBeGreaterThanOrEqual(1);
    }
  });
  it('honours the pool: cooldowns and caps refuse a cue', () => {
    const pool = new VoicePool();
    const { ctx } = fakeCtx();
    const buses = Object.fromEntries(BUS_NAMES.map((b) => [b, { connect: (d: unknown) => d }])) as unknown as Record<BusName, AudioNode>;
    const env = { ctx, buses, profile: 'speaker' as const, pool, pan: false };
    expect(spawnVoice(env, 'table.turn', { seat: 1 }, 1, 1.0)).toBe(true);
    expect(spawnVoice(env, 'table.turn', { seat: 2 }, 1, 1.05)).toBe(false); // 150 ms cooldown
  });
  it('a seat cue is panned only when panning is on', () => {
    const buses = Object.fromEntries(BUS_NAMES.map((b) => [b, { connect: (d: unknown) => d }])) as unknown as Record<BusName, AudioNode>;
    const a = fakeCtx();
    spawnVoice({ ctx: a.ctx, buses, profile: 'headphones', pan: true }, 'table.turn', { seat: 5 }, 1, 0);
    expect(a.tally.byType.panner).toBe(1);
    const b = fakeCtx();
    spawnVoice({ ctx: b.ctx, buses, profile: 'headphones', pan: false }, 'table.turn', { seat: 5 }, 1, 0);
    expect(b.tally.byType.panner).toBeUndefined();
  });
});

describe('seat panning (§3.5): desktop stereo and headphones', () => {
  it('a coarse-pointer phone pans only in headphones mode; a fine pointer pans in both profiles', () => {
    expect(seatPanning('speaker', true)).toBe(false); // a phone speaker: signatures only
    expect(seatPanning('headphones', true)).toBe(true); // a phone with headphones: stereo
    expect(seatPanning('speaker', false)).toBe(true);
    expect(seatPanning('headphones', false)).toBe(true);
  });
  it('panningAvailable reads the pointer and the profile', () => {
    const had = 'matchMedia' in g;
    const prev = g.matchMedia;
    g.matchMedia = (q: string) => ({ matches: q === '(pointer: coarse)' });
    try {
      expect(panningAvailable('speaker')).toBe(false);
      expect(panningAvailable('headphones')).toBe(true);
    } finally {
      if (had) g.matchMedia = prev;
      else delete g.matchMedia;
    }
  });
});

describe('the score switch (MUSIC_PLAN A12, D2)', () => {
  it('defaults to lobby-only before the music playtest, persists, and ignores junk', () => {
    expect(DEFAULT_SETTINGS.scoreMode).toBe('lobby');
    g.localStorage = fakeStorage();
    saveSettings({ ...DEFAULT_SETTINGS, scoreMode: 'on' });
    expect(loadSettings().scoreMode).toBe('on');
    g.localStorage = fakeStorage({ 'pescuit:audio': JSON.stringify({ scoreMode: 'loud' }) });
    expect(loadSettings().scoreMode).toBe('lobby');
  });
  it('the Music slider scales the Score bus', () => {
    const half = busGain('Score', 'speaker', { ...DEFAULT_SETTINGS, music: 0.5 });
    expect(half / busGain('Score', 'speaker', DEFAULT_SETTINGS)).toBeCloseTo(0.5, 6);
  });
});
