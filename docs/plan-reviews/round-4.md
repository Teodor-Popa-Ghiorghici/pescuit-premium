# Round 4 — review of plan v4 (cde59fa)

*The critic's report, verbatim. It is model output from a separate agent briefed as a harsh AAA game designer. This was the last review: the three-rewrite budget ended with v4, so no revision acted on it. Its two most concrete findings — the tally rising in Mode Deschis, and the mocks' forced pass for an absent player — were confirmed against the code (see README.md).*

SCORE: 8.2/10

**Round-3 must-fixes fully resolved: 6 of 6**, verified by re-running and probing:
1. **Chain rebuilt and tested at the output.**
2. **§11.2 reads only the public record.**
3. **The act-2 clock is now the public tally.**
4. **The 1024×768 frame is fixed, and hit-tests are added.**
5. **Look-alike cues are redesigned and checked by measurement.**
6. **The small claims are tidied.**

Three new problems are set out below. Two of them grew out of the fixes for items 3 and 5.

**Verdict**
v4 is close to sign-off.
- **The sound engineering now holds up under attack.** The chain is transparent, and the bed, clock, echo, peaks and balance are all measured at the output. I rendered the worst pile-up over 30 extra seed and spacing variants and none broke −1 dBTP.
- **The end rule is leak-free by construction** and backed by a real test.
- **The layout harness now catches occlusion.**

What keeps it below 8.5 is the plan's new headline, the "sets still possible" tally. Three things the plan asserts about it are false:
- **"Starts at 18 and only falls" and "identical in Mode Deschis":** both fail in Deschis.
- **"The last set is always announced":** an observation from bot games, not a guarantee.
- **Its copy promises what an upper bound cannot.** A stalled game announces "ultimul set" (the last set) and then dies without laying it.

Separately, the mocks show an absent player's turn being skipped. That forced pass is a rule the state machine explicitly rejects, and the plan never proposes it.

**Sub-scores**
- **Sound design 8.4.** A chain that is verifiably transparent, eight checks that can fail, and a sensible provisional anchor. Deductions: the confusability claims outrun the metric, the true-peak margin is thin, and the speaker mastering is crunchy on two frequent cues.
- **Feel 7.9.** The beats and the tally give the ask and the end a shape. But the stall ending, which is common at casual tables, gets no design, and an absent player's turn is undefined.
- **Visual design 8.2.** Hit-tested mocks at every size, a desktop log drawer, fixed numerals and a legible tally. But the "legal moments" include an illegal forced pass.
- **Grounding & accuracy 7.8.** Every simulation, metric and mock reproduces byte for byte. But five claims about the tally, the Deschis check and the cues are false.
- **Prioritisation & realism 8.3.** Consistent effort totals (51–65 days), the end check costed at 1.5 days, and sensible cut lines.
- **Measurability 8.1.** Tests 1–3, eight audio checks and the hit-tests are strong. Nothing measures stall share, and nothing tests tally monotonicity or the Deschis case.
- **Vision & coherence 8.3.** "One clock, two textures" is a clean idea, but the clock's wording claims more certainty than its maths has.

**Factual errors and unverifiable claims**

*Verified:*
- **The chain and its checks:**
  - `run.cjs`: all 8 checks PASS, and `metrics.md` is byte-identical to the committed one.
  - Program gain is calibrated on `table.turn` alone.
  - The bed sits 17.4 LU (speaker) and 16.8 LU (headphones) under the anchor; clock cues sit 11.5–18.9 LU over the bed.
  - Every cue alone shifts ≤ 0.6 dB through the chain, and the echo budget is met at the output.
  - A six-cue burst over seeds 3–12 × three spacings peaks at −1.06 dBTP at worst, with no clipping.
- **The end check:**
  - `endcheck.ts` PASSES: the public count gives the same answer in both worlds.
  - `ending.ts` reproduces §1.1 and §3.9 exactly: the public check fires in 95–97 % of games (omniscient 97–99 %), the guards read 0, and the thresholds are 44/40/36/32 % and 79/75/71/67 %.
  - The count never rises in Mode Ascuns (600 games).
- **`eventfreq.ts`** reproduces all of §1.1.
- **The mocks:** `shoot.cjs` passes 10/10 frames, byte-identical. The 1024×768 frame folds the log into a drawer, with all posts inside the table.

*Wrong:*
- **"Starts at 18 and only falls" (§2, §3.9)** — false in Mode Deschis. The count rose 13 times in 300 random-bot games and 6 times in 300 memory-bot games.
  - In Deschis a used set flips face-down (`engine.ts:951-955`), and `publicLaid()` reads only `faceUp ? rank : null`. So the check forgets a rank the public record already contains, from the face-up lay and `POWER_USED`.
- **"In Mode Deschis they are identical" (§11.2)** — false, for the same reason. 13/300 games at 3p and 13/300 at 6p end later under the public check than the omniscient one, by a median of 7 and 22 turns (public fires 284 vs 297, and 277 vs 290).
- **"It reaches 1 before the end in every decided game, so the last set is always announced."** This was observed in Ascuns bot games, not proven.
  - One legal Deschis lay (X as 2 real + 2 eggs, with Y's last two cards stranded) takes the count from 2 straight to 0.
  - In another run, 2 of 282 decided Deschis memory games skipped the 1.
  - Drops of two or more in one action are routine (264–281 per 300 games).
- **"The only three-onset figure in the game" (§3.1, Appendix C).** `metrics.md` itself lists `table.gofish` (0·35·60), `table.lay` (0·120·240) and `mus.start` (0·30·60) with three onsets.
- **"Every mock shows a legal moment."** Every your-turn frame and the desktop log show "Elena e plecată — tura trece" ("Elena is away — the turn passes"). STATE_MACHINE.md:246–252 rejects this: "the room simply waits … rather than the engine inventing a forced pass."

*Understated:* "The gate is for stalls only … 3–5 % of memory-bot games."
- With random bots, 62 % (3p) and 91 % (6p) of games in Ascuns end on the stall rule, at a median tally of 2 and 5.

**Must-fix to reach 8.5 (ranked)**

1. **Make the tally truthful and robust — it is the plan's one clock.**
   - **The wording overpromises.** The count is an upper bound, yet the copy says "încă 9 seturi" (9 more sets) and "ultimul set" (the last set).
     - In Ascuns, 12 of 14 stalled memory-bot games at 3p, and 12 of 12 at 6p, end with "ultimul set" on screen and the last set never laid, after 2N dead asks.
     - Fix: word it as a maximum ("cel mult 9 seturi" / "poate încă un set").
   - **Stall endings get no design.** For casual tables they may be the usual ending. Fix: design the stall ending as a first-class finale, and add stall share and "announced but not laid" to §9.2.
   - **The Deschis bug.** Feed the check every rank the public record has revealed, not the current `faceUp` flag, or show spent Deschis sets' ranks in the view. Extend test 3 to cover monotonicity, and public-equals-omniscient in Deschis.
   - **"Always announced."** Trigger the last-set cue on a public predicate ("the next lay may end the game") rather than on count == 1, or drop "always".

2. **Define an absent player's turn, and stop the mocks inventing one.**
   - The server has no turn timer; it only times windows (`room.ts:110-125`). So a dropped player freezes the table on their own turn, a real hole in a phone game. §4.6 covers only being asked.
   - Fix: decide. Either a turn timer with auto-pass (plus a DECISIONS.md entry and an engine task), or "the table waits" behind a visible plaque. Then make the ticker and log match.

3. **Scope the confusability claims to what is measured.**
   - By the harness's own metric, two pairs have identical rhythms and fall under the 19.3 dB seat-step bar:
     - `table.asked` / `table.gofish` at 17.8 dB. Both sound within one ask on the target's device.
     - `clock.tick.urgent` / `power.shark` at 15.7 dB.
   - They escape only because the check compares cues within one "slot".
   - Fix: compare across the whole ask (turn → outcome), or state and justify the partition. Correct the "only three-onset figure" claim.

**Nice-to-haves**
- The limiter works on sample peaks, and the worst burst leaves 0.06 dB of margin. Use 4× oversampled true-peak detection, or a −2 dBFS ceiling.
- Speaker mastering residuals of −6.0 dB (Jellyfish) and −6.3 dB (the dry go-fish, heard up to 48 times a game) mean heavy saturation. Automatically send any cue with a residual above −10 dB to the listening test.
- The desktop tally strip is about 60 px wide. At arm's length, "how close is the end" deserves a bigger mark.

**What is genuinely strong**
- **The chain rebuild.** No compressors, a JS limiter shared with the product, per-profile mastering, and an anchor explicitly marked provisional until the call test. It's tested where it matters: at the output.
- **The public end check.** Maximising over every face-down rank assignment makes it safe (it never ends a live game) and leak-free (a pure function of the public record) by construction. It's pinned by the endgame pair and two guards.
- **The tally as a clock.** Measured pacing across both bot populations and every table size, driving light and sound from one public number.
- **Hit-tests that would have caught v3's defect.** Plus a desktop drawer that fits, and every artifact reproducing byte for byte.
- **Honest self-correction throughout:** the "at rest" rationale, the "mid-screen" sheet, and ASWG's scope.
