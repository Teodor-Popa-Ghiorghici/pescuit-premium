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

export interface EntryOptions {
  /** the ticker's short line (under one screen width); the log keeps the full one */
  short?: boolean;
  /** a failed ask with nothing drawn: the pool is dry ("— Pescuiește!" and nothing more) */
  dry?: boolean;
}

export function entryFor(
  e: PublicEvent,
  nameOf: (id: string) => string,
  rankLabel: (r: string) => string,
  opts: EntryOptions = {},
): { key: string; params: Record<string, string | number> } | null {
  const en = fullEntryFor(e, nameOf, rankLabel, opts);
  if (!en) return null;
  return opts.short && !en.key.endsWith('Dry') ? { ...en, key: `${en.key}.s` } : en;
}

function fullEntryFor(
  e: PublicEvent,
  nameOf: (id: string) => string,
  rankLabel: (r: string) => string,
  opts: EntryOptions,
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
      return { key: opts.dry ? 'log.requestFailedDry' : 'log.requestFailed', params: { asker: nameOf(e.askerId) } };
    case 'HAND_REFILLED':
      return { key: 'log.handRefilled', params: { player: nameOf(e.playerId), count: e.count } };
    case 'SET_LAID':
      // rank is null while the set is concealed from this viewer (Mode Ascuns, not the owner)
      // the eggs used are public (`eggCount`) and each one ticks (`table.egg`), so the line says so too: sound is never the only channel
      if (e.rank === null) return e.eggCount > 0 ? { key: 'log.setLaidHiddenEggs', params: { player: nameOf(e.playerId), eggs: e.eggCount } } : { key: 'log.setLaidHidden', params: { player: nameOf(e.playerId) } };
      return e.eggCount > 0 ? { key: 'log.setLaidEggs', params: { player: nameOf(e.playerId), rank: rankLabel(e.rank), eggs: e.eggCount } } : { key: 'log.setLaid', params: { player: nameOf(e.playerId), rank: rankLabel(e.rank) } };
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
        key: e.reason === 'decided' ? 'log.gameEndedDecided' : e.reason === 'streak' ? 'log.gameEndedStreak' : e.reason === 'exhausted' ? 'log.gameEndedExhausted' : 'log.gameEnded',
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
  short = false,
): LogLine[] {
  const out: LogLine[] = [];
  for (let i = 0; i < events.length; i++) {
    const e = events[i];
    // a failed ask that draws nothing is a dry go fish: the next event of the step is not a draw
    const dry = e.type === 'REQUEST_FAILED' && events[i + 1]?.type !== 'DREW_FROM_POOL';
    const entry = entryFor(e, nameOf, rankLabel, { short, dry });
    if (!entry) continue;
    out.push({ id: e.seq, text: t(entry.key, entry.params), seal: sealFor(e), actorId: actorOf(e) });
  }
  return out;
}
