import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { VFX_FRAMES, VFX_KINDS, VFX_STEP_MS, Vfx, vfxMs } from '../src/art/vfx.js';

/** §5.5: the thirteen stepped effects, plus the strike's three (the shark's jaws, the shock ring every strike throws,
 * the jellyfish's zap) - three or four hand-cut frames each, at most 2 KB each */
const THIRTEEN = ['inkBurst', 'woodChips', 'waterRing', 'dustPuff', 'gateNotch', 'speedGrooves', 'shellClamp', 'bellStamp', 'mirrorGlint', 'barbedHook', 'spiralChips', 'roeBurst', 'gateDoors', 'jaws', 'shockRing', 'zap'];

describe('stepped VFX (§4.3, §5.5)', () => {
  it('there are sixteen: one for every row of the §5.5 table, and the strike\'s three', () => {
    expect([...VFX_KINDS].sort()).toEqual([...THIRTEEN].sort());
  });

  it('every effect has three or four frames, at 12 fps', () => {
    for (const k of VFX_KINDS) {
      expect(VFX_FRAMES[k].length, k).toBeGreaterThanOrEqual(3);
      expect(VFX_FRAMES[k].length, k).toBeLessThanOrEqual(4);
    }
    expect(VFX_STEP_MS).toBe(83);
    expect(vfxMs('inkBurst')).toBe(4 * 83);
  });

  it('every effect is an inline SVG of at most 2 KB', () => {
    for (const k of VFX_KINDS) {
      const svg = renderToStaticMarkup(createElement(Vfx, { kind: k }));
      expect(svg.startsWith('<svg'), k).toBe(true);
      expect(new TextEncoder().encode(svg).length, `${k} is ${svg.length} bytes`).toBeLessThanOrEqual(2048);
    }
  });

  it('frames are shown one after another by index, never tweened (no transition, no SMIL)', () => {
    const svg = renderToStaticMarkup(createElement(Vfx, { kind: 'waterRing' }));
    expect(svg.match(/class="vfx__f"/g)).toHaveLength(VFX_FRAMES.waterRing.length);
    expect(svg).toContain('--i:0');
    expect(svg).not.toMatch(/<animate|transition/);
  });
});
