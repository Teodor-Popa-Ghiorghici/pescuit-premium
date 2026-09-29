// FEEL_VISUAL_SOUND_PLAN §6.5 — "presentation never adds information", at the event and view
// layer (M0). Test 1: pairs of histories with identical public records must produce identical
// redacted streams, views and end timing for everyone who is not an owner of the difference.
// Test 2 (event part): pairs whose records differ ONLY by a structural window that opens and
// closes without a declaration produce the same stream once those window events are erased.
// M1 extends both to choreography.ts, cues.ts and the haptics map.
import { describe, expect, it } from 'vitest';
import { reduce } from '../src/engine.js';
import { redactEventsForPlayer, redactEventsForSpectator, redactForPlayer, redactForSpectator } from '../src/redact.js';
import { Action, Card, GameEvent, GameState, Rank } from '../src/types.js';
import { endgame } from './endgamePair.js';
import { laidSet, makeState } from './helpers.js';
import { grantPower } from './powers/grantHelper.js';

const mk = (id: string, rank: Rank): Card => ({ id, rank });
const many = (prefix: string, rank: Rank, n: number): Card[] => Array.from({ length: n }, (_, i) => mk(`${prefix}${i}`, rank));

// ---- a tiny server: stamps seq like the room does, redacts per viewer --------------------------

interface Step {
  action: Action;
  state: GameState;
  events: (GameEvent & { seq: number })[];
}

function play(state0: GameState, driver: (s: GameState) => Action | null, maxSteps = 60): Step[] {
  const steps: Step[] = [];
  let state = state0;
  let seq = 0;
  for (let i = 0; i < maxSteps && state.status === 'IN_PROGRESS'; i++) {
    const action = driver(state);
    if (!action) break;
    const r = reduce(state, action);
    state = r.state;
    steps.push({ action, state, events: r.events.map((e) => ({ ...e, seq: ++seq })) });
  }
  return steps;
}

const scripted = (actions: Array<Action | ((s: GameState) => Action | null)>) => {
  let i = 0;
  return (s: GameState) => {
    const a = actions[i++];
    return a === undefined ? null : typeof a === 'function' ? a(s) : a;
  };
};

const grantOf = (s: GameState, ownerId: string, rank: string) => s.powerGrants.find((g) => g.ownerId === ownerId && g.rank === rank)!.id;

/** every event the viewer received, step by step */
const eventsFor = (steps: Step[], viewer: string) => steps.map((st) => redactEventsForPlayer(st.state, st.events, viewer));
const viewsFor = (steps: Step[], viewer: string) =>
  steps.map((st, i) => redactForPlayer(st.state, viewer, { seq: st.events[st.events.length - 1]?.seq ?? i, serverNow: 0 }));
const specEvents = (steps: Step[]) => steps.map((st) => redactEventsForSpectator(st.state, st.events));
const specViews = (steps: Step[]) => steps.map((st) => redactForSpectator(st.state, { seq: st.events[st.events.length - 1]?.seq ?? 0 }));
const j = (x: unknown) => JSON.stringify(x);

/** For every viewer in `viewers`, streams and views must match across all worlds. */
function expectSameForViewers(worlds: Step[][], viewers: string[], opts: { views?: boolean } = {}) {
  const [first, ...rest] = worlds;
  for (const w of rest) {
    expect(w.length).toBe(first.length);
    for (const v of viewers) {
      expect(j(eventsFor(w, v)), `events for ${v}`).toBe(j(eventsFor(first, v)));
      if (opts.views !== false) expect(j(viewsFor(w, v)), `views for ${v}`).toBe(j(viewsFor(first, v)));
    }
    expect(j(specEvents(w))).toBe(j(specEvents(first)));
    expect(j(specViews(w))).toBe(j(specViews(first)));
  }
}

// ---- test 1 -------------------------------------------------------------------------------------

describe('presentation leak, test 1: same public record, same stream', () => {
  /** b lays a hidden power set of `rank` (4 cards) and keeps two more cards; then a asks b for herring. */
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
      kind === 'honest'
        ? { type: 'SKIP_WINDOW', playerId: 'b' }
        : { type: 'DECLARE_SQUID', playerId: 'b', grantId: grantOf(s, 'b', 'squid'), lie: kind === 'deny' ? 'deny' : 'claim' };
    return play(
      state,
      scripted([
        { type: 'LAY_SET', playerId: 'b', rank, cardIds: ['bs0', 'bs1', 'bs2', 'bs3'] },
        { type: 'REQUEST', playerId: 'a', targetId: 'b', rank: 'herring' },
        answer,
      ]),
    );
  }

  it('honest "no" vs Squid deny vs Squid claim: identical for everyone but the target', () => {
    const [honest, deny, claim] = [answerWorld('honest'), answerWorld('deny'), answerWorld('claim')];
    expectSameForViewers([honest, deny, claim], ['a', 'c']);
    // and the answer step itself has one shape, in all three
    const shape = (w: Step[]) => w[2].events.map((e) => ('window' in e ? `${e.type}(${e.window})` : e.type));
    expect(shape(honest)).toEqual(shape(deny));
    expect(shape(honest)).toEqual(shape(claim));
    expect(shape(honest).slice(0, 2)).toEqual(['WINDOW_CLOSED(RESPONSE_PENDING)', 'REQUEST_FAILED']);
  });

  it('the difference exists only for its owner (the test can fail)', () => {
    const [honest, deny] = [answerWorld('honest'), answerWorld('deny')];
    // b, who laid the set, DOES see the rank in the grant event
    expect(j(eventsFor(honest, 'b'))).not.toBe(j(eventsFor(deny, 'b')));
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
        scripted([
          { type: 'LAY_SET', playerId: 'b', rank, cardIds: ['bs0', 'bs1', 'bs2', 'bs3'] },
          { type: 'REQUEST', playerId: 'a', targetId: 'c', rank: 'herring' },
          { type: 'SKIP_WINDOW', playerId: 'c' },
        ]),
      );
    // (not the three active powers: the next player's TURN_START window would open — a rules tell, §6.6)
    const ranks: Rank[] = ['squid', 'tortoise', 'clownfish', 'mantisShrimp', 'shark', 'lanternfish'];
    expectSameForViewers(ranks.map(world), ['a', 'c']);
  });

  it('a clownfish bound to different powers, in Ascuns', () => {
    const world = (bound: 'shark' | 'tortoise' | 'squid') => {
      const state = makeState({
        playerIds: ['a', 'b', 'c'],
        hands: { a: [mk('a1', 'herring'), mk('a2', 'trout')], b: [...many('bf', 'clownfish', 4), mk('bx', 'carp')], c: many('c', 'mackerel', 2) },
        pool: [mk('p1', 'perch')],
        powerVisibility: 'ascuns',
      });
      state.usedPowerHistory.push({ rank: bound, grantId: 'old', wasClownfishCopy: false });
      return play(
        state,
        scripted([
          { type: 'LAY_SET', playerId: 'b', rank: 'clownfish', cardIds: ['bf0', 'bf1', 'bf2', 'bf3'] },
          { type: 'REQUEST', playerId: 'a', targetId: 'c', rank: 'herring' },
          { type: 'SKIP_WINDOW', playerId: 'c' },
        ]),
      );
    };
    const worlds = [world('shark'), world('tortoise'), world('squid')];
    expectSameForViewers(worlds, ['a', 'c']);
    // the owner learns the binding
    const bound = (w: Step[]) => eventsFor(w, 'b').flat().find((e) => e.type === 'CLOWNFISH_BOUND') as any;
    expect(bound(worlds[0]).boundRank).toBe('shark');
    expect(bound(worlds[1]).boundRank).toBe('tortoise');
  });

  it('different hands behind the same public actions', () => {
    const world = (a2: Rank, c1: Rank, c2: Rank) =>
      play(
        makeState({
          playerIds: ['a', 'b', 'c'],
          hands: { a: [mk('a1', 'herring'), mk('a2', a2)], b: many('b', 'mackerel', 2), c: [mk('c1', c1), mk('c2', c2)] },
          pool: [mk('p1', 'perch'), mk('p2', 'anchovy')],
        }),
        scripted([
          { type: 'REQUEST', playerId: 'a', targetId: 'c', rank: 'herring' },
          { type: 'SKIP_WINDOW', playerId: 'c' },
        ]),
      );
    // b never learns a's or c's hands, whatever they are (herring is never in c's hand: same public "no")
    expectSameForViewers([world('trout', 'carp', 'carp'), world('sardine', 'catfish', 'trout'), world('eggs', 'eggs', 'mackerel')], ['b']);
  });

  it('the endgame pair: same sets.possible after every action, and the game ends at the same seq', () => {
    const asksC = (s: GameState): Action => {
      if (s.pendingWindow) return { type: 'SKIP_WINDOW', playerId: 'c' };
      return { type: 'REQUEST', playerId: s.players[s.currentPlayerIndex].id, targetId: 'c', rank: 'whale' };
    };
    const A = play(endgame(['squid', 'squid']), asksC, 200);
    const B = play(endgame(['squid', 'whale']), asksC, 200);
    expect(A.length).toBe(B.length);
    // hands differ (and so do the players' own views), but the public record does not
    expect(j(specEvents(A))).toBe(j(specEvents(B)));
    expect(j(specViews(A))).toBe(j(specViews(B)));
    for (const v of ['a', 'b', 'c']) expect(j(eventsFor(A, v))).toBe(j(eventsFor(B, v)));
    expect(A.map((s) => redactForSpectator(s.state).sets.possible)).toEqual(B.map((s) => redactForSpectator(s.state).sets.possible));
    // they end together, on the 2N rule: the check that read true ranks would have ended B at once
    const endSeq = (w: Step[]) => w.flatMap((s) => s.events).find((e) => e.type === 'GAME_ENDED')?.seq;
    expect(endSeq(A)).toBeDefined();
    expect(endSeq(A)).toBe(endSeq(B));
    expect(A[A.length - 1].state.endReason).toBe('streak');
    expect(B[B.length - 1].state.endReason).toBe('streak');
    // and the first ask in B did not end the game (a check on true ranks would have)
    expect(B[0].state.status).toBe('IN_PROGRESS');
    // the count stays at least 1 until the end (the two hidden sets could be Squid + Squid)
    for (const s of B.slice(0, -1)) expect(redactForSpectator(s.state).sets.possible).toBeGreaterThan(0);
  });
});

// ---- test 2 (event part) ---------------------------------------------------------------------------

describe('presentation leak, test 2 (event part): a structural window erased', () => {
  /** everything but the events of windows that are NOT the answer window, and the seq numbers they consumed */
  const erased = (steps: Step[], viewer: string) =>
    eventsFor(steps, viewer)
      .flat()
      .filter((e) => !((e.type === 'WINDOW_OPENED' || e.type === 'WINDOW_CLOSED') && e.window !== 'RESPONSE_PENDING'))
      .map(({ seq: _seq, ...rest }) => rest as any);

  it('a Shark held (a TURN_END window, declined) vs not', () => {
    const world = (shark: boolean) => {
      const state = makeState({
        playerIds: ['a', 'b', 'c'],
        hands: { a: [mk('a1', 'herring'), mk('a2', 'trout')], b: many('b', 'herring', 2), c: many('c', 'carp', 2) },
        pool: [mk('p1', 'perch')],
      });
      if (shark) grantPower(state, 'c', 'shark');
      return play(
        state,
        scripted([
          { type: 'REQUEST', playerId: 'a', targetId: 'b', rank: 'herring' },
          { type: 'SKIP_WINDOW', playerId: 'b' },
          (s) => (s.pendingWindow ? { type: 'SKIP_WINDOW', playerId: 'c' } : null),
        ]),
      );
    };
    const held = world(true);
    const none = world(false);
    // the structural window really was there in one world only
    const windows = (w: Step[]) => w.flatMap((s) => s.events).filter((e) => e.type === 'WINDOW_OPENED' && (e as any).window === 'TURN_END');
    expect(windows(held).length).toBe(1);
    expect(windows(none).length).toBe(0);
    for (const v of ['a', 'b']) expect(j(erased(held, v))).toBe(j(erased(none, v)));
    // the answer window's own close is present in both, once
    for (const w of [held, none]) {
      const closes = erased(w, 'a').filter((e) => e.type === 'WINDOW_CLOSED' && e.window === 'RESPONSE_PENDING');
      expect(closes).toHaveLength(1);
    }
  });

  it('the next player holding an active power (a TURN_START window, skipped) vs not', () => {
    const world = (jelly: boolean) => {
      const state = makeState({
        playerIds: ['a', 'b', 'c'],
        hands: { a: [mk('a1', 'herring'), mk('a2', 'trout')], b: [mk('b1', 'carp'), mk('b2', 'carp')], c: many('c', 'mackerel', 2) },
        pool: [mk('p1', 'perch')],
      });
      if (jelly) grantPower(state, 'b', 'jellyfish');
      return play(
        state,
        scripted([
          { type: 'REQUEST', playerId: 'a', targetId: 'c', rank: 'herring' },
          { type: 'SKIP_WINDOW', playerId: 'c' },
          (s) => (s.pendingWindow ? { type: 'SKIP_WINDOW', playerId: 'b' } : null),
        ]),
        3,
      );
    };
    const held = world(true);
    const none = world(false);
    expect(held[1].events.some((e) => e.type === 'WINDOW_OPENED' && (e as any).window === 'TURN_START')).toBe(true);
    expect(none[1].events.some((e) => e.type === 'WINDOW_OPENED')).toBe(false);
    // b is the eligible player, so compare what a and c see
    for (const v of ['a', 'c']) expect(j(erased(held, v))).toBe(j(erased(none, v)));
  });
});
