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
  everything else is combined, shuffled with the 128 bits of entropy the driver
  attached to the action (see "Randomness never reaches the wire" below), and dealt
  back preserving each player's *original* card count.

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
- **The mid-turn refill above can itself leave the player stuck.** If the pool's
  last few cards happen to be eggs, the refill "succeeds" (cards were drawn) but
  the player is still holding nothing askable. The mid-turn check now re-runs the
  same "no real cards and nothing to lay" test *after* the refill and passes the
  turn onward if it's still true, exactly mirroring what `beginTurn()` already does
  at turn start. Also found by simulation, once bot games ran long enough to drain
  the pool down to a lone egg on exactly the wrong turn.
- **A Whale reshuffle can deal the same stranding** to whichever player is
  continuing their own turn (most commonly the Whale's own user, since a real
  player's likeliest target pairing includes themselves): bad luck of the shuffle
  can leave them with only eggs. The fix is the same refill-then-pass check,
  factored out as `ensureCanContinueTurn()` and run after both a mid-turn lay and
  a Whale shuffle. Also found by simulation — this one took several thousand
  random games to surface, since it needs a Whale grant, an adjacent-seat shuffle
  including the current player, and an unlucky draw all at once.

## Every response is a window, not just squid's

`RESPONSE_PENDING` originally opened only when the target held an unused squid
grant; otherwise the engine resolved the ask instantly and pushed the outcome
straight to the event log, with no action from the target at all. Building the
real client surfaced a UX problem this design choice caused: the target's screen
would show "Pescuiește!" (or the cards changing hands) before the target had
done anything, which reads as the game answering on the target's behalf rather
than the target actually responding — a real loss of interactivity compared to
the physical game, where the person being asked is always the one who says it.

Fixed by always opening the window for the target, squid or not: a connected
player answers within the usual window timeout by submitting `SKIP_WINDOW`
(their honest response — "here you go" or "Pescuiește!", the client picks the
label from the target's own hand) or, only if eligible, `DECLARE_SQUID` (a lie);
a disconnected or slow player is defaulted to `SKIP_WINDOW` by the driver's
existing timeout, identically to every other window. No protocol or action type
needed to change — `SKIP_WINDOW` already meant "resolve this window without
declaring a power," which is exactly a truthful response. Bots needed no change
either, since `decideWindowAction`'s `RESPONSE_PENDING` case already fell back to
`SKIP_WINDOW` whenever the bot held no squid grant.

This also incidentally closes a secrecy gap: previously, a `RESPONSE_PENDING`
window opening *at all* implied the target held an unused squid grant (in Mode
Ascuns, where grants are otherwise invisible to opponents), a timing tell rule
4's "never revealed... by any change in timing" was already meant to forbid.
Every response now takes the same shape regardless, so the mere presence of the
window leaks nothing.

*Follow-up (FEEL_VISUAL_SOUND_PLAN §6.2, finding A2).* That last sentence was true
of the *view* but not of the *events*: `handleDeclareSquid` nulled `pendingWindow`
itself, so a Squid deny or claim emitted the same stream as an honest "no" minus its
leading `WINDOW_CLOSED(RESPONSE_PENDING)` — a tell in the shape of what every client
received. It now closes the window through `closeWindow`, the path an honest answer
takes, so the "no", the Squid deny and the Squid claim emit exactly
`WINDOW_CLOSED(RESPONSE_PENDING) › REQUEST_FAILED › DREW_FROM_POOL › TURN_STARTED`
(tests: `powers/squid.test.ts`, `presentation-leak.test.ts`). There is still no
`POWER_USED` for Squid. What remains is a rules-level tell: a *third player's* Clownfish
that binds to a silently used Squid learns (owner only) that one was used.

## Game end & scoring

- End condition ("exhausted"): the pool is empty **and** every player's hand contains no
  non-egg card. This is the simplest state that provably implies "no player can
  make a legal request" (eggs are never askable), without trying to prove the
  stronger, harder-to-compute claim that no *combination* of remaining cards could
  ever match between two hands. Two more end conditions were added on top of it:
  the 2N no-progress streak (reported as `reason: 'streak'`, see "Turn flow" above)
  and the public end check ("decided", next section). `GAME_ENDED` now carries
  `reason: 'decided' | 'streak' | 'exhausted'`, and the view carries `endReason`.
- Tie-break: highest score, then most completed power sets (destroyed ones still
  count — the spec ties this to "completed," not "currently active"), then shared
  victory. Directly as specified in rule 2.7.

## Deciding the game: the public end check (FEEL_VISUAL_SOUND_PLAN §3.9, §11.2)

95–97 % of well-played games used to end with a run of asks that could no longer change
the score (a median of 6 at three players, 12 at six), because each egg substituted into
a set strands a real card and the game then ran on until the 2N streak rule. The engine
now ends the game as soon as no set can still be laid — judged **only from the public
record**.

- **The rule.** At the end of every `reduce`, if the status is `IN_PROGRESS` and no window
  is open, the engine computes `publicSetsPossible(state)`. When it is 0 no set can ever
  be laid again, so neither the score nor the power-set tie-break can move, and the game
  ends with `GAME_ENDED { reason: 'decided' }`. It waits for rest (no window) so the last
  lay's windows finish. A Mantis cannot change a score (a destroyed set still counts,
  RULES §7), so this is about finishing the last lay's choreography, not correctness.
- **What the count is** (`packages/engine/src/setsPossible.ts`). The most sets that *any*
  assignment of ranks to the face-down power sets consistent with the public record could
  still yield, if every unlaid card, in hands and in the pool, could be gathered into one
  hand. Inputs: the deck's composition, the rank of every set whose rank is public, and
  the real/egg counts of every laid set (public for all sets, face down or not). It starts
  at 18 and is sent in the view as `sets: { possible, start }`, the same for every viewer.
- **It is an upper bound, and that is the point.** It ignores who holds what, turn order
  and every rule of play, so it can be larger than what can really still be laid: a game
  can sit at k > 0 with nothing left to lay (a stall) and then ends on the 2N streak rule
  (`endPressure: { misses, limit }` is the countdown for that). It is never *smaller* than
  the truth, so 0 means "provably nothing left" and the rule can never cut a game that
  could still change. Player-facing copy must therefore say "at most k sets" (i18n
  `game.setsAtMost*`), never "k more sets"; "the last set" is only a promise the count
  cannot make. "The count reaches 1 before every decided game" is an observation from bot
  games, not a guarantee: one lay can take it from 2 to 0.
- **Why the public record and not the server's knowledge.** A check that read true ranks
  ends one of two identical-looking endgames and lets the other play on, telling the table
  what the hidden sets are (Squid included). The "endgame pair" (two face-down 2+2 power
  sets, Squid+Squid vs Squid+Whale) is a test: `sets.possible` and the end timing are
  identical (`test/endCheck.test.ts`, `test/presentation-leak.test.ts`). The price of
  secrecy is that in Mode Ascuns the public check fires in a little fewer games than an
  omniscient one would.
- **Mode Deschis, and the round-4 caveat.** Round 4 of the plan review found that in Mode
  Deschis a used power set turns face down (`recordPowerUsed`, RULES §4), the redacted
  view stops naming its rank, and a check reading ranks only from `faceUp` sets *forgets*
  a rank the table already knows: the count rose 13 times in 300 games and ended later
  than the omniscient one. The implementation therefore defines a laid set's rank to be
  public when it is face up **or the game is in Mode Deschis** (every set is laid face up
  there, so its rank is in the public `SET_LAID` event). In Mode Ascuns `faceUp` only ever
  goes false→true (a set is laid face down and turns up on use or destruction; Squid never
  does), so it is exactly "ever public". This reads nothing hidden: it recovers only what
  was already on the public record. Result: the count never rises in either mode (property
  test over seeded bot games) and in Deschis equals the omniscient count. It remains an
  upper bound in both modes. The view itself is unchanged: a spent Deschis set still shows
  `rank: null` to non-owners.
- **What is not guaranteed.** The count is an upper bound, never exact, in Ascuns *and*
  Deschis. Malformed records (hand-built test states with empty sets) are ignored, which
  only loosens the bound. The check does not run while a window is open, so a window that
  exists only because of hidden holdings (a Mantis/Shark/Lanternfish/Tortoise holder,
  FEEL_VISUAL_SOUND_PLAN §6.6) delays the end by that window's length — a known rules-level
  tell, not one this rule adds.
- **Reasons.** The existing 2N rule (and the "nobody can act" safety valve) now report
  `reason: 'streak'`; "pool empty and no real card" reports `'exhausted'`.

## Randomness never reaches the wire (FEEL_VISUAL_SOUND_PLAN §6.3, findings A3, A4)

The old deal was `mulberry32(seed)` with a 32-bit seed sent to every client in
`GAME_STARTED`: brute-forceable from one's own seven cards, and every card id
(`c12_squid`) encoded its rank. Now:

- **The engine keeps no random state.** `GameState` has no `seed` or `rngState`;
  `createGame(players, deck, config)` takes the *ordered deck* (deal: seven rounds of one
  card per player from the front, the rest is the pool, drawn from the back). A `number`
  in place of the deck deals `seededDeck(seed)` — for engine tests and bot sims only.
  `USE_WHALE` carries `entropy` (four uint32 words), and the Whale shuffle is a pure
  function of the hands and that entropy (`shuffleWithEntropy`, unbiased rejection
  sampling); an action without it is refused. Seeded generators (`rng.ts`) remain for
  tests, and bots supply entropy from their own generator, so simulations replay.
- **The server** (`packages/server/src/random.ts`) shuffles with `crypto.randomInt`
  Fisher–Yates, gives every card a `crypto.randomUUID()` (independent of rank and shuffle
  position), and attaches 128 fresh `crypto.randomBytes` bits to every Whale action before
  `reduce`. A client-supplied `entropy` is discarded. Nothing seeded persists between
  actions and nothing here is ever serialized.
- **Test.** `packages/server/test/wire.test.ts` plays whole bot games through the real
  `Room` and checks every serialized message: no `seed`/`rngState`/`entropy` key, every
  card id a v4 UUID, no other player's or the pool's card id in a viewer's bytes, grant ids
  only to their owners. (The plan's "no field equal to an engine-RNG output in a seeded
  replay" is vacuous here: the server never runs the engine's seeded generators.)
- Room codes now use `crypto.randomInt` too (they gate joining).

## Per-viewer event redaction (FEEL_VISUAL_SOUND_PLAN §6.1, findings A1, A4, A5)

`view` was redacted per player but `events` went out verbatim: in Mode Ascuns every log
read "Ana lays down a set of Squid". `redactEventsForPlayer(state, events, viewerId)`
(and `redactEventsForSpectator`, the public record) in `redact.ts` uses the same
concealment predicate as the view and is applied per player in `Room.broadcastState`. The
`PublicEvent` type is what a client may import. Rules: `GAME_STARTED` has no seed;
`DREW_FROM_POOL.cardId` only for the drawer; `SET_LAID.rank` and `POWER_GRANTED.rank` are
`null` while the set is concealed; `POWER_GRANTED.unbound` is `false` for a viewer who may
not see the rank (it would otherwise announce a hidden Clownfish); `grantId` only for the
owner on `POWER_GRANTED`/`POWER_USED`/`CLOWNFISH_BOUND`; `CLOWNFISH_BOUND` is owner-only in
Ascuns and public in Deschis; `WINDOW_OPENED` carries `youAreEligible` instead of
`eligiblePlayerIds`, and its `SET_COMPLETED` context loses a concealed rank. Events dropped
for a viewer leave a gap in their `seq`, never a placeholder, so two non-owners receive
byte-identical streams (`presentation-leak.test.ts`, test 1).

## Action binding and who may close a window (FEEL_VISUAL_SOUND_PLAN §6.4, finding A9)

- The server overwrites `action.playerId` with the socket's player (`bindAction`), never
  accepts `entropy`, and accepts only client action types.
- `SKIP_WINDOW` now carries a `playerId`, and the engine refuses it unless that player is
  eligible in the open window. The room's timeout submits a separate, server-only
  `SERVER_SKIP_WINDOW`, which a socket cannot send. Bots and tests were updated.
- Left as it was: a window with several eligible players (`SET_COMPLETED` with two Mantis
  holders, `TURN_END` with two Sharks) is closed by the *first* skip, for all of them. A
  per-player pass list would be the rules-correct fix; it is not part of this change.

## Sequence numbers, the window clock, reconnecting (FEEL_VISUAL_SOUND_PLAN §3.10, §4.2, §4.6)

- The room stamps every event with a per-room, strictly increasing `seq` *before*
  redaction (one event, one seq for everyone); every view carries `seq`, the seq of the last
  event stamped. `ServerMessage.game_state.events` are `WireEvent`s (`PublicEvent & { seq }`).
- `pendingWindow.deadlineAt` (server clock, ms) and `serverNow` are in the view. The engine
  has no clock; `redactForPlayer(state, viewerId, { seq, serverNow, windowDeadlineAt })`
  takes them from the driver. The deadline is fixed when the window opens and is not reset by
  a reconnect (the old STATE_MACHINE text saying the countdown restarts on reconnect was not
  what the code did).
- A `rejoin` is answered with the current view flagged `snapshot: true` and no events: the
  client must not replay choreography for what it missed. The client re-sends `rejoin` on
  every socket open (finding A15), and ignores events whose `seq` it has already applied.
  A stale socket closing after its player rejoined on a new one no longer marks them absent.
- `endPressure: { misses, limit }` in the view is `staleRequestStreak` and `2N`: the stall
  gate's countdown.

## Absent players (FEEL_VISUAL_SOUND_PLAN §4.4, §4.6)

- **In a window,** an absent (disconnected) player is answered for by the server once the
  window's `windowTimeoutMs` elapses: the server-only skip closes it as an ordinary
  truthful, non-declaring answer (for the answer window that is the honest "hand them over"
  / "Pescuiește!"). This is the existing 12 s timeout, unchanged in length and applied to
  connected and absent players alike; STATE_MACHINE.md's "the room simply waits" is
  therefore true only of an absent player's own *turn*.
- **On their own turn** the room still waits (no forced pass, no turn timer). Round 4 of the
  plan review flags this as a hole in a phone game (a dropped player freezes the table);
  the decision between a turn timer with an auto-pass and a visible "the table waits" is
  still open and is a client-plaque matter for now.

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

## Design pass: the woodcut layer

`DESIGN.md` §1–§8 was implemented against the D0–D3 sheets. The calls worth
recording:

- **Faces: Vollkorn (display) + Source Serif 4 (text), both self-hosted.**
  §2 lists Fraunces first for display, but Vollkorn was taken for its heavier,
  blunter cut — it reads as pressed rather than drawn, which is the whole brief.
  Both are SIL OFL. The subsets are the Google latin and latin-ext woff2 slices
  (307 KB in total, in `packages/client/public/fonts/`); nothing is fetched from
  a CDN at runtime, per §2's "should not phone out".
- **Diacritics verified, as §2 demands.** `ȘșȚțĂăÂâÎî Pescuiește Țestoasă
  Meduză` was rendered in both faces at 12px and 48px: no tofu, and ș/ț draw
  with a *detached comma below*, not a cedilla. Both faces pass, so neither is
  disqualified.
- **Card art is authored once, in the 264×396 working space.** §4.2 asks for
  strokes re-emitted per size rather than transform-scaled. The shipped cards
  are one SVG per rank with a `viewBox`, so the browser scales them; the
  distinction is invisible in a vector pipeline and the alternative is three
  hand-maintained copies of nine carvings. The eight ordinary fish were cut on
  the half-size 176×264 grid and are lifted into card space by a single 1.5×
  group — same geometry, one coordinate system.
- **At `sm` a card is only its seal (§4.2), and that is what laid sets use.**
  A 44×66 plate cannot carry a carving or a rank name legibly, so the small
  plate draws the 24-grid sigil plus a sliver of the category collar. This is
  what sits under every post.
- **Long rank names are squeezed, not truncated.** CREVETE-MANTIS and
  PEȘTELE-FELINAR do not fit the 188-unit measure at any of the size steps, so
  they are set with `textLength` + `lengthAdjust="spacingAndGlyphs"`. A card
  always states its own rank in full.
- **The interruption window's context line sits under the header, not over the
  table.** §5.5 floats it at the top of the screen; floated over a real header
  it collided with the turn line and the controls. It is now its own ochre-bordered
  board directly beneath the header — same reading order, no overlap.
- **Sound is synthesised, not sampled.** §7 specifies the cues but no assets were
  delivered with the sheets, so `src/sound.ts` builds them from filtered noise and
  a short wooden body resonance. Per §6.6 sound and haptics are deliberately *not*
  disabled by `prefers-reduced-motion`; the Sunet toggle is the only thing that
  silences them.
- **The hover-to-ask flow of the previous pass was kept and the sheet's flow
  added alongside it.** §5.4 asks for "tap a post, then a card"; the rank chips
  inside a post already worked and are the faster path on a pointer device, so
  both now resolve to the same `REQUEST`.

## The one-screen table, the hand and the dev tables (FEEL_VISUAL_SOUND_PLAN §5.2-§5.3, §4.4, §7.1-§7.4)

- **Two layouts, one store.** `useDesktop()` (>= 900 px) picks the pond table (five 150 px posts on an arc, 280 px log board, drawer tab below 1100 px) or the one-screen phone table (40 px bar, 96 px strip of 60x76 chips, flexible pond, dock). Both carry `data-player-id`, `data-pool`, `data-basin`, `data-hand-card-id`, `data-totem`, `data-tally`, `data-gate` for the choreography to fly between.
- **Tally copy** was "at most" here; M4 changed the label to the plan's "încă N seturi" / "ultimul set" and kept "at most" on the title and the screen-reader label (the count is an upper bound). The stall gate reads "N încercări până se închide balta" and appears once `misses >= N`.
- **Answer window.** Two equal buttons, one lock/stamp and one local `clock.close` cue whether the answer is honest or a Squid lie; the lie button exists only for a holder of an unused Squid (A23). Structural windows show the neutral "fereastră deschisă" to everyone who cannot act. No `<select>` remains: Jellyfish taps a target, Stickleback a target then a seal, Whale an adjacent pair, all in the bottom 45 %.
- **Optimistic declare** locks the plank; "Prea târziu - X a fost mai rapid" is derived from the window closing without our `POWER_USED` (naming the other `POWER_USED`'s player when there is one).
- **Bot table and fixtures** (`src/dev/`, lazy chunk): `?table=bots&n=&seed=&seat=&speed=&bots=memory|random&until=myturn|answer|dry|end|turn:N|sets:N&auto=1&mode=&panel=0`, `?fixture=<id>` (or `?fixture=` for the menu). The driver plays the room's part (seq stamps, window deadline and the server-only skip, Whale entropy, bound actions). The memory bot lives in `packages/engine/src/cli/membot.ts` (exported with the engine's bots).
- **`npm run layout:check --workspace=packages/client`** runs 94 layout frames and interaction checks in Chromium.

## The presentation timeline, the ask's choreography and the powers' visuals (FEEL_VISUAL_SOUND_PLAN §4.1-§4.5, §5.5, §5.7, §6.5)

`game/beats.ts` and `sound.ts` are gone. In their place:

- **`game/choreography.ts` is pure**: `(PublicRecord, SeatFacts, options) -> Choreography` (beats with lane, class, lead-in, duration, flights, VFX, ops, masks, cues, haptics). It reads nothing private: no hand, card id, grant, eligibility, window context beyond the two players named aloud (a test greps for it). Cues and haptics come from `cuesFor`/`hapticsFor` and are *placed on* the beats they belong to; the visuals are placed so their landings coincide with the cues' `BEAT` constants. `game/record.ts` is the only adapter from `RedactedView` + `WireEvent`s to those inputs.
- **`game/presenter.ts` plays it** against the page (`game/stage.ts` is its hands: anchors, fliers, masks, juice). The store hands it every server message, in order, *before* the React state update, so views are diffed message by message (React's batching would otherwise merge an ask and its instant answer into one diff and lose the close). Lanes: `table` in order; `hud` and `log` parallel. A beat anchored to `arrival` starts when the message arrives (the plank rising, the 220 ms close, the log stamp), the rest when the table lane is free. Backlog: >1.2 s queued is 1.5x with the cues' short variants; >2.5 s (or a hidden tab) flushes to the end state and plays only the last landing. A `snapshot` (rejoin) never replays anything.
- **Masking.** Logic and input read the view at once. Masks are `data-masked` tokens the presenter sets and re-applies after every render (before paint): the totem, an arriving hand card (never longer than 800 ms), a laid set, the notches just knocked from the tally, the answer plank until its roll, the podium. A departing hand card is a ghost card-back until it takes off. The chrome (top bar, dock lift and rope, the ochre chip) follows the *shown* turn (`presenter.getPresented`), which changes when the totem lands; the input follows the view.
- **The ask, exactly as §4.1:** the arrow-chip is a carved token bearing the rank's seal (templates for every rank in the hidden shelf of `FlightLayer`, cloned); it flies asker to target (320 ms), rocks while the answer is out, flips ochre on a yes (backs fly 460 ms, 60 ms stagger), dives into the pond on a wet go fish (ring at +300, a card rises to the asker), or drops on the basin floor on a dry one (a puff of dust, nothing else). Rest is 700 ms for up to three cards (+60 per card) and 800 ms for a go fish; the totem leaves at +300 and lands at +760. Card flights are FLIP along a quadratic arc lifted 40-80 px, `clamp(distance/1.8, 260, 460)` ms with the *landing* fixed (the takeoff waits), a hash-seeded flutter of at most 6 degrees, an elevation shadow layer that peaks mid-flight (opacity only), at most twelve in the air (later ones land instantly). Every flier in the air is a card back: what leaves a hand is the public look of a card.
- **Retimed cues.** When several seats stop the totem in one step (a stunned skip, a pass), each stop waits 420 ms for the last one's cue (`BEAT.turnGap`); before this two seat signatures sounded at the same instant. The end-of-game music waits for the podium (`BEAT.podium`).
- **Uniform close.** Every window that leaves the view closes with the same 220 ms stepped animation (a ghost of the plank or banner as it last was), with `clock.close` only for the answer window. The leak tests pin the duration.
- **Juice.** Hit-stop pauses the flights in the air for 70 ms (audio does not); trauma shake is `trauma^2 x 6` px (4 px under 900 px), translation only, on `[data-table-layer]` only; one impact frame per heavy step and never two within a second, drawn as an ink/paper swap on the art (pond well, laid plates) and never on text; all off under reduced motion, where flights land instantly and the order is kept. Classes: light (no juice), medium (trauma 0.4, under 1 px), heavy (shark, mantis, whale, the last set, the pool's last card), ceremony (start, end).
- **The powers.** The reveal (Ascuns): the owner's plate lifts, flips in three stepped frames, rises to the pond's centre with its seal, holds 400 ms, presses flat: about 1.3 s, a flier in the layer over the table, never blocking. Shark: the cards turn at a hard corner at 55 % of their path. Lanternfish: a mirrored chip goes back. Tortoise: the shell clamps. Jellyfish: the bell stamps the target's plate. Stickleback: a straight, fast yank (or a hook that catches nothing). Whale: twelve backs spiral at the pond's centre, then the redeal. Mantis: hit-stop, an impact frame, splinters; the crack is masked until the strike. `POWER_GRANTED` ignites the plate's collar core the same way for every hidden rank. Squid produces no beat. `art/vfx.tsx` holds the thirteen stepped effects (3-4 frames at 12 fps, each at most 2 KB, checked by a test; `?lab=vfx` shows them).
- **Laid sets** are drawn pressed flat: `LaidRow` under each desktop post and beside your own name; a face-down set is one uniform back for every hidden rank; a pip is gouged when it is pressed. On the phone there is no room in a 60 x 76 chip, so they live in the log drawer (the same plates); flights to a phone seat land on the chip.
- **Audio wiring.** Cues from `cuesFor` go to the engine at `origin + cue.at` on its lookahead scheduler, visuals `engine.visualDelayMs()` later; `setWorld` (pool, tally) and `setAnswerWindow` (the server deadline, T = 5 s) are fed from every view; haptics through `playHaptics`; "tap for sound" hangs from the top bar while the context is not running; the lobby and waiting room have the full pond (`amb.lobby` scene) and each join/leave sounds the seat's signature; `meta.nudge` after 15 s idle on your turn; `meta.reconnected` as before. Squid is never voiced (cuesFor) and no structural window ever is.
- **Two fixes found on the way.** `hapticsFor` read `SHARK_JUMP.loserId`, which the engine never sends (it is `fromId`), and `SET_DESTROYED.ownerId`, which it never sends either (the adapter now reads the owner from the view that came before the event: the owner of a set is public).
- **Reconnect and away.** A rejoin re-syncs without choreography; lines that arrive while the tab is hidden, or that a snapshot carries, are logged under "cât ai lipsit" / "while you were away" (`AwayMark` in the store).
- **Metrics (`?metrics=1`)**: answer time (median, p90), eligible and missed windows, tally-0 to podium, answer to rest, an overlay and `window.__metrics`. **`tools/perf-check.cjs`** (`npm run perf:check`) builds, serves the production bundle, throttles the CPU (4x by default) and plays a human at a six-player bot table for 90 s, then a whale on a six-player fixture three times: input to visual p95, answer to rest p95 (from the answer leaving the view to the last landing), fps in a whale. The bot table's local room now answers a human's action 24 ms later, like a server would, so a tap's first paint is the plank locking and the reply's cost is counted as answer to rest.
- **Deliberately not done here (all done in M4, see "The world arc, the ceremony and the surfaces"):** Tortoise's "cards drop back", the phone laid-set plates, the podium's "pips count up", texture and ink, the Codex.

## The world arc, the ceremony and the surfaces (FEEL_VISUAL_SOUND_PLAN §3.9, §5.4, §5.7-§5.9; M4)

**Textures and ink (§5.4).**
- `packages/client/scripts/bake-textures.mjs` makes the three surfaces as small static files with fixed seeds:
  `public/textures/paper.png` (a 128 px indexed PNG, 2 KB, ink specks and fibres at 7 / 12 / 16 %), `wood.svg`
  (9 KB: 45 wavering grain lines that wrap, two knots) and `water.svg` (2 KB: chisel-cut crescents on a 96 x 48 tile).
  13 KB against the 30 KB budget. `--check` (a test) fails if the files differ from a fresh bake. The stripes of A21
  (`--grain`, `--grain-lemn`) are gone; `--grain` now aliases the water and `--grain-lemn` the wood.
- `scripts/bake-ink.mjs` bakes the vertex jitter into `src/art/baked.generated.ts` (faces) and
  `baked-back.generated.ts` (the back). It reads the authored vector by bundling `carvings.tsx` and `cardArt.tsx` with
  esbuild and rendering them with react-dom/server, then moves every polygon, path, rect and circle vertex 1-2 units
  along its normal (noise keyed on the vertex position, so shared corners stay joined), subdivides straight edges longer
  than 44 units, and pools ink where a stroke ends. **One seed per asset**: `carving:<rank>` and `frame:<rank>` for a
  face, the single string `back` for the back - never a rank - so every hidden card is one constant. Whole units, single
  quotes: 26 KB raw for eighteen faces, 2.8 KB for the back. Frames are set in 10 units (`FRAME_INSET`) because the plate
  is stroked 16 wide and its viewBox clips the outer half, which would have kept the outer edge straight. The
  feTurbulence + feDisplacementMap fallback was not needed and is not shipped.
- **Contrast is audited with the grain on** (`scripts/contrast-audit.mjs`, run by the test suite): each text/surface pair
  is computed at the surface's worst pixel (paper at 16 % ink, wood at its darkest grain line, water at its lightest
  wave), and on every step of the light. It found four failures and they were fixed in `tokens.css`, not waived:
  `--pe-apa` #9db3bd -> #b8cbd3 (5.6 -> 7.05:1), `--pe-apa-slab` #7f949f -> #93a8b3, `--pe-hartie-slab` #5c5245 ->
  #54493c (4.3 -> 4.9:1) and `--ink-soft` #3b322a -> #2e2721 (older log lines on the recessed board were 6.1:1). Body text
  is >= 7:1 everywhere; the two secondary pairs sit at 4.8-4.9:1 (>= 4.5, large or supplementary text only).
- **Light follows the tally**: `[data-light]` on the root steps `--apa` / `--apa-2` to `--apa-l1..3` at 12, 6 and 1 sets
  still possible (`game/world.ts`, pure and tested). The presenter sets it when the notch that took the count there is
  knocked out (or at once for a rejoin / a step without a lay). Flat steps; no gradient anywhere.

**The world arc (§3.9).**
- Stages (`worldStage`): dusk 18-13, evening 12-7, night 6-2, the last set 1, finale 0. `data-stage` is on the tally and
  the root; the night's pegs glow with a hard ochre ring (no blur), the last peg is inked and ringed, its label is bold
  ochre. Each stage change is announced to screen readers (`a11y.stage.*`).
- **The ambience was confirmed, not changed**: `Ambience.update` drains the water to wind when `poolCount` is 0 at any
  stage; `table.poolEmpty` (the gurgle) fires on `DREW_FROM_POOL.poolEmpty`; `amb.lastact` (the dobă pulse) runs from a
  count of 3 at 3.2 s and quickens to 1.6 s at 1; `mus.lastset` fires when the count reaches 1. All four are functions of
  the public pool and tally only.
- **The tally label follows §4.5 verbatim** - "încă N seturi" / "ultimul set" (EN "N sets to go" / "the last set") - as
  the loose end asked, but the count is still an **upper bound**, so the honest wording stays where it can be read: the
  tally's `title` and screen-reader label say "cel mult N" / "at most N", the Codex's last line says it, and RULES §7
  already does. (This reverses the M2/M3 "at most" label; it does not change the number.)
- **Notches**: the rim is a carved bar with one peg per set; a lay knocks its peg out (chips fly, the stump stays); a lay
  that also strands another set's cards takes two, two chip bursts fly and a "-2" stamps beside the tally for 1.7 s.
- **The last card of the pool** drains the basin (`drain` op on the `poolEmpty` beat: the water stands, goes in six steps
  and the dry floor shows; instant under reduced motion; announced).
- **The gate**: shuts a notch per miss (already), and now swings open when a capture or a lay resets it (`is-thrown`,
  520 ms), with the `amb.gate` creak the cues already carried.
- **The ambience opt-out** is counted for the playtest: `?metrics=1` records how many times this device switched the pond
  off (`ambience.turnedOff`, `offNow`) and whether it is muted. It is per device; the playtest pools 15 of them by hand
  (5 or more -> ships off). Nothing is sent anywhere.

**Finale and podium (§5.7).**
- After the last lay's stamp, one held beat and the gate doors (the choreography already had them) the podium unmasks.
  `Podium.tsx` (a lazy chunk, prefetched when the table mounts): the winners' posts rise (stepped, staggered); a tie is
  equal totems on equal posts (and the title says "Egalitate"); each post has its own pips that count up one step at a
  time (CSS, once `[data-podium]` loses its mask); `table.tally` is emitted by `cuesFor` for every viewer, one per pip,
  a semitone-pair higher each (the scores are public, so Law 1 holds; the leak tests compare it) and placed on the same
  steps by the choreography (`podiumAt + 900 + 110 k` ms, at most 18 pips). `mus.end.win / tie / lose` are unchanged.
- Each `GAME_ENDED` reason has its own line on the podium (`game.endDecided / endStreak / endExhausted`), its own log
  line (`log.gameEnded*`, `exhausted` was missing) and its own ticker line.
- **Start**: the gate opens (`gateDoors`), the posts carve in (stepped, with the seat signatures the audio already plays),
  the tally's pegs are carved on the rim one after another. The waiting room's posts carve in as their players join.
  The lobby and waiting room stand in front of the pond at dusk (`art/dusk.tsx`, flat bands, a sinking sun, reeds).

**The Codex (§5.8).** Rules panel, two tabs. Each of the nine powers: the carving (the real `Card`), the seal, the kind
(reactive / active / special), a one-line rule in RO and EN, and a stave (a contour of the motif's notes) with a
button that plays it in full (`power.used.<rank>`, `full: true`). Squid shows the rest - an empty stave with a whole
rest - and its button answers with a flash and no sound. Lazy chunk with its own stylesheet. The panel is now a real
dialog (focus in and back, Tab trapped, Escape closes).

**Loose ends.**
- *Tortoise "cards drop back"*: built with what the record gives. `TORTOISE_BLOCK` does not say how many cards were
  about to move, so **one** back lifts from the shell toward the asker (`before.currentPlayerId`, public) and drops back,
  for any count; the leak tests compare it.
- *Phone laid sets*: your own laid sets show as compact plates in the dock (the newest five, then "+N"; the drawer lists
  all); an opponent's are the score on the chip and the drawer. Lay flights to an opponent land on the chip, to you on the plate.
- *Ticker*: the ticker shows short lines (`log.*.s`, all under 48 characters, tested); the log keeps the full ones. A dry
  go fish reads "- Pescuiește!" and nothing more (it used to say the asker "draws from the pool").
- *Copy audit* (`test/copy.test.ts`): RO and EN have the same keys and the same placeholders; every ticker line fits;
  the tally's label and its honest title; a copy for each end reason; no static line says "you may lie with Squid".
- *Icons*: the top bar's icons are cut, not drawn - angular, mitred, square-ended on the seals' 24 grid.

**Accessibility (§5.9).**
- No state is carried by colour alone (audited): stunned = the branded plate + the jellyfish seal; protected = the shell
  + the rank's seal; offline = a dashed border + the hook; the current turn = the ochre border *and* the totem *and*
  the words "Rândul lui X" / "Rândul tău"; selected = lift + rope tie + a "PUNE JOS" tab; spent = an X gouged in the
  collar; destroyed = cracks; the last set = a taller inked peg + the words "ultimul set"; the gate = shut pegs + a count.
- Screen readers: `Announcer` (two aria-live regions) says the ask that is put to you (assertive), every public log
  line as it is written, the stage changes, the pool running dry and the gate; the top bar's turn line is its own live
  region; the answer plank is an assertive dialog. None depends on sound.
- Keyboard: every control is a button or has `tabIndex` and Enter/Space; hand groups are `group`s when you cannot act
  and buttons when you can; dialogs trap Tab; the log drawer closes on Escape. **A clip-path cut the focus ring off
  every `.btn`**: focused controls now drop their notch (`clip-path: none`) and the ring is ochre on water, ink on paper.
  The layout check Tabs through a table and fails on any control without a >= 2 px ring.
- Photosensitivity: the impact frame (a two-frame ink/paper swap on the art only) is at most one per second and never
  on text (`Stage.impact`); shake is translation only, <= 6 px; the window frame pulses at 1 Hz; the podium's pips
  step at 9 Hz on ~16 px areas and the drain overlay steps six times in 0.9 s at 22 % alpha - all under the 3-flash
  limit and none of them a full-screen flash. Under `prefers-reduced-motion` the posts are simply there, the pips
  already counted, the basin dry, the flights instant, and audio is unchanged.

**Performance (§9.1).** See "Performance" below.

## Uniform windows: decided and deferred (FEEL_VISUAL_SOUND_PLAN §11.1, §6.6, finding A6)

The plan's §11.1 offers three ways to make the structural windows uniform. **Decision: (a) and (b) are deferred, (c) is
left as a playtest A/B. Nothing here changes the rules, the engine or the wire.** What follows is what that costs, what
still protects the table, and what would have to be true to revisit it.

**The tell.** Five windows open only when someone can act in them - `TURN_START` (an active power), `REQUEST_DECLARED`
(Lanternfish), `TRANSFER_PENDING` (Tortoise), `SET_COMPLETED` (Mantis Shrimp), `TURN_END` (Shark) - and the view shows a
window to everyone. So *that a window opened*, and the pause it causes, tells the table that somebody holds the matching
power. The answer window (`RESPONSE_PENDING`) is the one window that always opens (see the section above), which is why
Squid leaks nothing this way. The tell is **structural: it lives in the rules, not in the presentation**, and no amount of
sound design removes it (§6.6).

**(a) Fold `TURN_START` into the turn (active powers offered in the dock before the ask, no window) - deferred.** The plan
prices this at "cost: none". It is not free, and it was not cheap enough to do safely inside a fix pass:
- The engine's one-active-power-per-turn rule is *implemented by the window*: `handleUseJellyfish/Stickleback/Whale` all
  `requireWindow('TURN_START')` and close it, so the power is spent and the window cannot reopen. Without the window the
  engine needs its own "an active power was used this turn" state, reset in `beginTurn`, and the actions become legal in
  `AWAIT_REQUEST` with no window - i.e. `handleRequest`'s `pendingWindow !== null` guard, `settleAwaitRequest` (stunned
  neighbours, no legal target), `ensureCanContinueTurn` (Whale can strand a hand of eggs) and the stall gate all have to be
  re-derived for "a power may be used, or an ask may be made, in either order".
- A turn timeout today is the driver's `SERVER_SKIP_WINDOW` on the window; with no window, an idle *turn* is a different
  case in `room.ts` and the bots (`cli/bot.ts` `decideWindowAction` has a `TURN_START` case).
- It is the engine's public contract: `STATE_MACHINE.md` and `RULES.md` (§ "TURN_START -> stun check") describe the window;
  `windows.test`, `powers/{jellyfish,stickleback,whale,clownfish,squid}.test`, `createGame.test`,
  `presentation-leak.test` (engine and client) and the client's choreography, cues, haptics and `Windows.tsx` all name it -
  about 50 assertions to re-baseline, and the simulation's action mix would change (the bots would choose *when* to use a
  power). Re-baselining that many tests honestly is a milestone, not a fix.
- It removes one of the five tells only. The other four stay, so a table that watches windows still learns from the other
  four. The value is real but partial.

**(b) The single answer plank - deferred.** Folding the truth, the lie, the reflection and the protection onto the one plank
also changes the rules (the Lanternfish and Tortoise windows disappear as separate steps; "after a reflection the asker
always gets one short plank") and the Lanternfish/Tortoise holders' agency (they would act *inside* the answer window).
That touches the request flow in `engine.ts` (`REQUEST_DECLARED`, `TRANSFER_PENDING`), the reflection and protection
semantics, and every test around them. It saves waits, but it is a rules decision for the owner of the rules.

**(c) Fixed-length beats for Mantis and Shark - left as a playtest A/B.** A 2.5-3 s beat after every power-set lay and
every successful ask, ended early only by a declaration, would hide the *pause* but not the *banner*, and costs about
**60-110 s a game** (about 6-9 power lays and 22-29 successful asks). It is the one option that trades game length for
secrecy, so it belongs in playtest 1 as an A/B against accepting the group-level tell, not in the code by default.

**What stays in place - the residual (§6.6).**
- *Neutral banner:* everyone who cannot act sees the same words, `game.windowOpen` ("fereastră deschisă" / "window open"),
  never the window's name or power (`WindowBanner` in `Windows.tsx`; the plank's own text is the eligible player's alone).
- *Silent audio:* a structural window opening or closing makes no sound; the close is the same 220 ms visual for all, and
  `clock.close` sounds only for the answer window (`cues.ts`; `presentation-leak.test.ts` "test 2" proves the erased-window
  audio is identical, and a source guard keeps `Windows.tsx` from playing any `ui.*` cue - no `ui.press.soft`, no
  `ui.drop`, no `ui.press` in a window).
- *The pause:* the window's own duration - a hold to the deadline, or until the holder passes - is visible and is **not**
  masked. It is the residual tell.
- *The test that keeps us honest:* `packages/client/test/presentation-leak.test.ts`, "the rules-level tell (§6.6)", builds
  the five windows (one scenario each) and states the property the plan wants - the public sequence of windows is the same
  whether or not the power is held. Each is marked **`it.fails` (known-failing)** with a reference to §11.1, plus one
  passing control proving each window really does open in the public view when its power is held and never when it is not.
  When §11.1 lands, the `it.fails` flips red and must be deleted; until then the gap is a tested fact, not an unwritten one.

**When to revisit.** After playtest 1: if the table reads windows ("he paused, he has a Shark"), do (a) first (the
smallest engine change, one tell fewer), then (b), and A/B (c). The engine tests will need to be re-baselined, not patched.

## Performance (FEEL_VISUAL_SOUND_PLAN §9.1; M4 loose end d)

`npm run perf:check --workspace=packages/client -- --seconds=200` (production bundle, phone 390 x 664, CPU throttled 4x,
a six-player memory-bot table played by hand; the previous agent's report was p95 72-210 ms input to visual):

| Gate | Target | Measured (final) | Before the fixes (same script) |
|---|---|---|---|
| input -> visual, p95 | <= 50 ms | **77 ms** (n = 26, median 34, one 296 ms outlier) | 153 / 115 / 250 ms (three runs, medians 31-50) |
| answer -> rest, p95 | <= 900 ms | **884 ms** (median 825) | 865 / 961 / 916 ms |
| fps in a whale, worst of 3 | >= 55 | **58** (58, 60, 60) | 60 / 59 / 59 |

**Input to visual is still over target (77 ms p95 at 4x CPU on this machine). It is not met and is not claimed.** What
was found and fixed:
- `presenter.afterRender` -> `snapshotWindow` called `getBoundingClientRect` inside React's layout-effect phase on every
  render of the table: a forced synchronous layout, **19 ms of a 4x-throttled tap**. It now runs in a `requestAnimationFrame`,
  after the frame's own layout.
- Every press's sound was synthesised inside the input handler (6-10 nodes; 3-6 ms at 4x). `engine.play(..., { afterPaint })`
  queues the cue and ticks the scheduler after the next paint: the sound costs one frame (input -> audio stays well inside
  80 ms plus output latency), the frame that shows the press is not delayed. Used for `ui.select`, `ui.target`, `ui.press`,
  `ui.error` and the answering device's `clock.close`.
- `:active` styles (`presentation.css`) put the lift, the pressed row and the pressed plank button on the frame after
  `pointerdown`, before React hears the click; the ask sheet no longer rebuilds the pond (`display: none` instead of unmount).
- Measured on fixtures at 4x (Event Timing): the tap on a group 56-112 ms -> 40-56 ms; Space on the answer plank 48-56 -> 32 ms.

What is left: the p95 is set by the *keypress that answers* (the slowest four are all `key`): it lands while the previous
step's flights, the plank rise and the ambience scheduler are running, and in the bot table the engine and the bots run on the
same thread (a real table has the server do that, not the phone). 14.5 s of the 60 s profiled at 4x was `(program)` - the
browser's own style, layout and paint work - against ~1.2 s of React; the remaining cost is rendering, not scripting
(CSS containment was tried and made no difference, so it was not kept). The plan's real target (a mid-range Android) is
not measured here; a throttled desktop Chromium is a proxy. Next candidates: fewer nodes per hand card (the baked faces are
paths, not the old polygons), and `content-visibility` on the log drawer.

**Budgets (gzip, production build).** *Updated after the verifier's pass.* The lobby loads **105.2 KB** of JS (+ 10.1 KB
CSS); the table (15.1 KB), the audio render catalog (2.9 KB) and the podium (1.1 KB) are lazy, so **a played game loads
124.4 KB, inside the plan's 125 KB** (main 105.23 + GameTable 15.07 + catalog 2.94 + Podium 1.14, as `vite build` reports;
the same files gzipped at level 9 are 123.9 KB). It was 126.8 KB before this pass (main 107.71): the Codex's 21 strings per language now
live in `client/src/i18n/codexStrings.ts` (read only by the Rules panel and the Codex, which are lazy; -1.2 KB), and the
`?metrics=1` read-outs moved behind a facade (`game/metrics.ts`) that downloads `metricsImpl.ts` only when the URL or the
perf script asks (-1.3 KB from main; a player never loads it). The Rules panel, the Codex and the metrics module are 2.3 +
1.3 + 1.9 KB more, on demand; the dev tools and labs (18.3 KB) never reach a player. Textures 13 KB of 30; audio downloads 0 KB.


## Sound: the palette re-voiced (SOUND_DESIGN.md)

The audio module (`packages/client/src/audio/`) was re-voiced against a sound brief: carved and printed, not polished. The design, the
event → cue table, the list of public fields a cue may read, and the measured results are in `SOUND_DESIGN.md`. What was decided, and why it
matters to the rest of the repo:

- **Only Shark, Mantis Shrimp and Whale leave the palette** (they are the cards that break the rope frame in the art). The eight fluier / caval
  motifs, the țambal cues, the four score-race cues (`table.lead / breakaway / chase / clinch`), the win / tie / lose music, the dobă pulse and the
  pond's birds are gone. The score race is still drawn and buzzed (haptics); it is no longer voiced.
- **No private tier.** `clock.eligible`, `power.granted.mine` and the Ascuns `power.clownfish.bound` are gone: a cue only one client can hear is a
  tell. The eligible player still has the plank, the clock and (Android, opt-in) the private buzz — haptics are unchanged.
- **The mapping is a projection.** `cuesFor` reads only the fields in `SOUND_FIELDS` (`audio/cues.ts`); `test/soundfields.test.ts` fails on any other
  read. `POWER_USED` and `POWER_GRANTED` are read by type alone; a Squid use is dropped by `record.ts` before anything sees it (the engine emits none).
- **Variation is seeded by the run of cues handed out**, not by the room `seq` (which counts events a client never receives) and not by a step's
  content (a silent structural window splits a step in two).
- **The world steps.** At 12, 6 and 1 sets still possible the ambience takes one flat step darker (a fixed low-pass and level, a 25 ms ramp) with a
  knock (`world.dark.*`); each notch that counts down gets a chisel tick (`world.notch`); the pond becomes wind on the pool-empty event, in 400 ms.
  The presenter turns them on the beat of the cue, not when the view arrives (`engine.worldAt`).
- **Ducking is back, for rare cues only** (`DESIGN.md` §0.1, row 7.5, said none): the call, the podium, the three darkening knocks, Shark, Mantis,
  Whale and the reveal duck the ambience 10 dB; nothing frequent does.
- **The audition page is development-only** (`import.meta.env.DEV`); a production build contains no lab chunk.
- **Eggs are written down.** `table.egg` ticks once per egg in a set laid; the log line for a set laid now names the eggs used (audio is never the
  only channel).
- **Still open, and not audio's to close:** a structural window opening at all, and how long it stays open, is visible in the public view and tells the table
  someone holds the matching power ("Uniform windows: decided and deferred"). Every structural window is silent for every client; the pause remains.
