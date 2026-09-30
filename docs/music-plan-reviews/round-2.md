# Round 2 — review of MUSIC_PLAN.md v2 (a084f35)

*The critic's report, verbatim. It is model output from a separate agent (a fresh one, not the round-1 critic), briefed as a very harsh AAA game designer and audio director (1 = unusable, 6 = passable, 8.5 = AAA quality), given the round-1 report and asked to judge v2 on its own merits. This was the last review: the brief allowed one rewrite, so no revision acted on it.*

SCORE: 7.1/10

**Round-1 must-fixes**
1. Hum source: **resolved.** Counter-hash noise per partial, a value-noise wander over absolute time, and an envelope-periodicity check (#15) (§3.5, §3.2). I simulated a 1–3 Hz noise resonator with the ±3 dB wander: envelope autocorrelation is 0.10–0.17 at 0.3 s and ≤0.07 beyond, so #15 is passable. There is a new side effect: the noise is made identical on every client (see errors, item 14).
2. Legato renderer: **mostly.** It is specified (§3.6) and costed (2 d in M-S0). But the slur is modelled as a 45 ms frequency glide, which a natural horn cannot play (see errors, item 10), and its cost estimate is wrong (item 8).
3. Rendering from measurements: **mostly.** It is now real time in a worklet with no buffers. I reproduced the base figure: 0.561 µs/sample at 16 kHz on this machine. The "≤ 8 harmonics ≈ 0.5 %" estimate is not measured and is optimistic (item 8).
4. Level arithmetic for every state: **partly.** The loudest state, the lobby and the clock are computed correctly, and A9 is a real fix. But "every state moves by −0.24 dB" is false. The presence arithmetic contradicts the plan's own voicings, so #18 fails by design. The activity envelope is ignored. The lobby headphones margin is 0.1 LU (items 1–3, 11).
5. State table consistent and total: **mostly.** Pool-dry, the accent vs the wind, precedence, evening answers, the cadence rules and N2 are all fixed. I checked all 16 Appendix-A phrases for length, ending, the partial-11 rule, the tonic-passing rule and the no-pulse rule; all pass. Three problems remain:
   - "No repeats by construction" is false (item 4).
   - A stall ending (no last lay) has no cut point.
   - A 2→0 jump (DECISIONS.md:268) fires `world.dark.01`/`mus.home` together with the finale, and nothing covers that case.
6. One sync clock: **mostly.** It uses broadcast `serverNow`, per-slot pure functions and a server-time ceremony hold. Missing: the presenter backlog divergence (item 6), and the structural-window test cannot be met (item 5).
7. Precise duck: **mostly.** It is per cue, excludes `.12/.06`, and drops the creak as a mask. New contradiction: the `mus.home` duck starts on the last-set cut, which #20 forbids (item 7).
8. Replace the unworkable measures: **mostly.** #14 (15 ¢ on ≥300 ms windows), #21 and a listening-effort primary are good. The power calculation pseudo-replicates (item 12).
9. Playtest: **mostly.** It is counterbalanced, has 75-min sessions, a group-carried rule and an arc probe. Gaps:
   - The plan kept the player, not the group, as the unit of analysis (it says so openly).
   - The decision table does not say what happens if only R-a or only R-e fails.
   - R-f's "right third" is undefined.
10. Amendments listed: **mostly.** A1–A12 cover everything round-1 named. Not listed: turning the palette's one accent (the horn) into an all-game bed (SOUND_DESIGN.md:6), and the hum not following the activity envelope.
11. Production: **mostly.** The totals reconcile: 32 days, cut lines 16/24/32, 33 days on the critical path. Gaps:
    - Week 1 has 0 days for two listening studies and a device run.
    - Cut lines 1–2 drop M-S7, so the listening-effort gate is skipped.
    - Cut 2 includes the agreement test but not the `clients=6` tool it needs.
    - The recorded fallback's 9–12 phrases break the 10-per-bag design, and this is not said.
11. (numbering continued)
12. Round-1 factual errors: **resolved.** Acoustic scale, `table.asked`, `outputLatency`, the crossfade, and turns vs asks (75–95 / 78–99 per FEEL:190–191) are all corrected.

**Verdict**
v2 is a real revision, not a cosmetic one. The hum no longer reads the 1 s buffer. Rendering is real-time. The sync model has one clock. Ducks are per cue. The day totals reconcile. Almost every repo fact I checked is right. The Law 1 work is still the best part.

But the revision brought its own set of contradictions, and several of the plan's own checks fail against the plan's own design:
- #18 (presence) fails against the §4.1 voicings.
- #20 fails against A8's `mus.home` duck.
- "No repeats by construction" is mathematically false.
- #23 is likely to fail against the plan's own benchmark method.
- The claim that the world stem is unchanged ignores the activity envelope and the fact that the score cannot read wetness.

The sync design ignores the presenter's backlog. And one Law 1 test (identical slots with and without a structural window) cannot pass on a wall-clock slot grid.

Musically, the headline "the game is one cadence, V → I" is still pitch-class bookkeeping:
- A 6-minute F–C drone whose calls must all end on F sets up F as home.
- Evening (5, 6, 10 = D–F–D) is a rootless tonic triad.
- Evening and night imply the 58 Hz residue.

The two sonic building blocks have physical-plausibility problems that go straight at the week-1 realism gate: a Q 155–460 "tube" resonance and glide slurs. The bed the hum sits on still loops at 1 Hz, and the plan neither fixes nor lists it.

This is close to good, but it is not signable. It needs one more pass on arithmetic, sync and sound quality, not on the concept.

**Sub-scores**
- **Musical concept & identity: 6.5/10.** Specific, culturally grounded and restrained. But the functional-harmony narrative does not survive psychoacoustics:
  - Residue pitch: GCD(5,6,10) = GCD(5,7,9) = 1, which implies 58 Hz; GCD(6,9,12) = 3, which implies 174 Hz (F).
  - The hum is close to sine-with-wobble.
  - The glide slurs are a synth tell.
  - The no-pulse rule allows 1:2:4 metric ratios (N2: 0.4 / 0.8 / 1.6).
- **Adaptive design & gameplay fit: 7.0/10.** A total state table with precedence and an irregular slot grid. Gaps: stall and 2→0 endings, backlog mismatch between hum and call, and in-game perceptibility of the arc still rests on playtest R-f.
- **Respect for the existing design (amendments): 7.5/10.** Twelve honest amendments. It still misses:
  - the dilution of the palette's one accent;
  - the departure from the activity envelope;
  - the looping bed it now leans on (gust coupling).
- **Voice-chat / mix engineering: 6.5/10.** The clock and lobby numbers are right and A9 is a genuine fix. The Discord-plus-game phone is now in the rig. Against that:
  - #18 fails by design.
  - Calls push the world 10–11 LU under the anchor, outside rule 3's window.
  - Copies of the hum from different phones are coherent (comb filtering) and change chord at different moments.
  - The lobby margin is 0.1 LU.
- **Secrecy (Law 1): 8.5/10.** Strong projection and Proxy test, per-slot purity, and divergences D-a–D-f listed. Faults: the window-history test cannot be met as stated, and the gust lift is an input outside `SCORE_FIELDS`.
- **Technical feasibility & architecture: 7.0/10.** A worklet with an offline-shared `synth.ts` is the right architecture. Problems:
  - The CPU budget is under-estimated.
  - It relies on `ServerClock` without reading it (the estimator keeps the most-delayed sample).
  - It ignores presenter queueing.
- **Measurability: 7.0/10.** Much better posed than v1. But #18 and #20 fail against the plan itself; the listening-effort CI is pseudo-replicated; the week-1 ordering test may be confounded by the darkening level steps; R-f is ill-defined.
- **Production realism: 7.0/10.** The sums reconcile. Week 1 is overpacked. The cut lines remove the Law 2 gate. The engineer idles during composition, or that time is uncosted. The effect of the recorded fallback on the library is unstated.
- **Grounding & accuracy: 7.5/10.** Nearly everything checks out: constants, file names, `DARK_STEPS`, the bus table, metrics values, 0.57 µs/sample (I measured 0.561), the Appendix-A arithmetic. The errors are listed below.

**Factual errors and unverifiable claims**
1. **#18 fails by the plan's own voicings.**
   - §6.1 (plan:415–420) assumes the hum splits equally, "each partial about −7.8 dB of the pond". §4.1 does not split equally.
   - I integrated the pond (a 2nd-order low-pass at 500 Hz, ambience.ts:85) over third-octave bands, with the hum 3 dB under the pond. SNR per partial in its band:
     - dusk: partial 12 −4.1 dB, partial 9 −0.1 dB;
     - evening: partial 10 −2.9 dB;
     - night: partial 9 −1.4 dB;
     - lobby: partial 8 −3.3 dB.
   - That is 4 of 6 states failing "≥ 0 dB per partial".
   - "Above 500 Hz … clearly over it" is wrong: the pond rolls off at only 12 dB/oct, and the upper partials are the ones voiced −6 to −12 dB.
   - In dry states the wind's Q 18/30 bands (310 ±12 %, 640 ±12 %, ×1.3 on gusts; ambience.ts:35, 189, 201) sit on partials 5, 6 and 10–12. That makes masking worse and adds pitched, out-of-key resonances against a tuned drone. The plan does not discuss that clash.
2. **"Every state moves by −0.24 dB" (plan:405) is false.**
   - The score may not read `poolCount` (plan:345), so the hum cannot follow the pond's wetness factor 0.8+0.2·wet or the wind's 0.7 (ambience.ts:165).
   - Anchored at the wet state, the bed-alone deltas are: wet −0.24, dry ≈ +0.13, nearly-empty pond ≈ +0.55 dB. The last one fails #17's 0.3 dB, although #17 only tests wet/dry.
   - The hum also skips the activity envelope (−4 dB, mixer.ts:458–464). In active play (~24 cues/min) the pond eases about 4 dB and the hum does not, so the world stem is about +1.5 dB louder than today. The harness measures "the bed alone" (tools/harness-entry.ts:394–398) and cannot see this.
3. **Rule 3 (plan:39–41) promises pond plus score "exactly where the pond sits today (12–20 LU under)".**
   - Calls are allowed up to −33 LUFS, 2 dB over the loudest bed (−35.1).
   - While a call sounds, world stem ⊕ call ≈ −31 to −31.6 LUFS, i.e. 10–10.6 LU under the anchor, which is outside the window.
4. **"No phrase recurs within 10 consecutive slots — by construction" (plan:304–307, restated at plan:757) is false.**
   - Each pass is an independent permutation. The re-draw only rejects a first phrase equal to the previous pass's last.
   - So the phrase at position 9 of pass p can appear at position 1 of pass p+1: two slots apart, as little as 36 s. With an inactive slot between them, two consecutive heard calls can be identical.
5. **The Law 1 history test cannot be met.**
   - §10.2 (plan:560–562) requires "identical slots, phrases, takes, cuts" for the five structural-window histories with and without the window. §1.1 (plan:76) says the pause "does not shift it".
   - Windows last up to 12 s (engine.ts:136). Slots sit on a fixed server-time grid (§5.2). A window therefore moves every later `setsPossible` change relative to that grid, which changes the state of the next slot.
   - This is not a new leak (the pause is already public), but the claim and the test are wrong as written.
6. **The sync ordering claim ignores the presenter.**
   - "Presented at S + delivery + ≈0.4 s … whenever delivery is under ~1.5 s" (plan:358–359).
   - The table queues steps: `tableStart = max(now, tableFreeAt)` with flush at 2500 ms (presenter.ts:41–42, 326–331). The dark cue sits at notch 300 + 80 ms (cues.ts:159–162, 482).
   - On a backlogged client the hum's knock-cut, which runs on presentation time (plan:362–363), can land around S + 2.9 s. That is after the S + 2 s slot, so a night call (partial 11, tritone) plays over the evening hum.
   - This case is not among D-a to D-f.
   - The same spread (0 to ~3 s between clients) means the call carries two different chords at once from different phones. §6.4's "slightly thicker drone" is false during transitions.
7. **#20 "no score duck is active at a cut" contradicts A8/§4.2.**
   - `mus.home` plays "0 ms after" the `world.dark.01` knock (plan:510) with a −6 dB score duck (plan:291). The last-set cut lands on that same knock.
   - The duck also halves the "dominant under the arriving tonic" that is the plan's payoff.
8. **CPU estimate.**
   - "Trimmed to ≤ 8 harmonics under 2 kHz ≈ 0.5 %" (plan:489). I patched horn.ts to 8 harmonics: 0.460 µs/sample, i.e. 0.74 % of a core at 16 kHz. With the per-sample `fromDb` pow also removed (horn.ts:108): 0.412 µs/sample, i.e. 0.66 %.
   - Worst moment (hum + call + answer) ≈ 1.6–1.8 %, above #23's own ≤ 1.43 % (70× real time). This is feasible in absolute terms, but the gate as set fails.
9. **The dark-knock loudness cited for masking is wrong.**
   - §4.2 cites "−14.0 LUFS" for `world.dark.01` (plan:279). That figure (SOUND_DESIGN §9) includes the horn note that A8 moves to `mus.home`; the knock alone is in the −27 range.
   - It also compares raw pre-chain LUFS with post-chain LU-under-anchor figures.
10. **Physical-model claims.**
    - "A slur is an exponential glide of 45 ms (a lip slur on a natural horn passes quickly)" (plan:223). A natural horn's slur jumps between resonances; it does not sweep through the frequencies in between. A 45 ms sweep over a sixth or an octave (D3: 8→12) is portamento, the classic synth-horn giveaway.
    - "Aeolian resonance of that horn" with a 1.5 Hz bandwidth (Q 155–460, plan:204) is tuning-fork Q, not a wooden tube's.
    - Both work against pillar P1 ("name the object") and against the week-1 realism gate.
11. **Lobby numbers.**
    - Headphones: −32.1 LUFS = 7.1 LU under, against #22's ≥ 7 LU. That is a 0.1 LU designed-in margin, the same fragility round-1 flagged at 0.2 LU.
    - The 7 LU threshold is new and arbitrary: today's headphone lobby (6.45 LU) fails it.
    - The lobby factor with the switch at "Off" is unspecified.
12. **Listening-effort power calculation** (plan:591–593). It treats 10 listeners × 6 clip pairs as 60 independent pairs. With only 6 clip pairs, clip variance dominates, so the ±0.2 half-width is not credible. Harvard sentences are English, while the players speak Romanian or English.
13. **An undeclared input.**
    - The gust lift (plan:210–211) needs the ambience's gust times. Those come from a per-client RNG (seed 5, started at local t0: ambience.ts:56–57, 105, 194–205) and from the dry state (`poolCount` is on the plan's own forbidden list, plan:345).
    - So "six public fields and nothing else" (plan:36) is false, the Proxy test cannot cover this path, and the hum is not "identical on every client" (plan:209).
14. **Identical noise across clients is a liability, not a feature** (plan:201–203). Copies of the same stream picked up by several phone microphones, arriving at 100–300 ms offsets, add coherently: a comb filter that shifts with jitter, i.e. phasing on the drone. Per-client decorrelated grain costs nothing under Law 1.
15. **"At most once every ~30 s at night on speaker devices" (plan:448).**
    - Speakers play half of the 3-in-4 active slots, so about one call every 80 s.
    - Each call has 3–5 slurs, so 3–5 clashes per call, not one.
16. **Speaker subset is specified two ways:** "every other active slot" (§4.1, §6.3) vs `hash(seed, i) < ½` (plan:741). The first depends on how many earlier slots were active, which cuts against "nothing depends on a previous slot".
17. **"The lowest in-game partial on speakers is 290 Hz" (plan:81)** is false: `mus.home` (232 Hz) plays in game on speakers.
18. **"V: the open fifth on F, with its ninth" (plan:262).** Partials 6, 9, 12 are F–C–F; there is no ninth of F. Evening's 5, 6, 10 is the tonic triad minus its root, which undercuts the "dominant → lament" narrative.
19. **The bed the score leans on still loops at 1 Hz.**
    - The wind bands and the pond read the 1 s `sharedNoise` loop (live/common.ts:15; ambience.ts:65–72, 90–95).
    - I simulated the wind bands (mulberry32(99), static centre): envelope range 9.4–9.8 dB, autocorrelation 1.00 at 1 s and 2 s.
    - The pond's "wander" (ambience.ts:84) is a 1 Hz ripple for the same reason.
    - The plan cites the buffer (plan:749) and couples the hum to the gusts, but neither fixes this nor lists it.
20. **ServerClock accuracy is asserted, not examined** (D-c, "tens of ms"). `offset()` takes the minimum of `serverNow − localNow` (clock.ts:44–57), which keeps the most-delayed of the last five samples. On jittery mobile links the error is the jitter, possibly hundreds of ms, not tens.
21. **Minor.** `serverNow` is at room.ts:184, not 183. Week-1 ordering stimuli do not say whether the `DARK_STEPS` level steps are applied; if they are, listeners can order by loudness alone.

**Must-fix to reach 8.5 (ranked)**
1. **Rebalance the hum against the pond.**
   - Recompute presence per partial with the real §4.1 levels and the real pond, wind and activity-envelope spectra: an actual third-octave computation, including the dry-wind bands.
   - Either flatten the voicings, raise the hum and lower the pond, or make #18 apply only to principal partials, and state the audibility cost.
   - Make the hum follow a public-only activity envelope (the `src` cues heard by `all`), or compute and gate the +1.5 dB in-play rise.
   - Give the hum a tracked, declared relation to wetness.
2. **Fix the wind–hum clash and the looping bed.** Move wind and pond onto non-repeating noise too (or list it as a required ambience amendment with its own #15). Then either keep the wind's resonances away from the sounding partials or keep the hum out of dry states' shared bands. Justify it by ear in the week-1 spike.
3. **Make sync total.** Put the hum's cut and the call's state on the same timebase. Either lock the slot state to presentation time for the cut's step, or delay slot activation until the local cut has landed. Add the backlog (≤2.5 s + 380 ms) as a listed divergence with a test. Add stall endings (no lay) and 2→0 jumps (with `mus.home` + podium precedence) to the state table.
4. **Restate the Law 1 window test correctly:** "the score is a pure function of public events and their broadcast `serverNow`". Test that no window field is read and that equal public timestamps give equal schedules. Declare the gust coupling in `SCORE_FIELDS`, or drop it.
5. **Fix the internal contradictions:**
   - repetition (use a fixed cycle per stage with rotating takes, or state the real minimum of 2 slots);
   - #20 vs the `mus.home` duck;
   - rule 3 vs call level;
   - the speaker subset rule;
   - "every state −0.24 dB".
6. **Rebuild the sound model where it touches realism.**
   - Slurs: a crossfade between partials with a brief noisy break, not a frequency glide.
   - Hum resonator bandwidth: derive from a real bore's Q, or a measured reference.
   - Hum noise: decorrelated per client.
   - Rhythm rule: add a small-integer-ratio check.
7. **Face the tonal-function problem.** Either establish B♭ during play (for example a faint partial 2/4 in the drone's residue), or reword "V → I" as a register and colour arc and let the week-1 test measure that.
8. **Re-budget from measurements.** Put the 8-harmonic cost (0.74 %) into the table, reset #23 or cut the legato voice's per-sample cost, and add the 16→48 kHz interpolation.
9. **Production:**
   - Give week 1 real days for recruiting and running the two listening tests and the device run.
   - Keep the listening-effort gate in every cut line (it protects R1, impact H), or say that cuts 1–2 ship lobby-only.
   - Put the `clients=6` tool wherever the agreement test is.
   - Overlap M-S2 with M-S1.
   - State what the recorded fallback's 9–12 phrases do to bags, repetition and the cadence tables.
10. **Fix the listening-effort statistics.** Use a mixed model with clip and listener effects, and at least 12–20 clip pairs. Use Romanian test material.

**Should-fix**
- #14 hum peak within 5 ¢: an argmax on a noise-driven 1.5 Hz-wide peak jitters by ±0.75 Hz (about 5.6 ¢ at 232 Hz). Use the spectral centroid within the band.
- Define R-f's "right third". Add decision rows for R-a-only and R-e-only failure.
- Phone payoff test: "did the music come home?" is leading and has no foil. Add a non-home control.
- The blindfold "rerun" has no baseline (SOUND_DESIGN D8: never run). Budget both arms.
- ServerClock: flag the estimator (it should take the maximum of the samples, i.e. the least-delayed one, plus half the RTT) as a dependency for D-c.
- Consultant: one hour cannot also source a tulnic player. Cost the sourcing.
- Lobby switch "Off": state the pond factor (2.2 or 1.6).

**What is strong**
- Law 1 treatment: the projection plus Proxy, per-slot pure functions (no cascade), the divergence table, and the no-main-thread-fallback argument against stutter tells.
- Most round-1 engineering defects are genuinely fixed: the loop, the renderer, the memory figure, the clock margin (A9), precedence, and the duck exclusions.
- An honest amendment table (A1–A12) and honest budget flags: JS 132 KB, and the recorded fallback shown over 220 KB.
- Arithmetic that mostly adds up: the loudest-state and lobby levels, the clock over the call, the milestone and cut-line sums, the 16 phrase lengths, the call-density estimates (dusk 5.6 %, night 14 %).
- The phone running Discord and the game at once is in the rig. The playtest is dedicated and counterbalanced, with pre-stated product rules and a lobby-only fallback.
- It stays centred on background music, as the brief asks, and is disciplined about what the score must never do (§4.4, §5.4).
