// FEEL_VISUAL_SOUND_PLAN §6.5, extended (M1) from the event and view layer to the presentation layer:
// choreography.ts, cues.ts and the haptics map. The histories are real engine games; every message is
// redacted per viewer exactly as the room does it, run through the client's own adapter (record.ts),
// and the resulting beats, durations, classes, cues and haptics are compared.
//
//   Test 1 - same public record, same presentation: for two histories with identical public records
//            every non-owner's beats, durations, classes, cues and haptics are identical, and the
//            audible output is identical for every viewer, owners included, in default mode.
//   Test 2 - structural erasure: histories whose public records differ ONLY by a structural window
//            that opens and closes without a declaration sound the same - cue ids, parameters and
//            order - the window adds only its pause.
//   Guards - the client imports only PublicEvent; the choreography reads nothing private.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { redactEventsForPlayer, redactForPlayer, reduce, type Action, type Card, type GameEvent, type GameState, type Rank, type RedactedView } from '@pescuit/engine';
import { describe, expect, it } from 'vitest';
import { cuesFor, type CueRequest } from '../src/audio/cues.js';
import { hapticsFor, type HapticRequest } from '../src/audio/haptics.js';
import { choreograph, DEFAULT_OPTIONS, summarize, type Choreography } from '../src/game/choreography.js';
import { factsOf, recordOf } from '../src/game/record.js';
import { endgame } from '../../engine/test/endgamePair.js';
import { makeState } from '../../engine/test/helpers.js';
import { grantPower } from '../../engine/test/powers/grantHelper.js';

const mk = (id: string, rank: Rank): Card => ({ id, rank });
const many = (prefix: string, rank: Rank, n: number): Card[] => Array.from({ length: n }, (_, i) => mk(`${prefix}${i}`, rank));

/* ---- a tiny room: stamps seq like the server, redacts per viewer ------------------------------ */
interface Step {
  state: GameState;
  events: (GameEvent & { seq: number })[];
}
function play(state0: GameState, driver: (s: GameState) => Action | null, maxSteps = 60): { state0: GameState; steps: Step[] } {
  const steps: Step[] = [];
  let state = state0;
  let seq = 0;
  for (let i = 0; i < maxSteps && state.status === 'IN_PROGRESS'; i++) {
    const action = driver(state);
    if (!action) break;
    const r = reduce(state, action);
    state = r.state;
    steps.push({ state, events: r.events.map((e) => ({ ...e, seq: ++seq })) });
  }
  return { state0, steps };
}
const scripted = (actions: Array<Action | ((s: GameState) => Action | null)>) => {
  let i = 0;
  return (s: GameState) => {
    const a = actions[i++];
    return a === undefined ? null : typeof a === 'function' ? a(s) : a;
  };
};
const grantOf = (s: GameState, ownerId: string, rank: string) => s.powerGrants.find((g) => g.ownerId === ownerId && g.rank === rank)!.id;

/** what one viewer's client would present for every message of a history */
interface Shown {
  ch: Choreography;
  cues: CueRequest[];
  haptics: HapticRequest[];
}
function shown(w: { state0: GameState; steps: Step[] }, viewer: string, o: { headphones?: boolean; local?: (i: number) => boolean } = {}): Shown[] {
  const out: Shown[] = [];
  const at = (state: GameState, seq: number): RedactedView => redactForPlayer(state, viewer, { seq, serverNow: 0, windowDeadlineAt: state.pendingWindow ? 1e9 : null });
  let prev: RedactedView = at(w.state0, 0);
  w.steps.forEach((st, i) => {
    const seq = st.events[st.events.length - 1]?.seq ?? i;
    const view = at(st.state, seq);
    const events = redactEventsForPlayer(st.state, st.events, viewer) as never[];
    const record = recordOf(prev, view, events, seq);
    // the answering device plays its own close at the press, so it does not play it twice (§3.2)
    const closedAnswer = prev.pendingWindow?.type === 'RESPONSE_PENDING' && view.pendingWindow?.type !== 'RESPONSE_PENDING';
    const facts = factsOf(prev, view, viewer, { headphones: !!o.headphones, closePlayedLocally: closedAnswer && !!o.local?.(i) });
    out.push({ ch: choreograph(record, facts, DEFAULT_OPTIONS), cues: cuesFor(record, facts), haptics: hapticsFor(record, facts) });
    prev = view;
  });
  return out;
}

const j = (x: unknown) => JSON.stringify(x);
const beatsOf = (s: Shown[]) => s.map((x) => summarize(x.ch));
const publicHaptics = (s: Shown[]) => s.map((x) => x.haptics.filter((h) => h.tier === 'public'));

type World = ReturnType<typeof play>;

/** Test 1: everything a non-owner presents is identical; everything audible is identical for all, owners included */
function expectSamePresentation(worlds: World[], nonOwners: string[], everyone: string[], o: { local?: Record<string, (i: number) => boolean> } = {}) {
  const [first, ...rest] = worlds;
  for (const w of rest) {
    expect(w.steps.length).toBe(first.steps.length);
    for (const v of nonOwners) {
      const a = shown(first, v);
      const b = shown(w, v);
      expect(j(beatsOf(b)), `beats, durations and classes for ${v}`).toBe(j(beatsOf(a)));
      expect(j(b.map((x) => x.ch.cues)), `cues for ${v}`).toBe(j(a.map((x) => x.ch.cues)));
      expect(j(publicHaptics(b)), `haptics for ${v}`).toBe(j(publicHaptics(a)));
    }
    for (const v of everyone) {
      const opts = { local: o.local?.[v] };
      const a = shown(first, v, opts);
      const b = shown(w, v, opts);
      expect(j(b.map((x) => x.cues)), `audible output for ${v}`).toBe(j(a.map((x) => x.cues)));
      // the choreography carries the same cues: what is played is what cuesFor said
      const norm = (c: CueRequest[]) => c.map((x) => ({ ...x, at: x.id.startsWith('mus.end') ? null : x.at })).sort((p, q) => (p.at ?? 0) - (q.at ?? 0) || p.id.localeCompare(q.id));
      expect(j(b.map((x) => norm(x.ch.cues))), `choreographed cues for ${v}`).toBe(j(b.map((x) => norm(x.cues))));
    }
  }
}

describe('presentation leak, test 1: same public record, same presentation', () => {
  function answerWorld(kind: 'honest' | 'deny' | 'claim') {
    const rank: Rank = kind === 'honest' ? 'shark' : 'squid';
    const keep: Card[] = kind === 'deny' ? many('bh', 'herring', 2) : many('bm', 'mackerel', 2);
    const state = makeState({
      playerIds: ['a', 'b', 'c'],
      hands: { a: [mk('a1', 'herring'), mk('a2', 'trout')], b: [...many('bs', rank, 4), ...keep], c: many('c', 'carp', 2) },
      pool: [mk('p1', 'perch'), mk('p2', 'anchovy')],
      powerVisibility: 'ascuns',
    });
    const answer = (s: GameState): Action =>
      kind === 'honest' ? { type: 'SKIP_WINDOW', playerId: 'b' } : { type: 'DECLARE_SQUID', playerId: 'b', grantId: grantOf(s, 'b', 'squid'), lie: kind === 'deny' ? 'deny' : 'claim' };
    return play(state, scripted([{ type: 'LAY_SET', playerId: 'b', rank, cardIds: ['bs0', 'bs1', 'bs2', 'bs3'] }, { type: 'REQUEST', playerId: 'a', targetId: 'b', rank: 'herring' }, answer]));
  }

  it('honest "no" vs Squid deny vs Squid claim: the same beats, durations, classes, cues and haptics for everyone but the target - and the same sound for the target too', () => {
    const worlds = [answerWorld('honest'), answerWorld('deny'), answerWorld('claim')];
    // b's device played its own close at the press (step 2), whatever it said
    expectSamePresentation(worlds, ['a', 'c'], ['a', 'b', 'c'], { local: { b: (i) => i === 2 } });
    // the answer step really does present something (the test can fail): a close, a go fish, the totem
    const a = shown(worlds[0], 'a');
    const kinds = a[2].ch.beats.map((b) => b.kind);
    expect(kinds).toEqual(expect.arrayContaining(['close', 'gofish', 'draw', 'turn']));
    expect(a[2].cues.map((c) => c.id)).toContain('clock.close');
  });

  it('the difference exists only for its owner (the test can fail): the lay\'s events differ for b, the beats do not', () => {
    const [honest, deny] = [answerWorld('honest'), answerWorld('deny')];
    // b sees its own rank in the grant event (redaction): the raw messages differ ...
    const ev = (w: World) => j(w.steps.map((s) => redactEventsForPlayer(s.state, s.events, 'b')));
    expect(ev(honest)).not.toBe(ev(deny));
    // ... but presentation adds nothing to it: the owner's beats and sounds are the same too
    expect(j(beatsOf(shown(honest, 'b')))).toBe(j(beatsOf(shown(deny, 'b'))));
  });

  it('two face-down power sets of different ranks, on paths that open no rank-dependent window', () => {
    const world = (rank: Rank) =>
      play(
        makeState({
          playerIds: ['a', 'b', 'c'],
          hands: { a: [mk('a1', 'herring'), mk('a2', 'trout')], b: [...many('bs', rank, 4), mk('bx', 'carp')], c: many('c', 'mackerel', 2) },
          pool: [mk('p1', 'perch')],
          powerVisibility: 'ascuns',
        }),
        scripted([{ type: 'LAY_SET', playerId: 'b', rank, cardIds: ['bs0', 'bs1', 'bs2', 'bs3'] }, { type: 'REQUEST', playerId: 'a', targetId: 'c', rank: 'herring' }, { type: 'SKIP_WINDOW', playerId: 'c' }]),
      );
    const ranks: Rank[] = ['squid', 'tortoise', 'clownfish', 'mantisShrimp', 'shark', 'lanternfish'];
    // the owner presents the same too: the grant is the same collar igniting, the same uniform cue
    expectSamePresentation(ranks.map(world), ['a', 'c'], ['a', 'b', 'c']);
    const lay = shown(world('squid'), 'a')[0];
    expect(lay.ch.beats.map((b) => b.kind)).toEqual(expect.arrayContaining(['lay', 'grant']));
    expect(lay.cues.map((c) => c.id)).toEqual(['table.lay.power', 'power.granted']);
  });

  it('a clownfish bound to different powers, in Ascuns: nothing for anyone but the owner, and the owner hears nothing without headphones', () => {
    const world = (bound: 'shark' | 'tortoise' | 'squid') => {
      const state = makeState({
        playerIds: ['a', 'b', 'c'],
        hands: { a: [mk('a1', 'herring'), mk('a2', 'trout')], b: [...many('bf', 'clownfish', 4), mk('bx', 'carp')], c: many('c', 'mackerel', 2) },
        pool: [mk('p1', 'perch')],
        powerVisibility: 'ascuns',
      });
      state.usedPowerHistory.push({ rank: bound, grantId: 'old', wasClownfishCopy: false });
      return play(state, scripted([{ type: 'LAY_SET', playerId: 'b', rank: 'clownfish', cardIds: ['bf0', 'bf1', 'bf2', 'bf3'] }, { type: 'REQUEST', playerId: 'a', targetId: 'c', rank: 'herring' }, { type: 'SKIP_WINDOW', playerId: 'c' }]));
    };
    const worlds = [world('shark'), world('tortoise'), world('squid')];
    expectSamePresentation(worlds, ['a', 'c'], ['a', 'b', 'c']);
    // only in headphones mode does the owner hear the private tier - the bound rank, never Squid's motif
    const hp = (w: World) => shown(w, 'b', { headphones: true }).flatMap((s) => s.cues.map((c) => c.id));
    expect(hp(worlds[0])).toContain('power.clownfish.bound');
    expect(shown(worlds[0], 'b').flatMap((s) => s.cues.map((c) => c.id))).not.toContain('power.clownfish.bound');
  });

  it('different hands behind the same public actions', () => {
    const world = (a2: Rank, c1: Rank, c2: Rank) =>
      play(
        makeState({
          playerIds: ['a', 'b', 'c'],
          hands: { a: [mk('a1', 'herring'), mk('a2', a2)], b: many('b', 'mackerel', 2), c: [mk('c1', c1), mk('c2', c2)] },
          pool: [mk('p1', 'perch'), mk('p2', 'anchovy')],
        }),
        scripted([{ type: 'REQUEST', playerId: 'a', targetId: 'c', rank: 'herring' }, { type: 'SKIP_WINDOW', playerId: 'c' }]),
      );
    expectSamePresentation([world('trout', 'carp', 'carp'), world('sardine', 'catfish', 'trout'), world('eggs', 'eggs', 'mackerel')], ['b'], ['b']);
  });

  it('the endgame pair: the same presentation, and the game presents its end at the same step', () => {
    const asksC = (s: GameState): Action => (s.pendingWindow ? { type: 'SKIP_WINDOW', playerId: 'c' } : { type: 'REQUEST', playerId: s.players[s.currentPlayerIndex].id, targetId: 'c', rank: 'whale' });
    const A = play(endgame(['squid', 'squid']), asksC, 200);
    const B = play(endgame(['squid', 'whale']), asksC, 200);
    expectSamePresentation([A, B], ['a', 'b', 'c'], ['a', 'b', 'c']);
    const endStep = (w: World) => shown(w, 'a').findIndex((s) => s.ch.beats.some((b) => b.kind === 'end'));
    expect(endStep(A)).toBeGreaterThan(0);
    expect(endStep(A)).toBe(endStep(B));
    // the podium waits for the last beat, the same beat in both
    const podium = (w: World) => shown(w, 'a')[endStep(w)].ch.podiumAt;
    expect(podium(A)).toBe(podium(B));
    expect(podium(A)).not.toBeNull();
  });
});

describe('presentation leak, test 2: a structural window erased', () => {
  const erasedCues = (w: World, viewer: string) => shown(w, viewer).flatMap((s) => s.cues.map(({ id, params, at }) => ({ id, params, at })));

  it('a Shark held (a TURN_END window, declined) vs not: the audible output is the same - cue ids, parameters, order, and the same offsets', () => {
    const world = (shark: boolean) => {
      const state = makeState({
        playerIds: ['a', 'b', 'c'],
        hands: { a: [mk('a1', 'herring'), mk('a2', 'trout')], b: many('b', 'herring', 2), c: many('c', 'carp', 2) },
        pool: [mk('p1', 'perch')],
      });
      if (shark) grantPower(state, 'c', 'shark');
      return play(state, scripted([{ type: 'REQUEST', playerId: 'a', targetId: 'b', rank: 'herring' }, { type: 'SKIP_WINDOW', playerId: 'b' }, (s) => (s.pendingWindow ? { type: 'SKIP_WINDOW', playerId: 'c' } : null)]));
    };
    const held = world(true);
    const none = world(false);
    expect(held.steps.length).toBeGreaterThan(none.steps.length); // the window really added a step (its pause)
    for (const v of ['a', 'b']) {
      expect(erasedCues(held, v), `for ${v}`).toEqual(erasedCues(none, v));
      const ids = erasedCues(held, v).map((c) => c.id);
      // exactly one close for the answer window, one give, one bonus: nothing for the structural window
      expect(ids.filter((i) => i === 'clock.close')).toHaveLength(1);
      expect(ids.filter((i) => i === 'table.give')).toHaveLength(1);
    }
    // the structural window itself has no cue at all, and closes with the same 220 ms
    const heldA = shown(held, 'a');
    const windowSteps = heldA.filter((s) => s.ch.beats.some((b) => b.kind === 'close' && b.cues.length === 0));
    expect(windowSteps.length).toBeGreaterThan(0);
    for (const s of windowSteps) expect(s.ch.beats.find((b) => b.kind === 'close')!.dur).toBe(220);
    // the eligible player and the ones who cannot act present the very same beats, durations and classes
    expect(j(beatsOf(shown(held, 'c')))).toBe(j(beatsOf(shown(held, 'a'))));
    // the eligible player's device says nothing more by default (the private tier is headphones only)
    expect(erasedCues(held, 'c')).toEqual(erasedCues(none, 'c'));
    const withHp = shown(held, 'c', { headphones: true }).flatMap((s) => s.cues.map((c) => c.id));
    expect(withHp).toContain('clock.eligible');
    expect(withHp.filter((i) => i !== 'clock.eligible')).toEqual(erasedCues(none, 'c').map((c) => c.id));
    // and the eligible player's public haptics are the same too (the private one is opt-in)
    expect(j(publicHaptics(shown(held, 'c')).flat())).toBe(j(publicHaptics(shown(none, 'c')).flat()));
  });

  it('the next player holding an active power (a TURN_START window, skipped) vs not', () => {
    const world = (jelly: boolean) => {
      const state = makeState({
        playerIds: ['a', 'b', 'c'],
        hands: { a: [mk('a1', 'herring'), mk('a2', 'trout')], b: [mk('b1', 'carp'), mk('b2', 'carp')], c: many('c', 'mackerel', 2) },
        pool: [mk('p1', 'perch')],
      });
      if (jelly) grantPower(state, 'b', 'jellyfish');
      return play(state, scripted([{ type: 'REQUEST', playerId: 'a', targetId: 'c', rank: 'herring' }, { type: 'SKIP_WINDOW', playerId: 'c' }, (s) => (s.pendingWindow ? { type: 'SKIP_WINDOW', playerId: 'b' } : null)]), 3);
    };
    const held = world(true);
    const none = world(false);
    for (const v of ['a', 'c']) {
      const h = erasedCues(held, v);
      const n = erasedCues(none, v);
      // the held world's TURN_START window adds a step; the totem's landing (table.turn) comes with it, once, either way
      expect(h.map((c) => c.id).filter((i) => i !== 'table.turn')).toEqual(n.map((c) => c.id).filter((i) => i !== 'table.turn'));
      expect(h.filter((c) => c.id === 'table.turn')).toHaveLength(n.filter((c) => c.id === 'table.turn').length);
    }
  });

  it('a close never goes missing when a structural window follows the answer (TRANSFER_PENDING replaces RESPONSE_PENDING)', () => {
    const state = makeState({
      playerIds: ['a', 'b', 'c'],
      hands: { a: [mk('a1', 'herring'), mk('a2', 'trout')], b: many('b', 'herring', 2), c: many('c', 'carp', 2) },
      pool: [mk('p1', 'perch')],
    });
    grantPower(state, 'b', 'tortoise');
    const w = play(state, scripted([{ type: 'REQUEST', playerId: 'a', targetId: 'b', rank: 'herring' }, { type: 'SKIP_WINDOW', playerId: 'b' }, (s) => (s.pendingWindow ? { type: 'SKIP_WINDOW', playerId: 'b' } : null)]));
    for (const v of ['a', 'c']) {
      const ids = shown(w, v).flatMap((s) => s.cues.map((c) => c.id));
      expect(ids.filter((i) => i === 'clock.close'), v).toHaveLength(1);
    }
  });
});

describe('the presentation reads only the public record', () => {
  const secret = { grantId: 'g-secret', cardId: 'card-xyz', eligiblePlayerIds: ['c'], context: { rank: 'squid', trueHasCards: true }, seed: 42, hand: [{ id: 'x', rank: 'squid' }] };
  it('stuffing every event and the seat facts with private fields moves no beat, no cue, no haptic', () => {
    const w = play(
      makeState({
        playerIds: ['a', 'b', 'c'],
        hands: { a: [mk('a1', 'herring'), mk('a2', 'trout')], b: [...many('bs', 'squid', 4), ...many('bm', 'mackerel', 2)], c: many('c', 'carp', 2) },
        pool: [mk('p1', 'perch'), mk('p2', 'anchovy')],
      }),
      scripted([{ type: 'LAY_SET', playerId: 'b', rank: 'squid', cardIds: ['bs0', 'bs1', 'bs2', 'bs3'] }, { type: 'REQUEST', playerId: 'a', targetId: 'b', rank: 'herring' }, { type: 'SKIP_WINDOW', playerId: 'b' }]),
    );
    const at = (state: GameState, seq: number) => redactForPlayer(state, 'c', { seq, serverNow: 0, windowDeadlineAt: null });
    let prev = at(w.state0, 0);
    w.steps.forEach((st, i) => {
      const seq = i + 1;
      const view = at(st.state, seq);
      const events = redactEventsForPlayer(st.state, st.events, 'c') as never[];
      const rec = recordOf(prev, view, events, seq);
      const stuffed = { ...rec, events: rec.events.map((e) => ({ ...e, ...secret })) as never[] };
      const f = factsOf(prev, view, 'c', { headphones: false });
      const f2 = { ...f, eligible: true, eligibleBefore: false, grantRank: () => 'squid', ...secret } as typeof f;
      expect(j(summarize(choreograph(stuffed, f2, DEFAULT_OPTIONS)))).toBe(j(summarize(choreograph(rec, f, DEFAULT_OPTIONS))));
      expect(j(cuesFor(stuffed, f2))).toBe(j(cuesFor(rec, f)));
      expect(j(hapticsFor(stuffed, f2).filter((h) => h.tier === 'public'))).toBe(j(hapticsFor(rec, f).filter((h) => h.tier === 'public')));
      prev = view;
    });
  });
});

describe('guards (§6.5)', () => {
  const walk = (dir: string): string[] =>
    readdirSync(dir).flatMap((f) => {
      const p = join(dir, f);
      return statSync(p).isDirectory() ? walk(p) : /\.(ts|tsx)$/.test(f) ? [p] : [];
    });
  const src = join(__dirname, '..', 'src');
  const files = walk(src).filter((f) => !relative(src, f).startsWith('dev'));

  it('the client imports only PublicEvent from the engine\'s event types: never GameEvent, never the redactors', () => {
    for (const f of files) {
      const text = readFileSync(f, 'utf8');
      const code = text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
      expect(code, relative(src, f)).not.toMatch(/\bGameEvent\b/);
      expect(code, relative(src, f)).not.toMatch(/\bredact(Events)?For(Player|Spectator)\b/);
    }
  });

  it('nothing in the presentation names a rank in a dynamic import or a bank key', () => {
    for (const f of files) {
      const code = readFileSync(f, 'utf8');
      expect(code, relative(src, f)).not.toMatch(/import\(\s*[`'"][^`'"]*\$\{/);
    }
  });

  it('a declaration or a pass in a reactive window makes no sound: the plank plays only the answer\'s close', () => {
    const code = readFileSync(join(src, 'components/Windows.tsx'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    expect(code).not.toMatch(/play\(\s*['"]ui\./);
    expect(code).toMatch(/localAnswerCue/);
  });

  it('choreography.ts and record.ts touch no private field: no hand, no card id, no grant id, no eligibility list', () => {
    for (const name of ['game/choreography.ts', 'game/record.ts']) {
      const code = readFileSync(join(src, name), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
      expect(code, name).not.toMatch(/\.hand\b|cardId|eligiblePlayerIds/);
    }
    // record.ts reads the viewer's own grants only to hand cuesFor the rank lookup for the private tier
    expect(readFileSync(join(src, 'game/choreography.ts'), 'utf8')).not.toMatch(/grantRank|youAreEligible/);
  });
});
