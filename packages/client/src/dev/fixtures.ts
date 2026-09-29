/* Scenario fixtures (§7.2): tables set up so a layout, a window or an ending can be looked at (and
 * asserted by tools/layout-check.cjs) without playing to it. Each is built by scripting the real
 * engine - a set is laid, an ask is made and answered - so every window is one the rules open, and
 * only where that cannot be done (the tally, the gate, names, connection flags) does it write the
 * state or the view directly. Lazy-loaded with the bot table. */
import { createGame, reduce, type Action, type Card, type GameEvent, type GameState, type Rank, type RedactedView } from '@pescuit/engine';
import type { DriverOptions } from './driver.js';
import { NAMES } from './driver.js';

export interface FixtureSpec {
  id: string;
  label: string;
  build(n: number, seed: number, seat: number): Omit<DriverOptions, 'bots' | 'speed' | 'seed' | 'humanId'> & { seat: number };
}

const LONG = ['Alexandru-Constantin Pop', 'Bogdan-Gheorghe Ionescu-X', 'Cezara Maria Popescu-Vlad', 'Dumitrița Anastasia Rusu', 'Eugenia-Valentina Marinescu', 'Florentin Ștefănescu-Radu'].map((s) => s.slice(0, 24));

/** Builds a fresh game with `humanSeat` named "Tu". */
function fresh(n: number, seed: number, seat: number, names?: string[]) {
  let k = 0;
  const players = Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: i === seat ? 'Tu' : (names?.[i] ?? NAMES[k++ % NAMES.length]) }));
  const g = createGame(players, seed);
  return new Script(g.state, g.events, players[seat].id);
}

class Script {
  constructor(
    public state: GameState,
    public events: GameEvent[],
    public me: string,
  ) {}
  id(i: number) {
    return this.state.players[i].id;
  }
  do(a: Action) {
    const r = reduce(this.state, a);
    this.state = r.state;
    this.events.push(...r.events);
    return this;
  }
  /** Gives players exactly these hands (ranks), taking the cards from the pool and the other hands. */
  deal(want: Record<string, Rank[]>) {
    const s = this.state;
    const all: Card[] = [...s.players.flatMap((p) => p.hand), ...s.pool];
    const take = (rank: Rank): Card => {
      const i = all.findIndex((c) => c.rank === rank);
      if (i < 0) throw new Error(`fixture: no ${rank} left to deal`);
      return all.splice(i, 1)[0];
    };
    const sizes = new Map(s.players.map((p) => [p.id, p.hand.length]));
    for (const p of s.players) if (want[p.id]) p.hand = want[p.id].map(take);
    for (const p of s.players) if (!want[p.id]) p.hand = all.splice(0, sizes.get(p.id)!);
    s.pool = all;
    return this;
  }
  /** Moves the pool into the hands, leaving `keep` cards in it. */
  drain(keep = 0) {
    const s = this.state;
    // into the other hands: a dry pond is where the cards went, but your own hand stays readable
    const to = s.players.filter((p) => p.id !== this.me);
    let i = 0;
    while (s.pool.length > keep) to[i++ % to.length].hand.push(s.pool.pop()!);
    return this;
  }
  /** `asker` asks `target` for a rank the target lacks and is told to go fish. */
  failAsk(asker: string, target: string) {
    const a = this.state.players.find((p) => p.id === asker)!;
    const t = this.state.players.find((p) => p.id === target)!;
    const rank = a.hand.find((c) => c.rank !== 'eggs' && !t.hand.some((x) => x.rank === c.rank))?.rank;
    if (!rank) throw new Error('fixture: no failing ask');
    return this.do({ type: 'REQUEST', playerId: asker, targetId: target, rank }).do({ type: 'SKIP_WINDOW', playerId: target });
  }
  lay(pid: string, rank: Rank, eggs = 0) {
    const p = this.state.players.find((x) => x.id === pid)!;
    const cards = p.hand.filter((c) => c.rank === rank).slice(0, (rank === 'eggs' ? 4 : rank === 'squid' || isPower(rank) ? 4 : 3) - eggs);
    const egg = p.hand.filter((c) => c.rank === 'eggs').slice(0, eggs);
    return this.do({ type: 'LAY_SET', playerId: pid, rank, cardIds: [...cards, ...egg].map((c) => c.id) });
  }
  out(extra: Partial<DriverOptions> = {}) {
    return { state: this.state, events: this.events.slice(-8), humanId: this.me, ...extra };
  }
}

const POWERS: Rank[] = ['squid', 'shark', 'tortoise', 'jellyfish', 'lanternfish', 'stickleback', 'mantisShrimp', 'whale', 'clownfish'];
const isPower = (r: Rank) => POWERS.includes(r);
const rep = (r: Rank, n: number): Rank[] => Array.from({ length: n }, () => r);

/** the human's turn at a table whose windows are quiet: a mixed hand with a layable set */
const MY_HAND: Rank[] = ['shark', 'tortoise', 'tortoise', 'jellyfish', 'herring', 'herring', 'eggs', 'catfish', 'trout'];

/** rotate turns until `me` is current, by failed asks (uses the pool) */
function toMyTurn(sc: Script) {
  let guard = 0;
  while (sc.state.players[sc.state.currentPlayerIndex].id !== sc.me && guard++ < 12) {
    const cur = sc.state.players[sc.state.currentPlayerIndex].id;
    const other = sc.state.players.find((p) => p.id !== cur)!.id;
    sc.failAsk(cur, other);
  }
  return sc;
}

export const FIXTURES: FixtureSpec[] = [
  {
    id: 'myturn',
    label: 'Your turn, nine cards, a set ready to lay',
    build(n, seed, seat) {
      const sc = fresh(n, seed, seat);
      sc.deal({ [sc.me]: MY_HAND });
      toMyTurn(sc);
      return { ...sc.out(), seat, frozen: false };
    },
  },
  {
    id: 'chips',
    label: 'Chip states: stunned, protected, away, long names',
    build(n, seed, seat) {
      const sc = fresh(n, seed, seat, LONG);
      sc.deal({ [sc.me]: MY_HAND });
      toMyTurn(sc);
      const others = sc.state.players.filter((p) => p.id !== sc.me);
      if (others[1]) others[1].stunned = true;
      if (others[2]) sc.state.tortoiseProtections.push({ id: 'tp1', ownerId: others[2].id, rank: 'herring', expiresAtNextTurnOf: others[2].id });
      if (others[3]) others[3].connected = false;
      if (others[0]) others[0].score = 11;
      return { ...sc.out(), seat, frozen: false };
    },
  },
  {
    id: 'answer',
    label: 'You are asked (answer plank)',
    build(n, seed, seat) {
      const sc = fresh(n, seed, seat);
      const asker = sc.id(seat === 0 ? 1 : 0);
      sc.deal({ [sc.me]: ['tortoise', 'tortoise', 'herring', 'catfish', 'trout', 'mackerel', 'eggs'], [asker]: ['tortoise', 'sardine', 'carp', 'perch', 'anchovy', 'mackerel', 'catfish'] });
      sc.state.currentPlayerIndex = sc.state.players.findIndex((p) => p.id === asker);
      sc.state.resume = { kind: 'AWAIT_REQUEST', playerId: asker };
      sc.do({ type: 'REQUEST', playerId: asker, targetId: sc.me, rank: 'tortoise' });
      return { ...sc.out(), seat };
    },
  },
  {
    id: 'answer-squid',
    label: 'You are asked and hold Squid (two equal buttons)',
    build(n, seed, seat) {
      const sc = fresh(n, seed, seat);
      const asker = sc.id(seat === 0 ? 1 : 0);
      sc.deal({ [sc.me]: ['squid', 'squid', 'squid', 'squid', 'herring', 'catfish', 'trout'], [asker]: ['herring', 'sardine', 'carp', 'perch', 'anchovy', 'mackerel', 'catfish'] });
      sc.lay(sc.me, 'squid');
      sc.state.currentPlayerIndex = sc.state.players.findIndex((p) => p.id === asker);
      sc.state.resume = { kind: 'AWAIT_REQUEST', playerId: asker };
      sc.do({ type: 'REQUEST', playerId: asker, targetId: sc.me, rank: 'herring' });
      return { ...sc.out(), seat };
    },
  },
  {
    id: 'shark',
    label: 'A shark window is open (you hold Shark)',
    build(n, seed, seat) {
      const sc = fresh(n, seed, seat === 0 ? 1 : seat);
      const s = seat === 0 ? 1 : seat;
      const asker = sc.id(s === 0 ? 1 : 0);
      const target = sc.state.players.find((p) => p.id !== sc.me && p.id !== asker)!.id;
      sc.deal({ [sc.me]: ['shark', 'shark', 'shark', 'shark', 'catfish', 'trout', 'perch'], [asker]: ['herring', 'carp', 'anchovy', 'mackerel', 'sardine', 'catfish', 'trout'], [target]: ['herring', 'herring', 'carp', 'perch', 'anchovy', 'sardine', 'mackerel'] });
      sc.lay(sc.me, 'shark');
      sc.state.currentPlayerIndex = sc.state.players.findIndex((p) => p.id === asker);
      sc.state.resume = { kind: 'AWAIT_REQUEST', playerId: asker };
      sc.do({ type: 'REQUEST', playerId: asker, targetId: target, rank: 'herring' }).do({ type: 'SKIP_WINDOW', playerId: target });
      return { ...sc.out(), seat: s };
    },
  },
  {
    id: 'mantis',
    label: 'A mantis strike: a power set was just laid (you hold Mantis Shrimp)',
    build(n, seed, seat) {
      const s = seat === 0 ? 1 : seat;
      const sc = fresh(n, seed, s);
      const other = sc.id(s === 0 ? 1 : 0);
      sc.deal({ [sc.me]: ['mantisShrimp', 'mantisShrimp', 'mantisShrimp', 'mantisShrimp', 'catfish', 'trout', 'perch'], [other]: ['squid', 'squid', 'squid', 'squid', 'herring', 'carp', 'anchovy'] });
      sc.lay(sc.me, 'mantisShrimp');
      sc.lay(other, 'squid');
      return { ...sc.out(), seat: s };
    },
  },
  {
    id: 'whale',
    label: 'Whale between full hands (TURN_START: pick a pair)',
    build(n, seed, seat) {
      const sc = fresh(n, seed, seat);
      sc.deal({ [sc.me]: ['whale', 'whale', 'whale', 'whale', 'catfish', 'trout', 'perch'] });
      sc.lay(sc.me, 'whale');
      sc.state.currentPlayerIndex = (sc.state.players.findIndex((p) => p.id === sc.me) + n - 1) % n;
      sc.state.resume = { kind: 'AWAIT_REQUEST', playerId: sc.state.players[sc.state.currentPlayerIndex].id };
      let g = 0;
      while (!sc.state.pendingWindow && g++ < 12) {
        const cur = sc.state.players[sc.state.currentPlayerIndex].id;
        const other = sc.state.players.find((p) => p.id !== cur)!.id;
        sc.failAsk(cur, other);
      }
      return { ...sc.out(), seat };
    },
  },
  {
    id: 'actives',
    label: 'All three active powers at once (the tallest plank)',
    build(n, seed, seat) {
      const sc = fresh(n, seed, seat);
      sc.deal({ [sc.me]: [...rep('whale', 4), ...rep('jellyfish', 4), ...rep('stickleback', 4), 'catfish', 'trout'] });
      sc.lay(sc.me, 'whale').lay(sc.me, 'jellyfish').lay(sc.me, 'stickleback');
      sc.state.currentPlayerIndex = (sc.state.players.findIndex((p) => p.id === sc.me) + n - 1) % n;
      sc.state.resume = { kind: 'AWAIT_REQUEST', playerId: sc.state.players[sc.state.currentPlayerIndex].id };
      let g = 0;
      while (!sc.state.pendingWindow && g++ < 12) {
        const cur = sc.state.players[sc.state.currentPlayerIndex].id;
        const other = sc.state.players.find((p) => p.id !== cur)!.id;
        sc.failAsk(cur, other);
      }
      return { ...sc.out(), seat };
    },
  },
  {
    id: 'pool1',
    label: 'The pool is at one card',
    build(n, seed, seat) {
      const sc = fresh(n, seed, seat);
      sc.deal({ [sc.me]: MY_HAND }).drain(1);
      toMyTurn(sc);
      return { ...sc.out(), seat };
    },
  },
  {
    id: 'dry',
    label: 'The pool is dry (neutral go fish), your turn',
    build(n, seed, seat) {
      const sc = fresh(n, seed, seat);
      sc.deal({ [sc.me]: MY_HAND }).drain(0);
      sc.state.currentPlayerIndex = sc.state.players.findIndex((p) => p.id === sc.me);
      sc.state.resume = { kind: 'AWAIT_REQUEST', playerId: sc.me };
      return { ...sc.out(), seat };
    },
  },
  {
    id: 'tally1',
    label: 'The tally is at 1 (the last set)',
    build(n, seed, seat) {
      const sc = fresh(n, seed, seat);
      sc.deal({ [sc.me]: MY_HAND });
      toMyTurn(sc);
      const patch = (v: RedactedView): RedactedView => ({ ...v, sets: { ...v.sets, possible: 1 } });
      return { ...sc.out(), seat, viewPatch: patch };
    },
  },
  {
    id: 'stall',
    label: 'A stall: the gate at 2N-2',
    build(n, seed, seat) {
      const sc = fresh(n, seed, seat);
      sc.deal({ [sc.me]: MY_HAND }).drain(0);
      sc.state.currentPlayerIndex = sc.state.players.findIndex((p) => p.id === sc.me);
      sc.state.resume = { kind: 'AWAIT_REQUEST', playerId: sc.me };
      sc.state.staleRequestStreak = 2 * n - 2;
      return { ...sc.out(), seat };
    },
  },
  {
    id: 'tenhand',
    label: 'A ten-card hand',
    build(n, seed, seat) {
      const sc = fresh(n, seed, seat);
      sc.deal({ [sc.me]: ['shark', 'tortoise', 'jellyfish', 'lanternfish', 'whale', 'herring', 'mackerel', 'anchovy', 'sardine', 'eggs'] });
      toMyTurn(sc);
      return { ...sc.out(), seat };
    },
  },
  {
    id: 'twelvehand',
    label: 'Twelve distinct groups (the dock scrolls)',
    build(n, seed, seat) {
      const sc = fresh(n, seed, seat);
      sc.deal({ [sc.me]: ['squid', 'shark', 'tortoise', 'jellyfish', 'lanternfish', 'stickleback', 'mantisShrimp', 'whale', 'herring', 'mackerel', 'anchovy', 'eggs'] });
      toMyTurn(sc);
      return { ...sc.out(), seat };
    },
  },
  {
    id: 'names',
    label: 'Six 24-character names',
    build(n, seed, seat) {
      const sc = fresh(n, seed, seat, LONG);
      sc.deal({ [sc.me]: MY_HAND });
      toMyTurn(sc);
      return { ...sc.out(), seat };
    },
  },
];
