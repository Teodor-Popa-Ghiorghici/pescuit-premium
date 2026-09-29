import { makeBotRng, nextBotAction } from '@pescuit/engine/src/cli/bot.js';
import type { ServerMessage } from '@pescuit/shared';
import { Room } from '../src/room.js';

/** A stand-in socket: records every message the room sends it, as the exact serialized text. */
export class FakeSocket {
  readyState = 1;
  OPEN = 1;
  raw: string[] = [];
  send(text: string) {
    this.raw.push(text);
  }
  get messages(): ServerMessage[] {
    return this.raw.map((r) => JSON.parse(r));
  }
}

export function makeRoom(n: number, opts: { powerVisibility?: 'ascuns' | 'deschis'; now?: () => number } = {}) {
  const room = new Room('TEST1', { powerVisibility: opts.powerVisibility ?? 'ascuns' }, opts.now ?? Date.now);
  const sockets: FakeSocket[] = [];
  for (let i = 0; i < n; i++) {
    const ws = new FakeSocket();
    sockets.push(ws);
    room.addPlayer(`Player ${i + 1}`, ws as never);
  }
  return { room, sockets };
}

/** Drives a whole game with the engine's random bots through the room's real applyAction. */
export function playRoomGame(room: Room, botSeed: number, onStep?: (i: number) => void, maxSteps = 5000) {
  const rng = makeBotRng(botSeed);
  let steps = 0;
  while (room.state && room.state.status === 'IN_PROGRESS' && steps < maxSteps) {
    const action = nextBotAction(room.state, rng);
    if (!action) throw new Error('bot has no action but the game is not over');
    // a bot is a client: it submits under its own player id (SKIP_WINDOW names the eligible player)
    const playerId = 'playerId' in action ? action.playerId : room.state.pendingWindow!.eligiblePlayerIds[0];
    room.applyAction(playerId, action as never);
    onStep?.(steps);
    steps += 1;
  }
  return steps;
}
