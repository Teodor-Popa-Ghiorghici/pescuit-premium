# Round 3 — review of plan v3 (f15a0ea)

*The critic's report, verbatim. It is model output from a separate agent briefed as a harsh AAA game designer; claims in it were checked before the next revision acted on them.*

SCORE: 7.5/10

**Round-2 must-fixes fully resolved: 6 of 8.**
- Resolved: #1 (close rule), #2 (deal), #4 (cue sheet), #5 (seat voices), #6 (neutral dry go-fish), #8 (numbers).
- Partly resolved: #3 (arc and ending) and #7 (visual). Each fix introduces a new defect; see must-fixes 2–4.

**Verdict**
v3 is the most evidence-backed version yet:
- The ending analysis is a real discovery about the rules, and it reproduces exactly.
- The secrecy fixes for presentation and the deal are now correct.
- There is a runnable audio prototype and asserted mocks at real browser heights.

But the plan now claims its sound chain is *proven*, and I verified it isn't. The master chain is an upward compressor. It lifts the pond bed to roughly speech level (above every cue on speakers), buries the clock ticks under the bed, and fails the echo budget at its output. The headline "−18.0 / −23.0 LUFS" figures are the pond bed, produced by a calibration loop, not by the game's cues. Separately, the recommended end rule (§11.2) reads hidden hands, and its timing can reveal face-down ranks, Squid included. In the most heavily weighted area the plan asserts proof that doesn't hold, so it still needs substantive rework.

**Sub-scores**
- **Sound design 7.3.** The grammar, Law 1, the cue sheet, the call model and the seat signatures are strong design. The reference chain inverts the mix, and the metrics that "prove" it measure the wrong things.
- **Feel 7.8.** Beat timings and overlaps are specified, wet and dry go-fish are designed, and transitions are view-driven. Under §11.2, act 2 has no working clock and the finale can't be signalled in advance.
- **Visual design 7.6.** The phone mocks are good, and the numerals, stunned score and ask-sheet facts are fixed. The 1024×768 desktop frame hides a player and still passes the check.
- **Grounding & accuracy 7.3.** Every simulation reproduces, but the core audio claims (loudness met, ambience ceiling, echo budget met) are false at the chain's output.
- **Prioritisation & realism 8.0.** M0 is itemised, the totals are consistent (49.5–63.5 days), and the cut lines and rules costs are sensible.
- **Measurability 7.2.**
  - The checks exist and run.
  - But the loudness check can't fail, the echo check runs before the chain, and nothing checks the ambience ceiling or bus balance.
  - The layout check can't see occlusion.
- **Vision & coherence 8.0.** Two acts, the plank grammar, and "material, not liturgy" are coherent. §11.2 hollows out act 2, and P5's "how close is the end" is unsupported under it.

**Factual errors and unverifiable claims**

*Verified (all re-run):*
- `ending.ts` and `eventfreq.ts` reproduce every §1.1 figure, both bot populations: 0 % of games end by exhaustion; with memory bots, dead asks occur in 98–99 % of games (median 6/8/10/12, 6 cards stranded); 0 sets laid or destroyed after the check fires.
- `squid-events.ts` shows the Squid event-shape leak.
- `shoot.cjs`: 10/10 frames PASS, byte-identical to the committed PNGs.
- `run.cjs`: 3/3 checks PASS; `metrics.md` is byte-identical, and WAVs differ by at most −82 dB.
- Every no-progress reset is a public event (`engine.ts:246,607,664,701,792,856`), so `endPressure` is public.
- A26 is cited correctly (`styles.css:560-567`).

*Wrong:*
- **§0.2 / §3.3, "the prototype already meets −18.0 / −23.0 LUFS".**
  - `runSketch` adjusts program gain over four passes until the target is hit (`sketch.js`, the loop before `renderBurst`), so the ±2 LU check can't fail.
  - At the calibrated gains, the full 180 s scene split three ways:

    | Profile | Scene | Pond bed alone | Cues alone |
    |---|---|---|---|
    | Speaker | −18.0 LUFS | −18.1 LUFS | −21.0 LUFS |
    | Headphones | −23.0 LUFS | −24.8 LUFS | −19.3 LUFS |

  - The integrated figure is set by the bed.
- **§3.3 / §3.9, "ambience ≤ −32 LUFS short-term".** The bed runs at −17.6 LUFS short-term on speaker and −23.7 on headphones: 8–14 dB over the ceiling.
- **§3.3, "a gentle tanh stage".** At program gain 0, a 1 kHz sine at −60 dB is raised +27 dB on speaker and +9 dB on headphones, versus about 0 dB near full scale. The cause is the automatic makeup gain in `DynamicsCompressorNode` (densifier, glue and limiter), plus the shaper's +7 dB small-signal gain.
- **§3.3, "ticks keep a steady level".** A tick's active loudness on speaker is −29.2 LUFS against the bed's −18.1, so the countdown sits about 11 dB under the pond.
- **§3.4, "echo budget met by design, measured with no fade".** It is measured before the chain. At the speaker chain's output:
  - `power.mantis` rises from −18.5 to **−8.8 dB** and fails the −12 dB rule;
  - `power.shark` and `table.flight` rise 6–7 dB.
- **§5.2, "the same layout fits at 1024×768".** Elena's post spans x 695–845, past the table's edge (712) and under the log (728–1008), so its centre is covered. The hand runs to x=755, clipping the hint and the PĂSTRĂV card.
- **§4.4 / §0.1, "thumb-zone ask sheet".** At 375×548 the whole sheet (y 142–313) sits above the plan's bottom-45 % line (y ≥ 301). At 390×664 most of it (161–411) does too.

*Unverifiable:* "a mid-window check fired too early 70 times in 2,400 games". No committed script contains that variant.

**Must-fix to reach 8.5 (ranked)**

1. **Rebuild the master chain and test its output, not its inputs.**
   - Problem: the chain the plan calls "the reference for `mixer.ts`" would ship a mix where, on phones, the pond is louder than the knocks and the clock is buried. That breaks Law 2 at the root.
   - Fixes:
     - Compensate for the compressors' built-in makeup gain. It can't be switched off, so use a fixed trim after each compressor, or an AudioWorklet limiter.
     - Remove the shaper's small-signal gain.
     - Calibrate program gain on how loud the cues are while sounding, not on an integrated figure that the bed fills.
   - Add harness checks at the chain's output:
     - ambience ≤ −32 LUFS short-term (or ≥ 20 LU under cue loudness);
     - ticks ≥ 10 LU above the bed;
     - the echo budget measured after the chain;
     - bus-relative levels within ±1 dB of Appendix D.
   - Then restate §0.2 and §3.3.
   - The speaker target should come from the call test's game-vs-speech measurement, not ASWG, which is written for full mixes with music and voice-over. I suggested ASWG's −18 in round 1. The prototype shows that on a sparse knock stream it takes densification to reach, so that suggestion was too blunt.

2. **§11.2's end check reads hidden state, and its timing leaks face-down ranks, Squid included.**
   - Verified in Mode Ascuns with opaque ids: I built two states whose redacted views for P3 are byte-identical.
     - Both face-down 2-real + 2-egg sets are Squid: `decided()` is false, and the game continues.
     - They are Squid and Whale: `decided()` is true, and the game ends at once.
   - Whether the game continues tells the table the two sets share a rank. RULES §4 forbids revealing Squid "by any change in timing".
   - Fixes:
     - End only when no set is possible under every hidden-rank assignment consistent with the public record. In Deschis this is identical to the current check.
     - Add this pair to test 1.
     - List §11.2 in §6.6 until it is fixed.

3. **Give act 2 a clock that works under your own rule.**
   - Problem:
     - With memory bots the no-progress count reaches N and resets a median 0× a game, and §11.2 removes the final dead run. So the gate and `amb.lastact` almost never move.
     - The real finale, the last possible lay, arrives unannounced. The playtest target "I knew how close the end was ≥ 5.5" contradicts the design.
     - Night still falls when the pool empties, which is 34 % of the way through a random 6-player game.
   - Fix: the same public computation as in item 2 yields an honest countdown, "sets still possible: k". Show it, voice it, and let it drive the light. Keep the gate for games that stall.

4. **Fix the 1024×768 desktop frame and a layout check that can't see occlusion.**
   - Problem: five 150 px posts need about 780 px, but the table is 696 px wide.
   - Fixes:
     - Assert that each element is contained in its parent.
     - Assert that it isn't covered: `elementFromPoint` at each post's centre, and each card's right edge ≤ the table's.
     - Then fix the layout: smaller posts, two rows, or the log as a drawer below 1100 px.

5. **Cues that sound alike carry different meanings.**
   - Problem:
     - The spectrograms show `table.bonus` and `table.asked` are both two plank-D strikes about 75–100 ms apart.
     - The two-knock seat signatures differ from them only in register, the absolute judgement §3.1 claims to have removed.
     - The plank-grammar check inspects code parameters, not sound.
   - Fixes:
     - Give bonus and asked different rhythms or materials.
     - Add an acoustic confusability check (feature distance between cues, or an ABX pass in the audio lab).
     - Put these three cues in the blindfold test.

6. **Tidy the smaller claims.**
   - Add the mid-window variant to `ending.ts`, or drop the "70 times" figure.
   - Call the ask sheet mid-screen, or move it into the thumb zone.
   - `power.reveal` has 2 takes against §3.7's 3–4 for its play band.

**Nice-to-haves**
- The memory bot learns from the unredacted `SET_LAID` rank (`membot.ts:28-29`); feed it the redacted stream so it can't cheat in Ascuns.
- Once the chain is fixed, add a distortion and attack-peak check per cue through the speaker profile.
- Keep mock states legal under the rules: the ticker shows stunned Cezar asking.
- Give the phone hand some of the pond's roughly 250 px of empty water.

**What is genuinely strong**
- **The ending discovery.** Each egg used in a set strands a real card, so no game ends by laying every card. That is measured across two bot populations and turned into a concrete rule proposal.
- **Presentation secrecy is now correct.** The close fires whenever `RESPONSE_PENDING` leaves the view, structural windows are never voiced, and a structural-erasure test guards it.
- **The deal.** A server CSPRNG, UUID card ids, per-action Whale entropy, and a test that nothing RNG-derived reaches the wire.
- **A deterministic, runnable audio prototype** with every recipe, plus WAVs and spectrograms. That is exactly what made these faults findable in minutes.
- **Phone mocks at three real heights with real assertions.** Numerals, the stunned score, and protection and powers on the ask sheet are all fixed.
- **The cue sheet as data**, with §3.7 enforced and numbers that finally agree.
