import { createGame, reduce } from '../engine.js';
import { GameConfig, GameEvent, GameState } from '../types.js';
import { BotRng, makeBotRng, nextBotAction } from './bot.js';

export interface PlayGameResult {
  state: GameState;
  events: GameEvent[];
  actionCount: number;
}

const MAX_ACTIONS = 20000;

export function playRandomGame(
  playerIds: string[],
  seed: number,
  botSeed: number,
  configOverrides?: Partial<GameConfig>,
): PlayGameResult {
  let { state, events: allEvents } = createGame(
    playerIds.map((id) => ({ id, name: id })),
    seed,
    configOverrides,
  );
  const rng: BotRng = makeBotRng(botSeed);
  let actionCount = 0;

  while (state.status === 'IN_PROGRESS') {
    actionCount += 1;
    if (actionCount > MAX_ACTIONS) {
      throw new Error(
        `Deadlock suspected after ${MAX_ACTIONS} actions. resume=${JSON.stringify(state.resume)} window=${JSON.stringify(
          state.pendingWindow,
        )}`,
      );
    }
    const action = nextBotAction(state, rng);
    if (!action) {
      throw new Error(
        `Bot found no action but game is not over. resume=${JSON.stringify(state.resume)} window=${JSON.stringify(
          state.pendingWindow,
        )} players=${JSON.stringify(state.players.map((p) => ({ id: p.id, hand: p.hand.length, stunned: p.stunned })))}`,
      );
    }
    const result = reduce(state, action);
    state = result.state;
    allEvents.push(...result.events);
  }

  return { state, events: allEvents, actionCount };
}
