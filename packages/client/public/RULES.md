# Pescuiește Extins — Rules

*A 3–6 player card game. This document is written to be printable and playable with
a physical deck — it never mentions code.*

## 1. The deck (66 cards)

**9 power ranks, 4 cards each (36 cards):**
Squid (Sepie), Shark (Rechin), Tortoise (Țestoasă), Jellyfish (Meduză),
Lanternfish (Peștele-felinar), Stickleback (Ghidrin), Mantis Shrimp
(Crevete-mantis), Whale (Balenă), Clownfish (Peștele-clovn).

**8 normal ranks, 3 cards each (24 cards):**
Herring, Mackerel, Anchovy, Sardine, Carp, Trout, Perch, Catfish. These have no
power — they exist only to be collected into sets.

**Eggs (Icre), 6 cards:** a wildcard rank. Eggs are never a "real" card of any
rank — you can't ask for them, and they never make a rank askable by themselves.

## 2. Setup and the core loop

1. Shuffle all 66 cards. Deal 7 to each player. The rest form a face-down pool
   ("balta") in the middle.
2. On your turn, name **one other player** and **one rank**: *"Do you have any
   sharks?"* You must already hold at least one real card of that rank yourself —
   eggs in your hand don't count, and you can't ask for eggs.
3. **If they have it:** they hand over every card of that rank they hold. You take
   another turn.
4. **If they don't:** they say *"Pescuiește!"* and you draw one card from the pool.
   Your turn ends — you do **not** get a bonus turn just because you happened to
   draw the card you asked for.
5. Whenever you hold a complete set, you may lay it face down or up (see §4) for
   **1 point**. A power set also grants its power, once.
6. If the pool runs out, play continues with hands only. The game ends when no
   further capture is possible for anyone. Highest score wins; ties break on
   number of completed power sets, then it's a shared victory.
7. If your hand is empty (or holds only eggs) at the start of your turn, draw up
   to 3 cards from the pool before doing anything else.

## 3. Sets and eggs

- A **power set** is 4 cards of one power rank.
- A **normal set** is 3 cards of one normal rank.
- **Eggs substitute** for missing cards: up to **2 eggs per set**, and you must
  still hold **at least 2 real cards** of that rank. (In practice this means a
  3-card normal set can only ever use 1 egg — 2 eggs would leave just 1 real card,
  below the minimum. Power sets can use the full 2.)
- **4 eggs alone** form a set worth 1 point with no power — the only way to score
  eggs on their own.
- The same power rank can be completed independently by two *different* players in
  one game (e.g. two players each gather 2 of a power plus 2 eggs). Both gain the
  power.
- A laid set is permanent. It can't be stolen, returned to hand, or destroyed —
  except by Mantis Shrimp, and only in the instant it's completed.

## 4. Power visibility (a lobby setting)

- **Mode A — Ascuns (Hidden, default):** a completed power set is laid face
  down. Everyone sees that you scored a point and that it's a power set, but not
  which power. The moment you use the power, it flips face up.
- **Mode B — Deschis (Open):** the set is laid face up immediately, so everyone
  knows which power you hold. Once you use it, it flips face down (spent).
- **Squid is the one exception in both modes.** A squid set never flips, ever, and
  using squid is never announced anywhere — not in the game log, not in any
  on-screen indicator, not by any change in timing. In Mode B, others can see you
  *own* a squid (its rank is visible from the start, like the mode intends) — but
  they can never tell whether you've *used* it.

## 5. Timing — interrupt windows

Each turn moves through named windows. When a window opens, the server tells only
the players who actually hold something playable in it, and gives them up to 12
seconds to respond before moving on. If nobody has anything playable, the window
closes immediately with no delay.

```
TURN_START        -> stun check; you may use one active power here, on your own turn
REQUEST_DECLARED  -> the player just asked may reflect with Lanternfish
RESPONSE_PENDING  -> the player just asked may lie with Squid
TRANSFER_PENDING  -> the player about to lose cards may block with Tortoise
SET_COMPLETED     -> any player holding Mantis Shrimp may destroy the new power set
TURN_END          -> any player holding Shark may jump in
```

- Only **one power resolves per window** — first valid declaration wins.
- A power used in a window can't be countered by another power in that same
  window.
- Windows never nest: while one is being resolved, no other window is open.
- **Active powers** (Jellyfish, Stickleback, Whale, and a Clownfish copying one of
  them) can only be played at the start of *your own* turn, at most one per turn.
  Using one doesn't use up your request for the turn.
- **Reactive powers** (Squid, Shark, Tortoise, Lanternfish, Mantis Shrimp) are
  played out of turn, in their own window, by whoever holds them.
- A power is consumed the instant it resolves — whether it succeeds or not.
- You can hold several unused powers at once, and hold onto them for as long as
  you like.

## 6. The nine powers

**Squid (Sepie)** — reactive, *Response Pending*
Once, when someone asks you for a rank, you may answer falsely: deny cards you
actually hold, or claim cards you don't. Either way, the asker's turn ends exactly
as if the ask had failed — they draw from the pool, and no cards change hands (even
if you truly had the cards and denied them — you secretly keep them). Squid is
never revealed, before or after use, to anyone.

**Shark (Rechin)** — reactive, *Turn End*
Right after a successful ask (or a successful Lanternfish reflection), jump in and
take the cards that just changed hands, before their new owner gets to keep them.
The player whose turn it was loses any bonus turn they'd earned, and the game moves
on to the next player after them — not to the shark. Only one shark can jump per
turn.

**Tortoise (Țestoasă)** — reactive, *Transfer Pending*
Protect every card you hold of one named rank. Once protected, they can't be taken
by anything — a request, Shark, Stickleback, Lanternfish, or Whale — until the
start of your *next* turn. You can play it the instant someone's about to take
those cards, cancelling the transfer before it happens.

**Jellyfish (Meduză)** — active, *Turn Start*
Stun one other player until the start of their next turn. While stunned, they can
neither ask nor be asked. Their turn is skipped entirely. They can still play
reactive powers and still lay completed sets.

**Lanternfish (Peștele-felinar)** — reactive, *Request Declared*
When someone asks you for a rank, you may reflect the request: instead of the
normal exchange, you take *their* cards of that rank. You don't need to hold the
rank yourself. Either way, the asker's turn ends immediately with no bonus turn —
and unlike a normal failed ask, they don't draw from the pool either.

**Stickleback (Ghidrin)** — active, *Turn Start*
Name a normal fish rank (never a power rank, never eggs) and steal every card of
it from one player's hand — blind, without asking first. If they have none, the
power is simply wasted.

**Mantis Shrimp (Crevete-mantis)** — reactive, *Set Completed*
The instant any player completes a power set, destroy its power on the spot. They
keep their point; the set flips face up and is marked spent forever. This is the
only moment Mantis Shrimp can act — never later. It can even target another Mantis
Shrimp set.

**Whale (Balenă)** — active, *Turn Start* (3+ players only)
Pick two players seated next to each other (you may be one of them, if you're
adjacent to your target). Their hands are combined, shuffled completely blind — no
one, not even the whale's owner, sees the combined pile — and dealt back so each
ends up with exactly as many cards as before. Any Tortoise-protected cards sit out
the shuffle and stay exactly where they were.

**Clownfish (Peștele-clovn)** — special
On completion, it silently copies whichever power was **most recently used** in
the game, by anyone — becoming, for one use, an exact copy of that power (same
window, same rules). If no power has been used yet, it waits, unbound, and copies
the very first power anyone uses after that. A clownfish never copies another
clownfish — it always looks past one to the real power underneath. Until bound, it
can't be used. In Mode A, what it's bound to stays private to its owner until they
use it.

## 7. Ending the game

Play continues even with an empty pool — you simply stop drawing on a failed ask.
The game is over once no player holds a single real (non-egg) card left to name.
Score is total sets laid (1 point each, power or normal or eggs, no bonus for the
power itself). Highest score wins; a tie is broken by whoever completed more power
sets (a set Mantis Shrimp later destroyed still counts — you still completed it);
if that's still tied, the win is shared.

## 8. House rules (lobby toggles)

- **Power visibility:** Ascuns (hidden, default) or Deschis (open) — see §4.
- Additional house-rule toggles are listed in `DECISIONS.md` as they're added in
  later milestones (M5 polish).
