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

The server is **the only thing that ever knows the full game state**. It sends
each player a redacted view (`packages/engine/src/redact.ts`) after every event —
a client never receives another player's cards, and Squid is never mentioned in
any message to anyone but its owner.

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
npm run test               # full rules-engine test suite (vitest)
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

## Known scope limitations

- The in-app Rules panel renders `RULES.md` verbatim (in English) regardless of
  the UI language toggle; translating the full rulebook was out of scope for
  this pass. All *gameplay* UI strings (buttons, prompts, the event log) are
  fully bilingual.
- Spectator mode and a solo practice mode against the M1 bots (both listed under
  M5 in the original spec) are not implemented yet.
- Sound is synthesised in the browser (short filtered noise bursts for the
  stamp, the totem's knock, a splintering set) rather than played from recorded
  assets, and there is a Sunet toggle in the table header to turn it off. No
  audio files ship with the build.
- The motion layer covers the stamp, the totem's travel between posts, the
  burning-down window clock and the rising interrupt plank. The longer
  per-event choreography of `DESIGN.md` §6.3 — cards flying between hands, the
  whale's interleaved reshuffle, the shark reversing mid-flight — is not
  animated; those events update the table and the log directly.
