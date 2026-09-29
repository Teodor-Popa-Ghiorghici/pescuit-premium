// The only source of game randomness in production (FEEL_VISUAL_SOUND_PLAN §6.3).
//
// The engine is pure and keeps no random state: it deals the ordered deck it is given and
// shuffles a Whale reshuffle with entropy attached to the action. Everything unpredictable comes
// from the OS CSPRNG through node:crypto and is used exactly once: nothing here is a seeded PRNG,
// none of it is stored between actions, and none of it may reach a client.
import { randomBytes, randomInt, randomUUID } from 'node:crypto';
import { buildDeck, Card } from '@pescuit/engine';

/**
 * A fresh, shuffled 66-card deck. Card ids are random v4 UUIDs, assigned in canonical order and
 * therefore independent of both rank and shuffle position; the order is a Fisher-Yates shuffle
 * over crypto.randomInt (rejection-sampled, unbiased).
 */
export function secureDeck(): Card[] {
  const deck = buildDeck(() => randomUUID());
  for (let i = deck.length - 1; i > 0; i--) {
    const j = randomInt(0, i + 1);
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

/** 128 bits of fresh entropy as four uint32 words, for one Whale shuffle. */
export function secureEntropy(): number[] {
  const b = randomBytes(16);
  return [b.readUInt32BE(0), b.readUInt32BE(4), b.readUInt32BE(8), b.readUInt32BE(12)];
}
