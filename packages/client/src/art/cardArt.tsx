/* The card's plate geometry that is not a carving: the two notched frames and the back. Both the
 * client (through the baked module) and scripts/bake-ink.mjs (which jitters their vertices, §5.4)
 * read these. The back is ONE asset with ONE seed: it never depends on a rank (it is what every
 * hidden card looks like, so it must be byte-identical everywhere). */

/** §4.3 - category is carried by shape before colour: a 28px bite for powers, 20px for ordinary fish */
export const POWER_FRAME = '28,0 236,0 264,28 264,368 236,396 28,396 0,368 0,28';
export const NORMAL_FRAME = '20,0 244,0 264,20 264,376 244,396 20,396 0,376 0,20';

/** The frame is stroked 16 units wide and the plate's viewBox clips the outer half, so a jittered edge
 *  on the box would read as straight. The baked frames are therefore set in by this much: their outer
 *  edge then lies inside the box and wavers. */
export const FRAME_INSET = 10;

/** a convex polygon ('x,y x,y ...') moved inward by `d` along its edges' normals (clockwise, y down) */
export function insetPolygon(points: string, d: number): string {
  const p = points.trim().split(/\s+/).map((s) => s.split(',').map(Number) as [number, number]);
  const n = p.length;
  const lines = p.map((a, i) => {
    const b = p[(i + 1) % n];
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const nx = -(b[1] - a[1]) / l; // the inward normal of a clockwise ring in y-down space
    const ny = (b[0] - a[0]) / l;
    return { a: [a[0] + nx * d, a[1] + ny * d] as [number, number], dir: [(b[0] - a[0]) / l, (b[1] - a[1]) / l] as [number, number] };
  });
  return lines
    .map((l2, i) => {
      const l1 = lines[(i - 1 + n) % n];
      const det = l1.dir[0] * -l2.dir[1] + l1.dir[1] * l2.dir[0];
      const t = ((l2.a[0] - l1.a[0]) * -l2.dir[1] + (l2.a[1] - l1.a[1]) * l2.dir[0]) / det;
      return `${Math.round((l1.a[0] + l1.dir[0] * t) * 10) / 10},${Math.round((l1.a[1] + l1.dir[1] * t) * 10) / 10}`;
    })
    .join(' ');
}
export const POWER_FRAME_IN = insetPolygon(POWER_FRAME, FRAME_INSET);
export const NORMAL_FRAME_IN = insetPolygon(NORMAL_FRAME, FRAME_INSET);
/** icre are the only rounded card in the deck (set in like the others) */
export const EGGS_RECT = { x: FRAME_INSET, y: FRAME_INSET, w: 264 - 2 * FRAME_INSET, h: 396 - 2 * FRAME_INSET, r: 22 };

/** §4.4 - the back, in the 264x396 working space (the source the ink bake reads) */
export function BackArt() {
  return (
    <>
      <polygon points={POWER_FRAME_IN} fill="#6b4a2f" />
      <polygon points={POWER_FRAME_IN} fill="none" stroke="#40291a" strokeWidth="18" />
      <g stroke="#40291a" strokeWidth="4" opacity=".7">
        <path d="M14,60 H250 M14,110 H250 M14,170 H250 M14,230 H250 M14,290 H250 M14,340 H250" />
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
    </>
  );
}
