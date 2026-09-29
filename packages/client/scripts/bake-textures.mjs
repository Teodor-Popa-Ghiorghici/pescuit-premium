// The three surface textures of FEEL_VISUAL_SOUND_PLAN §5.4, as small static files with deterministic seeds:
//
//   public/textures/paper.png   a paper grain tile, 12-16 % ink (<= 8 KB)      -> --tex-paper
//   public/textures/wood.svg    a wood grain tile that replaces the stripes    -> --tex-wood   (A21)
//   public/textures/water.svg   a water background of carved waves (<= 10 KB)  -> --tex-water
//
// Run: node scripts/bake-textures.mjs           (writes the files)
//      node scripts/bake-textures.mjs --check   (fails if the files on disk differ from a fresh bake)
// No dependencies (zlib is Node's). The same seed always gives the same bytes. Total budget: 30 KB.
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';

const out = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../public/textures');

/** mulberry32: a tiny seeded PRNG */
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ------------------------------------------------------------------ PNG */
const crcTable = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

/** an indexed PNG, 2 bits per pixel, a 4-colour palette with alpha (tRNS) */
function png2bit(w, h, pixels, palette, alphas) {
  const rowBytes = Math.ceil((w * 2) / 8);
  const raw = Buffer.alloc((rowBytes + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (rowBytes + 1)] = 0;
    for (let x = 0; x < w; x++) raw[y * (rowBytes + 1) + 1 + (x >> 2)] |= pixels[y * w + x] << (6 - 2 * (x & 3));
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 2; // bit depth
  ihdr[9] = 3; // indexed
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('PLTE', Buffer.from(palette.flat())),
    chunk('tRNS', Buffer.from(alphas)),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** paper: ink specks and short fibres on a wrapping 128 x 128 tile; three ink strengths, 7 / 12 / 16 % */
function paper() {
  const W = 128;
  const r = rng(0x9a9e12);
  const px = new Uint8Array(W * W);
  const put = (x, y, v) => {
    const i = (((y % W) + W) % W) * W + (((x % W) + W) % W);
    px[i] = Math.max(px[i], v);
  };
  for (let i = 0; i < 1500; i++) put((r() * W) | 0, (r() * W) | 0, r() < 0.15 ? 3 : r() < 0.5 ? 2 : 1); // specks
  for (let i = 0; i < 90; i++) {
    // fibres: short, slightly curved runs
    let x = r() * W;
    let y = r() * W;
    let a = r() * Math.PI * 2;
    const n = 4 + ((r() * 9) | 0);
    for (let k = 0; k < n; k++) {
      put(Math.round(x), Math.round(y), 1 + (r() < 0.3 ? 1 : 0));
      a += (r() - 0.5) * 0.7;
      x += Math.cos(a);
      y += Math.sin(a);
    }
  }
  // palette: 0 clear, then the ink (#17120e) at 7 %, 12 %, 16 %
  const ink = [23, 18, 14];
  return png2bit(W, W, px, [ink, ink, ink, ink], [0, Math.round(0.07 * 255), Math.round(0.12 * 255), Math.round(0.16 * 255)]);
}

/* ------------------------------------------------------------------ wood */
/** wood grain: long wavering lines along x on a 240 x 240 wrapping tile (every wave has a whole number of periods) */
function wood() {
  const W = 240;
  const r = rng(0x77d0a1);
  const lines = [];
  let y = 3;
  while (y < W) {
    const dark = r() < 0.72;
    const alpha = dark ? 0.18 + r() * 0.22 : 0.05 + r() * 0.05;
    const sw = dark ? (0.8 + r() * 1.6).toFixed(1) : (1.4 + r() * 1.6).toFixed(1);
    const periods = 1 + ((r() * 3) | 0);
    const amp = 1 + r() * 3.2;
    const ph = r() * Math.PI * 2;
    const n = 8;
    const pts = [];
    for (let i = 0; i <= n; i++) pts.push([Math.round((W * i) / n), Math.round(y + Math.sin(ph + (2 * Math.PI * periods * i) / n) * amp)]);
    let d = `M${pts[0][0]} ${pts[0][1]}`;
    for (let i = 1; i <= n; i++) {
      const mx = Math.round((pts[i - 1][0] + pts[i][0]) / 2);
      const my = Math.round((pts[i - 1][1] + pts[i][1]) / 2);
      d += `Q${pts[i - 1][0]} ${pts[i - 1][1]} ${mx} ${my}`;
    }
    d += `T${pts[n][0]} ${pts[n][1]}`;
    lines.push({ d, dark, alpha: alpha.toFixed(2), sw });
    y += 2 + r() * (dark ? 6 : 10);
  }
  // two knots: a few nested rings the lines seem to flow round
  const knots = [];
  for (const [cx, cy] of [[64, 74], [178, 176]]) {
    const rx = 12 + r() * 4;
    for (let k = 1; k <= 3; k++) knots.push(`<ellipse cx="${cx}" cy="${cy}" rx="${(rx * k * 0.45).toFixed(1)}" ry="${(rx * k * 0.2).toFixed(1)}" fill="none" stroke="#40291a" stroke-opacity="${(0.42 - k * 0.09).toFixed(2)}" stroke-width="1.4"/>`);
  }
  const body = lines.map((l) => `<path d="${l.d}" fill="none" stroke="${l.dark ? '#40291a' : '#a9835c'}" stroke-opacity="${l.alpha}" stroke-width="${l.sw}"/>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${W}" viewBox="0 0 ${W} ${W}">${body}${knots.join('')}</svg>`;
}

/* ----------------------------------------------------------------- water */
/** carved waves: chisel-cut crescents in staggered rows on a 96 x 48 wrapping tile, in --pe-apa at a low alpha */
function water() {
  const W = 96;
  const H = 48;
  const r = rng(0x3a71c5);
  const shapes = [];
  const rows = [[8, 0], [32, 24]];
  rows.forEach(([y0, shift], ri) => {
    let x = shift - 6;
    while (x < W + 6) {
      const w = 22 + Math.round(r() * 10);
      const h = 4 + Math.round(r() * 2);
      const y = y0 + Math.round((r() - 0.5) * 3);
      const t = 2 + Math.round(r());
      // a crescent: an upper arc out, a lower arc back - thick in the middle, cut to a point at both ends
      const d = `M${x} ${y}Q${x + w / 2} ${y - h * 2} ${x + w} ${y}Q${x + w / 2} ${y - h * 2 + t * 2} ${x} ${y}Z`;
      for (const dx of [-W, 0, W]) for (const dy of [0, H]) if (x + dx < W + 30 && x + dx + w > -30) shapes.push(`<path d="${d}" transform="translate(${dx} ${dy - (ri === 0 ? 0 : 0)})"/>`);
      x += w + 6 + Math.round(r() * 8);
    }
  });
  // drop the shapes that lie wholly outside the tile
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><g fill="#9db3bd" fill-opacity="0.1">${shapes.join('')}</g></svg>`;
}

/* ------------------------------------------------------------------ main */
const files = { 'paper.png': paper(), 'wood.svg': wood(), 'water.svg': water() };
const BUDGET = { 'paper.png': 8192, 'wood.svg': 12288, 'water.svg': 10240 };
const check = process.argv.includes('--check');
let total = 0;
let bad = false;
for (const [name, data] of Object.entries(files)) {
  const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
  total += buf.length;
  const over = buf.length > BUDGET[name];
  const file = path.join(out, name);
  if (check) {
    const same = fs.existsSync(file) && createHash('sha1').update(fs.readFileSync(file)).digest('hex') === createHash('sha1').update(buf).digest('hex');
    if (!same) {
      console.error(`${name}: differs from a fresh bake`);
      bad = true;
    }
  } else {
    fs.mkdirSync(out, { recursive: true });
    fs.writeFileSync(file, buf);
  }
  console.log(`${name.padEnd(10)} ${String(buf.length).padStart(6)} B  (budget ${BUDGET[name]})${over ? '  OVER' : ''}`);
  if (over) bad = true;
}
console.log(`total      ${String(total).padStart(6)} B  (budget 30720)`);
if (total > 30720) bad = true;
process.exit(bad ? 1 : 0);
