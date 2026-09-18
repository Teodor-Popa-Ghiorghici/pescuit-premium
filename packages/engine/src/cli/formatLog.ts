import { GameEvent } from '../types.js';

/** Renders the authoritative event log as human-readable lines, for the CLI demo.
 *  This is a full-information view (as if watching from above the table) -- it is
 *  NEVER what gets sent to a real player; see redact.ts for that. */
export function formatEvent(e: GameEvent): string | null {
  switch (e.type) {
    case 'GAME_STARTED':
      return `== Game started: ${e.playerIds.join(', ')} (seed ${e.seed}) ==`;
    case 'TURN_STARTED':
      return `-- Turn ${e.turn}: ${e.playerId} --`;
    case 'TURN_SKIPPED_STUNNED':
      return `${e.playerId} is stunned and skips their turn.`;
    case 'HAND_REFILLED':
      return `${e.playerId} draws ${e.count} card(s) from the pool to refill their hand.`;
    case 'WINDOW_OPENED':
      return null; // internal; SKIP_WINDOW/declare events tell the story
    case 'WINDOW_CLOSED':
      return null;
    case 'REQUEST_MADE':
      return `${e.askerId} asks ${e.targetId} for ${e.rank}.`;
    case 'REQUEST_SUCCEEDED':
      return `  -> ${e.targetId} hands over ${e.count} ${e.rank}(s). ${e.askerId} goes again.`;
    case 'REQUEST_FAILED':
      return `  -> "Pescuiește!" ${e.askerId} draws from the pool.`;
    case 'DREW_FROM_POOL':
      return `${e.playerId} draws a card from the pool.${e.poolEmpty ? ' (pool now empty)' : ''}`;
    case 'SET_LAID':
      return `${e.playerId} lays down a ${e.isPowerSet ? 'power' : 'normal'} set of ${e.rank}${
        e.eggCount ? ` (${e.eggCount} egg${e.eggCount > 1 ? 's' : ''} substituting)` : ''
      } for 1 point.`;
    case 'SET_DESTROYED':
      return `  -> ${e.byPlayerId}'s mantis shrimp destroys the power! The point is kept.`;
    case 'POWER_GRANTED':
      return e.unbound
        ? `${e.playerId} gains an unbound clownfish power.`
        : `${e.playerId} gains the ${e.rank} power.`;
    case 'POWER_USED':
      return `${e.playerId} uses their ${e.rank} power.`;
    case 'CLOWNFISH_BOUND':
      return `${e.playerId}'s clownfish binds to ${e.boundRank}.`;
    case 'SHARK_JUMP':
      return `${e.playerId}'s shark jumps in and takes ${e.count} ${e.rank}(s) from ${e.fromId}!`;
    case 'LANTERNFISH_REFLECT':
      return `${e.playerId}'s lanternfish reflects the request, taking ${e.count} ${e.rank}(s) from ${e.fromId}.`;
    case 'TORTOISE_BLOCK':
      return `${e.playerId}'s tortoise protects their ${e.rank} -- the transfer is cancelled.`;
    case 'JELLYFISH_STUN':
      return `${e.playerId}'s jellyfish stuns ${e.targetId} until their next turn.`;
    case 'STICKLEBACK_STEAL':
      return `${e.playerId}'s stickleback steals ${e.count} ${e.rank}(s) from ${e.targetId}.`;
    case 'STICKLEBACK_WASTED':
      return `${e.playerId}'s stickleback guesses ${e.rank} on ${e.targetId} -- nothing there, wasted.`;
    case 'WHALE_SHUFFLE':
      return `${e.playerId}'s whale reshuffles the hands of ${e.targetAId} and ${e.targetBId}.`;
    case 'BONUS_TURN':
      return `${e.playerId} takes a bonus turn.`;
    case 'GAME_ENDED':
      return `== Game over. Scores: ${JSON.stringify(e.scores)}. Winner(s): ${e.winners.join(', ')} ==`;
    default:
      return null;
  }
}

export function formatLog(events: GameEvent[]): string {
  return events
    .map(formatEvent)
    .filter((line): line is string => line !== null)
    .join('\n');
}
