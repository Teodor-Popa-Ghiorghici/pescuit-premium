/* synth.ts - PURE DSP, no Web Audio (MUSIC_PLAN §3.5-§3.6, Appendix B). The background score's two voices:
 *
 *   the hum    a tulnic resting on a fence with its bell to the wind: noise through one narrow two-pole resonator per
 *              sounding partial - a pitch with a slow random grain and no period. Each partial's level wanders +-3 dB on
 *              value noise over absolute server time (knots every 8-25 s, seeded publicly), so the weight shifts between
 *              the chord's notes as a drone breathes, the same on every client and after a rejoin. The grain itself is
 *              seeded per client (`salt`): copies picked up by several phones on one call must not add coherently.
 *   a horn     a legato natural-horn voice for the far calls: ONE lip onset per phrase (a scoop from below and a slow
 *              swell), then every note is a slur - the lip jumps to the next resonance: the pitch moves at once on one
 *              running phase (no click), under a 1.5 dB dip and a lift of breath noise over 30-40 ms, never a frequency glide
 *              (a natural horn cannot sweep between its partials). (A crossfade between the two partials was tried: two
 *              harmonic series 58 Hz apart beat inside it, and the harness measured dips of up to 8.5 dB.) Harmonics <= 8 and under 2 kHz, through a low-pass that opens with the dynamics and
 *              is capped by distance (900 Hz a call, 650 Hz an answer). The lip wanders on a slow random walk; notes sag;
 *              the breath runs out. A far answer in headphones gets the valley's two discrete repeats.
 *
 * Everything is synthesised at ~16 kHz (sr / round(sr / 16000)) and interpolated to the output rate: all of it lives
 * under 2 kHz. `createScoreSynth` is deliberately one self-contained closure - no module-level helpers - so worklet.ts
 * can ship it to the audio thread as source text, and the harness and the tests run the very same function offline.
 *
 * Messages carry OUTPUT frames (the AudioWorklet's `currentFrame`); the synth is sample-accurate on its internal grid.
 */

export interface ScoreNote {
  p: number;
  d: number;
  sag: number;
  trim: number;
}

export type SynthMessage =
  /** maps output frames to server ms (for the hum's wander, which follows absolute time); sent again whenever it drifts */
  | { type: 'clock'; frame: number; serverMs: number }
  /** the public seed and the score clock's zero (the wander's knots start there); the per-client grain salt */
  | { type: 'seed'; seed: number; zero: number; salt: number }
  /** the hum's partials and their linear gains, reached by a linear ramp of `rampS` from `frame` (a 25 ms cut or a swell) */
  | { type: 'hum'; frame: number; partials: Array<[number, number]>; rampS: number }
  /** one phrase of the horn */
  | {
      type: 'phrase';
      frame: number;
      notes: ScoreNote[];
      /** the take's ornaments */
      scoopCents: number;
      sagScale: number;
      extraTrimMs: number;
      /** linear gain, the distance low-pass cap, the pan (-1..1), the lip's level (dB) and its unsteadiness (1 = the call's) */
      gain: number;
      lpHz: number;
      pan: number;
      lipDb: number;
      wobble: number;
      /** the valley's discrete repeats (headphones answers only): seconds after the phrase starts, dB, low-pass Hz */
      repeats: Array<{ at: number; db: number; lpHz: number }>;
      seed: number;
      /** a tag the caller can recognise the voice by (the slot index) */
      tag: number;
    }
  /** a change of state: every phrase in flight with more than 1.5 s left fades over 300 ms; the rest finish */
  | { type: 'cut'; frame: number }
  /** everything stops over `rampS` (the score switched off) */
  | { type: 'silence'; frame: number; rampS: number };

export interface ScoreSynthOptions {
  /** the hum's level and the horn's level, dB: the Score bus sets the whole; these set the two voices against each other */
  humDb: number;
  hornDb: number;
  /** the hum's resonator bandwidth, Hz (MUSIC_PLAN tries 1-3 Hz by ear) */
  bandwidthHz: number;
  /** how far each partial's level wanders either way, dB (the harness measures the voicing at its centre with 0) */
  wanderDb: number;
}

export const SYNTH_DEFAULTS: ScoreSynthOptions = { humDb: 0, hornDb: 0, bandwidthHz: 3, wanderDb: 3 };

export interface ScoreSynth {
  /** the internal rate, Hz */
  rate: number;
  post(msg: SynthMessage): void;
  /** fills `n` output frames starting at output frame `frame` */
  process(left: Float32Array, right: Float32Array, n: number, frame: number): void;
  /** how many horn voices are sounding (for the lab and the tests) */
  voices(): number;
}

export function createScoreSynth(sampleRate: number, options?: Partial<ScoreSynthOptions>): ScoreSynth {
  const o = { humDb: 0, hornDb: 0, bandwidthHz: 3, wanderDb: 3, ...options };
  const F0 = 58;
  const D = Math.max(1, Math.round(sampleRate / 16000));
  const isr = sampleRate / D;
  const TWO_PI = 2 * Math.PI;
  const dbToLin = (d: number) => Math.pow(10, d / 20);

  /* ---- hashing: a stable 32-bit mix of a few integers, and a small PRNG ---- */
  function mix(a: number, b: number, c: number, d: number): number {
    let h = 0x811c9dc5;
    const parts = [a, b, c, d];
    for (let k = 0; k < 4; k++) {
      h ^= parts[k] | 0;
      h = Math.imul(h, 0x01000193);
      h ^= h >>> 13;
    }
    return (h >>> 0) / 4294967296;
  }
  function prng(seed: number): () => number {
    let t = seed >>> 0;
    return () => {
      t += 0x6d2b79f5;
      let r = Math.imul(t ^ (t >>> 15), t | 1);
      r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ---- biquads (RBJ), direct form I, as flat arrays: [b0 b1 b2 a1 a2 x1 x2 y1 y2] ---- */
  function bq(): Float64Array {
    return new Float64Array(9);
  }
  function setBp(q: Float64Array, f: number, Q: number): void {
    const w = (TWO_PI * f) / isr, alpha = Math.sin(w) / (2 * Q), a0 = 1 + alpha;
    q[0] = alpha / a0; q[1] = 0; q[2] = -alpha / a0; q[3] = (-2 * Math.cos(w)) / a0; q[4] = (1 - alpha) / a0;
  }
  function setLp(q: Float64Array, f: number, Q: number): void {
    const w = (TWO_PI * Math.min(f, isr * 0.45)) / isr, alpha = Math.sin(w) / (2 * Q), c = Math.cos(w), a0 = 1 + alpha;
    q[0] = (1 - c) / 2 / a0; q[1] = (1 - c) / a0; q[2] = (1 - c) / 2 / a0; q[3] = (-2 * c) / a0; q[4] = (1 - alpha) / a0;
  }
  function tick(q: Float64Array, x: number): number {
    const y = q[0] * x + q[1] * q[5] + q[2] * q[6] - q[3] * q[7] - q[4] * q[8];
    q[6] = q[5]; q[5] = x; q[8] = q[7]; q[7] = y;
    return y;
  }

  /* ---- the clock: output frames -> server ms ---- */
  let clockFrame = 0;
  let clockMs = 0;
  let seed = 1;
  let zero = 0;
  let salt = 1;
  const serverMsAt = (outFrame: number) => clockMs + ((outFrame - clockFrame) / sampleRate) * 1000;

  /* ---- the hum: partials 2..12 ---- */
  interface Part {
    p: number;
    b1: number;
    b2: number;
    norm: number;
    y1: number;
    y2: number;
    g: number;
    target: number;
    step: number;
    left: number;
    rnd: () => number;
    /** the wander: the knot the time is in, its start and end (server ms) and values (dB) */
    k: number;
    t0: number;
    t1: number;
    v0: number;
    v1: number;
    wander: number;
  }
  const parts: Part[] = [];
  function knotGap(p: number, k: number): number {
    return 8000 + 17000 * mix(seed, p, k, 0x6b6e);
  }
  function knotValue(p: number, k: number): number {
    return o.wanderDb * (2 * mix(seed, p, k, 0x7661) - 1);
  }
  function resetWander(part: Part, t: number): void {
    // walk the knots from the zero: the same knots on every client, whenever it joined
    let k = 0;
    let t0 = zero;
    let g = knotGap(part.p, 0);
    if (t > t0) {
      while (t0 + g <= t && k < 100000) {
        t0 += g;
        k++;
        g = knotGap(part.p, k);
      }
    }
    part.k = k; part.t0 = t0; part.t1 = t0 + g; part.v0 = knotValue(part.p, k); part.v1 = knotValue(part.p, k + 1);
  }
  function wanderAt(part: Part, t: number): number {
    if (t < part.t0 - 1000 || t > part.t1 + 60000) resetWander(part, t);
    while (t >= part.t1) {
      part.k++;
      part.t0 = part.t1;
      part.t1 = part.t0 + knotGap(part.p, part.k);
      part.v0 = part.v1;
      part.v1 = knotValue(part.p, part.k + 1);
    }
    const x = Math.max(0, Math.min(1, (t - part.t0) / (part.t1 - part.t0)));
    const s = 0.5 - 0.5 * Math.cos(Math.PI * x);
    return dbToLin(part.v0 + (part.v1 - part.v0) * s);
  }
  function makePart(p: number): Part {
    const w = (TWO_PI * F0 * p) / isr;
    const r = Math.exp((-Math.PI * o.bandwidthHz) / isr);
    const b1 = 2 * r * Math.cos(w);
    const b2 = r * r;
    // unit-variance output for unit-variance input: the AR(2) variance, inverted
    const gamma = (1 + b2) / ((1 - b2) * ((1 + b2) * (1 + b2) - b1 * b1));
    // uniform noise in [-1, 1) has variance 1/3
    const norm = 1 / Math.sqrt(gamma / 3);
    const part: Part = { p, b1, b2, norm, y1: 0, y2: 0, g: 0, target: 0, step: 0, left: 0, rnd: prng(Math.imul(salt ^ 0x68756d, 31) + p * 7919), k: 0, t0: 0, t1: 0, v0: 0, v1: 0, wander: 1 };
    resetWander(part, serverMsAt(0));
    return part;
  }
  function partOf(p: number): Part {
    for (let k = 0; k < parts.length; k++) if (parts[k].p === p) return parts[k];
    const part = makePart(p);
    parts.push(part);
    return part;
  }
  const humGain = dbToLin(o.humDb);

  /* ---- the horn voices ---- */
  interface Voice {
    tag: number;
    start: number; // internal sample
    notes: ScoreNote[];
    /** internal sample at which each note starts, relative to the voice */
    starts: number[];
    ends: number;
    releaseEnd: number;
    total: number;
    n: number; // internal samples rendered
    note: number;
    phaseA: number;
    slurAt: number;
    gain: number;
    noteGain: number[];
    lpCap: number;
    panL: number;
    panR: number;
    lipGain: number;
    wobble: number;
    walk: number;
    scoop: number;
    sagScale: number;
    trimCut: number;
    rnd: () => number;
    body: Float64Array;
    bell: Float64Array;
    breath: Float64Array;
    lip: Float64Array;
    inc: number;
    fade: number; // 1 = none; else the multiplier that decays to 0
    fadeStep: number;
    reps: Array<{ delay: number; g: number; a: number; y: number }>;
    ring: Float32Array | null;
    ringPos: number;
    harm: number;
  }
  const voices: Voice[] = [];
  /** a slur's break: the dip and the breath's lift last this long */
  const XFADE_S = 0.03;
  const BREATH_LIFT_S = 0.04;
  // a raised-cosine swell of 200 ms reaches -6 dB at 100 ms: no rise faster than 80 ms to within 6 dB of the peak (#15)
  const ONSET_S = 0.2;
  const RELEASE_S = 0.3;
  const hornGain = dbToLin(o.hornDb);

  function addVoice(m: Extract<SynthMessage, { type: 'phrase' }>, startInternal: number): void {
    if (voices.length >= 2) return; // a call and its answer; never more
    const starts: number[] = [];
    let acc = 0;
    for (let k = 0; k < m.notes.length; k++) {
      starts.push(Math.round(acc * isr));
      acc += m.notes[k].d;
    }
    const last = m.notes[m.notes.length - 1];
    const trimS = (last.trim + (m.extraTrimMs || 0)) / 1000;
    const ends = Math.round(acc * isr);
    const trimCut = trimS > 0 ? Math.round((acc - trimS) * isr) : -1;
    const releaseEnd = trimCut > 0 ? trimCut + Math.round(0.006 * isr) : ends + Math.round(RELEASE_S * isr);
    let maxDelay = 0;
    for (let k = 0; k < m.repeats.length; k++) maxDelay = Math.max(maxDelay, m.repeats[k].at);
    const reps = m.repeats.map((r) => ({ delay: Math.round(r.at * isr), g: dbToLin(r.db), a: 1 - Math.exp((-TWO_PI * r.lpHz) / isr), y: 0 }));
    const total = releaseEnd + Math.round((maxDelay + (reps.length ? 0.4 : 0)) * isr);
    const rnd = prng(m.seed ^ Math.imul(salt, 2654435761));
    const pan = Math.max(-1, Math.min(1, m.pan));
    const ang = ((pan + 1) * Math.PI) / 4;
    const lpCap = Math.min(m.lpHz, 1100);
    const v: Voice = {
      tag: m.tag, start: startInternal, notes: m.notes, starts, ends, releaseEnd, total, n: 0, note: 0,
      phaseA: 0, slurAt: 0, gain: m.gain * hornGain,
      noteGain: m.notes.map(() => dbToLin((rnd() * 2 - 1) * 0.8)),
      lpCap, panL: Math.cos(ang), panR: Math.sin(ang), lipGain: dbToLin(m.lipDb), wobble: m.wobble, walk: 0,
      scoop: m.scoopCents, sagScale: m.sagScale, trimCut, rnd,
      body: bq(), bell: bq(), breath: bq(), lip: bq(), inc: 0, fade: 1, fadeStep: 0,
      reps, ring: reps.length ? new Float32Array(Math.round((maxDelay + 0.1) * isr)) : null, ringPos: 0, harm: 8,
    };
    setLp(v.body, 500, 0.8);
    setBp(v.bell, 380, 1);
    setBp(v.breath, 600, 0.8);
    setBp(v.lip, 420, 1.2);
    voices.push(v);
  }

  /** one internal sample of a voice, mono (before pan); advances it */
  function voiceSample(v: Voice): number {
    const i = v.n;
    let dry = 0;
    if (i < v.releaseEnd) {
      // which note, and the slur into it
      while (v.note + 1 < v.notes.length && i >= v.starts[v.note + 1]) {
        // the lip jumps to the next resonance: the phase runs on (no click, no glide), the pitch moves at once
        v.note++;
        v.slurAt = i;
        v.inc = (TWO_PI * F0 * v.notes[v.note].p * Math.pow(2, v.walk / 1200)) / isr;
      }
      const nt = v.notes[v.note];
      const noteStart = v.starts[v.note];
      const tau = (i - noteStart) / isr;
      const f0 = F0 * nt.p;
      if (i % 16 === 0) {
        v.walk = 0.96 * v.walk + (v.rnd() * 2 - 1) * 1.2 * v.wobble;
        const scoop = v.note === 0 && tau < 0.07 ? -v.scoop * (1 - tau / 0.07) : 0;
        const sag = nt.sag * v.sagScale * Math.pow(Math.min(1, tau / nt.d), 2);
        v.inc = (TWO_PI * f0 * Math.pow(2, (scoop - sag + v.walk) / 1200)) / isr;
        // how many harmonics stay under 2 kHz, at most 8
        v.harm = Math.max(1, Math.min(8, Math.floor(1990 / f0)));
      }
      // the envelope: one swell at the onset, a 3 dB dip across each slur, the release (or the breath cut) at the end
      const t = i / isr;
      let env = t < ONSET_S ? 0.5 - 0.5 * Math.cos((Math.PI * t) / ONSET_S) : 1;
      const sinceSlur = (i - v.slurAt) / isr;
      // a 1.5 dB dip by design: with the body filter re-tuning to the new pitch the measured break stays inside #15's 3 dB
      if (v.note > 0 && sinceSlur < XFADE_S) env *= 1 - 0.1591 * Math.sin((Math.PI * sinceSlur) / XFADE_S);
      if (i >= v.ends) env *= Math.max(0, 1 - (i - v.ends) / (RELEASE_S * isr));
      if (v.trimCut > 0 && i >= v.trimCut) env *= Math.max(0, 1 - (i - v.trimCut) / (0.006 * isr));
      env *= v.noteGain[v.note];
      if (i % 16 === 0) setLp(v.body, Math.min(v.lpCap, 500 + 600 * env), 0.8);
      // one phase for the whole phrase: a slur changes its speed, never its place
      v.phaseA += v.inc;
      if (v.phaseA > TWO_PI) v.phaseA -= TWO_PI;
      const s = harmonics(v.phaseA, v.harm);
      let y = tick(v.body, s) + 0.3 * tick(v.bell, s);
      const w = v.rnd() * 2 - 1;
      // the breath: -24 dB while held, rising toward -12 dB as each note's breath runs out; +6 dB for 40 ms at a slur
      const rise = v.note === v.notes.length - 1 ? 0.6 : 0.25;
      let breathDb = -24 + 12 * rise * Math.min(1, tau / nt.d);
      if (v.note > 0 && sinceSlur < BREATH_LIFT_S) breathDb += 6 * Math.sin((Math.PI * sinceSlur) / BREATH_LIFT_S);
      y += tick(v.breath, w) * dbToLin(breathDb) * 5;
      // the lip: the phrase's one onset, 90 ms in and gone in another 120
      if (t < 0.3) {
        const lipEnv = t < 0.09 ? t / 0.09 : Math.exp(-(t - 0.09) / 0.06);
        y += tick(v.lip, w) * lipEnv * v.lipGain * 2.5;
      }
      dry = y * env * 0.3;
    }
    let out = dry;
    if (v.ring) {
      const ring = v.ring;
      const L = ring.length;
      for (let k = 0; k < v.reps.length; k++) {
        const r = v.reps[k];
        const x = ring[(v.ringPos - r.delay + L) % L];
        r.y += r.a * (x - r.y);
        out += r.y * r.g;
      }
      ring[v.ringPos] = dry;
      v.ringPos = (v.ringPos + 1) % L;
    }
    if (v.fade < 1) {
      out *= v.fade;
      v.fade = Math.max(0, v.fade - v.fadeStep);
    }
    v.n++;
    return out * v.gain;
  }

  /** harmonics 1..H at 1/h^1.2 by the Chebyshev recurrence: one sine and one cosine a sample */
  const HW = [0, 1, Math.pow(2, -1.2), Math.pow(3, -1.2), Math.pow(4, -1.2), Math.pow(5, -1.2), Math.pow(6, -1.2), Math.pow(7, -1.2), Math.pow(8, -1.2)];
  function harmonics(phase: number, H: number): number {
    const c2 = 2 * Math.cos(phase);
    let sPrev = 0;
    let sCur = Math.sin(phase);
    let s = sCur;
    for (let h = 2; h <= H; h++) {
      const sNext = c2 * sCur - sPrev;
      s += sNext * HW[h];
      sPrev = sCur;
      sCur = sNext;
    }
    return s;
  }

  /* ---- messages, on the internal grid ---- */
  const pending: Array<{ at: number; m: SynthMessage }> = [];
  let internal = 0; // the next internal sample to render
  let silenceGain = 1;
  let silenceStep = 0;

  function apply(m: SynthMessage, at: number): void {
    switch (m.type) {
      case 'hum': {
        const ramp = Math.max(1, Math.round(m.rampS * isr));
        const wanted = new Map<number, number>();
        for (let k = 0; k < m.partials.length; k++) wanted.set(m.partials[k][0], m.partials[k][1]);
        for (const [p] of wanted) partOf(p);
        for (let k = 0; k < parts.length; k++) {
          const part = parts[k];
          part.target = wanted.get(part.p) ?? 0;
          part.left = ramp;
          part.step = (part.target - part.g) / ramp;
        }
        silenceGain = 1;
        silenceStep = 0;
        break;
      }
      case 'phrase': {
        addVoice(m, at);
        silenceGain = 1;
        silenceStep = 0;
        break;
      }
      case 'cut': {
        for (let k = 0; k < voices.length; k++) {
          const v = voices[k];
          const left = (v.releaseEnd - v.n) / isr;
          if (left > 1.5 && v.fade === 1) {
            v.fadeStep = 1 / (0.3 * isr);
            v.fade = 1 - v.fadeStep;
          }
        }
        break;
      }
      case 'silence': {
        silenceStep = 1 / Math.max(1, m.rampS * isr);
        break;
      }
      default:
        break;
    }
  }

  function renderInternal(outFrame: number): [number, number] {
    // messages due at this internal sample
    while (pending.length && pending[0].at <= internal) {
      const e = pending.shift()!;
      apply(e.m, internal);
    }
    let hum = 0;
    if (internal % 64 === 0) {
      const t = serverMsAt(outFrame);
      for (let k = 0; k < parts.length; k++) if (parts[k].g > 0 || parts[k].target > 0) parts[k].wander = wanderAt(parts[k], t);
    }
    for (let k = 0; k < parts.length; k++) {
      const part = parts[k];
      if (part.left > 0) {
        part.g += part.step;
        if (--part.left === 0) part.g = part.target;
      }
      if (part.g <= 0 && part.target <= 0) {
        part.y1 = 0;
        part.y2 = 0;
        continue;
      }
      const x = part.rnd() * 2 - 1;
      const y = x + part.b1 * part.y1 - part.b2 * part.y2;
      part.y2 = part.y1;
      part.y1 = y;
      hum += y * part.norm * part.g * part.wander;
    }
    let l = hum * humGain * 0.05;
    let r = l;
    for (let k = voices.length - 1; k >= 0; k--) {
      const v = voices[k];
      if (internal < v.start) continue;
      const s = voiceSample(v);
      l += s * v.panL;
      r += s * v.panR;
      if (v.n >= v.total || v.fade === 0) voices.splice(k, 1);
    }
    if (silenceStep > 0) {
      silenceGain = Math.max(0, silenceGain - silenceStep);
      if (silenceGain === 0) {
        silenceStep = 0;
        voices.length = 0;
        for (let k = 0; k < parts.length; k++) {
          parts[k].g = 0;
          parts[k].target = 0;
          parts[k].left = 0;
        }
        silenceGain = 1;
        internal++;
        return [0, 0];
      }
      l *= silenceGain;
      r *= silenceGain;
    }
    internal++;
    return [l, r];
  }

  let prevL = 0, prevR = 0, nextL = 0, nextR = 0;
  /** the internal sample `prev` holds; -1 until the first block */
  let curK = -1;

  function post(m: SynthMessage): void {
    if (m.type === 'clock') {
      clockFrame = m.frame;
      clockMs = m.serverMs;
      return;
    }
    if (m.type === 'seed') {
      seed = m.seed >>> 0;
      zero = m.zero;
      salt = m.salt >>> 0 || 1;
      for (let k = 0; k < parts.length; k++) resetWander(parts[k], serverMsAt(internal * D));
      return;
    }
    const at = Math.max(internal, Math.round(m.frame / D));
    let k = pending.length;
    while (k > 0 && pending[k - 1].at > at) k--;
    pending.splice(k, 0, { at, m });
  }

  function process(left: Float32Array, right: Float32Array, n: number, frame: number): void {
    if (curK < 0) {
      // the internal grid starts at the first block's frame
      curK = Math.floor(frame / D);
      internal = curK;
      const a = renderInternal(curK * D);
      prevL = a[0]; prevR = a[1];
      const b = renderInternal((curK + 1) * D);
      nextL = b[0]; nextR = b[1];
    }
    for (let s = 0; s < n; s++) {
      const f = frame + s;
      const k = Math.floor(f / D);
      while (curK < k) {
        prevL = nextL; prevR = nextR;
        curK++;
        const b = renderInternal((curK + 1) * D);
        nextL = b[0]; nextR = b[1];
      }
      const x = (f - k * D) / D;
      left[s] = prevL + (nextL - prevL) * x;
      right[s] = prevR + (nextR - prevR) * x;
    }
  }

  return { rate: isr, post, process, voices: () => voices.length };
}

/** Renders `seconds` of the score offline from a list of messages (frames at `sampleRate`): the harness and the tests. */
export function renderScoreOffline(sampleRate: number, seconds: number, messages: SynthMessage[], options?: Partial<ScoreSynthOptions>, from = 0): [Float32Array, Float32Array] {
  const syn = createScoreSynth(sampleRate, options);
  for (const m of messages) syn.post(m);
  const n = Math.ceil(seconds * sampleRate);
  const L = new Float32Array(n);
  const R = new Float32Array(n);
  for (let at = 0; at < n; at += 128) {
    const k = Math.min(128, n - at);
    syn.process(L.subarray(at, at + k), R.subarray(at, at + k), k, from + at);
  }
  return [L, R];
}
