/* §5.6 — the six player marks, carved, and the small furniture the chips and posts share.
 *
 * Six marks — brad, val, soare, funie, cruce, rozetă — are assigned by SEAT (the index in the turn
 * order) and paired with the seat's knock. They stand on chips, ask-sheet rows, log lines and the
 * arrow-chip. Identity is carried by shape and sound, never by colour: every mark is drawn in the
 * ink of its surroundings.
 */
import type { ReactElement } from 'react';

export type MarkId = 'brad' | 'val' | 'soare' | 'funie' | 'cruce' | 'rozeta';
export const MARK_ORDER: readonly MarkId[] = ['brad', 'val', 'soare', 'funie', 'cruce', 'rozeta'];

const MARKS: Record<MarkId, ReactElement> = {
  // the fir tree
  brad: <path d="M12,2 L20,11 H15 L21,19 H3 L9,11 H4 Z M12,19 V23" />,
  // the wave
  val: <path d="M2,8 Q7,3 12,8 T22,8 M2,16 Q7,11 12,16 T22,16" />,
  // the sun
  soare: (
    <>
      <circle cx="12" cy="12" r="4.5" />
      <path d="M12,1 V5 M12,19 V23 M1,12 H5 M19,12 H23 M4,4 L7,7 M17,17 L20,20 M20,4 L17,7 M7,17 L4,20" strokeWidth="2" />
    </>
  ),
  // the twisted rope
  funie: <path d="M6,6 C14,6 10,18 18,18 M6,18 C14,18 10,6 18,6" />,
  // the cross
  cruce: <path d="M12,3 V21 M3,12 H21 M8,8 L10,10 M16,8 L14,10 M8,16 L10,14 M16,16 L14,14" />,
  // the rosette
  rozeta: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12,4 L12,20 M4,12 L20,12 M6.5,6.5 L17.5,17.5 M17.5,6.5 L6.5,17.5" strokeWidth="2" />
    </>
  ),
};

/** The mark of a seat: the index in the turn order, so it is the same for every viewer. */
export function markForSeat(turnOrder: readonly string[], playerId: string): MarkId {
  const i = turnOrder.indexOf(playerId);
  return MARK_ORDER[(i < 0 ? 0 : i) % MARK_ORDER.length];
}

export function Mark({ id, size = 12, color = 'currentColor', title }: { id: MarkId; size?: number; color?: string; title?: string }) {
  return (
    <svg
      className="mark"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2.6"
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
      aria-label={title}
      style={{ flex: 'none' }}
    >
      {MARKS[id]}
    </svg>
  );
}

/** The edge of a hand of cards: the count's glyph. */
export const FanIcon = () => (
  <svg width="11" height="10" viewBox="0 0 22 20" aria-hidden="true" style={{ flex: 'none' }}>
    <g fill="#40291a" stroke="#e3d3b4" strokeWidth="1.5">
      <rect x="2" y="3" width="9" height="15" transform="rotate(-14 6 10)" />
      <rect x="7" y="2" width="9" height="15" />
      <rect x="12" y="3" width="9" height="15" transform="rotate(14 16 10)" />
    </g>
  </svg>
);

/** "Gone fishing": the hook of a player who is away from the table. */
export const HookIcon = ({ size = 11, color = '#e8b4a8' }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="3" aria-hidden="true" style={{ flex: 'none' }}>
    <path d="M15,2 V14 A5.5,5.5 0 1 1 4.5,11.5 M4.5,11.5 L8,9.5" />
  </svg>
);

/** The verdigris shell of a protected player. */
export const ShellIcon = ({ size = 12 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" style={{ flex: 'none' }}>
    <path d="M2,18 Q12,0 22,18 Z" fill="#3d7a66" stroke="#17120e" strokeWidth="2.4" />
  </svg>
);

/** A headphone glyph for the top bar while headphones mode is on (§3.2). */
export const HeadphonesIcon = ({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.6" aria-hidden="true">
    <path d="M4,15 V12 A8,8 0 0 1 20,12 V15" />
    <rect x="3" y="14" width="4.5" height="7" fill={color} />
    <rect x="16.5" y="14" width="4.5" height="7" fill={color} />
  </svg>
);

/** One diamond per power set: filled = unused (hidden or face-up), open = used or destroyed. */
export function PowerPips({ unused, used, label }: { unused: number; used: number; label?: string }) {
  if (unused + used === 0) return null;
  return (
    <span className="pips-power" aria-label={label ?? `${unused} unused, ${used} used power sets`} role="img">
      {Array.from({ length: unused }, (_, i) => (
        <svg key={`u${i}`} width="8" height="8" viewBox="0 0 8 8" aria-hidden="true">
          <polygon points="4,0 8,4 4,8 0,4" fill="#6b7fc9" stroke="#efe2c8" strokeWidth="1" />
        </svg>
      ))}
      {Array.from({ length: used }, (_, i) => (
        <svg key={`s${i}`} width="8" height="8" viewBox="0 0 8 8" aria-hidden="true">
          <polygon points="4,0.8 7.2,4 4,7.2 0.8,4" fill="none" stroke="#b9ab96" strokeWidth="1.3" />
        </svg>
      ))}
    </span>
  );
}
