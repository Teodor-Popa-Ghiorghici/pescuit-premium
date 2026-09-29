import { beforeAll, describe, expect, it } from 'vitest';
import { CLOWN_DEFAULT, D_ROMANIAN_MINOR, MOTIFS } from '../src/audio/motifs.js';
import { MOTIF_RANKS, SILENT_RANKS } from '../src/audio/cuesheet.js';
import { loadRendered, rendered } from '../src/audio/bank.js';
import { renderBreath, renderDramba, renderTulnic } from '../src/audio/render/breath.js';
import { renderRiffle } from '../src/audio/render/riffle.js';
import { renderStrings } from '../src/audio/render/strings.js';
import { KEYS } from '../src/audio/render/catalog.js';
import { peakOf } from '../src/audio/measure.js';

const inScale = (n: number) => (D_ROMANIAN_MINOR as readonly number[]).includes(((n % 12) + 12) % 12);
const all = Object.values(MOTIFS).flatMap((m) => [...m.full, ...m.spk]);

describe('the nine motifs (§3.8)', () => {
  it('all sit in D Romanian minor: D E F G# A B C', () => {
    for (const n of [...all, ...CLOWN_DEFAULT]) expect(inScale(n.note), `note ${n.note}`).toBe(true);
  });
  it('Squid is a rest: no motif, no way to sound', () => {
    expect(SILENT_RANKS.has('squid')).toBe(true);
    expect((MOTIF_RANKS as readonly string[]).includes('squid')).toBe(false);
    expect(Object.keys(MOTIFS)).not.toContain('squid');
  });
  it('lanternfish is a five-note palindrome, A B C B A', () => {
    const notes = MOTIFS.lanternfish.full.map((n) => n.note);
    expect(notes).toEqual([81, 83, 84, 83, 81]);
    expect([...notes].reverse()).toEqual(notes);
  });
  it('tortoise: one note struck three times', () => {
    const notes = MOTIFS.tortoise.full.map((n) => n.note);
    expect(new Set(notes).size).toBe(1);
    expect(notes).toHaveLength(3);
  });
  it('shark leaps a minor seventh; mantis falls a tritone from an accented G#; whale falls a major sixth', () => {
    const s = MOTIFS.shark.full.map((n) => n.note);
    expect(s[1] - s[0]).toBe(10);
    const m = MOTIFS.mantis.full;
    expect(m[0].note - m[1].note).toBe(6);
    expect(m[0].note % 12).toBe(8); // G#
    expect(m[0].gain).toBeGreaterThan(1); // accented
    const w = MOTIFS.whale.full.map((n) => n.note);
    expect(w[0] - w[1]).toBe(9);
  });
  it('jellyfish is a trill that sags 50 cents; stickleback three grace notes into one', () => {
    const j = MOTIFS.jellyfish.full;
    expect(j.length).toBe(5);
    expect(new Set(j.map((n) => n.note)).size).toBe(2);
    expect(j[4].cents).toBe(-40);
    const s = MOTIFS.stickleback.full;
    expect(s.length).toBe(4);
    expect(s.slice(0, 3).every((n) => n.dur <= 0.06)).toBe(true);
  });
  it('reactive powers speak on the fluier, active on the caval', () => {
    for (const r of ['shark', 'tortoise', 'lanternfish', 'mantis'] as const) expect(MOTIFS[r].inst).toBe('fluier');
    for (const r of ['jellyfish', 'stickleback', 'whale'] as const) expect(MOTIFS[r].inst).toBe('caval');
  });
  it('the nine are told apart by melody: no two share a contour, an opening pair or an opening note within an instrument', () => {
    const contour = (n: { note: number }[]) => n.slice(1).map((x, i) => x.note - n[i].note).join(',');
    const entries = Object.entries(MOTIFS);
    expect(new Set(entries.map(([, m]) => contour(m.full))).size).toBe(entries.length);
    for (const inst of ['fluier', 'caval'] as const) {
      const mine = entries.filter(([, m]) => m.inst === inst);
      expect(new Set(mine.map(([, m]) => m.full[0].note)).size, `${inst} opening notes`).toBe(mine.length);
    }
    // and the speaker variants keep an opening pair unique to each motif
    expect(new Set(entries.map(([, m]) => m.spk.map((n) => n.note + (n.cents ?? 0) / 100).join(','))).size).toBe(entries.length);
  });
  it('every speaker variant is two notes, done in about a quarter of a second (§3.4)', () => {
    for (const [name, m] of Object.entries(MOTIFS)) {
      expect(m.spk.length, name).toBe(2);
      const end = Math.max(...m.spk.map((n) => n.start + n.dur));
      expect(end, name).toBeLessThanOrEqual(0.28);
      expect(Math.max(...m.full.map((n) => n.start + n.dur)), name).toBeGreaterThan(0.85);
      expect(Math.max(...m.full.map((n) => n.start + n.dur)), name).toBeLessThanOrEqual(1.2);
    }
  });
});

describe('the rendered families (plain JS, 32 kHz)', () => {
  beforeAll(loadRendered);
  it('render finite, non-silent, bounded audio', () => {
    for (const key of KEYS) {
      const x = rendered(key);
      expect(x, key).not.toBeNull();
      const p = peakOf(x!);
      expect(p, key).toBeGreaterThan(0.01);
      expect(p, key).toBeLessThan(8);
      expect(x!.every(Number.isFinite), key).toBe(true);
    }
  });
  it('a string above 375 Hz sounds (the reason it is JS): 1175 Hz rings for a second', () => {
    const x = renderStrings(1174.7, 1.2, 1);
    let late = 0;
    for (let i = 16000; i < 24000; i++) late = Math.max(late, Math.abs(x[i]));
    expect(late).toBeGreaterThan(0.0008);
  });
  it('damping stops the strings by hand', () => {
    const x = renderStrings(587, 0.4, 1, 0.16);
    let after = 0;
    for (let i = Math.floor(0.25 * 32000); i < x.length; i++) after = Math.max(after, Math.abs(x[i]));
    expect(after).toBeLessThan(0.001);
  });
  it('breath: a fluier note is at its pitch', () => {
    const x = renderBreath([{ note: 81, start: 0, dur: 0.5 }], 0.5);
    // zero crossings over the sustain give the fundamental (880 Hz) within a few percent
    let z = 0;
    for (let i = 8000; i < 16000; i++) if (x[i - 1] < 0 && x[i] >= 0) z++;
    expect(z / 0.25).toBeGreaterThan(800);
    expect(z / 0.25).toBeLessThan(960);
  });
  it('riffle, tulnic and jaw harp render at their lengths', () => {
    expect(renderRiffle(0.8, 1).length).toBeGreaterThanOrEqual(0.8 * 32000);
    expect(renderTulnic(45, 1.1).length).toBe(Math.ceil(1.1 * 32000));
    expect(peakOf(renderDramba([{ start: 0, dur: 0.3, formants: [[450, 800], [1300, 1900]] }], 0.35))).toBeGreaterThan(0.01);
  });
});
