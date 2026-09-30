# Round 1 — review of MUSIC_PLAN.md v1 (6fad950)

*The critic's report, verbatim. It is model output from a separate agent briefed as a very harsh AAA game designer and audio director (1 = unusable, 6 = passable, 8.5 = AAA quality). Its three most concrete engineering findings — the 1 s shared noise loop under the hum, the renderer's per-note attacks, and the headphones clock margin of 0.2 LU — were confirmed against the code before v2 was written (`live/common.ts:11-15`, `render/horn.ts:64-110`, `tools/out/metrics.md`, "The clock over the bed").*

SCORE: 5.8/10

**Verdict**
This is a disciplined plan, and it is grounded in the repo more thoroughly than most music pitches I see. Almost every constant, file name, test name and budget it cites is real. The Law 1 work is close to production grade. The concept suits a voice-chat bluffing game: one natural horn on one fundamental, free rhythm, public-state-only, "silence with a key". But the continuous layer everything rests on, the hum, does not work as specified. The shared noise buffer it names is a 1-second loop, so the hum becomes a 10–15 dB amplitude pattern that repeats exactly once a second. That is the clock's rate, and it breaks the plan's own no-pulse and no-loop rules. The "wander" mechanism does nothing on the same buffer. The phrase renderer it calls "existing" has no legato. And the render cost I measured is about 5–6x the plan's budget. By the plan's own dB arithmetic, two of its own harness checks (clock over the bed, and the lobby window) would fail. On top of that, the state table contradicts itself: pool-dry voicing, the night-only accent, and answer cadences at night. Several "must pass" measures are either impossible to pass or mean nothing: a sample-identical rejoin, 10-cent accuracy from 40 ms FFT frames, and Whisper WER as a proxy for how hard talk is to follow. The harmonic arc, the plan's main musical claim, is oversold: the home pitch class sounds all game. I would not sign this for production. It needs one more revision focused on engineering and consistency, not a new concept.

**Sub-scores**
- **Musical concept & identity: 6.0/10.** The concept is coherent and culturally grounded: tulnic, doina free rhythm, cells taken from the call, and the podium as the one cadence home. It does not deliver the resolution it claims. Partials 2, 4 and 8 are all the tonic pitch class, and partial 8 sits in every in-game voicing (§4.1). The evening hum 5-6-8 is the tonic triad itself. So "home withheld all game" only means 232 Hz is withheld, and the payoff is a change of register, not of harmony. The "wind sings in the key" (§8.1) is hollow: the wind drifts ±12 % (about ±200 cents) and every gust multiplies it by 1.3 (+454 cents).
- **Adaptive design & gameplay fit: 5.5/10.** The state table is clear, driven only by public state, and changes cut on knocks. But the tension arc amounts to four drone voicings plus call density (80 → 60 → 40 s gaps) at bed level under speech, and whether that is perceptible at all is untested. Precedence rules are missing: gate vs last set, gate vs pool-dry, answers vs cadences. And the plan's own rules contradict each other (errors 5–8 below).
- **Respect for the existing design (and quality of amendments): 6.5/10.** The DESIGN §7.1 amendment is argued in the open. Splitting `world.dark.01` into a Table knock plus `mus.home` is a real improvement. But the plan also makes changes it never lists as amendments:
  - It exempts calls that play 10–25 times a game from the echo budget, whose only rationale is "heard once a game" (FEEL:482, cuesheet.ts:207–208).
  - It breaks FEEL §3.7's length-by-frequency bands (FEEL:607–609) and FEEL §3.3's "Only ambience sustains past 1.5 s" (FEEL:467).
  - It reuses the Tier R audio budget and the consultant hours, which are earmarked for other work, as if they were free.
- **Voice-chat / mix engineering: 5.5/10.** Good instincts: a speech-band ceiling, a sparser speaker arrangement, synchronised copies, and a gate on real players' behaviour. But:
  - The claim that suppressors strip the hum contradicts the repo's own model, which says "Tonal tails smear, and noise suppressors pass them" (FEEL:479).
  - "Consonant doubling" is oversold: with 100–500 ms offsets, note changes overlap as 7/8 and 10/11 clashes.
  - The phone that runs Discord and the game at the same time, the most common phone setup, is not in the test rig.
  - Check #19 fails on headphones by the plan's own numbers (error 3).
- **Secrecy (Law 1): 8.0/10.** Strong. There is a projection with a Proxy test, history tests for Squid, the nine hidden ranks and structural windows, no knowledge of turns, and seeds from public values. It correctly avoids the activity envelope. Remaining gaps:
  - The ceremony hold and the "finish a phrase within 1.5 s" rule run on client-local cue times, not server time.
  - The slow-device skip is asserted to be independent of game state but never tested. It could correlate with local private UI work, such as declaring a Squid in your own hand panel, and a skipped slot is audible over the call.
  - "Does not react to mode" is false: the duck on `power.reveal` happens only in Ascuns.
- **Technical feasibility & architecture: 4.0/10.**
  - The hum source is a 1-second loop (I simulated this), and the wander mechanism does nothing on it.
  - The renderer has no slur. Every note gets its own attack, scoop and lip burst.
  - Render cost is about 170 ms per phrase at 4x throttle against a 30 ms budget (measured).
  - The memory arithmetic is wrong.
  - The sync model mixes server time with presentation time, and a shuffle bag cascades after one mismatch.
- **Measurability: 5.0/10.** There are many checks, but several are badly posed:
  - #14 asks for 10 cents from 40 ms frames (25 Hz bins; the existing test tolerates 2.5 %, about 43 cents).
  - #21 asks for a sample-identical rejoin.
  - The WER gate uses Whisper, which is trained to ignore background music, and about 640 words is underpowered for a 2-point threshold.
  - The playtest A/B has three groups (an effective n of about 3, not 15), alternates order 2:1, and needs two 16–21-minute games inside 45-minute sessions.
- **Production realism: 5.0/10.**
  - The milestone table sums to 23.5 days; the "22–26" range does not reconcile with it.
  - The 9-day and 16-day cut lines do not add up from the milestones.
  - The composer needs the lab's Score panel (M-S6), which is built after composition (M-S1).
  - The recorded fallback is not costed.
  - 3 composer days to write 44 phrases as TypeScript data is optimistic.
  - No mix or tuning time is budgeted for an audio lead.
- **Grounding & accuracy: 6.5/10.** The repo facts are overwhelmingly right: `HORN_FUNDAMENTAL = 58`, `WIND_BANDS`, `DARK_STEPS` and its 25 ms ramp, `ServerClock` (minimum of five samples plus half the RTT), 126.0/125 KB, 107 KB, 13 checks, the 14.1–19.8 and 13.3–19.1 LU bed ranges, the test file names, and `room_update` carrying no time. There are real errors in the musical, arithmetic and code-capability claims (listed below).

**Factual errors and unverifiable claims**
1. **The hum is a 1 Hz loop (a pulse at the clock's rate).**
   - §3.5 (plan:193) specifies "One looped noise source (the shared buffer)". `sharedNoise` is one second long: `createBuffer(1, ctx.sampleRate, ctx.sampleRate)` (live/common.ts:15). A Q 60–110 band-pass on a 1 s periodic signal passes only about 4–6 spectral lines 1 Hz apart.
   - I simulated it (same mulberry32(99) buffer, RBJ band-pass, 48 kHz). The envelope varies by 9.8 dB (232 Hz, Q 60), 14.6 dB (348 Hz) and 12.8 dB (464 Hz), and repeats exactly every 1.000 s: the mean |env(t) − env(t+1 s)| is 0.000 dB.
   - That violates rule 3 and §3.2 ("no pulse") and §4.4 ("never plays a stored loop"), at exactly the 1 Hz of `clock.tick`.
2. **The "wander" cannot work as specified.** §3.5 says it is the "same mechanism as the pond's wander" (ambience.ts:84: noise → low-pass → gain → AudioParam). A 0.04–0.12 Hz low-pass on a 1 s periodic buffer outputs its DC mean plus a 1 Hz line attenuated by about 37 dB, so there is no slow random walk. With one shared source, the six wanders would also be correlated. The "≈ 20 nodes" count (plan:203) leaves out the per-partial scaling gains and any decorrelated sources.
3. **Check #19 fails on headphones by the plan's own numbers.** The measured clock over the bed on headphones is 10.2 / 10.2 / 10.3 LU (tools/out/metrics.md:158–160), a margin of 0.2–0.3 LU over the 10 LU gate. §6.1 (plan:376–379) raises the headphone bed by +2.1 dB and takes back only 1 dB via `BED_DB`, which leaves the clock at about 9.1 LU. The plan lists "the clock ≥ 10 LU over them" as a done criterion (plan:54) but never computes it.
4. **The lobby check (#17) fails by the plan's own numbers.** The lobby pond is 2.2x the game bed (ambience.ts:165), i.e. +6.85 dB, so the loudest wet state sits about 7.25 LU under the anchor on speakers (−35.1 LUFS vs −21, metrics.md:130) and about 6.45 LU on headphones. Adding the hum (+1.46 / +1.1 dB net) gives about 5.8 / 5.35 LU under. That is outside "≤ the in-game window + 6 dB", i.e. at least 6 LU under (plan:373).
5. **The pool-dry rule contradicts the table.** "Pool dry, any stage: the stage's voicing without its lowest partial" (plan:250). But the night-dry row (plan:249) drops partial 6 and keeps 5, the lowest.
6. **"Only the night may use" partial 11 (rule 1, plan:27–28, and plan:137) contradicts §8.1.** The dry wind is tuned to 638 Hz whenever the pool is dry. The pool runs dry with a median of 12 sets possible at 6p random and 6 at 6p memory (FEEL §1.1), i.e. in the evening, so the accent sounds before night.
7. **Night answers break the night cadence rule.** §3.6 says an answer is "usually the fall cell" 8→7→6 (plan:213), and A1 ends on 6 (plan:663). §3.4 forbids night phrases from ending on 6 (plan:183). Night has the most answers (1 in 2), so `phrases.test.ts` as specified (plan:538) fails. Evening has answers (1 in 3) but no answer library (plan:283–285).
8. **N2 is not a legal call.** A call is 3–7 s (plan:210), but N2 = 0.7 + 0.4 + 1.3 = 2.4 s (plan:661), and it is not an answer.
9. **Wrong acoustic-scale claim.** "Partials 8–12 form the acoustic scale — major third, raised fourth, fifth, sixth, minor seventh" (plan:140). Partials 8–12 give only 1, 2, 3, ♯4, 5. The sixth is partial 13 and the minor seventh partial 14, both outside the plan's range (4–12).
10. **Memory arithmetic.** "≤ 3 rendered phrases alive: ≤ 1 MB (≈ 450 KB each)" (plan:451). 3 × 448 KB = 1.34 MB.
11. **Render cost.** The budget is "≤ 30 ms per phrase at 16 kHz under 4× CPU throttle" (plan:450). I measured the repo's `renderHorn` on L1 (6.25 s) in Node 22 on this machine: 42.6 ms at 16 kHz *unthrottled* (100 ms at 32 kHz). That is about 170 ms at 4x, 5–6x over budget, and far over a `requestIdleCallback` slice.
12. **"Rendered by the existing `render/horn.ts`" overstates what the renderer can do.**
    - Every note gets its own attack (default 0.09 s, horn.ts:66), its own lip burst (horn.ts:110) and a default 50-cent scoop (horn.ts:85). There is no slur or legato, so §3.2's "every later note is a slur — no new attack" and check #15 need a new continuous-phase renderer.
    - The "low-pass capped at 900 Hz" is hard-coded as 500 + 600·open (horn.ts:89).
    - None of this is scoped in M-S0.
13. **"Worst-case repeats: none" (plan:283–285) is false by the plan's own gaps.** Night runs 5.5 min at a 30 s minimum gap, about 11 slots; evening 8 min at 45 s, about 10 slots; each stage has 8 phrases. That is the median case, not the worst case.
14. **The gate creak cannot mask a cut (rule 5, plan:39–41 and plan:251).** `amb.gate` measures −47.9 LUFS momentary max and a −49.5 dB peak (SOUND_DESIGN.md:603). It is on the Ambience bus at −20 dB (cuesheet.ts:156), i.e. quieter than the bed it is supposed to mask.
15. **"The same `onCeremony` envelope" (plan:272–274) is not a Music/Power-only envelope.** `onCeremony` fires for every `ex` cue (engine.ts:88), including `world.dark.12/.06` on Table (cuesheet.ts:124–125). Taken literally, the score ducks 10 dB for 600 ms, with a 1.2 s recovery, exactly when the new voicing is meant to "cut on the knock". The duck lasts 1.4 s at `.01`.
16. **"That envelope also reacts to `table.asked`" (plan:327–328) is false.** `table.asked` has no `env` (cuesheet.ts:103). Only `table.turn.you` is `'src'`. The conclusion still holds.
17. **"The ambience steps flat" (rule 5, plan:40) is only half true.** The pond → wind switch is a 400 ms equal-power crossfade (ambience.ts:33, 148–149), and the level uses `setTargetAtTime` with a 1.5 s time constant (ambience.ts:167).
18. **"The engine's `outputLatency` compensation" (plan:345–346).** `outputLatency` is used only to delay visuals (context.ts:123–132). Nothing compensates audio against server time.
19. **Sync model.** "The stage that held 2 s before the slot, by server time" (plan:340–343) is undefined. Events carry no server timestamp, only the broadcast `serverNow` (room.ts:184), while the hum's voicing cut runs on local presentation time. And "the only way two clients can disagree" is wrong. The ceremony hold, the finish-in-flight rule, the slow-device skip and shuffle-bag cascade after a single mismatch can all diverge.
20. **Game length.** "75–99 turns at the scene's 4.7 asks a minute" (plan:100) mixes turns (78–99) with asks (75–95). And 4.7 asks/min comes from a scripted bot scene (metrics.md:136). The whole library size depends on it.
21. **Recorded fallback (R2, plan:618).** "Opus mono 16 kHz ~24 kbps" departs from the repo's format spec, "Opus in WebM with an AAC fallback … 48 kHz" (FEEL:595), and has no Safari fallback. The 220 KB is "unused" only because Tier R has not happened; it is earmarked for it. A real tulnic will not sit on 58 Hz, so check #14 fails without pitch-shifting, which the plan does not mention.
22. **Unverified perceptual claim.** "A harmonic change … is the change the ear notices without attention" (plan:105–106) is asserted with no evidence. The hum sits 4 dB under a bed that is itself 12–20 LU under a knock that is under speech.

**Must-fix to reach 8.5 (ranked)**
1. **Rebuild the hum source.** Use a long, non-repeating noise source (≥ 30 s buffer, or per-partial decorrelated sources, or an AudioWorklet noise generator). Build the wander as a scheduled seeded random walk on the AudioParams, a pure function of absolute server time (which also makes rejoin deterministic). Add a harness check for amplitude-envelope periodicity (an autocorrelation peak in 0.3–3 s must stay below a threshold). Recount the nodes.
2. **Specify and cost a legato renderer.** One continuous-phase oscillator per phrase with pitch glides for slurs and one lip onset per phrase. Put it inside M-S0 with a measured budget.
3. **Re-plan rendering on real measurements.** Move rendering off the main thread (Worker or OfflineAudioContext), or pre-render the whole stage bag when the stage is entered. Set the budget from measured numbers, not "≤ 30 ms". Fix the memory figure.
4. **Rerun the level arithmetic for every state, lobby and clock included.** Specify how check #19 (headphones margin 0.2 LU today) and the lobby window survive. That probably means lowering the hum further, or a smaller headphone lobby multiplier, with the resulting loss in audibility stated.
5. **Make the state table consistent and total.**
   - Fix the pool-dry rule vs the night-dry row.
   - Make the accent rule consistent with the wind (either retune the dry wind per stage, or drop "night only").
   - Define precedence for gate vs last set, gate vs dry, and dry vs lobby.
   - Give evening its own answer set, and make answers obey the cadence table (or exempt them in the table).
   - Remove N2 or make it an answer.
   - Fix "worst-case" to "median" or enlarge the bags.
6. **Define one sync clock.**
   - Stage-at-slot comes from the broadcast `serverNow` of the message that changed `setsPossible`, with a rejoin rule.
   - Phrase choice is a pure function of (seed, stage, slot index from `startedAt`), so one mismatch cannot cascade.
   - The ceremony hold runs on server time too.
   - Then restate which divergences are possible, and test each one.
7. **Specify the duck precisely.** A score-only ceremony duck that excludes `world.dark.12/.06` (or state that it applies there, and justify it). Drop the gate creak as a "mask". Make gate changes either inaudibly slow or accept that they are audible.
8. **Replace the measures that cannot work.**
   - #14: long-window or phase-vocoder pitch tracking on phrases, and a long-term spectrum for the hum, with tolerances matched to the existing 2.5 % test or justified.
   - #21: "same schedule, voicing and take ids, and a level within X dB after the swell", not sample-identity.
   - WER: human listening-effort / intelligibility ratings (or ESTOI/HASQI on the rig recordings) with a power calculation. Keep Whisper as a secondary check.
9. **Rebuild the playtest design.** Count groups as the unit of analysis. Budget real session time (two games do not fit in 45 minutes). Counterbalance order properly. State decision rules without contradictions: §0 "no loss" vs §10.4 "−0.5", which is meaningless for integer medians. Add a direct perception probe for the arc ("did the music change? when?").
10. **List every departure as an amendment in §1.2**: echo budget for repeated calls, FEEL §3.7 bands, FEEL §3.3 sustain rule, swells vs "nothing cross-fades", the suppressor model (FEEL:479), and the reuse of the Tier R budget and consultant hours.
11. **Fix the production plan.** Reconcile the day totals and the cut lines with the milestone table. Move a minimal Score audition panel before M-S1. Cost the recorded-fallback path, including sourcing a tulnic player and retuning or pitch-shifting to 58 Hz. Budget audio-lead mix and tuning iterations after the playtests. Put the consultant's lead time on the critical path.
12. **Correct the factual errors** listed above (acoustic scale, `table.asked`, `outputLatency`, the ambience "flat" claim, turns vs asks).

**Should-fix**
- Face the "home" problem honestly: either keep partials 2 and 8 out of the hum until the last set (then the dusk and evening voicings need rethinking), or reword the claim as a change of register.
- Drop or rework the wind "in the key" item. At ±12 % drift and ×1.3 gusts it is not tuned. 640 → 638 Hz is a 5-cent change that no one will hear.
- Add the phone that runs Discord and the game at once (iOS voice-processing ducking, Android AEC) to the call rig.
- Make it testable that the slow-device skip cannot correlate with private UI activity (render in a Worker, and keep skips out of the Law 1 test's reach).
- Settings UX: "Music" plus "Background music" plus "Ambience" is one slider too many. Consolidate, or explain why not.
- Phone reproduction: the payoff note is 232 Hz, the band phones reproduce worst. Test the podium and last-set resolution on phone speakers specifically, not just "audible in a quiet room".
- The 20-minute 48 kHz offline render for #15 is heavy in headless Chromium (about 460 MB stereo). Render in chunks.
- The partial-6 "6-cent imperfection" is below the resolution of a narrow band-pass on noise, and the 2 kHz bell on a hum low-passed at 1.1 kHz does nothing. Remove the pretence.

**What is strong**
- Law 1 treatment: a `scoreInputOf` projection with a Proxy test, history tests over Squid, hidden ranks and structural windows, and "the score does not know a turn exists". Also the correct observation that the activity envelope is per-client.
- An honest amendment of DESIGN §7.1 with a playtest gate and a lobby-only fallback, mirroring how the ambience was decided.
- `world.dark.01` knock → Table plus `mus.home` → Music is a genuine fix for an existing flaw.
- Musical material derived from the one call players actually hear. Free rhythm chosen so it cannot be confused with the clock. A hard ban on stingers, argued properly.
- Budgets stated openly: the JS overage is flagged, not hidden. Risks and cut lines exist.
- Most repo facts check out exactly: constants, file and test names, budgets, measured LU ranges.
