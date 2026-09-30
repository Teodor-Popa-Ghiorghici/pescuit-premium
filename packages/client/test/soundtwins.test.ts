import { describe, expect, it } from 'vitest';
import { t } from '@pescuit/shared';
import { cuesFor, type PublicEvent, type PublicRecord, type PublicView, type SeatFacts } from '../src/audio/cues.js';
import { choreograph, DEFAULT_OPTIONS } from '../src/game/choreography.js';
import { entryFor } from '../src/game/logLines.js';
import { stageChanged } from '../src/game/world.js';

/* "Audio is never the only channel for any information" (SOUND_DESIGN §6): for every cue that says something the picture
 * does not already say by being there, this walks from the cue to the thing that says it in words or in the picture. */

const PLAYERS = ['a', 'b', 'c', 'd'];
const view = (over: Partial<PublicView> = {}): PublicView => ({ players: PLAYERS, currentPlayerId: 'a', poolCount: 10, window: null, setsPossible: 14, ...over });
const rec = (before: PublicView | null, after: PublicView, events: PublicEvent[], mode: 'ascuns' | 'deschis' = 'ascuns'): PublicRecord => ({ seq: 1, mode, before, after, events });
const facts: SeatFacts = { playerId: 'c', headphones: false };
const name = (id: string) => id.toUpperCase();
const label = (r: string) => r;
const line = (e: PublicEvent) => entryFor(e as never, name, label);
const words = (e: PublicEvent): string => {
  const en = line(e)!;
  return t('en', en.key, en.params);
};

describe('every cue with something to say has a twin in words or in the picture', () => {
  it('table.egg: the eggs used in a set are in its log line, in both languages, hidden or open', () => {
    for (const rank of ['herring', null]) {
      const e = { type: 'SET_LAID', playerId: 'a', isPowerSet: rank === null, rank, eggCount: 2 } as PublicEvent;
      const en = line(e)!;
      expect(en.params.eggs).toBe(2);
      for (const locale of ['en', 'ro'] as const) expect(t(locale, en.key, en.params)).toMatch(/2/);
      expect(entryFor(e as never, name, label, { short: true })!.key.endsWith('.s')).toBe(true);
    }
    const none = { type: 'SET_LAID', playerId: 'a', isPowerSet: false, rank: 'herring', eggCount: 0 } as PublicEvent;
    expect(line(none)!.key).toBe('log.setLaid');
  });

  it('table.lay.hidden: a set laid face down says so in the log (the cue is keyed on the same public facts)', () => {
    expect(words({ type: 'SET_LAID', playerId: 'a', isPowerSet: true, rank: null, eggCount: 0 } as PublicEvent)).toMatch(/hidden/);
    expect(words({ type: 'SET_LAID', playerId: 'a', isPowerSet: true, rank: 'whale', eggCount: 0 } as PublicEvent)).toMatch(/whale/);
  });

  it('world.notch: every notch that counts down is a notch knocked out of the rim (a choreography op) - the same count', () => {
    for (const [from, to] of [[15, 14], [15, 13], [8, 7]]) {
      const r = rec(view({ setsPossible: from }), view({ setsPossible: to }), [{ type: 'SET_LAID', playerId: 'a', isPowerSet: false }]);
      const ticks = cuesFor(r, facts).filter((c) => c.id === 'world.notch').length;
      const ops = choreograph(r, facts, DEFAULT_OPTIONS).beats.flatMap((b) => b.ops).filter((o) => o.op === 'notch');
      expect(ops.length, `${from} -> ${to}`).toBeGreaterThan(0);
      const op = ops[0] as unknown as { from: number; to: number };
      expect(ticks).toBe(Math.min(3, op.from - op.to));
    }
  });

  it('world.dark.*: the light steps at the same counts, and a screen reader is told in words', () => {
    for (const [from, to, id, stage] of [[13, 12, 'world.dark.12', 'evening'], [7, 6, 'world.dark.06', 'night'], [2, 1, 'world.dark.01', 'last']] as const) {
      const r = rec(view({ setsPossible: from }), view({ setsPossible: to }), [{ type: 'SET_LAID', playerId: 'a', isPowerSet: false }]);
      expect(cuesFor(r, facts).map((c) => c.id)).toContain(id);
      expect(stageChanged(from, to)).toBe(stage);
      for (const locale of ['en', 'ro'] as const) expect(t(locale, `a11y.stage.${stage}`, {})).not.toBe(`a11y.stage.${stage}`);
    }
  });

  it('every event that has a cue has a line in the log (the events the ticker and the log show)', () => {
    const events: PublicEvent[] = [
      { type: 'REQUEST_MADE', askerId: 'a', targetId: 'b', rank: 'carp' }, { type: 'REQUEST_SUCCEEDED', askerId: 'a', targetId: 'b', count: 2, rank: 'carp' },
      { type: 'REQUEST_FAILED', askerId: 'a', targetId: 'b', rank: 'carp' }, { type: 'HAND_REFILLED', playerId: 'a', count: 3 },
      { type: 'SET_LAID', playerId: 'a', isPowerSet: false, rank: 'carp', eggCount: 0 }, { type: 'SET_DESTROYED', setId: 's', byPlayerId: 'b' },
      { type: 'POWER_GRANTED', playerId: 'a', rank: 'whale' }, { type: 'POWER_USED', playerId: 'a', rank: 'whale' },
      { type: 'SHARK_JUMP', playerId: 'a', fromId: 'b', rank: 'carp', count: 1 }, { type: 'LANTERNFISH_REFLECT', playerId: 'a', fromId: 'b', rank: 'carp', count: 1 },
      { type: 'TORTOISE_BLOCK', playerId: 'a', rank: 'carp' }, { type: 'JELLYFISH_STUN', playerId: 'a', targetId: 'b' },
      { type: 'STICKLEBACK_STEAL', playerId: 'a', targetId: 'b', rank: 'carp', count: 1 }, { type: 'STICKLEBACK_WASTED', playerId: 'a', targetId: 'b', rank: 'carp' },
      { type: 'WHALE_SHUFFLE', playerId: 'a', targetAId: 'b', targetBId: 'c' }, { type: 'TURN_SKIPPED_STUNNED', playerId: 'b' },
    ];
    for (const e of events) expect(line(e), e.type).not.toBeNull();
  });

  it('the podium and the call to the table have a picture: the end beat carries the podium, the start beat the gate', () => {
    const end = choreograph(rec(view({ setsPossible: 1 }), view({ setsPossible: 0, scores: { a: 3, b: 2, c: 1, d: 0 } }), [{ type: 'GAME_ENDED', winners: ['a'] }]), facts, DEFAULT_OPTIONS);
    expect(end.beats.some((b) => b.kind === 'end' && b.ops.some((o) => o.op === 'podium'))).toBe(true);
    const start = choreograph(rec(null, view({ setsPossible: 18 }), [{ type: 'GAME_STARTED' }, { type: 'TURN_STARTED', playerId: 'a' }]), facts, DEFAULT_OPTIONS);
    expect(start.beats.some((b) => b.kind === 'start')).toBe(true);
  });

  it('the answer window: the clock has a face - the seconds are on the plank (Windows.tsx) whether or not a tick is heard', async () => {
    const src = await import('node:fs').then((fs) => fs.readFileSync(new URL('../src/components/Windows.tsx', import.meta.url), 'utf8'));
    expect(src).toContain('useSecondsLeft');
  });
});
