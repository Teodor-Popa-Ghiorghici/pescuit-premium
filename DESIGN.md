# Pescuiește Extins — Design Plan

*The visual, audio and feel specification. `RULES.md` says what the game does,
`STATE_MACHINE.md` says how the turn moves, `DECISIONS.md` records why. This
document says what it should look, sound and feel like, and in what order to
build that.*

The README's last line currently reads: *"Card animations and sound are not
implemented; the client uses clear, color-coded placeholder cards (per the
spec's own instruction to do so until real design assets arrive."* This is that
arrival. Every placeholder named there is replaced here.

**Read §9 before writing any code.** The game's central secret — Squid — is
enforced today by the engine (`redact.ts`) and the event log (Squid emits no
event, ever). A careless art, motion or audio layer can leak it straight back
out. §9 is a hard gate, not advice.

---

## 0. How to use this document

Sections 1–8 are the specification. Section 9 is the correctness gate.
Sections 10–12 are the constraints the spec must satisfy. Section 13 is the
build order — each milestone is independently shippable and leaves the app in a
working state. Section 14 lists the calls that need a human answer.

Conventions: "must" is binding, "should" is a strong default that can be
traded away with a note in `DECISIONS.md`, "may" is latitude.

---

## 1. Art direction

### The brief, in one sentence

**Carved from a Maramureș gate, printed with a heavy hand.** Every surface in
the game is either gouged wood or an inked impression pulled from it — thick,
confident, slightly imprecise lines; ink that pools and skips; the grain of the
block always faintly present.

### Why this and not the obvious alternative

The natural reach for "totemic sea creatures with thick lines" is Pacific
Northwest Coast formline (Haida, Tlingit, Kwakwaka'wakw): ovoids, U-forms,
split-U. **Do not go there.** Formline is a living, culturally owned design
language with real ownership norms, and a Romanian card game pastiching it
would be both appropriative and generic — it is the single most copied
"totem" look in games.

This game is Romanian. It has a far better, closer, and unexploited source:

- **Crestături în lemn** — Romanian notch-carving. Chip-cut geometry, deep
  V-channels, repeated triangular bites out of a flat plane.
- **Porțile maramureșene** — the carved wooden gates of Maramureș. The
  vocabulary to steal: *funia răsucită* (the twisted-rope band that frames
  everything), *rozeta solară* (the solar rosette), *pomul vieții* (the tree of
  life), the tooth-and-notch border.
- **Brâncuși** — *Coloana Infinitului*, the *Poarta Sărutului*. The lesson is
  mass and rhythm: a repeated heavy module, stacked, with nothing decorative
  left on it.
- **Relief print / linocut** — the rendering technique. Two values, no
  gradients, texture from the tool and the paper rather than from shading.

The subject matter is water and fishing. The combination — Carpathian wood
carving applied to sea creatures — is the game's own look and belongs to
nobody else.

### The four rules the style reduces to

1. **Two values, one accent.** Ink and paper, plus at most one colour per
   composition. No gradients, no soft shadows, no glow. Depth comes from
   overlap and from cast *hard* shadow only.
2. **The line is a tool, not a drawing.** Line weight is a property of the
   gouge, so it does not scale with the artwork. A creature drawn small keeps
   nearly the same stroke width it had large — which is exactly what makes
   small cards read as *stamped* rather than shrunk.
3. **Everything has a frame, and breaking the frame means something.** A
   twisted-rope border encloses each card. Only a power whose mechanic is
   *violation* (Shark, Mantis Shrimp, Whale) is allowed to break it. The frame
   is the game's visual grammar for "the rules hold."
4. **Nothing is clean.** Every edge carries a small displacement; every filled
   area carries grain; every impression is a half-degree off square. If it
   looks vector-perfect, it is wrong.

### Explicit non-goals

Realistic fish. Cartoon mascots. Gradients, glassmorphism, neon. Drop shadows
with blur > 0. Emoji as iconography (the current 🂠/★/🥚 all go). Particle
systems. Anything that reads "casual mobile game."

---

## 2. Design tokens

All tokens live in `packages/client/src/design/tokens.css` and are the **only**
source of colour, type, weight, spacing and duration in the app. No component
may hardcode a hex, a px stroke, or a ms duration after D0.

### Colour

Replace the current `:root` block wholesale. Names are Romanian where the game
already speaks Romanian.

| Token | Value | Role |
|---|---|---|
| `--ink` | `#17120e` | Every line, every glyph. Warm near-black, never `#000`. |
| `--ink-soft` | `#3b322a` | Secondary text, spent/disabled linework. |
| `--hartie` (paper) | `#efe2c8` | Card stock, panels. Lime-wash, not white. |
| `--hartie-2` | `#e3d3b4` | Recessed paper, table felt under cards. |
| `--apa` (water) | `#0e2b38` | App background, deepest layer. |
| `--apa-2` | `#14404f` | Raised water, headers. |
| `--lemn` (wood) | `#6b4a2f` | Carved furniture: posts, frames, the pool. |
| `--lemn-inchis` | `#40291a` | Wood in shadow, notch interiors. |
| `--ocru` (ochre) | `#d99a2b` | **Eggs**, score, the turn totem. |
| `--rosu` (oxide red) | `#a8392a` | Destruction, danger, disconnection. |
| `--verde` (verdigris) | `#3d7a66` | Protection (Tortoise), confirmation. |
| `--indigo` | `#3f4f8a` | **Power** category. |
| `--var` (lime) | `#f7f1e3` | Highest-contrast paper, used sparingly. |

Category colours are `--indigo` (power), `--apa-2` (normal fish), `--ocru`
(eggs). **Category must never be carried by colour alone** — see §4.3.

Contrast floors: body text on paper ≥ 7:1 (AAA). All interactive labels ≥ 4.5:1.
Ink on paper is ~13:1, so this is nearly free; the ones to actually check are
ochre-on-water and verdigris-on-paper.

### Typography

Two faces, both self-hosted (`packages/client/public/fonts/`), both subsetted.
No Google Fonts CDN request — the app ships as a single Railway service and
should not phone out.

- **Display** (titles, rank names, numerals on cards): a heavy, slightly wonky
  serif. Candidates, in order: **Fraunces** (variable; push `SOFT` and `WONK`
  high — it reads carved), **Vollkorn**, **Bitter**. 
- **Text** (UI, log, body): a workhorse with a real bold. Candidates:
  **Bitter**, **Alegreya**, **Source Serif 4**.

**Romanian diacritics are a hard requirement and a real trap.** The subset must
include U+0102/0103 (Ă ă), U+00C2/00E2 (Â â), U+00CE/00EE (Î î), U+0218/0219
(Ș ș), U+021A/021B (Ț ț). Before committing a font, render the string
`ȘșȚțĂăÂâÎî Pescuiește Țestoasă Meduză` at 12px and 48px and verify:
no tofu, **and** that ș/ț draw with a *comma below*, not a cedilla (ş/ţ). A
face that only has the cedilla forms is disqualified — it is visibly wrong to a
Romanian reader. Record the chosen faces and the verification in
`DECISIONS.md`.

Scale (rem, 16px root): `--t-xs .75` `--t-sm .875` `--t-md 1` `--t-lg 1.25`
`--t-xl 1.75` `--t-2xl 2.5`. Display face is used from `--t-lg` up, plus card
rank names. Tracking: display gets `-0.01em`, small caps labels get `+0.08em`.

### Line weight

The carving scale, defined at the reference card size (132×198):

`--line-hair 2px` · `--line-thin 3px` · `--line-mid 5px` · `--line-thick 8px` ·
`--line-heavy 12px`

Rule 2 of §1 in practice: at the small card size (44×66, a third the area),
weights step down **one notch only** — `--line-heavy` becomes `--line-thick`,
`--line-mid` becomes `--line-thin`, and `--line-hair` never goes below 2px.
Never scale strokes with a CSS `transform`; always re-emit at the target size.

### Geometry

Corners are **notched, not rounded**. Replace `--radius: 10px` with a notch
token `--notch: 10px` and a clip-path mixin that bites a 45° chamfer out of
each corner. Panels, buttons, cards and modals all use it. One exception: the
turn totem and score pips are true circles (rosette geometry).

Spacing: a 4px base grid — `--s1 4` `--s2 8` `--s3 12` `--s4 16` `--s6 24`
`--s8 32` `--s12 48`.

### Elevation

There is no blur. Elevation is a **hard offset shadow** in `--ink` at 20–35%
alpha, offset down-right, with zero blur radius: `--elev-1: 3px 3px 0`,
`--elev-2: 5px 5px 0`, `--elev-3: 8px 8px 0`. A lifted card moves its shadow
further, it does not soften it.

---

## 3. The ink and texture engine

"Visible texture" is the most likely thing to either look fake or tank the
frame rate. The approach is three layers, cheapest first.

### 3.1 Paper grain — one tiling layer, applied globally

A single 256×256 seamless noise tile, generated once at build time from SVG
`feTurbulence` (`type="fractalNoise"`, `baseFrequency≈0.8`, 4 octaves),
exported to PNG, ≤ 8 KB. Applied as a `::after` overlay on `body` and on
`.panel`, `mix-blend-mode: multiply`, `opacity: .12–.18`,
`background-repeat: repeat`, `pointer-events: none`. This alone carries 70% of
the "printed" impression for near-zero cost.

A second tile at 512×512 with stretched, directional turbulence provides
**wood grain** for `--lemn` surfaces (posts, the pool, the frame).

### 3.2 Gouged edges — baked, not live

The wobble that makes a line look carved comes from
`feTurbulence` + `feDisplacementMap` on the stroke. **Do not ship this as a
live SVG filter on card artwork.** Running a displacement filter on 7 hand
cards + 6 player areas + the pool re-rasterises on every repaint and will drop
a mid-range phone to ~20fps.

Instead: a Node script (`scripts/bake-ink.mjs`) applies the displacement filter
at author time and writes out flattened SVG paths. Source art lives in
`design-src/`, baked output in `packages/client/src/design/art/`. The script is
deterministic (fixed seed per asset, seed **never** derived from rank — see
§9.6) and re-runnable.

Live filters are permitted in exactly two places, both single-instance:
the game-over winner flourish, and the interrupt-window border pulse.

### 3.3 Ink density — authored, not computed

Skips, pools and broken coverage are drawn into the source art as negative
shapes. Rules of thumb for the author: ink pools at the *inside* of curves and
at line junctions; it skips on the *outside* of long straight runs; a filled
mass of more than ~30% of the card area must carry at least 3 skip voids or it
reads as flat vector fill.

### 3.4 Budget

Total texture cost: two PNG tiles (≤ 20 KB combined), zero runtime filters on
repeating elements, one shared `<InkDefs/>` SVG block mounted once at app root
holding the clip paths and the two permitted filters.

---

## 4. The card system

Cards are the game. Everything else is furniture around them.

### 4.1 Anatomy

Reference size **132×198** (2:3). All cards are built on a 512×768 authoring
grid, exported to SVG, rendered at CSS sizes via `width`/`height` (never
`transform: scale`).

```
┌─ twisted-rope frame, --line-thick ──────┐
│ ▛ sigil (24px, top-left, always)        │
│                                         │
│        creature carving                 │
│        (the full totem)                 │
│                                         │
│ ▟ power collar / egg pips (bottom band) │
│   RANK NAME — display face, small caps  │
└─────────────────────────────────────────┘
```

- **Frame**: the `funia răsucită` rope band. Same on every card; it is the
  constant that makes the deck a deck.
- **Sigil**: a 1-bit 24×24 reduced mark, unique per rank. This is the load-bearing
  element — see §4.2.
- **Carving**: the creature, filling ~60% of the card height.
- **Bottom band**: rank name always. Power cards additionally carry a *collar* —
  a notched bar in `--indigo`. Egg cards carry roe pips in `--ocru`.

### 4.2 Three sizes, two representations

| Size | px | Where | Shows |
|---|---|---|---|
| `lg` | 132×198 | Your hand, set-completion moment | Full carving + name + sigil |
| `md` | 88×132 | Pool stack, transfer animations | Full carving + sigil, no name |
| `sm` | 44×66 | Laid sets, player areas, log inline | **Sigil only**, on a plain field |

**Every rank needs two drawings, not one**: the full carving and the sigil.
A shrunk carving turns to mud at 44px; a purpose-drawn sigil stays legible at
16px. Sigils are the app's real iconography — they appear in laid sets, in the
event log inline, in the interrupt prompt, and in the Codex (§5.8). Author them
as 1-bit paths on a 24×24 grid with a 3px minimum feature.

### 4.3 Category coding — never colour alone

| Category | Colour | **Shape** | Frame |
|---|---|---|---|
| Power (9 ranks) | `--indigo` collar | Notched corners bitten deeper (14px) | Double rope |
| Normal (8 ranks) | `--apa-2` band | Standard notch (10px) | Single rope |
| Eggs | `--ocru` pips | Rounded corners (the only round card) | Beaded, not roped |

A colourblind player, a greyscale screenshot, and a 44px sigil must all still
distinguish the three categories. Verify by rendering the Codex through a
greyscale filter.

### 4.4 Card back

One back, used for every face-down card everywhere: the pool, hidden laid sets,
opponents' hands. A `rozeta solară` centred on wood grain, deeply notched,
in `--lemn` / `--lemn-inchis` with an `--ocru` core.

**The back is a single shared asset with a single constant texture seed.** It
must be byte-identical for every card regardless of rank, owner or set. See
§9.6 — this is a secrecy requirement, not an aesthetic one.

### 4.5 Card states

| State | Treatment |
|---|---|
| Idle | Flat on the table, `--elev-1` |
| Hoverable / selectable | Lifts 4px, shadow to `--elev-2`, 120ms |
| Selected | Lifts 8px, `--elev-3`, ochre rope highlight on the frame |
| Disabled / unaskable | Ink drops to `--ink-soft`, paper to `--hartie-2`, no lift |
| Laid (scored) | Rotated ±1.5° (seeded by set id), pressed flat, no shadow |
| Spent power | A carved X gouged across the collar; collar desaturates to `--ink-soft` |
| Destroyed by Mantis | The frame is **splintered** — cracks radiating from a strike point, drawn in `--rosu` |
| Protected (Tortoise) | A verdigris shell arc clamped over the card's top edge |

### 4.6 The nineteen assets

Nine powers get bespoke carvings. The eight normal fish deliberately do **not** —
they are "just fish," with no power, and the art should say so. Build them as
**one base fish body + eight notch-pattern variants** (different dorsal
profiles, different chip patterns on the flank). This is both the correct
hierarchy and an 8× saving in authoring effort.

Each power's form is derived from its mechanic. This mapping is the point — it
is what makes the art teach the rules.

| Rank | Mechanic | Carving | Sigil |
|---|---|---|---|
| **Squid** (Sepie) | Lie, never revealed | A mask-like mantle, eight arms braided into one **closed knot**. Symmetrical, sealed, giving nothing away. The most inward-facing card in the deck. | The knot |
| **Shark** (Rechin) | Jump in, steal the transfer | A wedge of jaw entering from the card's edge — the carving **cuts through the rope frame** at the point of entry | Broken frame + tooth |
| **Tortoise** (Țestoasă) | Protect a rank | A shell drawn as a full `rozetă solară`, the only creature **entirely enclosed** by a doubled frame | Rosette shell |
| **Jellyfish** (Meduză) | Stun | A radial bell with trailing lines, the only creature drawn in a **stuttering broken stroke** — the line itself is interrupted | Bell + dashes |
| **Lanternfish** (Peștele-felinar) | Reflect the request back | Perfect **mirror symmetry** about the vertical axis, a gouged sunburst from the lure | Mirrored rays |
| **Stickleback** (Ghidrin) | Blind theft | Spines drawn as barbed hooks; the body is **off-centre, reaching past the frame** without breaking it | Barbed spine |
| **Mantis Shrimp** (Crevete-mantis) | Destroy a power set | A clubbed forelimb mid-strike; the frame behind it is **splintered**, cracks in `--rosu` | Club + crack |
| **Whale** (Balenă) | Shuffle two hands | The largest mass in the deck; the body **exceeds the frame on three sides**, water carved as a spiral of chips | Spiral + fluke |
| **Clownfish** (Peștele-clovn) | Copy the last power used | Three bands across a body drawn mostly in **negative space** — the middle band is an empty **slot** | Empty slot |

**Clownfish's slot is functional.** Once bound, the slot renders the sigil of
the power it copied; while unbound it stays empty with a carved `?`. In Mode
Ascuns the binding is private to the owner, so the slot renders empty to
everyone else — and the owner's own view is the only place the bound sigil ever
appears. (See §9.2: derive this from `ownPowerGrants`, never from events.)

**Eggs** (Icre): no creature. A field of `--ocru` roe on dark water, beaded
border, rounded corners. It must read instantly as *not a fish* — it is the
one card in the deck that is a material rather than an animal.

### 4.7 Authoring procedure (per asset)

1. Block the silhouette on the 512×768 grid, at `--line-heavy`. Silhouette
   first, detail never.
2. Cut the interior with V-notches — chip shapes, not outlines. Minimum chip
   width 12 units.
3. Add exactly one mechanic-expressing gesture from the table above.
4. Add ink pools at junctions, skips on long runs (§3.3).
5. Draw the sigil **separately from scratch** on the 24×24 grid. Do not reduce
   the carving.
6. Add to the Codex contact sheet (§5.8) and view all nineteen together at all
   three sizes before calling it done. Style drift is caught here or not at all.

---

## 5. Screens

### 5.1 Lobby

The entrance to a carved gate. Full-bleed `--apa` with the wood-grain tile;
a single paper panel with notched corners and `--elev-3`. The title
"Pescuiește Extins" set in the display face, large, with a carved rope rule
beneath it. RO/EN toggle as two chip-shaped wooden tabs. Create/Join tabs
become two halves of a carved lintel.

The power-visibility choice (Ascuns / Deschis) is a real decision most players
will not understand from the label alone. Render it as two illustrated
options — a face-down rosette back vs. a face-up totem — with one line of
explanation each. This is the highest-leverage single UI improvement in the app.

### 5.2 Waiting room

Players appear as **carved posts** in a row, each with a name plate; empty
slots are unfinished posts (outline only, no fill). The room code is set large
in the display face on a wooden plaque with the copy button as a carved tab.
Host sees the start button as the heaviest element on screen.

### 5.3 Table

Current layout is a header, a wrapped player row, then log-and-hand side by
side. Keep the information architecture — it works — and re-skin it, with two
structural changes:

1. **The pool (`balta`) becomes a real object.** Currently `🂠 N cards left` in
   the header. It should be a visible stack of card backs, centre-top, whose
   *height visibly decreases* as `poolCount` drops, with the count carved into
   a plaque at its base. Every draw animation must originate from it. When it
   empties, the stack is replaced by an empty carved basin — a permanent,
   readable signal that the endgame has started.
2. **The turn totem travels.** A single ochre carved marker that physically
   moves to the current player's post on turn change (§6.4). The current
   `border-color: accent` on `.player-badge` is not legible enough at a glance
   on a phone.

Player posts (replacing `.player-badge`): name plate, score as carved pips
(not `★ N`), hand size as a small fan of backs (not `🂠 N`), and laid sets as a
column of `sm` cards beneath. Stunned = a jellyfish sigil branded on the post
plus the post drawn at 60% ink. Protected = a verdigris shell clamp.

### 5.4 Hand

The strongest candidate for a full interaction redesign, because of the clock.

- Cards fan in an arc with a slight rotation per card (seeded by card id, so it
  is stable across re-renders — a hand that reshuffles its own rotations on
  every state update feels broken).
- Layable sets: rather than a separate button row, the cards of a completable
  set **lift together and gain an ochre rope tie** when any of them is tapped;
  a carved "Pune jos" tab appears on the tie. The set is the object, not a
  button that refers to one.
- Ask flow: replace the two `<select>`s. Under a 12-second-window culture, two
  native selects on mobile is three taps and a scroll. Use **tap a player post,
  then tap a card in your own hand** (you must already hold the rank, so your
  hand *is* the rank picker). Confirm on a single carved "Cere" tab. This is
  two taps, both on targets ≥ 44px, and it teaches the "you must hold it" rule
  by making it structurally impossible to violate.

### 5.5 Interrupt windows

This is the game's tension and deserves the most deliberate treatment in the app.

- Eligible: the whole viewport gains an **inset carved border** that pulses
  once per second (the permitted live filter). The prompt rises from the bottom
  as a heavy plank, with the applicable power's **full card** shown (not a
  label) and one-tap declare targets.
- The timer is a **carved countdown**: 12 notches burning down, plus the numeral
  in the display face. At 3 seconds the treatment changes — numeral doubles in
  weight, notches go `--rosu`, and the audio cue changes (§7.4).
- Not eligible: a thin plank at the top of the table showing what window is open
  and its countdown, in `--ink-soft`. Informative, never alarming. Players must
  be able to tell the two states apart instantly, or they will panic-tap.
- **Fixed-duration resolution.** However the window closes — declaration at
  0.5s, declaration at 11.9s, or timeout — the closing animation runs for
  exactly the same duration before the next state paints. See §9.4.

### 5.6 Event log

Currently a plain list. Becomes a **carved tally board**: monospaced-ish
alignment, each line prefixed by the `sm` sigil of the rank involved (where
public), players' names in their post colour. The three most recent lines sit
at full ink; older lines fade toward `--ink-soft` in three steps. New lines
stamp in (§7.2) rather than sliding.

### 5.7 Game over

The winner's post grows a raised totem; scores are carved as pips into a final
plaque. Ties (shared victory is a real outcome per §7 of the rules) must render
as two equal totems, not a single winner with an asterisk.

### 5.8 Rules panel, and the new Codex

`RulesPanel` renders `RULES.md` verbatim in English regardless of locale — a
known limitation, and translating the full rulebook stays out of scope here.
But add a second tab: **Codex — the nine powers.** A contact sheet of the nine
totems at `lg`, each with its name in the active locale, its window
(`TURN_START`, `RESPONSE_PENDING`, …) as a carved tag, and one line of
description. Eighteen short strings to translate, and it is the fastest path
to a new player understanding this game.

It doubles as the art QA surface from §4.7 step 6. Wire it up in D1, before the
art exists, with placeholders — it is how the art gets reviewed.

---

## 6. Motion

### 6.1 The principle: stamped, not slid

A woodcut world has no smooth glides. Things are **pressed into place**. The
signature transition is therefore an *impression*: the element arrives at
`scale(1.05)` with reduced ink, compresses to `scale(0.99)` on contact, settles
to `1.0`, and the ink saturates as it lands. Total ~220ms. This replaces every
fade-in in the app.

Corollary: nothing cross-fades, nothing blurs, nothing eases in-out
symmetrically. Motion is fast-out (the strike) and slow-settle (the weight).

### 6.2 Tokens

```
--dur-snap    120ms   /* hover lift, chip select, toggle */
--dur-stamp   220ms   /* the standard impression */
--dur-place   320ms   /* card travelling a short distance */
--dur-heavy   460ms   /* a card crossing the table; a power resolving */
--dur-event   700ms   /* the fixed resolution beat — see §9.4 */

--ease-strike  cubic-bezier(0.2, 0.9, 0.25, 1)    /* default */
--ease-settle  cubic-bezier(0.34, 1.32, 0.64, 1)  /* small overshoot, mass */
--ease-gouge   steps(3, end)                      /* for carving/burning-down */
```

Nothing in the app may exceed `--dur-heavy` except the game-over flourish.

### 6.3 Choreography per event

Keyed to the actual `GameEvent` union in `packages/engine/src/types.ts`.

| Event | Motion |
|---|---|
| `TURN_STARTED` | Turn totem travels to the post (§6.4) |
| `TURN_SKIPPED_STUNNED` | Totem passes *over* the post without stopping; post shudders 2px |
| `REQUEST_MADE` | A carved arrow-chip stamps from asker's post to target's post, holds |
| `REQUEST_SUCCEEDED` | Cards fly target → asker at `--dur-heavy`, land with a stack-thud and 1px screen shake |
| `REQUEST_FAILED` | Arrow-chip splinters; one card draws from the pool to the asker |
| `DREW_FROM_POOL` | Card lifts off the pool stack, stack height drops by one |
| `HAND_REFILLED` | Three draws in sequence, 90ms apart |
| `SET_LAID` | The set's cards converge, rotate to a shared angle, press flat; a score pip is gouged into the owner's plaque |
| `POWER_GRANTED` | The laid set's collar ignites in `--indigo` (face-up) **or** the back's rosette core ignites in `--indigo` (face-down, Ascuns) — identical for every hidden rank |
| `POWER_USED` | The card raises, its sigil stamps large at centre screen for 400ms, the card flips/dims to spent |
| `SET_DESTROYED` | Mantis strike: the set's frame splinters, `--rosu` cracks radiate, 3px shake, the card drops 4px |
| `SHARK_JUMP` | Cards in mid-transfer are **intercepted** — they change direction mid-flight toward the shark player. The only motion in the game that reverses. |
| `LANTERNFISH_REFLECT` | The request arrow-chip mirrors about the table centre and returns; cards travel the reflected path |
| `TORTOISE_BLOCK` | A verdigris shell clamps over the target's post; incoming cards strike it and drop back |
| `JELLYFISH_STUN` | A bell stamps over the target's post; the post's ink drops to 60% |
| `STICKLEBACK_STEAL` | Cards yanked in a straight line, fast (`--dur-place`), no arc — theft is abrupt |
| `STICKLEBACK_WASTED` | The yank happens and catches nothing; a single splinter chip |
| `WHALE_SHUFFLE` | Both hands rise, interleave as backs in a spiral, redeal. The heaviest animation in the game — the one place `--dur-heavy` is allowed to run twice in sequence |
| `BONUS_TURN` | Turn totem stamps in place rather than travelling |
| `GAME_ENDED` | Winner flourish |
| `WINDOW_OPENED` / `WINDOW_CLOSED` | §5.5, fixed duration |
| **Squid** | **Nothing. There is no event and there must be no motion.** See §9.3 |

### 6.4 The turn totem

One ochre carved marker. On `TURN_STARTED` it travels along the post row to the
new current player in `--dur-heavy` with `--ease-settle`, landing with a wood
knock. This single element does more for table legibility than any border or
highlight, especially on a phone where posts wrap to two rows.

### 6.5 Queueing

Events arrive batched in a single `game_state` message (`store.tsx` appends
`msg.events`). A batch must **play in sequence, not simultaneously** — a
request that succeeds, completes a set, grants a power and triggers a window
is four events in one message and would otherwise be an unreadable flash.

Implement a small presentation queue: events enter, animations play in order,
and **the authoritative view updates immediately regardless**. Animation never
gates input, never gates the window timer, and never delays an action the
player can take. If the queue backs up past ~1.2s, drop to end-states and
continue — correctness and responsiveness outrank choreography, always.

### 6.6 Reduced motion

Under `prefers-reduced-motion: reduce`: all travel becomes an instant state
change, all stamps become a 1-frame ink-saturation, screen shake is disabled
entirely. Sound and haptics are **unaffected** (they are a different axis, and
players who disable motion still deserve the feedback). The fixed-duration
resolution beat of §9.4 still applies — it is a secrecy device, not a
decoration.

---

## 7. Audio

### 7.1 Material palette

The sound of carved wood and cold water. Romanian sources again:

- **Toacă** — the wooden plank struck with mallets. This is the app's primary
  UI material: every tap, place and confirm is a variation of a wood knock.
  It is a perfect fit and almost nothing uses it.
- **Fluier / tulnic** — shepherd's flute; breathy, single notes. Used for
  powers, sparingly.
- **Water** — plops, drips, a low body of moving water for ambience.
- **A low frame drum** for weight on heavy events.

No music bed during play. One short motif at game start and at game end only.
This game is played over voice chat; a continuous music loop is a liability.

### 7.2 Implementation tiers

| Tier | Content | Cost |
|---|---|---|
| 1 — synthesized | All UI ticks, knocks, card places, the countdown. A wood knock is a filtered noise burst through a damped resonant band-pass; build a tiny `knock(freq, decay, brightness)` helper and derive ~15 cues by parameter. | **0 bytes** |
| 2 — sampled | ~8 signature hits: shark, whale, mantis strike, tortoise clamp, jellyfish, set-laid, power-used, game-end. One sprite file, single decode. | ≤ 180 KB |
| 3 — ambience | Water bed loop. **Off by default.** | ≤ 120 KB |

Web Audio API, no library. Graph: `source → cue gain → bus gain → master →
destination`, with buses `ui`, `table`, `ambience`. Unlock on first user
gesture (browsers require it). **Decode every buffer at game start**, never on
first use — see §9.1.

Defaults: SFX **on**, ambience **off**, persisted to `localStorage`. A mute
control lives in the table header and must be reachable in one tap — people
play this at work.

### 7.3 Cue map

| Event | Cue |
|---|---|
| `REQUEST_MADE` | Single mid knock, dry |
| `REQUEST_SUCCEEDED` | Card slide + stack thud, pitched by `count` (more cards = lower) |
| `REQUEST_FAILED` | Water plop ("Pescuiește!") + draw rustle |
| `DREW_FROM_POOL` / `HAND_REFILLED` | Draw rustle ×n, 90ms apart |
| `SET_LAID` | Three descending knocks; **identical for power and normal sets** |
| `POWER_GRANTED` | A single flute note. **Same note for all nine powers** unless the rank is already public |
| `POWER_USED` | The rank's own flute figure — **only when the rank is public in the viewer's redacted view** |
| `SET_DESTROYED` | Sharp crack (mantis club) + splinter |
| `SHARK_JUMP` | Low drum hit + fast water rush |
| `LANTERNFISH_REFLECT` | Reversed flute note (literally the sample reversed) |
| `TORTOISE_BLOCK` | Heavy wooden clamp, two-stage |
| `JELLYFISH_STUN` | Detuned shimmer, slow attack — the only non-percussive cue |
| `STICKLEBACK_STEAL` | Short scrape, abrupt cutoff |
| `STICKLEBACK_WASTED` | The same scrape, cut even shorter, no tail |
| `WHALE_SHUFFLE` | Low swell + long shuffle wash |
| `TURN_STARTED` (yours) | Two-note flute figure — the only cue that says "you" |
| `TURN_STARTED` (other) | Soft knock |
| `TURN_SKIPPED_STUNNED` | Muffled knock, damped |
| `GAME_ENDED` | Closing motif |
| **Squid, any use** | **Silence. For everyone, including its user.** §9.3 |

### 7.4 The window clock

The 12-second interrupt window is the one place audio carries real information.

- Window opens **and you are eligible**: a rising two-note figure, then a
  1/sec wood tick.
- Last 3 seconds: tick doubles to 2/sec and drops a fifth. No alarm klaxon —
  the tempo change is enough, and it survives a muted phone in a pocket.
- Window opens and you are **not** eligible: one soft tick, then silence.
  (Eligibility is already public in the redacted view via
  `pendingWindow.youAreEligible`, so this leaks nothing new.)
- Window closes: a single resolving knock, at the **fixed** beat of §9.4.

### 7.5 Mixing

Duck `ambience` by 6 dB under any `table` cue. Hard-limit simultaneous cues to
4; excess is dropped, not queued. Cap total output so a batch of six events
cannot clip. All cues ≤ 600ms except whale and game-end.

---

## 8. Feel

Feel is what remains when the art and the sound are both switched off: timing,
input, and the sense that the table has mass.

### 8.1 Weight

Heavy means **slow to start, decisive to stop**. Use `--ease-strike` for
departures and `--ease-settle` for arrivals so every object overshoots by ~3%
and settles. Every landing that represents a physical placement gets a knock
and, on mobile, a haptic tick.

### 8.2 Haptics

`navigator.vibrate` where supported, gated behind the same toggle as sound:

- Card place / tap confirm: 8ms
- Your turn begins: 16ms
- You are eligible in a window: 16-40-16 (a double pulse — this is the one
  that matters, it is what lets someone notice a window while looking away)
- Last 3 seconds: 8ms per tick
- Cards taken from you: 30ms
- **Squid: none.** §9.3

### 8.3 Input under the clock

Everything reachable in a 12-second window must be a single tap on a ≥ 44px
target, already visible — no scrolling, no native select, no nested menus. This
drives the Hand redesign in §5.4 and the declare forms in §5.5. Target: an
experienced player can declare a Tortoise block in under 2 seconds.

Optimistic feedback: a declaration stamps *immediately* on tap (locally), then
reconciles with the server response. A 12-second window with 150ms of network
latency feels broken if the button does nothing until the round-trip returns.
Reconciliation failure (someone else declared first) must be a visible,
explained state — "prea târziu" / "too late" — never a silent revert.

### 8.4 Legibility at a glance

Three questions must be answerable in under one second, from a phone, at arm's
length: *Whose turn is it?* (the totem) *Can I do something right now?* (the
inset border) *How close is the game to ending?* (the pool stack height).
If a change makes any of those three slower to read, it is wrong regardless of
how it looks.

### 8.5 Connection states

The reconnect banner is currently a red bar. Disconnection in a 3–6 player game
is common and shouldn't feel like a crash: the table drains of colour to
`--ink-soft` and the wood grain stays — the game is still there, it is just out
of reach. Returning re-inks the table in one `--dur-heavy` sweep.

---

## 9. The secrecy contract

**This section is a gate. A change that violates it is a bug, not a
preference.**

`RULES.md` §4: *"Squid is never revealed, before or after use, to anyone — not
in the game log, not in any on-screen indicator, not by any change in timing."*
`DECISIONS.md` implements this by never emitting an event at all, and by
stripping the rank from the `SET_COMPLETED` window context for concealed sets.
The design layer is the next place it can leak, and it leaks in ways the engine
tests cannot see.

### 9.1 Asset loading must be eager

If card art or audio is loaded per rank on demand, the **network tab names the
rank**. A player laying a hidden Squid set would trigger a request for
`squid.svg`, or a decode of `squid.mp3`, visible to anyone with devtools open.

**Rules:** all nineteen card arts are static ESM imports bundled into the main
chunk. No `import()` of anything rank-named. All audio buffers are decoded at
game start from a single sprite. No per-rank font, no per-rank CSS file.

### 9.2 Presentation is a pure function of the redacted view

Art, motion, sound, haptics and log lines derive **only** from `RedactedView`
and the `GameEvent[]` the server already sends. No component may reach for a
rank the view has nulled out (`laidSets[].rank === null` means *unknown*, not
*look it up elsewhere*), and none may infer one from timing, ordering or
context. The existing `LaidSets` component gets this right today (`s.rank ?
rank(s.rank) : '?'`) — keep that discipline everywhere.

### 9.3 Squid produces no feedback of any kind

Not for opponents, and **not for its own user**. No sound, no haptic, no screen
flourish, no log line, no distinct button animation beyond the same generic
press every other button gets. The reason is not paranoia about the DOM: this
game is played over voice chat and on shared screens, and it gets streamed and
recorded. A distinctive squid chime through an open mic reveals the bluff to
the whole table as surely as a log line would.

The declaring player gets the ordinary confirm knock that any button gives, and
their own card shows spent — in their own hand panel only.

### 9.4 Fixed-duration resolution

Any window that can be closed by a hidden declaration must take the **same wall
time to resolve visually** whether it was declared at 0.2s, at 11.8s, or timed
out. Hold the closing state for `--dur-event` (700ms) measured from when the
next state arrives, and start the next animation only then.

Without this, a fast squid declaration produces a visibly faster "Pescuiește!"
than an honest denial, and the tell is obvious after three rounds.

### 9.5 No rank in the DOM for concealed objects

Class names, `data-*` attributes, `aria-label`s, `title`s, SVG `id`s and React
keys for a concealed set or a face-down card must not contain the rank. Use the
set id. `card--facedown` is correct; `card--facedown-squid` is a leak.

### 9.6 Texture seeds must not be rank-derived

The baked ink displacement (§3.2) and the card-back rosette use a noise seed.
**Never seed from rank.** Two face-down cards of different ranks whose grain
differs are distinguishable by a screenshot diff. Card backs use one constant
seed and one shared asset; laid-set rotation seeds from set id.

### 9.7 The automated gate

Add `packages/client/test/presentation-leak.test.ts`:

1. Build two engine states identical except that in one, the target used Squid
   to deny cards they hold, and in the other they genuinely had none.
2. For **every** viewer, run the full presentation derivation — log entries,
   cue ids, css class lists, asset ids, animation descriptors, haptic
   patterns — over the resulting events and redacted views.
3. Assert the two outputs are deeply equal for every viewer except the squid's
   owner, and that no output anywhere contains the string `squid`.

Plus a build-time check (a test or a lint rule) that no dynamic `import()`
argument and no audio-sprite key matches a power rank name.

This requires that presentation derivation be **pure and separable** — cue
selection, class computation and animation descriptors must be plain functions
over `(view, event)` rather than side effects buried in components. Structure
the code that way from D0; retrofitting it later is the expensive path.

### 9.8 Mode Ascuns extends the same rules to all nine powers

Everything above applies to every hidden power set, not only Squid: in Mode
Ascuns a face-down power set must animate, sound and render identically no
matter which power it is, until it is used. Squid is the one that never
flips — but until first use, all nine are equally secret, and the *only* place
per-rank presentation may appear is the owner's own view, derived from
`ownPowerGrants`.

---

## 10. Accessibility

Not a post-pass. Each item below is part of the milestone that introduces the
surface it applies to.

- **Contrast.** Body text ≥ 7:1, interactive labels and non-text indicators
  ≥ 4.5:1 and ≥ 3:1 respectively. The heavy ink-on-paper direction gives this
  almost for free; audit ochre-on-water, verdigris-on-paper, and `--ink-soft`
  states specifically.
- **Never colour alone.** Card category is also shape (§4.3). Stunned is a
  branded sigil, not a tint. Protected is a shell, not a green border. Spent is
  a gouged X, not desaturation. Destroyed is a splinter, not a strikethrough.
  Verify by screenshotting the Codex and the table in greyscale.
- **Motion.** `prefers-reduced-motion` handled per §6.6.
- **Touch targets** ≥ 44×44px for anything reachable inside an interrupt
  window; ≥ 32px elsewhere.
- **Screen readers.** The event log is an `aria-live="polite"` region that
  announces the localised line. An opened window where you are eligible is
  `aria-live="assertive"` and must announce the window, the power you can play,
  and the remaining time. Cards carry a text label; face-down cards announce
  "hidden card" and **nothing more** (§9.5). The countdown must not announce
  every second — announce at open, at 5s, and at 0.
- **Keyboard.** The full ask flow, the lay-set flow and every window
  declaration are keyboard-reachable with a visible focus ring (a carved
  ochre outline, 3px, never `outline: none`). Focus moves to the declare
  prompt when a window opens for you, and returns on close.
- **Language.** `lang` attribute follows the locale toggle; Romanian
  diacritics per §2.
- **Colour-vision simulation** of the final Codex through protanopia,
  deuteranopia and tritanopia filters is a D6 checklist item.

---

## 11. Performance budgets

The app is played on phones over hotel wifi, with a 12-second decision clock.
Missing these budgets is a design failure, not an optimisation task.

| Budget | Limit |
|---|---|
| Added JS (gzipped) over today's bundle | ≤ 60 KB |
| All nineteen card arts + back + sigils, inlined SVG, gzipped | ≤ 120 KB |
| Texture tiles (2 PNGs) | ≤ 20 KB |
| Fonts (2 faces, subsetted WOFF2) | ≤ 90 KB |
| Audio sprite (tier 2) | ≤ 180 KB |
| Ambience (tier 3, lazy, off by default) | ≤ 120 KB |
| Time to interactive on a mid-range Android, 4G | ≤ 2.5s |
| Frame rate during a whale shuffle, 6 players | ≥ 50fps |
| Input latency from tap to visible feedback | ≤ 100ms, always |

Enforcement: no runtime SVG filters on repeating elements (§3.2); `will-change`
only on the currently animating element; animate `transform`/`opacity` only;
the presentation queue drops to end-states rather than falling behind (§6.5).

Measure the whale shuffle with 6 players and full hands — it is the worst case
and it is the one that will break.

---

## 12. File layout and dependencies

**No new runtime dependencies.** CSS animations plus the Web Animations API
cover the motion spec; the Web Audio API covers the audio spec; SVG is authored
as inline React components. Adding an animation or audio library to a project
whose client currently depends only on React would be a poor trade.

Dev-only additions are fine (`svgo` for asset optimisation, a font subsetter).

```
packages/client/src/
  design/
    tokens.css              # §2 — the only source of colour/type/weight/duration
    texture.css             # §3.1 tiles and blend layers
    InkDefs.tsx             # mounted once at root: clip paths, the 2 permitted filters
    art/
      index.ts              # RANK_ART: Record<Rank, Art> — STATIC imports only (§9.1)
      powers/*.tsx          # 9 bespoke carvings
      fish.tsx              # 1 base body + 8 notch variants (§4.6)
      eggs.tsx
      back.tsx              # single shared asset, constant seed (§9.6)
      sigils.tsx            # 19 × 24px marks
  motion/
    tokens.css              # §6.2
    queue.ts                # §6.5 sequencing, drop-to-end-state
    choreography.ts         # pure: (view, event) -> AnimationDescriptor[]   (§9.7)
  audio/
    graph.ts                # buses, unlock, volumes, persistence
    synth.ts                # tier 1 — knock()/plop()/tick() generators
    sprite.ts               # tier 2 — eager decode at game start (§9.1)
    cues.ts                 # pure: (view, event) -> CueId[]                 (§9.7)
  haptics.ts                # pure: (view, event) -> VibratePattern | null   (§9.7)
  components/               # existing components, re-skinned
    Codex.tsx               # §5.8 — new
design-src/                 # unbaked source SVGs (not shipped)
scripts/bake-ink.mjs        # §3.2
packages/client/test/
  presentation-leak.test.ts # §9.7 — the gate
```

The three `choreography.ts` / `cues.ts` / `haptics.ts` modules being **pure
functions over `(RedactedView, GameEvent)`** is what makes §9.7 testable. Build
them that way from the start.

---

## 13. Build order

Seven milestones. Each ends with the app working and shippable; none requires
the next to be useful.

### D0 — Foundations *(no visible regression)*
Tokens, fonts (with the Romanian diacritic verification), texture tiles,
`InkDefs`, notch geometry, hard-offset elevation. Re-point every existing
component at tokens; delete every hardcoded hex and radius from `styles.css`.
Stand up the pure-function skeletons (`choreography`/`cues`/`haptics` returning
empty) and the leak test asserting equality on empty output.
**Done when:** the app looks intentionally different in colour and type, every
existing feature still works, no hex literals remain outside `tokens.css`, and
the diacritic render check is recorded in `DECISIONS.md`.

### D1 — Card system *(the biggest art lift)*
Card anatomy, three sizes, two representations, states, the back, the Codex
screen. Nine power carvings, one fish base + eight variants, eggs, nineteen
sigils. Baking script.
**Done when:** the Codex renders all nineteen at all three sizes; the deck reads
as one hand at 44px in greyscale; no rank-named dynamic import exists.

### D2 — Table and screens
Lobby, waiting room, the pool as an object, player posts, turn totem, hand fan,
the two-tap ask flow, event log tally board, interrupt prompt, game over.
**Done when:** the three glance questions of §8.4 are answerable in under a
second on a 375px viewport, and every interrupt-window control is one tap on a
≥ 44px target.

### D3 — Motion
Stamp transitions, the per-event choreography table, the presentation queue,
the turn totem's travel, reduced-motion paths, the fixed-duration resolution
beat.
**Done when:** a four-event batch reads as four legible beats; input is never
gated by animation; `prefers-reduced-motion` produces a complete, quiet game.

### D4 — Audio
Graph and buses, tier-1 synthesis, tier-2 sprite, the cue map, the window
clock, mute and volume persistence, eager decode.
**Done when:** every event in the `GameEvent` union has a cue or a documented
silence; Squid has silence; a six-event batch does not clip; the mute control
is one tap from the table.

### D5 — Feel
Haptics, optimistic declaration with reconciliation, the "too late" state,
connection-state treatment, the settle-and-overshoot pass on every landing.
**Done when:** a Tortoise block can be declared in under 2 seconds from a cold
start, and a 150ms-latency declaration feels instant.

### D6 — Gates
Accessibility audit (§10), performance measurement against §11, colour-vision
simulation, and the full §9 secrecy review with the leak test passing.
**Done when:** every §11 budget is met or a deliberate exception is recorded in
`DECISIONS.md`, and the leak test passes for all viewers.

### Update as you go
Every milestone updates `README.md` (the "Known scope limitations" note about
placeholder cards and missing audio goes away at D4) and adds its design calls
to `DECISIONS.md`, in the same voice as the entries already there.

---

## 14. Calls that need a human answer

1. **Font licensing.** All candidates in §2 are open-licensed, but the final
   pair should be confirmed by whoever owns this project before subsetting and
   committing the binaries.
2. **Ambience default.** Recommended off (§7.2). If this is meant to be played
   without voice chat, on is defensible.
3. **Audio budget.** The tier-2 sprite at ≤ 180 KB assumes sourced or
   commissioned samples. If nothing can be sourced, tier 1 alone still covers
   ~15 cues at zero bytes — the game would sound thinner but complete.
4. **Art execution.** Nineteen assets is the single largest chunk of work here.
   The fish-variant strategy in §4.6 cuts it to roughly ten bespoke drawings.
   If even that is too much for one pass, ship D1 with the nine powers plus a
   single generic fish and eggs, and treat the eight variants as follow-up —
   the powers are what players actually look at.
5. **Rulebook translation.** Out of scope here and still an open limitation.
   The Codex (§5.8) covers the nine powers bilingually and is the cheaper 80%.
