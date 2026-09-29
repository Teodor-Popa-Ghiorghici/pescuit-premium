// The ink bake of FEEL_VISUAL_SOUND_PLAN §5.4 - DESIGN §1 rule 4, "nothing is clean", made real.
//
// The card art is authored as perfect vector (src/art/carvings.tsx, src/art/cardArt.tsx). This script
// reads it, and for every asset:
//   - jitters the vertices of every polygon, path, rect and circle ALONG THEIR NORMALS by 1-2 units of
//     the 264x396 card space, with seeded noise keyed on the vertex position (so vertices two shapes
//     share move together and joins stay joined);
//   - subdivides long straight edges so the cut wavers between its corners, as a gouge does;
//   - adds ink pools where a stroke ends (the round bead of ink a real block leaves).
// It is deterministic - one seed per asset (the rank's name for a face; ONE fixed seed for the back,
// which is never rank-derived: every hidden card is the same bytes for everyone) - and it writes
// src/art/baked.generated.ts (the faces) and src/art/baked-back.generated.ts (the one back; the lobby draws it
// without the faces), which Card.tsx renders. `--check` fails when either file is stale.
//
//   node scripts/bake-ink.mjs            write src/art/baked.generated.ts and baked-back.generated.ts
//   node scripts/bake-ink.mjs --check    exit 1 if the file on disk differs from a fresh bake
//
// The plan's fallback (feTurbulence + feDisplacementMap, rasterised to WebP) was not needed: the vector
// bake reads as cut, not as filtered, at every card size the game draws (see DECISIONS.md).
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const require = createRequire(import.meta.url);
const OUT_DIR = path.join(root, 'src/art');
const FILES = ['baked.generated.ts', 'baked-back.generated.ts'];

/* ---------------------------------------------------------------- noise */
const fnv = (str) => {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 0x01000193);
  return h >>> 0;
};
/** two independent uniform numbers in [0,1) from (seed, x, y) */
function hash2(seed, x, y) {
  let h = Math.imul(seed ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(Math.round(x * 2) + 0x1000, 0xc2b2ae35) ^ Math.imul(Math.round(y * 2) + 0x2000, 0x27d4eb2f);
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d);
  h ^= h >>> 12;
  h = Math.imul(h, 0x297a2d39);
  h ^= h >>> 15;
  const a = (h >>> 0) / 4294967296;
  let g = Math.imul(h ^ 0x68e31da4, 0xb5297a4d);
  g ^= g >>> 13;
  g = Math.imul(g, 0x1b873593);
  g ^= g >>> 16;
  return [a, (g >>> 0) / 4294967296];
}
/** the jitter of a vertex, in card units: 1 to 2, either side */
function jitter(seed, x, y, scale) {
  const [a, b] = hash2(seed, x, y);
  return ((a < 0.5 ? -1 : 1) * (1 + b)) / scale;
}
/** whole units: the jitter is 1-2 of them, and integers keep the baked file small */
const num = (v) => {
  const r = Math.round(v);
  return Object.is(r, -0) ? '0' : String(r);
};

/* ------------------------------------------------------------- geometry */
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const len = (a) => Math.hypot(a[0], a[1]);
const unit = (a) => {
  const l = len(a) || 1;
  return [a[0] / l, a[1] / l];
};
const perp = (a) => [-a[1], a[0]];

/** the normal at vertex `v` of a run, from its neighbours (either may be missing at an open end) */
function normalAt(prev, v, next) {
  let n = [0, 0];
  if (prev && len(sub(v, prev)) > 1e-6) n = [n[0] + perp(unit(sub(v, prev)))[0], n[1] + perp(unit(sub(v, prev)))[1]];
  if (next && len(sub(next, v)) > 1e-6) n = [n[0] + perp(unit(sub(next, v)))[0], n[1] + perp(unit(sub(next, v)))[1]];
  return len(n) < 1e-6 ? (next && prev ? perp(unit(sub(next, prev))) : [0, 1]) : unit(n);
}

const SUBDIVIDE = 44;

/** points -> jittered points (a closed ring, or an open run), long straight edges subdivided */
function bakeRun(pts, closed, seed, scale) {
  // subdivide first: the new points are jittered like the rest
  const dense = [];
  const n = pts.length;
  const segs = closed ? n : n - 1;
  for (let i = 0; i < n; i++) {
    dense.push({ p: pts[i], corner: true });
    if (i < segs) {
      const a = pts[i];
      const b = pts[(i + 1) % n];
      const l = len(sub(b, a)) * scale;
      const k = Math.floor(l / SUBDIVIDE);
      for (let j = 1; j <= k; j++) {
        const t = j / (k + 1);
        dense.push({ p: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], corner: false });
      }
    }
  }
  const m = dense.length;
  return dense.map((d, i) => {
    const prev = closed ? dense[(i - 1 + m) % m].p : i > 0 ? dense[i - 1].p : null;
    const next = closed ? dense[(i + 1) % m].p : i < m - 1 ? dense[i + 1].p : null;
    const nrm = normalAt(prev, d.p, next);
    const j = jitter(seed, d.p[0] * scale, d.p[1] * scale, scale);
    return [d.p[0] + nrm[0] * j, d.p[1] + nrm[1] * j];
  });
}

const pathOf = (pts, closed) => `M${pts.map((p) => `${num(p[0])},${num(p[1])}`).join(' ')}${closed ? 'Z' : ''}`;

/* ----------------------------------------------------------- path parse */
const ARGS = { M: 2, L: 2, H: 1, V: 1, Q: 4, T: 2, A: 7, C: 6, S: 4, Z: 0 };

/** an SVG path -> subpaths of on-curve vertices with their curve segments, absolute */
function parsePath(d) {
  const toks = d.match(/[a-zA-Z]|-?\d*\.?\d+(?:e-?\d+)?/g) ?? [];
  const subs = [];
  let cur = null;
  let x = 0;
  let y = 0;
  let sx = 0;
  let sy = 0;
  let i = 0;
  let cmd = '';
  const read = () => Number(toks[i++]);
  while (i < toks.length) {
    if (/[a-zA-Z]/.test(toks[i])) cmd = toks[i++];
    const up = cmd.toUpperCase();
    const rel = cmd !== up;
    if (up === 'Z') {
      if (cur) cur.closed = true;
      x = sx;
      y = sy;
      continue;
    }
    const a = Array.from({ length: ARGS[up] }, read);
    const ox = rel ? x : 0;
    const oy = rel ? y : 0;
    if (up === 'M') {
      x = a[0] + ox;
      y = a[1] + oy;
      sx = x;
      sy = y;
      cur = { closed: false, v: [{ p: [x, y], seg: null }] };
      subs.push(cur);
      cmd = rel ? 'l' : 'L'; // extra pairs after M are lines
      continue;
    }
    if (!cur) throw new Error(`path without a moveto: ${d}`);
    if (up === 'L') [x, y] = [a[0] + ox, a[1] + oy];
    else if (up === 'H') x = a[0] + ox;
    else if (up === 'V') y = a[0] + oy;
    else if (up === 'Q') {
      cur.v.push({ p: [a[2] + ox, a[3] + oy], seg: { t: 'Q', c: [a[0] + ox, a[1] + oy] } });
      [x, y] = [a[2] + ox, a[3] + oy];
      continue;
    } else if (up === 'A') {
      cur.v.push({ p: [a[5] + ox, a[6] + oy], seg: { t: 'A', r: [a[0], a[1]], rot: a[2], laf: a[3], sf: a[4] } });
      [x, y] = [a[5] + ox, a[6] + oy];
      continue;
    } else if (up === 'C') {
      cur.v.push({ p: [a[4] + ox, a[5] + oy], seg: { t: 'C', c1: [a[0] + ox, a[1] + oy], c2: [a[2] + ox, a[3] + oy] } });
      [x, y] = [a[4] + ox, a[5] + oy];
      continue;
    } else throw new Error(`unsupported path command ${cmd} in ${d}`);
    cur.v.push({ p: [x, y], seg: { t: 'L' } });
  }
  return subs;
}

/** bake one parsed path: returns its new `d` and the end points of its open runs (for the ink pools) */
function bakePath(subs, seed, scale) {
  let d = '';
  const ends = [];
  for (const s of subs) {
    const v = s.v;
    // a run of only straight segments is baked as a polygon/polyline (with subdivision); curves keep their shape
    const straight = v.every((e, i) => i === 0 || e.seg.t === 'L');
    if (straight) {
      let pts = v.map((e) => e.p);
      const closed = s.closed || (pts.length > 2 && len(sub(pts[0], pts[pts.length - 1])) < 1e-6);
      if (closed && len(sub(pts[0], pts[pts.length - 1])) < 1e-6) pts = pts.slice(0, -1);
      const baked = bakeRun(pts, closed, seed, scale);
      d += pathOf(baked, closed);
      if (!closed) ends.push(baked[0], baked[baked.length - 1]);
    } else {
      // curves: every on-curve vertex moves along its normal; control points follow the mean of their two ends
      const P = v.map((e) => e.p);
      const dv = P.map((p, i) => {
        const nrm = normalAt(i > 0 ? P[i - 1] : s.closed ? P[P.length - 1] : null, p, i < P.length - 1 ? P[i + 1] : s.closed ? P[0] : null);
        const j = jitter(seed, p[0] * scale, p[1] * scale, scale);
        return [nrm[0] * j, nrm[1] * j];
      });
      const at = (i) => [P[i][0] + dv[i][0], P[i][1] + dv[i][1]];
      d += `M${num(at(0)[0])},${num(at(0)[1])}`;
      for (let i = 1; i < v.length; i++) {
        const q = at(i);
        const mid = [(dv[i - 1][0] + dv[i][0]) / 2, (dv[i - 1][1] + dv[i][1]) / 2];
        const s2 = v[i].seg;
        if (s2.t === 'L') d += `L${num(q[0])},${num(q[1])}`;
        else if (s2.t === 'Q') d += `Q${num(s2.c[0] + mid[0])},${num(s2.c[1] + mid[1])} ${num(q[0])},${num(q[1])}`;
        else if (s2.t === 'C') d += `C${num(s2.c1[0] + dv[i - 1][0])},${num(s2.c1[1] + dv[i - 1][1])} ${num(s2.c2[0] + dv[i][0])},${num(s2.c2[1] + dv[i][1])} ${num(q[0])},${num(q[1])}`;
        else d += `A${num(s2.r[0])},${num(s2.r[1])} ${s2.rot} ${s2.laf} ${s2.sf} ${num(q[0])},${num(q[1])}`;
      }
      if (s.closed) d += 'Z';
      else ends.push(at(0), at(v.length - 1));
    }
  }
  return { d, ends };
}

/** a circle as a smooth blob: 12 points on a wavering radius, joined by quadratic curves through their midpoints */
function bakeCircle(cx, cy, r, seed, scale) {
  const N = 12;
  const P = Array.from({ length: N }, (_, i) => {
    const a = (Math.PI * 2 * i) / N;
    const p = [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
    const j = r * scale >= 4 ? jitter(seed, p[0] * scale, p[1] * scale, scale) : 0;
    return [p[0] + Math.cos(a) * j * 0.7, p[1] + Math.sin(a) * j * 0.7];
  });
  const mid = (i) => [(P[i][0] + P[(i + 1) % N][0]) / 2, (P[i][1] + P[(i + 1) % N][1]) / 2];
  let d = `M${num(mid(N - 1)[0])},${num(mid(N - 1)[1])}`;
  for (let i = 0; i < N; i++) d += `Q${num(P[i][0])},${num(P[i][1])} ${num(mid(i)[0])},${num(mid(i)[1])}`;
  return `${d}Z`;
}

/** a rounded rectangle as a polygon ring */
function roundedRect(x, y, w, h, r) {
  const pts = [];
  const corner = (cx, cy, a0) => {
    for (let k = 0; k <= 6; k++) {
      const a = a0 + (Math.PI / 2) * (k / 6);
      pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
    }
  };
  corner(x + w - r, y + r, -Math.PI / 2);
  corner(x + w - r, y + h - r, 0);
  corner(x + r, y + h - r, Math.PI / 2);
  corner(x + r, y + r, Math.PI);
  return pts;
}

/* ---------------------------------------------------------- the markup */
const attrsOf = (s) => Object.fromEntries([...s.matchAll(/([a-zA-Z:-]+)="([^"]*)"/g)].map((m) => [m[1], m[2]]));
const attrString = (a, drop = []) =>
  Object.entries(a)
    .filter(([k]) => !drop.includes(k))
    .map(([k, v]) => ` ${k}="${v}"`)
    .join('');
const scaleOf = (transform) => {
  const m = /scale\(([-\d.]+)/.exec(transform ?? '');
  return m ? Math.abs(Number(m[1])) : 1;
};
const INKS = new Set(['#17120e', '#40291a', '#3b322a']);
const POOL_MIN_STROKE = 8;

/** the whole of one asset's markup, baked with one seed */
export function bakeMarkup(markup, seedName) {
  const seed = fnv(seedName);
  const out = [];
  const stack = [{ sw: 0, stroke: null, scale: 1 }];
  for (const tok of markup.match(/<\/?[a-zA-Z]+[^>]*>|[^<]+/g) ?? []) {
    if (!tok.startsWith('<')) {
      out.push(tok);
      continue;
    }
    if (tok.startsWith('</')) {
      if (tok === '</g>') stack.pop();
      out.push(tok);
      continue;
    }
    const tag = /^<([a-zA-Z]+)/.exec(tok)[1];
    const a = attrsOf(tok);
    const top = stack[stack.length - 1];
    const inh = { sw: a['stroke-width'] !== undefined ? Number(a['stroke-width']) : top.sw, stroke: a.stroke ?? top.stroke, scale: top.scale * (a.transform ? scaleOf(a.transform) : 1) };
    if (tag === 'g') {
      if (!tok.endsWith('/>')) stack.push(inh);
      out.push(tok);
      continue;
    }
    const pool = (ends) => {
      if (inh.sw * inh.scale < POOL_MIN_STROKE || !INKS.has(inh.stroke ?? '') || a.stroke === undefined && top.stroke === null) return '';
      return ends
        .map((e) => {
          const [h] = hash2(seed ^ 0x51ed, e[0] * inh.scale, e[1] * inh.scale);
          if (h < 0.15) return '';
          return `<circle cx="${num(e[0])}" cy="${num(e[1])}" r="${num((inh.sw / 2) * (1.12 + 0.2 * h))}" fill="${inh.stroke}"/>`;
        })
        .join('');
    };
    if (tag === 'polygon') {
      const pts = a.points.trim().split(/\s+/).map((p) => p.split(',').map(Number));
      out.push(`<path${attrString(a, ['points'])} d="${pathOf(bakeRun(pts, true, seed, inh.scale), true)}"/>`);
    } else if (tag === 'path') {
      const { d, ends } = bakePath(parsePath(a.d), seed, inh.scale);
      out.push(`<path${attrString(a, ['d'])} d="${d}"/>${pool(ends)}`);
    } else if (tag === 'rect') {
      const x = Number(a.x);
      const y = Number(a.y);
      const w = Number(a.width);
      const h = Number(a.height);
      const ring = a.rx ? roundedRect(x, y, w, h, Number(a.rx)) : [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
      out.push(`<path${attrString(a, ['x', 'y', 'width', 'height', 'rx'])} d="${pathOf(bakeRun(ring, true, seed, inh.scale), true)}"/>`);
    } else if (tag === 'circle') {
      out.push(`<path${attrString(a, ['cx', 'cy', 'r'])} d="${bakeCircle(Number(a.cx), Number(a.cy), Number(a.r), seed, inh.scale)}"/>`);
    } else out.push(tok); // text and anything else: untouched
  }
  // single quotes: the markup lives in a string literal, and this keeps the generated file free of escapes
  return out.join('').replace(/="([^"]*)"/g, "='$1'");
}

/* ------------------------------------------------------------ the bake */
function loadSources() {
  const esbuild = require('esbuild');
  const React = require('react');
  const { renderToStaticMarkup } = require('react-dom/server');
  const tmp = path.join(root, 'node_modules/.cache/bake-ink');
  fs.mkdirSync(tmp, { recursive: true });
  const entry = path.join(tmp, 'entry.tsx');
  fs.writeFileSync(entry, `export * from ${JSON.stringify(path.join(root, 'src/art/carvings.tsx'))};\nexport * from ${JSON.stringify(path.join(root, 'src/art/cardArt.tsx'))};\n`);
  const outfile = path.join(tmp, 'bundle.mjs');
  esbuild.buildSync({ entryPoints: [entry], bundle: true, format: 'esm', platform: 'node', jsx: 'automatic', outfile, external: ['react', 'react/jsx-runtime', 'react-dom'], logLevel: 'error' });
  return import(pathToFileURL(outfile).href + `?t=${Date.now()}`).then((m) => ({ m, React, render: (el) => renderToStaticMarkup(el) }));
}

export async function bake() {
  const { m, React, render } = await loadSources();
  const faces = { ...m.POWER_CARVINGS, ...m.NORMAL_CARVINGS, eggs: m.EGGS_CARVING };
  const frames = {};
  const carvings = {};
  for (const [rank, el] of Object.entries(faces)) {
    carvings[rank] = bakeMarkup(render(el), `carving:${rank}`);
    const poly =
      rank === 'eggs'
        ? `<rect x="${m.EGGS_RECT.x}" y="${m.EGGS_RECT.y}" width="${m.EGGS_RECT.w}" height="${m.EGGS_RECT.h}" rx="${m.EGGS_RECT.r}"/>`
        : `<polygon points="${m.POWER_CARVINGS[rank] ? m.POWER_FRAME_IN : m.NORMAL_FRAME_IN}"/>`;
    frames[rank] = /d='([^']+)'/.exec(bakeMarkup(poly, `frame:${rank}`))[1];
  }
  // the back: ONE asset, ONE fixed seed - never derived from a rank
  const back = bakeMarkup(render(React.createElement(m.BackArt)), 'back');
  const lit = (o) => `{\n${Object.entries(o).map(([k, v]) => `  ${k}: ${JSON.stringify(v)},`).join('\n')}\n}`;
  const head = (what) => `/* GENERATED by scripts/bake-ink.mjs from src/art/carvings.tsx and src/art/cardArt.tsx - do not edit.
 * The ink bake (FEEL_VISUAL_SOUND_PLAN §5.4): every vertex jittered 1-2 units along its normal with seeded
 * noise (one seed per asset: the rank's name for a face, one fixed seed for the back), long edges
 * wavering, ink pooled where a stroke ends. Deterministic: \`node scripts/bake-ink.mjs --check\`. ${what} */
`;
  return {
    'baked.generated.ts': `${head('The faces.')}
/** the notched frame of each face: a closed path in the 264x396 card space */
export const BAKED_FRAMES: Record<string, string> = ${lit(frames)};

/** each rank's carving, as SVG markup for the plate's <g> */
export const BAKED_CARVINGS: Record<string, string> = ${lit(carvings)};
`,
    'baked-back.generated.ts': `${head('The back.')}
/** the one back: the same bytes for every hidden card, whatever it is */
export const BAKED_BACK = ${JSON.stringify(back)};
`,
  };
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const out = await bake();
  if (process.argv.includes('--check')) {
    const stale = FILES.filter((f) => !fs.existsSync(path.join(OUT_DIR, f)) || fs.readFileSync(path.join(OUT_DIR, f), 'utf8') !== out[f]);
    console.log(stale.length ? `STALE: ${stale.join(', ')} - run node scripts/bake-ink.mjs` : 'the baked ink is fresh');
    process.exit(stale.length ? 1 : 0);
  }
  for (const f of FILES) {
    fs.writeFileSync(path.join(OUT_DIR, f), out[f]);
    console.log(`wrote src/art/${f} (${out[f].length} B)`);
  }
}
