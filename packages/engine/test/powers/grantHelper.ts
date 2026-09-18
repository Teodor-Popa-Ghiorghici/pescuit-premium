import { GameState, PowerRank } from '../../src/types.js';

let n = 0;

/** Test-only: directly attaches a spent (already laid, unspent) power grant to a player. */
export function grantPower(state: GameState, ownerId: string, rank: PowerRank, opts?: { faceUp?: boolean }) {
  n += 1;
  const setId = `test_gset_${n}`;
  const grantId = `test_grant_${n}`;
  state.laidSets.push({
    id: setId,
    ownerId,
    rank,
    cardIds: [],
    eggCount: 0,
    isPowerSet: true,
    faceUp: opts?.faceUp ?? (rank !== 'squid'),
    spent: false,
    destroyedByMantis: false,
  });
  state.powerGrants.push({
    id: grantId,
    ownerId,
    rank,
    sourceSetId: setId,
    used: false,
    bound: true,
    isClownfishCopy: false,
  });
  return grantId;
}

export function grantUnboundClownfish(state: GameState, ownerId: string) {
  n += 1;
  const setId = `test_gset_${n}`;
  const grantId = `test_grant_${n}`;
  state.laidSets.push({
    id: setId,
    ownerId,
    rank: 'clownfish',
    cardIds: [],
    eggCount: 0,
    isPowerSet: true,
    faceUp: true,
    spent: false,
    destroyedByMantis: false,
  });
  state.powerGrants.push({
    id: grantId,
    ownerId,
    rank: 'clownfish',
    sourceSetId: setId,
    used: false,
    bound: false,
    isClownfishCopy: false,
  });
  return grantId;
}
