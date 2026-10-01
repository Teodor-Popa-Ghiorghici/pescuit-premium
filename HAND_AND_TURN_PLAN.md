# Hand, turn clock and rope — plan

*Seven features, in the woodcut idiom of `DESIGN.md` (pressed, not glided; rope, wood, paper, ink), with Hearthstone's
hand and turn feel as the reference for behaviour. Nothing here changes a rule of `RULES.md` except §2's new turn
clock, which is a driver (server) rule, not an engine rule.*

| # | Feature | Hearthstone reference | Here |
|---|---|---|---|
| 1 | Hovering cards | the hovered card rises, straightens and grows; its neighbours part | desktop (`hover: hover`) only. The hovered group rises 22 px, grows to 1.08, loses its fan tilt, comes to the top; neighbours part by 18 % of a card. 160 ms on the `settle` curve. Touch has no hover: it gets #3's long press. The selection lift (beat 0, ≤ 50 ms) is untouched. |
| 2 | Hand animation | the hand is a fan; cards slide to make room; a drawn card flies in and settles | the flat row becomes a **fan**: each group tilts by its place (±7° at the ends, less with fewer groups) and sinks along an arc (`layoutHand`, pure and tested). Groups **glide** to their new places when the hand changes (360 ms, `settle`). An arriving card, when its flight lands, is **pressed in** (drops 26 px with a tilt, squashes to 0.97, settles, ink flash). At the first deal the hand is **dealt in** group by group (70 ms stagger). When the dock scrolls (too many groups) the fan flattens. |
| 3 | Card description on dwell | hovering a card for a moment shows the enlarged card and keyword tooltips | after **700 ms** of hover (desktop) or a **450 ms long press** (touch), the **inspector** stamps in above the group: the card at 1.5×, and a paper plaque with the name, the kind (power · active / reactive / special · its window; common fish; wildcard), the rules text, the set it needs (4 / 3 / 4 eggs) and how many you hold. Leaving, scrolling, dragging, Escape or the turn changing dismisses it. Lazy chunk, prefetched on idle. |
| 4 | Turn timer | 75 s turns | **server-enforced**: every ask gets **45 s** (`TURN_TIMEOUT_MS`). The clock starts when the turn is at rest awaiting an ask, is **paused while any window is open** (the 12 s window clock owns that time), restarts at each new ask (a bonus ask is a new ask), and is **not** restarted by laying a set. At zero the server makes the ask for the player: a **random legal request** (one of their askable ranks, one legal target), exactly as a bot would — so a dropped player no longer freezes the table (closes the hole in `DECISIONS.md`, "Absent players"). The deadline is public: `view.turnClock = { deadlineAt, totalMs, ropeMs }`, the same for every viewer. Shown as a drain bar over the active seat (your dock edge, an opponent's post/chip foot). |
| 5 | Roping | the last 20 s, a burning rope crosses the board; a fuse sound | the last **15 s** the bar becomes the **rope**: a twisted ochre/wood band (the card frame's *funia răsucită*) with an ember eating it from the right, sparks, and the char behind. **Audio** (Clock bus, heard by all, palette: rope and fibre): `clock.rope` when it is lit (a rope taking load + a scratch), `clock.rope.burn` once a second (crackling fibres), `clock.rope.urgent` twice a second for the last 5 s, `clock.rope.out` when it burns through (a snap). On your own turn the dock border pulses ochre with it. |
| 6 | Slower, more detailed animation | deliberate, weighty motion | a new **table speed 0.75× ("Tihnit / Calm") is the default** (1× and 1.5× stay in the sound sheet). The speed scales the whole timeline, cues included, so sound and pixels stay locked; the backlog thresholds scale with it, so a slower table does not flush more often. Detail added: the hand's press-in, glide and deal-in (#2), the opponent fans' insert and remove (#7), the hover and inspector (#1, #3), the rope's ember and sparks (#5), a held-card bob on the seat whose turn it is. Reduced motion: all of it is a state change. |
| 7 | Opponents' hands | a fan of card backs at the top, count visible, cards slide in and out | desktop posts draw a **fan of real card backs** (the baked back, 18×27), arced, up to 10 and a `+N`; a back slides in when they gain a card and lifts out when they lose one; the seat whose turn it is lifts its fan and one card bobs ("thinking"). Phone chips draw a 5-back mini fan in the foot instead of the icon, the count kept beside it. Flights to and from a seat land on its fan. |

## What is public, and what is not

The turn clock is a function of the public record only (the turn and the windows, which every viewer already sees), and
the auto-ask is a normal `REQUEST_MADE`. The hover, the inspector and the fan read only your own hand and public hand
counts. No new cue is private; the rope's cues are `heard: 'all'`.

## Order of work

1. Server: turn clock in `room.ts` (+ tests); `ViewMeta.turnDeadlineAt` → `view.turnClock`; the dev driver mirrors it.
2. Client: `TurnClock` (bar → rope) on the dock and seats; audio cues and the `RopeClock` scheduler.
3. Hand: fan layout (pure, tested), hover/part, glide, press-in, deal-in.
4. Inspector (lazy).
5. Opponent fans; flights anchor to them.
6. Speed default and backlog scaling; `DECISIONS.md` entries.
7. `npm test`, `npm run build`, screenshots at the layout check's sizes.

## As built

- **Server** `packages/server/src/room.ts`: `armTurnTimer` / `autoAsk`; `PESCUIT_TURN_MS`, `PESCUIT_ROPE_MS`. Engine view:
  `RedactedView.turnClock` (`redact.ts`). Tests: four in `server/test/room.test.ts` (public clock, the auto-ask for an absent
  player, pause and resume around a window with a lay not restarting it, a full allowance per ask).
- **Client**: `TurnClock.tsx` (bar and rope, two timers and CSS animations, no per-frame renders), `OppFan.tsx`,
  `CardInspect.tsx` (lazy) with `i18n/inspectStrings.ts`, `feel.css`; `Hand.tsx` (fan, hover and parting, dwell and long
  press, deal-in, glide), `handModel.ts` (`fanOf`, `tiltReach`, flat fallback), `stage.pressIn` and `fanBox`, the presenter's
  deal signal and rope feed, the speed setting. Audio: four `clock.rope*` cues and recipes, `ember()`, `ropePlan`, the
  generic `WindowClock`. Dev: `?turn=` / `?rope=` on the bot table.
- **Checks**: `npm test` green (engine 124, server 21, client 349); `layout:check` 103/103 (its corner probe now samples
  the real index of a tilted group; its settle wait is in table time); an end-to-end run against the real server
  (three players, 20 s turns, the browser's clock running out) saw the room make the ask and the rope burn on the next
  seat.
- **Cost** (gzip, production build, before -> after): lobby JS 119.5 -> 120.3 KB, CSS 11.1 -> 12.8 KB, table chunk
  15.5 -> 18.2 KB, the inspector a 2.7 KB lazy chunk.
- **Not done**: nobody has listened to the rope's four cues on real speakers. The audio harness (`audio:check`) was
  started but killed by the container's memory limit, so the cues are unmeasured and have no calibration entry yet
  (they play at their sheet level, unmastered). `perf:check` was not re-run.
