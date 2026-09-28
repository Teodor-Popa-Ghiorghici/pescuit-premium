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
fonts and tokens; textures are feTurbulence stand-ins. `mock/shoot.cjs` asserts,
for every layout frame:

- the top bar sits at the top edge;
- the opponent strip, the dock, the hand and any plank are inside the viewport;
- the ask sheet lies between the strip and the dock;
- nothing scrolls sideways, and on desktop the page does not scroll.

All ten layout frames pass; the chip sheet is a reference, not a layout.

| File | Frame |
|---|---|
| `mock-phone-your-turn-390x664.png` | your turn, six players, iOS Safari with toolbars |
| `mock-phone-your-turn-360x640.png` | the same on Android Chrome |
| `mock-phone-your-turn-375x548.png` | the same on iPhone SE Safari |
| `mock-phone-ask-sheet-390x664.png` | the ask sheet in the pond's row: full names, protection, power pips |
| `mock-phone-ask-sheet-375x548.png` | the same on the shortest screen, in three compact columns |
| `mock-phone-answer-390x664.png` | the answer plank: equal truth and lie buttons, clock, card |
| `mock-phone-answer-375x548.png` | the same on the shortest screen |
| `mock-phone-dry-pond-390x664.png` | a neutral go-fish into an empty pool, and the closing gate |
| `mock-desktop-1280x800.png` | the pond table: posts on an arc, the pond as the flight stage, the tally log |
| `mock-desktop-1024x768.png` | the same at 1024×768 |
| `mock-chip-states.png` | the 60×76 opponent chip in eight states, including the real worst cases, at 2× |

To re-render: from the repo root run `npx vite --config docs/plan-evidence/mock/vite.config.ts`
(port 5199), then `node docs/plan-evidence/mock/shoot.cjs` with Playwright installed.
It exits non-zero if an assertion fails. `OUT_DIR` writes the PNGs elsewhere;
`CHROMIUM_PATH` optionally points at a local Chromium.

## The audio prototype (§3, Appendix B)

`audio/sketch.js` implements every Appendix B recipe in Chromium's Web Audio
engine (`OfflineAudioContext`), the §3.3 master chain for both output profiles,
a BS.1770 meter with true peak, and a three-minute human-paced scene at five
players heard from seat 0. `audio/run.cjs` renders it headless and writes:

| Output | What it is |
|---|---|
| `audio/wav/<cue>.wav` | every prototyped cue, class-normalised, peak ≤ −1 dBFS |
| `audio/wav/seat-signatures.wav` | the six seat signatures in turn (§3.1) |
| `audio/wav/scene-speaker-12s.wav`, `scene-headphones-12s.wav` | the scene's busiest 12 s through each profile's chain, at 24 kHz |
| `audio/metrics.md` | per-cue length, level, tail, speaker variant, class gain and seed spread; loudness, true peak and clipping per profile; cues a minute; and the rule checks |
| `audio/spectrograms.png` | a log-frequency spectrogram of every cue |

It exits non-zero unless all three rule checks pass:

- **the plank grammar** — no cue but the seat cues strikes plank A, B or C;
- **the echo budget** — measured without the safety fade;
- **loudness** — within ±2 LU of target, true peak ≤ −1 dBTP (including the
  worst six-cue pile-up), and no samples near the clip.

To re-render (about 90 s), from the repo root with Playwright installed:
`node docs/plan-evidence/audio/run.cjs`. `OUT_DIR` and `CHROMIUM_PATH` work as
above.

## Game simulations

| Script | Purpose |
|---|---|
| `membot.ts` | the two bot populations. *Random* is the engine's own bot; *memory* remembers what every public event reveals and asks where it knows a match exists. It also holds `decided()`, the §11.2 check. |
| `eventfreq.ts` | mean occurrences of every event type per game at 3 and 6 players, for both populations (§1.1, §3.7, the cue sheet) |
| `ending.ts` | how games really end, at 3–6 players, for both populations: cards stranded, when the pool runs dry, the dry share of go-fish, and the final run of misses. Also asks played after the score was final and the share of games where that happens, and a guard that no set is laid or destroyed after `decided()` fires (§1.1, §3.9, §11.2) |
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
