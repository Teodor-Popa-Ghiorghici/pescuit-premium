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
fonts and tokens; textures are feTurbulence stand-ins. `mock/shoot.cjs` asserts
the one-screen rule (no sideways scroll; dock, sheet and plank on screen) and all
frames pass.

| File | Frame |
|---|---|
| `mock-phone-your-turn-390x664.png` | your turn, six players, iOS Safari with toolbars |
| `mock-phone-your-turn-360x640.png` | the same on Android Chrome |
| `mock-phone-your-turn-375x548.png` | the same on iPhone SE Safari |
| `mock-phone-ask-sheet-390x664.png` | the thumb-zone ask sheet |
| `mock-phone-answer-390x664.png` | the answer plank, equal truth and lie buttons |
| `mock-phone-dry-pond-390x664.png` | a go-fish into an empty pool |
| `mock-chip-states.png` | the 60×76 opponent chip in eight states, at 2× |

To re-render: from the repo root run `npx vite --config docs/plan-evidence/mock/vite.config.ts`,
then `node docs/plan-evidence/mock/shoot.cjs` with Playwright installed.

## Scripts

| Script | Purpose |
|---|---|
| `drive.cjs` | drives a 3-player game (desktop + phone contexts) and captures screenshots |
| `six.cjs` | seats 6 players and measures where the hand lands on a 390×844 phone |
| `eventcount.ts` | 800 seeded bot games: when the client's 300-event cap is reached (A10) |
| `eventfreq.ts` | mean occurrences of every event type per game at 3 and 6 players (§1.1, the cue sheet) |
| `arc.ts` | when the pool runs dry, how many go-fish land on it, and how cards in play fall (§1.1, §3.9) |
| `squid-events.ts` | the event sequences of an honest "no", a Squid deny and a Squid claim (A2) |

Run the browser scripts with Playwright installed and the server on `:8080`
(`CHROMIUM_PATH` optionally points at a local Chromium). Run the `.ts` scripts
from this directory with `npx tsx <script>`.
