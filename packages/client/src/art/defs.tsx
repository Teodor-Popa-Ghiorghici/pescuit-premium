/* One hidden <svg> mounted once at the root, holding the patterns every card and
 * frame strokes itself with. The twisted rope of §4.1 is not a drawing: it is an
 * ink stroke with a second, paper-coloured stroke laid over it in the same place.
 * Paint them in this order or the rope reads as stripes. */
export function ArtDefs() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true" focusable="false">
      <defs>
        {/* funia răsucită — cream over ink, for a card on fresh stock */}
        <pattern id="rope" width="26" height="26" patternUnits="userSpaceOnUse">
          <line x1="-6" y1="20" x2="20" y2="-6" stroke="#efe2c8" strokeWidth="7" />
          <line x1="6" y1="32" x2="32" y2="6" stroke="#efe2c8" strokeWidth="7" />
        </pattern>
        {/* the same rope on a card already pressed flat into the table (§4.5 laid) */}
        <pattern id="ropeDark" width="26" height="26" patternUnits="userSpaceOnUse">
          <line x1="-6" y1="20" x2="20" y2="-6" stroke="#e3d3b4" strokeWidth="7" />
          <line x1="6" y1="32" x2="32" y2="6" stroke="#e3d3b4" strokeWidth="7" />
        </pattern>
        {/* on wood: the pool stack and the posts */}
        <pattern id="ropeWood" width="26" height="26" patternUnits="userSpaceOnUse">
          <line x1="-6" y1="20" x2="20" y2="-6" stroke="#6b4a2f" strokeWidth="7" />
          <line x1="6" y1="32" x2="32" y2="6" stroke="#6b4a2f" strokeWidth="7" />
        </pattern>
        {/* icre get a beaded border instead — the one card shape that is round */}
        <pattern id="bead" width="16" height="16" patternUnits="userSpaceOnUse">
          <circle cx="8" cy="8" r="4.5" fill="#efe2c8" />
        </pattern>
      </defs>
    </svg>
  );
}
