// The layout checks of plan §7.4, pointed at the PRODUCT: the shoot.cjs assertions and hit-tests
// from docs/plan-evidence/mock/, run against the real table (the bot table and the scenario
// fixtures, ?table=bots / ?fixture=) in headless Chromium (Playwright, the browser already in
// PLAYWRIGHT_BROWSERS_PATH; never `playwright install`).
//
//   node tools/layout-check.cjs              # all frames, exit 1 on any failure
//   node tools/layout-check.cjs --shots      # also write a PNG per frame to OUT_DIR (default tools/out/layout)
//   node tools/layout-check.cjs --only=390x664,answer     # substring filter on frame names
//   BASE_URL=http://localhost:5173/ node tools/layout-check.cjs    # reuse a running dev server
//
// Phone frames 360x640, 390x664, 375x548; desktop 1280x800, 1024x768; three and six players; in
// your-turn / ask-sheet / answer / dry-pond and the worst cases (a ten-card hand, twelve groups, all
// three active powers, six 24-character names, every chip state, the gate). Asserted:
//   - the top bar sits at the top edge; the strip, dock, hand and plank are inside the viewport;
//   - no page scroll and no sideways scroll, on the phone and on the desktop;
//   - the ask sheet lies between the strip and the dock;
//   - every plank button is >= 44 px tall and sits in the bottom 45 % of the screen; the two answer
//     buttons are the same size; no <select> anywhere under the clock;
//   - nothing is covered: elementFromPoint at the centre of every chip, post, sheet row and plank
//     button, and at the index corner of every hand group, must be that element;
//   - every post sits inside the table, every hand group inside its panel (or the dock scrolls);
//   - the log is out of the phone's flow, and below 1100 px on the desktop it is a drawer behind a tab;
//   - the pond's contents fit the pond.
// Interaction checks then drive the real inputs: tap-tap, the drag, the keyboard, the plank keys.
const fs = require('fs');
const path = require('path');
const { createRequire } = require('module');

const root = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const SHOTS = args.includes('--shots');
const ONLY = (args.find((a) => a.startsWith('--only=')) || '').slice(7).split(',').filter(Boolean);
const OUT = process.env.OUT_DIR ?? path.join(__dirname, 'out', 'layout');

function req(name) {
  for (const base of [root, path.resolve(root, '../..'), '/opt/node22/lib/node_modules']) {
    try {
      return createRequire(path.join(base, 'noop.js'))(name);
    } catch {
      /* try the next place */
    }
  }
  throw new Error(`cannot find ${name}`);
}

const PHONES = [
  { w: 360, h: 640 },
  { w: 390, h: 664 },
  { w: 375, h: 548 },
];
const DESKTOPS = [
  { w: 1280, h: 800 },
  { w: 1024, h: 768 },
];

/** the frames: [name, viewport, url query, {ask: open the sheet first, drawer: open the log drawer}] */
function frames() {
  const out = [];
  for (const n of [3, 6]) {
    for (const v of PHONES) {
      const vp = `${v.w}x${v.h}`;
      const q = (fx, extra = '') => `?fixture=${fx}&n=${n}&panel=0${extra}`;
      out.push({ name: `phone-${n}p-your-turn-${vp}`, v, phone: true, q: q('myturn') });
      out.push({ name: `phone-${n}p-ask-sheet-${vp}`, v, phone: true, q: q('myturn'), ask: true });
      out.push({ name: `phone-${n}p-answer-${vp}`, v, phone: true, q: q('answer') });
      out.push({ name: `phone-${n}p-dry-pond-${vp}`, v, phone: true, q: q('dry') });
      out.push({ name: `phone-${n}p-stall-gate-${vp}`, v, phone: true, q: q('stall') });
    }
  }
  // the worst cases, at the two ends of the phone range
  for (const v of [PHONES[0], PHONES[2]]) {
    const vp = `${v.w}x${v.h}`;
    out.push({ name: `phone-6p-chips-${vp}`, v, phone: true, q: '?fixture=chips&n=6&panel=0' });
    out.push({ name: `phone-6p-chips-ask-sheet-${vp}`, v, phone: true, q: '?fixture=chips&n=6&panel=0', ask: true });
    out.push({ name: `phone-6p-names-${vp}`, v, phone: true, q: '?fixture=names&n=6&panel=0' });
    out.push({ name: `phone-3p-tenhand-${vp}`, v, phone: true, q: '?fixture=tenhand&n=3&panel=0' });
    out.push({ name: `phone-3p-twelvegroups-${vp}`, v, phone: true, q: '?fixture=twelvehand&n=3&panel=0' });
    out.push({ name: `phone-4p-answer-squid-${vp}`, v, phone: true, q: '?fixture=answer-squid&n=4&panel=0' });
    out.push({ name: `phone-4p-shark-${vp}`, v, phone: true, q: '?fixture=shark&n=4&panel=0' });
    out.push({ name: `phone-4p-mantis-${vp}`, v, phone: true, q: '?fixture=mantis&n=4&panel=0' });
    out.push({ name: `phone-6p-whale-${vp}`, v, phone: true, q: '?fixture=whale&n=6&panel=0' });
    out.push({ name: `phone-6p-actives-${vp}`, v, phone: true, q: '?fixture=actives&n=6&panel=0' });
    out.push({ name: `phone-3p-pool1-${vp}`, v, phone: true, q: '?fixture=pool1&n=3&panel=0' });
    out.push({ name: `phone-3p-tally1-${vp}`, v, phone: true, q: '?fixture=tally1&n=3&panel=0' });
    out.push({ name: `phone-3p-log-drawer-${vp}`, v, phone: true, q: '?fixture=myturn&n=3&panel=0', drawer: true });
  }
  out.push({ name: 'phone-6p-bot-table-390x664', v: PHONES[1], phone: true, q: '?table=bots&n=6&seed=42&seat=0&until=myturn&panel=0&bots=memory' });
  for (const n of [3, 6]) {
    for (const v of DESKTOPS) {
      const vp = `${v.w}x${v.h}`;
      const q = (fx) => `?fixture=${fx}&n=${n}&panel=0`;
      out.push({ name: `desktop-${n}p-your-turn-${vp}`, v, q: q('myturn') });
      out.push({ name: `desktop-${n}p-answer-${vp}`, v, q: q('answer') });
      out.push({ name: `desktop-${n}p-dry-pond-${vp}`, v, q: q('stall') });
      out.push({ name: `desktop-${n}p-tenhand-${vp}`, v, q: q('tenhand') });
    }
  }
  out.push({ name: 'desktop-6p-chips-1024x768', v: DESKTOPS[1], q: '?fixture=chips&n=6&panel=0' });
  out.push({ name: 'desktop-6p-names-1280x800', v: DESKTOPS[0], q: '?fixture=names&n=6&panel=0' });
  out.push({ name: 'desktop-4p-actives-1280x800', v: DESKTOPS[0], q: '?fixture=actives&n=4&panel=0' });
  out.push({ name: 'desktop-4p-log-drawer-1024x768', v: DESKTOPS[1], q: '?fixture=myturn&n=4&panel=0', drawer: true });
  out.push({ name: 'desktop-6p-bot-table-1280x800', v: DESKTOPS[0], q: '?table=bots&n=6&seed=42&seat=0&until=myturn&panel=0&bots=memory' });
  return out;
}

/** runs in the page: everything the assertions need */
function measure() {
  const box = (el) => {
    if (!el) return null;
    const b = el.getBoundingClientRect();
    return { top: Math.round(b.top), bottom: Math.round(b.bottom), left: Math.round(b.left), right: Math.round(b.right), w: Math.round(b.width), h: Math.round(b.height) };
  };
  const q = (s) => box(document.querySelector(s));
  const visible = (s) => [...document.querySelectorAll(s)].filter((el) => el.getClientRects().length > 0);
  const lands = (el, x, y) => {
    const h = document.elementFromPoint(x, y);
    return h !== null && (h === el || el.contains(h));
  };
  const covered = [];
  const test = (sel, label) =>
    visible(sel).forEach((el, i) => {
      const b = el.getBoundingClientRect();
      if (b.width === 0) return;
      if (!lands(el, b.left + b.width / 2, b.top + b.height / 2)) covered.push(`${label} ${i + 1}`);
    });
  // an open drawer covers the table behind it by design (behind a scrim); its own controls are tested
  const drawerOpen = !!document.querySelector('.dk-log--drawer');
  if (!drawerOpen) {
    test('.ph-strip .chip', 'chip');
    test('.post-d', 'post');
    test('.sheet__who', 'sheet row');
    test('.ph-top button', 'top-bar tab');
  }
  test('.plank button', 'plank button');
  test('.dk-log--drawer button', 'drawer button');
  const plank = document.querySelector('.plank');
  const hand = document.querySelector('.hand');
  const scrolls = hand && hand.scrollWidth > hand.clientWidth + 1;
  const handBox = hand ? hand.getBoundingClientRect() : null;
  // a raised plank covers the hand by design; a scrolling dock has groups outside its window by design
  if (!plank && !drawerOpen)
    visible('.hgroup').forEach((el, i) => {
      const b = el.getBoundingClientRect();
      if (handBox && (b.left < handBox.left || b.left + 6 > handBox.right)) return;
      if (!lands(el, b.left + 6, b.top + 30)) covered.push(`hand group ${i + 1}'s index corner`);
    });
  const pond = document.querySelector('.ph-pond');
  return {
    covered,
    scrolls,
    groups: visible('.hgroup').map(box),
    logTab: box(visible('.dk-log-tab')[0]),
    vw: innerWidth,
    vh: innerHeight,
    scrollW: document.documentElement.scrollWidth,
    scrollH: document.documentElement.scrollHeight,
    bodyScrollH: document.body.scrollHeight,
    top: q('.ph-top'),
    strip: q('.ph-strip'),
    dock: q('.ph-dock'),
    hand: q('.hand'),
    sheet: q('.sheet'),
    plank: q('.plank'),
    table: q('.dk-table'),
    me: q('.dk-me'),
    log: box(visible('.dk-log:not(.dk-log--drawer)')[0]),
    drawer: box(visible('.dk-log--drawer')[0]),
    posts: [...document.querySelectorAll('.post-d')].map(box),
    plankButtons: [...document.querySelectorAll('.plank button')].map((b) => ({ ...box(b), label: (b.textContent || '').trim().slice(0, 24) })),
    answerButtons: [...document.querySelectorAll('.plank [data-answer]')].map(box),
    selects: document.querySelectorAll('.plank select, select').length,
    pondFits: pond ? pond.scrollHeight <= pond.clientHeight + 1 : true,
    pond: box(pond),
    pondScroll: pond ? [pond.scrollHeight, pond.clientHeight] : null,
    midFits: (() => {
      const m = document.querySelector('.ph-mid');
      return m ? m.scrollHeight <= m.clientHeight + 1 : true;
    })(),
    tableEl: !!document.querySelector('.ph, .dk'),
    phoneLogInFlow: !!document.querySelector('.ph .dk-log:not(.dk-log--drawer)'),
    mid: q('.ph-mid'),
  };
}

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
  if (!m.tableEl) return ['the table did not render'];
  if (m.scrollW > m.vw) fails.push('sideways scroll');
  if (m.scrollH > m.vh || m.bodyScrollH > m.vh) fails.push(`page scroll (${m.scrollH} > ${m.vh})`);
  fails.push(...m.covered.map((c) => `${c} is covered`));
  if (m.plank) {
    inside(m.plank, 'plank');
    for (const b of m.plankButtons) {
      if (b.h < 44) fails.push(`plank button "${b.label}" is ${b.h}px tall (< 44)`);
      if (b.top < m.vh * 0.55 - 1) fails.push(`plank button "${b.label}" starts at ${b.top}, above the bottom 45% (${Math.round(m.vh * 0.55)})`);
      inside(b, `plank button "${b.label}"`);
    }
    if (m.answerButtons.length === 2 && (m.answerButtons[0].w !== m.answerButtons[1].w || m.answerButtons[0].h !== m.answerButtons[1].h)) fails.push('the two answer buttons differ in size');
    if (m.selects) fails.push('a <select> is on the screen under the clock');
  }
  if (f.phone === false) {
    inside(m.table, 'table');
    if (m.log) {
      inside(m.log, 'log');
      if (m.log.left < m.table.right) fails.push('log overlaps the table');
    } else if (!m.logTab && !m.drawer) fails.push('no log and no drawer tab');
    if (m.vw < 1100 && m.log) fails.push('the log is not folded into a drawer below 1100 px');
    if (m.vw >= 1100 && !m.log) fails.push('no tally board at >= 1100 px');
    inside(m.hand, 'hand');
    for (const [i, p] of m.posts.entries()) within(p, m.table, `post ${i + 1}`);
    if (!m.scrolls) for (const [i, g] of m.groups.entries()) within(g, m.table, `hand group ${i + 1}`);
    else if (m.vw >= 1100) fails.push('the desktop hand scrolls');
    if (m.drawer) inside(m.drawer, 'drawer');
    return fails;
  }
  if (m.phoneLogInFlow) fails.push('the log is in the phone page flow');
  if (m.top.top !== 0) fails.push('top bar not at the top edge');
  if (m.top.h !== 40) fails.push(`top bar is ${m.top.h}px, not 40`);
  inside(m.strip, 'strip');
  if (m.strip && m.strip.h !== 96) fails.push(`strip is ${m.strip.h}px, not 96`);
  inside(m.dock, 'dock');
  inside(m.hand, 'hand');
  if (!m.scrolls) for (const [i, g] of m.groups.entries()) within({ ...g, top: m.dock.top, bottom: m.dock.bottom }, { ...m.dock, left: 0, right: m.vw }, `hand group ${i + 1}`);
  if (m.sheet) {
    inside(m.sheet, 'sheet');
    if (m.sheet.top < m.strip.bottom) fails.push('sheet covers the strip');
    if (m.sheet.bottom > m.dock.top + 2) fails.push('sheet covers the hand');
    if (!m.midFits) fails.push('the sheet overflows the pond row');
  } else if (!m.pondFits) fails.push(`the pond's contents overflow it (${m.pondScroll})`);
  if (m.drawer) inside(m.drawer, 'drawer');
  return fails;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const { chromium } = req('playwright');
  let base = process.env.BASE_URL;
  let server;
  if (!base) {
    const vite = req('vite');
    server = await vite.createServer({ root, configFile: path.join(root, 'vite.config.ts'), server: { port: 5198, strictPort: false, host: '127.0.0.1' }, logLevel: 'error' });
    await server.listen();
    base = `http://127.0.0.1:${server.config.server.port}/`;
  }
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined }).catch(() => chromium.launch());
  let ok = true;
  const results = [];
  const all = frames().filter((f) => !ONLY.length || ONLY.some((o) => f.name.includes(o)));
  for (const f of all) {
    const phone = f.phone !== false && f.v.w < 900;
    f.phone = phone;
    const ctx = await browser.newContext({ viewport: { width: f.v.w, height: f.v.h }, deviceScaleFactor: SHOTS ? 2 : 1, isMobile: phone, hasTouch: phone });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(base + f.q);
    try {
      await page.waitForSelector('.ph, .dk', { timeout: 15000 });
      await page.waitForSelector('.hand', { timeout: 5000 });
    } catch {
      results.push(`FAIL ${f.name} — the table did not render${errors.length ? ': ' + errors[0] : ''}`);
      ok = false;
      await ctx.close();
      continue;
    }
    await page.evaluate(() => document.fonts.ready);
    if (f.ask) {
      const g = page.locator('.hgroup[data-hand-group="tortoise"], .hgroup[data-hand-group="herring"]').first();
      await g.click({ position: { x: 8, y: 40 } });
    }
    if (f.drawer) {
      await (phone ? page.locator('.ph-tab', { hasText: /Jurnal|Log/ }) : page.locator('.dk-log-tab')).first().click();
    }
    await page.waitForTimeout(450);
    const m = await page.evaluate(measure);
    const fails = check(f, m);
    if (errors.length) fails.push(`page error: ${errors[0]}`);
    ok = ok && fails.length === 0;
    const summary = f.phone
      ? `strip ${m.strip?.bottom} · dock ${m.dock?.top}-${m.dock?.bottom}` + (m.sheet ? ` · sheet ${m.sheet.top}-${m.sheet.bottom}` : '') + (m.plank ? ` · plank ${m.plank.top}-${m.plank.bottom}` : '') + (m.pondScroll ? ` · pond ${m.pondScroll[1]}px` : '')
      : `table ${m.table?.left}-${m.table?.right} · ` + (m.log ? `log ${m.log.left}-${m.log.right}` : m.drawer ? `drawer ${m.drawer.left}-${m.drawer.right}` : `log in a drawer, tab at ${m.logTab?.left}`) + (m.plank ? ` · plank ${m.plank.top}-${m.plank.bottom}` : '');
    results.push(`${fails.length ? 'FAIL' : 'PASS'} ${f.name} ${summary}${fails.length ? ' — ' + fails.join('; ') : ''}`);
    if (SHOTS) await page.screenshot({ path: path.join(OUT, `${f.name}.png`) });
    await ctx.close();
  }

  /* ------------------------------------------------------------ the inputs */
  const inter = [];
  const run = async (name, vp, phone, url, fn) => {
    if (ONLY.length && !ONLY.some((o) => `interaction ${name}`.includes(o))) return;
    const ctx = await browser.newContext({ viewport: vp, isMobile: phone, hasTouch: phone });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(base + url);
    let res = 'ok';
    try {
      await page.waitForSelector('.hand');
      await page.evaluate(() => document.fonts.ready);
      await fn(page);
    } catch (e) {
      res = String(e.message).split('\n')[0];
    }
    if (errors.length && res === 'ok') res = `page error: ${errors[0]}`;
    inter.push(`${res === 'ok' ? 'PASS' : 'FAIL'} interaction ${name}${res === 'ok' ? '' : ' — ' + res}`);
    ok = ok && res === 'ok';
    await ctx.close();
  };
  const expect = async (page, sel, msg, timeout = 3000) => {
    try {
      await page.waitForSelector(sel, { timeout });
    } catch {
      throw new Error(msg);
    }
  };
  const gone = async (page, sel, msg) => {
    try {
      await page.waitForSelector(sel, { state: 'detached', timeout: 3000 });
    } catch {
      throw new Error(msg);
    }
  };
  const ph = { width: 390, height: 664 };
  const dk = { width: 1280, height: 800 };
  await run('phone tap group then a name on the sheet asks', ph, true, '?fixture=myturn&n=4&panel=0', async (page) => {
    await page.locator('.hgroup[data-hand-group="tortoise"]').click({ position: { x: 8, y: 40 } });
    await expect(page, '.sheet', 'the sheet did not open');
    await page.locator('.sheet__who:not([disabled])').first().click();
    await expect(page, '[data-banner]', 'no answering banner after the ask');
    await gone(page, '.sheet', 'the sheet stayed open');
  });
  await run('phone eggs are not askable', ph, true, '?fixture=tenhand&n=4&panel=0', async (page) => {
    await page.locator('.hgroup[data-hand-group="eggs"]').click({ position: { x: 8, y: 40 } });
    if (await page.locator('.sheet').count()) throw new Error('the sheet opened for eggs');
  });
  await run('phone a layable set lays', ph, true, '?fixture=myturn&n=4&panel=0', async (page) => {
    await page.locator('.hgroup__tab').first().click();
    await page.waitForFunction(() => !document.querySelector('.hgroup__tab'), null, { timeout: 3000 }).catch(() => {
      throw new Error('the set was not laid');
    });
  });
  await run('desktop tap group then a post asks', dk, false, '?fixture=myturn&n=4&panel=0', async (page) => {
    await page.locator('.hgroup[data-hand-group="tortoise"]').click({ position: { x: 8, y: 40 } });
    await page.locator('.post-d[data-askable="true"]').first().click();
    await expect(page, '[data-banner]', 'no answering banner after the ask');
  });
  await run('desktop drag a group onto a post (8 px threshold)', dk, false, '?fixture=myturn&n=4&panel=0', async (page) => {
    const g = await page.locator('.hgroup[data-hand-group="tortoise"]').boundingBox();
    const p = await page.locator('.post-d[data-askable="false"], .post-d').first().boundingBox();
    await page.mouse.move(g.x + 10, g.y + 60);
    await page.mouse.down();
    await page.mouse.move(g.x + 13, g.y + 58); // under the threshold: still a press
    if (await page.locator('.hand__ghost').count()) throw new Error('a drag started under the threshold');
    await page.mouse.move(g.x + 40, g.y + 20, { steps: 4 });
    await expect(page, '.hand__ghost', 'no drag ghost past the threshold');
    await page.mouse.move(p.x + p.width / 2, p.y + p.height / 2, { steps: 12 });
    await expect(page, '.post-d.is-target', 'the post under the pointer is not marked');
    await page.mouse.up();
    await expect(page, '[data-banner]', 'no answering banner after the drop');
  });
  await run('desktop keyboard: 1 picks, right cycles, Enter asks', dk, false, '?fixture=myturn&n=4&panel=0', async (page) => {
    await page.keyboard.press('1');
    await expect(page, '.hgroup.is-selected', 'key 1 did not pick a group');
    await page.keyboard.press('ArrowRight');
    await expect(page, '.post-d.is-target', 'the arrow key did not mark a target');
    await page.keyboard.press('Enter');
    await expect(page, '[data-banner]', 'Enter did not ask');
  });
  await run('phone answer: Space answers truthfully', ph, true, '?fixture=answer&n=4&panel=0', async (page) => {
    await expect(page, '.plank--answer', 'no answer plank');
    await page.keyboard.press(' ');
    await gone(page, '.plank--answer', 'Space did not answer');
  });
  await run('phone answer: two equal buttons with Squid, D lies', ph, true, '?fixture=answer-squid&n=4&panel=0', async (page) => {
    if ((await page.locator('.plank [data-answer]').count()) !== 2) throw new Error('expected two answer buttons');
    await page.keyboard.press('d');
    await gone(page, '.plank--answer', 'D did not declare the lie');
  });
  await run('phone answer without Squid does not offer a lie (A23)', ph, true, '?fixture=answer&n=4&panel=0', async (page) => {
    if ((await page.locator('.plank [data-answer]').count()) !== 1) throw new Error('a lie was offered without Squid');
    const t = await page.locator('.plank').innerText();
    if (/sepi|squid/i.test(t)) throw new Error('the plank mentions Squid without a Squid: ' + t);
  });
  await run('phone Jellyfish: tap a target declares, no select', ph, true, '?fixture=actives&n=4&panel=0', async (page) => {
    await expect(page, '.plank--power', 'no power plank');
    await page.locator('.plank__btn--tab', { hasText: /Medu|Jelly/ }).click();
    await page.locator('.tchip').first().click();
    await gone(page, '.plank--power', 'the plank stayed after a target was tapped');
  });
  await run('phone Stickleback: target then a seal', ph, true, '?fixture=actives&n=4&panel=0', async (page) => {
    await page.locator('.plank__btn--tab', { hasText: /Ghidrin|Stickle/ }).click();
    if (await page.locator('.seal8:not([disabled])').count()) throw new Error('a seal was live before a target');
    await page.locator('.tchip').first().click();
    await page.locator('.seal8').first().click();
    await gone(page, '.plank--power', 'the plank stayed after a seal was tapped');
  });
  await run('phone Whale: tap an adjacent pair', ph, true, '?fixture=whale&n=4&panel=0', async (page) => {
    await page.locator('.pair').first().click();
    await gone(page, '.plank--power', 'the plank stayed after a pair was tapped');
  });
  await run('phone Shark: Esc declines', ph, true, '?fixture=shark&n=4&panel=0', async (page) => {
    await expect(page, '.plank--power', 'no shark plank');
    await page.keyboard.press('Escape');
    await gone(page, '.plank--power', 'Esc did not decline');
  });
  await run('phone the log drawer scrolls itself, never the page', ph, true, '?table=bots&n=4&seed=3&until=turn:8&panel=0', async (page) => {
    await page.locator('.ph-tab', { hasText: /Jurnal|Log/ }).click();
    await expect(page, '.dk-log--drawer', 'the drawer did not open');
    const y = await page.evaluate(() => window.scrollY + document.documentElement.scrollTop);
    if (y !== 0) throw new Error('the page scrolled');
  });
  await run('reconnect: nothing under 1.5 s, a plaque after', ph, true, '?fixture=myturn&n=3&panel=1', async (page) => {
    await page.locator('[data-devpanel] button').first().click();
    await page.locator('[data-devpanel] button', { hasText: /drop the connection/ }).click();
    await page.waitForTimeout(900);
    if (await page.locator('[data-plaque]').count()) throw new Error('a plaque showed before 1.5 s');
    await expect(page, '[data-plaque]', 'no plaque after 1.5 s', 2500);
    await gone(page, '[data-plaque]', 'the plaque stayed after the connection came back');
  });
  await run('mute is one tap; a long press opens the mixer', ph, true, '?fixture=myturn&n=3&panel=0', async (page) => {
    const tab = page.locator('.ph-tab').first();
    await tab.click();
    if ((await tab.getAttribute('aria-pressed')) !== 'true') throw new Error('one tap did not mute');
    await tab.click();
    const b = await tab.boundingBox();
    await page.mouse.move(b.x + 10, b.y + 10);
    await page.mouse.down();
    await page.waitForTimeout(700);
    await page.mouse.up();
    await expect(page, '[data-settings]', 'the long press did not open the mixer');
  });

  await browser.close();
  if (server) await server.close();
  for (const r of results) console.log(r);
  for (const r of inter) console.log(r);
  const failed = [...results, ...inter].filter((r) => r.startsWith('FAIL')).length;
  console.log(`\n${results.length + inter.length - failed} passed, ${failed} failed`);
  process.exit(ok ? 0 : 1);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
