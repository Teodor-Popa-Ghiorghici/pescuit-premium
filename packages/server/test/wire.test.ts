// The wire test of FEEL_VISUAL_SOUND_PLAN §6.3 and the secrecy guarantees of §6.1, checked on the
// exact bytes the room serializes to every player's socket over whole bot games.
import { afterEach, describe, expect, it } from 'vitest';
import { deckProblem } from '@pescuit/engine';
import type { ServerMessage } from '@pescuit/shared';
import { secureDeck, secureEntropy } from '../src/random.js';
import { makeRoom, playRoomGame } from './support.js';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const FORBIDDEN_KEYS = ['seed', 'rngState', 'entropy', 'eligiblePlayerIds'];

function walk(x: unknown, visit: (key: string | null, value: unknown) => void, key: string | null = null) {
  visit(key, x);
  if (Array.isArray(x)) x.forEach((v) => walk(v, visit, key));
  else if (x && typeof x === 'object') for (const [k, v] of Object.entries(x)) walk(v, visit, k);
}

const rooms: Array<{ dispose(): void }> = [];
afterEach(() => {
  while (rooms.length) rooms.pop()!.dispose();
});

describe('the deal (§6.3)', () => {
  it('a server deck is a legal 66-card deck of random v4 UUIDs, independent of rank', () => {
    const deck = secureDeck();
    expect(deckProblem(deck)).toBeNull();
    for (const c of deck) expect(c.id).toMatch(UUID_V4);
    // the canonical order is rank-sorted; a real shuffle does not keep it (the chance of that is 1 in 66!)
    const ranks = deck.map((c) => c.rank);
    expect(ranks).not.toEqual([...ranks].sort());
  });

  it('two decks differ, and the top card varies across many decks (no seed to recover)', () => {
    const tops = new Set<string>();
    const ids = new Set<string>();
    for (let i = 0; i < 200; i++) {
      const d = secureDeck();
      tops.add(d[0].rank);
      d.forEach((c) => ids.add(c.id));
    }
    expect(tops.size).toBeGreaterThan(8);
    expect(ids.size).toBe(200 * 66); // ids never repeat across decks
  });

  it('whale entropy is 128 fresh bits every time', () => {
    const e = secureEntropy();
    expect(e).toHaveLength(4);
    for (const w of e) expect(Number.isInteger(w) && w >= 0 && w <= 0xffffffff).toBe(true);
    expect(secureEntropy()).not.toEqual(e);
  });
});

describe('what goes over the wire', () => {
  for (const mode of ['ascuns', 'deschis'] as const) {
    it(`every serialized message, whole bot games in Mode ${mode}: no seed/rngState/entropy, v4 UUID card ids, grant ids to owners only, seq strictly increasing`, () => {
      let grantsSeen = 0;
      for (const [n, botSeed] of [[3, 1], [4, 2], [5, 3], [6, 4]] as const) {
        const { room, sockets } = makeRoom(n, { powerVisibility: mode });
        rooms.push(room);
        room.start();
        const idOf = room.players.map((p) => p.id);
        const cardIdsSeenBy: Set<string>[] = idOf.map(() => new Set());
        const grantIdsSeenBy: Set<string>[] = idOf.map(() => new Set());
        const lastSeq: number[] = idOf.map(() => 0);
        let checked = 0;

        const cursor: number[] = idOf.map(() => 0);
        const inspect = () => {
          const state = room.state!;
          sockets.forEach((ws, i) => {
            const strangers = [
              ...state.pool,
              ...state.players.filter((p) => p.id !== idOf[i]).flatMap((p) => p.hand),
            ];
            while (cursor[i] < ws.raw.length) {
              const text = ws.raw[cursor[i]++];
              const msg: ServerMessage = JSON.parse(text);
              walk(msg, (key, value) => {
                if (key && FORBIDDEN_KEYS.includes(key)) throw new Error(`forbidden key "${key}" in ${msg.type}`);
                if (key === 'cardId' && typeof value === 'string') cardIdsSeenBy[i].add(value);
                if (key === 'grantId' && typeof value === 'string') grantIdsSeenBy[i].add(value);
              });
              if (msg.type !== 'game_state') continue;
              for (const c of msg.view.hand) {
                expect(c.id).toMatch(UUID_V4);
                cardIdsSeenBy[i].add(c.id);
              }
              for (const g of msg.view.ownPowerGrants) grantIdsSeenBy[i].add(g.id);
              // seq: strictly increasing on events, and the view sits at (or after) the last event
              for (const e of msg.events) {
                expect(e.seq).toBeGreaterThan(lastSeq[i]);
                lastSeq[i] = e.seq;
              }
              expect(msg.view.seq).toBeGreaterThanOrEqual(lastSeq[i]);
              // nobody else's hand or the pool's cards are in this player's bytes (unless they were
              // this player's own card a moment ago: a card can change hands in one action)
              for (const c of strangers) {
                if (text.includes(c.id) && !cardIdsSeenBy[i].has(c.id)) throw new Error(`card ${c.id} of someone else leaked to player ${i}`);
              }
              checked++;
            }
          });
        };

        inspect();
        playRoomGame(room, botSeed * 101, inspect);
        inspect();
        expect(checked).toBeGreaterThan(50);

        // every card id anywhere is a v4 UUID
        const all = [...room.state!.pool, ...room.state!.players.flatMap((p) => p.hand)];
        for (const c of all) expect(c.id).toMatch(UUID_V4);
        cardIdsSeenBy.forEach((s) => s.forEach((id) => expect(id).toMatch(UUID_V4)));
        // a grant id reached its owner only
        const owner = new Map(room.state!.powerGrants.map((g) => [g.id, g.ownerId]));
        grantIdsSeenBy.forEach((seen, i) => seen.forEach((g) => expect(owner.get(g), `grant ${g} seen by player ${i}`).toBe(idOf[i])));
        grantsSeen += grantIdsSeenBy.reduce((sum, set) => sum + set.size, 0);
      }
      // the check above is not vacuous: in real games players did receive their grant ids
      expect(grantsSeen).toBeGreaterThan(0);
    });
  }

  it('GAME_STARTED carries no seed, and every viewer gets the same tally and gate', () => {
    const { room, sockets } = makeRoom(4);
    rooms.push(room);
    room.start();
    const first = sockets.map((s) => s.messages.find((m) => m.type === 'game_state') as Extract<ServerMessage, { type: 'game_state' }>);
    for (const m of first) {
      expect(m.events.find((e) => e.type === 'GAME_STARTED')).toEqual({ type: 'GAME_STARTED', playerIds: room.players.map((p) => p.id), seq: 1 });
      expect(m.view.sets).toEqual({ possible: 18, start: 18 });
      expect(m.view.endPressure).toEqual({ misses: 0, limit: 8 });
    }
    // the deals differ from game to game and between players
    expect(new Set(first.map((m) => m.view.hand.map((c) => c.id).join()))).toHaveProperty('size', 4);
  });

  it('no message ever serializes the engine state directly', () => {
    const { room, sockets } = makeRoom(3);
    rooms.push(room);
    room.start();
    playRoomGame(room, 77);
    for (const ws of sockets) for (const text of ws.raw) for (const k of ['powerGrants', 'pool"', 'turnOrder":[', 'idCounter', 'usedPowerHistory', 'pendingClownfishBindings']) {
      // `turnOrder` is public (in the view); the others are raw GameState fields
      if (k.startsWith('turnOrder')) continue;
      expect(text).not.toContain(`"${k.replace('"', '')}"`);
    }
  });
});
