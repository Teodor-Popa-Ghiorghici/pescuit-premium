/* Stepped VFX, "on threes" (§4.3, §5.5): three or four hand-cut frames at 12 fps, each an inline SVG
 * of at most 2 KB, shown one after another by a `steps(1)` animation - never tweened. Cards fly at
 * 60 fps and land with the stamp; these are the stamp's ink, the wood's chips, the pond's ring.
 *
 * Every effect is drawn on a 64 x 64 grid in the game's own inks. The presenter clones a template
 * of each into the flight layer and removes it when the last frame has been shown.
 */
import { cloneElement, type ReactElement } from 'react';
import type { VfxKind } from '../game/choreography.js';

const INK = '#17120e';
const PAPER = '#efe2c8';
const OCHRE = '#d99a2b';
const WATER = '#9fd3bf';
const WOOD = '#a9835c';
const DUST = '#c9b48f';
const SHELL = '#3d7a66';
const RED = '#a8392a';

/** points of an n-spike star */
function star(cx: number, cy: number, r1: number, r2: number, n: number, rot = 0): string {
  const pts: string[] = [];
  for (let i = 0; i < n * 2; i++) {
    const a = rot + (Math.PI * i) / n;
    const r = i % 2 === 0 ? r2 : r1;
    pts.push(`${Math.round(cx + Math.cos(a) * r)},${Math.round(cy + Math.sin(a) * r)}`);
  }
  return pts.join(' ');
}

/** n dots on a circle */
function ring(r: number, n: number, dot: number, fill: string, rot = 0): ReactElement[] {
  return [
    <g key="r" fill={fill}>
      {Array.from({ length: n }, (_, i) => {
        const a = rot + (Math.PI * 2 * i) / n;
        return <circle key={i} cx={Math.round(32 + Math.cos(a) * r)} cy={Math.round(32 + Math.sin(a) * r)} r={dot} />;
      })}
    </g>,
  ];
}

/** n small chips flying out to radius r */
function chips(r: number, n: number, size: number, fill: string, rot: number): ReactElement[] {
  return [
    <g key="c" fill={fill} stroke={INK} strokeWidth="1.5">
      {Array.from({ length: n }, (_, i) => {
        const a = rot + (Math.PI * 2 * i) / n;
        const x = Math.round(32 + Math.cos(a) * r);
        const y = Math.round(32 + Math.sin(a) * r);
        return <rect key={i} x={Math.round(x - size / 2)} y={y - size} width={size} height={size * 2} transform={`rotate(${Math.round((a * 180) / Math.PI + 40)} ${x} ${y})`} />;
      })}
    </g>,
  ];
}

const ell = (rx: number, ry: number, w: number, stroke: string, fill = 'none'): ReactElement => <ellipse cx="32" cy="34" rx={rx} ry={ry} fill={fill} stroke={stroke} strokeWidth={w} />;
const cloud = (r: number, o: number): ReactElement[] => [
  <g key="k" fill={DUST} opacity={o} stroke={INK} strokeWidth="1.5">
    {[[-8, 4], [8, 4], [0, -6], [-14, 8], [14, 8]].map(([dx, dy], i) => (
      <circle key={i} cx={Math.round(32 + dx * (r / 10))} cy={Math.round(40 + dy * (r / 10) - r / 3)} r={Math.round(r * (i > 2 ? 0.55 : 0.8))} />
    ))}
  </g>,
];

/** The frames of every effect. */
export const VFX_FRAMES: Record<VfxKind, ReactElement[][]> = {
  // the stamp: an ink burst, then its spatter
  inkBurst: [
    [<polygon key="a" points={star(32, 32, 5, 9, 8)} fill={INK} />],
    [<polygon key="a" points={star(32, 32, 9, 21, 9, 0.2)} fill={INK} />, <circle key="b" cx="32" cy="32" r="5" fill={OCHRE} />],
    [...ring(24, 9, 3.2, INK, 0.1), <polygon key="a" points={star(32, 32, 10, 15, 9, 0.2)} fill="none" stroke={INK} strokeWidth="2.5" />],
    [...ring(28, 9, 1.8, INK, 0.3)],
  ],
  // splinter, or a notch knocked from the rim
  woodChips: [chips(8, 5, 4, WOOD, 0.3), chips(17, 5, 4.4, WOOD, 0.5), chips(25, 5, 4, WOOD, 0.9), chips(29, 4, 3, WOOD, 1.3)],
  // go fish: the pond's ring and splash
  waterRing: [
    [ell(6, 3, 3, WATER), <path key="d" d="M32,24 v-9 M27,25 l-4,-7 M37,25 l4,-7" stroke={WATER} strokeWidth="3" fill="none" />],
    [ell(13, 6, 3, WATER), ...ring(14, 6, 2.4, WATER, 0.5)],
    [ell(21, 9, 2.5, WATER)],
    [ell(28, 12, 1.6, WATER)],
  ],
  // dry go fish: a puff of dust, nothing else
  dustPuff: [cloud(7, 0.95), cloud(11, 0.8), cloud(14, 0.5)],
  // a stall: the gate shuts a notch, with its creak
  gateNotch: [
    [<rect key="a" x="26" y="20" width="12" height="24" fill={OCHRE} stroke={INK} strokeWidth="2" />],
    [<rect key="a" x="26" y="26" width="12" height="18" fill={OCHRE} stroke={INK} strokeWidth="2" />, <path key="b" d="M18,30 q-4,4 0,8 M46,30 q4,4 0,8" fill="none" stroke={INK} strokeWidth="2.5" />],
    [<rect key="a" x="26" y="32" width="12" height="12" fill={INK} />, <path key="b" d="M14,28 q-6,8 0,16 M50,28 q6,8 0,16" fill="none" stroke={INK} strokeWidth="2" />],
  ],
  // flight smear: speed grooves
  speedGrooves: [
    [<path key="a" d="M6,24 h30 M14,32 h38 M6,40 h26" stroke={INK} strokeWidth="3" />],
    [<path key="a" d="M10,24 h22 M18,32 h30 M10,40 h18" stroke={INK} strokeWidth="2.5" />],
    [<path key="a" d="M18,24 h10 M26,32 h18 M18,40 h8" stroke={INK} strokeWidth="2" />],
  ],
  // Tortoise: the shell clamps
  shellClamp: [
    [<path key="a" d="M8,30 Q32,-6 56,30 Z" fill={SHELL} stroke={INK} strokeWidth="2.5" transform="translate(0,-8)" />, <path key="b" d="M8,34 Q32,70 56,34 Z" fill={SHELL} stroke={INK} strokeWidth="2.5" transform="translate(0,8)" />],
    [<path key="a" d="M8,30 Q32,-6 56,30 Z" fill={SHELL} stroke={INK} strokeWidth="2.5" transform="translate(0,-2)" />, <path key="b" d="M8,34 Q32,70 56,34 Z" fill={SHELL} stroke={INK} strokeWidth="2.5" transform="translate(0,2)" />],
    [<path key="a" d="M8,32 Q32,-4 56,32 Q32,68 8,32 Z" fill={SHELL} stroke={INK} strokeWidth="3" />, <path key="b" d="M32,10 v44 M14,32 h36" stroke={INK} strokeWidth="2.5" />, <path key="c" d="M4,20 l6,4 M60,20 l-6,4 M4,44 l6,-4 M60,44 l-6,-4" stroke={INK} strokeWidth="2.5" />],
  ],
  // Jellyfish: the bell stamps the plate
  bellStamp: [
    [<path key="a" d="M18,34 a14,14 0 0 1 28,0 Z" fill="none" stroke={INK} strokeWidth="3" strokeDasharray="6 3" />],
    [<path key="a" d="M14,36 a18,18 0 0 1 36,0 Z" fill={INK} opacity="0.75" />, <ellipse key="b" cx="32" cy="38" rx="22" ry="5" fill="none" stroke={INK} strokeWidth="2.5" />],
    [<path key="a" d="M16,34 a16,16 0 0 1 32,0 Z" fill={INK} />, <path key="b" d="M22,38 v10 M32,38 v14 M42,38 v10" stroke={INK} strokeWidth="3" strokeDasharray="4 3" />],
  ],
  // Lanternfish: a mirrored glint
  mirrorGlint: [
    [<path key="a" d="M32,8 v48" stroke={PAPER} strokeWidth="3" />, <path key="b" d="M32,8 v48" stroke={INK} strokeWidth="1" />],
    [<polygon key="a" points={star(32, 32, 4, 22, 4)} fill={PAPER} stroke={INK} strokeWidth="2" />, <path key="b" d="M32,4 v56" stroke={INK} strokeWidth="1.5" strokeDasharray="4 3" />],
    [<polygon key="a" points={star(32, 32, 3, 12, 4, 0.78)} fill={PAPER} stroke={INK} strokeWidth="2" />],
  ],
  // Stickleback: the barbed hook
  barbedHook: [
    [<path key="a" d="M16,10 v22" stroke={INK} strokeWidth="3.5" fill="none" />],
    [<path key="a" d="M16,10 v30 q0,12 14,12" stroke={INK} strokeWidth="3.5" fill="none" />],
    [<path key="a" d="M16,10 v30 q0,12 14,12 q10,0 10,-12" stroke={INK} strokeWidth="3.5" fill="none" />, <path key="b" d="M40,40 l-6,-3 M30,52 l-2,-6" stroke={INK} strokeWidth="3" />],
    [<path key="a" d="M16,10 v30 q0,12 14,12 q10,0 10,-12 M40,40 l-6,-3 M30,52 l-2,-6" stroke={INK} strokeWidth="2" fill="none" opacity="0.6" />],
  ],
  // Whale: spiral chips
  spiralChips: [
    ring(8, 5, 2.4, WOOD, 0),
    [...ring(14, 6, 2.8, WOOD, 0.9), ...ring(6, 3, 2, INK, 0.2)],
    [...ring(20, 7, 2.8, WOOD, 1.8), ...ring(11, 4, 2.2, INK, 1.1)],
    [...ring(26, 8, 2, WOOD, 2.7), ...ring(16, 5, 1.8, INK, 2)],
  ],
  // score: roe bursts
  roeBurst: [ring(6, 5, 3, OCHRE), ring(14, 7, 3.4, OCHRE, 0.3), ring(22, 9, 3, OCHRE, 0.6), ring(28, 9, 2, OCHRE, 0.9)],
  // start and end: the gate doors, closing. Each leaf is half the plate; the gap is what is left.
  gateDoors: [
    [<rect key="a" x="0" y="8" width="20" height="48" fill={RED} stroke={INK} strokeWidth="2.5" />, <rect key="b" x="44" y="8" width="20" height="48" fill={RED} stroke={INK} strokeWidth="2.5" />],
    [<rect key="a" x="0" y="8" width="26" height="48" fill={RED} stroke={INK} strokeWidth="2.5" />, <rect key="b" x="38" y="8" width="26" height="48" fill={RED} stroke={INK} strokeWidth="2.5" />],
    [<rect key="a" x="0" y="8" width="31" height="48" fill={RED} stroke={INK} strokeWidth="2.5" />, <rect key="b" x="33" y="8" width="31" height="48" fill={RED} stroke={INK} strokeWidth="2.5" />, <circle key="c" cx="26" cy="32" r="2.5" fill={OCHRE} />, <circle key="d" cx="38" cy="32" r="2.5" fill={OCHRE} />],
  ],
};

export const VFX_KINDS = Object.keys(VFX_FRAMES) as VfxKind[];
/** 12 fps */
export const VFX_STEP_MS = 83;
/** how long an effect stays up */
export const vfxMs = (kind: VfxKind): number => VFX_FRAMES[kind].length * VFX_STEP_MS;

/** One effect: its frames stacked, each shown for one step. */
export function Vfx({ kind, size = 64 }: { kind: VfxKind; size?: number }) {
  return (
    <svg className={`vfx vfx--${kind}`} viewBox="0 0 64 64" width={size} height={size} aria-hidden="true" focusable="false" data-vfx={kind}>
      {VFX_FRAMES[kind].map((frame, i) => (
        <g key={i} className="vfx__f" style={{ ['--i' as string]: i }}>
          {frame.map((el, j) => cloneElement(el, { key: j }))}
        </g>
      ))}
    </svg>
  );
}
