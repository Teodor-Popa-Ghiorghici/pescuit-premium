/* Everything rendered in plain JS (strings, riffle, breath, drâmbă) as a keyed catalogue. This
 * module is imported lazily (`import('./render/catalog')`) so the renderers cost nothing until
 * the audio engine wants them - normally in the waiting room. Keys are a fixed list: no
 * rank-named dynamic imports, no rank-named banks fetched from the network. */

import { MOTIFS, CLOWN_DEFAULT, type MotifNote } from '../motifs.js';
import { renderBreath, renderDramba, renderTulnic } from './breath.js';
import { renderRiffle } from './riffle.js';
import { renderStrings } from './strings.js';
import { midi } from '../util.js';

const RANKS = Object.keys(MOTIFS) as Array<keyof typeof MOTIFS>;
const octaveOf = (inst: 'fluier' | 'caval'): 0 | -1 => (inst === 'caval' ? -1 : 0);

function motifBuffer(rank: keyof typeof MOTIFS, spk: boolean): Float32Array {
  const m = MOTIFS[rank];
  return renderBreath(spk ? m.spk : m.full, spk ? m.seconds.spk : m.seconds.full, {
    octave: octaveOf(m.inst),
    breathDb: m.inst === 'caval' ? -12 : -18,
    seed: 5,
  });
}

/** the motif of a power played as overtones of a jaw harp: each note becomes a formant */
function drambaMotif(notes: MotifNote[], seconds: number, octave: 0 | -1 = 0): Float32Array {
  return renderDramba(
    notes.map((n) => {
      const f = midi(n.note + 12 * octave);
      return { start: n.start, dur: n.dur, gain: 0.8 * (n.gain ?? 1), formants: [[f, f * 1.02], [f * 2, f * 2]] as [[number, number], [number, number]], wobbleHz: 6, Q: [9, 9] as [number, number] };
    }),
    seconds,
  );
}

const TULNIC: Record<string, [number, number]> = { start1: [45, 1.1], start2: [50, 1.35], whale: [38, 0.9], lastset: [38, 1.2] };

export const KEYS: string[] = [
  ...[0, 1, 2].flatMap((t) => [`granted.full.${t}`, `granted.spk.${t}`]),
  'glint.full', 'glint.spk',
  ...RANKS.flatMap((r) => [`motif.${r}.full`, `motif.${r}.spk`]),
  ...[0, 1, 2].flatMap((t) => [`riffle.full.${t}`, `riffle.spk.${t}`]),
  ...Object.keys(TULNIC).map((k) => `tulnic.${k}`),
  'dramba.jelly.full', 'dramba.jelly.spk', 'dramba.wobble', 'dramba.wobble.spk',
  'end.win', 'end.tie', 'end.lose', 'eligible',
  ...[0, 1, 2].flatMap((t) => [`lead.full.${t}`, `lead.spk.${t}`]),
  'breakaway.full', 'breakaway.spk', 'chase.full', 'chase.spk', 'clinch.full',
];

/** a figure of struck courses on the țambal: [midi, start s] */
function strum(notes: Array<[number, number, number?]>, seconds: number, seed: number, dampAt?: number): Float32Array {
  const out = new Float32Array(Math.ceil(seconds * 32000));
  notes.forEach(([n, at, g = 1], i) => {
    const s = renderStrings(midi(n), seconds - at, seed + i, dampAt !== undefined ? Math.max(0.02, dampAt - at) : undefined);
    const o = Math.floor(at * 32000);
    for (let k = 0; k < s.length && k + o < out.length; k++) out[k + o] += s[k] * g * 0.8;
  });
  return out;
}

/** builds one buffer by key (32 kHz mono), or null for an unknown key */
export function build(key: string): Float32Array | null {
  const [family, a, b] = key.split('.');
  switch (family) {
    case 'granted': {
      const seed = 30 + Number(b);
      const spk = a === 'spk';
      const out = new Float32Array(Math.ceil((spk ? 0.34 : 1.5) * 32000));
      const n1 = renderStrings(midi(74), spk ? 0.3 : 1.4, seed, spk ? 0.16 : undefined);
      const n2 = renderStrings(midi(81), spk ? 0.3 : 1.3, seed + 1, spk ? 0.16 : undefined);
      const o2 = Math.floor((spk ? 0.03 : 0.05) * 32000);
      for (let i = 0; i < n1.length; i++) out[i + 320] += n1[i] * 0.9;
      for (let i = 0; i < n2.length && i + o2 + 320 < out.length; i++) out[i + o2 + 320] += n2[i] * 0.6;
      return out;
    }
    case 'glint':
      return renderStrings(midi(93), a === 'spk' ? 0.2 : 0.3, 61, a === 'spk' ? 0.12 : 0.22);
    case 'motif':
      return RANKS.includes(a as never) ? motifBuffer(a as keyof typeof MOTIFS, b === 'spk') : null;
    case 'clown': {
      const m = MOTIFS[a as keyof typeof MOTIFS];
      const spk = b === 'spk';
      if (!m) return drambaMotif(CLOWN_DEFAULT, spk ? 0.26 : 0.6);
      return drambaMotif(spk ? m.spk : m.full, spk ? m.seconds.spk : m.seconds.full, octaveOf(m.inst));
    }
    case 'riffle':
      return renderRiffle(a === 'spk' ? 0.17 : 0.8, 70 + Number(b));
    case 'tulnic': {
      const t = TULNIC[a];
      return t ? renderTulnic(t[0], t[1], 1.2) : null;
    }
    case 'dramba':
      if (a === 'wobble') return renderDramba([{ start: 0.01, dur: b === 'spk' ? 0.1 : 0.3, gain: 0.7, formants: [[380, 520], [1100, 1300]], wobbleHz: 6 }], b === 'spk' ? 0.14 : 0.36);
      return a === 'jelly' ? renderDramba([{ start: 0.01, dur: b === 'spk' ? 0.15 : 0.5, gain: 1, formants: [[450, 810], [1300, 1950]] }], b === 'spk' ? 0.18 : 0.55) : null;
    case 'end': {
      if (a === 'win') return renderBreath([74, 76, 77, 81, 86].map((n, i) => ({ note: n, start: 0.05 + [0, 0.4, 0.8, 1.3, 1.85][i], dur: i === 4 ? 1.0 : 0.42 })), 3, { seed: 9 });
      if (a === 'tie') {
        const lo = renderBreath([74, 76, 77, 76, 74].map((n, i) => ({ note: n, start: 0.05 + i * 0.5, dur: i === 4 ? 0.6 : 0.46, gain: 0.8 })), 2.9, { seed: 10 });
        const hi = renderBreath([77, 80, 81, 80, 77].map((n, i) => ({ note: n, start: 0.05 + i * 0.5, dur: i === 4 ? 0.6 : 0.46, gain: 0.8 })), 2.9, { seed: 11 });
        return lo.map((v, i) => v + hi[i]);
      }
      return renderBreath([81, 77, 74, 69].map((n, i) => ({ note: n, start: 0.05 + [0, 0.6, 1.2, 1.85][i], dur: i === 3 ? 0.9 : 0.55, gain: 0.85 })), 2.9, { octave: -1, breathDb: -12, seed: 12 });
    }
    // the score race, on the țambal (D Romanian minor): a new leader climbs D-A-D; a breakaway runs up
    // four; a chase is two notes a semitone apart, pressing; out of reach is the rolled chord, held
    case 'lead': {
      const spk = a === 'spk';
      const t = Number(b) || 0;
      const top = [86, 88, 89][t] ?? 86;
      return spk ? strum([[81, 0.01], [top, 0.08, 1.1]], 0.26, 40 + t, 0.19) : strum([[74, 0.01], [81, 0.12], [top, 0.24, 1.15]], 0.95, 40 + t);
    }
    case 'breakaway':
      return a === 'spk' ? strum([[81, 0.01], [84, 0.05], [86, 0.09], [93, 0.13, 1.1]], 0.26, 50, 0.2) : strum([[74, 0.01], [81, 0.08], [84, 0.15], [86, 0.22], [93, 0.3, 1.2]], 1.0, 50);
    case 'chase':
      return a === 'spk' ? strum([[77, 0.01], [80, 0.09, 1.05]], 0.26, 55, 0.19) : strum([[77, 0.01], [80, 0.14], [77, 0.28, 0.8], [80, 0.42, 1.05]], 0.8, 55);
    case 'clinch':
      return strum([[62, 0.01, 1.1], [69, 0.06], [74, 0.11], [77, 0.16], [81, 0.21], [86, 0.26, 1.2]], 2.2, 60);
    case 'eligible':
      return renderBreath([{ note: 86, start: 0.02, dur: 0.14 }, { note: 93, start: 0.16, dur: 0.24 }], 0.42, { seed: 13 });
    default:
      return null;
  }
}
