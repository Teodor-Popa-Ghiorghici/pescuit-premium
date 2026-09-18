// Deterministic seeded PRNG (mulberry32). The engine never calls Math.random.
// rngState is a plain number so GameState stays JSON-serializable.

export function nextRandom(state: number): { value: number; state: number } {
  let t = (state + 0x6d2b79f5) | 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return { value, state: (state + 0x6d2b79f5) | 0 };
}

/** Fisher-Yates shuffle. Returns the shuffled array and the advanced rng state. */
export function shuffle<T>(arr: T[], rngState: number): { result: T[]; state: number } {
  const result = arr.slice();
  let state = rngState;
  for (let i = result.length - 1; i > 0; i--) {
    const { value, state: next } = nextRandom(state);
    state = next;
    const j = Math.floor(value * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return { result, state };
}

export function randomInt(rngState: number, maxExclusive: number): { value: number; state: number } {
  const { value, state } = nextRandom(rngState);
  return { value: Math.floor(value * maxExclusive), state };
}
