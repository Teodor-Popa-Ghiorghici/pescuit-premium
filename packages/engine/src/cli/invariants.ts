import { DECK_SIZE } from '../deck.js';
import { EGGS, GameState } from '../types.js';

/** Structural sanity checks run after every simulated game. Throws on the first violation. */
export function assertInvariants(state: GameState, context: string) {
  const fail = (msg: string): never => {
    throw new Error(`Invariant violated (${context}): ${msg}`);
  };

  // Every card that exists is accounted for exactly once: in a hand, the pool, or a laid set.
  const seen = new Map<string, string>();
  const record = (id: string, where: string) => {
    if (seen.has(id)) fail(`card ${id} appears in both ${seen.get(id)} and ${where}`);
    seen.set(id, where);
  };
  for (const p of state.players) for (const c of p.hand) record(c.id, `hand:${p.id}`);
  for (const c of state.pool) record(c.id, 'pool');
  for (const s of state.laidSets) for (const id of s.cardIds) record(id, `set:${s.id}`);
  if (seen.size !== DECK_SIZE) {
    fail(`expected ${DECK_SIZE} distinct cards in play, found ${seen.size}`);
  }

  // No player ever has a negative score, and score equals number of sets they laid.
  for (const p of state.players) {
    const laidByPlayer = state.laidSets.filter((s) => s.ownerId === p.id).length;
    if (p.score !== laidByPlayer) {
      fail(`player ${p.id} score ${p.score} does not match ${laidByPlayer} laid sets`);
    }
    if (p.score < 0) fail(`player ${p.id} has negative score`);
  }

  // Every laid set has a legal size and egg count.
  for (const s of state.laidSets) {
    if (s.rank === EGGS) {
      if (s.cardIds.length !== 4 || s.eggCount !== 4) fail(`eggs set ${s.id} has wrong composition`);
    } else {
      const expected = s.isPowerSet ? 4 : 3;
      if (s.cardIds.length !== expected) fail(`set ${s.id} (${s.rank}) has ${s.cardIds.length} cards, expected ${expected}`);
      if (s.eggCount > 2) fail(`set ${s.id} uses more than 2 eggs`);
      if (s.cardIds.length - s.eggCount < 2) fail(`set ${s.id} has fewer than 2 real cards`);
    }
  }

  // A power can only ever be granted once per laid, non-destroyed power set.
  for (const s of state.laidSets) {
    if (!s.isPowerSet || s.destroyedByMantis || s.rank === EGGS) continue;
    const grants = state.powerGrants.filter((g) => g.sourceSetId === s.id);
    if (grants.length > 1) fail(`set ${s.id} granted more than one power`);
  }

  // Squid absolute secrecy: nothing in the state should ever mark a concealed squid set as spent
  // in a way that would be visible without ownership (spot-checked here on the raw engine state;
  // the real guarantee is enforced by redact.ts and covered in redact.test.ts).
  for (const s of state.laidSets) {
    if (s.rank === 'squid' && s.faceUp !== (state.config.powerVisibility === 'deschis')) {
      fail(`squid set ${s.id} faceUp flipped away from its mode-determined initial value`);
    }
  }

  if (state.status === 'ENDED') {
    if (state.winners.length === 0) fail('game ended with no winners');
    const maxScore = Math.max(...state.players.map((p) => p.score));
    for (const w of state.winners) {
      const p = state.players.find((x) => x.id === w);
      if (!p) fail(`winner ${w} is not a player`);
      if (p!.score !== maxScore) fail(`winner ${w} does not have the max score`);
    }
  }
}
