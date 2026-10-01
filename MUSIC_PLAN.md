# Background music plan — Pescuiește Extins

**Status: plan v2; its engineering milestones are built (Appendix D).** The human-gated work — the composer's library,
the consultant, the week-1 listening tests, the call rig and the music playtest — is not done, so the score ships
**lobby-only by default** (D2) until the playtest decides. Appendix D lists every place the build departs from the text
below and why. It adds a background score to the game without breaking
any of the laws the rest of the sound was built on. It amends `DESIGN.md` §7.1 ("no music bed during play") and
eleven smaller rules, each listed in §1.2 with its reason. v1 was scored 5.8 / 10 by the critic
(`docs/music-plan-reviews/round-1.md`); Appendix C says what changed.

*Evidence: every claim about the current build was checked against the code on `claude/pensive-edison-28lk6g`:
`SOUND_DESIGN.md`, `DESIGN.md` §0.1, §1, §6, §7, §9, `FEEL_VISUAL_SOUND_PLAN.md` (FEEL) §0–§3 and §9–§11,
`DECISIONS.md`, `packages/client/src/audio/*`, `hooks/useLobbyAudio.ts`, `game/world.ts`, `packages/shared/src/protocol.ts`,
`packages/server/src/room.ts` and `packages/client/tools/out/metrics.md`. One number was measured for this plan: the
existing horn renderer (`render/horn.ts`) costs **0.57 µs a sample** in Node 22 on the build machine (10 renders of a
6.55 s phrase: 59 ms at 16 kHz, 183 ms at 48 kHz). Nothing in this plan has been heard by anyone; §10 says how and when
that changes, and the first gate is a listening test in week 1.*

---

## 0. The one-page version

**The idea.** The game already opens with a tulnic calling across a valley (`mus.start`: one natural horn, partials
of a 58 Hz fundamental, three darker repeats) and closes with the same horn coming home (`mus.podium`: partials
6 → 5 → 4). In between there is a pond, then wind, and ~24 knocks a minute. **The score is what happens in the
valley between the call and the return:** a horn left on the fence hums in the wind, and now and then another
shepherd answers from far away. One instrument, one fundamental, free rhythm, and it follows only the public count of
sets still possible. Harmonically the game is one cadence: the hum starts on the **dominant** (an open fifth on
partial 6), moves through the doina's lament (the third) to the night's unrest (the tritone and the natural seventh),
falls back to the dominant alone at the last set — and the **tonic** is not sustained once in play until the last
set's single note lands on it.

**The five rules the score reduces to** — the audio counterpart of the art's "two values, one accent":

1. **One instrument, one fundamental.** Every pitch is a partial of 58 Hz, 4 to 12 (232–696 Hz). The accent is
   partial 11 (638 Hz, the natural horn's "fa"), in the night's calls only. The tonic pitch class (partials 4 and 8)
   is **never sustained in play before the last set**: the hum never contains it, and a call may only pass through
   partial 8 (≤ 0.5 s, never first or last).
2. **Public, and the same on every client.** The score reads six public fields and nothing else (§5). Every phrase,
   take and slot is a pure function of a public seed, a server-time slot index and the public stage, so the five
   speakers on a call play the same phrase at the same moment, and one client's mistake cannot cascade.
3. **Under the table, never on it.** No transient, no pulse, no loop; nothing in the 1–4 kHz speech band louder than
   30 LU under the anchor knock; the pond plus the score sit exactly where the pond sits today (12–20 LU under the
   anchor). The knocks are the rhythm; the score has none.
4. **It never reacts to a turn.** No stinger on an ask, a give, a power or a window: the cues already do that, and a
   stinger on a window would voice one of the rules' own tells (FEEL §3.2). The score changes only at public world
   steps: the lobby, the call, 12, 6 and 1 sets possible, the stall gate, the finale.
5. **Re-voicings are cut on a loud knock; entrances breathe in.** A change of chord is a 25 ms ramp that starts on
   the transient of the table cue that already marks the step (`world.dark.*`, the miss that shuts the gate, the
   last lay's stamp) — the way the light steps. Only an entrance from silence swells, as a breath or a gust does.

**Done means** (§10):
- the score's schedule is identical on every client for the same public record, and for records that differ only in a
  hidden card, a Squid, a hidden rank or a structural window (Proxy field test + history tests); the six ways two
  clients *can* differ are listed and each is tested (§5.3);
- the audio harness grows from 13 checks to 23, all passing, including: no loop or pulse in the hum's envelope;
  every held note within 15 ¢ of its partial; the world stem unchanged from today within 0.3 dB; every hum partial
  audible in its own band; the clock ≥ 10 LU over the world and any call, on both profiles;
- in week 1, before anything is integrated: listeners judge the rendered horn "a real horn far away" (median ≥ 4/7)
  and order the four voicings from start to end of an evening (≥ 7 of 10 put dusk before night);
- no measurable cost to talk: in the call rig, listening effort with the score on is within 0.3 points (1–5 scale) of
  off, with the 95 % interval's upper bound ≤ 0.5;
- players keep it: in a dedicated counterbalanced playtest (4 groups, 20 players), ≥ 13 of 20 prefer the game with the
  score, and fewer than 5 switch it off — else it ships **lobby-only**, as the ambience would have shipped off.

**Effort:** 32 engineering days, 5 composer days, one extra consultant hour; +5 days and one recording session if the
week-1 listening test sends the calls to recorded horn (§11). Cut lines at 16 and 24 days (§11.3).

---

## 1. What the design already says, and where this plan stands

### 1.1 The constraints this plan keeps

| Rule (source) | How the score keeps it |
|---|---|
| **Law 1** — sound is a function of the public record (FEEL §3.2, DESIGN §9) | Six public inputs through one projection, Proxy-tested like `SOUND_FIELDS` (§5.1). No seat facts: the score does not know whose turn it is. |
| **Squid has no sound and no timing effect** (RULES §4, DESIGN §9.3) | Nothing the score reads can change with a Squid; a history test compares a lie with an honest "no" (§10.2). |
| **Structural windows are silent for everyone** (SOUND_DESIGN §4) | The score reads no window. It runs on server time, so a window's pause does not shift it either. |
| **Law 2** — the table talks; the call is part of the mix (FEEL §3.3–3.4) | Today's bed level kept exactly; a speech-band ceiling; slurred, slow-attack, synchronised phrases; a sparser speaker arrangement; a listening-effort gate on real call recordings (§6). |
| **The palette** — only Shark, Mantis, Whale leave wood/paper/ink/board/clay/water/rope (SOUND_DESIGN §1.3) | No new instrument: the tulnic already owns the Music bus (`mus.start`, `mus.podium`, the last-set note). The hum is aeolian resonance of that horn — resonant noise, the wind's own technique. |
| **Plank grammar and confusability** (FEEL §3.1) | No struck sound. One onset per phrase, ≥ 80 ms; every later note is a slur. The confusability check runs over the score (#15). |
| **Space: discrete repeats, not reverb** (`mus.start`'s valley) | Distance is level and low-pass; a far answer in headphones gets two discrete repeats. No reverb node. |
| **Nothing below 150 Hz is relied on** | The lowest in-game partial on speakers is 290 Hz (partial 5). |
| **Input never waits on audio** | The score is synthesised on the audio thread from a schedule posted ahead; nothing awaits it. |
| **0 KB of audio downloads** (README budgets) | Hum and calls are synthesised live. |
| **Audio is never the only channel** (SOUND_DESIGN §6) | Every state the score marks is already drawn and announced (`data-stage`, `a11y.stage.*`, the gate, the podium). |
| **Hidden tab, unlock, iOS audio session** (`context.ts`) | Unchanged; the score resumes where the server clock is. |

### 1.2 The amendments

| # | Source | Says now | This plan says | Why |
|---|---|---|---|---|
| A1 | DESIGN §7.1 | "No music bed during play … a continuous music loop is a liability." | A **tuned bed and distant calls** during play: no loop, no pulse, no transient, at today's bed level, identical on every client, on by default and **playtest-gated** (§10.5), lobby-only if it fails. | The liability is a *loop* competing with speech. §6 designs that out; §10 measures it. |
| A2 | FEEL §3.3 | "Only ambience sustains past 1.5 s" | The score sustains too, inside the same window as the ambience, which gives up 2 dB to make room (§6.1). | The world stem's loudness is unchanged. |
| A3 | FEEL §3.4 | The 250 ms echo budget for every all-client cue; `mus.*` exempt as "heard once a game" | The score is **not a cue** and is exempt, although its calls play 4–8 times a stage. Its protection against the call is different: no transient to flam, synchronised copies, a speech-band ceiling (#16), and the listening-effort test (§10.4). | The budget protects the first 250 ms of a knock; a 3–7 s slurred phrase has no "first 250 ms" to protect. |
| A4 | FEEL §3.7 | Length and level by plays per game | Not applied to the score (not a cue); its rate and length are set by §4.3, and its level by §6.1. | Bands were sized for event cues. |
| A5 | DESIGN §6.1 | "Nothing cross-fades" | Re-voicings are cuts (25 ms, on a knock). **Entrances from silence swell** (1.5–6 s); a phrase cut by a stage change fades in 300 ms. | A breath cannot start at full level. The ambience already crossfades pond → wind in 400 ms (`ambience.ts`). |
| A6 | FEEL §3.2, §3.4 | Tonal tails pass suppressors and smear | Kept as the working assumption: the plan assumes the hum and the calls **reach the call** from every speaker device, and designs for that (§6.4). | v1 wrongly assumed suppressors strip the hum. |
| A7 | FEEL §3.5 | Six buses | A seventh, **Score**, on its own stem, with its own duck and darkening gain (§7.1). | Measurable on its own; must not follow the per-client activity envelope (§5.1). |
| A8 | `cuesheet.ts` | `world.dark.01` (knock + partial-4 note) on the Music bus | The knock `world.dark.01` moves to **Table**; the note becomes **`mus.home`** on Music. | A music slider at 0 must not silence an informative knock. |
| A9 | `cuesheet.ts` | Clock bus: `speakerBoostDb` 4, nothing on headphones | **+2 dB on headphones** (a new `headphonesBoostDb`). | The headphones clock clears the bed by 10.2 LU against a 10 LU gate today (`metrics.md`); the score must not eat that margin (§6.1). |
| A10 | README / FEEL §3.6 | JS budget 125 KB (already 126.0); the 220 KB audio budget is reserved for Tier R | Score chunk ≤ 6 KB gzip → ≈ 132 KB (decision D4). If the recorded fallback is used it draws on the same 220 KB as Tier R (decision D8). | Both are stated, not hidden. |
| A11 | FEEL §11.8 | A 2–3 h consultant session on the palette and motifs | +1 hour for the score's library (§3.7), booked in week 1. | The library is new material. |
| A12 | Settings (`mixer.ts`) | Separate music and ambience sliders | The **Music** slider covers the ceremonies *and* the score; one new switch under it, "Background music: On / Lobby only / Off". No new slider. | Five sliders are enough; the switch is the choice players make. |

The v1 idea of tuning the wind to partials 5 and 11 is **dropped**: the wind drifts ±12 % (about ±200 ¢) and its gusts
move it +30 % (+454 ¢) by design, so a tuned centre would be inaudible.

---

## 2. Why the game needs a score

1. **The middle of the game has no line.** A game is 75–95 asks (78–99 turns, FEEL §1.1), about 16–20 minutes at the
   scripted scene's 4.7 asks a minute (`metrics.md`); humans are likely slower, and nothing below depends on the
   length (§4.3). The call lasts 8.3 s and the podium 2.5 s. Between them the only tonal sound is one bare note at the
   last set.
2. **The world arc is seen, not felt.** The light steps darker at 12, 6 and 1, and the ambience steps with it
   (`DARK_STEPS`: −1.5 dB and a lower low-pass per step). That is a change of level and timbre. Whether a change of
   *chord* carries "how close is the end" better is a hypothesis, tested in week 1 before anything is built on it
   (the ordering test, §10.3). FEEL §9.2's "I knew how close the end was" (median ≥ 5.5) is what it is for.
3. **The ceremonies are unconnected.** The call ends on partial 5 and the podium on partial 4, but nothing in between
   makes the return mean anything. With the score the tonic is withheld all game, so the last set's note is the
   first tonic since the lobby, arriving over the dominant — a V → I the whole game has prepared.
4. **The waiting room is a pond and nothing else.** Players wait there for minutes while the link goes round; it is
   where a fuller score costs nothing in play and where the game first says what it is.

---

## 3. The musical language

### 3.1 One instrument, one fundamental

The existing renderer (`render/horn.ts`, `HORN_FUNDAMENTAL = 58`) already makes every pitch `58 × n`, un-tempered.

| Partial | Hz | Pitch class over the tonic (58 Hz ≈ B♭, −8 ¢) | Role in the score |
|---|---|---|---|
| 2 | 116 | tonic | lobby warmth, headphones only |
| 4 | 232 | **tonic** | the lobby; `mus.home` at the last set; the podium's last note. Never in play before the last set. |
| 5 | 290 | major third, −14 ¢ | the evening's lament and the night's lower voice; the call's last note |
| 6 | 348 | fifth, +2 ¢ | **the dominant**: dusk's root, the last set's hum, most phrase starts |
| 7 | 406 | minor seventh, −31 ¢ | the night's unrest (a septimal tritone over partial 5) |
| 8 | 464 | tonic (octave) | passing note only in play (≤ 0.5 s, never first or last) |
| 9 | 522 | ninth (2nd), +4 ¢ | dusk's colour; the night's upper voice; the gate |
| 10 | 580 | major third, −14 ¢ | the evening's upper voice; the gate |
| 11 | 638 | "fa": 551 ¢ over the octave, half-way between 4th and ♯4 | **the accent**: night calls and answers only |
| 12 | 696 | fifth, +2 ¢ | dusk's ceiling |

Over 4–12 the pitch classes are 1, 2, 3, ≈♯4, 5, ≈♭7: six of the seven notes of what theorists call the *acoustic*
(overtone) scale, missing only the sixth (partial 13). Bartók reported that scale in Romanian folk melody; the
consultant (§3.7) confirms or corrects that before any claim is made in the game's own copy. The plan depends only on
the physics: a natural horn sounds these pitches and no others.

### 3.2 Free rhythm: no pulse, anywhere

The *doina* (on UNESCO's Representative List since 2009) is played in free, speech-like rhythm over a drone. That is
also the one rhythm that cannot be mistaken for a clock. The game's meaning-bearing rhythms are the seat signatures
(one knock, or two 75 ms apart), the clock (a click a second, then a double click every 500 ms) and the asked roll
(three taps). The score is forbidden all of them by construction:

- **No pulse.** Within a phrase, no three consecutive inter-onset intervals lie within ±10 % of each other, and no two
  intervals between 0.4 s and 1.1 s (the clock's range) lie within 10 % of each other. `phrases.test.ts` checks the
  written durations; harness check #15 checks the render.
- **No transient.** A phrase's first note swells over ≥ 80 ms (the call's lip attack is 90 ms). Every later note is a
  **slur** (§3.6): no new attack, an amplitude dip of at most 3 dB. The hum has no onsets at all.
- **No loop.** The hum's noise is generated, not read from a buffer (§3.5): its envelope has no period. Check #15
  fails on any envelope autocorrelation peak above 0.3 at lags of 0.3–3 s — the test that would have caught v1's
  1 s loop.
- **No meter across phrases.** Slot times are drawn from a seeded irregular distribution (18–42 s, §4.3).

### 3.3 The theme: three cells from the call

The call (`mus.start`) is 6 → 8 → 7 → 6 → 5. It is heard once per game at the most attentive moment, so the score
quotes it and players hear variations of something they already know.

| Cell | From the call | In play | Used most in |
|---|---|---|---|
| **leap** | 6 → 8 | 6 → (8, passing) → 9 or 12 | dusk, the lobby |
| **fall** | 8 → 7 → 6 | (8, passing) or 9 → 7 → 6 | evening, answers |
| **settle** | 6 → 5 | 6 → 5 | evening cadences |

The podium (6 → 5 → **4**) is the settle cell carried one step further: the step the score never takes.

### 3.4 Cadences: where a phrase may end

Data in `score/phrases.ts`; `phrases.test.ts` checks every call **and every answer** against it.

| Where | May end on | Tonic class (4, 8) | The feeling |
|---|---|---|---|
| Lobby | 4, 6, 8 | free | at home |
| Dusk (18–13) | 6, 12 | passing only | the dominant, open, outward |
| Evening (12–7) | 5, 6, 10 | passing only | the third: the doina's lament, nearer |
| Night (6–2) | 7, 9, 11 | passing only | unrest; the question open |
| The last set (1) | *no phrases* | `mus.home` (4) | the dominant waits; the tonic arrives once |
| Finale | the podium (4) | — | home |

Calls are 3–7 s; answers 1.5–3 s. Partial 11 appears only in night phrases.

### 3.5 The hum: the horn on the fence

**Source.** A tulnic resting on a fence with its bell to the wind: wind across a tube excites its resonances, so it
hums on its own partials — narrow-band noise, pitched but never steady.

- **Noise is generated, not stored.** Each sounding partial has its own counter-based noise: sample *n* is a hash of
  (seed, partial, *n*), where *n* counts samples from the score clock's zero. Nothing repeats, the partials are
  decorrelated, and a client joining late generates the same noise stream (it is a function of absolute time).
- **Resonators.** One two-pole resonator per partial, bandwidth 1.5 Hz (Q ≈ 155 at 232 Hz, ≈ 460 at 696 Hz): a
  pitch with a slow, random amplitude grain (correlation time ≈ 0.2 s) and no period. The spike (§11) tries 1, 1.5
  and 3 Hz by ear and by check #15.
- **Harmonic motion without notes.** Each partial's level wanders ±3 dB on seeded value noise over absolute time
  (knots every 8–25 s, smooth interpolation): the weight shifts between the chord's notes as a drone breathes.
  Because it is a function of absolute time it is identical on every client and after a rejoin.
- **With the wind.** When the pool is dry, the ambience's gusts (already scheduled in `ambience.ts`) lift the hum
  +2 dB with them, on the gust's own envelope.
- **Imperfection:** the grain itself. (v1's "6-cent dent" was below what a noise resonator can show and is gone, as is
  the 2 kHz bell on a signal that has nothing there.)
- **Level** follows `DARK_STEPS`' level column (0, −1.5, −3, −4.5 dB) through the Score stem's own step gain, so the
  hum darkens with the pond. The low-pass part of the step does nothing below 700 Hz and is not applied.

### 3.6 The distant calls: a legato horn voice

The existing renderer attacks every note separately (its own lip burst, scoop and attack per note, `horn.ts`), which
is right for the ceremonies and wrong for a slurred doina phrase. The score gets **one new voice**, `score/voice.ts`,
built from the same recipe but continuous:

- **One phase accumulator per phrase.** Each note is a target partial; a **slur** is an exponential glide of 45 ms to
  the next partial (a lip slur on a natural horn passes quickly), with a 3 dB amplitude dip over 30 ms and a +6 dB lift
  of the breath noise for 40 ms — the audible "break" of a slur, with no new attack.
- **One lip onset per phrase** (−26 dB under the body for distance, not the call's −20), then breath noise under the
  body throughout, rising toward the end of each held note (the call's breath-rise).
- **Per-note shape:** swell, sag (−15 to −45 ¢ over a held note), and the breath running out (`trim` 30–60 ms at a
  phrase's end only).
- **Distance:** the dynamics low-pass is a parameter (`horn.ts` hard-codes 500 + 600·open); calls cap it at 900 Hz,
  answers at 650 Hz. Harmonics are limited to 8 and to below 2 kHz after that low-pass.
- **Rate:** synthesised at 16 kHz inside the worklet and interpolated to the context rate (all content is under 2 kHz).
- **Answers** (a second, farther horn): −6 dB, starting 0.9–2.5 s after the call's last note begins, so the two
  overlap — heterophony, as tulnic players in the Apuseni play. In headphones a far answer gets two discrete repeats
  (−12 and −19 dB, low-passed 520 and 380 Hz, at +1.3 and +2.9 s), the valley's own shape from `mus.start`.
- **Placement** in headphones: near −0.35, far +0.55 (seeded per game). Mono and the speaker arrangement: centre.
- **Imperfection:** the lip's slow random walk (the call's, at 0.6 of its depth: a steadier, farther player).

The ceremonies keep `horn.ts` unchanged. Moving them onto the new voice is not in scope.

### 3.7 Cultural care

The game borrows the tulnic's *material and practice*, not a repertoire: the phrases are new, built from the call's
cells, and are not transcriptions of any tulnic signal. The consultant hour (A11) reviews the library, §3.4 and the
renders with three questions: does anything read as a specific ritual or funeral signal (tulnic calls were also used
at funerals); is the acoustic-scale remark right; would a tulnic player recognise these as playable. The library is
revised to the answers before it is frozen (M-S1).

---

## 4. The adaptive score

### 4.1 States and voicings

Stages are the world arc's, from `sets.possible` as `game/world.ts` computes them. Hum levels are dB re the state's
loudest partial; the whole hum's level is set by §6.1.

| State | Hum partials (dB) | Harmonic reading (over B♭) | Calls: slot activity, answers | Speaker arrangement |
|---|---|---|---|---|
| **Lobby** | 4 (0), 6 (−4), 8 (−9); headphones + 2 (−8) | I, at home | every slot for 3 min, then 1 in 3; answers 1 in 3 | 4 (−3), 6 (0), 8 (−6); every other active slot; no answers |
| **The call** | silence | — | none | same |
| **Dusk** (18–13) | 6 (0), 9 (−6), 12 (−12) | V: the open fifth on F, with its ninth | 3 in 8 slots (mean 80 s); no answers; none before 40 s | same partials; every other active slot |
| **Evening** (12–7) | 5 (−2), 6 (0), 10 (−8) | the third arrives: D–F, the lament | 1 in 2 (mean 60 s); answers 1 in 3 | same; every other active slot; no answers |
| **Night** (6–2) | 5 (−3), 7 (0), 9 (−6) | D–A♭–C: the septimal tritone, unrest | 3 in 4 (mean 40 s); answers 1 in 2 | same; every other active slot; answers 1 in 2 |
| **The gate** (stall shut) | 9 (0), 10 (−1) | a close whole tone: a held breath | none while shut | same |
| **The last set** (1) | 6 (−3) alone | V alone, waiting; `mus.home` (4) lands on it: **V → I** | none | same |
| **Finale** | silence from the last lay's stamp | the podium alone: 6 → 5 → 4 | none | same |
| **After the podium** | lobby voicing, 4 s swell, 6 s after `mus.podium` ends | I | lobby schedule | lobby |

**Precedence** (one state at a time): Finale > The last set > The gate > the stage (night, evening, dusk). The gate
therefore shows only before the last set; when it opens, the voicing returns to whatever stage is current.
**The pool running dry changes nothing in the score**: the ambience turns pond into wind (`table.poolEmpty`), and the
hum's only link to it is the gust lift (§3.5). The lobby is a separate phase with its own clock (§5.2).

### 4.2 Transitions: exactly where each change happens

| Change | Lands on | Loud enough to mask a 25 ms cut? |
|---|---|---|
| Dusk → evening, evening → night, → the last set | the transient of `world.dark.12 / .06 / .01` (Table, −2 dB / −2 dB / now Table, A8), on the beat `engine.worldAt` already uses for the light and `DARK_STEPS` | yes: −27.0, −26.6 and −14.0 LUFS momentary max as rendered (SOUND_DESIGN §9), against a bed 14–20 LU under the anchor; #20 measures the click ratio directly |
| Stage → the gate | the answering cue of the ask whose miss shuts the gate (with the pool dry, `table.gofish.dry`, `feel: 'answer'`), not `amb.gate` | yes; `amb.gate` (−47.9 LUFS) is too quiet and is not used |
| The gate → stage | the answering cue of the capture that throws it open (`table.give`) or the stamp of the lay (`table.lay*`) | yes |
| → finale | the last lay's stamp, the choreography's held beat | yes |
| Silence → dusk | a 6 s swell from 8.3 s after `GAME_STARTED` (the call's last repeat ends) | entrance: swells (A5) |
| Podium → lobby | 4 s swell | entrance |
| Rejoin, tab return | 1.5 s swell into the current state | entrance |

- A unit test (`scoreCuts.test.ts`) asserts that every step that changes the score's state carries the named cue in
  the same step (from the real presenter's output over bot games), so a cut never happens on silence.
- **A phrase in flight at a cut** finishes if ≤ 1.5 s remain, else fades over 300 ms.
- **Ducks** are per cue, in the cue sheet (`scoreDuckDb`, a new field), and explicit: −10 dB under `power.shark`,
  `power.mantis`, `power.whale`, `power.reveal` (their existing `duckMs`); −6 dB under `mus.home`. **No duck under
  `world.dark.12/.06`** — they are the cut points, and v1 would have ducked 10 dB exactly where the chord changes.
  `power.reveal` plays only in Mode Ascuns, so the score *does* differ by mode there; the mode is public, and the
  duck follows a public cue.
- **The horn never talks over the horn:** no slot may start within 10 s after any Music-bus cue ends (§5.2 says how
  that is decided on server time).

### 4.3 How often, and how long before a phrase repeats

**Slots, not stage timers.** From the score clock's zero, candidate slots fall every 18–42 s (seeded, uniform; mean
30 s). Each slot is *active* with the probability of the stage that holds it (§4.1), so the gaps between calls are
irregular multiples of irregular gaps. Stage length does not enter anywhere.

**No repeats by construction.** A stage's bag has 10 calls. The phrase for global slot *i* in stage *s* is
`perm(seed, s, ⌊i / 10⌋)[i mod 10]`, with the permutation of each pass re-drawn if its first phrase equals the
previous pass's last. So **no phrase recurs within 10 consecutive slots — at least 3 minutes, about 5 on average — in
any stage and any game length**, and a recurring phrase takes a different ornament take (3 per phrase: scoop depth,
sag, trim). Expected calls per stage in a 16–20 minute game: dusk 4–7, evening 5–8, night 4–8.

**Time with a call sounding** (headphones): dusk ≈ 6 %, evening ≈ 8 %, night ≈ 14 % of the stage (mean call 4.5 s,
plus answers). On speakers, half that. The rest is the hum under the table.

### 4.4 What the score never does

- plays on a turn, an ask, an answer, a power, a window, a clock tick, a join or a press;
- reads whose turn it is, "you", the mode, the player count, a hand, a grant or a window;
- sustains the tonic in play before the last set, or uses partial 11 outside the night;
- has a pulse, a transient, a loop, or a note above 696 Hz;
- starts a phrase within 10 s of a ceremony;
- blocks, delays or is awaited by anything.

---

## 5. Law 1: the score is public

### 5.1 What it reads — `SCORE_FIELDS`

`scoreInputOf` (in `audio/score/input.ts`) copies these fields into a fresh object, exactly as `soundInputOf` does for
the cues (SOUND_DESIGN §3), and nothing after it can read anything else.

| ID | Field | Public because |
|---|---|---|
| S1 | the phase: lobby / game / ended (`room_update.started`; `GAME_STARTED` and `GAME_ENDED` by `type`) | everyone sees it |
| S2 | `setsPossible` | V6: one number for every viewer |
| S3 | `endPressure.misses`, `.limit` | V7 |
| S4 | the `serverNow` of the broadcast that carried each change of S1–S3 | `broadcastState` computes it once per broadcast for every player (`room.ts:183`) |
| S5 | the score clock's zero: `startedAt` (new, §7.3); in the lobby, `createdAt` | a timestamp, the same for all |
| S6 | the seed: a hash of the room code and S5 | public; independent of the deal's CSPRNG |

Plus the cues this client plays that carry a `scoreDuckDb` (§4.2) or are a cut point (§4.2) — all `heard: 'all'`.
The score does **not** follow the ambience's table-activity envelope: that envelope also reacts to `table.turn.you`
(`heard: 'you'`, `env: 'src'`, `cuesheet.ts`), which differs between clients.

**Forbidden, asserted by the Proxy test:** SOUND_DESIGN §3's forbidden list, plus `players`, `currentPlayerId`,
`facts.playerId`, `mode` / `config.powerVisibility`, `window` / `pendingWindow` (any field), `poolCount`, `scores`,
`winners`, `laidSets`, and the room `seq`.

### 5.2 One clock, one schedule

- **Slot times** are `T_i = zero + Σ gaps` (seeded), in server milliseconds.
- **The state of slot *i*** is decided at `T_i − 2 s` from the S1–S3 values of the latest broadcast whose `serverNow`
  is ≤ `T_i − 2 s`. Every client holds the same broadcasts with the same `serverNow`, so every client that has
  received them by then decides the same.
- **The phrase, take, activity, speaker-subset and answer** of slot *i* are pure functions of (seed, state, *i*)
  (§4.3). Nothing depends on a previous slot's outcome, so one mismatch cannot cascade.
- **The ceremony hold** is decided the same way: slot *i* is silent if a Music-bus ceremony's broadcast `serverNow`
  plus its beat offset and length plus 10 s is later than `T_i`.
- **Ordering with the cut.** A stage-changing broadcast at `S` is presented at `S` + delivery + the notch beat (≈ 0.4 s
  of choreography), so its cut lands before any slot it governs (≥ `S` + 2 s) whenever delivery is under ~1.5 s.
- **Output alignment.** Events are posted to the worklet ahead of time at `T − serverOffset − outputLatency`, so the
  sound leaves every speaker at server time `T` within `ServerClock`'s error. (Today `outputLatency` delays only
  visuals, `context.ts`; this is new, and only for the score.) The hum's voicing cuts, which follow a knock, stay on
  presentation time like the knock.
- **Rejoin, hidden tab:** a snapshot carries the current S1–S3 and its `serverNow`; the schedule from `now + 2 s`
  follows. Nothing is replayed.

### 5.3 Every way two clients can differ

None of these depends on anything private; each has a test or a measurement.

| # | Divergence | Size | Test |
|---|---|---|---|
| D-a | A broadcast arrives more than ~2 s after its `serverNow` on one client: that client decides one slot on the older state | one slot | agreement test with injected delay up to 3 s |
| D-b | A phrase in flight at a cut: finish-or-fade is decided on presentation time | ≤ 300 ms of a fade | agreement test reports the spread |
| D-c | Device timing: `ServerClock` error, Bluetooth `outputLatency` not reported by the browser | tens of ms; up to ~200 ms on Bluetooth | measured on the rig (§10.4) |
| D-d | Rejoin or tab return: a 1.5 s swell | 1.5 s | #21 |
| D-e | No AudioWorklet: no score on that client, for the session | whole session | engine test |
| D-f | Profile (speaker plays half the calls), mono, volume, mode switch | device settings | none needed: settings, not game state |

**Why a stutter cannot become a tell.** The score is synthesised on the audio thread from a schedule posted seconds
ahead; the main thread only computes schedules. A heavy main-thread moment (say, a player opening their Squid in their
own hand panel) cannot delay it. There is no main-thread fallback: a `ScriptProcessor` score would tie its timing to
exactly that work (D-e instead). The spike's device run records a phrase while the player works through the private
panels and checks the recording for dropouts (§10.3).

### 5.4 Why no stingers

A stinger on a power is redundant — every power already has a cue — and hazardous nearby: a stinger on a *window*
voices the rules' own tells (A6), and a stinger timed to a player's *pause* turns a deliberation into a sound. The
rule that is safe everywhere is §4.4: the score does not know a turn exists.

---

## 6. Law 2: under the voice

### 6.1 Level, with the arithmetic

Reference values from `tools/out/metrics.md`: anchor −21 LUFS (speaker) and −25 LUFS (headphones); the bed's
short-term max in the loudest state −35.1 and −38.3 LUFS; the clock over the bed 14.5 and 10.2 LU.

| | Speaker | Headphones | How |
|---|---|---|---|
| Pond / wind in play, score on | −2 dB | −2 dB | a score-on factor on the ambience level |
| Hum | −3 dB re the pond at its new level | same | Score stem gain, set by the harness |
| **World stem** (pond + hum), loudest state | −35.1 − 2 + 1.76 = **−35.3 LUFS** (14.3 LU under) | **−38.5** (13.5 LU under) | 10·log(1 + 10^−0.3) = 1.76 dB; every state moves by −0.24 dB, so today's 12–20 LU window holds |
| Clock over the world | 14.5 + 0.24 = **14.7 LU** | 10.2 + 0.24 + 2 (A9) = **12.4 LU** | |
| A distant call, momentary max | ≤ −33 LUFS (12 LU under the anchor) | ≤ −37 LUFS | #19 |
| Clock over a call | clock ≈ −20.6 → **≥ 12.4 LU** | clock ≈ −26.1 (with A9) → **≥ 10.9 LU** | #19 |
| **Lobby** world stem (no anchor plays there; the anchor is the reference) | the lobby factor drops 2.2 → 1.6 (+4.1 dB over the game bed) and the hum sits −2 dB under it: −35.1 + 4.1 + 2.1 = **−28.9 LUFS (7.9 LU under)** | −38.3 + 6.2 = **−32.1 (7.1 LU under)** | today the lobby pond alone is 7.25 (speaker) and 6.45 LU (headphones) under; v1's figures failed this, these do not |
| Lobby calls | ≤ 6 LU under the anchor | same | #22 |

These are estimates from today's measurements; the harness sets the final gains ("measured, not set", FEEL §3.3).

**Is the hum audible at all?** The pond is noise low-passed at 500 Hz; a hum partial concentrates its energy in 1.5 Hz.
With the hum 3 dB under the pond and split over three partials, each partial carries about −7.8 dB of the pond's
power; the pond's share in a third-octave band near 300–350 Hz is roughly −8 dB of its total. So each lower partial
stands about level with the noise in its own band, and above 500 Hz, where the pond rolls off, clearly over it. A tone
is audible in noise down to about −4 dB in its band (the critical ratio), so the hum should be **heard as a pitch
without being loud**. Check #18 measures it (≥ 0 dB per partial in its third-octave band); if it fails, the split
between pond and hum moves, the world stem's total does not.

### 6.2 Spectrum

- No note above 696 Hz; calls are low-passed at 900 Hz, answers at 650 Hz, the hum at 1.1 kHz. The 1–4 kHz band, where
  intelligibility lives, is left nearly empty (#16: ≥ 30 LU under the anchor on speakers, ≥ 28 on headphones).
- The score shares 100–1000 Hz with speaking voices. That is the honest cost of a tonal bed, paid with level (today's
  bed level, 12–20 LU under a knock that is itself under speech) and stillness (the hum changes chord five times a
  game, plus two for each stall). The listening-effort test (§10.4) decides whether it is enough.

### 6.3 The two arrangements

| | Speaker (default) | Headphones |
|---|---|---|
| Hum | the stage's partials (all ≥ 290 Hz in play; the lobby's partial 4 at −3 dB) | the stage's partials; partial 2 in the lobby |
| Calls | every other active slot, the same subset on every speaker device | every active slot |
| Answers | night only | per §4.1 |
| Repeats on answers | none (the call makes its own) | two discrete repeats |
| Pan | centre | near −0.35, far +0.55 |

### 6.4 The call, honestly

Following the repo's own model (FEEL §3.2, §3.4): tonal sound passes voice-chat suppressors, so both the hum and the
calls will reach the call from every speaker device, 100–300 ms late.

- **The hum's copies** are the same partials; a late copy of a slowly wandering drone is a slightly thicker drone.
- **The calls' copies** are the same phrase. At a slur, a copy 100–500 ms late briefly sounds the old partial against
  the new one — 7 against 8, 10 against 11 — for up to half a second. That *is* a clash, heard as heterophony, the way
  two tulnic players overlap; it is not presented as harmless. It happens at most once every ~30 s at night on
  speaker devices, at 12 LU under the anchor.
- **The phone that runs Discord and the game at once** is the common case and is in the rig (§10.4): iOS's voice
  processing may duck other audio while the microphone is open, and Android's echo cancellation may remove some of
  the game's own sound from its microphone. Both change what the score costs, in opposite directions.
- **The switch** (A12) and the playtest gate (§10.5) leave the in-game default to the players' own choices.

---

## 7. Architecture

### 7.1 Files

```
packages/client/src/audio/score/
  input.ts     scoreInputOf + SCORE_FIELDS (the projection, §5.1)
  plan.ts      PURE: (ScoreInput history, seed, zero) -> slots (time, state, phrase, take, answer, subset) and cuts; Node-tested
  phrases.ts   DATA: the library (partial, dur, sag, trim, gain per note), the cells, the §3.4 cadence table
  voicing.ts   DATA: §4.1 (hum partials and levels per state and profile, slot activity, answer odds)
  synth.ts     PURE DSP, no Web Audio: counter noise, resonators, value-noise wander, the legato horn voice (§3.5-3.6)
  worklet.ts   the AudioWorkletProcessor that runs synth.ts, shipped as a Blob exactly as audio/worklet.ts ships dynamics.ts
  index.ts     the Score class: posts slots, cuts and ducks to the worklet ahead of time; owns the swell/fade rules
```

- **Engine:** a `Score` beside `Ambience`: `engine.setScore(input)`, fed by the presenter at the beats of `worldAt` and
  by `useLobbyAudio` in the waiting room.
- **Mixer:** Score bus → duck gain (per-cue `scoreDuckDb`) → step gain (`DARK_STEPS` levels) → its own stem with the
  profile EQ → the sum before the limiter. It does not pass the ambience's activity envelope.
- **Voices:** the worklet is one node; it holds the hum and at most two phrase voices (a call and its answer). It
  never enters the voice pool and cannot steal a table cue.
- **Settings (A12):** `scoreMode: 'on' | 'lobby' | 'off'`, default `'on'`, persisted with the rest behind try/catch;
  the Music slider scales ceremonies and score. Three strings in RO and EN (`copy.test.ts`).
- **Metrics** (`?metrics=1`): `score.turnedOff`, `score.lobbyOnly`, `score.modeNow`.
- **The harness** runs the same `synth.ts` offline (the pattern `dynamics.ts` already follows), in 60 s chunks.

### 7.2 Budgets

| Budget | Value | Basis |
|---|---|---|
| Audio download | 0 KB | all synthesised |
| JS | ≤ 6 KB gzip, a lazy chunk fetched after the audio unlocks | ~56 phrases × ≤ 7 notes of data; the DSP is small |
| Audio-thread CPU | ≤ 1.5 % of a core on the build machine in the worst moment (hum + call + answer) | measured: the existing renderer costs 0.57 µs a sample; at 16 kHz a voice is ≈ 0.9 % of a core, trimmed to ≤ 8 harmonics under 2 kHz ≈ 0.5 %; six resonators and their noise ≈ 0.3 % (estimate, measured in the spike) |
| On a mid-range Android (≈ 4× slower) | ≤ 6 % of a core; no audible glitch in a 20-minute game | spike device run |
| Memory | a few KB of state; no rendered buffers | real-time synthesis |
| fps during a six-player whale | ≥ 55 (the existing gate) | `perf:check` with the score on |

**The JS budget is already over** (README: 126.0 KB against 125). The chunk takes a played game to ≈ 132 KB. Decision
D4 asks for the line to move, or for an offsetting cut first. The lobby's initial load (107 KB) is untouched.

### 7.3 Protocol

- `startedAt` (server ms) in the game view, set once when the game starts.
- `serverNow` and `createdAt` on `room_update`, which today carries no time (`protocol.ts`).

Both are timestamps, identical for every viewer, and independent of the deal's CSPRNG. Tests: the redaction tests assert
they are byte-identical in every viewer's message; the RNG wire test is rerun.

---

## 8. The rest of the soundtrack, in the same key

1. **`world.dark.01` split (A8).** The knock stays `world.dark.01`, now on Table; the bare partial-4 note becomes
   `mus.home` on Music, 0 ms after it. `ECHO_EXEMPT`, `soundtwins.test.ts` and the cue-sheet test follow.
2. **Home is a rule in data.** A unit test fails if any in-play phrase sustains partial 4 or 8 (§3.4), if the hum's
   in-play voicings contain partial 2, 4 or 8, if `mus.start` ends anywhere but partial 5, or if `mus.home` and
   `mus.podium` end anywhere but partial 4.
3. **The headphones clock gets its margin back (A9).** +2 dB on the Clock bus in headphones: from 10.2 LU over the bed
   today to about 12.4 with the score on. This is an improvement in its own right.
4. **The seat planks are not retuned.** A 180, B 320, C 620 Hz sit near partials 3, 5.5 and 11 — tempting, and wrong:
   their job is identity, measured by confusability and (not yet run) the blindfold test, and they are struck,
   inharmonic bars that do not read as pitches in a key.
5. **The podium is unchanged** — bare, one breath, 6 → 5 → 4. What changes is what it means: after `mus.home`, it is
   the only cadence to the tonic in the whole game.

---

## 9. Tooling

- **Week 1 (in the spike):** a minimal Score panel in `?lab=audio` (development only): pick a state and a profile, hear
  the hum; type a phrase in Appendix A's notation and hear it on the legato voice. The composer works here from day 1.
- **With the engine:** the full panel — a timeline of slots (which phrase, which take, which slots the speaker
  arrangement skips), "jump to server time", a 10× walk through the stages with the real `world.dark.*` knocks,
  per-partial meters, and a check-run of `phrases.test.ts` on the typed phrase.
- **`?table=bots&clients=6`** (new): six presenters on one bot-table engine with injected delivery jitter, for the
  agreement test.

---

## 10. Measurement

### 10.1 The audio harness: 13 checks become 23

`npm run audio:check` renders the score through the product's chain in 60 s chunks. The existing 13 must still pass
with the score on; the calibration is regenerated.

| # | Check | Pass |
|---|---|---|
| 14 | **The key** | hum: long-term spectrum over 60 s, each partial's peak within 5 ¢ of `58 × n`; phrases: held notes only, their stable middle ≥ 300 ms, parabolic-interpolated FFT, within **15 ¢** of their partial (the existing `horn.test.ts` allows 2.5 %, ≈ 43 ¢, from 40 ms frames; the longer window is what makes 15 ¢ measurable) |
| 15 | **No pulse, no transient, no loop** | onsets: no rise faster than 80 ms to within 6 dB of a note's peak; slurs dip ≤ 3 dB; no three consecutive inter-onset intervals within ±10 %; hum envelope autocorrelation ≤ 0.3 at every lag 0.3–3 s; the confusability check over the score's onsets vs seat signatures, the clock and the asked roll: zero violations |
| 16 | **Speech room** | the score's 1–4 kHz short-term max ≥ 30 LU (speaker) / 28 LU (headphones) under the anchor |
| 17 | **The world window** | pond or wind + hum, short-term, 12–20 LU under the anchor in every state (6 score states × wet/dry × 4 darkening steps where they apply × 2 profiles), and within 0.3 dB of today's value for the same pond state |
| 18 | **Presence** | every hum partial ≥ 0 dB over the pond or wind in its own third-octave band, in every state |
| 19 | **Distance and the clock** | every call's momentary max ≤ anchor − 12 LU; every Clock cue ≥ 10 LU over the world stem and over any call, both profiles |
| 20 | **Cuts land on knocks** | each voicing change's 10–90 % ramp is 10–35 ms, starts within 5 ms of its cue's onset, click ratio ≤ 1.5; no score duck is active at a cut |
| 21 | **Rejoin equals staying** | a render entered at *t* = 137 s has the same slots, phrases, takes and voicing as the full render, and after its 1.5 s swell its short-term level is within 1 dB of it |
| 22 | **The lobby** | world stem ≥ 7 LU under the anchor; calls ≥ 6 LU under |
| 23 | **Cost** | the worklet's DSP renders 60 s of the worst state ≥ 70× faster than real time in headless Chromium on the build machine (≤ 1.43 % of a core) |

### 10.2 Unit and leak tests

- **`scorefields.test.ts`**: `scoreInputOf` over a Proxy record stuffed with every forbidden field; fails on any read
  outside `SCORE_FIELDS`, and a second test proves the spy can fail (the `soundfields` pattern).
- **Histories** (reusing `presentation-leak.test.ts`'s real engine games): an honest no vs a Squid deny vs a Squid
  claim; a hidden power set of each of the nine ranks; the five structural-window histories with and without the
  window — identical slots, phrases, takes, cuts and ducks.
- **`plan.test.ts`**: purity; the same schedule in Node and the browser build; **no cascade** (forcing one slot's state
  to differ changes that slot only); precedence (§4.1); the ceremony hold on server time.
- **`phrases.test.ts`**: §3.4 for calls and answers; range 4–12; partial 11 at night only; tonic class passing-only in
  play; calls 3–7 s, answers 1.5–3 s; the no-pulse rule on written durations; every bag has 10 calls.
- **`scoreCuts.test.ts`**: every score state change coincides with its named cue in the same presenter step (§4.2).
- **Agreement**: six presenters, 50 bot games, 0–300 ms delivery jitter: ≥ 99 % of slots identical on all six; with
  up to 3 s injected on one client, only the slots D-a predicts differ.
- **`soundguards.test.ts`** extended: nothing in `score/` imports a hand, a grant, a window or `SeatFacts`; no input
  path awaits the score.

### 10.3 Week 1: the spike's two go/no-go tests

- **Realism.** Five listeners hear the rendered distant call and hum next to a reference recording of a real tulnic at
  distance. Median "sounds like a real horn far away" (1–7) ≥ 4, else the calls go to recorded horn (D8) before
  anything else is built on them.
- **Does harmony carry the arc?** Ten listeners hear 20 s of the dusk, evening, night and last-set voicings with the
  pond or wind at game level on laptop speakers, shuffled, and order them "from the start of an evening to its end".
  Pass: ≥ 7 of 10 put dusk before night, median Kendall τ ≥ 0.5. If it fails, the arc is carried by call density and
  cadence alone, the voicings are revised once, and if they fail again the plan stops claiming that the score tells
  players how close the end is.
- **Private-panel dropout run** (§5.3): on a mid-range Android, record the output while a player works through their
  hand, the ask sheet and the answer plank during a phrase; no dropout.

### 10.4 The call rig and the listening tests

- **The rig** (FEEL §7.5, not built yet; costed in §11): five clients in one Discord call, noise suppression on and
  off, a headset recorder; **one iPhone and one Android each running Discord and the game at once**.
- **Listening effort** (primary): two readers read Harvard sentences over a game in progress, score on and off. From the
  recordings, 6 matched on/off clip pairs per condition; 10 listeners rate listening effort (1–5) on each pair: 60
  paired ratings. Pass: mean difference ≤ 0.3 with the 95 % interval's upper bound ≤ 0.5. (With a paired standard
  deviation of ≈ 0.8, 60 pairs give a half-width of ≈ 0.2.)
- **ESTOI** on the same recordings against the readers' close microphones (secondary): Δ ≤ 0.03. An ASR word error
  rate is reported but decides nothing: ASR models are trained to ignore background music.
- **Blindfold, rerun with the score on** (FEEL §9.3): seat, outcome and "tell the clicks" no lower than with it off.
- **Phone speaker, including the payoff:** on three phones at 50 % volume, the last-set `mus.home` and the podium's
  final 232 Hz note are identifiable ("did the music come home?") by ≥ 4 of 5 listeners; the calls are undistorted at
  full volume.

### 10.5 The playtest: dedicated and counterbalanced

The FEEL §9.2 rounds (45 minutes, one game) cannot hold an A/B of two 16–20 minute games. So the score gets its own:

- **4 groups × 5 players (20)**, 75-minute sessions, two games each; order AB, BA, AB, BA. Each group has at least one
  iPhone, one Android, and at least two players on speakers. In the FEEL rounds before this, the score's default is
  lobby-only, so the two studies do not contaminate each other.
- **The unit of analysis is the player, reported per group.** Four groups cannot support significance claims; the
  rules below are product decisions stated in advance, not tests.

| # | Measure (after each game, and once at the end) | Rule |
|---|---|---|
| R-a | "Which game's sound would you keep?" | ≥ 13 of 20 choose the score |
| R-b | "The table feels alive" (1–7) | more players rate the score game higher than lower, by ≥ 6 |
| R-c | "I always knew what just happened" (1–7); observer's whose-turn confusions | ≤ 3 of 20 rate the score game ≥ 2 points lower; confusions with score ≤ without |
| R-d | "The music got in the way of talking" (1–7) | ≤ 3 of 20 answer ≥ 5 |
| R-e | switched the in-game score off or to lobby-only (`?metrics=1`) | fewer than 5 of 20 |
| R-f | "Did the music change during the game? When?" (arc probe) | ≥ 10 of 20 report a change and place it in the right third |

**Decisions.** All of R-a–R-e pass → ship on. R-c or R-d fails → **lobby-only** default. Only R-b or R-f fails → ship
on, drop the "hear the end coming" claim, revisit the voicings in the mix pass. **A result carried by one group** (three
groups one way, one the other, deciding the outcome) → lobby-only until a fifth group is run.

---

## 11. Production plan

### 11.1 Milestones

| Milestone | Content | Eng. days |
|---|---|---|
| **M-S0 Spike** | `synth.ts` hum (counter noise, resonators, wander) in the worklet, and the minimal lab panel (3 d); the legato voice and its cost measurement (2 d); the §10.3 tests | 5 |
| **M-S1 Composition** | composer writes 56 phrases (40 calls, 16 answers, 3 takes each) in the lab panel over 5 days; consultant hour at the end; one engineering day to fold in the revision | 1 (+ composer 5) |
| **M-S2 Engine** | `input.ts`, `plan.ts`, `index.ts`, Score bus and stem, cuts, ducks, swells, rejoin, output alignment, settings, metrics, strings (4 d); calls and answers in the engine (2 d) | 6 |
| **M-S3 Protocol** | `startedAt`; `room_update.serverNow/createdAt`; redaction and RNG tests | 1 |
| **M-S4 Same key** | §8.1–8.3: `mus.home` split, the home rules, the headphones Clock boost, recalibration | 1 |
| **M-S5 Harness and tests** | checks 14, 15 (hum), 16–23 and the hum-side tests (4 d); phrase-side checks, `phrases`, agreement (2 d) | 6 |
| **M-S6 Lab** | the full panel with the phrase check-run (1 d); `?table=bots&clients=6` (1 d) | 2 |
| **M-S7 Call rig and listening** | the rig (2 d); listening effort, ESTOI, blindfold rerun, phone-speaker payoff (3 d) | 5 |
| **M-S8 Music playtest** | recruiting, four sessions, analysis | 2 |
| **M-S9 Mix and tuning** | the audio lead's pass after the playtest: levels, voicings, the call-density table | 3 |
| **Total** | | **32**, composer 5 |

**If the week-1 realism test fails (D8):** the calls use recorded tulnic: the consultant finds a player (lead time
2–4 weeks, a session at FEEL §3.6's €300–600), 12 phrases are recorded, and the whole score is **retuned to the
recorded instrument's fundamental** (one constant, `HORN_FUNDAMENTAL`, which the ceremonies share) rather than
pitch-shifting the recordings. Files follow FEEL §3.6's format (Opus in WebM with an AAC fallback, mono, 48 kHz),
at ≈ 48 kbps ≈ 6 KB/s × 12 × 4 s ≈ 290 KB — **over** the 220 KB budget, so either 9 phrases (≈ 215 KB) or a lower
bitrate after a listening check; and the 220 KB is then shared with Tier R. +5 engineering days (editing, integration,
retune, checks), plus the session.

### 11.2 Critical path

Week 1: book the consultant (lead time is the risk) and start M-S0. Then M-S0 (5) → M-S1 (composer 5, eng 1) →
M-S2 (6) → M-S5 (6) → M-S7 (5) → M-S8 (2, plus recruiting lead) → M-S9 (3): **33 working days on the path, about
seven weeks elapsed.** M-S3, M-S4 and M-S6 run beside M-S2.

### 11.3 Cut lines

Each is a sum of the milestones above.

| Cut | Contents | Days |
|---|---|---|
| **1. The hum and the lobby** | M-S0 hum and minimal lab (3); M-S2 without calls (4); M-S3 (1); M-S4 (1); M-S5 hum side (4); M-S8 (2); M-S9, one day (1). No composer. | **16** |
| **2. + calls in headphones only** | + M-S0 legato voice (2); M-S1 (1 + composer); M-S2 calls (2); M-S5 phrase side (2); M-S6 phrase panel (1) | **24** |
| **3. Full** | + speaker calls, M-S7 (5), `clients=6` (1), the rest of M-S9 (2) | **32** |

---

## 12. Risks

| Risk | L | I | Mitigation |
|---|---|---|---|
| R1 The score costs talk on the call | M | H | today's bed level; speech-band ceiling; synchronised copies; halved calls on speakers; listening-effort gate; playtest gate; lobby-only fallback |
| R2 A synthesised horn sounds cheap as music | M | H | week-1 realism gate; the recorded fallback (§11.1) |
| R3 Players do not hear the harmony change | M | M | week-1 ordering test before anything is built on it; the arc probe (R-f); then drop the claim, not the score |
| R4 A later change lets the score read a private field | L | H | `SCORE_FIELDS` + Proxy test, history tests, source guard |
| R5 Clients disagree | L | L | pure per-slot functions; the 2 s lock-in; D-a–D-f listed and tested |
| R6 Cultural misreading (a funeral signal) | L | M | new phrases from the call's cells; the consultant's three questions |
| R7 Audio-thread cost on low-end Android | L | M | 16 kHz internal synthesis; #23; the spike's device run |
| R8 The JS budget | H | L | D4 |
| R9 The phone running Discord ducks or cancels the game's audio | M | M | in the rig; if iOS ducks the score to inaudibility, the score's default on iOS-in-call becomes a documented limitation, not a fix |
| R10 Repetition over long waits or many games | L | M | no repeat within 10 slots; three takes; a new seed every game |

---

## 13. Decisions needed

| # | Decision | Default |
|---|---|---|
| D1 | Amend DESIGN §7.1 (A1) and the eleven rules in §1.2 | yes |
| D2 | In-game default before the music playtest: lobby-only; after it, per §10.5 | as stated |
| D3 | Protocol: `startedAt`, `room_update.serverNow` and `createdAt` | yes |
| D4 | JS budget: move the played-game line to 132 KB, or cut ≥ 6 KB first | move it, and list the cut as M5 polish |
| D5 | Headphones Clock bus +2 dB (A9) | yes |
| D6 | Split `world.dark.01` into a Table knock and `mus.home` (A8) | yes |
| D7 | A composer (5 days), or the library written in-house against §3 | composer |
| D8 | If the realism gate fails: recorded horn (and 9 phrases or a lower bitrate), or cut 1 (the hum only) | recorded horn |

---

## Appendix A — Phrase library: rules and examples

Notation: partial and duration (s); `~` the phrase's one onset (a scoop from −50 ¢ over 70 ms, ≥ 80 ms swell); `→` a
slur; `↓n` a sag of *n* cents over the note; `|t` the breath cut *t* ms early. Every phrase is one breath.

| Id | Kind, stage | Phrase | Length | Ends | Cells |
|---|---|---|---|---|---|
| L1 | call, lobby | 5~ 1.2 → 6 0.6 → 8 1.4↓20 → 6 0.5 → 5 0.75 → 4 1.8 | 6.25 | 4 | leap, settle, home |
| L2 | call, lobby | 6~ 1.0 → 8 0.7 → 9 0.3 → 8 1.2 → 6 1.6 | 4.8 | 6 | leap |
| D1 | call, dusk | 6~ 1.0 → 8 0.4 → 9 1.6 → 12 1.3 \|40 | 4.3 | 12 | leap |
| D2 | call, dusk | 9~ 0.9 → 10 0.45 → 9 0.6 → 8 0.3 → 6 1.9↓20 | 4.15 | 6 | fall |
| D3 | call, dusk | 6~ 1.6 → 8 0.5 → 12 1.1 → 9 0.7 → 6 1.9 | 5.8 | 6 | leap (wide) |
| E1 | call, evening | 6~ 0.8 → 8 0.45 → 7 1.0 → 6 0.6 → 5 1.8↓25 | 4.65 | 5 | fall, settle |
| E2 | call, evening | 5~ 1.1 → 6 0.5 → 8 0.35 → 10 0.9 → 6 0.7 → 5 1.4 \|50 | 4.95 | 5 | leap, settle |
| E3 | call, evening | 10~ 0.7 → 9 1.2 → 8 0.3 → 6 2.0↓15 | 4.2 | 6 | fall |
| N1 | call, night | 9~ 0.6 → 11 1.2 → 10 0.3 → 8 0.45 → 7 2.0↓35 | 4.55 | 7 | fall, accent |
| N2 | call, night | 6~ 0.9 → 8 0.4 → 11 1.6↓20 → 9 0.8 | 3.7 | 9 | leap, accent |
| N3 | call, night | 7~ 1.3 → 9 0.5 → 11 0.95 → 10 0.35 → 7 1.7 \|60 | 4.8 | 7 | accent |
| AL1 | answer, lobby | 8~ 0.5 → 7 0.6 → 6 1.1 | 2.2 | 6 | fall |
| AE1 | answer, evening | 7~ 0.5 → 6 0.6 → 5 1.1 | 2.2 | 5 | fall, settle |
| AE2 | answer, evening | 10~ 0.7 → 9 0.4 → 10 1.0 | 2.1 | 10 | — |
| AN1 | answer, night | 9~ 0.45 → 8 0.3 → 7 1.4↓30 | 2.15 | 7 | fall |
| AN2 | answer, night | 7~ 0.7 → 9 0.4 → 11 1.3 \|30 | 2.4 | 11 | accent |

Every example obeys §3.4 (endings, tonic class passing ≤ 0.5 s and never first or last in play, partial 11 at night
only), the lengths (calls 3–7 s, answers 1.5–3 s) and §3.2's no-pulse rule on its written durations (checked by
script for this revision). The full library — 10 calls per stage and for the lobby, 4 lobby answers, 6 evening and 6
night answers — is written in M-S1.

## Appendix B — Voicing and synthesis sheet

- **Hum:** counter-hash noise per partial; two-pole resonators, bandwidth 1.5 Hz (spike tries 1–3 Hz); level wander
  ±3 dB on value noise with knots every 8–25 s over absolute time; low-pass 1.1 kHz; gust lift +2 dB (pool dry); step
  gain from `DARK_STEPS` levels. Partial levels per state: §4.1. Hum level: −3 dB re the pond (provisional, §6.1).
- **Calls:** one phase accumulator; slur glide 45 ms, dip 3 dB over 30 ms, breath +6 dB for 40 ms; one lip onset at
  −26 dB; dynamics low-pass capped at 900 Hz; ≤ 8 harmonics under 2 kHz; lip random walk at 0.6; synthesised at 16 kHz.
- **Answers:** −6 dB; low-pass cap 650 Hz; start 0.9–2.5 s after the call's last note begins; headphones repeats −12 /
  −19 dB at +1.3 / +2.9 s, low-passed 520 / 380 Hz.
- **Slots:** gaps uniform 18–42 s; activity per state (§4.1); state locked at `T − 2 s` on broadcast `serverNow`;
  phrase `perm(seed, state, ⌊i/10⌋)[i mod 10]`; take differs from the previous pass; speaker subset `hash(seed, i) < ½`.
- **Swells:** 6 s (dusk entry), 4 s (lobby after the podium), 1.5 s (rejoin). **Fades:** 300 ms (a phrase cut by a
  stage change). **Cuts:** 25 ms, on the named cue's onset.

## Appendix C — Revision history

- **v1** (`6fad950`) — first plan. Scored **5.8** (`docs/music-plan-reviews/round-1.md`).
- **v2** — every must-fix of round 1:
  1. *The hum* no longer reads the 1 s shared noise buffer (`live/common.ts`): counter-hash noise per partial and a
     value-noise wander over absolute time, in an AudioWorklet; check #15 now fails on any envelope period of 0.3–3 s.
  2. *A legato voice* (`score/voice.ts` in `synth.ts`) replaces "the existing renderer", which attacks every note.
  3. *Rendering* is real-time on the audio thread at 16 kHz, budgeted from a measurement (0.57 µs a sample), with #23;
     no rendered buffers, so no memory figure to get wrong.
  4. *Levels* recomputed for every state: the world stem is unchanged within 0.3 dB (the pond gives up 2 dB), the
     headphones clock gains 2 dB (A9), calls sit 12 LU under the anchor, and the lobby's factor drops to 1.6.
  5. *The state table* is total and consistent: explicit precedence, the pool going dry no longer re-voices, the wind
     is no longer tuned, answers obey the cadence table, N2 is a legal call, repetition is bounded by construction.
  6. *One sync clock:* broadcast `serverNow`, per-slot pure functions (no cascade), the ceremony hold on server time,
     output-latency alignment, and the six divergences listed and tested.
  7. *Ducks* are per cue and exclude the cut points; the gate cuts on the miss and the capture, not the quiet creak.
  8. *Measures:* 15 ¢ on ≥ 300 ms windows; rejoin as same schedule and ≤ 1 dB; listening effort with a power estimate
     instead of Whisper; presence (#18) and cost (#23) added.
  9. *The playtest* is its own, counterbalanced, 4 groups × 5, with count rules stated in advance and a group-level rule.
  10. *Amendments:* twelve rows instead of four.
  11. *Production:* the milestone table sums (32), the cut lines are sums of it (16 / 24 / 32), the lab reaches the
      composer in week 1, the recorded fallback is costed (and shown to be over budget at FEEL's bitrate), a mix pass is
      budgeted, the consultant is on the critical path.
  12. *Facts* corrected: the acoustic scale (six of seven pitch classes over partials 4–12), `table.asked` (no `env`),
      `outputLatency` (visuals only today), the ambience's crossfade, turns vs asks.
  - And from the should-fix list: the tonic class is out of the hum in play (a real V → I at the last set, not a
    register change), the Discord-on-the-same-phone case is in the rig, the settings add a switch instead of a slider,
    the 232 Hz payoff is tested on phone speakers, the harness renders in chunks, the imperfections that could not be
    heard are gone.

## Appendix D — Execution record

*Built on `claude/pensive-faraday-9gmzud`. Every number below was measured by `npm run audio:check` (the full
harness, `packages/client/tools/out/metrics.md`) or by the unit tests; nothing has been heard by a listener yet.*

### D.1 What was built, by milestone

| Milestone | Built | Where |
|---|---|---|
| M-S0 spike | the hum (per-partial resonators driven by generated noise, ±3 dB value-noise wander over absolute server time) and the legato horn voice, one self-contained `createScoreSynth` closure shipped to an AudioWorklet as source text; a Score bench in `?lab=audio` | `audio/score/synth.ts`, `worklet.ts`, `audio/scoreLab.tsx` |
| M-S1 composition | **an in-house draft** of the whole library (D7's alternative): 40 calls and 16 answers, every one passing `phraseRules`, the notation parser and its writer. The composer and the consultant replace it | `audio/score/phrases.ts` |
| M-S2 engine | `SCORE_FIELDS` and `scoreInputOf`; the pure per-slot plan on server time; the conductor (cuts on named cues, swells, the 2 s lock, deferral, the ceremony hold, rejoin); the `Score` class loaded as a lazy chunk; the seventh bus with its duck and darkening gain; the switch (On / Lobby only / Off) under the Music slider in RO and EN; `?metrics=1` counts it | `audio/score/*`, `engine.ts`, `mixer.ts`, `presenter.ts`, `Sheets.tsx` |
| M-S3 protocol | `startedAt` in the view; `serverNow` and `createdAt` on `room_update`; a room test that they are identical for every member | `engine/src/redact.ts`, `server/src/room.ts`, `shared/src/protocol.ts` |
| M-S4 same key | `world.dark.01` is a Table knock; its bare horn note is `mus.home` on Music; the Clock bus +2 dB on headphones; the home rules as a test | `cuesheet.ts`, `recipes.ts`, `cues.ts` |
| M-S5 harness and tests | checks #14–#23 in `tools/score-harness.ts`; `scorefields`, `score`, `score-games` and the source guards (48 new tests) | `packages/client/test`, `tools` |
| M-S6 lab | the Score bench (state, profile, phrase box with live rule checking, the library). **Not built:** the slot timeline and `?table=bots&clients=6` — the agreement test drives six conductors directly instead | `audio/scoreLab.tsx`, `test/score-games.test.ts` |
| M-S7–M-S9 | **not done**: the call rig, the listening-effort and ESTOI tests, the blindfold rerun, the phone-speaker payoff test, the music playtest and the mix pass need people | — |

### D.2 Where the build departs from the text, and why

Each departure answers a round-2 finding or a measurement; none loosens a gate.

1. **Slurs jump, they do not glide or crossfade** (§3.6). A natural horn cannot sweep between partials (round 2). A
   30 ms crossfade was tried: two harmonic series 58 Hz apart beat inside it and #15 measured dips of 8.5 dB. The
   voice now keeps one running phase and moves the pitch at once, under a 1.5 dB dip and a breath lift.
2. **The onset swell is 200 ms**, not "≥ 80 ms": a 120 ms raised cosine reaches −6 dB at 60 ms and fails #15's own rule.
3. **The hum's grain is per client** (round 2): copies of one noise from several phones comb on the call. Its wander
   (the slow level of each partial) stays public and identical. The resonator bandwidth is 3 Hz, the widest of the
   spike's range.
4. **No gust coupling**: the gusts come from a per-client generator and the dry state, an undeclared input (round 2).
5. **Repetition is bounded for real**: one fixed walk of each stage's bag per game (`perm(seed, stage)[i mod 10]`), so
   no phrase recurs within ten slots; a returning phrase takes the next take. The speaker subset is
   `hash(seed, i) < ½` only.
6. **The slot hash has a real finaliser**: `util.mix` alone biased the activity rates (0.45 measured for 3/8).
7. **More cut points** (§4.2): over 24 bot games the stall gate also shut on a Tortoise's block and opened on a Shark, a
   Whale or a Lanternfish — steps with none of the plan's named cues. The powers' strikes are now cut points, the
   non-ducking ones first. Cuts land 5 ms into the cue, where the recipes strike their transient (#20).
8. **A 2 → 0 jump** fires the last set's knock but not `mus.home`: the podium is the cadence. A stall ending cuts to the
   finale on the miss that ends it.
9. **`mus.home` has no score duck** (round 2: #20 forbids a duck at a cut, and the duck would halve the payoff).
10. **A backlogged table** (round 2): a slot whose chord this client has not cut yet waits up to 3 s for the cut, then
    is dropped (D-g, tested).
11. **Levels, as measured** (§6.1): the pond gives up **3 dB** (not 2) and the hum fills it; each state's hum has the
    same total power; the voicings are flatter than §4.1 (dusk 6/9/12 at 0/−2/−1 dB, evening 5/6/10 at −1/0/−1, night
    5/7/9 at −2/0/−2, the last set's lone dominant at 0); calls sit **≥ 14 LU** under the anchor (15.0–15.5 measured),
    not 12, so a call over the world stays inside rule 3's spirit. Constants: `audio/score/levels.ts`.
12. **A13 — the Score stem follows the pond** (new amendment): its wetness factor (the public pool count; a measured 0.57
    once dry) and the table-activity envelope. Round 2 showed the world stem drifts by +0.55 dB as the pool drains and
    +1.5 dB in active play otherwise. The envelope's one per-client cue, `table.turn.you`, replaces `table.turn` at the
    same moment, so the envelope moves on every client together.
13. **#17 compares integrated loudness** for "unchanged from today" (short-term max still sets the 12–20 LU window),
    and #17/#18 measure the voicing at the centre of its wander: a 40 s render sees two or three knots, so the wander,
    not the design, would decide the number. Dry states render 180 s, as the bed check does.
14. **The Law 1 window test is restated** (round 2): the score is a pure function of public values and their broadcast
    times; a structural window's extra broadcast carries nothing new and, at matching timestamps, changes no slot.

### D.3 Measured

- `audio:check`: the original 13 checks pass with the score under the scene; of the score's ten, **eight pass**.
  - #14: worst held note 7.7 ¢, worst hum partial 1.0 ¢.
  - #15: slowest onset ≥ 105 ms, deepest slur dip 2.7 dB, hum envelope autocorrelation ≤ 0.15.
  - #16: 32.4–33.3 LU of speech room. #19: the clock 11.9–14.1 LU over the world and 13.9–15.9 LU over any call.
  - #20: a 21 ms ramp starting 1.2 ms before the knock's measured onset, click ratio 0.53. #21: a rejoin plays the
    same slots, 0.0 dB.
  - #22: the waiting room's world 8.4–9.1 LU under the anchor, its calls 15 LU. #23: about 210× real time (0.47 % of a
    core).
- **Two fail, both in the dry pool, both the wind–hum clash round 2 named:**
  - #17: the last set with a dry pool on speakers sits 20.5 LU under the anchor, 0.5 LU outside the window. Today's
    wind alone there is 19.8, and a steady hum that replaces part of a gusty wind lowers its short-term peaks while
    holding its integrated loudness.
  - #18: at dusk with a dry pool, partial 12 (696 Hz) is 0.6 dB under the wind's drifting 640 Hz resonance.
  - Both need the mix pass's ears: either the score learns the dry state (a voicing that steps out of the wind's band),
    or the wind gives up its resonance rather than its level.
- Agreement (§10.2): six clients with 0–300 ms of jitter agree on ≥ 99 % of slots on both profiles over 12 six-player
  games; a client 3 s late differs only on slots the lock and the deferral predict.
- Budgets: the main bundle +1.4 KB gzip. The score's lazy chunk is **9.4 KB gzip** against the plan's 6 KB estimate:
  D4's line moves further than the plan said.

### D.4 What remains, in the plan's order

1. Week 1's two listening tests (realism, ordering) and the private-panel dropout run on a mid-range Android (§10.3).
2. The composer's library and the consultant's review (M-S1, §3.7). Any library must pass `phraseRules`.
3. The call rig and its listening-effort, ESTOI, blindfold and phone-speaker tests (§10.4, M-S7).
4. The music playtest (§10.5). Until it passes, `SCORE_DEFAULT_MODE` stays `'lobby'`.
5. The mix pass (M-S9), starting with the two dry-pool residuals above.
6. The slot-timeline lab panel and `?table=bots&clients=6` (M-S6), if the rig needs them.
