// Renders the sonic sketch in headless Chromium: one WAV per cue (class-normalised, peak
// ≤ −1 dBFS), the six seat signatures, a 12 s excerpt of the human-paced scene through each
// output profile's chain, a spectrogram sheet, and metrics.md. Then it checks the plan's
// audio rules at the chain's output and exits non-zero if one fails (§7.4). OUT_DIR
// overrides where the outputs go.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const OUT = process.env.OUT_DIR ?? __dirname;
const f1 = (v) => (Number.isFinite(v) ? v.toFixed(1) : '—');
const row = (cells) => `| ${cells.join(' | ')} |`;
const table = (head, rows) => [row(head), row(head.map(() => '---')), ...rows.map(row)].join('\n');

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH }).catch(() => chromium.launch());
  const page = await browser.newPage({ viewport: { width: 940, height: 900 } });
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));
  await page.goto('file://' + path.join(__dirname, 'sketch.html'));
  const res = await page.evaluate(() => window.runSketch());
  fs.mkdirSync(path.join(OUT, 'wav'), { recursive: true });
  const { ANCHOR, AMBIENCE_UNDER, TICK_OVER_BED, BALANCE } = res.limits;
  const names = Object.keys(res.cues);

  for (const [name, m] of Object.entries(res.cues)) fs.writeFileSync(path.join(OUT, 'wav', `${name}.wav`), Buffer.from(m.wav, 'base64'));
  fs.writeFileSync(path.join(OUT, 'wav', 'seat-signatures.wav'), Buffer.from(res.seats, 'base64'));
  for (const [p, s] of Object.entries(res.scenes)) fs.writeFileSync(path.join(OUT, 'wav', `scene-${p}-12s.wav`), Buffer.from(s.wav, 'base64'));

  const recipes = table(
    ['Cue', 'Class', 'Active ms', 'Raw peak dBFS', 'Active LUFS', 'Momentary max', 'Tail vs head dB', 'Speaker variant ms', 'Class norm dB', 'Seed spread dB', 'Peak over loudness: raw / headphones / speaker, dB', 'Mastering residual: headphones / speaker, dB'],
    names.map((n) => {
      const m = res.cues[n];
      return [`\`${n}\``, m.class, m.activeMs.toFixed(0), f1(m.peakDb), f1(m.activeLufs), f1(m.momentaryMax), f1(m.tailVsHeadDb), m.speakerActiveMs.toFixed(0), f1(m.normDb), m.variantSpreadDb.toFixed(1), `${f1(m.plr.raw)} / ${f1(m.plr.headphones)} / ${f1(m.plr.speaker)}`, `${f1(m.masteringResidualDb.headphones)} / ${f1(m.masteringResidualDb.speaker)}`];
    }),
  );
  const S = res.alone.speaker, H = res.alone.headphones;
  const through = table(
    ['Cue', 'Speaker: level shift dB', 'Speaker: tail vs head at the output, dB', 'Speaker: non-linear residual dB', 'Headphones: level shift dB'],
    names.map((n) => [`\`${n}\``, f1(S[n].shiftDb), f1(S[n].tailVsHeadDb), f1(S[n].nonlinearDb), f1(H[n].shiftDb)]),
  );
  const scenes = table(
    ['Profile', 'Anchor LUFS', 'Program gain dB', 'Cue stream LUFS', 'Whole mix LUFS', 'Short-term max', 'True peak dBTP', 'Six-cue burst dBTP', 'Limiter max GR dB', 'Limiter over 1 dB', 'Soft-clip samples', 'Bed short-term max', 'Bed under the anchor'],
    Object.entries(res.scenes).map(([p, s]) => [p, s.target, f1(s.programDb), f1(s.cueLoudness), f1(s.integrated), f1(s.shortTermMax), f1(s.truePeak), f1(s.burstTruePeak), f1(s.limiterGrMax), `${(s.limiterBusy * 100).toFixed(2)} %`, s.clipped, f1(s.bedShortTermMax), `${f1(s.target - s.bedShortTermMax)} LU`]),
  );
  const clockNames = names.filter((n) => S[n].overBedDb !== null);
  const clock = table(['Clock cue', 'Speaker: over the bed, LU', 'Headphones: over the bed, LU'], clockNames.map((n) => [`\`${n}\``, f1(S[n].overBedDb), f1(H[n].overBedDb)]));
  const cf = res.confusability;
  const rhythm = (r) => (r.length ? r.map((t) => `${t}`).join(' · ') + ' ms' : 'no attack (a swell)');
  const confus = [
    `Rhythm is the onsets in the first 300 ms; timbre is the log-mel pattern of the first 50 ms. Every cue is compared with the six seat signatures, and with the cues that can sound at the same moment of the ask (the turn, the ask's landing, the answer window, the outcome, the lay, a power) unless both belong to one event. A pair with the same rhythm must differ in timbre by at least the bar: the smallest timbre step between two seat signatures of the same rhythm, ${cf.bar.pair}, ${cf.bar.d.toFixed(1)} dB.`,
    '',
    table(['Seat signature', 'Rhythm'], Object.entries(cf.seatRhythms).map(([k, r]) => [k, rhythm(r)])),
    '',
    table(['Cue', 'Rhythm (headphones variant)'], Object.entries(cf.rhythms).map(([k, r]) => [`\`${k}\``, rhythm(r)])),
    '',
    table(['Closest same-rhythm pairs with different meanings', 'Timbre distance dB'], cf.closest.map((p) => [p.pair, p.d.toFixed(1)])),
  ].join('\n');
  const c = res.cuesPerMinute;
  const cpm = `The scripted scene (three minutes, five players, human pace, heard from seat 0) plays ${c.all} cues a minute: table ${c.table}, clock ${c.clock}, power ${c.power}, at ${c.asks} asks a minute. The 12 s listening excerpts start at ${res.excerptFrom.toFixed(1)} s, the scene's busiest stretch.`;

  // The rules the plan states, checked at the chain's output. Each can fail.
  const scenesE = Object.entries(res.scenes);
  const echo = names.filter((n) => n !== 'mus.start' && S[n].tailVsHeadDb > -12);
  const peaks = scenesE.filter(([, s]) => s.truePeak > -1 || s.burstTruePeak > -1 || s.clipped > 0);
  const limiting = scenesE.filter(([, s]) => s.limiterBusy > 0.01);
  const bed = scenesE.filter(([, s]) => s.target - s.bedShortTermMax < AMBIENCE_UNDER[0] || s.target - s.bedShortTermMax > AMBIENCE_UNDER[1]);
  const buried = clockNames.flatMap((n) => [['speaker', S[n]], ['headphones', H[n]]].filter(([, a]) => a.overBedDb < TICK_OVER_BED).map(([p]) => `${n} on ${p}`));
  const balance = names.flatMap((n) => [['speaker', S[n]], ['headphones', H[n]]].filter(([, a]) => Math.abs(a.shiftDb) > BALANCE).map(([p, a]) => `${n} on ${p} ${f1(a.shiftDb)} dB`));
  const check = (fail, text, detail) => `- ${fail.length ? 'FAIL' : 'PASS'} — ${text}${fail.length ? ` (${detail ?? fail.join('; ')})` : ''}.`;
  const checks = [
    check(res.grammar, 'plank grammar: no cue but the seat cues strikes plank A, B or C'),
    check(cf.violations.map((p) => `${p.pair} ${p.d.toFixed(1)} dB`), `confusability: no cue shares a rhythm with a seat signature, or with a cue of another event at the same moment, unless their timbres differ by at least the seat step (${cf.bar.d.toFixed(1)} dB)`),
    check(echo.map((n) => `${n} ${f1(S[n].tailVsHeadDb)} dB`), 'echo budget at the output of the speaker chain: every speaker variant keeps its energy after 250 ms at least 12 dB under its first 250 ms (`mus.start` exempt)'),
    check(peaks.map(([p]) => p), 'peaks: true peak ≤ −1 dBTP in the scene and the six-cue pile-up, and the soft clip never engages'),
    check(limiting.map(([p, s]) => `${p} ${(s.limiterBusy * 100).toFixed(2)} %`), 'headroom: at the anchor level the limiter is above 1 dB of gain reduction for under 1 % of the scene'),
    check(bed.map(([p, s]) => `${p} ${f1(s.target - s.bedShortTermMax)} LU under`), `ambience: the bed sits ${AMBIENCE_UNDER[0]}–${AMBIENCE_UNDER[1]} LU under the anchor — under the table, never gone`),
    check(buried, `the clock: every Clock cue sounds at least ${TICK_OVER_BED} LU over the bed`),
    check(balance, `balance: the chain moves no cue more than ${BALANCE} dB from its cue-sheet level, on either profile`),
  ];
  const ok = checks.every((l) => l.startsWith('- PASS'));
  const md = [
    '## Recipes, and each cue mastered per profile (before the chain)',
    recipes,
    '## Every cue alone through the chain, at the calibrated program gain',
    'Level shift is the chain\'s effect on the cue\'s loudness against the same cue with no dynamics. The speaker variant is measured as designed, before the runtime safety fade.',
    through,
    '## The scene through each profile',
    `Program gain is calibrated on one thing only: the anchor cue, \`table.turn\`, sounding at ${ANCHOR.speaker} LUFS on speakers and ${ANCHOR.headphones} LUFS on headphones (K-weighted over its active span, at the output). The cue stream, the whole mix and the bed are then measured, not set.`,
    scenes,
    cpm,
    '## The clock over the bed',
    clock,
    '## Confusability',
    confus,
    '## Checks',
    checks.join('\n'),
  ].join('\n\n');
  fs.writeFileSync(path.join(OUT, 'metrics.md'), md + '\n');
  console.log(md);
  await page.screenshot({ path: path.join(OUT, 'spectrograms.png'), fullPage: true });
  await browser.close();
  process.exit(ok ? 0 : 1);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
