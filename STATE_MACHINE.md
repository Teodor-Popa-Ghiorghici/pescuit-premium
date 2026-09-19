# Turn State Machine

This document is the design the engine (`packages/engine/src/engine.ts`) was built
against. It's written before-the-fact in spirit — read it first, then the code —
even though in practice the two evolved together and a handful of edge cases below
(marked "found by simulation") were only discovered by running thousands of random
games and folded back in here afterward.

The pure engine never runs a clock. A "window" is just a value in
`state.pendingWindow` naming who's eligible to act in it; the *driver* (CLI bots for
M1, the WebSocket server for M2+) is responsible for actually waiting up to 12s and
then submitting `SKIP_WINDOW` if nobody declares. Every state transition below is
one `reduce(state, action)` call.

## Top-level shape

```
                    ┌────────────────────────────────────────┐
                    │              beginTurn()                │
                    │  stun-skip loop → protections expire →  │
                    │  refill if no real cards → game-end?    │
                    └───────────────────┬──────────────────────┘
                                         │
                                         ▼
                              ┌─────────────────────┐
                    ┌─────────│   TURN_START window  │◄── only if the active
                    │         │  (active powers, at  │    player holds an
                    │         │   most one per turn)  │    unused active power
                    │         └──────────┬────────────┘
                    │                    │ declare or skip
                    │                    ▼
                    │           settleAwaitRequest()
                    │        (pass turn if no legal target
                    │         remains — see "found by simulation")
                    │                    │
                    ▼                    ▼
             (no eligible          ┌───────────────┐
              active power) ──────►│ AWAIT_REQUEST │◄────────────────────────┐
                                    └───────┬────────┘                        │
                                            │ REQUEST(target, rank)           │
                                            ▼                                 │
                                ┌────────────────────────┐                    │
                                │ REQUEST_DECLARED window │  (lanternfish?)    │
                                └───────────┬──────────────┘                  │
                                            ▼                                 │
                       reflected? ──yes──► skip RESPONSE_PENDING              │
                          │no                     │                          │
                          ▼                       │                          │
                ┌───────────────────────┐         │                          │
                │ RESPONSE_PENDING window│ (always)│                          │
                └───────────┬─────────────┘        │                          │
                            └───────────┬───────────┘                         │
                                        ▼                                     │
                             ┌───────────────────────┐                        │
                             │ TRANSFER_PENDING window │ (tortoise?)           │
                             │  — skipped entirely if  │                       │
                             │  nothing would move     │                       │
                             └───────────┬─────────────┘                      │
                                         ▼                                    │
                            cards move (if any) between hands                 │
                                         ▼                                    │
                                ┌─────────────────┐                           │
                                │ TURN_END window  │ (shark? only if          │
                                │                   │  something moved)       │
                                └────────┬───────────┘                        │
                                         ▼                                    │
                        bonus turn? ──yes──► beginTurn() (same player) ───────┘
                              │no
                              ▼
                     draw from pool if fail/blocked
                              ▼
                     advancePlayerIndex()
                              ▼
                          beginTurn() ───────────────────────────────────────►(loop)
```

`LAY_SET` is orthogonal to this spine: it's legal any time `pendingWindow === null`,
for any player, and may itself open a `SET_COMPLETED` window (mantis shrimp) before
returning control to wherever the main spine was resting — it never disturbs
`state.resume`.

## Scenario walkthroughs

### Normal ask, no bonus (failure)

1. `AWAIT_REQUEST` → `REQUEST(a→b, herring)`.
2. No lanternfish held by b → `REQUEST_DECLARED` window skipped automatically.
3. `RESPONSE_PENDING` always opens for b, squid or not (see "Every response is a
   window" below) — b answers with `SKIP_WINDOW` (truthfully) or `DECLARE_SQUID`
   (a lie, only if b holds an unused squid).
4. b truly holds no herring → outcome `fail`, nothing to transfer →
   `TRANSFER_PENDING` skipped automatically (nothing to protect).
5. Nothing moved → `TURN_END` skipped automatically (shark has nothing to take).
6. a draws one card from the pool (if any). Turn passes to the next player.

### Every response is a window, not just squid's

`RESPONSE_PENDING` used to open only when the target held an unused squid grant;
otherwise the engine resolved the ask instantly, on nobody's say-so. That made the
target's own client show a fait accompli — the log would already read "Pescuiește!"
before the target had done anything, which felt like the game playing itself instead
of a person across the table refusing your ask. The window now **always** opens for
the target, whether or not they hold squid: a connected player answers within the
usual `windowTimeoutMs` by submitting `SKIP_WINDOW` (their honest "here you go" or
"Pescuiește!") or, if eligible, `DECLARE_SQUID` (a lie); a disconnected or slow one
is defaulted to `SKIP_WINDOW` by the driver's timeout, exactly like any other window.
Bots already handled this generically (`decideWindowAction`'s `RESPONSE_PENDING`
case falls back to `SKIP_WINDOW` when they hold no grant), so no bot-layer change was
needed. This also removes a pre-existing timing tell in Mode Ascuns: previously, a
window opening at all on this step implied the target held an unused squid grant;
now every response takes the same shape regardless, win, lose, or lie. See
DECISIONS.md.

### Ask with bonus turn (success)

Same as above through step 3, except b truly holds herring:

4. outcome `success`, cards about to move from b to a → `TRANSFER_PENDING` opens
   only if b holds an unused Tortoise (or already has a standing protection, in
   which case the window is skipped and the block is automatic).
5. No block → cards move. `TURN_END` opens only if someone else holds an unused
   Shark.
6. No shark jump → a takes a bonus turn: `beginTurn()` runs again for a (a fresh
   `TURN_START`, a fresh chance at one active power).

### Lanternfish reflection

1. `AWAIT_REQUEST` → `REQUEST(a→b, herring)`.
2. b holds an unused Lanternfish → `REQUEST_DECLARED` opens, b declares.
3. `RESPONSE_PENDING` is skipped entirely (reflection isn't "being asked" in the
   normal sense — squid doesn't apply to it).
4. If a truly holds herring: outcome `reflected_success`, a's own herrings are
   about to move to b → `TRANSFER_PENDING` opens if a holds Tortoise (a may cancel
   the reflection on their own cards).
5. Cards move (if not blocked). `TURN_END` opens if someone holds Shark (who may
   then steal the reflected cards from b).
6. Whatever happens, a's turn ends immediately: no bonus turn, no pool draw, even
   on `reflected_fail` (a didn't hold herring at all).

### Shark jump

Continues from either "ask with bonus turn" step 5 or "lanternfish reflection"
step 5: a shark holder declares in the `TURN_END` window instead of skipping.
The just-transferred cards move again, from whoever just received them to the
shark's owner. The asker's turn ends with no bonus turn regardless of the original
outcome, and play passes to the next player after the asker — never to the shark.

### Tortoise block

Continues from "ask with bonus turn" step 4: b declares Tortoise instead of
skipping. The transfer is cancelled (b keeps the cards), a standing protection on
that rank is created for b (expires at the start of b's next turn), and — since no
cards moved — the outcome is downgraded to behave exactly like a normal failed ask:
a draws from the pool, no bonus turn, `TURN_END`'s shark window never opens (there
is nothing to steal).

A **standing** protection (from an earlier declaration) blocks silently, with no
window at all — the engine checks it before ever offering the `TRANSFER_PENDING`
window.

### Stun skip

At the top of `beginTurn()`, before anything else, the engine checks whether the
player about to start their turn is stunned. If so: emit that their turn was
skipped, clear the stun, advance to the next player, and loop — repeating for as
many consecutive stunned players as there are (bounded by player count, so this can
never spin forever). A stunned player can still declare reactive powers and lay
sets on other players' turns; they simply never get a `TURN_START` of their own
while stunned.

### Whale reshuffle

Happens entirely inside the `TURN_START` window, as one of the (at most one)
active powers the player on turn may use. It does not open any further window —
Whale has no reactive counterpart in the spec. Protected cards for both target
players are set aside first; everything else is combined, shuffled with the
engine's seeded RNG, and dealt back preserving each player's original *unprotected*
card count, then the protected cards are added back untouched.

If the reshuffle deals the player continuing their own turn a hand of nothing but
eggs (bad luck of the draw — found by simulation), they'd otherwise be stuck with
no legal request and nothing to lay. The same refill-then-pass check `beginTurn()`
runs at the top of every turn runs again immediately afterward (shared with the
mid-turn lay case below, as `ensureCanContinueTurn()`).

### Set completion mid-turn

`LAY_SET` can be submitted whenever `pendingWindow === null`, by *any* player, not
only the one on turn — most commonly right after that player's own turn-start
refill, or right after receiving cards from someone else's failed/successful
request once the spine returns to `AWAIT_REQUEST`. If the set is a power set, a
`SET_COMPLETED` window opens (see below) before the power is granted; if it's a
normal or eggs set, the power grant step is skipped entirely and control returns
immediately.

### Mantis Shrimp destruction

Immediately after `SET_LAID` for a power set, if anyone holds an unused Mantis
Shrimp, a `SET_COMPLETED` window opens naming that set. A declaration marks the set
destroyed (flips it face up, marks it spent, forever un-usable) but the point the
layer scored is untouched. Either way — destroyed or not — the grant step then
runs: a destroyed set grants nothing; an intact one grants its owner the power (or,
for Clownfish, attempts to bind it immediately).

### Empty pool

Once the pool is empty, failed/blocked asks stop drawing (there's nothing to draw)
and turns simply pass along. The turn-start and mid-lay refill logic (below) is
what actually determines whether an empty-handed player can act at all once the
pool can no longer help them.

### Empty hand (and the "no real cards" generalization — found by simulation)

Rule 2.8 only mentions refilling an *empty* hand at turn start. Two related gaps
surfaced once bots were run at scale, both resolved as documented in
`DECISIONS.md`:

- A player can empty their hand **mid-turn** by laying their last set. Since
  there's no explicit "pass" action, the same refill (or an automatic pass, if the
  pool is also empty) is applied immediately after such a lay, not just at the next
  formal turn start.
- "Empty" is generalized from "zero cards" to "zero *real* cards" everywhere this
  logic runs — a hand of 1–3 stray eggs is exactly as stuck as a literally empty
  one, since eggs can never be named in a request.
- Separately, a player can run out of *targets* rather than ranks, if every other
  player happens to be stunned simultaneously (reachable with two Jellyfish grants
  chained across consecutive bonus turns in a 3-player game). The engine passes
  such a player's turn immediately too, the moment their `TURN_START` window
  resolves.
- Finally, a pool-empty position where no two remaining hands share any rank is a
  genuine possible endgame that "no player can make a legal request" doesn't
  literally cover (every request is still nominally *legal*, just guaranteed to
  fail forever). The engine tracks consecutive no-effect request resolutions and
  ends the game once no further progress is possible, rather than looping.

### Player disconnect mid-window

The pure engine has no concept of a live connection — `PlayerState.connected` is a
flag the **server** (M2) sets on socket open/close and the engine leaves alone.
Policy, enforced entirely at the driver layer:

- If a disconnected player is eligible in an open window when their 12s deadline
  elapses, the server submits `SKIP_WINDOW` on their behalf — identical to a
  connected player who simply didn't respond in time. No special engine path is
  needed because "nobody declared in time" is already the normal timeout case.
- If it becomes a disconnected player's `AWAIT_REQUEST` turn, the server has no
  legal `REQUEST` to submit for them. Reconnection is by player token (M2): the
  room simply waits (their 12s countdown restarts on reconnect for whichever window
  is open, or the turn timer if it's their `AWAIT_REQUEST`) rather than the engine
  inventing a forced pass — a human who steps away should come back to find their
  turn untouched, unlike the bot-only "no legal move" cases above which are about
  *structurally impossible* moves, not a slow human.
