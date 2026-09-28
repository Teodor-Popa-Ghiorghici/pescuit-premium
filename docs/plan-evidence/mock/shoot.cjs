// Renders the §5.2 mocks to PNG and asserts the one-screen rule at real browser heights:
// nothing needed to act is below the fold, nothing scrolls sideways, the ask sheet sits
// between the opponent strip and the dock, the answer plank is fully on screen, and the
// desktop table fits without page scroll. Boxes alone cannot see one element covering
// another, so it also hit-tests: the centre of every opponent chip, desktop post, sheet row
// and plank button, and the index corner of every hand group, must be that element and not
// something drawn over it; every post must sit inside the table, and every hand group
// inside its panel. Start the mock server first (vite.config.ts). OUT_DIR overrides where
// the PNGs go.
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
  const within = (b, p, label) => {
    if (b && p && (b.left < p.left || b.right > p.right || b.top < p.top || b.bottom > p.bottom)) fails.push(`${label} outside its panel`);
  };
  if (m.scrollW > m.vw) fails.push('sideways scroll');
  fails.push(...m.covered.map((c) => `${c} is covered`));
  if (f.frame === 'desktop') {
    if (m.scrollH > m.vh) fails.push('page scroll');
    inside(m.table, 'table');
    if (m.log) {
      inside(m.log, 'log');
      if (m.log.left < m.table.right) fails.push('log overlaps the table');
    } else if (!m.logTab) fails.push('no log and no drawer tab');
    inside(m.hand, 'hand');
    for (const [i, p] of m.posts.entries()) within(p, m.table, `post ${i + 1}`);
    for (const [i, g] of m.groups.entries()) within(g, m.table, `hand group ${i + 1}`);
    return fails;
  }
  for (const [i, g] of m.groups.entries()) within({ ...g, top: m.dock.top, bottom: m.dock.bottom }, { ...m.dock, left: 0, right: m.vw }, `hand group ${i + 1}`);
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
        const visible = (s) => [...document.querySelectorAll(s)].filter((el) => el.getClientRects().length > 0);
        // the element itself must be what a finger or a pointer lands on at that point
        const lands = (el, x, y) => {
          const h = document.elementFromPoint(x, y);
          return h !== null && (h === el || el.contains(h));
        };
        const covered = [];
        for (const [sel, label] of [['.ph-strip .chip', 'chip'], ['.post-d', 'post'], ['.sheet__who', 'sheet row'], ['.plank__btn', 'plank button']])
          visible(sel).forEach((el, i) => {
            const b = el.getBoundingClientRect();
            if (!lands(el, b.left + b.width / 2, b.top + b.height / 2)) covered.push(`${label} ${i + 1}`);
          });
        // a raised plank covers the hand by design: nothing in the hand can be played then
        if (!visible('.plank').length)
          visible('.hgroup').forEach((el, i) => {
            const b = el.getBoundingClientRect();
            if (!lands(el, b.left + 6, b.top + 30)) covered.push(`hand group ${i + 1}'s index corner`);
          });
        return {
          covered,
          groups: visible('.hgroup').map(box),
          logTab: box(visible('.dk-log-tab')[0]),
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
          log: box(visible('.dk-log')[0]),
          posts: [...document.querySelectorAll('.post-d')].map(box),
        };
      });
      const fails = check(f, m);
      ok = ok && fails.length === 0;
      const summary =
        f.frame === 'desktop'
          ? `table ${m.table.left}-${m.table.right} · ` + (m.log ? `log ${m.log.left}-${m.log.right}` : `log in a drawer, tab at ${m.logTab.left}`)
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
