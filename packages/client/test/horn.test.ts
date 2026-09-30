import { describe, expect, it } from 'vitest';
import { build, KEYS } from '../src/audio/render/catalog.js';
import { CALL, CALL_SECONDS, ECHO, ECHO_SECONDS, HORN_FUNDAMENTAL, LAST, LAST_SECONDS, PODIUM, PODIUM_SECONDS, VALLEY, hornHz, renderHorn, type HornNote } from '../src/audio/render/horn.js';
import { RENDER_SR } from '../src/audio/render/dsp.js';

/* The tulnic is the one instrument the game plays, and it has a rule the ear can check but a test can too: every pitch
 * is a partial of one fundamental (58 Hz x n), because a horn with no finger holes can play nothing else. */

/** magnitude spectrum of a Hann-windowed slice, bins of sr/n Hz */
function spectrum(x: Float32Array, from: number, n = 8192): Float32Array {
  const re = new Float64Array(n);
  const im = new Float64Array(n);
  for (let i = 0; i < n; i++) re[i] = (x[from + i] ?? 0) * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1)));
  // iterative radix-2 FFT
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) [re[i], re[j]] = [re[j], re[i]];
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    for (let i = 0; i < n; i += len)
      for (let k = 0; k < len / 2; k++) {
        const wr = Math.cos(ang * k);
        const wi = Math.sin(ang * k);
        const ur = re[i + k];
        const ui = im[i + k];
        const vr = re[i + k + len / 2] * wr - im[i + k + len / 2] * wi;
        const vi = re[i + k + len / 2] * wi + im[i + k + len / 2] * wr;
        re[i + k] = ur + vr;
        im[i + k] = ui + vi;
        re[i + k + len / 2] = ur - vr;
        im[i + k + len / 2] = ui - vi;
      }
  }
  const mag = new Float32Array(n / 2);
  for (let i = 0; i < n / 2; i++) mag[i] = Math.hypot(re[i], im[i]);
  return mag;
}

/** the lowest strong peak of a note's held part, Hz (parabolic interpolation): the pitch the ear hears */
function pitchOf(x: Float32Array, note: HornNote, n = 8192): number {
  const mid = Math.floor((note.start + Math.min(note.dur, 1.0) * 0.5) * RENDER_SR) - n / 2;
  const mag = spectrum(x, Math.max(0, mid), n);
  const max = Math.max(...mag);
  for (let i = 3; i < mag.length - 1; i++) {
    if (mag[i] >= 0.3 * max && mag[i] >= mag[i - 1] && mag[i] >= mag[i + 1]) {
      const a = mag[i - 1], b = mag[i], c = mag[i + 1];
      const shift = (0.5 * (a - c)) / (a - 2 * b + c);
      return ((i + shift) * RENDER_SR) / n;
    }
  }
  return 0;
}

describe('the tulnic (SOUND_DESIGN §1.1)', () => {
  const call = renderHorn(CALL, CALL_SECONDS, { seed: 7 });

  it('is a natural horn: every note is a partial of one fundamental - 58 Hz x n, nothing rounded to a tempered scale', () => {
    expect(HORN_FUNDAMENTAL).toBe(58);
    for (const note of [...CALL, ...PODIUM, ...LAST]) {
      expect(Number.isInteger(note.partial), 'a whole partial').toBe(true);
      expect(note.partial).toBeGreaterThanOrEqual(4); // 232 Hz and up: what a phone can play
      expect(note.partial).toBeLessThanOrEqual(9);
    }
    expect(hornHz(6)).toBe(348);
    expect(hornHz(7)).toBe(406);
    // the seventh partial sits ~31 cents flat of the tempered minor seventh, and is left there
    expect(1200 * Math.log2(7 / 4) - 1000).toBeCloseTo(-31.17, 1);
  });

  it('really sounds those pitches: the measured pitch of each held note is its partial, within 2.5 %', () => {
    for (const note of CALL) {
      const hz = pitchOf(call, note);
      const want = hornHz(note.partial);
      expect(Math.abs(hz / want - 1), `partial ${note.partial}: measured ${hz.toFixed(1)} Hz, wanted ${want}`).toBeLessThan(0.025);
    }
    const podium = renderHorn(PODIUM, PODIUM_SECONDS, { seed: 9, lipDb: -26, wobble: 0.5 });
    for (const note of PODIUM) {
      const hz = pitchOf(podium, note);
      const want = hornHz(note.partial) * 2 ** ((note.cents ?? 0) / 1200);
      expect(Math.abs(hz / want - 1), `podium partial ${note.partial}: ${hz.toFixed(1)} Hz`).toBeLessThan(0.025);
    }
  });

  it('is one breath: the notes join with no gap over 60 ms, and the phrase falls at the end', () => {
    for (let i = 1; i < CALL.length; i++) expect(CALL[i].start - (CALL[i - 1].start + CALL[i - 1].dur), `gap before note ${i}`).toBeLessThanOrEqual(0.06);
    const last = CALL[CALL.length - 1];
    expect(last.partial).toBeLessThan(CALL[1].partial); // the reach, then the fall
    expect(last.sagCents).toBeGreaterThanOrEqual(50); // the breath running out
    expect(last.trimEnd).toBeGreaterThan(0); // and cut a moment early
  });

  it('has a slow, lip-like attack: the first 90 ms are far quieter than the held note', () => {
    const rms = (a: number, b: number) => Math.sqrt(call.slice(Math.floor(a * RENDER_SR), Math.floor(b * RENDER_SR)).reduce((s, v) => s + v * v, 0) / ((b - a) * RENDER_SR));
    expect(rms(0, 0.03)).toBeLessThan(0.25 * rms(0.5, 0.8));
    expect(rms(0.0, 0.09)).toBeLessThan(0.6 * rms(0.5, 0.8));
  });

  it('its space is the valley: three discrete repeats, each later, quieter and darker - not a reverb', () => {
    expect(VALLEY).toHaveLength(3);
    for (let i = 1; i < VALLEY.length; i++) {
      expect(VALLEY[i].at).toBeGreaterThan(VALLEY[i - 1].at);
      expect(VALLEY[i].gainDb).toBeLessThan(VALLEY[i - 1].gainDb);
      expect(VALLEY[i].lowpassHz).toBeLessThan(VALLEY[i - 1].lowpassHz);
    }
    expect(VALLEY.map((v) => v.at)).toEqual([3.5, 4.9, 6.6]); // irregular: walls at different distances
    // they repeat only the falling gesture: partials 7, 6, 5
    expect(ECHO.map((n) => n.partial)).toEqual([7, 6, 5]);
    expect(ECHO[0].start).toBe(0);
    // the first repeat starts after the call's last note has begun to end
    expect(VALLEY[0].at).toBeGreaterThan(CALL_SECONDS);
  });

  it('the podium is bare: resolved to the lowest note, one breath, no repeats; the last set is one low note inside 1.4 s with the knock', () => {
    expect(PODIUM.map((n) => n.partial)).toEqual([6, 5, 4]);
    expect(PODIUM[PODIUM.length - 1].cents).toBeLessThan(0); // it settles a little flat and stays
    expect(LAST).toHaveLength(1);
    expect(LAST[0].partial).toBe(4);
    expect(LAST_SECONDS + 0.12).toBeLessThanOrEqual(1.4);
  });

  it('renders finite, non-silent, bounded audio, and the catalogue holds it (the horn and the riffle only)', () => {
    for (const key of KEYS) {
      const x = build(key)!;
      expect(x, key).not.toBeNull();
      let peak = 0;
      for (const v of x) {
        expect(Number.isFinite(v)).toBe(true);
        peak = Math.max(peak, Math.abs(v));
      }
      expect(peak, key).toBeGreaterThan(0.01);
      expect(peak, key).toBeLessThan(2);
    }
    expect(KEYS.filter((k) => !/^(riffle|horn)\./.test(k))).toEqual([]);
    expect(build('nonesuch.key')).toBeNull();
    expect(build('horn.call')!.length).toBe(Math.ceil(CALL_SECONDS * RENDER_SR));
    expect(build('horn.echo')!.length).toBe(Math.ceil(ECHO_SECONDS * RENDER_SR));
  });

  it('is deterministic: the same seed renders the same horn', () => {
    const a = renderHorn(LAST, LAST_SECONDS, { seed: 10 });
    const b = renderHorn(LAST, LAST_SECONDS, { seed: 10 });
    expect(Array.from(a.slice(0, 2000))).toEqual(Array.from(b.slice(0, 2000)));
  });
});
