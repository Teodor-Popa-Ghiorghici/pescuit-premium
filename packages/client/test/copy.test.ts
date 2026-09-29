/* The copy audit (FEEL_VISUAL_SOUND_PLAN §5.8, A23): every string exists in both languages, every placeholder
 * is shared, the ticker's lines stay under one screen width, "You may lie with Squid" never reaches a player
 * who has no unused Squid, and the tally is labelled per §4.5 with the honest "at most" kept beside it. */
import { describe, expect, it } from 'vitest';
import { RANK_NAMES, t } from '@pescuit/shared';
import * as shared from '@pescuit/shared';
import { entryFor, logLines } from '../src/game/logLines.js';
import { CODEX_STRINGS } from '../src/i18n/codexStrings.js';
import type { PublicEvent } from '@pescuit/engine';

const ro = (k: string, p?: Record<string, string | number>) => t('ro', k, p);
const en = (k: string, p?: Record<string, string | number>) => t('en', k, p);

/** the dictionaries, through `t`: a missing key comes back as itself */
const KEYS: string[] = (() => {
  const src = (shared as unknown as { dictionaries?: Record<string, Record<string, string>> }).dictionaries;
  return src ? Object.keys(src.ro) : [];
})();

describe('the two languages', () => {
  it('have the same keys and the same placeholders', () => {
    const dicts = (shared as unknown as { dictionaries?: Record<string, Record<string, string>> }).dictionaries;
    expect(dicts, '@pescuit/shared must export `dictionaries` for the audit').toBeTruthy();
    const ph = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');
    const missing: string[] = [];
    const mismatched: string[] = [];
    for (const k of Object.keys(dicts!.ro)) {
      if (!(k in dicts!.en)) missing.push(`en:${k}`);
      else if (ph(dicts!.ro[k]) !== ph(dicts!.en[k])) mismatched.push(k);
    }
    for (const k of Object.keys(dicts!.en)) if (!(k in dicts!.ro)) missing.push(`ro:${k}`);
    expect(missing).toEqual([]);
    expect(mismatched).toEqual([]);
    expect(KEYS.length).toBeGreaterThan(100);
  });
});

describe('the Codex strings (a lazy chunk, not the shared dictionaries)', () => {
  it('carry the same keys and placeholders in both languages, and none of them is in the shared dictionaries', () => {
    const ph = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');
    expect(Object.keys(CODEX_STRINGS.en).sort()).toEqual(Object.keys(CODEX_STRINGS.ro).sort());
    for (const k of Object.keys(CODEX_STRINGS.ro)) {
      expect(ph(CODEX_STRINGS.en[k]), k).toBe(ph(CODEX_STRINGS.ro[k]));
      expect(k.startsWith('codex.'), k).toBe(true);
      expect(KEYS, k).not.toContain(k);
    }
    // every rank of the Codex has its rule, in both languages
    for (const p of ['squid', 'shark', 'tortoise', 'jellyfish', 'lanternfish', 'stickleback', 'mantisShrimp', 'whale', 'clownfish']) {
      expect(CODEX_STRINGS.ro[`codex.${p}`], p).toBeTruthy();
      expect(CODEX_STRINGS.en[`codex.${p}`], p).toBeTruthy();
    }
  });
});

describe('the ticker', () => {
  const names = ['Bogdan', 'Cezar', 'Dana']; // typical names; the ticker also ellipsises longer ones
  const nameOf = (id: string) => names[Number(id)] ?? id;
  const events: PublicEvent[] = [
    { type: 'REQUEST_MADE', askerId: '0', targetId: '1', rank: 'mantisShrimp' },
    { type: 'REQUEST_SUCCEEDED', askerId: '0', targetId: '1', rank: 'mantisShrimp', count: 3 },
    { type: 'REQUEST_FAILED', askerId: '0', targetId: '1', rank: 'lanternfish' },
    { type: 'HAND_REFILLED', playerId: '0', count: 3 },
    { type: 'SET_LAID', playerId: '0', isPowerSet: true, rank: 'lanternfish' } as PublicEvent,
    { type: 'SET_DESTROYED' } as PublicEvent,
    { type: 'POWER_GRANTED', playerId: '0', rank: 'lanternfish' } as PublicEvent,
    { type: 'POWER_USED', playerId: '0', rank: 'lanternfish' } as PublicEvent,
    { type: 'SHARK_JUMP', playerId: '0', fromId: '1', count: 3 } as PublicEvent,
    { type: 'LANTERNFISH_REFLECT', playerId: '0', fromId: '1', count: 3, rank: 'lanternfish' } as PublicEvent,
    { type: 'TORTOISE_BLOCK', playerId: '0', rank: 'lanternfish' } as PublicEvent,
    { type: 'JELLYFISH_STUN', playerId: '0', targetId: '1' } as PublicEvent,
    { type: 'STICKLEBACK_STEAL', playerId: '0', targetId: '1', rank: 'lanternfish', count: 3 } as PublicEvent,
    { type: 'STICKLEBACK_WASTED', playerId: '0', targetId: '1', rank: 'lanternfish' } as PublicEvent,
    { type: 'WHALE_SHUFFLE', playerId: '0', targetAId: '1', targetBId: '2' } as PublicEvent,
    { type: 'BONUS_TURN', playerId: '0' },
    { type: 'TURN_SKIPPED_STUNNED', playerId: '0' },
    { type: 'GAME_ENDED', scores: {}, winners: [], reason: 'decided' } as PublicEvent,
    { type: 'GAME_ENDED', scores: {}, winners: [], reason: 'streak' } as PublicEvent,
    { type: 'GAME_ENDED', scores: {}, winners: [], reason: 'exhausted' } as PublicEvent,
  ];
  for (const [locale, tr] of [['ro', ro], ['en', en]] as const) {
    it(`every short line stays under 48 characters (${locale})`, () => {
      const rank = (r: string) => RANK_NAMES[r]?.[locale] ?? r;
      for (const e of events) {
        const entry = entryFor(e, nameOf, rank, { short: true });
        expect(entry, e.type).not.toBeNull();
        const text = tr(entry!.key, entry!.params);
        expect(text, `${entry!.key} is missing from the dictionary`).not.toBe(entry!.key);
        expect(text.length, text).toBeLessThanOrEqual(48);
      }
    });
  }

  it('a dry go fish says "— Pescuiește!" and nothing more', () => {
    const lines = logLines([{ type: 'REQUEST_FAILED', askerId: '0', targetId: '1', rank: 'carp', seq: 1 } as never], nameOf, (r) => r, ro, true);
    expect(lines[0].text).toBe('— Pescuiește!');
    const wet = logLines(
      [{ type: 'REQUEST_FAILED', askerId: '0', targetId: '1', rank: 'carp', seq: 1 } as never, { type: 'DREW_FROM_POOL', playerId: '0', seq: 2 } as never],
      nameOf,
      (r) => r,
      ro,
      true,
    );
    expect(wet[0].text).toContain('trage');
  });
});

describe('the tally and the end', () => {
  it('reads "încă N seturi" and "ultimul set" (§4.5), and keeps "at most" for the title', () => {
    expect(ro('game.setsMore', { count: 9 })).toBe('încă 9 seturi');
    expect(ro('game.setsMoreOne')).toBe('ultimul set');
    expect(ro('pond.tallyAria', { count: 9 })).toMatch(/cel mult 9/);
    expect(en('pond.tallyAria', { count: 9 })).toMatch(/at most 9/);
  });
  it('gives each end reason its own copy, in both languages', () => {
    for (const k of ['game.endDecided', 'game.endStreak', 'game.endExhausted', 'log.gameEndedExhausted']) {
      expect(ro(k)).not.toBe(k);
      expect(en(k)).not.toBe(k);
    }
    expect(new Set(['game.endDecided', 'game.endStreak', 'game.endExhausted'].map((k) => ro(k))).size).toBe(3);
  });
});

describe('"You may lie with Squid" (A23)', () => {
  it('appears only in the answer plank for a holder of an unused Squid: no static line carries it', () => {
    // the one string that says it is `window.responsePending`; the plank shows it only when Squid is unused
    for (const k of KEYS.filter((k) => !k.startsWith('window.') && !k.startsWith('codex.') && !k.startsWith('power.'))) {
      expect(ro(k).toLowerCase(), k).not.toMatch(/poți minți cu sep/);
      expect(en(k).toLowerCase(), k).not.toMatch(/you may lie with squid/);
    }
  });
});
