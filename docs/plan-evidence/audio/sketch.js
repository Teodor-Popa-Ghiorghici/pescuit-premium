// Sonic sketch for FEEL_VISUAL_SOUND_PLAN.md: the Appendix B recipes rendered through
// Chromium's own Web Audio engine (OfflineAudioContext), measured with a BS.1770 meter,
// and mixed into a human-paced scene per output profile. No dependencies.

const SR = 48000;

/* ------------------------------------------------------------------ utilities */
function rng(seed) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), t | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}
const db = (x) => 20 * Math.log10(Math.max(x, 1e-12));
const fromDb = (d) => 10 ** (d / 20);
const midi = (n) => 440 * 2 ** ((n - 69) / 12);

let NOISE = null; // one shared 1 s noise buffer per context, read at random offsets
function shared(ctx) {
  const b = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const d = b.getChannelData(0);
  const r = rng(99);
  for (let i = 0; i < d.length; i++) d[i] = r() * 2 - 1;
  NOISE = b;
}

function env(ctx, t, peak, attack, decay) {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  return g;
}
function filt(ctx, type, f, q = 0.707, gainDb = 0) {
  const b = ctx.createBiquadFilter();
  b.type = type;
  b.frequency.value = f;
  b.Q.value = q;
  b.gain.value = gainDb;
  return b;
}
function noise(ctx, t, dur, r) {
  const s = ctx.createBufferSource();
  s.buffer = NOISE;
  s.start(t, r() * 0.8, dur + 0.02);
  return s;
}

/* ------------------------------------------------------------- the recipes */
// Wood: an exciter burst ringing four free-free bar modes (1 : 2.756 : 5.404 : 8.933).
// The grammar (§3.1): a ringing plank A, B or C always means a seat, so only the seat cues
// may strike one. Plank D is the clock and your own hand. Things landing use the table top.
const MODES = [1, 2.756, 5.404, 8.933];
const AMPS = [1, 0.5, 0.25, 0.12];
const T60 = [0.16, 0.09, 0.045, 0.025];
const PLANK = { A: [180, 1.4], B: [320, 1.0], C: [620, 0.7], D: [1200, 0.45] };
let STRIKES = []; // every wood() call while a cue renders, for the grammar check

function wood(ctx, out, t, { plank = 'B', f0, damping = 0, gain = 1, hard = false, seed = 1 } = {}) {
  STRIKES.push({ plank, damping });
  const r = rng(seed);
  const [pf, size] = PLANK[plank];
  const base = (f0 ?? pf) * (1 + (r() - 0.5) * 0.06);
  const bus = ctx.createGain();
  bus.gain.value = gain;
  const lp = filt(ctx, 'lowpass', 9000 - 7000 * damping);
  bus.connect(lp).connect(out);
  // a hard mallet: a shorter, brighter exciter
  const ex = noise(ctx, t, 0.01, r);
  ex.connect(filt(ctx, 'bandpass', Math.min((hard ? 4 : 2.5) * base, 15000), 1)).connect(env(ctx, t, hard ? 0.9 : 0.6, 0.0005, hard ? 0.002 : 0.004)).connect(bus);
  MODES.forEach((m, i) => {
    const f = base * m * (1 + (r() - 0.5) * 0.02);
    if (f > SR / 2 - 2000) return;
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(f, t);
    const t60 = T60[i] * size * (1 - 0.7 * damping);
    o.connect(env(ctx, t, AMPS[i] * 0.35, 0.001, t60)).connect(bus);
    o.start(t);
    o.stop(t + t60 + 0.05);
  });
}

function bubble(ctx, out, t, f0, life, gain) {
  const o = ctx.createOscillator();
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(f0 * 1.4, t + life);
  o.connect(env(ctx, t, gain * 0.5, 0.002, life)).connect(out);
  o.start(t);
  o.stop(t + life + 0.02);
}

function splash(ctx, out, t, r, gain, f = 2500, dur = 0.12) {
  noise(ctx, t, dur, r).connect(filt(ctx, 'bandpass', f, 0.7)).connect(env(ctx, t, gain, 0.004, dur)).connect(out);
}

function paperSlide(ctx, out, t, dur, gain, r) {
  const bp = filt(ctx, 'bandpass', 2500, 1.2);
  bp.frequency.setValueAtTime(2500, t);
  bp.frequency.exponentialRampToValueAtTime(4500, t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain * 0.5, t + 0.015);
  g.gain.setValueAtTime(gain * 0.5, t + dur - 0.04);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  const am = ctx.createOscillator();
  am.frequency.value = 40 + r() * 40;
  const amg = ctx.createGain();
  amg.gain.value = gain * 0.15;
  am.connect(amg).connect(g.gain);
  am.start(t);
  am.stop(t + dur);
  noise(ctx, t, dur, r).connect(bp).connect(g).connect(out);
}

function paperLift(ctx, out, t, gain, r) {
  noise(ctx, t, 0.03, r).connect(filt(ctx, 'highpass', 3000)).connect(env(ctx, t, gain * 0.4, 0.002, 0.025)).connect(out);
}

// Weight below 150 Hz gets a saturated harmonic layer that phone speakers can play (§3.3).
function harmonics(ctx, source, into, dbGain = -10) {
  const shaper = ctx.createWaveShaper();
  const curve = new Float32Array(1024);
  for (let i = 0; i < 1024; i++) curve[i] = Math.tanh(3 * (i / 511.5 - 1));
  shaper.curve = curve;
  const g = ctx.createGain();
  g.gain.value = fromDb(dbGain);
  source.connect(shaper).connect(g).connect(into);
}

function stamp(ctx, out, t, gain, r) {
  const o = ctx.createOscillator();
  o.frequency.setValueAtTime(110, t);
  o.frequency.exponentialRampToValueAtTime(70, t + 0.06);
  const body = env(ctx, t, gain * 0.8, 0.002, 0.07);
  o.connect(body).connect(out);
  harmonics(ctx, o, body);
  o.start(t);
  o.stop(t + 0.1);
  noise(ctx, t + 0.04, 0.015, r).connect(filt(ctx, 'highpass', 2000)).connect(env(ctx, t + 0.04, gain * 0.2, 0.001, 0.015)).connect(out);
}

// The table top: something landing on the table itself. An unpitched thud with no modal
// ring, so it can never be heard as a seat's plank. Its body sits at 250-700 Hz, where
// phone speakers play; a falling sine adds weight on headphones. Heavier = lower.
function thud(ctx, out, t, gain, r, weight = 1) {
  const f = 125 / weight;
  const o = ctx.createOscillator();
  o.frequency.setValueAtTime(f, t);
  o.frequency.exponentialRampToValueAtTime(f * 0.6, t + 0.05);
  const body = env(ctx, t, gain * 0.6, 0.002, 0.05);
  o.connect(body).connect(out);
  harmonics(ctx, o, body);
  o.start(t);
  o.stop(t + 0.08);
  noise(ctx, t, 0.04, r).connect(filt(ctx, 'bandpass', 440 / Math.sqrt(weight), 0.9)).connect(env(ctx, t, gain * 0.9, 0.001, 0.035)).connect(out);
}

// A card slapped down: a paper transient on a table-top thud.
function slap(ctx, out, t, gain, r, weight = 1) {
  noise(ctx, t, 0.015, r).connect(filt(ctx, 'bandpass', 2200, 0.9)).connect(env(ctx, t, gain * 0.5, 0.001, 0.012)).connect(out);
  thud(ctx, out, t + 0.003, gain * 0.8, r, weight);
}

// The riffle: 30-45 high-passed clicks, sparse-dense-sparse (accelerando, ritardando).
function riffle(ctx, out, t, dur, gain, r) {
  const n = 30 + Math.floor(r() * 16);
  for (let i = 0; i < n; i++) {
    const u = i / (n - 1);
    const at = t + dur * (0.4 * u + 0.6 * (0.5 + 4 * (u - 0.5) ** 3));
    const g = gain * (0.5 + 0.5 * Math.sin(Math.PI * u)) * (0.7 + 0.3 * r());
    noise(ctx, at, 0.004, r).connect(filt(ctx, 'highpass', 2500 + r() * 1500)).connect(env(ctx, at, g * 0.5, 0.0005, 0.003)).connect(out);
  }
}

function doba(ctx, out, t, gain, r) {
  const o = ctx.createOscillator();
  o.frequency.setValueAtTime(95, t);
  o.frequency.exponentialRampToValueAtTime(52, t + 0.12);
  const body = env(ctx, t, gain * 0.9, 0.003, 0.55);
  o.connect(body).connect(out);
  harmonics(ctx, o, body);
  o.start(t);
  o.stop(t + 0.6);
  noise(ctx, t, 0.03, r).connect(filt(ctx, 'bandpass', 500, 0.8)).connect(env(ctx, t, gain * 0.4, 0.001, 0.03)).connect(out);
}

// Tulnic: harmonics 1-8 at -6 dB/octave, low-passed at 900 Hz, a 200 ms attack.
function tulnic(ctx, out, t0, note, d, gain = 1) {
  const e = ctx.createGain();
  e.gain.setValueAtTime(0.0001, t0);
  e.gain.exponentialRampToValueAtTime(0.25 * gain, t0 + 0.2);
  e.gain.setValueAtTime(0.25 * gain, t0 + d - 0.3);
  e.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
  const lp = filt(ctx, 'lowpass', 900);
  lp.connect(e).connect(out);
  for (let h = 1; h <= 8; h++) {
    const osc = ctx.createOscillator();
    osc.frequency.value = midi(note) * h;
    const g = ctx.createGain();
    g.gain.value = 1 / h;
    osc.connect(g).connect(lp);
    osc.start(t0);
    osc.stop(t0 + d);
  }
}

// Drâmbă (jaw harp): a 10 %-duty pulse at 98 Hz through two swept band-pass formants,
// the lower one wobbling at 6 Hz.
function dramba(ctx, out, t, dur, gain, sweep = [450, 1300]) {
  const N = 48;
  const real = new Float32Array(N), imag = new Float32Array(N);
  for (let k = 1; k < N; k++) real[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * 0.1);
  const o = ctx.createOscillator();
  o.setPeriodicWave(ctx.createPeriodicWave(real, imag));
  o.frequency.value = 98;
  const e = ctx.createGain();
  e.gain.setValueAtTime(0.0001, t);
  e.gain.exponentialRampToValueAtTime(gain, t + 0.01);
  e.gain.setValueAtTime(gain, t + Math.max(0.02, dur - 0.06));
  e.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  e.connect(out);
  const f1 = filt(ctx, 'bandpass', sweep[0], 5);
  const f2 = filt(ctx, 'bandpass', sweep[1], 7);
  f1.frequency.setValueAtTime(sweep[0], t);
  f1.frequency.exponentialRampToValueAtTime(sweep[0] * 1.8, t + dur);
  f2.frequency.setValueAtTime(sweep[1], t);
  f2.frequency.exponentialRampToValueAtTime(sweep[1] * 1.5, t + dur);
  const wob = ctx.createOscillator();
  wob.frequency.value = 6;
  const wg = ctx.createGain();
  wg.gain.value = sweep[0] * 0.25;
  wob.connect(wg).connect(f1.frequency);
  o.connect(f1).connect(e);
  o.connect(f2).connect(e);
  o.start(t);
  o.stop(t + dur + 0.02);
  wob.start(t);
  wob.stop(t + dur + 0.02);
}

// Breath: fluier (and caval an octave down) — three partials, breath noise, scoop, vibrato.
function breath(ctx, out, t, note, dur, { gain = 1, octave = 0, breathDb = -18 } = {}) {
  const f = midi(note + 12 * octave);
  const e = ctx.createGain();
  e.gain.setValueAtTime(0.0001, t);
  e.gain.exponentialRampToValueAtTime(gain * 0.3, t + 0.05);
  e.gain.setValueAtTime(gain * 0.3, t + Math.max(0.06, dur - 0.12));
  e.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  e.connect(out);
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 5.5;
  const depth = ctx.createGain();
  depth.gain.setValueAtTime(0, t);
  depth.gain.setValueAtTime(0, t + 0.15);
  depth.gain.linearRampToValueAtTime(12, t + 0.35);
  lfo.connect(depth);
  lfo.start(t);
  lfo.stop(t + dur);
  [
    [1, 1],
    [2, fromDb(-14)],
    [3, fromDb(-20)],
  ].forEach(([h, a]) => {
    if (f * h > SR / 2 - 2000) return;
    const o = ctx.createOscillator();
    o.frequency.value = f * h;
    o.detune.setValueAtTime(-30, t);
    o.detune.linearRampToValueAtTime(0, t + 0.05);
    depth.connect(o.detune);
    const g = ctx.createGain();
    g.gain.value = a;
    o.connect(g).connect(e);
    o.start(t);
    o.stop(t + dur + 0.02);
  });
  const n = ctx.createBufferSource();
  n.buffer = NOISE;
  n.loop = true;
  const b1 = filt(ctx, 'bandpass', f, 8);
  const b2 = filt(ctx, 'bandpass', 3000, 1);
  const g1 = ctx.createGain();
  g1.gain.value = fromDb(breathDb) * 6;
  const g2 = ctx.createGain();
  g2.gain.value = fromDb(breathDb - 8) * 2;
  n.connect(b1).connect(g1).connect(e);
  n.connect(b2).connect(g2).connect(e);
  n.start(t);
  n.stop(t + dur + 0.02);
}

// Strings: Karplus-Strong computed in JS (a DelayNode in a feedback cycle is clamped
// to one 128-frame render quantum, so a native loop cannot sound above ~375 Hz).
function ksBuffer(ctx, f, seconds, seed) {
  const sr = ctx.sampleRate;
  const len = Math.floor(seconds * sr);
  const out = new Float32Array(len);
  const r = rng(seed);
  for (const cents of [-4, 0, 4]) {
    const ff = f * 2 ** (cents / 1200);
    const N = Math.max(2, Math.round(sr / ff));
    const buf = new Float32Array(N);
    let prev = 0;
    for (let i = 0; i < N; i++) {
      prev += 0.35 * (r() * 2 - 1 - prev);
      buf[i] = prev;
    }
    let idx = 0;
    for (let n = 0; n < len; n++) {
      const a = buf[idx];
      buf[idx] = 0.996 * 0.5 * (a + buf[(idx + 1) % N]);
      out[n] += a / 3;
      idx = (idx + 1) % N;
    }
  }
  const b = ctx.createBuffer(1, len, sr);
  b.copyToChannel(out, 0);
  return b;
}
function playBuffer(ctx, out, t, buffer, gain) {
  const s = ctx.createBufferSource();
  s.buffer = buffer;
  const g = ctx.createGain();
  g.gain.value = gain;
  s.connect(g).connect(out);
  s.start(t);
}
// Sustained sources are carved for speech: a -6 dB bell at 2 kHz and a 7 kHz low-pass.
function carve(ctx, out) {
  const bell = filt(ctx, 'peaking', 2000, 0.7, -6);
  bell.connect(filt(ctx, 'lowpass', 7000)).connect(out);
  return bell;
}

/* ----------------------------------------------------------------- the cues */
// Each cue: (ctx, out, seed) => length in seconds. Class 'T' = transient, 'S' = sustained.
// Seat signatures (v3): identity is carried by plank size (low A, middle B, high C — three
// categories anyone can tell apart) times knock count (one or two), not by absolute pitch.
const SIGNATURE = [['A', 1], ['B', 1], ['C', 1], ['A', 2], ['B', 2], ['C', 2]];
function signature(c, o, t, seat, s, gain = 1) {
  const [plank, knocks] = SIGNATURE[seat % 6];
  for (let k = 0; k < knocks; k++) wood(c, o, t + k * 0.075, { plank, gain: gain * (k ? 0.8 : 1), seed: s + k });
}
// The only cues allowed to strike plank A, B or C (the grammar check in runSketch).
const SEAT_CUES = new Set(['table.turn', 'table.turn.you', 'table.ask']);
const CUES = {
  'table.turn': ['T', 0.3, (c, o, s) => signature(c, o, 0.01, 4, s)],
  'table.turn.you': ['T', 0.45, (c, o, s) => {
    signature(c, o, 0.01, 0, s);
    wood(c, o, 0.13, { plank: 'D', gain: 0.8, seed: s + 7 });
  }],
  // the ask: the arrow-chip's short paper flick, then it lands on the target's post
  'table.ask': ['T', 0.3, (c, o, s) => {
    paperLift(c, o, 0.01, 0.5, rng(s));
    signature(c, o, 0.08, 1, s);
  }],
  'table.bonus': ['T', 0.25, (c, o, s) => {
    wood(c, o, 0.005, { plank: 'D', seed: s });
    wood(c, o, 0.075, { plank: 'D', f0: PLANK.D[0] * 1.12, seed: s + 1 });
  }],
  'table.flight': ['T', 0.35, (c, o, s) => paperSlide(c, o, 0.005, 0.26, 0.45, rng(s))],
  // the target's own device as their plank rises: knock, knock
  'table.asked': ['T', 0.3, (c, o, s) => {
    wood(c, o, 0.01, { plank: 'D', seed: s });
    wood(c, o, 0.1, { plank: 'D', seed: s + 1 });
  }],
  // the answering device, any answer: a small ink stamp and a plank D tap — it is recorded
  'table.answer': ['T', 0.2, (c, o, s) => {
    stamp(c, o, 0.01, 0.8, rng(s));
    wood(c, o, 0.01, { plank: 'D', gain: 0.5, seed: s });
  }],
  // every device, when RESPONSE_PENDING leaves the view: the plank lowered onto the table
  'clock.close': ['T', 0.2, (c, o, s) => {
    const r = rng(s);
    paperLift(c, o, 0.005, 0.35, r);
    thud(c, o, 0.02, 0.8, r, 0.9);
  }],
  'table.give': ['T', 0.6, (c, o, s, sp) => {
    const r = rng(s);
    paperSlide(c, o, 0.01, sp ? 0.15 : 0.28, 0.8, r);
    thud(c, o, sp ? 0.16 : 0.3, 1.0, r, 1.3);
  }],
  'table.gofish': ['T', 0.5, (c, o, s) => {
    const r = rng(s);
    bubble(c, o, 0.01, 430 + r() * 60, 0.08, 1);
    const n = 2 + Math.floor(r() * 3);
    for (let i = 0; i < n; i++) bubble(c, o, 0.02 + r() * 0.06, 900 + r() * 700, 0.04, 0.4);
    splash(c, o, 0.015, r, 0.2);
  }],
  // v3: neutral and brief — a dull knock on the dry basin floor and a short skid, no joke
  'table.gofish.dry': ['T', 0.4, (c, o, s) => {
    thud(c, o, 0.01, 0.9, rng(s), 1.1);
    [0.07, 0.11, 0.16].forEach((dt, i) => wood(c, o, dt, { plank: 'D', damping: 0.4, gain: 0.35 - i * 0.08, seed: s + 10 + i }));
  }],
  'table.draw': ['T', 0.3, (c, o, s) => {
    const r = rng(s);
    bubble(c, o, 0.01, 1900 + r() * 700, 0.035, 0.5);
    paperLift(c, o, 0.03, 0.9, r);
  }],
  // three cards slapped down, each heavier, then the ink stamp
  'table.lay': ['T', 0.75, (c, o, s, sp) => {
    const r = rng(s);
    const k = sp ? [0.01, 0.06, 0.11, 0.16] : [0.01, 0.13, 0.25, 0.38];
    [0, 1, 2].forEach((i) => slap(c, o, k[i], 1, r, 1 + 0.3 * i));
    stamp(c, o, k[3], 0.9, r);
  }],
  'clock.tick': ['T', 0.12, (c, o, s) => wood(c, o, 0.005, { plank: 'D', seed: s })],
  // urgency is density and a harder mallet, not pitch or level
  'clock.tick.urgent': ['T', 0.12, (c, o, s) => wood(c, o, 0.005, { plank: 'D', hard: true, seed: s })],
  'power.granted': ['S', 1.5, (c, o, s, sp) => {
    const k = carve(c, o);
    if (sp) {
      // speaker cut: the strings struck and damped by hand at 180 ms, no swell
      const damp = c.createGain();
      damp.gain.setValueAtTime(1, 0.01);
      damp.gain.setValueAtTime(1, 0.16);
      damp.gain.exponentialRampToValueAtTime(0.001, 0.22);
      damp.connect(k);
      playBuffer(c, damp, 0.01, ksBuffer(c, midi(74), 0.3, s), 0.9);
      playBuffer(c, damp, 0.04, ksBuffer(c, midi(81), 0.3, s + 1), 0.6);
      return;
    }
    playBuffer(c, k, 0.01, ksBuffer(c, midi(74), 1.4, s), 0.9);
    playBuffer(c, k, 0.06, ksBuffer(c, midi(81), 1.3, s + 1), 0.6);
    const sw = c.createOscillator();
    sw.frequency.value = midi(50);
    sw.connect(env(c, 0.01, 0.25, 0.3, 1.0)).connect(k);
    sw.start(0.01);
    sw.stop(1.4);
  }],
  'power.used.lanternfish': ['S', 1.1, (c, o, s, sp) => {
    const k = carve(c, o);
    const notes = sp ? [81, 83] : [81, 83, 84, 83, 81];
    notes.forEach((n, i) => breath(c, k, 0.01 + i * (sp ? 0.11 : 0.15), n, sp ? 0.12 : i === 4 ? 0.32 : 0.16));
  }],
  'power.used.whale': ['S', 1.2, (c, o, s, sp) => {
    const k = carve(c, o);
    breath(c, k, 0.01, 71, sp ? 0.12 : 0.5, { octave: -1, breathDb: -12, gain: 1.2 });
    breath(c, k, sp ? 0.12 : 0.52, 62, sp ? 0.14 : 0.62, { octave: -1, breathDb: -12, gain: 1.2 });
  }],
  // the club lands on the table top, the shell cracks, plank D splinters
  'power.mantis': ['T', 0.8, (c, o, s) => {
    const r = rng(s);
    thud(c, o, 0.01, 1.4, r, 1.6);
    splash(c, o, 0.01, r, 0.5, 3000, 0.05);
    [0.07, 0.1, 0.14, 0.19, 0.26].forEach((dt, i) => wood(c, o, dt, { plank: 'D', damping: 0.2, gain: 0.6 - i * 0.08, seed: s + 20 + i }));
  }],
  // a dobă hit, a water rush, the jaw snapping shut on plank D
  'power.shark': ['T', 0.8, (c, o, s, sp) => {
    const r = rng(s);
    doba(c, o, 0.01, 1, r);
    const lp = filt(c, 'lowpass', 400);
    lp.frequency.setValueAtTime(400, 0.02);
    lp.frequency.exponentialRampToValueAtTime(4000, sp ? 0.18 : 0.3);
    noise(c, 0.02, sp ? 0.18 : 0.3, r).connect(lp).connect(env(c, 0.02, 0.35, 0.04, sp ? 0.14 : 0.25)).connect(o);
    wood(c, o, sp ? 0.12 : 0.3, { plank: 'D', hard: true, seed: s });
    wood(c, o, sp ? 0.15 : 0.33, { plank: 'D', hard: true, seed: s + 1 });
  }],
  // drâmbă through a sweeping formant, then the bell stamp brands the plate
  'power.jellyfish': ['S', 0.9, (c, o, s, sp) => {
    const r = rng(s);
    dramba(c, carve(c, o), 0.01, sp ? 0.15 : 0.5, 1);
    stamp(c, o, sp ? 0.15 : 0.5, 1, r);
  }],
  // a tulnic swell, the riffle, the redeal; the speaker cut keeps the riffle and one landing
  'power.whale': ['S', 1.6, (c, o, s, sp) => {
    const r = rng(s);
    if (sp) {
      riffle(c, o, 0.01, 0.17, 1, r);
      slap(c, o, 0.2, 0.9, r, 1.2);
      return;
    }
    tulnic(c, carve(c, o), 0.01, 38, 0.9, 1.2);
    riffle(c, o, 0.35, 0.8, 1, r);
    [1.2, 1.28, 1.36].forEach((t, i) => slap(c, o, t, 0.8, r, 1 + 0.1 * i));
  }],
  // the tulnic calls the table: two long rising notes
  'mus.start': ['S', 2.6, (c, o) => {
    const k = carve(c, o);
    tulnic(c, k, 0.02, 43, 1.1);
    tulnic(c, k, 1.15, 50, 1.35);
  }],
};

/* ------------------------------------------------------------------ metering */
// BS.1770 K-weighting at 48 kHz: a high shelf, then the RLB high-pass.
function kWeight(x) {
  const stages = [
    [1.53512485958697, -2.69169618940638, 1.19839281085285, -1.69065929318241, 0.73248077421585],
    [1.0, -2.0, 1.0, -1.99004745483398, 0.99007225036621],
  ];
  let y = x;
  for (const [b0, b1, b2, a1, a2] of stages) {
    const out = new Float32Array(y.length);
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    for (let n = 0; n < y.length; n++) {
      const v = b0 * y[n] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
      x2 = x1; x1 = y[n]; y2 = y1; y1 = v;
      out[n] = v;
    }
    y = out;
  }
  return y;
}
const lufsOf = (ms) => -0.691 + 10 * Math.log10(Math.max(ms, 1e-12));
function meanSquare(k, a, b) {
  let s = 0;
  for (let i = a; i < b; i++) s += k[i] * k[i];
  return s / Math.max(1, b - a);
}
function measure(x) {
  const k = kWeight(x);
  let peak = 0;
  for (const v of x) peak = Math.max(peak, Math.abs(v));
  // active span: from the first sample above -60 dB of peak to the last
  const thr = peak * 1e-3;
  let a = 0, b = x.length - 1;
  while (a < b && Math.abs(x[a]) < thr) a++;
  while (b > a && Math.abs(x[b]) < thr) b--;
  const win = Math.floor(0.4 * SR), hop = Math.floor(0.1 * SR);
  let momentary = -Infinity;
  for (let i = 0; i + win <= k.length; i += hop) momentary = Math.max(momentary, lufsOf(meanSquare(k, i, i + win)));
  if (k.length < win) momentary = lufsOf(meanSquare(k, 0, k.length) * (k.length / win));
  const q = Math.floor(0.25 * SR);
  const head = meanSquare(x, a, Math.min(a + q, b + 1)) * Math.min(q, b + 1 - a);
  const tail = b + 1 - (a + q) > 0 ? meanSquare(x, a + q, b + 1) * (b + 1 - (a + q)) : 0;
  return {
    peakDb: db(peak),
    activeMs: ((b - a) / SR) * 1000,
    activeLufs: lufsOf(meanSquare(k, a, b + 1)),
    momentaryMax: momentary,
    tailVsHeadDb: tail > 0 ? 10 * Math.log10(tail / head) : -Infinity,
  };
}
function integrated(x) {
  const k = kWeight(x);
  const win = Math.floor(0.4 * SR), hop = Math.floor(0.1 * SR);
  const blocks = [];
  for (let i = 0; i + win <= k.length; i += hop) blocks.push(meanSquare(k, i, i + win));
  const abs = blocks.filter((m) => lufsOf(m) > -70);
  const avgAbs = abs.reduce((s, m) => s + m, 0) / abs.length;
  const rel = abs.filter((m) => lufsOf(m) > lufsOf(avgAbs) - 10);
  return lufsOf(rel.reduce((s, m) => s + m, 0) / rel.length);
}
function truePeakDb(x) {
  // 4x oversampling by windowed-sinc interpolation, enough to see inter-sample peaks
  let peak = 0;
  const taps = 16;
  for (let n = taps; n < x.length - taps; n++) {
    peak = Math.max(peak, Math.abs(x[n]));
    for (const frac of [0.25, 0.5, 0.75]) {
      let v = 0;
      for (let k = -taps + 1; k <= taps; k++) {
        const d = k - frac;
        const w = 0.5 + 0.5 * Math.cos((Math.PI * d) / taps);
        v += x[n + k] * (d === 0 ? 1 : Math.sin(Math.PI * d) / (Math.PI * d)) * w;
      }
      peak = Math.max(peak, Math.abs(v));
    }
  }
  return db(peak);
}

/* ------------------------------------------------------------------ rendering */
async function renderCue(name, seed = 1, speaker = false) {
  const [, len, fn] = CUES[name];
  const ctx = new OfflineAudioContext(1, Math.ceil(len * SR), SR);
  shared(ctx);
  fn(ctx, ctx.destination, seed, speaker);
  const buf = await ctx.startRendering();
  return buf.getChannelData(0).slice();
}

// Class normalisation (§3.3): transients by K-weighted level over their active span,
// sustained cues by their maximum momentary loudness.
const CLASS_TARGET = { T: -20, S: -23 };
function normGain(name, x) {
  const m = measure(x);
  const cls = CUES[name][0];
  return fromDb(CLASS_TARGET[cls] - (cls === 'T' ? m.activeLufs : m.momentaryMax));
}

// The echo budget (§3.4) is met by design, per cue: the speaker variants are measured
// without this fade. It is only the runtime safety net: anything left after 250 ms fades
// to silence by 400 ms.
function speakerFade(x) {
  const y = x.slice();
  let a = 0;
  let peak = 0;
  for (const v of x) peak = Math.max(peak, Math.abs(v));
  while (a < y.length && Math.abs(y[a]) < peak * 1e-3) a++;
  const start = a + Math.floor(0.25 * SR), end = a + Math.floor(0.4 * SR);
  for (let i = start; i < y.length; i++) y[i] *= i < end ? 0.5 + 0.5 * Math.cos((Math.PI * (i - start)) / (end - start)) : 0;
  return y;
}

// Levels from the cue sheet (Appendix D): bus + cue, dB. UI and Clock get +4 dB on speakers.
const BUS = { UI: -10, Table: 0, Power: 1, Clock: -8, Ambience: -26, Music: -2 };
const LEVEL = {
  'table.turn': ['Table', -6], 'table.turn.you': ['Table', -2], 'table.ask': ['Table', -4], 'table.answer': ['UI', -4],
  'table.asked': ['Table', -2], 'table.give': ['Table', -2], 'table.gofish': ['Table', 0], 'table.gofish.dry': ['Table', -2],
  'table.draw': ['Table', -6], 'table.lay': ['Table', 0], 'clock.tick': ['Clock', -2], 'clock.tick.urgent': ['Clock', 0],
  'power.granted': ['Power', -2], 'power.used.lanternfish': ['Power', 0], 'power.used.whale': ['Power', 0],
  'power.mantis': ['Power', 2], 'power.shark': ['Power', 2], 'power.jellyfish': ['Power', 0], 'power.whale': ['Power', 1],
  'mus.start': ['Music', 0], 'table.bonus': ['Table', -4], 'table.flight': ['Table', -10], 'clock.close': ['Clock', -2],
};

// A human-paced scene at a five-player table, heard from seat 0, with every frequent cue:
// asks after a lognormal think (median 6 s, 2-15 s), answers after a lognormal hold
// (median 2.5 s, at most the 12 s window),
// the answer window's close on every answer, ticks once a second from 7 s and twice a
// second in the last 3 s, and — when seat 0 is the one asked — its own asked and answer cues.
function scenePlan(seconds, seed) {
  const r = rng(seed);
  const who = rng(seed + 101); // who is asked: its own stream, so the rest of the scene is unchanged
  const logn = (median, sigma) => median * Math.exp(sigma * Math.sqrt(-2 * Math.log(r() || 1e-9)) * Math.cos(2 * Math.PI * r()));
  const plan = [['mus.start', 0.5]];
  let t = 4;
  let turn = 1;
  let bonus = false;
  while (t < seconds - 6) {
    const mine = turn % 5 === 0;
    if (!bonus) plan.push([mine ? 'table.turn.you' : 'table.turn', t]);
    bonus = false;
    t += Math.min(Math.max(logn(6, 0.5), 2), 15);
    plan.push(['table.ask', t]);
    const others = [0, 1, 2, 3, 4].filter((p) => p !== turn % 5);
    const toMe = others[Math.floor(who() * others.length)] === 0;
    t += 0.32;
    if (toMe) plan.push(['table.asked', t]);
    const hold = Math.min(logn(2.5, 0.5), 12);
    for (let k = 7; k < hold; k += k >= 9 ? 0.5 : 1) plan.push([k >= 9 ? 'clock.tick.urgent' : 'clock.tick', t + k]);
    t += hold;
    if (toMe) plan.push(['table.answer', t - 0.08]);
    plan.push(['clock.close', t]);
    const roll = r();
    if (roll < 0.35) {
      plan.push(['table.flight', t + 0.1]);
      plan.push(['table.give', t + 0.45]);
      plan.push(['table.bonus', t + 0.62]);
      bonus = true;
      if (r() < 0.25) plan.push(['table.lay', t + 1.4]);
    } else if (roll < 0.75) {
      plan.push(['table.gofish', t + 0.3]);
      plan.push(['table.draw', t + 0.6]);
    } else {
      plan.push(['table.gofish.dry', t + 0.3]);
    }
    t += 1.0;
    if (r() < 0.07) {
      plan.push(['power.used.lanternfish', t]);
      plan.push(['power.mantis', t + 0.9]);
      t += 2;
    }
    turn++;
  }
  return plan.filter(([, at]) => at < seconds); // only what the scene contains
}

// The corrected master chain (v3): profile EQ -> [speaker: densifier] -> program gain ->
// glue -> limiter -> soft clip at -1 dBFS -> destination. The user's volume would follow,
// and only ever attenuates. v2 put the calibration gain after the limiter, which clipped.
function masterChain(ctx, profile, programDb) {
  const eq = profile === 'speaker' ? [filt(ctx, 'highpass', 150), filt(ctx, 'highshelf', 3000, 0.707, 2)] : [filt(ctx, 'highpass', 30)];
  eq.reduce((a, b) => (a.connect(b), b));
  let tail = eq[eq.length - 1];
  if (profile === 'speaker') {
    // struck wood has a ~22 dB peak-to-loudness ratio; phone speakers need it denser
    const sat = ctx.createWaveShaper();
    const curve = new Float32Array(2048);
    for (let i = 0; i < 2048; i++) { const x = i / 1023.5 - 1; curve[i] = Math.tanh(2.2 * x) / Math.tanh(2.2); }
    sat.curve = curve;
    sat.oversample = '4x';
    const pre = ctx.createGain(); pre.gain.value = fromDb(-6);
    const post = ctx.createGain(); post.gain.value = fromDb(6);
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -26; comp.ratio.value = 4; comp.knee.value = 6; comp.attack.value = 0.001; comp.release.value = 0.06;
    tail.connect(pre).connect(sat).connect(post).connect(comp);
    tail = comp;
  }
  const program = ctx.createGain();
  program.gain.value = fromDb(programDb);
  const glue = ctx.createDynamicsCompressor();
  glue.threshold.value = -20; glue.ratio.value = 3; glue.knee.value = 6; glue.attack.value = 0.005; glue.release.value = 0.12;
  const lim = ctx.createDynamicsCompressor();
  lim.threshold.value = -4; lim.ratio.value = 20; lim.knee.value = 0; lim.attack.value = 0; lim.release.value = 0.05;
  const clip = ctx.createWaveShaper();
  const c = fromDb(-1);
  const cc = new Float32Array(4096);
  for (let i = 0; i < 4096; i++) { const x = (i / 2047.5 - 1) * 2; cc[i] = Math.abs(x) < 0.5 * c ? x : Math.sign(x) * (0.5 * c + 0.5 * c * Math.tanh((Math.abs(x) - 0.5 * c) / (0.5 * c))); }
  clip.curve = cc;
  clip.oversample = '4x';
  const inG = ctx.createGain(); inG.gain.value = 0.5; // the clip curve spans +-2
  const outG = ctx.createGain(); outG.gain.value = 1; // the curve already returns full-scale values
  tail.connect(program).connect(glue).connect(lim).connect(inG).connect(clip).connect(outG).connect(ctx.destination);
  // The Clock bus skips the densifier and the glue so ticks keep a steady level whatever
  // else is sounding; it meets the rest of the mix only at the limiter.
  const clockEq = filt(ctx, 'highpass', profile === 'speaker' ? 150 : 30);
  const clockProgram = ctx.createGain();
  clockProgram.gain.value = fromDb(programDb);
  clockEq.connect(clockProgram).connect(lim);
  return { pre: eq[0], clock: clockEq };
}

function place(ctx, chain, bank, name, t, profile) {
  const [bus, lvl] = LEVEL[name];
  const boost = profile === 'speaker' && (bus === 'Clock' || bus === 'UI') ? 4 : 0;
  const src = ctx.createBufferSource();
  src.buffer = profile === 'speaker' && name !== 'mus.start' ? bank[name].cut : bank[name].full;
  const g = ctx.createGain();
  g.gain.value = (profile === 'speaker' ? bank[name].normCut : bank[name].norm) * fromDb(BUS[bus] + lvl + boost);
  src.connect(g).connect(bus === 'Clock' ? chain.clock : chain.pre);
  src.start(t);
}

const SCENE = 180; // three minutes, so one long think cannot skew the measurement
async function renderScene(profile, bank, seconds = SCENE, programDb = 0) {
  const ctx = new OfflineAudioContext(1, seconds * SR, SR);
  shared(ctx);
  const chain = masterChain(ctx, profile, programDb);
  // the pond bed, generated live: looped noise through a slowly drifting low-pass, and a
  // drip from the water recipe every few seconds
  const bed = ctx.createBufferSource();
  bed.buffer = NOISE;
  bed.loop = true;
  const lp = filt(ctx, 'lowpass', 600);
  const drift = ctx.createOscillator();
  drift.frequency.value = 0.05;
  const depth = ctx.createGain();
  depth.gain.value = 150;
  drift.connect(depth).connect(lp.frequency);
  drift.start(0);
  const bedG = ctx.createGain();
  bedG.gain.value = fromDb(BUS.Ambience + 6);
  bed.connect(lp).connect(bedG).connect(chain.pre);
  bed.start(0);
  const dripG = ctx.createGain();
  dripG.gain.value = fromDb(BUS.Ambience + 10);
  dripG.connect(chain.pre);
  const dr = rng(5);
  for (let at = 2 + dr() * 4; at < seconds; at += 3 + dr() * 5) bubble(ctx, dripG, at, 1800 + dr() * 800, 0.04, 1);
  for (const [name, t] of scenePlan(seconds, 7)) place(ctx, chain, bank, name, t, profile);
  const out = await ctx.startRendering();
  return out.getChannelData(0).slice();
}

async function renderBurst(profile, bank, programDb) {
  // six cues landing within 50 ms: the loudest pile-up the table can make
  const ctx = new OfflineAudioContext(1, 2 * SR, SR);
  shared(ctx);
  const chain = masterChain(ctx, profile, programDb);
  ['power.mantis', 'power.shark', 'table.gofish', 'table.give', 'table.lay', 'clock.tick.urgent'].forEach((name, i) => place(ctx, chain, bank, name, 0.1 + i * 0.01, profile));
  const out = await ctx.startRendering();
  return out.getChannelData(0).slice();
}

/* ------------------------------------------------------------------ outputs */
// Listening excerpts are halved to 24 kHz (a windowed-sinc low-pass, then every other sample).
function decimate2(x) {
  const taps = 31, h = new Float32Array(taps), mid = (taps - 1) / 2;
  let sum = 0;
  for (let i = 0; i < taps; i++) {
    const d = i - mid;
    h[i] = (d === 0 ? 0.45 : Math.sin(Math.PI * 0.45 * d) / (Math.PI * d)) * (0.54 - 0.46 * Math.cos((2 * Math.PI * i) / (taps - 1)));
    sum += h[i];
  }
  const y = new Float32Array(Math.floor(x.length / 2));
  for (let n = 0; n < y.length; n++) {
    let v = 0;
    for (let i = 0; i < taps; i++) v += (x[2 * n + i - mid] || 0) * h[i];
    y[n] = v / sum;
  }
  return y;
}
function wav(x, sr = SR) {
  const n = x.length;
  const buf = new ArrayBuffer(44 + n * 2);
  const v = new DataView(buf);
  const w = (o, s) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  w(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); w(8, 'WAVE'); w(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, sr, true); v.setUint32(28, sr * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  w(36, 'data'); v.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, x[i])) * 32767, true);
  let s = '';
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    for (let i = 0; i < n; i += len) {
      for (let k = 0; k < len / 2; k++) {
        const wr = Math.cos(ang * k), wi = Math.sin(ang * k);
        const ur = re[i + k], ui = im[i + k];
        const vr = re[i + k + len / 2] * wr - im[i + k + len / 2] * wi;
        const vi = re[i + k + len / 2] * wi + im[i + k + len / 2] * wr;
        re[i + k] = ur + vr; im[i + k] = ui + vi;
        re[i + k + len / 2] = ur - vr; im[i + k + len / 2] = ui - vi;
      }
    }
  }
}

function drawSpectrogram(canvas, x, label, meta) {
  const g = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  g.fillStyle = '#0e2b38';
  g.fillRect(0, 0, W, H);
  const N = 1024, hop = 128, cols = Math.max(1, Math.floor((x.length - N) / hop));
  const plotH = H - 44;
  for (let c = 0; c < cols; c++) {
    const re = new Float32Array(N), im = new Float32Array(N);
    for (let i = 0; i < N; i++) re[i] = (x[c * hop + i] || 0) * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / N));
    fft(re, im);
    const px = Math.floor((c / cols) * W), pw = Math.ceil(W / cols) + 1;
    for (let y = 0; y < plotH; y++) {
      const f = 60 * (18000 / 60) ** (1 - y / plotH); // log frequency, 60 Hz – 18 kHz
      const bin = Math.min(N / 2 - 1, Math.round((f / SR) * N));
      const mag = db(Math.hypot(re[bin], im[bin]) / (N / 4));
      const v = Math.max(0, Math.min(1, (mag + 90) / 80));
      g.fillStyle = `rgb(${Math.round(20 + 225 * v)},${Math.round(40 + 180 * v * v)},${Math.round(56 + 60 * v * v * v)})`;
      g.fillRect(px, y + 24, pw, 1);
    }
  }
  g.fillStyle = '#efe2c8';
  g.font = 'bold 13px sans-serif';
  g.fillText(label, 6, 16);
  g.font = '11px sans-serif';
  g.fillStyle = '#9db3bd';
  g.fillText(meta, 6, H - 8);
}

window.runSketch = async function () {
  const results = { cues: {}, scenes: {}, grammar: [] };
  const bank = {};
  const sheet = document.getElementById('sheet');
  for (const name of Object.keys(CUES)) {
    STRIKES = [];
    const x = await renderCue(name, 3);
    const m = measure(x);
    const design = name === 'mus.start' ? x : await renderCue(name, 3, true);
    const mc = measure(design); // the speaker variant as designed, before the safety fade
    const cut = name === 'mus.start' ? x : speakerFade(design);
    // the grammar (§3.1): only the seat cues may strike plank A, B or C, in either variant
    if (!SEAT_CUES.has(name)) for (const p of new Set(STRIKES.filter((k) => 'ABC'.includes(k.plank)).map((k) => k.plank))) results.grammar.push(`${name} strikes plank ${p}`);
    const norm = normGain(name, x);
    const normCut = normGain(name, cut);
    bank[name] = { full: toBuffer(x), cut: toBuffer(cut), norm, normCut };
    const variants = [];
    for (const s of [11, 12, 13]) variants.push(measure(await renderCue(name, s)).activeLufs);
    const listen = x.map((v) => v * norm);
    let pk = 0;
    for (const v of listen) pk = Math.max(pk, Math.abs(v));
    const safe = pk > fromDb(-1) ? fromDb(-1) / pk : 1;
    results.cues[name] = {
      class: CUES[name][0],
      ...m,
      speakerActiveMs: mc.activeMs,
      speakerTailVsHeadDb: mc.tailVsHeadDb,
      normDb: db(norm),
      variantSpreadDb: Math.max(...variants) - Math.min(...variants),
      wav: wav(listen.map((v) => v * safe)),
    };
    const cv = document.createElement('canvas');
    cv.width = 300;
    cv.height = 170;
    sheet.appendChild(cv);
    drawSpectrogram(cv, x, name, `${m.activeMs.toFixed(0)} ms · tail ${Number.isFinite(m.tailVsHeadDb) ? m.tailVsHeadDb.toFixed(0) + ' dB' : '—'} · speaker ${mc.activeMs.toFixed(0)} ms`);
  }
  // the six seat signatures, one after another, for listening (§3.1)
  {
    const ctx = new OfflineAudioContext(1, Math.ceil(3.2 * SR), SR);
    shared(ctx);
    for (let seat = 0; seat < 6; seat++) signature(ctx, ctx.destination, 0.1 + seat * 0.5, seat, 40 + seat);
    const x = (await ctx.startRendering()).getChannelData(0).slice();
    let pk = 0;
    for (const v of x) pk = Math.max(pk, Math.abs(v));
    results.seats = wav(x.map((v) => (v * fromDb(-3)) / pk));
  }
  const plan = scenePlan(SCENE, 7).filter(([n]) => n !== 'mus.start');
  const perMin = (k) => Math.round((k / SCENE) * 60 * 10) / 10;
  results.cuesPerMinute = {
    all: perMin(plan.length),
    table: perMin(plan.filter(([n]) => n.startsWith('table.')).length),
    clock: perMin(plan.filter(([n]) => n.startsWith('clock.')).length),
    power: perMin(plan.filter(([n]) => n.startsWith('power.')).length),
    asks: perMin(plan.filter(([n]) => n === 'table.ask').length),
  };
  // the listening excerpt: the busiest 12 s of the scene
  let excerpt = 0;
  for (const [, at] of plan) {
    const from = Math.max(0, at - 0.5);
    if (from + 12 > SCENE) break;
    const busy = (a) => plan.filter(([, u]) => u >= a && u < a + 12).length;
    if (busy(from) > busy(excerpt)) excerpt = from;
  }
  results.excerptFrom = excerpt;
  for (const [profile, target] of [['speaker', -18], ['headphones', -23]]) {
    let programDb = 0;
    let x = await renderScene(profile, bank, SCENE, programDb);
    for (let pass = 0; pass < 4; pass++) {
      programDb += target - integrated(x);
      x = await renderScene(profile, bank, SCENE, programDb);
    }
    const burst = await renderBurst(profile, bank, programDb);
    let shortTermMax = -Infinity;
    const k = kWeight(x), win = 3 * SR;
    for (let i = 0; i + win <= k.length; i += SR / 10) shortTermMax = Math.max(shortTermMax, lufsOf(meanSquare(k, i, i + win)));
    let clipped = 0;
    for (const v of x) if (Math.abs(v) > fromDb(-1.5)) clipped++;
    results.scenes[profile] = {
      target,
      programDb,
      integrated: integrated(x),
      shortTermMax,
      truePeak: truePeakDb(x),
      burstTruePeak: truePeakDb(burst),
      clipShare: clipped / x.length,
      wav: wav(decimate2(x.subarray(Math.round(excerpt * SR), Math.round((excerpt + 12) * SR))), SR / 2),
    };
  }
  return results;

  function toBuffer(x) {
    const b = new AudioBuffer({ length: x.length, sampleRate: SR, numberOfChannels: 1 });
    b.copyToChannel(x, 0);
    return b;
  }
};
