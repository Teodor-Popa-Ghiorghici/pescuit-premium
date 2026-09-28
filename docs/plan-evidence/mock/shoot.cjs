// Renders the §5.2 mocks to PNG and asserts the one-screen rule at real browser heights:
// nothing needed to act is below the fold, nothing scrolls sideways, the ask sheet sits
// between the opponent strip and the dock, the answer plank is fully on screen, and the
// desktop table fits without page scroll. Start the mock server first (vite.config.ts).
// OUT_DIR overrides where the PNGs go.
const { chromium } = require('playwright');
const path = require('path');

const OUT = process.env.OUT_DIR ?? path.join(__dirname, '..');
const BASE = 'http://localhost:5199/';
const FRAMES = [
  { name: 'mock-phone-your-turn-390x664', frame: 'your-turn', w: 390, h: 664 },
  { name: 'mock-phone-your-turn-360x640', frame: 'your-turn', w: 360, h: 640 },
  { name: 'mock-phone-your-turn-375x548', frame: 'your-turn', w: 375, h: 548 },
  { name: 'mock-phone-ask-sheet-390x664', frame: 'ask-sheet', w: 390, h: 664 },
  { name: 'mock-phone-ask-sheet-375x548', frame: 'ask-sheet', w: 375, h: 548 },
  { name: 'mock-phone-answer-390x664', frame: 'answer', w: 390, h: 664 },
  { name: 'mock-phone-answer-375x548', frame: 'answer', w: 375, h: 548 },
  { name: 'mock-phone-dry-pond-390x664', frame: 'dry', w: 390, h: 664 },
  { name: 'mock-desktop-1280x800', frame: 'desktop', w: 1280, h: 800, dsf: 1 },
  { name: 'mock-desktop-1024x768', frame: 'desktop', w: 1024, h: 768, dsf: 1 },
  { name: 'mock-chip-states', frame: 'chips', w: 920, h: 640, dsf: 1 },
];

function check(f, m) {
  const fails = [];
  const inside = (b, label) => {
    if (!b) return;
    if (b.left < 0 || b.right > m.vw) fails.push(`${label} outside the width`);
    if (b.top < 0 || b.bottom > m.vh) fails.push(`${label} outside the height`);
  };
  if (m.scrollW > m.vw) fails.push('sideways scroll');
  if (f.frame === 'desktop') {
    if (m.scrollH > m.vh) fails.push('page scroll');
    inside(m.table, 'table');
    inside(m.log, 'log');
    inside(m.hand, 'hand');
    for (const [i, p] of m.posts.entries()) inside(p, `post ${i + 1}`);
    return fails;
  }
  if (m.top.top !== 0) fails.push('top bar not at the top edge');
  inside(m.strip, 'strip');
  inside(m.dock, 'dock');
  inside(m.hand, 'hand');
  if (m.sheet) {
    inside(m.sheet, 'sheet');
    if (m.sheet.top < m.strip.bottom) fails.push('sheet covers the strip');
    if (m.sheet.bottom > m.dock.top + 2) fails.push('sheet covers the hand');
  }
  if (m.plank) inside(m.plank, 'plank');
  return fails;
}

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH }).catch(() => chromium.launch());
  let ok = true;
  for (const f of FRAMES) {
    const phone = !['chips', 'desktop'].includes(f.frame);
    const ctx = await browser.newContext({ viewport: { width: f.w, height: f.h }, deviceScaleFactor: f.dsf ?? 2, isMobile: phone, hasTouch: phone });
    const page = await ctx.newPage();
    await page.goto(`${BASE}?frame=${f.frame}`);
    await page.waitForSelector(f.frame === 'chips' ? '.chipsheet' : f.frame === 'desktop' ? '.dk' : '.ph');
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(400);
    if (f.frame !== 'chips') {
      const m = await page.evaluate(() => {
        const box = (el) => {
          if (!el) return null;
          const b = el.getBoundingClientRect();
          return { top: Math.round(b.top), bottom: Math.round(b.bottom), left: Math.round(b.left), right: Math.round(b.right) };
        };
        const q = (s) => box(document.querySelector(s));
        return {
          vw: innerWidth,
          vh: innerHeight,
          scrollW: document.documentElement.scrollWidth,
          scrollH: document.documentElement.scrollHeight,
          top: q('.ph-top'),
          strip: q('.ph-strip'),
          dock: q('.ph-dock'),
          hand: q('.hand'),
          sheet: q('.sheet'),
          plank: q('.plank'),
          table: q('.dk-table'),
          log: q('.dk-log'),
          posts: [...document.querySelectorAll('.post-d')].map(box),
        };
      });
      const fails = check(f, m);
      ok = ok && fails.length === 0;
      const summary =
        f.frame === 'desktop'
          ? `table ${m.table.top}-${m.table.bottom} · log ${m.log.left}-${m.log.right}`
          : `strip ${m.strip.bottom} · dock ${m.dock.top}-${m.dock.bottom}` + (m.sheet ? ` · sheet ${m.sheet.top}-${m.sheet.bottom}` : '') + (m.plank ? ` · plank ${m.plank.top}-${m.plank.bottom}` : '');
      console.log(`${fails.length ? 'FAIL' : 'PASS'} ${f.name} ${summary}${fails.length ? ' — ' + fails.join('; ') : ''}`);
    }
    await page.screenshot({ path: path.join(OUT, `${f.name}.png`) });
    await ctx.close();
  }
  await browser.close();
  process.exit(ok ? 0 : 1);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
