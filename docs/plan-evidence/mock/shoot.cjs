// Renders the §5.2 mocks to PNG and checks the one-screen rule: at real browser heights
// (Android Chrome 360x640, iOS Safari 390x664) nothing needed to act is below the fold
// and nothing scrolls sideways. Start the mock server first (see vite.config.ts).
const { chromium } = require('playwright');
const path = require('path');

const OUT = process.env.OUT_DIR ?? path.join(__dirname, '..');
const BASE = 'http://localhost:5199/';
const FRAMES = [
  { name: 'mock-phone-your-turn-390x664', frame: 'your-turn', w: 390, h: 664 },
  { name: 'mock-phone-your-turn-360x640', frame: 'your-turn', w: 360, h: 640 },
  { name: 'mock-phone-your-turn-375x548', frame: 'your-turn', w: 375, h: 548 },
  { name: 'mock-phone-ask-sheet-390x664', frame: 'ask-sheet', w: 390, h: 664 },
  { name: 'mock-phone-answer-390x664', frame: 'answer', w: 390, h: 664 },
  { name: 'mock-phone-dry-pond-390x664', frame: 'dry', w: 390, h: 664 },
  { name: 'mock-chip-states', frame: 'chips', w: 920, h: 600, dsf: 1 },
];

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH }).catch(() => chromium.launch());
  let ok = true;
  for (const f of FRAMES) {
    const phone = f.frame !== 'chips';
    const ctx = await browser.newContext({
      viewport: { width: f.w, height: f.h },
      deviceScaleFactor: f.dsf ?? 2,
      isMobile: phone,
      hasTouch: phone,
    });
    const page = await ctx.newPage();
    await page.goto(`${BASE}?frame=${f.frame}`);
    await page.waitForSelector(phone ? '.ph' : '.chipsheet');
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(400);
    if (phone) {
      const m = await page.evaluate(() => {
        const box = (s) => {
          const el = document.querySelector(s);
          if (!el) return null;
          const b = el.getBoundingClientRect();
          return { top: Math.round(b.top), bottom: Math.round(b.bottom), left: Math.round(b.left), right: Math.round(b.right) };
        };
        return {
          vw: innerWidth,
          vh: innerHeight,
          scrollW: document.documentElement.scrollWidth,
          dock: box('.ph-dock'),
          hand: box('.hand'),
          strip: box('.ph-strip'),
          sheet: box('.sheet'),
          plank: box('.plank'),
        };
      });
      const fits = m.scrollW <= m.vw && m.dock.bottom <= m.vh && m.hand.right <= m.vw && m.strip.right <= m.vw;
      ok = ok && fits;
      console.log(`${fits ? 'PASS' : 'FAIL'} ${f.name} ${JSON.stringify(m)}`);
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
