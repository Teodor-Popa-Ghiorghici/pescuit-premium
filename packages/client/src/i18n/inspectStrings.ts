/* The inspector's strings (HAND_AND_TURN_PLAN #3): the long descriptions a card shows after a dwell. Kept out of the shared
 * dictionaries, like the Codex's, so the lobby's first load does not carry them: only the inspector (a lazy chunk) reads them.
 * Romanian is the default and the fallback. */
import { DEFAULT_LOCALE, type Locale } from '@pescuit/shared';

export const INSPECT_STRINGS: Record<Locale, Record<string, string>> = {
  ro: {
    'inspect.power': 'Putere',
    'inspect.active': 'activă · la începutul rândului tău',
    'inspect.reactive': 'reactivă · în afara rândului',
    'inspect.special': 'specială',
    'inspect.normal': 'Pește obișnuit',
    'inspect.normalText': 'Fără putere. Strânge-i pe toți trei ca să pui jos un set de un punct.',
    'inspect.eggs': 'Icre · joker',
    'inspect.eggsText': 'Țin locul unei cărți lipsă: cel mult 2 într-un set, care trebuie să aibă măcar 2 cărți adevărate. Nu poți cere icre. Patru icre singure fac un set fără putere.',
    'inspect.setOf': 'Set: {n} cărți',
    'inspect.held': 'Ai {n} în mână',
    'inspect.window.TURN_START': 'Începutul rândului',
    'inspect.window.REQUEST_DECLARED': 'Când ți se cere',
    'inspect.window.RESPONSE_PENDING': 'Când răspunzi',
    'inspect.window.TRANSFER_PENDING': 'Când ți se iau cărțile',
    'inspect.window.SET_COMPLETED': 'Când se completează un set de putere',
    'inspect.window.TURN_END': 'După o cerere reușită',
    'inspect.window.special': 'Copiază ultima putere folosită',
    'inspect.squid': 'Când ți se cere un rang, poți minți: negi cărți pe care le ai sau pretinzi unele pe care nu le ai. Cel care a cerut pescuiește. Nu se află niciodată.',
    'inspect.shark': 'După o cerere reușită, sari și iei cărțile care tocmai și-au schimbat mâinile. Cel de la rând își pierde rândul bonus.',
    'inspect.tortoise': 'Protejezi toate cărțile unui rang până la începutul rândului tău următor: nimic nu ți le poate lua.',
    'inspect.jellyfish': 'Amorțești un jucător până la rândul lui: nu poate cere, nu i se poate cere și își pierde rândul.',
    'inspect.lanternfish': 'Când ți se cere, reflecți cererea: iei tu cărțile lui de acel rang. Rândul lui se încheie, fără să pescuiască.',
    'inspect.stickleback': 'Numești un pește obișnuit și furi toate cărțile lui din mâna unui jucător, pe nevăzute.',
    'inspect.mantisShrimp': 'În clipa în care cineva completează un set de putere, îi distrugi puterea. Punctul rămâne.',
    'inspect.whale': 'Alegi doi jucători alăturați: mâinile lor se amestecă pe nevăzute și se împart la loc, câte cărți avea fiecare.',
    'inspect.clownfish': 'Copiază în tăcere ultima putere folosită de cineva și devine, pentru o folosire, chiar acea putere.',
  },
  en: {
    'inspect.power': 'Power',
    'inspect.active': 'active · at the start of your turn',
    'inspect.reactive': 'reactive · out of turn',
    'inspect.special': 'special',
    'inspect.normal': 'Common fish',
    'inspect.normalText': 'No power. Gather all three to lay a set worth one point.',
    'inspect.eggs': 'Eggs · wildcard',
    'inspect.eggsText': 'Stand in for missing cards: at most 2 in a set, which must still hold 2 real cards. Eggs cannot be asked for. Four eggs alone make a set with no power.',
    'inspect.setOf': 'Set: {n} cards',
    'inspect.held': 'You hold {n}',
    'inspect.window.TURN_START': 'Start of your turn',
    'inspect.window.REQUEST_DECLARED': 'When you are asked',
    'inspect.window.RESPONSE_PENDING': 'When you answer',
    'inspect.window.TRANSFER_PENDING': 'When your cards are taken',
    'inspect.window.SET_COMPLETED': 'When a power set is completed',
    'inspect.window.TURN_END': 'After a successful ask',
    'inspect.window.special': 'Copies the last power used',
    'inspect.squid': 'When you are asked for a rank you may lie: deny cards you hold, or claim ones you do not. The asker goes fishing. It never comes out.',
    'inspect.shark': 'After a successful ask, jump in and take the cards that just changed hands. The asker loses their bonus turn.',
    'inspect.tortoise': 'Protect every card of one rank until the start of your next turn: nothing can take them.',
    'inspect.jellyfish': 'Stun a player until their turn: they cannot ask or be asked, and their turn is skipped.',
    'inspect.lanternfish': 'When you are asked, reflect it: you take their cards of that rank instead. Their turn ends, with no draw.',
    'inspect.stickleback': 'Name a common fish and steal every card of it from one hand, blind.',
    'inspect.mantisShrimp': 'The instant someone completes a power set, destroy its power. They keep the point.',
    'inspect.whale': 'Pick two players sitting together: their hands are shuffled blind and dealt back, as many cards each as before.',
    'inspect.clownfish': 'Silently copies the power most recently used, and becomes that power for one use.',
  },
};

export function inspectText(locale: Locale, key: string, params?: Record<string, string | number>): string {
  let s = INSPECT_STRINGS[locale]?.[key] ?? INSPECT_STRINGS[DEFAULT_LOCALE][key] ?? key;
  if (params) for (const [k, v] of Object.entries(params)) s = s.replaceAll(`{${k}}`, String(v));
  return s;
}
