// Renders the sonic sketch in headless Chromium: one WAV per cue (class-normalised, peak
// ≤ −1 dBFS), the six seat signatures, a 12 s excerpt of the human-paced scene per output
// profile, a spectrogram sheet, and metrics.md. Then it checks the plan's audio rules and
// exits non-zero if one fails: the plank grammar (§3.1), the echo budget by design (§3.4),
// and loudness, true peak and clipping per profile (§0.2, §3.3). OUT_DIR overrides where
// the outputs go.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const OUT = process.env.OUT_DIR ?? __dirname;
const f1 = (v) => (Number.isFinite(v) ? v.toFixed(1) : '—');

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH }).catch(() => chromium.launch());
  const page = await browser.newPage({ viewport: { width: 940, height: 900 } });
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));
  await page.goto('file://' + path.join(__dirname, 'sketch.html'));
  const res = await page.evaluate(() => window.runSketch());
  fs.mkdirSync(path.join(OUT, 'wav'), { recursive: true });
  const rows = [];
  for (const [name, m] of Object.entries(res.cues)) {
    fs.writeFileSync(path.join(OUT, 'wav', `${name}.wav`), Buffer.from(m.wav, 'base64'));
    rows.push(
      `| \`${name}\` | ${m.class} | ${m.activeMs.toFixed(0)} | ${f1(m.peakDb)} | ${f1(m.activeLufs)} | ${f1(m.momentaryMax)} | ${f1(m.tailVsHeadDb)} | ${m.speakerActiveMs.toFixed(0)} | ${f1(m.speakerTailVsHeadDb)} | ${f1(m.normDb)} | ${m.variantSpreadDb.toFixed(1)} |`,
    );
  }
  fs.writeFileSync(path.join(OUT, 'wav', 'seat-signatures.wav'), Buffer.from(res.seats, 'base64'));
  const table = [
    '| Cue | Class | Active ms | Raw peak dBFS | Active LUFS | Momentary max | Tail vs head dB | Speaker variant ms (by design) | Speaker tail vs head dB (by design) | Class norm dB | Seed spread dB |',
    '|---|---|---|---|---|---|---|---|---|---|---|',
    ...rows,
  ].join('\n');
  const scenes = Object.entries(res.scenes)
    .map(([p, s]) => {
      fs.writeFileSync(path.join(OUT, 'wav', `scene-${p}-12s.wav`), Buffer.from(s.wav, 'base64'));
      return `| ${p} | ${s.target} | ${f1(s.integrated)} | ${f1(s.shortTermMax)} | ${f1(s.truePeak)} | ${f1(s.burstTruePeak)} | ${f1(s.programDb)} | ${(s.clipShare * 100).toFixed(3)} % |`;
    })
    .join('\n');
  const sceneTable = [
    '| Profile | Target LUFS | Integrated LUFS | Short-term max | True peak dBTP | Six-cue burst true peak dBTP | Program gain dB | Samples within 0.5 dB of the clip |',
    '|---|---|---|---|---|---|---|---|',
    scenes,
  ].join('\n');
  const c = res.cuesPerMinute;
  const cpm = `The scripted scene (three minutes, five players, human pace, heard from seat 0) plays ${c.all} cues a minute: table ${c.table}, clock ${c.clock}, power ${c.power}, at ${c.asks} asks a minute. The 12 s listening excerpts start at ${res.excerptFrom.toFixed(1)} s, the scene's busiest stretch.`;
  // The rules the plan states, checked.
  const echo = Object.entries(res.cues).filter(([name, m]) => name !== 'mus.start' && m.speakerTailVsHeadDb > -12);
  const loud = Object.entries(res.scenes).filter(([, s]) => Math.abs(s.integrated - s.target) > 2 || s.truePeak > -1 || s.burstTruePeak > -1 || s.clipShare > 0);
  const checks = [
    `- ${res.grammar.length ? 'FAIL' : 'PASS'} — plank grammar: no cue but the seat cues strikes plank A, B or C${res.grammar.length ? ' (' + res.grammar.join('; ') + ')' : ''}.`,
    `- ${echo.length ? 'FAIL' : 'PASS'} — echo budget, by design: every speaker variant keeps its energy after 250 ms at least 12 dB under the first 250 ms (\`mus.start\` exempt)${echo.length ? ' (' + echo.map(([n, m]) => `${n} ${f1(m.speakerTailVsHeadDb)} dB`).join('; ') + ')' : ''}.`,
    `- ${loud.length ? 'FAIL' : 'PASS'} — loudness per profile within ±2 LU of target, true peak ≤ −1 dBTP in the scene and the six-cue burst, and no samples near the clip${loud.length ? ' (' + loud.map(([p]) => p).join(', ') + ')' : ''}.`,
  ].join('\n');
  const ok = !res.grammar.length && !echo.length && !loud.length;
  fs.writeFileSync(path.join(OUT, 'metrics.md'), `${table}\n\n${sceneTable}\n\n${cpm}\n\n${checks}\n`);
  console.log(`${table}\n\n${sceneTable}\n\n${cpm}\n\n${checks}`);
  await page.screenshot({ path: path.join(OUT, 'spectrograms.png'), fullPage: true });
  await browser.close();
  process.exit(ok ? 0 : 1);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
