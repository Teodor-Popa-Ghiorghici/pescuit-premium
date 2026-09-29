# Round 1 — review of plan v1 (55b451f)

*The critic's report, verbatim. It is model output from a separate agent briefed as a harsh AAA game designer; claims in it were checked before the next revision acted on them.*

SCORE: 6.9/10

**1. Verdict**
This is the best-grounded plan this codebase has had: real line references, scripts that reproduce, a cue bible mapped to the actual event union, and one sharp insight (in a voice-chat bluffing game, every speaker is a public channel). I still can't sign it. Built as written, its own trigger table makes the Squid lie audible on every open mic, which is the exact failure Law 1 exists to prevent. Its first "done means" gate can't pass under the current rules. Its world model ("the pond drains with the game") is false for 5–6 players. The sound spec is rich in material poetry but missing what a mixer needs: per-cue levels, variation scaled to how often a cue fires, and a model of the voice call re-broadcasting the mix. (I reviewed the committed v1, 55b451f.)

**2. Sub-scores**
- **Sound design 6.8.** Law 1, the privacy-tier table and the material grammar are excellent. Against that: the cue bible brings back a Squid tell, has no level column, peak-normalises, and ignores how often cues fire.
- **Feel 7.2.** The four-beat ask, the `seq`-keyed timeline, masking and the juice budget are production-grade. But the most common 6p outcome (go fish into an empty pool) has no design, and drag-to-ask aims at the least reachable strip of a phone.
- **Visual design 6.6.** Right diagnosis and a strong hand spec. But there is not one mock or paintover, and a 60×76 px chip must carry eight kinds of state with no proof it fits.
- **Grounding & accuracy 7.0.** 21 of 23 findings verify, but one S0 mechanism is false, the §0 summary overstates, and the audit misses the most direct Squid leak in the code.
- **Prioritisation & realism 7.0.** Good ranking, critical path and cut lines. M0 is under-scoped and under-estimated, and the "8 weeks" compression doesn't add up.
- **Measurability 6.4.** The right kinds of gates, but some can't pass (the leak test), some can't measure (percentage gates at n=5), and some test the wrong thing (bare 740/844 viewports, bot-paced loudness).
- **Vision & coherence 7.6.** Four laws from one sentence is exemplary. The pool-driven arc and P4's "screen off" test contradict the game's data and the plan's own no-rank-sounds rule.

**3. Factual errors and unverifiable claims**

*Verified:*
- A1 (`room.ts:127-134`, `EventLog.tsx:65-72`, `i18n.ts:102,104`).
- A3 and A4 (`deck.ts:9-14`, `engine.ts:300,597,803`, `redact.ts:61-75`).
- A5 (`InterruptPrompt.tsx:49-51`) and A6, including the button-size difference (`styles.css:132-145`).
- A7 (`engine.ts:709-735`, `index.ts:117-119`).
- A8: I re-ran `eventcount.ts`. The cap is hit at turn 47–49 of 80–102, in 795 of 800 games.
- A10–A14, A16–A19, A21 and A22 in code; A15, A20 and A23 in the screenshots; the 65 KB gzipped bundle baseline (64,731 bytes).

*Wrong or overstated:*
- **A2.** "The engine that deals from it ships in the client bundle" is false. `dist/assets/index-*.js` has no mulberry32 constant, no `Math.imul` and no deck code; the client imports only rank constants. The proposed fix is also not enough. The seed is 32-bit (`room.ts:87`, `rng.ts`), so §6.2's "unguessable without the seed" is false: a player can brute-force all 2³² seeds against their own seven cards in minutes.
- **§0.** "All of them silent for the last 40–50 %" is false. Only the `useEventBeats` cues stop. The totem knock (`GameTable.tsx:53`), the eligibility chime (`InterruptPrompt.tsx:50`, your own A5 tell) and the local button presses keep playing. "Four noise bursts" is also wrong: `chime` is two triangle oscillators.
- **A9.** "You scroll to act inside a 12 s clock" is false. Asks have no timer (the room only times windows, `room.ts:110-125`), and every timed action sits on a plank fixed to the bottom of the screen (`styles.css:1001-1007`). The fold problem is real; the clock part isn't.
- **Missed S0 bug.** An honest answer emits `WINDOW_CLOSED(RESPONSE_PENDING)`; a Squid lie emits nothing. `handleDeclareSquid` clears `pendingWindow` before `afterResponsePending` checks it (`engine.ts:405-412`). I reproduced it with the engine's test helpers:
  - honest: `WINDOW_CLOSED > REQUEST_FAILED > DREW_FROM_POOL > TURN_STARTED`
  - Squid: `REQUEST_FAILED > DREW_FROM_POOL > TURN_STARTED`

  Every client's socket carries this difference today. DECISIONS.md's "every response now takes the same shape" is false at the event level, and your audit inherited the claim without checking it.

*Unverifiable as stated:*
- "Most answers land in 1–4 s": there is no telemetry.
- "8–10 dB under conversational voice chat": no method is given, and the ratio depends on other players' mic gain.
- "≤12 ms private haptics are desk-safe": none of the tests covers it.
- "First card at y=1323": plausible from the screenshots, but I couldn't re-run it here because Playwright isn't installed.

**4. Must-fix to reach 8.5 (ranked)**

1. **Your cue bible makes the Squid lie audible.**
   - Problem: `clock.close` fires on `WINDOW_CLOSED` for all clients. So every honest answer knocks on six speakers, and every lie is silent. That is A6 rebuilt at table scale.
   - Fix: drive the close cue and the uniform close from the view change (`pendingWindow` → null, ordered by `seq`), never from the event.
   - Add an M0 engine task so both paths emit identical events.
   - Make "honest no vs Squid deny" the first leak-test fixture.

2. **Done-means #1 cannot pass.**
   - Problem: every window except the answer window opens only when someone holds the matching power (`engine.ts:265,340,452,532,803`).
     - `TURN_START` tells the table that the current player holds an unused active power. In Mode Ascuns that sorts a face-down set into active or reactive.
     - `SET_COMPLETED` and `TURN_END` announce that someone holds Mantis or Shark.
   - Your "which power lies face-down" leak-test pair will fail, and `clock.open` plays each leak through every mic. §11.2 fixes only two of the five windows.
   - Fix: add to the rules decision that every window opens for everyone, for a uniform minimum time.
   - Until then, don't play `clock.open` for windows whose existence reveals ownership, and state the secrecy property you actually guarantee.

3. **The pond arc is wrong for 5–6 players.**
   - I measured it: the pool empties at a median 34% of a 6-player game and 48% of a 5-player game. 67% (6p) and 53% (5p) of go-fish events happen with the pool already dry.
   - So audio intensity peaks in the first third and then flatlines, and your signature plop lands in an empty basin two times in three.
   - Fix: drive the arc from real cards not yet laid. That count goes 60 → 0, which is exactly RULES §7's end condition. Use the pool level only for how wet things sound.
   - Design a dry go-fish cue (the arrow-chip skittering on the basin floor, a hollow knock) and the empty-pool ask beat.

4. **There is no level spec.**
   - Fix: add a cue sheet with these columns for every cue:
     - target loudness (momentary maximum, or dB relative to the bus)
     - priority and maximum simultaneous instances
     - cooldown
     - number of variations
     - its backlog "short variant" (§4.2 relies on these but never defines them)
     - its ducking role
   - Normalise assets by loudness per class, not to −6 dBFS peak. A 30 ms tick and a 900 ms țambal swell at the same peak differ by 10–20 dB in loudness.
   - Set loudness targets per output profile: about −18 LUFS for phone speakers (the ASWG-R001 portable target) and about −23 for desktop. At −23 LUFS, with the UI bus at −10 dB and ticks at −8 dB, you fail your own "phone at 50 % in a noisy room" test.

5. **Scale variation by frequency.**
   - Per 6-player game, `TURN_STARTED` fires about 102 times, `WINDOW_CLOSED` 103, `REQUEST_MADE` 97 and `REQUEST_FAILED` 74. `POWER_USED` fires about 4 times in total, and most individual powers less than once.
   - Fix: give the five most frequent cues 8–12 variations plus parameter randomisation. Rare cues need 1–2.
   - Delete the target "players name 6 of 8 motifs after two games". Two games give about 8–12 motif plays spread over 8 motifs, so play alone can't reach it. Test recall after studying the Codex instead, or drop it.

6. **Model the voice call.**
   - Problem: with N players on speakers, every all-client cue enters the call N times, each arriving 150–300 ms late.
   - By your own hypothesis, tonal material survives noise suppression, so the motifs and țambal are exactly what smears.
   - Fixes:
     - Add an echo budget.
     - Consider public cues where the acting client plays the full cue and everyone else plays a dry transient.
     - Run the Discord test with 4–5 clients on speakers, not two.
     - Test the 10 ms private haptic with a phone on a desk next to a laptop mic, on both ERM and LRA motors (an ERM may not even spin up in 10 ms).

7. **Fix the mix mechanics.**
   - Ducking: ducking ambience under every Table cue, plus −3 dB on each of the ~80–100 answer windows per game, will pump audibly. Use a slow activity envelope or no duck.
   - Voice collision: `clock.open` and `clock.eligible` fire together on the single never-stolen Clock voice, so one is lost.
   - Ambience budget doesn't close. The loops total 102 s:
     - Recorded, that's about 816 KB at 64 kbps, against 220 KB for all audio.
     - Pre-rendered procedurally, it's about 19.6 MB of Float32, against "≈5 MB" and a 150 ms render budget.
     - Fix: generate the ambience bed live from short sources.

8. **Phone ergonomics and proof.**
   - Drag-to-ask as the primary phone gesture means dragging roughly 600 px from the dock up to a 60 px chip in the top strip. That is the least reachable zone and violates your own P5.
   - Fix: on phones, show ask targets in a sheet in the thumb zone after a card group is picked; keep drag for desktop.
   - Run the layout checks at real browser heights (e.g. 360×640 and 390×664) with safe-area insets, not bare 740/844.
   - Show an annotated mock of a 60×76 chip with a 24-character name (the server allows 24), three sets, and the stunned, protected, disconnected and totem states.

9. **Make the gates mean something.**
   - With n=5, "<20 % muted" means zero players, and one person decides the ambience default. Pool rounds together, or report counts without pass/fail.
   - The blindfold test and P4 "screen off" can't recover rank or seat, by the plan's own design. Redefine them as naming the outcome type (give, go fish, lay, power, stun), or add a sound identity per seat.
   - Render the loudness test with human think times, not bot pacing, and say whose client it renders.

10. **Re-scope M0.**
    - Add the Squid event fix and a cryptographic seed of at least 128 bits.
    - M0's exit criterion needs "the leak test's event half", but §6.4 builds that test in M1. Resolve the conflict.
    - Re-estimate: about 15 cross-package changes plus test updates is not 4 days.
    - Drop "about 8 weeks with the sound designer in parallel". 46 engineer-days don't shrink because a part-timer writes flute parts.

**5. Nice-to-have**
- A sound identity per seat (a plank pitch for each player mark); this also rescues P4.
- Mix snapshots for window open, your turn, ceremony and backlog.
- The iOS 18 `<input switch>` haptic as an iPhone stand-in for vibration.
- A cultural read, not only a musical one, on using a liturgical toacă as a UI click.
- Estimate how many iPhone players keep the silent switch on: with `audioSession 'ambient'`, they hear nothing.
- Admit that seat panning pays off only on desktop stereo and headphones.

**6. What is genuinely strong**
- Law 1 and the privacy tier table, especially "one identical cue for every answer, Squid included" and silent reactive declines.
- §11.2's single-plank insight.
- The A8 diagnosis, reproducible to the event.
- Pure `cues.ts` and `choreography.ts` as the leak-tested surface.
- The `seq` timeline with masking and backlog rules.
- A material grammar built on a correct modal family (the free-free bar ratios are right).
- Synthesis recipes specific enough to implement tomorrow.
- A two-week cut that delivers the secrecy, phone and core-loop gains first.
