import type { Action, PlayerAction } from '@pescuit/engine';
import type { ClientAction } from '@pescuit/shared';
import { secureEntropy } from './random.js';

/** The only action types a client may submit. SERVER_SKIP_WINDOW (the timeout) is never among them. */
export const CLIENT_ACTION_TYPES: ReadonlySet<string> = new Set<PlayerAction['type']>([
  'REQUEST',
  'LAY_SET',
  'USE_JELLYFISH',
  'USE_STICKLEBACK',
  'USE_WHALE',
  'DECLARE_LANTERNFISH',
  'DECLARE_SQUID',
  'DECLARE_TORTOISE',
  'DECLARE_MANTIS',
  'DECLARE_SHARK',
  'SKIP_WINDOW',
]);

/**
 * Binds a client's action to the socket's player (FEEL_VISUAL_SOUND_PLAN §6.4, A9):
 *  - `playerId` is overwritten with the submitter's, whatever the client claimed;
 *  - `entropy` is never accepted from a client: a Whale action gets 128 fresh CSPRNG bits (§6.3);
 *  - only client action types pass; the driver's own SERVER_SKIP_WINDOW cannot be sent over a socket.
 */
export function bindAction(playerId: string, raw: ClientAction, entropy: () => number[] = secureEntropy): Action {
  if (!raw || typeof raw !== 'object' || !CLIENT_ACTION_TYPES.has((raw as { type: string }).type)) {
    throw new Error('Unknown action');
  }
  const { entropy: _claimed, ...rest } = raw as ClientAction & { entropy?: unknown };
  const action = { ...rest, playerId } as PlayerAction;
  if (action.type === 'USE_WHALE') action.entropy = entropy();
  return action;
}
