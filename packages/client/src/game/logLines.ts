/* The log's grammar, shared by the tally board, the drawer and the pond's ticker: which seal heads a
 * line, which player's mark stands by it (§5.6), and the sentence itself. Pure: the events are the
 * redacted ones the server sent, so nothing here can name a concealed rank. */
import type { PublicEvent } from '@pescuit/engine';
import type { WireEvent } from '@pescuit/shared';

/** Which seal stands at the head of a line: the power that caused it, else the rank in play. */
export function sealFor(e: PublicEvent): string | null {
  switch (e.type) {
    case 'REQUEST_MADE':
    case 'REQUEST_SUCCEEDED':
    case 'REQUEST_FAILED':
      return e.rank;
    case 'SET_LAID':
      return e.rank;
    case 'POWER_GRANTED':
      return e.unbound ? 'clownfish' : e.rank;
    case 'POWER_USED':
      return e.rank;
    case 'SHARK_JUMP':
      return 'shark';
    case 'LANTERNFISH_REFLECT':
      return 'lanternfish';
    case 'TORTOISE_BLOCK':
      return 'tortoise';
    case 'JELLYFISH_STUN':
    case 'TURN_SKIPPED_STUNNED':
      return 'jellyfish';
    case 'STICKLEBACK_STEAL':
    case 'STICKLEBACK_WASTED':
      return 'stickleback';
    case 'WHALE_SHUFFLE':
      return 'whale';
    case 'SET_DESTROYED':
      return 'mantisShrimp';
    case 'HAND_REFILLED':
      return 'eggs';
    case 'BONUS_TURN':
    case 'TURN_STARTED':
    case 'GAME_ENDED':
      return 'turn';
    default:
      return null;
  }
}

/** The player an event is about, for the mark beside its line. */
export function actorOf(e: PublicEvent): string | null {
  switch (e.type) {
    case 'REQUEST_MADE':
    case 'REQUEST_SUCCEEDED':
    case 'REQUEST_FAILED':
      return e.askerId;
    case 'SET_DESTROYED':
      return e.byPlayerId;
    case 'GAME_STARTED':
    case 'GAME_ENDED':
    case 'WINDOW_OPENED':
    case 'WINDOW_CLOSED':
      return null;
    default:
      return 'playerId' in e ? e.playerId : null;
  }
}

export function entryFor(
  e: PublicEvent,
  nameOf: (id: string) => string,
  rankLabel: (r: string) => string,
): { key: string; params: Record<string, string | number> } | null {
  switch (e.type) {
    case 'REQUEST_MADE':
      return { key: 'log.requestMade', params: { asker: nameOf(e.askerId), target: nameOf(e.targetId), rank: rankLabel(e.rank) } };
    case 'REQUEST_SUCCEEDED':
      return {
        key: 'log.requestSucceeded',
        params: { target: nameOf(e.targetId), count: e.count, rank: rankLabel(e.rank), asker: nameOf(e.askerId) },
      };
    case 'REQUEST_FAILED':
      return { key: 'log.requestFailed', params: { asker: nameOf(e.askerId) } };
    case 'HAND_REFILLED':
      return { key: 'log.handRefilled', params: { player: nameOf(e.playerId), count: e.count } };
    case 'SET_LAID':
      // rank is null while the set is concealed from this viewer (Mode Ascuns, not the owner)
      return e.rank === null
        ? { key: 'log.setLaidHidden', params: { player: nameOf(e.playerId) } }
        : { key: 'log.setLaid', params: { player: nameOf(e.playerId), rank: rankLabel(e.rank) } };
    case 'SET_DESTROYED':
      return { key: 'log.setDestroyed', params: {} };
    case 'POWER_GRANTED':
      return e.unbound || e.rank === null
        ? { key: 'log.powerGrantedHidden', params: { player: nameOf(e.playerId) } }
        : { key: 'log.powerGranted', params: { player: nameOf(e.playerId), rank: rankLabel(e.rank) } };
    case 'POWER_USED':
      return { key: 'log.powerUsed', params: { player: nameOf(e.playerId), rank: rankLabel(e.rank) } };
    case 'SHARK_JUMP':
      return { key: 'log.sharkJump', params: { player: nameOf(e.playerId), count: e.count, from: nameOf(e.fromId) } };
    case 'LANTERNFISH_REFLECT':
      return {
        key: 'log.lanternfishReflect',
        params: { player: nameOf(e.playerId), count: e.count, rank: rankLabel(e.rank), from: nameOf(e.fromId) },
      };
    case 'TORTOISE_BLOCK':
      return { key: 'log.tortoiseBlock', params: { player: nameOf(e.playerId), rank: rankLabel(e.rank) } };
    case 'JELLYFISH_STUN':
      return { key: 'log.jellyfishStun', params: { player: nameOf(e.playerId), target: nameOf(e.targetId) } };
    case 'STICKLEBACK_STEAL':
      return {
        key: 'log.sticklebackSteal',
        params: { player: nameOf(e.playerId), count: e.count, rank: rankLabel(e.rank), target: nameOf(e.targetId) },
      };
    case 'STICKLEBACK_WASTED':
      return {
        key: 'log.sticklebackWasted',
        params: { player: nameOf(e.playerId), rank: rankLabel(e.rank), target: nameOf(e.targetId) },
      };
    case 'WHALE_SHUFFLE':
      return {
        key: 'log.whaleShuffle',
        params: { player: nameOf(e.playerId), targetA: nameOf(e.targetAId), targetB: nameOf(e.targetBId) },
      };
    case 'BONUS_TURN':
      return { key: 'log.bonusTurn', params: { player: nameOf(e.playerId) } };
    case 'TURN_SKIPPED_STUNNED':
      return { key: 'log.turnSkippedStunned', params: { player: nameOf(e.playerId) } };
    case 'GAME_ENDED':
      return {
        key: e.reason === 'decided' ? 'log.gameEndedDecided' : e.reason === 'streak' ? 'log.gameEndedStreak' : 'log.gameEnded',
        params: {},
      };
    default:
      return null;
  }
}

export interface LogLine {
  /** the event's seq: a stable key that survives the store's cap */
  id: number;
  text: string;
  seal: string | null;
  actorId: string | null;
}

export function logLines(
  events: readonly WireEvent[],
  nameOf: (id: string) => string,
  rankLabel: (r: string) => string,
  t: (key: string, params?: Record<string, string | number>) => string,
): LogLine[] {
  const out: LogLine[] = [];
  for (const e of events) {
    const entry = entryFor(e, nameOf, rankLabel);
    if (!entry) continue;
    out.push({ id: e.seq, text: t(entry.key, entry.params), seal: sealFor(e), actorId: actorOf(e) });
  }
  return out;
}
