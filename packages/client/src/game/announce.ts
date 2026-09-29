/* announce.ts - the screen-reader channel (FEEL_VISUAL_SOUND_PLAN §3.12, §5.9): "screen-reader announcements
 * never depend on sound". Anything the table says out loud - your turn, that you were asked, an answer, a
 * stage of the world - is also said here, as a translation key, and the <Announcer/> (an aria-live region
 * outside the flow) reads it. Only public facts and the viewer's own public facts go through here (Law 1):
 * the same words a spectator's caption would carry. */
export interface Announcement {
  key: string;
  params?: Record<string, string | number>;
  /** assertive interrupts the reader: reserved for what the viewer must act on (you were asked) */
  assertive?: boolean;
}

type Listener = (a: Announcement) => void;
const listeners = new Set<Listener>();

export function announce(a: Announcement): void {
  listeners.forEach((l) => l(a));
}

export function onAnnounce(cb: Listener): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
