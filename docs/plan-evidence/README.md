# Evidence for `FEEL_VISUAL_SOUND_PLAN.md`

Everything the plan measures or shows, with the scripts that produced it.

## Screenshots of the current game

Captured from a live game against the local server (`npm run build && npm run start`).

| File | What it shows |
|---|---|
| `table-desktop-3p.png` | 3 players at 1280×800, game start |
| `table-desktop-midgame-overflow.png` | a 10-card hand overflowing the panel and the page (A17) |
| `table-desktop-6p.png` | 6 players: the sixth post stretched into a full-width plank (A22) |
| `table-phone-3p-fullpage.png` | 3 players at 390×844, full page: the hand starts below the fold (A11) |
| `answer-plank-phone-fullpage.png` | the asked player's plank; "You may lie with Squid" shown without a Squid (A23) |
| `table-phone-6p-log-yank.png` | 6 players at 390×844: the viewport after the log's `scrollIntoView` pulled the page (A12) |

## Mocks of the proposed layout (§5.2–§5.3)

Rendered by `mock/` from the client's real card art, seals, totem, notch clock,
fonts and tokens; textures are feTurbulence stand-ins. Every frame shows a legal
moment of play. `mock/shoot.cjs` asserts, for every layout frame:

- the top bar sits at the top edge;
- the opponent strip, the dock, the hand and any plank are inside the viewport;
- the ask sheet lies between the strip and the dock;
- nothing scrolls sideways, and on desktop the page does not scroll;
- nothing is covered: the centre of every opponent chip, desktop post, sheet row
  and plank button, and the index corner of every hand group, must land on that
  element (`elementFromPoint`). Every post must sit inside the table, and every
  hand group inside its panel.

All ten layout frames pass; the chip sheet is a reference, not a layout. The
hit-tests catch v3's 1024×768 frame, whose fifth post ran under the log.

| File | Frame |
|---|---|
| `mock-phone-your-turn-390x664.png` | your turn, six players, iOS Safari with toolbars; the tally of sets still possible under the basin |
| `mock-phone-your-turn-360x640.png` | the same on Android Chrome |
| `mock-phone-your-turn-375x548.png` | the same on iPhone SE Safari |
| `mock-phone-ask-sheet-390x664.png` | the mid-screen ask sheet in the pond's row: full names, protection, power pips |
| `mock-phone-ask-sheet-375x548.png` | the same on the shortest screen, in three compact columns |
| `mock-phone-answer-390x664.png` | the answer plank: equal truth and lie buttons, clock, card |
| `mock-phone-answer-375x548.png` | the same on the shortest screen |
| `mock-phone-dry-pond-390x664.png` | a neutral go-fish into an empty pool, the tally at its last set, and the stall gate |
| `mock-desktop-1280x800.png` | the pond table: posts on an arc, the pond as the flight stage, the tally board log |
| `mock-desktop-1024x768.png` | below 1100 px the log folds into a drawer and the table takes the width |
| `mock-chip-states.png` | the 60×76 opponent chip in eight states, including the real worst cases, at 2× |

To re-render: from the repo root run `npx vite --config docs/plan-evidence/mock/vite.config.ts`
(port 5199), then `node docs/plan-evidence/mock/shoot.cjs` with Playwright installed.
It exits non-zero if an assertion fails. `OUT_DIR` writes the PNGs elsewhere;
`CHROMIUM_PATH` optionally points at a local Chromium.

## The audio prototype (§3, Appendix B)

`audio/sketch.js` implements every Appendix B recipe in Chromium's Web Audio
engine (`OfflineAudioContext`), masters each cue per output profile, renders a
three-minute human-paced scene at five players (heard from seat 0) into three
stems, and runs them through the §3.3 chain — plain-JS dynamics with no bus
compression, calibrated on one anchor cue. `audio/run.cjs` renders it headless
and writes:

| Output | What it is |
|---|---|
| `audio/wav/<cue>.wav` | every prototyped cue as headphones play it: mastered, class-normalised, peak ≤ −1 dBFS |
| `audio/wav/seat-signatures.wav` | the six seat signatures in turn (§3.1) |
| `audio/wav/scene-speaker-12s.wav`, `scene-headphones-12s.wav` | the scene's busiest 12 s at each profile's chain output, at 24 kHz |
| `audio/metrics.md` | the recipes and their mastering; every cue alone through the chain (level shift, tail at the output, non-linear residual); the scene per profile (anchor, program gain, cue stream, whole mix, true peak, pile-up, limiter, bed); the clock over the bed; confusability (rhythms, the seat bar, the closest pairs); and the checks |
| `audio/spectrograms.png` | a log-frequency spectrogram of every cue |

It exits non-zero unless all eight checks pass, each measured at the chain's
output: the plank grammar, confusability, the echo budget, peaks, headroom,
ambience, the clock over the bed, and balance (§7.4).

To re-render (about 90 s), from the repo root with Playwright installed:
`node docs/plan-evidence/audio/run.cjs`. `OUT_DIR` and `CHROMIUM_PATH` work as
above.

## Game simulations

| Script | Purpose |
|---|---|
| `membot.ts` | the two bot populations. *Random* is the engine's own bot; *memory* learns only what the public record reveals and asks where it knows a match exists. It also holds the §11.2 end check: `setsStillPossible()` from the public record, `decided()`, and `decidedTrue()`, the leaky omniscient version kept for comparison. |
| `eventfreq.ts` | mean occurrences of every event type per game at 3 and 6 players, for both populations (§1.1, §3.7, the cue sheet) |
| `ending.ts` | how games really end at 3–6 players, for both populations. It reports cards stranded, when the pool runs dry and the dry share of go-fish. For the public end check it reports how often it fires, the asks it removes and its two guards (no set laid after it fires; the count never below the truth). It gives the omniscient check's figures for comparison, and where the countdown passes 12, 6, 3 and 1 (§1.1, §3.9, §11.2) |
| `endcheck.ts` | two endgames with identical public records (two face-down 2 + 2 power sets, Squid + Squid or Squid + Whale): the omniscient check ends one and not the other; the public check treats them alike (§6.5, §11.2) |
| `arc.ts` | when the pool runs dry and how cards in play fall, with random bots (the v2 arc) |
| `eventcount.ts` | 800 seeded bot games: when the client's 300-event cap is reached (A10) |
| `squid-events.ts` | the event sequences of an honest "no", a Squid deny and a Squid claim (A2) |

Run the `.ts` scripts from this directory with `npx tsx <script>`. Each game is
seeded, so every figure reproduces.

## Browser scripts for the current game

| Script | Purpose |
|---|---|
| `drive.cjs` | drives a 3-player game (desktop and phone contexts) and captures the screenshots above |
| `six.cjs` | seats 6 players and measures where the hand lands on a 390×844 phone |

Run them with Playwright installed and the server on `:8080`.
