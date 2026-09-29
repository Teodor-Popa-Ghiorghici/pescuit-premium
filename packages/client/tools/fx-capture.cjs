// Films the showcases (`?fixture=fx-*`, src/dev/fixtures.ts) frame by frame for a review: each one is staged
// one action away from its moment, the page is put in 4x slow motion (timers, performance.now, CSS and Web
// Animations alike), `__fxGo()` performs the action, and a screenshot is taken every few game-milliseconds.
// Each showcase becomes one contact sheet: a grid of frames, each labelled with its time in game ms.
//
//   node tools/fx-capture.cjs                       # every showcase, phone 390x664 and desktop 1280x800
//   node tools/fx-capture.cjs --only=shark,lead     # substring filter on showcase ids
//   OUT_DIR=/tmp/x node tools/fx-capture.cjs        # default tools/out/fx
const fs = require('fs');
const path = require('path');
const { createRequire } = require('module');

const root = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const ONLY = (args.find((a) => a.startsWith('--only=')) || '').slice(7).split(',').filter(Boolean);
const OUT = process.env.OUT_DIR ?? path.join(__dirname, 'out', 'fx');
const SLOW = 4;
const VIEW_ONLY = (args.find((a) => a.startsWith('--views=')) || '').slice(8).split(',').filter(Boolean);
const SHOWCASES = ['fx-shark', 'fx-lanternfish', 'fx-tortoise', 'fx-jellyfish', 'fx-stickleback', 'fx-stickleback-miss', 'fx-mantis', 'fx-whale', 'fx-lead', 'fx-breakaway', 'fx-clinch', 'fx-you-lead'];
const VIEWS = [
  { name: 'phone', w: 390, h: 664, frames: 16, span: 2600 },
  { name: 'desktop', w: 1280, h: 800, frames: 12, span: 2600 },
];

function req(name) {
  for (const base of [root, path.resolve(root, '../..'), '/opt/node22/lib/node_modules']) {
    try {
      return createRequire(path.join(base, 'noop.js'))(name);
    } catch {
      /* next */
    }
  }
  throw new Error(`cannot find ${name}`);
}

const SLOWMO = `(() => {
  const f = ${SLOW};
  const pn = performance.now.bind(performance);
  const t0 = pn();
  performance.now = () => t0 + (pn() - t0) / f;
  const st = window.setTimeout.bind(window);
  window.setTimeout = (fn, ms, ...a) => st(fn, (Number(ms) || 0) * f, ...a);
  const si = window.setInterval.bind(window);
  window.setInterval = (fn, ms, ...a) => si(fn, (Number(ms) || 0) * f, ...a);
  try { localStorage.setItem('pescuit:locale', 'en'); } catch {}
})();`;

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const { chromium } = req('playwright');
  let base = process.env.BASE_URL;
  let server = null;
  if (!base) {
    const vite = req('vite');
    server = await vite.createServer({ root, configFile: path.join(root, 'vite.config.ts'), server: { port: 5199, strictPort: false, host: '127.0.0.1' }, logLevel: 'error' });
    await server.listen();
    base = server.resolvedUrls.local[0];
  }
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined }).catch(() => chromium.launch());
  const list = SHOWCASES.filter((id) => !ONLY.length || ONLY.some((o) => id.includes(o)));
  for (const v of VIEWS.filter((x) => !VIEW_ONLY.length || VIEW_ONLY.includes(x.name))) {
    for (const id of list) {
      const page = await browser.newPage({ viewport: { width: v.w, height: v.h }, deviceScaleFactor: 1 });
      await page.addInitScript(SLOWMO);
      const cdp = await page.context().newCDPSession(page);
      await cdp.send('Animation.enable');
      await page.goto(`${base}?fixture=${id}&n=4&panel=0`);
      await page.waitForFunction(() => typeof window.__fxGo === 'function' && document.querySelector('[data-player-id]'), null, { timeout: 20000 });
      await page.waitForTimeout(1500);
      await cdp.send('Animation.setPlaybackRate', { playbackRate: 1 / SLOW });
      const shots = [];
      const t0 = await page.evaluate(() => {
        window.__fxGo();
        return performance.now();
      });
      const step = v.span / v.frames;
      for (let i = 0; i < v.frames; i++) {
        const target = i * step;
        const now = await page.evaluate(() => performance.now());
        const wait = (target - (now - t0)) * SLOW;
        if (wait > 0) await page.waitForTimeout(wait);
        const at = Math.round((await page.evaluate(() => performance.now())) - t0);
        shots.push({ at, png: (await page.screenshot({ type: 'png' })).toString('base64') });
      }
      await page.close();
      // the contact sheet
      const cols = v.name === 'phone' ? 6 : 3;
      const scale = v.name === 'phone' ? 0.72 : 0.55;
      const sheet = await browser.newPage({ viewport: { width: Math.round(cols * (v.w * scale + 8)) + 8, height: 400 } });
      const cells = shots.map((s) => `<figure><img src="data:image/png;base64,${s.png}" width="${Math.round(v.w * scale)}"><figcaption>${s.at} ms</figcaption></figure>`).join('');
      await sheet.setContent(`<style>body{margin:0;padding:4px;background:#222;color:#eee;font:12px system-ui;display:flex;flex-wrap:wrap;gap:8px}figure{margin:0}figcaption{text-align:center}h1{width:100%;font-size:14px;margin:4px}</style><h1>${id} — ${v.name} ${v.w}x${v.h}</h1>${cells}`);
      const file = path.join(OUT, `${id}-${v.name}.png`);
      await sheet.screenshot({ path: file, fullPage: true });
      await sheet.close();
      console.log(`[fx] ${file}`);
    }
  }
  await browser.close();
  if (server) await server.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
