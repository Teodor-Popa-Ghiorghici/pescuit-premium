# Pescuiește Extins

An online multiplayer card game for 3–6 players — a "Go Fish" variant with power
cards, bluffing, and interrupts — playable by sharing a room link. See `RULES.md`
for the full rulebook, `STATE_MACHINE.md` for the engine's turn design,
`DECISIONS.md` for every design call made against the (intentionally ambiguous)
spec, and `DESIGN.md` for the visual, audio and feel specification.

## Project layout

```
packages/
  engine/   pure rules engine (no network/UI deps) — types, reducer, tests, CLI bots
  shared/   bilingual (RO/EN) string resource + WebSocket wire protocol types
  server/   Node.js + ws WebSocket server: rooms, redacted state sync, reconnection
  client/   Vite + React thin client
```

The server is **the only thing that ever knows the full game state**. After every
action it sends each player a redacted view *and* a redacted slice of the events
(`packages/engine/src/redact.ts`), each stamped with a per-room `seq` — a client never
receives another player's cards, and Squid is never mentioned in any message to anyone
but its owner. The deal comes from the OS CSPRNG (random UUID card ids, Whale entropy
attached by the server); no seed or generator state ever leaves the server. The view also
carries the public tally of sets still possible (`sets`), the stall countdown
(`endPressure`) and the window's server-clock deadline; see `DECISIONS.md`.

## Local development

Requires Node.js ≥ 18 (Node 22 is what this was built and tested against).

```bash
npm install

# terminal 1: the game server, with hot reload
npm run dev:server        # http://localhost:8080 (ws at /ws)

# terminal 2: the client dev server (proxies /ws to :8080)
npm run dev:client        # http://localhost:5173
```

Open `http://localhost:5173` in a few browser tabs (or share the room link it
generates with friends on the same network once you set `VITE_...` / deploy) to
play a full game.

### Engine only (no server, no UI)

The engine is a standalone package — this is deliberate, per the spec:

```bash
npm run test               # rules-engine and server test suites (vitest)
npm run sim                # play one full game with scripted bots, print the log
npm run sim -- 42 5        # seed 42, 5 players
npm run sim:many           # 1000 random bot games; asserts no illegal states, no deadlocks
```

## Building for production

```bash
npm run build     # builds the client only; server & engine run straight from
                   # TypeScript source via tsx, both in dev and in production —
                   # see DECISIONS.md for why this is the simplest deploy story
npm run start      # serves the built client + runs the WebSocket server, both
                    # on $PORT (defaults to 8080)
```

`npm run start` is a single process: the Node HTTP server serves
`packages/client/dist` as static files *and* upgrades `/ws` connections to
WebSocket — this is what makes a single public HTTPS URL work.

## Deploying to Railway

This repo deploys as **one Railway service**.

1. Create a new Railway project from this GitHub repo.
2. Railway auto-detects Node.js. Set these in the service settings:
   - **Build command:** `npm install && npm run build`
   - **Start command:** `npm run start`
3. Railway sets `PORT` automatically — the server already reads `process.env.PORT`,
   nothing else to configure.
4. Once deployed, Railway gives you a public `https://<service>.up.railway.app`
   URL. That URL serves the app and terminates TLS for you; the client's
   WebSocket connects back to `wss://<same-host>/ws`, so no second service, no
   separate WebSocket URL, and no extra environment variables are needed.
5. Share `https://<service>.up.railway.app/?room=<code>` links straight from the
   waiting-room screen — the "Copy" button next to the room code does this for
   you.

Rooms are in-memory only (per the spec) and are dropped 10 minutes after they go
empty; a Railway redeploy or restart clears all active rooms, same as restarting
the process locally would.

## House rules / lobby settings

- **Power visibility** (Ascuns/hidden default, or Deschis/open) is chosen by the
  room's host when creating a room, and applies for that whole game. See §4 of
  `RULES.md`.
- Additional house-rule toggles are tracked in `DECISIONS.md` as future work
  (M5 polish).

## Client tools (dev and checks)

The client (`packages/client`) ships with a handful of tools that run the real game in the browser or
check it. Everything below is a query string on the dev server (`npm run dev:client`) or a script in
`packages/client`; none of it is loaded by a normal game (each is a lazy chunk or a script).

| Tool | What it does |
|---|---|
| `?table=bots&n=6&seed=42&seat=0&speed=1&bots=memory` | **the bot table**: runs the engine and a bot population in the tab and feeds seat 0's redacted record into the real store. Play or watch at 0.25-4x, with pause and step (`panel=1`). `bots=random` or `memory` (bots that learn only from the public record); `until=myturn\|answer\|dry\|end\|turn:N\|sets:N`; `auto=1` plays seat 0 too. |
| `?fixture=<id>` | a **scenario fixture** (`?fixture=` lists them): `myturn`, `answer`, `answer-squid`, `shark`, `mantis`, `whale`, `actives`, `pool1`, `dry`, `tally1`, `stall`, `tenhand`, `twelvehand`, `names`, `chips`. Add `n=3..6`. |
| `?lab=audio` | the **audition page** (development only: `npm run dev:client`; a production build does not contain it): a play button per cue and per take, both profiles, before and after mastering, the pond, the wind and the three darkening steps, sliders, bus meters, an event to cue trace. |
| `?lab=vfx` | the **VFX lab**: the thirteen stepped effects, frame by frame. |
| `?metrics=1` | an overlay and `window.__metrics` for the playtests: answer time (median, p90), eligible and missed windows, tally-0 to podium, answer to rest, input to paint, fps, and **how many times the pond's bed was turned off** and whether sound is muted. |
| `npm run layout:check --workspace=packages/client` | the **layout checks**: 103 frames and interactions in headless Chromium at 360x640, 390x664, 375x548 phones and 1280x800, 1024x768 desktops (nothing covered, everything on one screen, no page scroll). `--shots` writes a PNG per frame. |
| `npm run audio:check --workspace=packages/client` | the **audio harness**: renders every cue, the tulnic's valley, the darkening steps and a three-minute scene per profile in headless Chromium and fails on any of thirteen checks (plank grammar, confusability, echo budget, peaks, headroom, ambience, the clock, balance, the palette, duration, the valley, the darkening steps, calibration). Must stay 13/13. The full per-cue numbers are in `packages/client/tools/out/metrics.md`. |
| `npm run perf:check --workspace=packages/client` | the **performance gates**: builds, serves the production bundle, throttles the CPU 4x and plays a human at a six-player bot table: input to visual p95, answer to rest p95, fps in a whale. Reports honestly whether or not it hits the plan's targets. |
| `npm run bake:textures`, `bake:ink`, `contrast:check` (client) | regenerate the paper, wood and water textures; re-bake the card ink (vertex jitter, seeded; `--check` fails when stale); re-audit contrast with the grain on. All three run in the test suite. |

### Package budgets (FEEL_VISUAL_SOUND_PLAN §7.4)

Measured on the production build (`npm run build`, gzip):

| Budget | Limit | Now |
|---|---|---|
| JS the lobby loads (initial) | 125 KB (65 KB original + 60) | 107.0 KB (+ 10.1 KB CSS) |
| JS a played game loads (initial + the table chunk + the podium and audio catalog) | 125 KB | 126.0 KB (107.0 + 14.9 table + 2.9 audio catalog + 1.2 podium): about 1 KB over |
| Rules panel and Codex (lazy, on demand) | - | 2.7 KB (0.7 + 1.3 + 0.6 CSS) |
| Dev tools (`?table=bots`, `?fixture=`, `?lab=vfx`), lazy | not shipped to players | 13.6 KB (dev tools 12.9, VFX lab 0.7); the audio audition page is development-only and is not in the production build |
| CSS | - | 10.1 KB (one file, lobby and table) |
| Textures (paper, wood, water) | 30 KB | 13 KB |
| Baked card ink (faces + back), inside the table chunk | - | 8.7 KB (7.5 faces + 1.3 back) |
| Audio downloads | 220 KB | 0 KB (everything is synthesised) |

The table (cards, hand, planks, the choreography's hands), the podium and the Codex are lazy chunks; the
table is fetched while the lobby is idle, so joining never waits for it.

## Known scope limitations

- The end-of-game check ("no set can still be laid") reads only the public record and is an
  **upper bound**, not an exact count: a stalled game can show "at most 3 sets" with none
  left to lay and then ends on the 2N streak rule. See `DECISIONS.md`, "Deciding the game".

- The in-app Rules panel renders `RULES.md` verbatim (in English) regardless of
  the UI language toggle; translating the full rulebook was out of scope for
  this pass. All *gameplay* UI strings (buttons, prompts, the event log) are
  fully bilingual.
- Spectator mode and a solo practice mode against the M1 bots (both listed under
  M5 in the original spec) are not implemented yet.
- Sound is synthesised in the browser, from noise and damped modes through filters (live: wood, the table top, paper, ink, clay, water, rope),
  with two things rendered at load in plain JS: the tulnic (a natural horn, so only partials of one 58 Hz fundamental) and the paper riffle.
  Only Shark, Mantis Shrimp and Whale leave that palette. See `SOUND_DESIGN.md` for what each sound imitates and what it reads. No audio files
  ship. There is a mute tab in the top bar (a long press opens the mixer). The recorded tier of the plan (real planks, a folk-music consultant) is
  a production task and is not in the build.
- The presentation timeline (`game/presenter.ts`, `game/choreography.ts`) plays the ask, the answer,
  the flights, the powers' signature moments, the world arc and the podium. What it is measured against
  and where it falls short is in `DECISIONS.md` ("The world arc and the ceremony", "Performance").
- Not built: the recorded audio tier, the call rig and the listening tests (blindfold, mute, call, desk,
  phone speaker), the real-Android performance confirmation, and the three playtests. Nobody has listened to the current palette: the harness
  measures level, length, pitch and structure, not taste.
