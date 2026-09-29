/* The nine motifs (§3.8) as data: all in D Romanian minor (Dorian #4: D E F G# A B C), the
 * colour of the doina. Reactive powers speak on the fluier (high, bright), active powers on the
 * caval (low, breathy), Clownfish - the mimic - on the drâmbă, playing the motif of the power
 * it copied. Squid is a rest: it has no entry, and so no way to sound. Notes are MIDI, written
 * pitch (a caval sounds an octave below what is written). */

import type { MotifRank } from './cuesheet.js';

export interface MotifNote {
  note: number;
  start: number;
  dur: number;
  gain?: number;
  cents?: number;
}

export interface Motif {
  inst: 'fluier' | 'caval';
  /** headphones: the full motif, 0.9-1.1 s */
  full: MotifNote[];
  /** speaker: the two-note variant (214-226 ms) */
  spk: MotifNote[];
  seconds: { full: number; spk: number };
}

/** the pitch classes of D Romanian minor: D E F G# A B C */
export const D_ROMANIAN_MINOR = [2, 4, 5, 8, 9, 11, 0] as const;

export const MOTIFS: Record<Exclude<MotifRank, 'clownfish'>, Motif> = {
  // a low note, then a leap of a minor seventh, cut short — jumping in
  shark: {
    inst: 'fluier',
    full: [{ note: 74, start: 0.01, dur: 0.5 }, { note: 84, start: 0.53, dur: 0.4, gain: 1.1 }],
    spk: [{ note: 74, start: 0.01, dur: 0.1 }, { note: 84, start: 0.11, dur: 0.12, gain: 1.1 }],
    seconds: { full: 1, spk: 0.26 },
  },
  // one note struck three times; begins and ends on the same pitch — enclosed
  tortoise: {
    inst: 'fluier',
    full: [{ note: 86, start: 0.01, dur: 0.28 }, { note: 86, start: 0.33, dur: 0.28 }, { note: 86, start: 0.65, dur: 0.3 }],
    spk: [{ note: 86, start: 0.01, dur: 0.11 }, { note: 86, start: 0.12, dur: 0.11 }],
    seconds: { full: 1, spk: 0.26 },
  },
  // a five-note palindrome, A B C B A — mirror symmetry, like its carving
  lanternfish: {
    inst: 'fluier',
    full: [
      { note: 81, start: 0.01, dur: 0.16 }, { note: 83, start: 0.16, dur: 0.16 }, { note: 84, start: 0.31, dur: 0.16 },
      { note: 83, start: 0.46, dur: 0.16 }, { note: 81, start: 0.61, dur: 0.32 },
    ],
    spk: [{ note: 81, start: 0.01, dur: 0.12 }, { note: 83, start: 0.12, dur: 0.12 }],
    seconds: { full: 1.1, spk: 0.26 },
  },
  // an accented high G# falling a tritone to D — the strike and the crack
  mantis: {
    inst: 'fluier',
    full: [{ note: 92, start: 0.01, dur: 0.3, gain: 1.35 }, { note: 86, start: 0.34, dur: 0.6 }],
    spk: [{ note: 92, start: 0.01, dur: 0.11, gain: 1.35 }, { note: 86, start: 0.12, dur: 0.11 }],
    seconds: { full: 1, spk: 0.26 },
  },
  // a trill that sags 50 cents and stops — stunned
  jellyfish: {
    inst: 'caval',
    full: [0, 1, 2, 3, 4].map((i) => ({ note: i % 2 ? 77 : 76, start: 0.01 + i * 0.17, dur: 0.16, cents: -10 * i })),
    spk: [{ note: 76, start: 0.01, dur: 0.12 }, { note: 77, start: 0.12, dur: 0.12, cents: -10 }],
    seconds: { full: 1, spk: 0.26 },
  },
  // three barbed grace notes into one short note — the hooks
  stickleback: {
    inst: 'caval',
    full: [
      { note: 80, start: 0.01, dur: 0.06 }, { note: 81, start: 0.07, dur: 0.06 }, { note: 83, start: 0.13, dur: 0.06 },
      { note: 84, start: 0.19, dur: 0.72 },
    ],
    spk: [{ note: 81, start: 0.01, dur: 0.06 }, { note: 84, start: 0.07, dur: 0.16 }],
    seconds: { full: 1, spk: 0.26 },
  },
  // two long notes, a falling major sixth, with a swell — the heaviest thing in the sea
  whale: {
    inst: 'caval',
    full: [{ note: 71, start: 0.01, dur: 0.5, gain: 1.2 }, { note: 62, start: 0.52, dur: 0.62, gain: 1.2 }],
    spk: [{ note: 71, start: 0.01, dur: 0.12, gain: 1.2 }, { note: 62, start: 0.12, dur: 0.14, gain: 1.2 }],
    seconds: { full: 1.2, spk: 0.28 },
  },
};

/** what a clownfish with nothing known to copy plays: a neutral two notes on the drâmbă */
export const CLOWN_DEFAULT: MotifNote[] = [{ note: 81, start: 0.01, dur: 0.2 }, { note: 83, start: 0.22, dur: 0.3 }];
