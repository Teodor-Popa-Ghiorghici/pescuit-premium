export interface StoredSession {
  roomCode: string;
  token: string;
  playerId: string;
  name: string;
}

const KEY_PREFIX = 'pescuit:session:';

export function saveSession(s: StoredSession) {
  try {
    localStorage.setItem(KEY_PREFIX + s.roomCode, JSON.stringify(s));
  } catch {
    // storage may be unavailable (private mode); reconnection just won't persist
  }
}

export function loadSession(roomCode: string): StoredSession | null {
  try {
    const raw = localStorage.getItem(KEY_PREFIX + roomCode.toUpperCase());
    return raw ? (JSON.parse(raw) as StoredSession) : null;
  } catch {
    return null;
  }
}

export function clearSession(roomCode: string) {
  try {
    localStorage.removeItem(KEY_PREFIX + roomCode.toUpperCase());
  } catch {
    // ignore
  }
}

export function roomCodeFromUrl(): string | null {
  const params = new URLSearchParams(location.search);
  return params.get('room');
}

export function setRoomInUrl(roomCode: string | null) {
  const url = new URL(location.href);
  if (roomCode) url.searchParams.set('room', roomCode);
  else url.searchParams.delete('room');
  history.replaceState(null, '', url.toString());
}
