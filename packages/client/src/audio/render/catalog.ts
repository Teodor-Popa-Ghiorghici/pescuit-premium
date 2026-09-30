/* Everything rendered in plain JS (the riffle, the tulnic) as a keyed catalogue. This module is
 * imported lazily (`import('./render/catalog')`) so the renderers cost nothing until the audio
 * engine wants them - normally in the waiting room. Keys are a fixed list: no rank-named dynamic
 * imports, no rank-named banks fetched from the network. Everything else in the palette is live
 * (noise and damped modes through filters); only the horn and the paper riffle are worth rendering. */

import { CALL, CALL_SECONDS, ECHO, ECHO_SECONDS, LAST, LAST_SECONDS, PODIUM, PODIUM_SECONDS, renderHorn } from './horn.js';
import { renderRiffle } from './riffle.js';

export const KEYS: string[] = [
  ...[0, 1, 2].flatMap((t) => [`riffle.full.${t}`, `riffle.spk.${t}`]),
  'horn.call',
  'horn.echo',
  'horn.podium',
  'horn.last',
];

/** builds one buffer by key (32 kHz mono), or null for an unknown key */
export function build(key: string): Float32Array | null {
  const [family, a, b] = key.split('.');
  switch (family) {
    case 'riffle':
      return renderRiffle(a === 'spk' ? 0.17 : 0.8, 70 + Number(b));
    case 'horn':
      switch (a) {
        case 'call':
          return renderHorn(CALL, CALL_SECONDS, { seed: 7 });
        case 'echo':
          return renderHorn(ECHO, ECHO_SECONDS, { seed: 8 });
        case 'podium':
          return renderHorn(PODIUM, PODIUM_SECONDS, { seed: 9, lipDb: -26, wobble: 0.5 });
        case 'last':
          return renderHorn(LAST, LAST_SECONDS, { seed: 10, lipDb: -26, wobble: 0.5 });
        default:
          return null;
      }
    default:
      return null;
  }
}
