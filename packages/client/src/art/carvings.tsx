/* Carvings — the "cioplitura" of every card, traced from the D1 Foundations
 * contact sheet (§4.1 anatomy, §4.6 the eight notch variants, §5.8 the Codex).
 *
 * Authored in the 264x396 working space. The eight normal fish were cut on the
 * half-size 176x264 grid, so they arrive wrapped in a 1.5x group: same geometry,
 * one coordinate system. Each entry is everything the frame encloses — sigil,
 * carving, and for shark/whale/mantis the strokes that deliberately break out
 * of it. The collar and the rank name are added by Card itself. */
import type { ReactElement } from 'react';

export const POWER_CARVINGS: Record<string, ReactElement> = {
  squid: (
    <>
      <polygon points="36,22 228,22 242,36 242,360 228,374 36,374 22,360 22,36" fill="none" stroke="#17120e" strokeWidth="5" />
      <g stroke="#17120e" strokeWidth="6" fill="none">
        <rect x="44" y="44" width="18" height="18" />
        <rect x="54" y="54" width="18" height="18" />
      </g>
      <g transform="translate(0,8)">
        <polygon points="132,76 172,138 164,208 100,208 92,138" fill="none" stroke="#17120e" strokeWidth="14" />
        <polygon points="132,96 142,124 122,124" fill="#17120e" />
        <circle cx="113" cy="150" r="10" fill="#17120e" />
        <circle cx="151" cy="150" r="10" fill="#17120e" />
        <path d="M100,208 L74,250 L132,268 L190,250 L164,208" fill="none" stroke="#17120e" strokeWidth="13" />
        <path d="M92,238 L132,214 L172,238 L132,262 Z" fill="none" stroke="#17120e" strokeWidth="11" />
        <path d="M74,250 L110,282 M190,250 L154,282 M132,268 L132,286" stroke="#17120e" strokeWidth="11" fill="none" />
      </g>
    </>
  ),
  shark: (
    <>
      <polygon points="36,22 228,22 242,36 242,360 228,374 36,374 22,360 22,36" fill="none" stroke="#17120e" strokeWidth="5" />
      <g stroke="#17120e" strokeWidth="6" fill="none">
        <path d="M44,44 l16,0 M44,44 l0,26 M70,60 l0,10 l-12,0" />
      </g>
      <polygon points="0,116 40,96 40,244 0,226" fill="#efe2c8" />
      <g transform="translate(0,6)">
        <polygon points="-4,170 96,96 236,150 204,214 92,244" fill="none" stroke="#17120e" strokeWidth="15" strokeLinejoin="miter" />
        <g fill="#17120e">
          <polygon points="52,136 74,150 48,158" />
          <polygon points="96,152 118,166 92,174" />
          <polygon points="140,168 162,182 136,190" />
          <polygon points="184,182 206,196 180,204" />
        </g>
        <circle cx="92" cy="130" r="11" fill="#17120e" />
        <path d="M150,104 L182,62 L200,110" fill="none" stroke="#17120e" strokeWidth="13" />
      </g>
    </>
  ),
  tortoise: (
    <>
      <polygon points="36,22 228,22 242,36 242,360 228,374 36,374 22,360 22,36" fill="none" stroke="#17120e" strokeWidth="5" />
      <polygon points="46,32 218,32 232,46 232,350 218,364 46,364 32,350 32,46" fill="none" stroke="#17120e" strokeWidth="5" />
      <g stroke="#17120e" strokeWidth="6" fill="none">
        <circle cx="56" cy="56" r="13" />
        <path d="M56,40 v-6 M56,72 v6 M40,56 h-6 M72,56 h6" />
      </g>
      <g transform="translate(0,26)">
        <circle cx="132" cy="160" r="66" fill="none" stroke="#17120e" strokeWidth="13" />
        <g fill="#17120e">
          <polygon points="132,70 143,96 121,96" />
          <polygon points="196,124 170,135 170,113" />
          <polygon points="132,250 121,224 143,224" />
          <polygon points="68,124 94,113 94,135" />
          <polygon points="177,105 160,124 150,104" />
          <polygon points="177,215 150,216 160,196" />
          <polygon points="87,215 104,196 114,216" />
          <polygon points="87,105 114,104 104,124" />
        </g>
        <circle cx="132" cy="160" r="26" fill="#17120e" />
        <circle cx="132" cy="160" r="9" fill="#efe2c8" />
      </g>
    </>
  ),
  jellyfish: (
    <>
      <polygon points="36,22 228,22 242,36 242,360 228,374 36,374 22,360 22,36" fill="none" stroke="#17120e" strokeWidth="5" />
      <g stroke="#17120e" strokeWidth="6" fill="none" strokeDasharray="10 7">
        <path d="M44,62 a20,20 0 0 1 32,0" />
        <path d="M48,74 v8 M62,74 v10 M74,74 v8" />
      </g>
      <g transform="translate(0,4)">
        <path d="M62,190 a70,74 0 0 1 140,0" fill="none" stroke="#17120e" strokeWidth="15" strokeDasharray="26 11" />
        <path d="M62,190 q18,18 34,0 q18,18 36,0 q18,18 36,0 q16,18 34,0" fill="none" stroke="#17120e" strokeWidth="12" />
        <g stroke="#17120e" strokeWidth="10" fill="none" strokeDasharray="16 13">
          <path d="M82,206 v78" />
          <path d="M108,208 v88" />
          <path d="M132,208 v96" />
          <path d="M156,208 v88" />
          <path d="M182,206 v78" />
        </g>
        <g fill="#17120e">
          <polygon points="132,112 142,140 122,140" />
          <polygon points="100,124 112,148 92,152" />
          <polygon points="164,124 172,152 152,148" />
        </g>
      </g>
    </>
  ),
  lanternfish: (
    <>
      <polygon points="36,22 228,22 242,36 242,360 228,374 36,374 22,360 22,36" fill="none" stroke="#17120e" strokeWidth="5" />
      <g stroke="#17120e" strokeWidth="6" fill="none">
        <path d="M58,44 v26 M46,52 l-6,-6 M70,52 l6,-6 M46,66 l-6,6 M70,66 l6,6" />
      </g>
      <g transform="translate(0,10)">
        <circle cx="132" cy="96" r="18" fill="#17120e" />
        <g stroke="#17120e" strokeWidth="8">
          <path d="M132,58 v16 M104,66 l8,14 M160,66 l-8,14 M92,92 l16,4 M172,92 l-16,4" />
        </g>
        <path d="M132,124 L188,202 L132,272 L76,202 Z" fill="none" stroke="#17120e" strokeWidth="15" />
        <g fill="#17120e">
          <polygon points="132,150 146,186 118,186" />
          <polygon points="106,206 132,218 106,232" />
          <polygon points="158,206 158,232 132,218" />
        </g>
        <path d="M76,202 L44,170 L44,236 Z M188,202 L220,170 L220,236 Z" fill="none" stroke="#17120e" strokeWidth="12" />
        <path d="M132,124 v148" stroke="#17120e" strokeWidth="3" opacity=".45" />
      </g>
    </>
  ),
  stickleback: (
    <>
      <polygon points="36,22 228,22 242,36 242,360 228,374 36,374 22,360 22,36" fill="none" stroke="#17120e" strokeWidth="5" />
      <g stroke="#17120e" strokeWidth="6" fill="none">
        <path d="M42,66 h34 M48,66 l6,-14 M60,66 l6,-14 M72,66 l6,-14" />
      </g>
      <g transform="translate(14,16)">
        <polygon points="60,200 130,158 226,176 216,232 118,250" fill="none" stroke="#17120e" strokeWidth="15" />
        <g fill="#17120e">
          <polygon points="116,156 130,112 138,156" />
          <polygon points="146,158 162,116 168,160" />
          <polygon points="176,162 194,124 198,166" />
        </g>
        <path d="M60,200 L20,166 L28,246 Z" fill="none" stroke="#17120e" strokeWidth="12" />
        <circle cx="200" cy="196" r="10" fill="#17120e" />
        <g fill="#17120e">
          <polygon points="120,250 134,282 106,276" />
          <polygon points="162,246 174,278 148,274" />
        </g>
      </g>
    </>
  ),
  mantisShrimp: (
    <>
      <g stroke="#a8392a" strokeWidth="6" fill="none">
        <path d="M186,96 L242,40 M186,96 L250,120 M186,96 L156,28" />
      </g>
      <polygon points="36,22 228,22 242,36 242,360 228,374 36,374 22,360 22,36" fill="none" stroke="#17120e" strokeWidth="5" />
      <g stroke="#17120e" strokeWidth="6" fill="none">
        <rect x="44" y="46" width="24" height="16" />
        <path d="M68,54 l10,-8 M68,54 l10,8" />
      </g>
      <g transform="translate(0,14)">
        <polygon points="46,214 108,186 176,196 190,244 120,268 52,252" fill="none" stroke="#17120e" strokeWidth="14" />
        <path d="M176,196 L206,140 L244,116" fill="none" stroke="#17120e" strokeWidth="16" />
        <polygon points="228,80 264,96 250,144 214,128" fill="#17120e" />
        <g fill="#efe2c8">
          <rect x="230" y="98" width="10" height="26" transform="rotate(16 235 111)" />
        </g>
        <g fill="#17120e">
          <polygon points="74,186 88,152 98,190" />
          <polygon points="112,182 126,150 134,186" />
        </g>
        <circle cx="166" cy="216" r="9" fill="#17120e" />
        <path d="M46,214 L12,190 L20,258 Z" fill="none" stroke="#17120e" strokeWidth="11" />
      </g>
    </>
  ),
  whale: (
    <>
      <polygon points="36,22 228,22 242,36 242,360 228,374 36,374 22,360 22,36" fill="none" stroke="#17120e" strokeWidth="5" />
      <path d="M-10,150 Q60,86 150,104 Q250,124 274,196 Q250,268 150,286 Q60,300 -10,240 Z" fill="#efe2c8" stroke="#17120e" strokeWidth="16" />
      <g stroke="#17120e" strokeWidth="6" fill="none">
        <path d="M44,50 a14,14 0 1 1 -10,-13 M44,50 a26,26 0 1 0 -22,-24" />
      </g>
      <g fill="#17120e">
        <polygon points="20,232 62,220 46,262" />
        <polygon points="76,244 116,238 98,278" />
        <polygon points="132,248 172,246 152,284" />
      </g>
      <circle cx="60" cy="166" r="11" fill="#17120e" />
      <g stroke="#17120e" strokeWidth="9" fill="none">
        <path d="M96,112 q14,22 0,42 M124,108 q14,24 0,46 M152,110 q14,24 0,44" />
      </g>
      <path d="M214,132 q30,-46 48,-14 q-22,10 -22,34" fill="none" stroke="#17120e" strokeWidth="12" />
    </>
  ),
  clownfish: (
    <>
      <polygon points="36,22 228,22 242,36 242,360 228,374 36,374 22,360 22,36" fill="none" stroke="#17120e" strokeWidth="5" />
      <g stroke="#17120e" strokeWidth="6" fill="none">
        <rect x="42" y="44" width="34" height="24" />
        <path d="M56,44 v24" />
      </g>
      <g transform="translate(0,16)">
        <path d="M44,196 Q86,124 148,126 Q214,130 234,196 Q214,262 148,266 Q86,268 44,196 Z" fill="none" stroke="#17120e" strokeWidth="15" />
        <path d="M92,140 L80,252" stroke="#17120e" strokeWidth="26" />
        <path d="M188,144 L200,248" stroke="#17120e" strokeWidth="26" />
        <path d="M126,130 L118,264 M166,132 L174,262" stroke="#17120e" strokeWidth="7" fill="none" strokeDasharray="14 10" />
        <text x="146" y="216" textAnchor="middle" fontFamily="Vollkorn, Georgia, serif" fontWeight="800" fontSize="66" fill="#17120e">?</text>
        <circle cx="216" cy="176" r="10" fill="#17120e" />
        <path d="M44,196 L14,162 L20,234 Z" fill="none" stroke="#17120e" strokeWidth="11" />
      </g>
    </>
  ),
};

/** The half-scale grid the eight fish were cut on, lifted into card space. */
export const NORMAL_CARVINGS: Record<string, ReactElement> = {
  herring: (
    <g transform="scale(1.5)">
      <g transform="translate(0,6)">
        <polygon points="36,136 88,104 142,136 88,168" fill="none" stroke="#17120e" strokeWidth="11" />
        <polygon points="88,84 100,110 76,110" fill="#17120e" />
        <polygon points="88,188 76,162 100,162" fill="#17120e" />
      </g>
    </g>
  ),
  mackerel: (
    <g transform="scale(1.5)">
      <g transform="translate(0,6)">
        <polygon points="36,136 88,100 142,136 88,172" fill="none" stroke="#17120e" strokeWidth="11" />
        <g fill="#17120e">
          <polygon points="70,82 82,108 58,108" />
          <polygon points="100,84 112,110 88,110" />
        </g>
        <polygon points="88,190 76,164 100,164" fill="#17120e" />
      </g>
    </g>
  ),
  anchovy: (
    <g transform="scale(1.5)">
      <g transform="translate(0,6)">
        <polygon points="44,136 88,112 136,136 88,160" fill="none" stroke="#17120e" strokeWidth="11" />
        <g fill="#17120e">
          <polygon points="76,94 88,118 64,118" />
        </g>
        <g stroke="#17120e" strokeWidth="7">
          <path d="M74,128 v16 M96,128 v16" />
        </g>
      </g>
    </g>
  ),
  sardine: (
    <g transform="scale(1.5)">
      <g transform="translate(0,6)">
        <polygon points="38,136 88,106 140,136 88,166" fill="none" stroke="#17120e" strokeWidth="11" />
        <g fill="#17120e">
          <polygon points="88,84 104,110 72,110" />
          <polygon points="52,150 68,140 62,164" />
          <polygon points="120,150 112,164 106,140" />
        </g>
      </g>
    </g>
  ),
  carp: (
    <g transform="scale(1.5)">
      <g transform="translate(0,6)">
        <polygon points="30,136 88,96 146,136 88,176" fill="none" stroke="#17120e" strokeWidth="13" />
        <polygon points="88,76 102,104 74,104" fill="#17120e" />
        <g stroke="#17120e" strokeWidth="7">
          <path d="M66,120 l0,32 M88,114 l0,44 M110,120 l0,32" />
        </g>
      </g>
    </g>
  ),
  trout: (
    <g transform="scale(1.5)">
      <g transform="translate(0,6)">
        <polygon points="36,136 88,104 142,136 88,168" fill="none" stroke="#17120e" strokeWidth="11" />
        <g fill="#17120e">
          <polygon points="70,86 80,110 60,110" />
          <polygon points="106,86 116,110 96,110" />
          <circle cx="76" cy="136" r="7" />
          <circle cx="100" cy="136" r="7" />
        </g>
      </g>
    </g>
  ),
  perch: (
    <g transform="scale(1.5)">
      <g transform="translate(0,6)">
        <polygon points="40,136 88,102 138,136 88,170" fill="none" stroke="#17120e" strokeWidth="11" />
        <g fill="#17120e">
          <polygon points="62,84 72,106 52,106" />
          <polygon points="82,80 92,104 72,104" />
          <polygon points="102,84 112,106 92,106" />
        </g>
        <path d="M64,136 h48" stroke="#17120e" strokeWidth="9" />
      </g>
    </g>
  ),
  catfish: (
    <g transform="scale(1.5)">
      <g transform="translate(0,6)">
        <polygon points="32,138 88,110 144,138 88,166" fill="none" stroke="#17120e" strokeWidth="13" />
        <g stroke="#17120e" strokeWidth="7" fill="none">
          <path d="M118,124 l22,-22 M118,152 l22,22" />
        </g>
        <polygon points="88,92 98,114 78,114" fill="#17120e" />
      </g>
    </g>
  ),
};

export const EGGS_CARVING: ReactElement = (
  <g transform="scale(1.5)">
    <g fill="#d99a2b">
      <circle cx="62" cy="96" r="14" />
      <circle cx="96" cy="84" r="12" />
      <circle cx="120" cy="110" r="15" />
      <circle cx="74" cy="132" r="13" />
      <circle cx="104" cy="146" r="11" />
      <circle cx="58" cy="166" r="12" />
      <circle cx="124" cy="170" r="13" />
      <circle cx="92" cy="182" r="10" />
    </g>
  </g>
);
