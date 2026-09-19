import type { Rank } from '@pescuit/engine';
import { POWER_RANKS } from '@pescuit/engine';
import { EGGS_CARVING, NORMAL_CARVINGS, POWER_CARVINGS } from '../art/carvings.js';
import { sealFor } from '../art/seals.js';
import { useT } from '../i18n/useT.js';

const POWER_SET = new Set<string>(POWER_RANKS as readonly string[]);

export type CardSize = 'lg' | 'md' | 'sm';
export type CardCategory = 'power' | 'normal' | 'eggs';

/** §4.2 — three sizes, and below md the card stops being a card and is only its seal. */
const SIZES: Record<CardSize, { w: number; h: number }> = {
  lg: { w: 132, h: 198 },
  md: { w: 88, h: 132 },
  sm: { w: 44, h: 66 },
};

/** §4.3 — category is carried by shape before colour: a 28px bite for powers,
 *  20px for ordinary fish, and icre are the only rounded card in the deck. */
const POWER_FRAME = '28,0 236,0 264,28 264,368 236,396 28,396 0,368 0,28';
const NORMAL_FRAME = '20,0 244,0 264,20 264,376 244,396 20,396 0,376 0,20';

export function categoryOf(rank: Rank): CardCategory {
  if (rank === 'eggs') return 'eggs';
  return POWER_SET.has(rank) ? 'power' : 'normal';
}

function carvingFor(rank: Rank) {
  if (rank === 'eggs') return EGGS_CARVING;
  return POWER_CARVINGS[rank] ?? NORMAL_CARVINGS[rank] ?? null;
}

/** §4.5 laid — the angle is seeded by the set id so a set sits the same way for
 *  everyone at the table and does not re-roll on every render. */
export function seededTilt(seed: string, spread = 1.5): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return ((Math.abs(h) % 200) / 100 - 1) * spread;
}

/** The rank name is set in the display face at the foot of every card (§4.1). Long
 *  Romanian names — CREVETE-MANTIS, PEȘTELE-FELINAR — are stepped down and then, if
 *  they still would not fit between the frames, squeezed onto the 204-unit measure. */
const NAME_MEASURE = 188;

function fitName(label: string): { size: number; tracking: number; textLength?: number } {
  const n = label.length;
  const size = n <= 6 ? 27 : n <= 8 ? 24 : n <= 10 ? 21 : n <= 13 ? 17 : 15;
  const tracking = n <= 8 ? 2 : 1;
  const estimate = n * size * 0.6 + (n - 1) * tracking;
  return estimate > NAME_MEASURE ? { size, tracking, textLength: NAME_MEASURE } : { size, tracking };
}

export interface CardProps {
  rank: Rank | null;
  size?: CardSize;
  faceDown?: boolean;
  /** §4.5 states */
  selected?: boolean;
  disabled?: boolean;
  laid?: boolean;
  spent?: boolean;
  destroyed?: boolean;
  protectedRank?: boolean;
  /** seeds the laid angle; pass the set id */
  seed?: string;
  onClick?: () => void;
  title?: string;
}

export function Card({
  rank,
  size = 'lg',
  faceDown,
  selected,
  disabled,
  laid,
  spent,
  destroyed,
  protectedRank,
  seed,
  onClick,
  title,
}: CardProps) {
  const { rank: rankLabel } = useT();
  const { w, h } = SIZES[size];

  if (faceDown || rank === null) return <CardBack width={w} height={h} title={title} />;

  const cat = categoryOf(rank);
  const label = rankLabel(rank).toUpperCase();
  const name = fitName(label);
  const tilt = laid ? seededTilt(seed ?? rank) : 0;

  // Spent and destroyed powers drop to --ink-soft; a laid card sits on recessed stock.
  const ink = destroyed || spent || disabled ? '#3b322a' : '#17120e';
  const paper = laid || disabled ? '#e3d3b4' : '#efe2c8';
  const ropeId = laid || disabled ? 'ropeDark' : 'rope';
  const frame = cat === 'power' ? POWER_FRAME : NORMAL_FRAME;

  const classes = [
    'card',
    `card--${cat}`,
    `card--${size}`,
    selected ? 'is-selected' : '',
    disabled ? 'is-disabled' : '',
    laid ? 'is-laid' : '',
    spent ? 'is-spent' : '',
    destroyed ? 'is-destroyed' : '',
    onClick ? 'is-pressable' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const art = (
    <svg
      className="card__plate"
      width={w}
      height={protectedRank ? h + 12 : h}
      viewBox={protectedRank ? '0 -24 264 420' : '0 0 264 396'}
      aria-hidden="true"
      focusable="false"
    >
      {cat === 'eggs' ? (
        <>
          <rect x="0" y="0" width="264" height="396" rx="30" fill="#0e2b38" />
          <rect x="0" y="0" width="264" height="396" rx="30" fill="none" stroke={ink} strokeWidth="16" />
          <rect x="0" y="0" width="264" height="396" rx="30" fill="none" stroke="url(#bead)" strokeWidth="16" />
        </>
      ) : (
        <>
          <polygon points={frame} fill={paper} />
          <polygon points={frame} fill="none" stroke={selected ? '#d99a2b' : ink} strokeWidth="16" />
          <polygon points={frame} fill="none" stroke={`url(#${ropeId})`} strokeWidth="16" />
          {selected && <polygon points={frame} fill="none" stroke="#17120e" strokeWidth="4" />}
        </>
      )}

      {/* §4.2 — at sm the carving is unreadable, so the card becomes its seal. */}
      <g opacity={destroyed ? 0.85 : spent ? 0.7 : disabled ? 0.55 : 1}>
        {size === 'sm' ? (
          <g transform="translate(132,186) scale(6.2) translate(-12,-12)" stroke={ink} strokeWidth="3" fill="none" color={ink}>
            {sealFor(rank)}
          </g>
        ) : (
          carvingFor(rank)
        )}
      </g>

      {cat === 'power' && size !== 'sm' && (
        <>
          <rect x="30" y="300" width="204" height="30" fill={spent || destroyed ? '#3b322a' : '#3f4f8a'} />
          <g fill="#efe2c8">
            <rect x="42" y="310" width="10" height="10" />
            <rect x="62" y="310" width="10" height="10" />
            <rect x="82" y="310" width="10" height="10" />
          </g>
          {/* §4.5 spent — an X gouged straight across the collar */}
          {spent && (
            <g stroke="#efe2c8" strokeWidth="6" strokeLinecap="square">
              <path d="M52,292 L212,338 M52,338 L212,292" />
            </g>
          )}
        </>
      )}
      {cat === 'normal' && size !== 'sm' && (
        <rect x="30" y="316" width="204" height="24" fill={disabled ? '#3b322a' : '#14404f'} />
      )}
      {/* the sm plate keeps only a sliver of the collar, enough to read the category */}
      {size === 'sm' && cat !== 'eggs' && (
        <rect x="30" y="338" width="204" height="18" fill={cat === 'power' ? (spent || destroyed ? '#3b322a' : '#3f4f8a') : '#14404f'} />
      )}

      {/* §4.5 destroyed — the frame splinters and the cracks run in --roșu */}
      {destroyed && (
        <>
          <g stroke="#a8392a" strokeWidth="7" fill="none">
            <path d="M200,20 L150,110 L186,140 L120,210" />
            <path d="M200,20 L246,90 L210,120" />
            <path d="M200,20 L232,150" />
            <path d="M200,20 L120,66" />
          </g>
          <polygon points="196,8 216,40 178,44" fill="#a8392a" />
        </>
      )}

      {size !== 'sm' && (
      <text
        x="132"
        y={cat === 'eggs' ? 352 : cat === 'power' ? 360 : 368}
        textAnchor="middle"
        fontFamily="Vollkorn, Georgia, serif"
        fontWeight="800"
        fontSize={name.size}
        letterSpacing={name.tracking}
        textLength={name.textLength}
        lengthAdjust={name.textLength ? 'spacingAndGlyphs' : undefined}
        fill={cat === 'eggs' ? '#efe2c8' : ink}
        opacity={spent || destroyed || disabled ? 0.75 : 1}
      >
        {label}
      </text>
      )}

      {/* §4.5 protected — a verdigris shell clamped over the top edge */}
      {protectedRank && (
        <g transform="translate(0,-24)">
          <path d="M6,20 Q132,-50 258,20 L258,40 Q132,-24 6,40 Z" fill="#3d7a66" stroke="#17120e" strokeWidth="7" />
          <g fill="#17120e">
            <polygon points="72,6 88,26 56,26" />
            <polygon points="132,-4 148,18 116,18" />
            <polygon points="192,6 208,26 176,26" />
          </g>
        </g>
      )}
    </svg>
  );

  const style = tilt ? { transform: `rotate(${tilt}deg)` } : undefined;

  if (onClick && !disabled) {
    return (
      <button type="button" className={classes} style={style} onClick={onClick} title={title ?? rankLabel(rank)}>
        {art}
      </button>
    );
  }
  return (
    <div className={classes} style={style} title={title ?? rankLabel(rank)} role="img" aria-label={rankLabel(rank)}>
      {art}
    </div>
  );
}

/** §4.4 — one back, one seed, byte-identical wherever it is drawn. */
export function CardBack({ width = 88, height = 132, title }: { width?: number; height?: number; title?: string }) {
  return (
    <div className="card card--back" title={title} role="img" aria-label={title ?? 'card'}>
      <svg className="card__plate" width={width} height={height} viewBox="0 0 264 396" aria-hidden="true" focusable="false">
        <polygon points={POWER_FRAME} fill="#6b4a2f" />
        <polygon points={POWER_FRAME} fill="none" stroke="#40291a" strokeWidth="18" />
        <g stroke="#40291a" strokeWidth="4" opacity=".7">
          <path d="M0,60 H264 M0,110 H264 M0,170 H264 M0,230 H264 M0,290 H264 M0,340 H264" />
        </g>
        <circle cx="132" cy="198" r="88" fill="#40291a" />
        <circle cx="132" cy="198" r="74" fill="none" stroke="#6b4a2f" strokeWidth="8" />
        <g fill="#6b4a2f">
          <polygon points="132,120 145,160 119,160" />
          <polygon points="210,198 170,211 170,185" />
          <polygon points="132,276 119,236 145,236" />
          <polygon points="54,198 94,185 94,211" />
          <polygon points="187,143 158,172 143,143" />
          <polygon points="187,253 143,253 158,224" />
          <polygon points="77,253 106,224 121,253" />
          <polygon points="77,143 121,143 106,172" />
        </g>
        <circle cx="132" cy="198" r="26" fill="#d99a2b" />
        <circle cx="132" cy="198" r="10" fill="#40291a" />
      </svg>
    </div>
  );
}
