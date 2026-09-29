/* The surfaces and the ink (§5.4): the textures fit their budgets and are what the script makes; the ink bake is
 * deterministic, bounded, never rank-derived for backs, and what Card draws; the contrast audit passes with the
 * grain on. */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { bake, bakeMarkup } from '../scripts/bake-ink.mjs';
import { BAKED_BACK } from '../src/art/baked-back.generated.js';
import { BAKED_CARVINGS, BAKED_FRAMES } from '../src/art/baked.generated.js';
import { NORMAL_FRAME_IN, POWER_FRAME_IN } from '../src/art/cardArt.js';

const root = path.resolve(__dirname, '..');
const run = (script: string, ...args: string[]) => execFileSync('node', [path.join(root, 'scripts', script), ...args], { encoding: 'utf8', stdio: 'pipe' });

describe('the textures', () => {
  const size = (f: string) => fs.statSync(path.join(root, 'public/textures', f)).size;
  it('fit their budgets: paper <= 8 KB, water <= 10 KB, all three <= 30 KB', () => {
    expect(size('paper.png')).toBeLessThanOrEqual(8 * 1024);
    expect(size('water.svg')).toBeLessThanOrEqual(10 * 1024);
    expect(size('paper.png') + size('wood.svg') + size('water.svg')).toBeLessThanOrEqual(30 * 1024);
  });
  it('are exactly what scripts/bake-textures.mjs makes (deterministic seeds)', () => {
    expect(() => run('bake-textures.mjs', '--check')).not.toThrow();
  });
  it('are the ones tokens.css points at, and the stripes are gone (A21)', () => {
    const css = fs.readFileSync(path.join(root, 'src/design/tokens.css'), 'utf8');
    for (const f of ['paper.png', 'wood.svg', 'water.svg']) expect(css).toContain(`/textures/${f}`);
    expect(css).not.toMatch(/repeating-linear-gradient/);
  });
});

describe('the contrast audit, with the grain applied', () => {
  it('passes: body text >= 7:1 on every surface and every step of the light', () => {
    const out = run('contrast-audit.mjs');
    expect(out).toMatch(/all \d+ pairs pass/);
  });
});

describe('the ink bake (§5.4)', () => {
  const pts = (d: string) => [...d.matchAll(/(-?\d+),(-?\d+)/g)].map((m) => [Number(m[1]), Number(m[2])]);
  const ring = (s: string) => s.trim().split(/\s+/).map((p) => p.split(',').map(Number));

  it('is what Card draws: baked.generated.ts is fresh', async () => {
    const fresh = await bake();
    for (const [file, src] of Object.entries(fresh)) expect(src, file).toBe(fs.readFileSync(path.join(root, 'src/art', file), 'utf8'));
  }, 30_000);

  it('is deterministic: one seed, one output; another seed, another', () => {
    const src = '<polygon points="10,10 200,10 200,300 10,300" fill="none" stroke="#17120e" stroke-width="12"/>';
    expect(bakeMarkup(src, 'carving:x')).toBe(bakeMarkup(src, 'carving:x'));
    expect(bakeMarkup(src, 'carving:x')).not.toBe(bakeMarkup(src, 'carving:y'));
  });

  it('jitters every corner of a frame by 1-3 units of the original, no more, and keeps the notches', () => {
    for (const [rank, source] of [['shark', POWER_FRAME_IN], ['herring', NORMAL_FRAME_IN]] as const) {
      const baked = pts(BAKED_FRAMES[rank]);
      expect(baked.length).toBeGreaterThan(ring(source).length); // long edges waver: they are subdivided
      for (const [x, y] of ring(source)) {
        const d = Math.min(...baked.map(([bx, by]) => Math.hypot(bx - x, by - y)));
        expect(d, `${rank} corner ${x},${y}`).toBeLessThanOrEqual(3);
      }
    }
    // no frame is clean: every face has its own hand
    expect(new Set(Object.values(BAKED_FRAMES).filter((d) => !d.includes('A'))).size).toBeGreaterThan(10);
  });

  it('never derives the back from a rank: one asset, one string, whatever the deck holds', () => {
    expect(typeof BAKED_BACK).toBe('string');
    expect(BAKED_BACK.length).toBeGreaterThan(500);
    expect(BAKED_BACK).not.toMatch(/herring|shark|squid/);
    const script = fs.readFileSync(path.join(root, 'scripts/bake-ink.mjs'), 'utf8');
    expect(script).toMatch(/bakeMarkup\(render\(React\.createElement\(m\.BackArt\)\), 'back'\)/);
  });

  it('pools ink where a stroke ends', () => {
    const src = '<path d="M20,20 L120,20" stroke="#17120e" stroke-width="12" fill="none"/>';
    expect(bakeMarkup(src, 'carving:pool')).toContain('<circle');
  });

  it('carries every card: 18 carvings and 18 frames, and stays small', () => {
    expect(Object.keys(BAKED_CARVINGS)).toHaveLength(18); // 9 powers, 8 fish, eggs
    expect(Object.keys(BAKED_FRAMES)).toHaveLength(18);
    expect(fs.statSync(path.join(root, 'src/art/baked.generated.ts')).size + fs.statSync(path.join(root, 'src/art/baked-back.generated.ts')).size).toBeLessThan(32 * 1024);
  });
});
