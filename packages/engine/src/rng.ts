// Seeded, deterministic randomness for TESTS AND BOT SIMULATIONS ONLY (mulberry32 / sfc32).
//
// Nothing in this file is used by a production deal: the server shuffles the deck with the OS
// CSPRNG and hands createGame() an ordered deck, and it attaches fresh entropy to every Whale
// action. No output of any generator here may ever reach a client (FEEL_VISUAL_SOUND_PLAN
// §6.3). The engine keeps no generator state in GameState, so it is a pure function of its
// inputs and replayable from them.

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

/** sfc32, seeded from four uint32 words. Used once, inside one shuffle, and thrown away. */
function sfc32(a: number, b: number, c: number, d: number): () => number {
  a |= 0;
  b |= 0;
  c |= 0;
  d |= 0;
  const next = () => {
    const t = (((a + b) | 0) + d) | 0;
    d = (d + 1) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    c = (c + t) | 0;
    return t >>> 0;
  };
  for (let i = 0; i < 15; i++) next(); // warm-up
  return next;
}

/** True if `entropy` is at least four uint32 words (128 bits). */
export function isEntropy(entropy: unknown): entropy is readonly number[] {
  return (
    Array.isArray(entropy) &&
    entropy.length >= 4 &&
    entropy.every((w) => typeof w === 'number' && Number.isInteger(w) && w >= 0 && w <= 0xffffffff)
  );
}

/**
 * A uniform Fisher-Yates shuffle that is a pure function of `arr` and the caller's entropy
 * (rejection sampling, so there is no modulo bias). The Whale uses it with 128 fresh bits from
 * the server's CSPRNG. Tests and bot sims pass explicit entropy to make games replayable.
 */
export function shuffleWithEntropy<T>(arr: readonly T[], entropy: readonly number[]): T[] {
  if (!isEntropy(entropy)) throw new Error('shuffleWithEntropy needs at least 128 bits of entropy');
  // any words beyond the first four are folded in, so longer entropy is never ignored
  const w = [entropy[0], entropy[1], entropy[2], entropy[3]];
  for (let i = 4; i < entropy.length; i++) w[i % 4] = (w[i % 4] ^ entropy[i]) >>> 0;
  const next = sfc32(w[0], w[1], w[2], w[3]);
  const below = (n: number): number => {
    const limit = 0x100000000 - (0x100000000 % n);
    for (;;) {
      const x = next();
      if (x < limit) return x % n;
    }
  };
  const result = arr.slice();
  for (let i = result.length - 1; i > 0; i--) {
    const j = below(i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
