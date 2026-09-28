// Drives a 3-player game against the local server and captures screenshots of the
// current look: lobby, waiting room, table (desktop + phone), an eligible interrupt
// window (the asked player's plank) and the non-eligible banner.
const { chromium } = require('playwright');
const path = require('path');

const OUT = path.join(__dirname, 'shots');
const BASE = 'http://localhost:8080';
const fs = require('fs');
fs.mkdirSync(OUT, { recursive: true });

async function shot(page, name, full = false) {
  await page.waitForTimeout(350);
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: full });
  console.log('shot', name);
}

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH }).catch(() => chromium.launch());
  const desk = { viewport: { width: 1280, height: 800 } };
  const phone = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 };

  const ctxA = await browser.newContext(desk);
  const A = await ctxA.newPage();
  await A.goto(BASE);
  await A.fill('input', 'Ana');
  await shot(A, '01-lobby-desktop');
  await A.click('button[type=submit]');
  await A.waitForSelector('.room-code__value');
  const code = (await A.textContent('.room-code__value')).trim();
  console.log('room', code);

  const ctxB = await browser.newContext(phone);
  const B = await ctxB.newPage();
  await B.goto(`${BASE}/?room=${code}`);
  await shot(B, '02-lobby-join-phone', true);
  await B.fill('input', 'Bogdan');
  await B.click('button[type=submit]');
  await B.waitForSelector('.room-code__value');

  const ctxC = await browser.newContext(desk);
  const C = await ctxC.newPage();
  await C.goto(`${BASE}/?room=${code}`);
  await C.fill('input', 'Cezar');
  await C.click('button[type=submit]');
  await C.waitForSelector('.room-code__value');
  await shot(A, '03-waiting-room-desktop');

  await A.click('.waiting .btn--primary');
  for (const p of [A, B, C]) await p.waitForSelector('.game-screen');
  await shot(A, '04-table-desktop-start');
  await shot(B, '05-table-phone-start', true);

  const pages = { Ana: A, Bogdan: B, Cezar: C };
  const all = [A, B, C];

  async function whoseTurn() {
    for (const p of all) {
      const mine = await p.$('.game-header__turn:not(.is-theirs)');
      if (mine) return p;
    }
    return null;
  }

  let shotPlank = false;
  let shotBanner = false;
  for (let step = 0; step < 14; step++) {
    // Answer any open response window first (the asked player's plank).
    let answered = false;
    for (const p of all) {
      const plank = await p.$('.interrupt-prompt');
      if (plank) {
        if (!shotPlank) {
          await shot(p, p === B ? '06-interrupt-plank-phone' : '06-interrupt-plank-desktop', p === B);
          for (const q of all) {
            if (q !== p && (await q.$('.interrupt-banner')) && !shotBanner) {
              await shot(q, q === B ? '07-noneligible-banner-phone' : '07-noneligible-banner-desktop', q === B);
              shotBanner = true;
            }
          }
          shotPlank = true;
        }
        const go = await p.$('.interrupt-prompt .btn--go');
        const skip = await p.$('.interrupt-prompt .btn--ghost');
        if (go) await go.click();
        else if (skip) await skip.click();
        answered = true;
        await p.waitForTimeout(400);
      }
    }
    if (answered) continue;

    // Lay any completable set.
    for (const p of all) {
      const lay = await p.$('.hand-panel__lay .btn');
      if (lay) {
        await lay.click();
        await p.waitForTimeout(400);
      }
    }

    const cur = await whoseTurn();
    if (!cur) {
      await A.waitForTimeout(500);
      continue;
    }
    const target = await cur.$('.player-badge.is-askable');
    if (!target) {
      await cur.waitForTimeout(500);
      continue;
    }
    await target.hover();
    await target.click();
    await cur.waitForTimeout(200);
    if (step === 0) await shot(cur, cur === B ? '08-ask-chips-phone' : '08-ask-chips-desktop', cur === B);
    const chip = await cur.$('.rank-chip');
    if (chip) await chip.click();
    else {
      const card = await cur.$('.hand-fan .card.is-pressable');
      if (card) await card.click();
      const ask = await cur.$('.hand-panel__ask .btn--ink');
      if (ask) await ask.click();
    }
    await cur.waitForTimeout(700);
  }

  await shot(A, '09-table-desktop-midgame');
  await shot(B, '10-table-phone-midgame', true);
  await shot(C, '11-table-desktop-midgame-C');
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
