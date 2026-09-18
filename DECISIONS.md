# Decisions

This project was built autonomously against an intentionally ambiguous spec. Per
instructions, every ambiguity was resolved by picking the simplest option least
likely to stall the game, and recording it here with one line of reasoning. Nothing
here should be read as more "official" than the rest of `RULES.md` — if a decision
below contradicts your reading of the spec, `RULES.md` is the source of truth for how
the shipped engine actually behaves.

## Stack

- **Server transport: raw `ws`, not Colyseus.** Colyseus buys convenience for a
  case the spec explicitly forbids (trusting the client with room state) and hides
  the exact redaction step this game most needs to get right. Plain `ws` keeps the
  server-authoritative boundary explicit and auditable.
- **Monorepo via npm workspaces** (`packages/engine`, `packages/server`,
  `packages/client`, `packages/shared`). Simplest thing that lets the engine stay a
  standalone, dependency-free package while server and client both import it.
- **Engine has zero runtime dependencies.** It must run in a plain Node script per
  the spec; adding a dependency there would violate that constraint for no benefit.

## Engine architecture

- **Windows are driver-resolved, not timer-resolved.** The pure engine never
  starts a clock. When a window opens, `state.pendingWindow` lists who's eligible;
  the driver (CLI bots, or the server enforcing the real 12s deadline) submits either
  a declaration action or `SKIP_WINDOW` to close it. This is what makes the engine
  "runnable in a plain Node script with no server" and deterministically testable —
  real time is entirely a driver-layer concern.
- **A window with zero eligible players never opens.** This directly implements
  "a player with nothing playable is not notified and causes no delay" — the engine
  auto-resolves straight through instead of waiting for a `SKIP_WINDOW` nobody would
  ever send.
- **`LAY_SET` is legal only when no window is currently open**, for any player (not
  just the one on turn), which is otherwise "any time you hold a complete set." Since
  the engine auto-chains through every window with nobody eligible, `pendingWindow`
  is only ever null at genuine rest points (mostly: waiting for the active player's
  request), so in practice this reads as "the moment you can, you may."
- **Squid emits no event, ever — not even a private one.** "Never revealed to
  anyone... not from the log, not from timing" is stricter than "hidden from
  opponents"; the simplest way to guarantee it holds under every future refactor of
  the server/UI layer is for the fact to never exist in the authoritative log at all.
  Squid's *use* is still recorded internally (`usedPowerHistory`) purely so a
  clownfish can silently bind to it later — that bookkeeping never reaches an event
  or a redacted view.
- **Redaction lives in the engine package** (`redact.ts`), not the server. Knowing
  what's safe to reveal is a rules concern (e.g. "squid never flips") as much as a
  transport concern; keeping it next to the rules it enforces means the server can't
  accidentally serialize raw `GameState` and leak something.

## Squid & Mantis Shrimp interaction

- **A squid set's `faceUp` never changes, for any reason** (lay, use, or mantis
  destruction), and is fixed once at creation purely by visibility mode (hidden in
  Ascuns, visible-but-unrevealing in Deschis per the spec's own exception). Mantis
  can still destroy a squid set (denying its owner future use), but the destruction
  itself is not allowed to leak the rank — otherwise "may target a mantis shrimp set"
  would create exactly the kind of squid leak rule 4 forbids.

## Shark

- **Shark can only jump when there are cards to take.** The spec's fail-branch
  ("take them from... the target on a failed one") doesn't correspond to any cards
  that actually exist on a genuine failure (nothing transfers on a fail, by
  definition). Read literally this is a spec inconsistency; the simplest consistent
  fix is that shark is only eligible to declare when a real transfer just happened
  (a normal success, or a lanternfish reflection). This preserves every scenario the
  spec discusses in prose (jumping a successful capture) while not requiring the
  engine to invent cards from nowhere on a failure.
- Shark takes only the cards that were *just* transferred, not the recipient's whole
  hand — "claim the cards that were just requested" is the literal instruction.

## Lanternfish

- **Lanternfish reflection still passes through Tortoise and Shark.** The spec's
  window list runs `REQUEST_DECLARED → RESPONSE_PENDING → TRANSFER_PENDING →
  SET_COMPLETED → TURN_END` in that order; a reflection is itself "an attempt on
  [the asker's] cards," so it's the simplest reading to let it continue into
  `TRANSFER_PENDING` (the asker may Tortoise-protect) and `TURN_END` (a shark may
  steal the reflected cards from the lanternfish holder), rather than carving
  reflection out as a dead end that skips every later window.
- Reflection never grants a bonus turn and never triggers a pool draw, on either
  success or failure — the spec states this explicitly ("the asker's turn ends
  immediately") and it's the one case with no ambiguity to resolve.

## Tortoise

- **A standing Tortoise protection auto-blocks future transfers without opening a
  window.** Once declared, the protection already exists in state; requiring a
  fresh declaration each time would contradict "cannot be taken by any means... until
  the start of your next turn."
- **A Tortoise-blocked transfer behaves like a failed ask** for turn-progression
  purposes (asker draws from the pool, no bonus turn). The spec never says what
  happens to the asker's turn when a "successful" ask is retroactively blocked;
  treating it identically to a genuine failure is the simplest rule that doesn't
  reward the asker for information they can't act on (they don't even learn the
  block was Tortoise vs. a lucky guess).
- Tortoise can only be declared to protect the exact rank currently under attack
  (not a different rank pre-emptively) — this is the only use the spec describes in
  detail, and the reactive `TRANSFER_PENDING` window is the only place the engine
  offers a declaration slot for it.

## Whale

- Adjacency is computed over `turnOrder` (fixed seating), circularly, including the
  wrap-around pair. The acting player may be one of the two chosen seats.
- Tortoise-protected cards are excluded from the shuffle and dealt back untouched;
  everything else is combined, shuffled with the engine's seeded RNG, and dealt back
  preserving each player's *original* card count.

## Clownfish

- **Binding resolves eagerly.** The moment a clownfish set is completed, the engine
  scans `usedPowerHistory` backward for the most recent entry that wasn't itself a
  clownfish copy (skipping clownfish-copy entries, per "never binds to another
  clownfish"). If nothing distinct has been used yet, the grant is queued in
  `pendingClownfishBindings` and bound automatically the instant *any* player next
  uses a non-clownfish power — "binds to the first power used after that, by any
  player" is read literally.
- If several clownfish are simultaneously unbound and waiting, they all bind to that
  same next power use. The spec only describes a single pending clownfish; binding
  them all together is the simplest generalization and avoids an arbitrary priority
  order between players.
- A bound clownfish is indistinguishable from a real grant of that rank everywhere
  in the engine (same action types, same window, same one-time use) — it just
  carries `isClownfishCopy: true` for bookkeeping.

## Eggs & sets

- The "max 2 eggs, min 2 real cards" rule is enforced generically for every
  substitutable rank. Doing the arithmetic shows this makes egg substitution only
  ever reachable for power sets (4-card): a 3-card normal set can use at most 1 egg,
  since 2 eggs would leave only 1 real card, below the minimum. This isn't a special
  case in the code — it falls out of the same two inequalities the spec states.
- The pure-eggs set (4 eggs, 1 point, no power) is its own dedicated set type,
  entirely separate from the substitution mechanism, exactly as rule 3 describes it.
- A destroyed (Mantis-Shrimp'd) set still keeps its owner's point — "they keep the
  point" is explicit.

## Turn flow, refills, and avoiding stalls

Rule 2.8 only specifies a refill "at the start of your turn" for an *empty* hand.
Two related situations the spec doesn't cover directly, both discovered by running
thousands of simulated games, needed a resolution:

- **A player can empty their hand mid-turn by laying a set.** There's no "pass"
  action in the spec, so without a fix such a player would be stuck holding zero
  cards with no legal move. The engine applies the same refill (or, if the pool is
  also empty, an automatic pass to the next player) immediately after a lay empties
  the current player's hand, not just at formal turn start. Simplest fix that keeps
  the game moving without inventing a new action type.
- **"Empty hand" is generalized to "no real (askable) card."** A hand of 1–3 stray
  eggs is exactly as unable to make a request as a literally empty hand (eggs can
  never be requested), so both the turn-start refill and the mid-turn fallback above
  trigger on "no real cards," not strictly `hand.length === 0`.
- **A player can run out of legal targets, not just legal ranks**, if every other
  player happens to be stunned at once (reachable with two Jellyfish grants chained
  across consecutive bonus turns). The engine treats "nobody eligible to ask" the
  same way as "nothing to ask with": pass immediately rather than wait for an action
  that can never legally arrive.
- **A pool-empty deadlock where no two players ever share a rank is a real
  possibility** and is *not* covered by "no player can make a legal request" — every
  player might still hold real cards and thus technically have legal (but
  unwinnable) requests forever. The engine tracks a streak of consecutive
  no-effect request resolutions (no capture, no draw) and ends the game once it's
  clear no further progress is possible (two full rounds' worth), rather than
  looping indefinitely. This was found and fixed by the M1 bot simulation itself —
  exactly the kind of bug that exit criterion exists to catch.

## Game end & scoring

- End condition: the pool is empty **and** every player's hand contains no
  non-egg card. This is the simplest state that provably implies "no player can
  make a legal request" (eggs are never askable), without trying to prove the
  stronger, harder-to-compute claim that no *combination* of remaining cards could
  ever match between two hands.
- Tie-break: highest score, then most completed power sets (destroyed ones still
  count — the spec ties this to "completed," not "currently active"), then shared
  victory. Directly as specified in rule 2.7.

## Localization

- Romanian is the default locale; English is a toggle. All player-facing strings
  live in one resource file (`packages/shared/src/i18n.ts`) keyed by a flat string
  id, loaded by both the server (for any server-rendered text/log formatting) and
  the client.

## Deployment

- Single Railway service serves the built client as static files from the same
  Node+`ws` process that runs the game server, so one HTTPS URL covers both the
  page and the WebSocket — simplest way to satisfy "single public HTTPS URL"
  without provisioning a second Railway service or a CDN.
- **Server and engine run from TypeScript source via `tsx`, in production too,
  not just in dev.** The alternative — `tsc`-compiling `server` (and by
  extension `engine`/`shared`, since workspace packages point `main` at their
  `.ts` source for the dev experience) — means either maintaining two different
  module resolution stories for dev vs. prod, or compiling every workspace
  package to `dist` and repointing `main`/`exports` at build time. `tsx` costs
  a small, constant startup overhead and one extra runtime dependency; it buys
  a single, simple "the source is the deployable" story with no build-time
  path rewriting to get wrong. Only the client — which must ship as static
  assets a browser can load — gets a real build step (`vite build`).

## Server-side redaction gaps found while building the client

Wiring a real UI against the redacted view surfaced one gap the engine's own
tests hadn't covered, since `pendingWindow.context` is otherwise always safe to
send verbatim (a request's rank is spoken aloud in the physical game, so it's
never sensitive):

- **The `SET_COMPLETED` window's context named the newly-completed set's rank
  directly**, unredacted, to every player eligible to declare Mantis Shrimp —
  including a squid set's rank, an absolute violation of rule 4's secrecy
  guarantee if a mantis holder happened to exist. Fixed in `redact.ts`: the
  `rank` field is now stripped from that one window's context whenever the
  underlying set is concealed from the viewer (not face up, and they're not its
  owner), matching the same concealment rule `laidSets` already uses. Covered by
  a regression test asserting a mantis-holding opponent's redacted window omits
  the rank a squid-laying player's own view still includes.

## Build order (M2/M3 merged)

The spec's M2 asks for "an ugly but complete HTML UI" and defers real UI to M3.
Building two UIs back to back — one throwaway, one real — for the same feature
set would have cost more than it saved, so this project builds one React client
directly, styled with clear placeholder cards and layout (per the spec's own
placeholder instruction) rather than deliberately ugly markup. It satisfies both
milestones' actual requirements ("playable end to end" and "explains itself")
in a single pass.
