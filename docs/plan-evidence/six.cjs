// 6-player table on a 390x844 phone: where does the hand land relative to the fold?
const { chromium } = require('playwright');
const path = require('path');
const OUT = path.join(__dirname, 'shots');
const BASE = 'http://localhost:8080';

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH }).catch(() => chromium.launch());
  const phone = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 };
  const desk = { viewport: { width: 1280, height: 800 } };
  const host = await (await browser.newContext(desk)).newPage();
  await host.goto(BASE);
  await host.fill('input', 'Ana');
  await host.click('button[type=submit]');
  await host.waitForSelector('.room-code__value');
  const code = (await host.textContent('.room-code__value')).trim();
  const names = ['Bogdan', 'Cezar', 'Dana', 'Elena', 'Florin'];
  const pages = [host];
  for (const n of names) {
    const p = await (await browser.newContext(n === 'Bogdan' ? phone : desk)).newPage();
    await p.goto(`${BASE}/?room=${code}`);
    await p.fill('input', n);
    await p.click('button[type=submit]');
    await p.waitForSelector('.room-code__value');
    pages.push(p);
  }
  await host.click('.waiting .btn--primary');
  const B = pages[1];
  await B.waitForSelector('.game-screen');
  await B.waitForTimeout(500);
  const m = await B.evaluate(() => {
    const r = (s) => {
      const el = document.querySelector(s);
      if (!el) return null;
      const b = el.getBoundingClientRect();
      return { top: Math.round(b.top + scrollY), bottom: Math.round(b.bottom + scrollY), height: Math.round(b.height) };
    };
    return {
      viewportH: innerHeight,
      pageH: document.documentElement.scrollHeight,
      pageW: document.documentElement.scrollWidth,
      header: r('.game-header'),
      playerRow: r('.player-row'),
      log: r('.event-log'),
      handPanel: r('.hand-panel'),
      handCards: r('.hand-panel__cards'),
    };
  });
  console.log(JSON.stringify(m, null, 1));
  await B.screenshot({ path: path.join(OUT, '12-six-players-phone-full.png'), fullPage: true });
  await B.screenshot({ path: path.join(OUT, '13-six-players-phone-viewport.png') });
  await host.screenshot({ path: path.join(OUT, '14-six-players-desktop.png') });
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
