import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocket, WebSocketServer } from 'ws';
import type { ClientMessage, ServerMessage } from '@pescuit/shared';
import { isClientMessage } from '@pescuit/shared';
import { Room } from './room.js';
import { RoomManager } from './roomManager.js';
import { serveStatic } from './staticServer.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT ?? 8080);
const CLIENT_DIST = process.env.CLIENT_DIST ?? path.join(__dirname, '../../client/dist');

const manager = new RoomManager();
manager.startSweeper();

function send(ws: WebSocket, msg: ServerMessage) {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
}

const server = createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'text/plain' }).end('ok');
    return;
  }
  const served = serveStatic(CLIENT_DIST, req, res);
  if (!served) {
    res.writeHead(404).end('Not found. Run `npm run build --workspace=packages/client` first.');
  }
});

const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', (ws: WebSocket) => {
  let room: Room | null = null;
  let playerId: string | null = null;

  ws.on('message', (raw) => {
    let msg: unknown;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }
    if (!isClientMessage(msg)) return;

    try {
      handle(msg as ClientMessage);
    } catch (err) {
      send(ws, { type: 'error', message: err instanceof Error ? err.message : 'Unknown error' });
    }
  });

  ws.on('close', () => {
    if (room && playerId) {
      room.disconnect(playerId);
      room.broadcastRoomUpdate();
      room.broadcastState([]);
    }
  });

  function handle(msg: ClientMessage) {
    switch (msg.type) {
      case 'create_room': {
        if (!msg.name?.trim()) {
          send(ws, { type: 'error', message: 'Name is required', code: 'NAME_REQUIRED' });
          return;
        }
        const newRoom = manager.createRoom(msg.config);
        const player = newRoom.addPlayer(msg.name, ws);
        room = newRoom;
        playerId = player.id;
        send(ws, { type: 'joined', roomCode: newRoom.code, playerId: player.id, token: player.token });
        newRoom.broadcastRoomUpdate();
        return;
      }
      case 'join_room': {
        const found = manager.getRoom(msg.roomCode);
        if (!found) {
          send(ws, { type: 'error', message: 'Room not found', code: 'ROOM_NOT_FOUND' });
          return;
        }
        if (!msg.name?.trim()) {
          send(ws, { type: 'error', message: 'Name is required', code: 'NAME_REQUIRED' });
          return;
        }
        const player = found.addPlayer(msg.name, ws);
        room = found;
        playerId = player.id;
        send(ws, { type: 'joined', roomCode: found.code, playerId: player.id, token: player.token });
        found.broadcastRoomUpdate();
        return;
      }
      case 'rejoin': {
        const found = manager.getRoom(msg.roomCode);
        if (!found) {
          send(ws, { type: 'error', message: 'Room not found', code: 'ROOM_NOT_FOUND' });
          return;
        }
        const player = found.rejoin(msg.token, ws);
        if (!player) {
          send(ws, { type: 'error', message: 'Invalid session, please rejoin', code: 'INVALID_TOKEN' });
          return;
        }
        room = found;
        playerId = player.id;
        send(ws, { type: 'joined', roomCode: found.code, playerId: player.id, token: player.token });
        found.broadcastRoomUpdate();
        if (found.state) found.broadcastState([]);
        return;
      }
      case 'start_game': {
        requireRoom().start();
        return;
      }
      case 'action': {
        requireRoom().applyAction(msg.action);
        return;
      }
      case 'set_locale': {
        // Locale is a client-side rendering concern; nothing server-side to update.
        return;
      }
      case 'ping': {
        send(ws, { type: 'pong' });
        return;
      }
    }
  }

  function requireRoom(): Room {
    if (!room) throw new Error('Not in a room');
    return room;
  }
});

server.listen(PORT, () => {
  console.log(`Pescuiește Extins server listening on :${PORT} (serving client from ${CLIENT_DIST})`);
});
