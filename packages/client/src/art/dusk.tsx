/* The pond at dusk (§5.8): what the lobby and the waiting room stand in front of. Flat bands of dusk light
 * over the water, a low sun cut into stripes as it sinks, reeds along the bank - all drawn in the game's
 * own inks, no gradient anywhere. Decorative: it is fixed behind the screen and never takes a click. */
function Reed({ x, h, lean }: { x: number; h: number; lean: number }) {
  return <polygon points={`${x - 0.7},100 ${x + lean - 0.25},${100 - h} ${x + lean + 0.25},${100 - h - 3} ${x + 0.7},100`} fill="#0b1a22" stroke="#17120e" strokeWidth="0.3" />;
}

/* reeds low on both banks; the sun sinks in the middle of the sky, dim, so what stands in front of it stays readable */
const REEDS: Array<[number, number, number]> = [
  [4, 9, 1], [8, 13, -1], [12, 8, 1], [16, 11, 1.5], [21, 7, -1],
];

export function DuskPond() {
  return (
    <svg className="dusk" viewBox="0 0 100 100" preserveAspectRatio="xMidYMax slice" aria-hidden="true" focusable="false">
      {/* the sky, in five flat bands, warmer toward the horizon */}
      <rect x="0" y="0" width="100" height="100" fill="#121d25" />
      <rect x="0" y="22" width="100" height="78" fill="#18232a" />
      <rect x="0" y="34" width="100" height="66" fill="#222a2b" />
      <rect x="0" y="43" width="100" height="57" fill="#2a2b28" />
      <rect x="0" y="49" width="100" height="51" fill="#332e27" />
      {/* the sun, half sunk, cut in stripes */}
      <circle cx="50" cy="58" r="9" fill="#5b4322" stroke="#17120e" strokeWidth="0.7" />
      <rect x="40" y="55.6" width="20" height="0.7" fill="#332e27" />
      <rect x="40" y="57.6" width="20" height="1" fill="#332e27" />
      <rect x="40" y="59.8" width="20" height="1.4" fill="#332e27" />
      {/* the water: the horizon line, and the pond below it (the page's own carved waves show through) */}
      <rect x="0" y="62" width="100" height="38" fill="#0e2b38" />
      <rect x="0" y="61.6" width="100" height="0.9" fill="#17120e" />
      <g fill="#4a3818">
        <rect x="44" y="64" width="12" height="0.8" />
        <rect x="46" y="66" width="8" height="0.8" />
        <rect x="47.5" y="68" width="5" height="0.8" />
      </g>
      {REEDS.map(([x, h, lean], i) => (
        <g key={i}>
          <Reed x={x} h={h} lean={lean} />
          <Reed x={100 - x} h={h - 1} lean={-lean} />
        </g>
      ))}
    </svg>
  );
}
