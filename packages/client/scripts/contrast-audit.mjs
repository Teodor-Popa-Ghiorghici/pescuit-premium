// The contrast audit of FEEL_VISUAL_SOUND_PLAN §5.4: "contrast is re-audited with the grain applied;
// body text stays >= 7:1". Reads the colour tokens of src/design/tokens.css and computes WCAG 2.x
// contrast for every text/surface pair the game uses - each surface at its WORST case with the texture
// applied (the paper grain at its strongest ink, 16 %; the wood's darkest grain line; the water's
// lightest carved wave), and every step of the world's light (`--apa` darkens as the tally falls).
//
//   node scripts/contrast-audit.mjs      exit 1 if any pair is under its minimum
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const css = fs.readFileSync(path.join(root, 'src/design/tokens.css'), 'utf8');
const tok = {};
for (const m of css.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)) tok[m[1]] = m[2];
const need = (n) => {
  if (!tok[n]) throw new Error(`token --${n} not found in tokens.css`);
  return tok[n];
};

const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const lin = (c) => ((c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const lum = (c) => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
const mix = (a, b, t) => a.map((v, i) => v * (1 - t) + b[i] * t);
const ratio = (a, b) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

// what the textures do to a surface, worst case (see scripts/bake-textures.mjs)
const withPaperGrain = (bg) => mix(bg, rgb(need('ink')), 0.16); // the strongest speck of the paper tile
const withWoodGrain = (bg) => mix(bg, rgb(need('lemn-inchis')), 0.4); // the darkest grain line
const withWaterGrain = (bg) => mix(bg, rgb(need('pe-apa')), 0.1); // the lightest carved wave

const surfaces = {
  paper: (n) => withPaperGrain(rgb(need(n))),
  wood: (n) => withWoodGrain(rgb(need(n))),
  water: (n) => withWaterGrain(rgb(need(n))),
  plain: (n) => rgb(need(n)),
};

const rows = [];
const add = (role, fg, surface, bg, min) => rows.push({ role, fg, surface, bg, min, r: ratio(rgb(need(fg)), surfaces[surface](bg)) });

// body text: >= 7:1 on the worst pixel
add('body, on paper', 'ink', 'paper', 'hartie', 7);
add('body, on recessed paper', 'ink', 'paper', 'hartie-2', 7);
add('body, on the lightest stock', 'ink', 'plain', 'var', 7);
add('body, spent (ink-soft) on paper', 'ink-soft', 'paper', 'hartie', 7);
add('log, older lines (ink-soft) on the recessed board', 'ink-soft', 'paper', 'hartie-2', 7);
add('body, on water', 'hartie', 'water', 'apa', 7);
add('body, on the bars (plain)', 'hartie', 'plain', 'apa-2', 7);
add('label, recessed paper on water', 'hartie-2', 'water', 'apa', 7);
add('muted, on water', 'pe-apa', 'water', 'apa', 7);
add('display, ochre on the bars (plain)', 'ocru', 'plain', 'apa-2', 4.5);
// the world's light: the same text on every step of --apa
for (const s of ['1', '2', '3']) {
  if (!tok[`apa-l${s}`]) continue;
  add(`body, on water, light step ${s}`, 'hartie', 'water', `apa-l${s}`, 7);
  add(`muted, on water, light step ${s}`, 'pe-apa', 'water', `apa-l${s}`, 7);
  add(`label, on water, light step ${s}`, 'hartie-2', 'water', `apa-l${s}`, 7);
  add(`display, ochre on the bar, light step ${s}`, 'ocru', 'plain', `apa-2-l${s}`, 4.5);
}
// secondary text: large or supplementary, >= 4.5:1
add('secondary, slab on paper', 'pe-hartie-slab', 'paper', 'hartie', 4.5);
add('secondary, slab on water', 'pe-apa-slab', 'water', 'apa', 4.5);
add('plate text, paper on wood', 'hartie', 'wood', 'lemn', 4.5);
add('plate text, ink on paper plates', 'ink', 'paper', 'hartie', 7);

let bad = 0;
for (const r of rows) {
  const ok = r.r >= r.min;
  if (!ok) bad++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${r.r.toFixed(2).padStart(5)}:1 (min ${r.min})  ${r.role.padEnd(44)} --${r.fg} on ${r.surface} --${r.bg}`);
}
console.log(bad ? `\n${bad} pair(s) under their minimum` : `\nall ${rows.length} pairs pass`);
process.exit(bad ? 1 : 0);
