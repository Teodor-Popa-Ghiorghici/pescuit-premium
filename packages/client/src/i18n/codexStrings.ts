/* The Codex's strings (§5.8), kept out of the shared dictionaries so a played game's first load does not carry them:
 * they are read only by the Rules panel and the Codex, which are lazy chunks. Romanian is the default and the fallback,
 * exactly as in `@pescuit/shared`'s `t`. The copy audit (test/copy.test.ts) checks both languages carry the same keys
 * and placeholders. */
import { DEFAULT_LOCALE, type Locale } from '@pescuit/shared';
import { useGame } from '../state/store.js';

export const CODEX_STRINGS: Record<Locale, Record<string, string>> = {
  ro: {
    'codex.title': 'Codex',
    'codex.tabRules': 'Reguli',
    'codex.tabCodex': 'Codex — cele nouă puteri',
    'codex.play': 'Ascultă sunetul',
    'codex.playing': 'Se aude…',
    'codex.rest': 'O pauză',
    'codex.restNote': 'Sepia nu are sunet: nu se aude nimic, niciodată.',
    'codex.kind.reactive': 'reactivă',
    'codex.kind.active': 'activă',
    'codex.kind.special': 'specială',
    'codex.intro': 'Fiecare putere are sigiliul, sculptura și sunetul ei. O putere se aude doar când e folosită.',
    'codex.tallyNote': '„Încă 9 seturi” e o limită de sus: cel mult 9 seturi se mai pot forma, nu neapărat 9.',
    'codex.squid': 'Când ți se cere un rang, poți minți: negi cărți pe care le ai sau pretinzi unele pe care nu le ai. Nu se află niciodată.',
    'codex.shark': 'După o cerere reușită, sari și iei cărțile care tocmai și-au schimbat mâinile.',
    'codex.tortoise': 'Protejezi toate cărțile unui rang până la începutul rândului tău următor.',
    'codex.jellyfish': 'Amorțești un jucător: nu poate cere, nu i se poate cere și își pierde rândul.',
    'codex.lanternfish': 'Reflecți o cerere: în loc să dai, iei tu cărțile lui de acel rang.',
    'codex.stickleback': 'Numești un pește obișnuit și furi toate cărțile lui din mâna unui jucător, pe nevăzute.',
    'codex.mantisShrimp': 'În clipa în care cineva completează un set de putere, îi distrugi puterea. Punctul rămâne.',
    'codex.whale': 'Alegi doi jucători alăturați: mâinile lor se amestecă pe nevăzute și se împart la loc.',
    'codex.clownfish': 'Copiază în tăcere ultima putere folosită de cineva, pentru o singură folosire.',
  },
  en: {
    'codex.title': 'Codex',
    'codex.tabRules': 'Rules',
    'codex.tabCodex': 'Codex — the nine powers',
    'codex.play': 'Hear it',
    'codex.playing': 'Playing…',
    'codex.rest': 'A rest',
    'codex.restNote': 'Squid makes no sound: nothing is heard, ever.',
    'codex.kind.reactive': 'reactive',
    'codex.kind.active': 'active',
    'codex.kind.special': 'special',
    'codex.intro': 'Every power has its seal, its carving and its sound. A power is heard only when it is used.',
    'codex.tallyNote': '"9 sets to go" is an upper bound: at most 9 sets can still be formed, not necessarily 9.',
    'codex.squid': 'When you are asked for a rank you may lie: deny cards you hold, or claim ones you do not. It never comes out.',
    'codex.shark': 'After a successful ask, jump in and take the cards that just changed hands.',
    'codex.tortoise': 'Protect every card of one rank until the start of your next turn.',
    'codex.jellyfish': 'Stun a player: they cannot ask or be asked, and their turn is skipped.',
    'codex.lanternfish': 'Reflect a request: instead of handing over, you take their cards of that rank.',
    'codex.stickleback': 'Name a common fish and steal every card of it from one hand, blind.',
    'codex.mantisShrimp': 'The instant someone completes a power set, destroy its power. They keep the point.',
    'codex.whale': 'Pick two players sitting together: their hands are shuffled blind and dealt back.',
    'codex.clownfish': 'Silently copies the power most recently used, for one use.',
  },
};

export function codexText(locale: Locale, key: string): string {
  return CODEX_STRINGS[locale]?.[key] ?? CODEX_STRINGS[DEFAULT_LOCALE][key] ?? key;
}

/** `t` for `codex.*` keys */
export function useCodexT(): (key: string) => string {
  const { locale } = useGame();
  return (key) => codexText(locale, key);
}
