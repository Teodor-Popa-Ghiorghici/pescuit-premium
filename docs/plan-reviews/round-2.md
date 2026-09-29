# Round 2 — review of plan v2 (a14d309)

*The critic's report, verbatim. It is model output from a separate agent briefed as a harsh AAA game designer; claims in it were checked before the next revision acted on them.*

SCORE: 7.5/10

**Round-1 must-fixes fully resolved: 6 of 10** (#1, #4, #6, #7, #8, #9). #2, #3, #5 and #10 are only partly resolved, and the fixes for #2 and #10 introduce new defects (items 1 and 2 below). All five round-1 factual corrections are made.

**1. Verdict**
v2 is a real plan. It has a checkable secrecy property and a Squid engine fix with a failing-first test fixture. It has per-profile loudness, a cue sheet with levels, a model of the voice call, live synthesis, budgets that close, and layout mocks rendered from the real components at real browser heights. I still can't sign it. Three of its load-bearing fixes fail when run against the code:
- **The close rule leaks.** The rule that closings "come from the view" silences the answer-window close exactly when a holdings-revealing window follows.
- **The seed fix re-opens the deal.** The PRNG design hands every player enough output to recover the deal.
- **The new arc misreads how games end.** Its clock is not how the game actually ends in any of the plan's own 1,200 simulated games.

Add a cue sheet that breaks its own frequency rule on the two most-played cues, and this is not yet a plan an AAA team executes without substantive rework.

**2. Sub-scores**
- **Sound design 7.5.** Law 1, the call model, the echo budget and class normalisation are strong. Against it: the close rule voices the structural tells, the arc premise is false at 5–6 players, the most frequent cues are under-varied, and the seat pitches collide.
- **Feel 7.6.** The four-beat ask with wet and dry outcomes, the thumb-zone sheet and view-driven transitions are good. But the game's actual ending (a run of 2N misses) has no design or warning, and the beat table can't meet the M2 overhead gate.
- **Visual design 7.4.** The mocks are credible and fit. Legibility slips: 11 reads as "II", the stunned brand hides the score, the facts that decide an ask sit in a drawer, and desktop is still three bullets.
- **Grounding & accuracy 7.4.** §1.1's numbers reproduce, but the headline claim ("cards in play… is the end condition") is false in its own data, and several internal numbers disagree.
- **Prioritisation & realism 7.8.** M0 is itemised and re-estimated, rules options are costed, and the cut lines are sound. The PRNG flaw would force M0 rework.
- **Measurability 7.4.** Pooled counts, the desk and call tests and human-paced loudness are good. But the "audio won't voice structural windows" promise has no test, and `shoot.cjs` never asserts the sheet or plank.
- **Vision & coherence 8.0.** "Presentation never adds information", "material, not liturgy" and "frequency decides treatment" are clear rules. The gliding knock breaks P1, and the comic dry beat conflicts with "the game whispers".

**3. Factual errors and unverifiable claims**

*Verified:*
- `squid-events.ts`: the honest answer has `WINDOW_CLOSED`; deny and claim don't.
- `arc.ts`: 80/65/49/36 % dry points and 21/67 % dry go-fish.
- `eventfreq.ts`: all of §1.1, 3p and 6p.
- `shoot.cjs` re-run: all frames PASS, byte-identical to the committed PNGs.
- The mock imports the real `Card`, `Seal`, `Totem`, `NotchClock` and `styles.css`.
- ASWG −24/−18; the KS 128-frame limit; 30 s at 32 kHz ≈ 3.8 MB.

*Wrong:*
- **§1.1 / §2 "cards in play… falls roughly linearly from 60 to 0… is the end condition".** False.
  - 1,200/1,200 bot games (3–6 players) end on the no-progress streak (`engine.ts:606-611`, DECISIONS.md:161), which v2 never mentions. That streak is 2N consecutive asks that capture or draw nothing; the median final run is exactly 6 at 3p and 12 at 6p.
  - Cards left at game end: median 9 at 3p (p90 20) and 26 at 6p (p90 44). It is never 0.
  - At 6p, "night" (≤ 20) is reached in 40 % of games and "last light" (≤ 12) in 20 %; 16 % never leave dusk.
  - 54 · 44 · 27 is not linear either.
- **§3.2 "closings… when `pendingWindow` goes from set to null".** Simulated with the engine: after an honest answer, the view goes straight from RESPONSE_PENDING to TURN_START (next player holds Jellyfish), TURN_END (anyone holds Shark) or TRANSFER_PENDING (loser holds Tortoise). It never passes through null.
- **§6.3 xoshiro128** with "card ids… from the same stream".** I recovered the full 128-bit state from five raw outputs (GF(2) solve, rank 128/128) and predicted every later output.
- Internal numbers that disagree:
  - "Engine overhead 0.6–1.0 s" (§4.1): the beat table sums to 1.14–1.54 s.
  - Effort "51–62": the milestones sum to 48–62.
  - "~13 table cues a minute": about 26 by Appendix D at the stated pace.
  - "Cards given 21/22" is actually successful asks.
  - `table.answer` is on the UI bus in Appendix D but on Table in §3.5.
- `shoot.cjs` logs but never asserts the sheet and plank that §0.2 and the README say it checks. They happen to fit: 202–452 and 375–664.

*Unverifiable as stated:* §3.1's "with the screen off you can still hear whose turn it is" is asserted before any test.

**4. Must-fix to reach 8.5 (ranked)**

1. **The close rule voices the tells it promises to hide.**
   - Problem: under §3.2, `clock.close` (all clients, 78–96 plays a game) goes missing exactly when a structural window follows. Every open mic then hears "someone holds Shark", "the loser holds Tortoise" or "the next player has an active power".
   - Your leak test can't see it (same public record), and the rules-tell test is marked known-failing.
   - Fix: fire the answer-window close when RESPONSE_PENDING leaves the view, whatever replaces it, at a fixed offset from the answer.
   - Add the test §6.6 implies: public records that differ only in structural windows must produce identical audio.

2. **The seed fix re-opens the deal.**
   - Problem: xoshiro128** is GF(2)-linear with an invertible output scrambler. Seven card-id tokens per player at deal time recover the state, the shuffle and every hand.
   - Fixes:
     - Generate card ids with `crypto.randomUUID()`, independent of the game stream.
     - Shuffle on the server with a CSPRNG (ChaCha20 or `crypto.randomInt`); keep xoshiro for seeded tests only.
     - Add a test that no wire field is derived from game-RNG output.

3. **Re-base the arc on how games actually end.**
   - Problem: the real finale is a run of 2N misses, which is unsignalled, so the game just stops. P5's "how close is the end" is therefore unanswerable.
   - Fixes:
     - Drive the last act from end pressure that includes the public no-progress count, e.g. "the pond is closing — 3 misses left".
     - Make the final ask a designed beat.
     - Validate the curve with bots that remember asked ranks, not random ones.
     - Or take the end rule to the §11.1 rules call.

4. **Make the cue sheet obey §3.7.**
   - Problem: `clock.open` and `clock.close` are the two most-played cues (78/96 plays), yet have 3 fixed variations.
     - `table.bonus` (4), `table.asked` (3) and `table.turn.you` (3) break the 6–8 rule.
     - "Go fish (at 6p)" is listed as >60 plays but actually splits 24/50.
     - `clock.open` (350 ms) and both go-fish cues (350/400 ms) break the ">60 → ≤ 250 ms" rule.
   - Fix: make every >60 cue live. Add a CI check that Appendix D satisfies §3.7.

5. **Seat voices won't carry "who".**
   - Problem: D and D′ are an octave apart, the most confusable pair there is. Naming six absolute pitches from a 180 ms inharmonic knock is ear training, not a glance. A "gliding" knock has no physical source (P1).
   - Fixes:
     - Carry identity mainly in rhythm or knock count, or plank size; keep pitch secondary; drop the octave pair.
     - Make §3.1's claim conditional on the M2 blindfold test, with a stated fallback.

6. **Don't make the most common outcome a joke.**
   - Problem: at 6p, `table.gofish.dry` plays about 50 times a game and ends every game in a run of 12. "Played for a small laugh" plus *"balta e goală"* text will grate by the tenth time.
   - Fix: make it neutral and brief, and let the streak's final misses carry tension (ties to item 3).

7. **Visual legibility, from your own mocks.**
   - Problems:
     - The pool count 11 renders as "II" and scores of 1 as "I" (`main.tsx:288,141`), so the end-proximity number reads as Roman two.
     - The stunned brand covers the score.
     - Protected ranks and Deschis face-up powers decide an ask, yet appear on neither the chip nor the ask sheet.
     - Desktop has no mock.
   - Fixes:
     - Use tabular lining figures with a flagged 1.
     - Keep the score visible in every state.
     - Put protected rank and public powers on the sheet rows.
     - Show the true worst-case chip (stunned + current + protected + offline).
     - Mock the desktop at 1280×800.

8. **Close the numbers.**
   - Fix the overhead and effort sums, the cues-per-minute figure, the "cards given" label and the `table.answer` bus.
   - Time `clock.eligible` from something that plays in those windows; it currently keys off `clock.open`, which reactive windows don't play.
   - Specify the beat overlaps that make M2's ≤ 1.0 s gate reachable.
   - Add sheet, plank and top-edge assertions to `shoot.cjs`.

**5. Nice-to-have**
- Keep the Clock bus out of the master glue compressor, so ticks aren't modulated by unrelated content.
- Report playtests per round as well as pooled; the three rounds test three different builds.
- Give the hand some of the pond's roughly 300 px at 390×664; 7 of 9 cards show only a three-letter sliver.
- The ticker clips long lines (dry mock: "nimic de tras").
- Say plainly that the ask sheet's top row (y≈257 of 664) sits above the bottom-45 % zone, which is fine for an untimed ask.

**6. What is genuinely strong**
- Law 1 as a property of the public record, with honest scoping in §6.6 and a known-failing test instead of a false claim.
- The Squid shape bug found, fixed in M0 and pinned by fixture 1.
- §3.4: the call as part of the mix, the echo budget, experiment E1, the five-client rig, and the desk test on ERM and LRA motors.
- Appendix D exists: level, priority, instances, cooldown, variation, short variant and envelope role for every cue.
- Live synthesis and a live pond, so the budgets close.
- Mocks from real components at real heights, reproducible byte for byte.
- A designed dry go-fish built from measured data.
- Material, not liturgy.
