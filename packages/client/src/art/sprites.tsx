/* The travelling embodiments of the powers (§5.7): what a power sends across the table from its actor to what
 * it acts on, so that an effect is seen to be CAUSED, not to happen. Flat woodcut shapes in the game's own inks,
 * a hard 2-3 px ink line, no gradient, no blur. The flight layer keeps one template of each; the presenter clones
 * it and flies it like a card. The crown is the leader's, and also stands on the leading seat. */
import type { Sprite } from '../game/choreography.js';

const INK = '#17120e';
const PAPER = '#efe2c8';
const OCHRE = '#d99a2b';
const WATER = '#9fd3bf';
const SHELL = '#3d7a66';
const RED = '#a8392a';
const SLATE = '#4d6470';
const DEEP = '#2c4756';
const BELL = '#d59bb4';

/** the sprite's drawn size, px (the presenter's base box) */
export const SPRITE_SIZE: Record<Sprite, { w: number; h: number }> = {
  fin: { w: 60, h: 46 },
  bell: { w: 56, h: 62 },
  hook: { w: 40, h: 50 },
  lantern: { w: 44, h: 58 },
  shell: { w: 88, h: 52 },
  club: { w: 64, h: 56 },
  whale: { w: 150, h: 80 },
  crown: { w: 34, h: 26 },
  plus: { w: 44, h: 30 },
};

export const SPRITES = Object.keys(SPRITE_SIZE) as Sprite[];

function Body({ sprite }: { sprite: Sprite }) {
  switch (sprite) {
    case 'fin':
      return (
        <>
          <path d="M8,40 Q22,34 30,4 Q38,24 54,40 Z" fill={SLATE} stroke={INK} strokeWidth="3" strokeLinejoin="round" />
          <path d="M26,14 Q24,28 18,36" fill="none" stroke={PAPER} strokeWidth="2" />
          <path d="M0,43 q7,-5 15,0 t15,0 t15,0 t15,0" fill="none" stroke={WATER} strokeWidth="3" />
        </>
      );
    case 'bell':
      return (
        <>
          <path d="M12,40 q-3,8 2,14 M22,40 q4,9 -1,19 M34,40 q-4,9 1,19 M44,40 q3,8 -2,14" fill="none" stroke={INK} strokeWidth="2.5" />
          <path d="M6,38 Q6,4 28,4 Q50,4 50,38 Q39,33 28,38 Q17,33 6,38 Z" fill={BELL} stroke={INK} strokeWidth="3" strokeLinejoin="round" />
          <path d="M16,24 Q28,12 40,24" fill="none" stroke={PAPER} strokeWidth="2" strokeDasharray="4 3" />
        </>
      );
    case 'hook':
      return (
        <>
          <circle cx="16" cy="6" r="4" fill="none" stroke={INK} strokeWidth="3" />
          <path d="M16,10 V32 Q16,46 28,46 Q38,46 38,34" fill="none" stroke={INK} strokeWidth="4.5" strokeLinecap="round" />
          <path d="M38,34 l-8,3 M38,34 l1,-7" stroke={INK} strokeWidth="3.5" />
          <path d="M18,14 V30" stroke={PAPER} strokeWidth="1.5" />
        </>
      );
    case 'lantern':
      return (
        <>
          <path d="M8,58 Q6,24 26,18" fill="none" stroke={INK} strokeWidth="3" />
          <path d="M32,2 v6 M44,14 h-6 M42,4 l-4,4 M20,6 l4,4" stroke={OCHRE} strokeWidth="3" />
          <circle cx="30" cy="17" r="9" fill={OCHRE} stroke={INK} strokeWidth="3" />
          <circle cx="27" cy="14" r="3" fill={PAPER} />
        </>
      );
    case 'shell':
      return (
        <>
          <path d="M6,44 Q44,-12 82,44 Z" fill={SHELL} stroke={INK} strokeWidth="3" strokeLinejoin="round" />
          <path d="M44,10 L32,24 L44,38 L56,24 Z M32,24 L18,34 M56,24 L70,34 M44,38 V44 M20,26 L32,24 M68,26 L56,24" fill="none" stroke={INK} strokeWidth="2.5" />
          <path d="M2,46 H86" stroke={INK} strokeWidth="5" strokeLinecap="round" />
          <path d="M26,16 Q36,8 46,8" fill="none" stroke={PAPER} strokeWidth="2" />
        </>
      );
    case 'club':
      return (
        <>
          <path d="M8,52 Q2,32 18,22 L38,10 Q54,2 60,16 Q62,30 48,34 L32,40 Q28,54 8,52 Z" fill={RED} stroke={INK} strokeWidth="3" strokeLinejoin="round" />
          <path d="M22,24 Q28,32 26,44 M34,16 Q42,20 42,30 M46,10 Q52,14 52,22" fill="none" stroke={INK} strokeWidth="2.5" />
          <path d="M56,10 l6,-6 M60,20 l4,-2 M48,6 l2,-6" stroke={INK} strokeWidth="3" />
          <path d="M12,44 Q14,34 22,30" fill="none" stroke={PAPER} strokeWidth="2" />
        </>
      );
    case 'whale':
      return (
        <>
          <path d="M60,12 q-4,-8 -10,-10 M60,12 q2,-9 8,-11 M60,12 v-10" fill="none" stroke={WATER} strokeWidth="3" />
          <path d="M6,46 Q10,18 60,16 Q100,14 122,34 L146,18 Q140,40 146,62 L122,48 Q100,68 58,66 Q16,64 6,46 Z" fill={DEEP} stroke={INK} strokeWidth="3" strokeLinejoin="round" />
          <path d="M14,52 Q56,64 104,54 M20,57 Q56,68 96,59" fill="none" stroke={PAPER} strokeWidth="2" />
          <circle cx="30" cy="38" r="3.5" fill={PAPER} stroke={INK} strokeWidth="1.5" />
          <path d="M16,46 Q24,48 30,46" fill="none" stroke={INK} strokeWidth="2.5" />
        </>
      );
    case 'crown':
      return (
        <>
          <path d="M3,22 L3,7 L10,14 L17,2 L24,14 L31,7 L31,22 Z" fill={OCHRE} stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
          <path d="M3,19 H31" stroke={INK} strokeWidth="2.5" />
          <circle cx="17" cy="14" r="2.2" fill={RED} />
        </>
      );
    case 'plus':
      return (
        <>
          <rect x="3" y="3" width="38" height="24" fill={OCHRE} stroke={INK} strokeWidth="2.5" transform="rotate(-6 22 15)" />
          <text x="22" y="22" textAnchor="middle" fontFamily="var(--display, serif)" fontWeight="800" fontSize="19" fill={INK} transform="rotate(-6 22 15)">
            +1
          </text>
        </>
      );
  }
}

export function SpriteArt({ sprite, scale = 1, className }: { sprite: Sprite; scale?: number; className?: string }) {
  const { w, h } = SPRITE_SIZE[sprite];
  return (
    <svg className={className} viewBox={`0 0 ${w} ${h}`} width={Math.round(w * scale)} height={Math.round(h * scale)} aria-hidden="true" focusable="false" data-sprite={sprite}>
      <Body sprite={sprite} />
    </svg>
  );
}
