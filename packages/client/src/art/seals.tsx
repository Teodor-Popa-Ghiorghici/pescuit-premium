/* Sigilii — §4.2. Cut from scratch on a 24x24 grid with a 3px minimum feature,
 * never a shrunk-down carving. These are the app's real iconography: they mark
 * laid sets, every line of the log, and the interrupt prompt.
 *
 * Stroke weight lives on the wrapper so one seal reads at 16px and at 48px. */
import type { ReactElement } from 'react';

const SEALS: Record<string, ReactElement> = {
  // the knot: two blocks that will not come apart
  squid: (
    <>
      <rect x="4" y="4" width="10" height="10" />
      <rect x="10" y="10" width="10" height="10" />
    </>
  ),
  // a broken frame and the tooth that broke it
  shark: (
    <>
      <path d="M4,3 h6 M4,3 v6 M20,21 h-6 M20,21 v-6" />
      <polygon points="6,20 13,8 20,20" fill="currentColor" stroke="none" />
    </>
  ),
  // the solar rosette of a Maramureș gate
  tortoise: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12,2 v4 M12,18 v4 M2,12 h4 M18,12 h4" />
      <circle cx="12" cy="12" r="2.5" fill="currentColor" />
    </>
  ),
  // bell and trailing stings — the only seal drawn with a broken line
  jellyfish: (
    <>
      <path d="M3,13 a9,9 0 0 1 18,0" strokeDasharray="5 2.5" />
      <path d="M6,17 v4 M12,17 v5 M18,17 v4" strokeDasharray="3 2.5" />
    </>
  ),
  // rays mirrored about the vertical axis
  lanternfish: (
    <>
      <path d="M12,2 v20" />
      <path d="M9,8 L3,5 M15,8 L21,5 M9,16 L3,19 M15,16 L21,19" />
    </>
  ),
  // spines, each with its hook
  stickleback: (
    <>
      <path d="M2,16 h20" />
      <path d="M6,16 l3,-7 M13,16 l3,-7" />
      <path d="M9,9 l3,2 M16,9 l3,2" />
    </>
  ),
  // the club, and the crack it leaves
  mantisShrimp: (
    <>
      <rect x="3" y="13" width="9" height="7" />
      <path d="M12,15 L20,7" />
      <path d="M20,3 l-3,6 l5,1 z" fill="currentColor" />
    </>
  ),
  // spiral and fluke
  whale: (
    <>
      <path d="M13,12 a3,3 0 1 1 -3,-3 a6,6 0 1 1 -5,5" />
      <polygon points="17,4 23,2 21,9" fill="currentColor" stroke="none" />
    </>
  ),
  // an empty slot, waiting to be bound
  clownfish: (
    <>
      <rect x="3" y="4" width="18" height="16" />
      <rect x="9" y="4" width="6" height="16" strokeDasharray="3 2.5" />
    </>
  ),
  // the totem, for the lines that are only about whose turn it is
  turn: (
    <>
      <polygon points="12,3 20,9 12,15 4,9" />
      <path d="M12,17 v4" />
    </>
  ),
  // roe
  eggs: (
    <g fill="currentColor" stroke="none">
      <circle cx="8" cy="8" r="3.4" />
      <circle cx="16" cy="9" r="3" />
      <circle cx="9" cy="16" r="3" />
      <circle cx="16" cy="16" r="3.4" />
    </g>
  ),
};

/** §4.6 — the ordinary fish share one body; the notches above it tell them apart. */
const FISH_BODY = <polygon points="3,12 12,7 21,12 12,17" />;
const FISH_NOTCHES: ReactElement[] = [
  <path key="herring" d="M12,4 v3" />,
  <path key="mackerel" d="M9,4 l2,3 M14,4 l1,3" />,
  <path key="anchovy" d="M8,5 l2,2 M12,3 v4 M16,5 l-2,2" />,
  <path key="sardine" d="M7,4 l2,3 M11,3 l1,4 M15,4 l-1,3" />,
  <path key="carp" d="M12,3 v4 M7,6 l2,2 M17,6 l-2,2" />,
  <path key="trout" d="M9,3 l1,4 M15,3 l-1,4" />,
  <path key="perch" d="M6,5 l2,2 M12,3 v4 M18,5 l-2,2 M12,17 v3" />,
  <path key="catfish" d="M12,2 v5 M9,18 l1,3 M15,18 l-1,3" />,
];

const NORMAL_ORDER = ['herring', 'mackerel', 'anchovy', 'sardine', 'carp', 'trout', 'perch', 'catfish'];

export function sealFor(rank: string): ReactElement {
  const seal = SEALS[rank];
  if (seal) return seal;
  const i = NORMAL_ORDER.indexOf(rank);
  return (
    <>
      {FISH_BODY}
      {i >= 0 ? FISH_NOTCHES[i] : null}
    </>
  );
}

/**
 * A rank's seal at any size. `size` is the rendered box in px; the 24-grid and the
 * 3px minimum feature are preserved by scaling the stroke with it.
 */
export function Seal({
  rank,
  size = 24,
  color = 'var(--ink)',
  className,
  inline,
}: {
  rank: string;
  size?: number;
  color?: string;
  className?: string;
  /** sits on the text baseline instead of being its own block */
  inline?: boolean;
}) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      stroke={color}
      color={color}
      strokeWidth={3}
      fill="none"
      aria-hidden="true"
      focusable="false"
      style={inline ? { display: 'inline-block', verticalAlign: '-0.2em' } : { display: 'block', flex: 'none' }}
    >
      {sealFor(rank)}
    </svg>
  );
}
