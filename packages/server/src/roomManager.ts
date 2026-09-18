import type { RoomConfig } from '@pescuit/shared';
import { Room } from './room.js';

// Avoids visually ambiguous characters (0/O, 1/I/L) in shareable room codes.
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 5;
export const EMPTY_ROOM_TTL_MS = 10 * 60 * 1000;

export class RoomManager {
  private rooms = new Map<string, Room>();

  createRoom(config: RoomConfig): Room {
    let code: string;
    do {
      code = this.generateCode();
    } while (this.rooms.has(code));
    const room = new Room(code, config);
    this.rooms.set(code, room);
    return room;
  }

  getRoom(code: string): Room | undefined {
    return this.rooms.get(code.trim().toUpperCase());
  }

  private generateCode(): string {
    let s = '';
    for (let i = 0; i < CODE_LENGTH; i++) {
      s += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
    }
    return s;
  }

  /** Rooms empty for 10+ minutes are dropped (in-memory only persistence, per spec). */
  sweepEmptyRooms(now = Date.now()) {
    for (const [code, room] of this.rooms) {
      if (room.emptySince !== null && now - room.emptySince > EMPTY_ROOM_TTL_MS) {
        this.rooms.delete(code);
      }
    }
  }

  startSweeper(intervalMs = 60_000) {
    const handle = setInterval(() => this.sweepEmptyRooms(), intervalMs);
    handle.unref?.();
    return handle;
  }

  get roomCount(): number {
    return this.rooms.size;
  }
}
