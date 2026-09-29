// The performance gates of plan §9.1, measured in the bot table with the CPU throttled (default 4x):
//
//   input -> visual response      <= 50 ms p95   (a tap on a group, a tap on a target, a press on the plank)
//   answer -> rest                <= 0.9 s p95   (from RESPONSE_PENDING leaving the view to the last flier landed)
//   frame rate in a whale         >= 55 fps      (six players, the spiral of twelve backs and the redeal)
//
//   node tools/perf-check.cjs                     # build, serve, measure, print
//   node tools/perf-check.cjs --cpu=4 --seconds=60 --phone|--desktop
//   node tools/perf-check.cjs --strict            # exit 1 when a gate is missed
//   BASE_URL=http://localhost:4173/ node tools/perf-check.cjs   # reuse a running preview
//
// It reports the numbers honestly whether or not they hit the targets; the plan says they are then
// confirmed on a real mid-range Android at each milestone, and a throttled desktop Chromium is only a
// proxy. It plays a human: it taps a group, taps a target, presses the plank when asked. Everything the
// page measures for itself is in `window.__metrics` (`?metrics=1`).
const fs = require('fs');
const path = require('path');
const { createRequire } = require('module');

const root = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const flag = (n, d) => {
  const a = args.find((x) => x.startsWith(`--${n}=`));
  return a ? a.slice(n.length + 3) : d;
};
const CPU = Number(flag('cpu', 4));
const SECONDS = Number(flag('seconds', 90));
const STRICT = args.includes('--strict');
const DESKTOP = args.includes('--desktop');

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

const pct = (a, p) => {
  if (!a.length) return NaN;
  const s = [...a].sort((x, y) => x - y);
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))];
};
const f0 = (n) => (Number.isFinite(n) ? String(Math.round(n)) : 'n/a');

/** runs in the page before anything else: what the script needs to time */
function instrument() {
  window.__perf = true;
  window.__lat = [];
  window.__latWhat = [];
  window.__rest = [];
  window.__restAt = [];
  window.__frames = [];
  window.__events = [];
  try {
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) window.__events.push({ name: e.name, duration: e.duration, processing: e.processingEnd - e.processingStart, delay: e.processingStart - e.startTime });
    }).observe({ type: 'event', durationThreshold: 16, buffered: true });
  } catch (e) { /* no Event Timing */ }
  let down = null;
  // the action fires on the click (or the key), not on the finger going down
  addEventListener('click', (e) => { down = performance.now(); window.__what = 'click ' + ((e.target && e.target.closest && (e.target.closest('[class]') || e.target).className) || '').toString().slice(0, 30); }, true);
  addEventListener('keydown', (e) => { down = performance.now(); window.__what = 'key ' + e.key; }, true);
  // input -> visual: from the press to the first paint after the page changed because of it
  new MutationObserver(() => {
    if (down === null) return;
    const t0 = down;
    const what = window.__what;
    down = null;
    // an input the page never answered (a press on a plank that had already closed) is not a slow one: the next
    // unrelated change would be charged to it
    if (performance.now() - t0 > 300) { window.__unanswered = (window.__unanswered || 0) + 1; return; }
    // the frame that shows the change is presented after its rAF callbacks: a message posted from one runs after that frame's paint
    requestAnimationFrame(() => {
      const c = new MessageChannel();
      c.port1.onmessage = () => { window.__lat.push(performance.now() - t0); window.__latWhat.push(what); };
      c.port2.postMessage(0);
    });
  }).observe(document, { subtree: true, attributes: true, childList: true });
  // answer -> rest: from the mark the presenter drops when RESPONSE_PENDING leaves the view to the last flier landed
  let seen = 0;
  let pending = null;
  let sawAir = false;
  let quiet = 0;
  // finite animations in the flight layer that belong to the table lane: not the reveal (the hud lane, never blocking),
  // not the arrow-chip's idle rocking (the only idle motion in the game)
  const air = () =>
    document.getAnimations().some((a) => {
      if (a.playState !== 'running' || !a.effect) return false;
      const el = a.effect.target;
      if (!el || !el.closest || !el.closest('[data-flight-layer]') || el.closest('.reveal') || el.closest('.window-ghost')) return false;
      // only the answer's own animations: the next ask's chip starts at least 850 ms later
      if (pending !== null && a.startTime !== null && a.startTime - pending > 700) return false;
      return a.effect.getComputedTiming().iterations !== Infinity;
    });
  const loop = (t) => {
    window.__frames.push(t);
    if (window.__frames.length > 20000) window.__frames.splice(0, 10000);
    const marks = performance.getEntriesByName('pescuit:answerLeft');
    if (marks.length > seen) {
      seen = marks.length;
      pending = marks[marks.length - 1].startTime;
      sawAir = false;
      quiet = 0;
    }
    if (pending !== null) {
      if (air()) { sawAir = true; quiet = 0; }
      else if (sawAir && ++quiet >= 2) { window.__rest.push(t - pending); window.__restAt.push(pending); pending = null; }
      else if (!sawAir && t - pending > 2500) pending = null;
    }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}

(async () => {
  const { chromium } = req('playwright');
  const vite = req('vite');
  let base = process.env.BASE_URL;
  let server;
  if (!base) {
    // the production bundle: the dev server's unminified, double-rendering React would measure the wrong thing
    await vite.build({ root, configFile: path.join(root, 'vite.config.ts'), logLevel: 'error', build: { outDir: path.join(root, 'tools', 'out', 'perf-dist'), emptyOutDir: true } });
    server = await vite.preview({ root, configFile: path.join(root, 'vite.config.ts'), logLevel: 'error', build: { outDir: path.join(root, 'tools', 'out', 'perf-dist') }, preview: { port: 4188, strictPort: false, host: '127.0.0.1' } });
    base = server.resolvedUrls.local[0];
  }
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined }).catch(() => chromium.launch());
  const vp = DESKTOP ? { width: 1280, height: 800 } : { width: 390, height: 664 };
  const newPage = async () => {
    const ctx = await browser.newContext({ viewport: vp, isMobile: !DESKTOP, hasTouch: !DESKTOP, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.addInitScript(instrument);
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU });
    return { ctx, page, errors };
  };

  /* ---------------------------------------------------- a human at a six-player table */
  const { ctx, page, errors } = await newPage();
  await page.goto(`${base}?table=bots&n=6&seed=42&seat=0&speed=1&bots=memory&panel=0&metrics=1`);
  await page.waitForSelector('.ph, .dk', { timeout: 20000 });
  // the lobby's first knock unlocks the audio and the tonal families render in its idle time: do the same here
  await page.mouse.click(2, 2);
  await page.waitForTimeout(4000);
  await page.evaluate(() => { window.__lat.length = 0; window.__latWhat.length = 0; window.__rest.length = 0; window.__restAt.length = 0; });
  const t0 = Date.now();
  let asks = 0;
  let answers = 0;
  while (Date.now() - t0 < SECONDS * 1000) {
    try {
      const truth = await page.$('.plank [data-answer="truth"]:not([disabled])');
      if (truth) {
        await page.waitForTimeout(250 + Math.random() * 400);
        await page.keyboard.press('Space');
        answers++;
        await page.waitForTimeout(900);
        continue;
      }
      const over = await page.$('.gameover');
      if (over) break;
      const group = await page.$('.hgroup.is-askable');
      if (group) {
        await group.click({ position: { x: 8, y: 40 }, timeout: 1500 });
        await page.waitForTimeout(220);
        const row = (await page.$('.sheet__who:not([disabled])')) || (await page.$('.chip[data-askable="true"], .post-d[data-askable="true"]'));
        if (row) {
          await row.click({ timeout: 1500 });
          asks++;
        } else await page.keyboard.press('Escape');
        await page.waitForTimeout(1300);
        continue;
      }
    } catch {
      /* the table moved under us: look again */
    }
    await page.waitForTimeout(120);
  }
  const session = await page.evaluate(() => ({
    lat: window.__lat.slice(),
    latWhat: window.__latWhat.slice(),
    unanswered: window.__unanswered || 0,
    rest: window.__rest.slice(),
    frames: window.__frames.slice(),
    events: window.__events.slice(),
    steps: window.__metrics ? window.__metrics.state.steps.slice() : [],
    restAt: window.__restAt.slice(),
    m: window.__metrics && window.__metrics.summary(),
  }));
  const sessionErrors = errors.slice();
  await ctx.close();

  /* ----------------------------------------------------------- the whale, six players */
  const whale = await newPage();
  await whale.page.goto(`${base}?fixture=whale&n=6&panel=0&metrics=1`);
  await whale.page.waitForSelector('.plank .pair', { timeout: 20000 });
  await whale.page.mouse.click(2, 2);
  await whale.page.waitForTimeout(3500);
  const runs = [];
  // one whale per page load: the fixture is a single window; reload for a few samples
  for (let i = 0; i < 3; i++) {
    if (i > 0) {
      await whale.page.goto(`${base}?fixture=whale&n=6&seed=${40 + i}&panel=0&metrics=1`);
      await whale.page.waitForSelector('.plank .pair', { timeout: 20000 });
      await whale.page.mouse.click(2, 2);
      await whale.page.waitForTimeout(3500);
    }
    await whale.page.evaluate(() => { window.__whaleFrom = performance.now(); });
    await whale.page.locator('.plank .pair').first().click();
    await whale.page.waitForTimeout(2600);
    runs.push(
      await whale.page.evaluate(() => {
        const from = window.__whaleFrom;
        const fr = window.__frames.filter((t) => t >= from && t <= from + 2400);
        const dts = fr.slice(1).map((t, i) => t - fr[i]);
        const span = fr.length > 1 ? fr[fr.length - 1] - fr[0] : 0;
        return { frames: fr.length, fps: span ? ((fr.length - 1) * 1000) / span : 0, worst: Math.max(0, ...dts), long: dts.filter((d) => d > 50).length, p95: dts.slice().sort((a, b) => a - b)[Math.floor(dts.length * 0.95)] || 0 };
      }),
    );
  }
  const whaleErrors = whale.errors.slice();
  await whale.ctx.close();
  await browser.close();
  if (server) await new Promise((r) => server.httpServer.close(r));
  try { fs.rmSync(path.join(root, 'tools', 'out', 'perf-dist'), { recursive: true, force: true }); } catch { /* fine */ }

  /* ---------------------------------------------------------------- the report */
  const inputP95 = pct(session.lat, 95);
  const restP95 = pct(session.rest, 95);
  const whaleFps = runs.map((r) => r.fps);
  const minFps = Math.min(...whaleFps);
  const dts = session.frames.slice(1).map((t, i) => t - session.frames[i]);
  const sessionFps = dts.length ? 1000 / (dts.reduce((a, b) => a + b, 0) / dts.length) : NaN;
  const line = (label, value, unit, target, ok) => `${ok === null ? '    ' : ok ? 'PASS' : 'MISS'}  ${label.padEnd(34)} ${String(value).padStart(8)} ${unit.padEnd(4)} ${target}`;
  const out = [];
  out.push(`perf-check: ${DESKTOP ? 'desktop 1280x800' : 'phone 390x664'}, CPU throttled ${CPU}x, ${SECONDS} s at a six-player bot table, ${asks} asks and ${answers} answers by hand`);
  out.push(line('input -> visual, p95', f0(inputP95), 'ms', `target <= 50   (n=${session.lat.length}${session.unanswered ? `, ${session.unanswered} inputs the page had nothing to answer` : ''}, median ${f0(pct(session.lat, 50))}, max ${f0(Math.max(0, ...session.lat))})`, Number.isFinite(inputP95) ? inputP95 <= 50 : null));
  if (session.events.length) {
    const ev = session.events;
    out.push(`      Event Timing (>= 16 ms only): ${ev.length} events; median duration ${f0(pct(ev.map((e) => e.duration), 50))} ms = input delay ${f0(pct(ev.map((e) => e.delay), 50))} + processing ${f0(pct(ev.map((e) => e.processing), 50))} + presentation; p95 duration ${f0(pct(ev.map((e) => e.duration), 95))} ms`);
  }
  out.push(line('answer -> rest, p95', f0(restP95), 'ms', `target <= 900  (n=${session.rest.length}, median ${f0(pct(session.rest, 50))}, max ${f0(Math.max(0, ...session.rest))})`, Number.isFinite(restP95) ? restP95 <= 900 : null));
  session.rest = session.rest.filter((r, i) => { const st = session.steps.filter((x) => Math.abs(x.at - session.restAt[i]) < 60)[0]; return !st || st.tableMs > 0; }); // a window that ends with no consequence in the same step (a structural window follows) is the rules' pause, not a rest
  const worst = session.lat.map((v, i) => ({ v, w: session.latWhat[i] })).sort((a, b) => b.v - a.v).slice(0, 4);
  out.push(`      slowest inputs: ${worst.map((x) => `${f0(x.v)} ms (${x.w})`).join('; ')}`);
  const slow = session.rest.map((r, i) => ({ r, at: session.restAt[i] })).filter((x) => x.r > 900).sort((a, b) => b.r - a.r).slice(0, 4);
  for (const x of slow) {
    const st = session.steps.filter((s) => Math.abs(s.at - x.at) < 60)[0];
    out.push(`      slow answer -> rest ${f0(x.r)} ms: ${st ? `beats ${st.kinds.join('+')}, table ${st.tableMs} ms, queued ${f0(st.queuedMs)} ms` : 'step not found'}`);
  }
  out.push(line('answer -> rest, presenter timers', f0(session.m && session.m.answerToRest ? session.m.answerToRest.p95 : NaN), 'ms', `(the presenter's own clock; n=${session.m && session.m.answerToRest ? session.m.answerToRest.n : 0})`, null));
  out.push(line('fps in a whale (worst of 3)', f0(minFps), 'fps', `target >= 55   (runs ${whaleFps.map(f0).join(', ')}; worst frame ${f0(Math.max(...runs.map((r) => r.worst)))} ms, frames > 50 ms: ${runs.map((r) => r.long).join(', ')})`, minFps >= 55));
  out.push(line('fps over the session', f0(sessionFps), 'fps', '', null));
  out.push(`page errors: ${[...sessionErrors, ...whaleErrors].length ? [...sessionErrors, ...whaleErrors].slice(0, 3).join(' | ') : 'none'}`);
  console.log(out.join('\n'));
  const missed = out.filter((l) => l.startsWith('MISS')).length;
  process.exit(STRICT && missed ? 1 : 0);
})();
