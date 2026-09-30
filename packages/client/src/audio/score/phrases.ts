/* phrases.ts - DATA and its rules (MUSIC_PLAN §3.3-§3.4, Appendix A). The score's library of distant tulnic phrases:
 * 10 calls for the waiting room and for each stage of the evening, and the answers of a second, farther horn (4 for the
 * waiting room, 6 each for the evening and the night; dusk has none). Every pitch is a partial of the 58 Hz fundamental.
 *
 * The library is written in the plan's notation so the composer can type a phrase into the lab and paste it here:
 *
 *     6~ 1.0 → 8 0.4 → 9 1.6 → 12 1.3 |40
 *
 * partial and duration in seconds; `~` the phrase's one onset (a scoop from below, a slow swell); `→` (or `>`) a slur;
 * `↓n` (or `vn`) a sag of n cents over the note; `|t` the breath cut t ms early. Every phrase is one breath.
 *
 * STATUS: this is the in-house draft written against §3 (decision D7's alternative). The composer's library (M-S1) and
 * the consultant's review (§3.7) replace it; `phraseRules` is what any replacement must pass (test/phrases.test.ts).
 */

export type ScoreStage = 'lobby' | 'dusk' | 'evening' | 'night';
export type PhraseKind = 'call' | 'answer';

export interface PhraseNote {
  /** the partial of 58 Hz: 4-12 */
  p: number;
  /** seconds, from this note's start to the next note's (the last note's is its length) */
  d: number;
  /** cents the note sags by its end */
  sag: number;
  /** ms the breath is cut early (the last note only) */
  trim: number;
}

export interface Phrase {
  id: string;
  kind: PhraseKind;
  stage: ScoreStage;
  notes: PhraseNote[];
}

/** Parses one phrase in the plan's notation. Throws on anything it cannot read, so a typo never ships. */
export function parsePhrase(text: string): PhraseNote[] {
  const parts = text
    .trim()
    .split(/\s*(?:→|->|>)\s*/)
    .filter(Boolean);
  if (!parts.length) throw new Error('an empty phrase');
  return parts.map((part, k) => {
    const m = /^(\d+)(~?)\s+(\d*\.?\d+)\s*(?:(?:↓|v)(\d+))?\s*(?:\|(\d+))?$/.exec(part.trim());
    if (!m) throw new Error(`cannot read "${part}" in "${text}"`);
    if ((m[2] === '~') !== (k === 0)) throw new Error(`the onset mark ~ belongs on the first note only: "${text}"`);
    if (m[5] && k !== parts.length - 1) throw new Error(`only the last note is cut short: "${text}"`);
    return { p: Number(m[1]), d: Number(m[3]), sag: m[4] ? Number(m[4]) : 0, trim: m[5] ? Number(m[5]) : 0 };
  });
}

/** writes a phrase back in the notation (the lab shows it) */
export function formatPhrase(notes: readonly PhraseNote[]): string {
  return notes.map((n, k) => `${n.p}${k === 0 ? '~' : ''} ${n.d}${n.sag ? `↓${n.sag}` : ''}${n.trim ? ` |${n.trim}` : ''}`).join(' → ');
}

const RAW: Record<ScoreStage, { call: string[]; answer: string[] }> = {
  lobby: {
    call: [
      '5~ 1.1 → 6 0.6 → 8 1.4↓20 → 6 0.5 → 5 0.75 → 4 1.8',
      '6~ 1.0 → 8 0.7 → 9 0.3 → 8 1.2 → 6 1.6',
      '4~ 1.3 → 5 0.45 → 6 0.8 → 8 2.1↓15',
      '8~ 0.9 → 7 0.5 → 6 1.2 → 5 0.35 → 4 2.0↓10',
      '6~ 1.4 → 5 0.6 → 6 0.4 → 8 1.7 |40',
      '5~ 0.8 → 6 0.35 → 8 0.55 → 10 1.25 → 8 0.45 → 6 1.9↓20',
      '4~ 1.6 → 6 0.5 → 5 0.9 → 4 1.5',
      '6~ 0.7 → 9 0.4 → 8 1.3 → 7 0.3 → 6 0.95 → 8 1.6',
      '8~ 1.2 → 10 0.55 → 9 0.8 → 8 0.35 → 6 1.1 → 4 1.7',
      '5~ 1.0 → 4 0.45 → 5 0.7 → 6 1.5 → 5 0.4 → 6 2.0↓15',
    ],
    answer: ['8~ 0.5 → 7 0.6 → 6 1.1', '6~ 0.45 → 5 0.7 → 4 1.2', '9~ 0.6 → 8 0.35 → 6 1.3↓15', '5~ 0.8 → 6 0.45 → 8 1.1'],
  },
  dusk: {
    call: [
      '6~ 1.0 → 8 0.4 → 9 1.6 → 12 1.3 |40',
      '9~ 1.0 → 10 0.45 → 9 0.6 → 8 0.25 → 6 1.9↓20',
      '6~ 1.6 → 8 0.5 → 12 1.1 → 9 0.7 → 6 1.9',
      '6~ 1.3 → 9 0.55 → 12 0.9 → 10 0.35 → 9 1.05 → 12 1.5↓10',
      '12~ 0.85 → 9 0.4 → 8 0.3 → 6 1.2 → 9 0.65 → 12 1.4',
      '6~ 0.95 → 5 0.4 → 6 0.7 → 9 1.5 → 6 1.3↓15',
      '9~ 1.35 → 12 0.6 → 10 0.35 → 9 0.8 → 6 1.75 → 12 1.3 |30',
      '5~ 0.7 → 6 1.1 → 8 0.35 → 9 0.55 → 6 1.8↓25',
      '6~ 1.1 → 8 0.45 → 10 0.75 → 9 0.4 → 12 2.0↓10',
      '12~ 1.4 → 10 0.5 → 9 0.9 → 8 0.35 → 6 2.1',
    ],
    answer: [],
  },
  evening: {
    call: [
      '6~ 0.8 → 8 0.45 → 7 1.0 → 6 0.6 → 5 1.8↓25',
      '5~ 1.1 → 6 0.5 → 8 0.35 → 10 0.9 → 6 0.7 → 5 1.4 |50',
      '10~ 0.7 → 9 1.2 → 8 0.3 → 6 2.0↓15',
      '6~ 1.2 → 5 0.55 → 6 0.8 → 9 0.45 → 7 0.95 → 6 0.35 → 5 1.9↓20',
      '9~ 0.9 → 10 0.6 → 9 0.35 → 8 0.3 → 7 1.1 → 6 1.6',
      '5~ 1.5 → 6 0.45 → 10 1.3 → 9 0.55 → 10 1.7↓10',
      '6~ 0.75 → 7 0.4 → 6 1.3 → 5 0.55 → 6 0.9 → 5 1.5',
      '10~ 1.3 → 8 0.3 → 7 0.85 → 6 0.5 → 5 2.1↓30',
      '7~ 1.0 → 6 0.6 → 8 0.4 → 10 1.4 → 9 0.45 → 10 1.3 |40',
      '6~ 1.7 → 8 0.35 → 9 0.8 → 7 0.45 → 6 1.05 → 5 1.6↓20',
    ],
    answer: ['7~ 0.5 → 6 0.6 → 5 1.1', '10~ 0.7 → 9 0.4 → 10 1.0', '9~ 0.45 → 8 0.3 → 6 1.4↓20', '5~ 0.6 → 6 0.35 → 5 1.3', '6~ 0.9 → 7 0.4 → 6 1.2 |40', '9~ 0.55 → 10 0.35 → 8 0.3 → 10 1.3'],
  },
  night: {
    call: [
      '9~ 0.65 → 11 1.2 → 10 0.3 → 8 0.45 → 7 2.0↓35',
      '6~ 0.95 → 8 0.4 → 11 1.6↓20 → 9 0.8',
      '7~ 1.3 → 9 0.5 → 11 0.95 → 10 0.35 → 7 1.7 |60',
      '5~ 1.1 → 7 0.7 → 9 0.4 → 11 1.3 → 9 0.55 → 7 1.8↓30',
      '11~ 0.8 → 10 0.35 → 9 1.0 → 7 0.6 → 5 0.45 → 7 1.9',
      '7~ 1.5 → 6 0.4 → 7 0.75 → 9 1.2 → 11 2.0↓15',
      '9~ 1.0 → 8 0.3 → 7 0.55 → 5 1.3 → 7 0.45 → 9 1.6↓10',
      '6~ 0.85 → 7 0.5 → 9 0.35 → 11 1.4 → 10 0.4 → 9 0.7 → 7 1.5 |40',
      '11~ 1.2 → 9 0.45 → 10 0.75 → 11 0.4 → 9 1.1 → 7 1.7↓25',
      '5~ 1.4 → 6 0.35 → 7 0.9 → 9 0.6 → 11 1.6',
    ],
    answer: ['9~ 0.45 → 8 0.3 → 7 1.4↓30', '7~ 0.7 → 9 0.4 → 11 1.3 |30', '11~ 0.5 → 10 0.35 → 9 1.3', '5~ 0.65 → 7 0.4 → 9 0.3 → 7 1.2↓20', '10~ 0.6 → 11 0.45 → 9 1.4', '9~ 0.8 → 7 0.35 → 5 0.45 → 7 1.1 |30'],
  },
};

const PREFIX: Record<ScoreStage, string> = { lobby: 'L', dusk: 'D', evening: 'E', night: 'N' };

export const PHRASES: readonly Phrase[] = (Object.keys(RAW) as ScoreStage[]).flatMap((stage) => [
  ...RAW[stage].call.map((t, k): Phrase => ({ id: `${PREFIX[stage]}${k + 1}`, kind: 'call', stage, notes: parsePhrase(t) })),
  ...RAW[stage].answer.map((t, k): Phrase => ({ id: `A${PREFIX[stage]}${k + 1}`, kind: 'answer', stage, notes: parsePhrase(t) })),
]);

const BY_ID: ReadonlyMap<string, Phrase> = new Map(PHRASES.map((p) => [p.id, p]));
export const phraseById = (id: string): Phrase | undefined => BY_ID.get(id);

/** a stage's bag of calls or answers, in library order */
export const bagOf = (stage: ScoreStage, kind: PhraseKind): readonly Phrase[] => PHRASES.filter((p) => p.stage === stage && p.kind === kind);

export const lengthOf = (notes: readonly PhraseNote[]): number => notes.reduce((a, n) => a + n.d, 0);

/* ------------------------------------------------------------------ the rules (§3.2, §3.4) */

/** where a phrase may end, per stage (§3.4) */
export const CADENCES: Record<ScoreStage, readonly number[]> = { lobby: [4, 6, 8], dusk: [6, 12], evening: [5, 6, 10], night: [7, 9, 11] };
/** the accent: partial 11 ("fa"), in the night's phrases only */
export const ACCENT = 11;
export const RANGE: readonly [number, number] = [4, 12];
export const LENGTHS: Record<PhraseKind, readonly [number, number]> = { call: [3, 7], answer: [1.5, 3] };
/** the tonic class may only be passed through in play: this long at most, never first or last */
export const PASSING_S = 0.5;
/** the clock's range of intervals: no two inter-onset intervals in it may lie within 10 % of each other */
export const CLOCK_RANGE_S: readonly [number, number] = [0.4, 1.1];

/**
 * The inter-onset intervals of a phrase: every note starts where the previous one's slur lands, so they are the note
 * lengths but the last's.
 */
export const intervalsOf = (notes: readonly PhraseNote[]): number[] => notes.slice(0, -1).map((n) => n.d);

/**
 * The no-pulse rule on written durations (§3.2, and round 2's small-integer check): no three consecutive intervals within
 * 10 % of each other; no two intervals in the clock's range (0.4-1.1 s) within 10 % of each other; no two consecutive
 * intervals in a 1:2 ratio (within 4 %), the metric doubling that makes a pulse out of two lengths.
 */
export function pulseViolations(notes: readonly PhraseNote[]): string[] {
  const iv = intervalsOf(notes);
  const near = (a: number, b: number, tol: number) => Math.max(a, b) / Math.min(a, b) <= 1 + tol + 1e-9;
  const out: string[] = [];
  for (let k = 0; k + 2 < iv.length; k++) if (near(iv[k], iv[k + 1], 0.1) && near(iv[k + 1], iv[k + 2], 0.1) && near(iv[k], iv[k + 2], 0.1)) out.push(`three even intervals from note ${k + 1}`);
  const inClock = iv.map((v, k) => [v, k] as const).filter(([v]) => v >= CLOCK_RANGE_S[0] && v <= CLOCK_RANGE_S[1]);
  for (let a = 0; a < inClock.length; a++) for (let b = a + 1; b < inClock.length; b++) if (near(inClock[a][0], inClock[b][0], 0.1)) out.push(`intervals ${inClock[a][1] + 1} and ${inClock[b][1] + 1} both sound like the clock`);
  for (let k = 0; k + 1 < iv.length; k++) {
    const r = Math.max(iv[k], iv[k + 1]) / Math.min(iv[k], iv[k + 1]);
    if (Math.abs(r - 2) <= 0.08) out.push(`intervals ${k + 1} and ${k + 2} are in a 1:2 ratio`);
  }
  return out;
}

/** every rule a phrase breaks; empty when it may ship */
export function phraseRules(ph: Pick<Phrase, 'kind' | 'stage' | 'notes'>): string[] {
  const out: string[] = [];
  const n = ph.notes;
  if (!n.length) return ['no notes'];
  const len = lengthOf(n);
  const [lo, hi] = LENGTHS[ph.kind];
  if (len < lo - 1e-9 || len > hi + 1e-9) out.push(`length ${len.toFixed(2)} s outside ${lo}-${hi} s`);
  for (const x of n) {
    if (!Number.isInteger(x.p) || x.p < RANGE[0] || x.p > RANGE[1]) out.push(`partial ${x.p} outside ${RANGE[0]}-${RANGE[1]}`);
    if (x.p === ACCENT && ph.stage !== 'night') out.push('partial 11 outside the night');
    if (x.d <= 0) out.push('a note without length');
  }
  if (!CADENCES[ph.stage].includes(n[n.length - 1].p)) out.push(`ends on ${n[n.length - 1].p}, not on ${CADENCES[ph.stage].join('/')}`);
  if (ph.stage !== 'lobby') {
    // the tonic class (partials 4 and 8) is never sustained in play: passing only
    n.forEach((x, k) => {
      if (x.p === 4) out.push('partial 4 in play');
      if (x.p === 8 && (k === 0 || k === n.length - 1 || x.d > PASSING_S + 1e-9)) out.push(`partial 8 held or framing at note ${k + 1}`);
    });
  }
  n.forEach((x, k) => {
    if (x.trim && k !== n.length - 1) out.push('a breath cut before the last note');
  });
  out.push(...pulseViolations(n));
  return out;
}

/* ------------------------------------------------------------------ takes (§4.3) */

/** A take is the same phrase ornamented differently: how far the onset scoops, how much the notes sag, how early the
 * breath runs out. A phrase that comes round again takes another. */
export interface Take {
  scoopCents: number;
  sagScale: number;
  extraTrimMs: number;
}
export const TAKES: readonly Take[] = [
  { scoopCents: 50, sagScale: 1, extraTrimMs: 0 },
  { scoopCents: 35, sagScale: 1.4, extraTrimMs: 25 },
  { scoopCents: 65, sagScale: 0.7, extraTrimMs: 10 },
];
