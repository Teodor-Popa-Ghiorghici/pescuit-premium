# Evidence for `FEEL_VISUAL_SOUND_PLAN.md`

Screenshots and the scripts that produced them, captured from a live game against
the local server (`npm run build && npm run start`).

| File | What it shows |
|---|---|
| `table-desktop-3p.png` | 3 players at 1280×800, game start |
| `table-desktop-midgame-overflow.png` | a 10-card hand overflowing the panel and the page (A15) |
| `table-desktop-6p.png` | 6 players: the sixth post stretched into a full-width plank (A20) |
| `table-phone-3p-fullpage.png` | 3 players at 390×844, full page: the hand starts below the fold (A9) |
| `answer-plank-phone-fullpage.png` | the asked player's plank on a phone; "You may lie with Squid" shown without a Squid (A21) |
| `table-phone-6p-log-yank.png` | 6 players at 390×844: the viewport after the log's `scrollIntoView` pulled the page (A10) |

| Script | Purpose |
|---|---|
| `drive.cjs` | drives a 3-player game (desktop + phone contexts) and captures screenshots |
| `six.cjs` | seats 6 players and measures where the hand lands on a 390×844 phone |
| `eventcount.ts` | runs 800 seeded bot games and reports when the client's 300-event cap is reached (A8) |
| `eventfreq.ts` | mean occurrences of every event type per game (3 and 6 players) — the repetition budget for the cue bible |

Run the browser scripts with Playwright installed and the server on `:8080`
(`CHROMIUM_PATH` optionally points at a local Chromium); run `eventcount.ts` and
`eventfreq.ts` from this directory with `npx tsx <script>`.
