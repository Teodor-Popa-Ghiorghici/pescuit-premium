# Background music plan — Pescuiește Extins

**Status: plan v1, for review. Nothing here is built.** It adds a background score to the game without breaking
any of the laws the rest of the sound was built on. It amends one line of `DESIGN.md` (§7.1, "no music bed during
play") and says why in §1. Revision history: Appendix C.

*Evidence: every claim about the current build was checked against the code on `claude/pensive-edison-28lk6g`
(commit `438eda9`): `SOUND_DESIGN.md`, `DESIGN.md` §0.1 and §7, `FEEL_VISUAL_SOUND_PLAN.md` §0–§3 and §9–§11,
`DECISIONS.md` ("The world arc", "Sound: the palette re-voiced"), `packages/client/src/audio/*`, `hooks/useLobbyAudio.ts`
and `packages/shared/src/protocol.ts`. Numbers about game length come from the plan's bot runs (FEEL §1.1, §3.9). Nothing
in this plan has been heard by anyone; §10 says how that changes.*

---

## 0. The one-page version

**The idea.** The game already opens with a tulnic calling across a valley (`mus.start`: one horn, partials of a
58 Hz fundamental, three darker repeats) and closes with the same horn coming home (`mus.podium`: partials 6 → 5 → 4).
In between there is a pond, then wind, and ~24 knocks a minute. **The score is what happens in the valley between the
call and the return:** the horn left on the fence hums in the wind, and now and then another shepherd answers from far
away. It is one instrument on one fundamental, in free rhythm, and it follows only the public count of sets still
possible. The whole game becomes one phrase: **it leaves home with the call, and it only comes home at the last set.**

**The five rules the score reduces to** — the audio counterpart of the art's "two values, one accent":

1. **One instrument, one fundamental.** Every pitch the score sounds is a partial of 58 Hz, from partial 4 (232 Hz)
   to partial 12 (696 Hz). The accent is partial 11 (638 Hz, the natural horn's "wrong" fourth), and only the night
   may use it. Home — partial 4 — is reserved for the lobby, the last set and the podium.
2. **Public, and the same on every client.** The score reads six public fields and nothing else (§5). It is seeded
   and clocked from the server, so the five speakers on a call play the same phrase at the same moment and their
   echoes through the call are consonant copies, not five different tunes.
3. **Under the table, never on it.** No transient, no pulse, nothing in the 1–4 kHz speech band louder than 30 LU
   under the anchor knock, and the pond plus the score together sit in the bed's existing window, 12–20 LU under
   the anchor (§6). The knocks are the rhythm; the score has none.
4. **It never reacts to a turn.** No stinger on an ask, a give, a power or a window: the cues already do that job,
   and a stinger on a window would voice one of the rules' own tells (FEEL §3.2). The score changes only at the
   world's five public steps: lobby, the call, 12, 6 and 1 sets possible, the finale — plus the pool running dry and
   the stall gate.
5. **Changes are cut on a knock, never faded.** The score is re-voiced under the transient of the knock that already
   marks the step (`world.dark.*`, the pool-empty thud, the gate's creak), the way the light steps flat and the
   ambience steps flat (DESIGN §6.1, "nothing cross-fades").

**What changes in the existing design** (§1.2 has the table): DESIGN §7.1's "no music bed during play" becomes
"a tuned bed and distant calls during play, inside the ambience's window, on by default and playtest-gated, exactly
like the ambience was" (FEEL §3.9). Three small re-voicings bring the rest of the soundtrack into the same key (§8):
the night wind is tuned to partials 5 and 11; the last-set knock moves to the Table bus so the music slider can
never silence it; and "home" becomes a rule in data.

**Done means** (all measured, §10):
- the score's schedule is identical on every client for the same public record, and for records that differ only in
  a hidden card, a Squid, or a structural window (Proxy field test + history tests);
- the audio harness grows from 13 to 21 checks and all pass: every sustained pitch within 10 cents of its partial;
  no pulse and no transient; speech band ≥ 30 LU under the anchor; the pond plus score inside the 12–20 LU window
  in all 24 states; the clock ≥ 10 LU over them; a rejoin renders the same score as staying;
- no measurable cost to talk: in the call rig, word error rate on read sentences rises ≤ 2 points with the score on;
- players want it: within-subject A/B in the playtests, "the table feels alive" +1 median with the score, no loss on
  "I always knew what just happened", and fewer than 5 of 15 turn the in-game score off (else it ships lobby-only).

**Effort:** 22–26 engineering days plus 3 composer days and the consultant session already budgeted (FEEL §11.8).
A 9-day cut ships the lobby and the hum without the distant calls (§11.3).

---

## 1. What the design already says, and where this plan stands

### 1.1 The constraints this plan keeps

Each row is a rule already in the repo; the right-hand column is how the score obeys it.

| Rule (source) | How the score keeps it |
|---|---|
| **Law 1** — presentation never adds information; sound is a function of the public record (FEEL §3.2, DESIGN §9) | Six public inputs, projected by one function and checked by the same Proxy test pattern as `SOUND_FIELDS` (§5). No seat facts: the score does not even know whose turn it is. |
| **Squid has no sound, no motif, no timing effect** (RULES §4, DESIGN §9.3, `SILENT_RANKS`) | The score reads no event that Squid could change; a Squid use changes nothing it reads. A history test compares a Squid lie with an honest "no" (§10.2). |
| **Structural windows are silent for everyone** (SOUND_DESIGN §4, D3) | The score does not read windows at all, and never pauses, starts or stops on one. It runs on server time, so a window's pause does not even shift it. |
| **Law 2** — the table talks, the game whispers; the call is part of the mix (FEEL §3.3–3.4) | Level inside the bed window; a speech-band ceiling; slurred, slow-attack phrases whose call-echoes are consonant; a sparser speaker arrangement; a word-error-rate gate in the call rig (§6). |
| **The palette** — wood, paper, ink, board, clay, water, rope; only Shark, Mantis, Whale break it (SOUND_DESIGN §1.3) | The score adds no new instrument. The tulnic already owns the Music bus (`mus.start`, `mus.podium`, the last-set note); the hum is the same resonant-noise technique as the wind (`ambience.ts`). No fluier, caval or țambal returns. |
| **Plank grammar** — a ringing A/B/C knock always means a seat (FEEL §3.1) | The score has no struck sound at all. Its only onsets are a phrase's first note (≥ 80 ms attack); every later note is slurred. The confusability check runs over it (§10.1). |
| **Space: discrete repeats, not reverb** (SOUND_DESIGN §1.1, `mus.start`) | Distance is a low-pass and a level. The headphones arrangement gives a far answer its repeats the same way the call's valley does; no reverb node exists. |
| **Frequency decides length and level** (FEEL §3.7) | Distant calls are rare (one per 30–100 s) and quiet; the only continuous layer is at bed level with no onsets. |
| **Flat steps, nothing cross-fades** (DESIGN §6.1, world arc) | Re-voicing is a cut under a knock's transient (rule 5). Entrances may swell, as a breath or a gust does. |
| **Nothing below 150 Hz is relied on** (SOUND_DESIGN §5) | The lowest partial the speaker arrangement sounds is 232 Hz. Partial 2 (116 Hz) exists only in headphones, as warmth. |
| **Input is never gated on audio** | The score is fire-and-forget on its own scheduler; nothing awaits it. The existing source guard covers the new module. |
| **0 KB of audio downloads; synthesised or rendered at load** (README budgets) | The hum is live; phrases are rendered in plain JS by the existing `render/horn.ts`, just in time, at 16 kHz. The recorded fallback (§12, R2) fits the untouched 220 KB audio budget. |
| **Audio is never the only channel** (SOUND_DESIGN §6) | The score carries no information that is not already drawn and announced: the stages (`data-stage`, `a11y.stage.*`), the dry basin, the gate, the podium. |
| **Hidden tab, unlock, iOS audio session** (`context.ts`) | Unchanged: the score suspends with the context and, on return, resumes at its server-time position; nothing is played late. |

### 1.2 The amendments

| § | Says now | This plan says | Why |
|---|---|---|---|
| DESIGN §7.1 | "No music bed during play. One short motif at game start and at game end only. This game is played over voice chat; a continuous music loop is a liability." | A **tuned bed and distant calls** during play: no loop, no pulse, no transient, inside the ambience's 12–20 LU window, identical on every client, on by default and **playtest-gated** (≥ 5 of 15 switching the in-game score off ships it lobby-only). The start and end ceremonies are unchanged. | The liability DESIGN names is a *loop* competing with speech. §6 designs that out and §10 measures it. What the game loses without a score is §2. |
| FEEL §3.5 (buses) | Six buses; Music carries the ceremonies and the last set | A seventh, **Score**, on its own stem (so the harness can measure it and the ceremony envelope can duck it). Music keeps the ceremonies; `world.dark.01`'s knock moves to Table (§8.2). | A slider at 0 must never silence an informative knock. |
| FEEL §3.9 | "No music bed during play (DESIGN §7.1 stands)" | The world arc gains a harmonic line: open fifth at dusk, the third in the evening, the seventh and the accent at night, home at the last set (§4). | The arc is visual and textural today; it has no line that *resolves*. |
| `ambience.ts` WIND_BANDS | 310 Hz and 640 Hz | 290 Hz (partial 5) and 638 Hz (partial 11) (§8.1) | The night wind sings in the score's key. |

---

## 2. Why the game needs a score

1. **The middle of the game has no line.** A game runs about 16–21 minutes of asks (75–99 turns at the scene's 4.7
   asks a minute, FEEL §3.3; unmeasured with humans). The call lasts 8.3 s and the podium 2.4 s. Between them, the
   only tonal sound is one bare note at the last set: ~99 % of the game is knocks over filtered noise. The knocks are
   right for the table; nothing is there for the *world*.
2. **The world arc is seen, not felt.** The light steps darker at 12, 6 and 1, and the ambience steps with it
   (`DARK_STEPS`: a low-pass and −1.5 dB per step). Those are timbre steps; a player who is not looking at the rim
   gets "slightly duller water". A harmonic change — the chord gaining a third, then a seventh — is the change the
   ear notices without attention. FEEL §9.2's target "I knew how close the end was" (median ≥ 5.5) is what the score
   is for.
3. **The ceremonies are unconnected.** The call ends on partial 5 and the podium ends on partial 4, but nothing
   between them makes the return mean anything. With the score, home is withheld for the whole game (rule 1), so the
   last set's bare partial-4 note is the first time it is heard since the lobby, and the podium confirms it.
4. **The waiting room is a pond and nothing else.** Players wait there for minutes while the link goes round. It is
   the one place where a fuller score costs nothing in play, and the first impression of the game's identity.

What it must not cost is in §6: the call.

---

## 3. The musical language

### 3.1 One instrument, one fundamental

The tulnic is a long wooden horn with no finger holes, so it sounds only partials of one fundamental. The existing
renderer (`render/horn.ts`, `HORN_FUNDAMENTAL = 58`) already enforces that every pitch is `58 × n`, un-tempered. The
score uses the same renderer and extends its range from partials 4–9 to 4–12.

| Partial | Hz | Interval over the octave below | Role in the score |
|---|---|---|---|
| 2 | 116 | tonic | headphones warmth under the hum only; never melodic |
| 4 | 232 | tonic (**home**) | lobby, `world.dark.01`'s note, the podium's last note. **Never sounded in play before the last set.** |
| 5 | 290 | major third, −14 ¢ | the evening's colour; the call's last note |
| 6 | 348 | fifth, +2 ¢ | the open note: dusk's centre, most phrase starts |
| 7 | 406 | minor seventh, −31 ¢ | the night's unrest |
| 8 | 464 | octave | the high open note; the last set's hollow hum |
| 9 | 522 | ninth, +4 ¢ | passing note only |
| 10 | 580 | major third, −14 ¢ | passing and upper-neighbour note |
| 11 | 638 | "fa" — 551 ¢, half-way between a fourth and a tritone | **the accent**: night only, and the dry wind (§8.1) |
| 12 | 696 | fifth, +2 ¢ | the ceiling; dusk's shimmer in the hum |

The partials 8–12 form the scale later theorists named the *acoustic* (overtone) scale — major third, raised fourth,
fifth, sixth, minor seventh — which Bartók reported in Romanian folk melody. The consultant (§11) confirms or corrects
that claim and the phrase library before a note is fixed; the plan does not depend on it, only on the physics.

### 3.2 Free rhythm: no pulse, anywhere

The *doina* (on UNESCO's Representative List since 2009) is sung and played in free, speech-like rhythm over a
drone. That is not only the right culture; it is the one rhythm that cannot be mistaken for a clock. The game's
meaning-bearing rhythms are the seat signatures (one knock, or two 75 ms apart), the clock (a click a second, then a
double click every 500 ms) and the asked roll (three taps). The score is forbidden all of them by construction:

- **No pulse.** Within a phrase, no three consecutive inter-onset intervals lie within ±10 % of each other, and no
  interval between 0.4 s and 1.1 s repeats even twice (that is where the clock lives). A unit test enforces it on the
  phrase data; a harness check enforces it on the render (§10.1).
- **No transient.** A phrase's first note swells over ≥ 80 ms (the call's lip attack is 90 ms); every later note is a
  slur — a pitch change with no new attack. The hum has no onsets at all.
- **No meter across phrases.** The gaps between phrases are drawn from a seeded irregular distribution (§4.3), never
  a grid.

### 3.3 The theme: three cells from the call

The call (`mus.start`) is 6 → 8 → 7 → 6 → 5. It is heard once per game at the most attentive moment, so the score is
built from it — the way a film cue quotes its main title — and players hear variations of something they already
know:

| Cell | From the call | Character | Used most in |
|---|---|---|---|
| **leap** | 6 → 8 | opening, calling out | dusk, the lobby |
| **fall** | 8 → 7 → 6 | the valley's own gesture (the repeats are this) | evening, answers |
| **settle** | 6 → 5 | coming to rest, but not home | evening cadences |

Every phrase is built from these cells plus passing notes (9, 10) and the stage's colour note (5, 7, 11). The podium
(6 → 5 → **4**) is the settle cell carried one step further — the one step the score never takes.

### 3.4 Cadences: where a phrase may end

This is the harmonic arc in one table. It is data (`score/phrases.ts`) and a unit test checks every phrase against it.

| Where | May end on | Never ends on | The feeling |
|---|---|---|---|
| Lobby | 4, 6, 8 | 7, 11 | at home |
| Dusk (18–13) | 6, 8 | 4, 5, 7, 11 | open, unresolved, outward |
| Evening (12–7) | 5, 6 | 4, 7, 11 | warmer, nearer |
| Night (6–2) | 7, 8, 11 | 4, 5, 6 | unrest; the question is open |
| The last set (1) | *no phrases* | — | the bare note (4) is the only melody |
| Finale | the podium (4) | — | home |

### 3.5 The hum: the horn on the fence

**Source.** A tulnic resting on a fence, its bell to the wind: wind across a tube excites its resonances, so it
hums on its own partials. **Synthesis:** the technique the wind already uses (`ambience.ts`: looped noise through
narrow band-passes), with the band-passes at partials of 58 Hz instead of wind-gap frequencies.

- One looped noise source (the shared buffer, at its own offset) → one band-pass per sounding partial, Q 60 at 232 Hz
  rising to Q 110 at 696 Hz (bandwidths of 4–6 Hz: clearly pitched, slightly rough, never a sine) → a gain per partial.
- **Harmonic motion without notes.** Each partial's gain wanders on its own smoothed random walk (0.04–0.12 Hz,
  ±3 dB): the weight shifts slowly between the partials of the chord, the way a drone breathes. Same mechanism as the
  pond's wander, never a regular LFO.
- **A gust** (the ambience's existing gust schedule, when the pool is dry) lifts the hum +3 dB with it: the wind and
  the horn move together.
- A 1.1 kHz low-pass and the existing −6 dB bell at 2 kHz. No oscillator anywhere.
- **The imperfection:** partial 6's band-pass sits 6 cents sharp of true (a dent in the bell). One per sound, as the
  rest of the palette.
- ≈ 20 persistent nodes (1 source, 6 band-passes, 6 gains, 6 wander filters and one low-pass), built once per game.

### 3.6 The distant calls

**Source.** Another shepherd across the valley. Tulnic players in the Apuseni often play in groups, one horn
answering or overlapping another; the score uses that practice as its texture.

- **A call** is 3–7 s, one breath (no gap > 60 ms), 3–8 notes, rendered by `renderHorn` with the call's recipe at
  greater distance: lip noise −26 dB (not −20), the low-pass that opens with the dynamics capped at 900 Hz (not 1100),
  a steadier lip (`wobble` 0.6).
- **An answer** is a 1.5–3 s fragment (usually the fall cell) from a second, farther horn: −6 dB, low-passed at
  650 Hz, starting 0.9–2.5 s after the call's last note begins, so the two overlap — heterophony, as the players do.
- **Distance is level and a low-pass**, not reverb. In the headphones arrangement a far answer gets two discrete
  repeats (−12 and −19 dB, low-passed 520 and 380 Hz, 1.3 s and 2.9 s later), the valley's own shape from `mus.start`.
- **Doina ornaments**, taken from what a natural horn can actually do: the scoop into a first note (−50 ¢ over 70 ms,
  as the call), the sag at the end of a held note (−20 to −45 ¢), the breath running out (`trimEnd` 30–60 ms). No
  trills and no fast runs: a tulnic cannot play them, and they would be onsets.
- **Placement** in headphones: the near shepherd −0.35 pan, the far one +0.55, fixed for the game (seeded). Mono and
  the speaker arrangement collapse both to centre.

### 3.7 Cultural care

The game borrows the tulnic's *material and practice*, not a specific repertoire: the phrases are new, built from
the call's cells, and are not transcriptions of any recorded tulnic signal. The consultant session already in the
plan (FEEL §11.8, 2–3 hours, before any recording) gets the phrase library, the §3.4 table and the renders, with three
questions: does anything read as a specific ritual or funeral signal (tulnic calls were also used at funerals); is
the acoustic-scale claim right; would a tulnic player recognise these as playable. The library is revised to the
answers before M-S2.

---

## 4. The adaptive score

### 4.1 States

The stages are the world arc's, computed from `sets.possible` exactly as `game/world.ts` does (dusk 18–13, evening
12–7, night 6–2, the last set 1, finale 0). "Level" is the hum's short-term loudness relative to the pond bed of the
same state; the harness verifies the combined window (§6.1).

| State | Enters on | Hum partials (dB re loudest) | Calls: gap between (s), answers | Headphones extra |
|---|---|---|---|---|
| **Lobby** | the waiting room mounts (after unlock) | 4 (0), 6 (−4), 8 (−9) | 20–40, then 60–120 after 3 min waiting; answers 1 in 3 | partial 2 (−8) |
| **The call** | `GAME_STARTED` | *cut* on the call's first note; silence under the call and its valley | none | — |
| **Dusk** (18–13) | the hum swells in over 6 s from the end of the call's last repeat (8.3 s) | 6 (0), 8 (−5), 12 (−14) | 60–100; first call no earlier than 40 s; no answers | partial 2 (−10) |
| **Evening** (12–7) | cut on `world.dark.12`'s knock | 5 (−3), 6 (0), 8 (−6) | 45–75; answers 1 in 3 | repeats on answers |
| **Night** (6–2), pool wet | cut on `world.dark.06`'s knock | 5 (−4), 6 (−6), 7 (−2), 8 (−7) | 30–50; answers 1 in 2 | repeats on answers |
| **Night** (6–2), pool dry | cut on the later of the two knocks | 5 (−4), 7 (−2), 8 (−7); the tuned wind carries 5 and 11 | same | same |
| **Pool dry**, any stage | cut on `table.poolEmpty`'s thud | the stage's voicing without its lowest partial (the water's depth gone) | unchanged | partial 2 removed |
| **The gate** (stall: `endPressure.misses ≥ limit/2`) | cut on `amb.gate`'s shutting creak | narrows to 7 (0) and 8 (−2): the septimal whole tone, a held breath | none while shut | — |
| Gate thrown open | cut on `amb.gate`'s opening creak | back to the stage's voicing | the next slot resumes | — |
| **The last set** (1) | cut on `world.dark.01`'s knock | 8 alone (−3): home's octave, hollow. The knock's bare partial-4 note sounds over it. | none | — |
| **Finale** | cut to silence on the last lay's stamp (the choreography's held beat) | none | none; `mus.podium` sounds alone | — |
| **After the podium** | 6 s after `mus.podium` ends | the lobby voicing swells in over 4 s | lobby schedule | lobby |
| **Rejoin / tab returns** | the first view after it | the current state's voicing, 1.5 s swell | the schedule from the current server time; no phrase already begun is played | — |

Why these voicings: dusk is an open fifth with no third (outward, undecided); the evening adds the third (warm,
closer); the night adds the seventh and the dry wind adds the accent (unrest, the question open); the last set drops
everything to the octave of home (the answer is near but not given); the podium gives it. The tension line rises
**by harmony and density, never by loudness or tempo** — the knocks own tempo and the voice owns loudness.

### 4.2 Transitions

- **Cut on the knock.** Every change of voicing is a 25 ms linear ramp of the band-pass gains that starts on the
  transient of the knock that marks the step — the same ramp `setDarkStep` uses, driven from the same
  `engine.worldAt` beat, so sound, light and score turn together. The knock masks the cut; nothing glides.
- **Entrances and exits breathe.** From silence the hum swells (4–6 s); into silence it is cut (the call, the
  finale). A breath or a gust can swell; a woodcut cannot fade.
- **A phrase in flight at a cut** finishes if it is at most 1.5 s from its end, else it is cut with the hum. A phrase
  never outlives its stage by more than 1.5 s.
- **Ceremonies own the valley.** While any `ex` cue on the Music or Power bus sounds (`mus.start`, `world.dark.01`'s
  note, `mus.podium`, `power.shark/mantis/whale/reveal`), the score is ducked −10 dB with the ambience (the same
  `onCeremony` envelope), and no phrase may start until 10 s after it ends. The horn never talks over the horn.

### 4.3 How often, and how long before it repeats

Stage lengths follow from the world arc's medians (FEEL §3.9: the tally reaches 12 at 32–44 % of a game, 6 at
67–79 %, 1 at 93–97 %) and a 16–21 minute game:

| Stage | Share of the game | Minutes | Mean gap | Expected calls | Library (phrases × ornament takes) | Worst-case repeats |
|---|---|---|---|---|---|---|
| Dusk | 32–44 % | 5–9 | 80 s | 3–7 | 8 × 3 | none |
| Evening | 30–40 % | 5–8 | 60 s | 4–8 | 8 × 3 | none |
| Night | 18–26 % | 3–5.5 | 40 s | 4–8 | 8 × 3, + 6 answers | none |
| The last set | 3–7 % | 0.5–1.5 | — | 0 | — | — |
| Lobby | — | 1–10 | 30 s, then 90 s | 2–10 | 10 × 3, + 4 answers | a phrase at most once per 5 min |

- **Selection is a seeded shuffle bag per stage** (every phrase once before any repeats; never the same phrase
  twice running across a bag boundary), and each replay uses a different ornament take (a different scoop depth, sag
  and trim). With 8 phrases and at most 8 calls a stage, a median game repeats nothing.
- **Time with a call sounding:** dusk ≈ 6 %, evening ≈ 8 %, night ≈ 14 % of the stage (mean call 4.5 s plus
  answers). The rest is the hum and the table. The score is mostly *silence with a key*.
- **The speaker arrangement plays every other slot** (the same slots on every speaker device), halving the calls
  where they can reach a microphone.

### 4.4 What the score never does

- plays on a turn, an ask, an answer, a power, a window, a clock tick, a join or a press;
- reacts to whose turn it is, to "you", to the mode (Ascuns or Deschis), to the player count, or to anything in a hand;
- sounds partial 4 in play before the last set;
- has a pulse, a transient, or a note above 696 Hz;
- starts a phrase over a ceremony;
- plays a stored loop;
- blocks, delays or is awaited by anything.

---

## 5. Law 1: the score is public

### 5.1 What it reads — `SCORE_FIELDS`

The score is a pure function `scoreFor(input, serverTimeMs) → ScoreState` behind a projection, `scoreInputOf`,
built exactly like `soundInputOf` (SOUND_DESIGN §3): one function copies these fields into a fresh object, and nothing
after it can read anything else.

| ID | Field | Public because |
|---|---|---|
| S1 | the phase: lobby / game / ended (`room_update.started`, `GAME_STARTED`, `GAME_ENDED` by `type` only) | everyone sees it |
| S2 | `setsPossible` (after the lay's notch beat, as `world.ts` places it) | V6: the same number for every viewer |
| S3 | `poolCount === 0` (the pool-empty event, `DREW_FROM_POOL.poolEmpty`) | E9: public |
| S4 | `endPressure.misses`, `.limit` | V7: public |
| S5 | the score clock: `startedAt` (new, §7.3), `serverNow` via `ServerClock` | a timestamp, the same for all |
| S6 | the seed: a hash of the room code and `startedAt` (lobby: room code and `createdAt`) | both public; neither touches the deal's CSPRNG |

Plus the cue stream's **`all`-heard `ex` cues**, for ducking and the ceremony hold (§4.2) — cues that every client
plays identically. It deliberately does **not** follow the ambience's table-activity envelope, because that envelope
also reacts to `table.turn.you` and `table.asked` (`heard: 'you'`), which differ by client.

**Forbidden, and asserted by the Proxy test:** every field in SOUND_DESIGN §3's forbidden list, plus `players`,
`currentPlayerId`, `facts.playerId`, `mode`/`config.powerVisibility`, `window`/`pendingWindow` (any field), `scores`,
`winners`, `laidSets`, and the room `seq`.

### 5.2 One score on every speaker

A call carries every speaker to every player. If five devices each improvised their own phrases, the call would
carry five tunes. So the score is **deterministic and clocked from the server**:

- **The slot schedule** is a seeded sequence of absolute times from `startedAt` (irregular gaps drawn per §4.1).
  At each slot the phrase is chosen from the bag of the stage that held **2 s before the slot**, by server time. A
  stage change that lands inside those 2 s on one client and outside them on another is the only way two clients can
  disagree; it is rare and harmless (both phrases are in the same key). Target: ≥ 99 % of slots agree across six
  clients in the bot table with 0–300 ms of injected delivery jitter (§10.2).
- **Alignment**: `ServerClock` already keeps a server offset (min of five samples, half the RTT) for the window clock;
  the score uses it and the engine's `outputLatency` compensation. Expected spread between devices: tens of ms,
  plus Bluetooth. A copy of a slurred, slow-attack phrase 100–300 ms late through the call is a consonant doubling —
  the same pitches — which reads as a second horn, not as a mistake. That is why the score has no transients (§3.2).
- **Rejoin and hidden tabs** re-enter the schedule where the server clock is. Nothing is replayed (SOUND_DESIGN §2's
  "no replay of missed events" holds for the score too).
- **A slow device skips, never lags.** A phrase is rendered ≥ 5 s ahead; if it is not ready 1 s before its slot, the
  slot is silent on that device. Skipping depends on the device, not on anything in the game.

### 5.3 Why no stingers — the argument in full

A stinger on a power (the obvious AAA move) would be redundant, since every power already has a cue, and hazardous
twice over: in Mode Ascuns, music that swelled on `POWER_USED` would be the same for every rank, which is fine, but a
stinger on a *window* would voice the rules' own tells (A6), and a stinger timed to a player's *pause* would turn a
deliberation into a sound. The simplest rule that is safe everywhere is the one in §4.4: the score does not know a turn
exists.

---

## 6. Law 2: under the voice

### 6.1 Level

| Target | Speaker | Headphones | Check |
|---|---|---|---|
| The world stem (pond or wind **plus** hum), short-term, every state | 12–20 LU under the anchor | same | #17 (extends today's ambience check from 5 pond states to 24: 6 states × wet/dry × 2 profiles) |
| A distant call, momentary max | ≥ 10 LU under the anchor | ≥ 8 LU under | #18 |
| The score in the 1–4 kHz speech band, short-term max | ≥ 30 LU under the anchor | ≥ 28 LU under | #16 |
| Every Clock cue over the world stem plus score | ≥ 10 LU | ≥ 10 LU | #19 (extends today's clock check) |
| Lobby (no anchor sounds there): the world stem | ≤ the in-game window + 6 dB (the lobby scene is already 2.2× the bed) | same | #17 |

Today the bed sits 14.1–19.8 LU under the anchor (speaker) and 13.3–19.1 (headphones) (SOUND_DESIGN §9). The hum is
set 4 dB (speaker) and 2 dB (headphones) under the pond, which raises the combined short-term level by about 1.5 and
2.1 dB — putting the loudest state at ≈ 12.6 LU on speakers and ≈ 11.2 LU on headphones. **The second is outside the
window**, so the pond's `BED_DB` drops 1 dB on headphones when the score is on (it rises back when the score is off, so
the ambience alone still meets today's check). These are estimates; the harness sets the final values, as the rest
of the mix is "measured, not set" (FEEL §3.3).

### 6.2 Spectrum

- Nothing above partial 12 (696 Hz) is ever a note; the horn's upper harmonics are low-passed at 900–1100 Hz (calls)
  and 1100 Hz (hum), with the existing −6 dB bell at 2 kHz. Speech intelligibility lives in 1–4 kHz; the score leaves
  it nearly empty (#16 measures it).
- The score's notes overlap the male and female speaking fundamentals and first formants (≈ 100–1000 Hz). That is the
  honest cost of a tonal bed. It is paid for with level (12–20 LU under a knock that is itself under speech) and with
  stillness (the hum changes five times a game). The call test measures whether that is enough (§10.3).

### 6.3 The two arrangements

| | Speaker (default) | Headphones |
|---|---|---|
| Hum | partials ≥ 5 (≥ 290 Hz) of the stage voicing, lowest dropped where needed; −4 dB re pond | full voicing plus partial 2; −2 dB re pond |
| Calls | every other slot; no answers in dusk and evening; answers at night only | every slot; answers per §4.1 |
| Repeats on answers | none (the call itself makes echoes) | two discrete repeats |
| Pan | centre | near −0.35, far +0.55 |
| Echo budget (FEEL §3.4) | exempt as the ceremonies are, replaced by the no-transient and speech-band checks: a slow slurred tone has no "first 250 ms" to protect | — |

### 6.4 The call, honestly

Voice-chat suppressors (Krisp, RNNoise-style, Discord's own) remove stationary noise well; the hum is close to
stationary and will mostly be stripped from a speaker device's microphone. Tonal, changing sounds — a distant call —
are likelier to pass (FEEL §3.2 designs "as if this were true"). So:

- what reaches the call is mostly the calls, at ≥ 10 LU under the anchor, and at night at most one every ~30 s;
- every device plays the same call at the same moment (§5.2), so the leaked copies double rather than clash;
- the speaker arrangement halves the calls;
- the settings offer "Background music: On / Lobby only / Off", and the playtest gate (§10.4) decides the in-game
  default from the players' own choices, as the ambience's was decided.

---

## 7. Architecture

### 7.1 Files

```
packages/client/src/audio/score/
  phrases.ts   DATA: the phrase library (partial, dur, scoop, sag, trim, gain per note), the cells, the §3.4 cadence table
  voicing.ts   DATA: the §4.1 table (hum partials and levels per state and profile, call gaps, answer odds)
  plan.ts      PURE: (ScoreInput, serverMs, seed) -> the slot schedule and the state; no DOM, no Web Audio; unit-tested in Node
  hum.ts       the live hum: noise -> partial band-passes -> wandering gains; setVoicing(state, at) as a 25 ms ramp
  calls.ts     just-in-time rendering (render/horn.ts at 16 kHz, in idle time, >= 5 s ahead) and playback of calls and answers
  index.ts     the Score class: owns hum + calls, reads only ScoreInput, schedules from the engine's lookahead tick
```

- **`scoreInputOf`** lives beside `soundInputOf` in `cues.ts`'s neighbourhood (`audio/score/input.ts`), with its own
  `SCORE_FIELDS` constant.
- **The engine** gains a `Score` beside `Ambience`: `engine.setScore(input)`, driven by the presenter at the same
  beats as `worldAt` (so the cut lands on the knock), and by `useLobbyAudio` in the waiting room.
- **Mixer:** a `Score` bus → its own stem with the profile EQ → a ceremony gain driven by `onCeremony` → the sum
  before the limiter. It does not pass through the ambience's darkening low-pass: the score darkens by voicing.
- **Voices:** the score does not use the voice pool (like the ambience); it cannot steal a table cue. At most two
  phrase sources play at once (a call and its answer).
- **Settings:** `score: number` (volume, default 1) and `scoreMode: 'on' | 'lobby' | 'off'` (default `'on'`), in
  `AudioSettings`, persisted with the rest behind try/catch. The existing Music slider keeps the ceremonies. The one-tap
  mute still silences everything. Strings: four new keys in RO and EN; `copy.test.ts` covers them.
- **Metrics** (`?metrics=1`): `score.turnedOff`, `score.lobbyOnly`, `score.offNow`, beside `ambience.turnedOff`.

### 7.2 Budgets

| Budget | Value | Why it holds |
|---|---|---|
| Download, audio | 0 KB (unchanged) | hum live; calls rendered |
| JS, gzip | ≤ 5 KB, a lazy chunk fetched after the audio unlocks | the phrase data is ≈ 44 phrases × ≤ 8 notes; the renderer exists |
| Persistent nodes | ≤ 24 (hum) | §3.5 |
| Per phrase | ≤ 10 nodes (source, gain, pan, two repeats with filters) | §3.6 |
| Render cost | ≤ 30 ms per phrase at 16 kHz under 4× CPU throttle, in `requestIdleCallback`, off the input path | measured in the spike (§11.1); the fall-back is a silent slot |
| Memory | ≤ 3 rendered phrases alive: ≤ 1 MB (7 s × 16 kHz × 4 B ≈ 450 KB each) | calls are released after playing |
| fps during a six-player whale | ≥ 55 (unchanged gate) | `perf:check` reruns with the score on |

**The JS budget is already over.** README: a played game loads 126.0 KB against 125 KB. A 5 KB score chunk takes it
to ≈ 131 KB. This plan does not hide that: decision D4 (§13) asks for the budget line to become 131 KB, or for an
offsetting cut to be found first. The lobby's initial load (107 KB) is untouched: the chunk arrives after the first
gesture.

### 7.3 Protocol

Two small server changes, both public and identical for every viewer:

- `startedAt` (server ms) in the game view, set once when the game starts. It is a timestamp; the deal draws from the
  OS CSPRNG and is independent of it (DECISIONS "Randomness never reaches the wire" is unaffected).
- `serverNow` and `createdAt` on `room_update`, so the waiting room's score is synchronised as well. Today
  `room_update` carries no server time (`protocol.ts`).

Tests: the redaction tests assert both fields are byte-identical in every viewer's message; the RNG wire test is
rerun.

---

## 8. The rest of the soundtrack, in the same key

Small changes, each one measurable, that make the existing sounds part of the same music.

1. **The wind sings partials 5 and 11.** `WIND_BANDS` 310 → 290 Hz and 640 → 638 Hz. Its ±12 % random walk and its
   whistle stay, so it is still wind; its centres now sit on the score's key, and the night's accent comes from the
   world, not a horn. Re-run the ambience check (#17) and the wind's lab page.
2. **The last-set knock can never be muted by the music slider.** `world.dark.01` is on the Music bus
   (`cuesheet.ts`), so a player who turns music down loses an informative knock. Split it: the knock stays
   `world.dark.01` on **Table**; the bare partial-4 note becomes `mus.home` on **Music**, placed 0 ms after it. The
   echo-exempt list, `soundtwins.test.ts` and the cue-sheet test follow.
3. **Home is a rule in data.** A unit test fails if any in-game phrase ends on, or contains, partial 4; if the call
   (`mus.start`) ends anywhere but partial 5; or if `mus.home` and `mus.podium` end anywhere but partial 4.
4. **The seat planks are not retuned.** Planks A 180, B 320, C 620 Hz are close to partials 3, 5.5 and 11 — tempting.
   They are left alone: their job is identity, measured by the confusability check and (not yet run) the blindfold
   test, and they are struck, inharmonic bars that do not read as pitches in a key. Retuning them would trade a
   measured property for an aesthetic one.
5. **The podium is unchanged** — bare, one breath, 6 → 5 → 4. What changes is what it means: it is now the only
   cadence to home in the whole game.

---

## 9. Tooling: the score in the lab

`?lab=audio` (development only) gets a **Score** panel: the state (lobby, dusk, evening, night wet/dry, the gate, the
last set, finale), the profile, the seed, "jump to server time", a play-through that walks the stages at 10× with the
real `world.dark.*` knocks, per-partial meters for the hum, a timeline of the slot schedule (which phrase, which take,
which slots the speaker arrangement skips), and "solo phrase N" for the whole library. The composer and the consultant
review the library here, not in a DAW.

The bot table (`?table=bots`) plays the score like any other client, so a six-seat game at 4× shows the whole arc in
five minutes; `?table=bots&clients=6` (new) opens six presenters on one engine with injected jitter for the agreement
test (§10.2).

---

## 10. Measurement

### 10.1 The audio harness: 13 checks become 21

`npm run audio:check` renders the score offline (the same `plan.ts` and renderers, `OfflineAudioContext` at 48 kHz)
through the product's chain. New checks, each able to fail:

| # | Check | Pass |
|---|---|---|
| 14 | **The key** | every sustained spectral peak of the hum and of every phrase (FFT, 40 ms frames, held notes only) within 10 ¢ of `58 × n`, n ∈ 2..12; scoops and sags excluded by their design windows |
| 15 | **No pulse, no transient** | onset detection on a 20-minute render per profile: no rise faster than 80 ms to within 6 dB of a note's peak; no three consecutive inter-onset intervals within ±10 %; the existing confusability check run on the score's onsets against the seat signatures, the clock and the asked roll, with zero violations |
| 16 | **Speech room** | the score's 1–4 kHz band short-term max ≥ 30 LU (speaker) / 28 LU (headphones) under the anchor |
| 17 | **The world window** | pond or wind plus hum, short-term, 12–20 LU under the anchor in all 24 states; lobby ≤ window + 6 dB |
| 18 | **Distance** | every call's momentary max ≥ 10 LU (speaker) / 8 LU (headphones) under the anchor |
| 19 | **The clock over the world** | every Clock cue ≥ 10 LU over pond + score in every state |
| 20 | **Cuts land on knocks** | every voicing change's 10–90 % ramp lies within 10–35 ms and starts within 5 ms of its knock's onset; click ratio ≤ 1.5 (the darkening check's method) |
| 21 | **Rejoin equals staying** | a render entered at t = 137 s (after its 1.5 s swell) is sample-identical to the full render from that point |

The existing 13 must still pass with the score on (peaks, headroom, balance and the palette in particular), and the
calibration is regenerated.

### 10.2 Unit and leak tests

- **`scorefields.test.ts`**: `scoreInputOf` over a Proxy record stuffed with every private and every forbidden field;
  fails on any read outside `SCORE_FIELDS` (and a second test proves the spy can fail) — the `soundfields` pattern.
- **Histories** (reusing `presentation-leak.test.ts`'s real engine games): for pairs of histories with the same public
  record — an honest no vs a Squid deny vs a Squid claim; a hidden power set of each of nine ranks; the five
  structural-window histories vs the same without the window — the score's slot schedule, phrase ids, takes, voicing
  cuts and seeds are identical.
- **`phrases.test.ts`**: every phrase obeys §3.4's cadence table, the range 4–12, the no-pulse rule on its own
  durations, ≥ 80 ms first attack and slurs after; "home" per §8.3; every stage bag ≥ its worst-case calls.
- **Determinism**: `plan.ts` gives the same schedule for the same `(input, seed)` in Node and in the browser build.
- **Agreement**: six presenters on one bot-table engine, 0–300 ms of injected jitter, 50 games: ≥ 99 % of slots play
  the same phrase and take on all six.
- **The source guard** (`soundguards.test.ts`) is extended: nothing in `score/` imports a hand, a grant, a window or
  `SeatFacts`, and no input path awaits the score.

### 10.3 Listening, call and device tests

- **The spike's go/no-go** (before any integration, §11.1): five listeners hear the rendered distant call and hum
  against a reference recording of a real tulnic at distance. If the median for "sounds like a real horn far away"
  is below 4 of 7, the calls go to the recorded fallback (§12, R2) before more is built on them.
- **The call rig** (FEEL §7.5; not built yet, costed in §11): five clients on speakers in one Discord call, noise
  suppression on and off, a headset recorder. Two readers speak 40 Harvard sentences each over a game in progress,
  with the score on and off. Transcribe the recording with an offline ASR (whisper.cpp) and compare word error rate:
  **pass if WER rises ≤ 2 points with the score on.** Also rated by three listeners: "the music got in the way of the
  talk" (1–7), median ≤ 2.
- **Blindfold, rerun with the score on** (FEEL §9.3): seat, outcome and "tell the clicks" scores no lower than with the
  score off.
- **Phone speaker** (FEEL §9.3): on three phones at 50 % volume, the hum's lowest sounding partial is audible in a
  quiet room; the calls are undistorted at full volume.

### 10.4 Playtests: within-subject A/B

In the existing rounds (FEEL §9.2: five players on Discord, 45 minutes), each group plays two games, one with the
score and one without, order alternated between rounds. Reported per round and pooled (n = 15), as counts:

| Measure | Ship the in-game score on by default if |
|---|---|
| "The table feels alive" (1–7) | median with score ≥ median without + 1 |
| "I knew how close the end was" (1–7) | median with score ≥ median without |
| "I always knew what just happened" (1–7) | median with score ≥ median without − 0.5 |
| Whose-turn confusions (observer) | no more with the score than without |
| Players who switch the in-game score off or to lobby-only (`?metrics=1`) | fewer than 5 of 15 |
| Muted by the end | no more than without (and ≤ 2 of 15, FEEL's existing target) |

If the first or the last two rows fail, the default becomes **lobby only**; the in-game score stays in settings.
If "I always knew what just happened" or whose-turn confusions fail, the score is cut back to the hum (no calls) and
the round is repeated.

---

## 11. Production plan

### 11.1 Milestones

| Milestone | Content | Days |
|---|---|---|
| **M-S0 Spike** | `renderHorn` at 16 kHz with the distance recipe, partials to 12; a hum prototype; the render-cost measurement at 4× throttle; five-listener go/no-go (§10.3) | 3 |
| **M-S1 Composition** | composer writes the library in `phrases.ts` in the lab (44 phrases, 3 takes each); consultant session (FEEL §11.8) reviews library and §3.4; one revision | composer 3; engineering 1 |
| **M-S2 Engine** | `score/*`, the Score bus and stem, the cut-on-knock, ducking, rejoin, slow-device skip, settings, metrics, strings | 6 |
| **M-S3 Protocol** | `startedAt`, `room_update.serverNow/createdAt`, redaction and RNG tests | 1 |
| **M-S4 Same key** | §8: wind retune, `world.dark.01` split into knock + `mus.home`, the home rule, cue-sheet and twin tests | 1.5 |
| **M-S5 Tests and harness** | checks 14–21; `scorefields`, histories, phrases, determinism, agreement, guard; recalibration; budgets | 5 |
| **M-S6 Lab** | the Score panel; `clients=6` in the bot table | 2 |
| **M-S7 Call rig and listening** | the rig if still unbuilt (2); the call test, blindfold rerun, phone-speaker pass (2) | 4 |
| **Playtests** | inside the existing rounds; two games per session instead of one | 0 extra sessions |
| **Total** | | **22–26 engineering days** (the range is the spike's outcome and the rig), **3 composer days** |

### 11.2 Critical path

M-S0 → M-S1 → M-S2 → M-S5 → M-S7 → playtest. M-S3, M-S4 and M-S6 run beside M-S2. The spike is the gate: if the
synthetic horn fails its listening test, M-S1 composes for the recorded fallback instead, and the path is the same.

### 11.3 Cut lines

1. **9 days — the hum and the lobby.** No distant calls: M-S0 (hum only), M-S2 without `calls.ts`, M-S3, M-S4, and
   checks 14–17, 19–21. This alone gives the harmonic arc and the resolution at the podium, with the least risk to
   the call.
2. **16 days — calls in headphones only.** The speaker arrangement stays hum-only; the call rig can wait.
3. **Full** — as §11.1.

---

## 12. Risks

| Risk | L | I | Mitigation |
|---|---|---|---|
| R1 The score competes with talk on the call | M | H | level window, speech-band ceiling, synchronised consonant copies, halved calls on speakers, the WER gate, the playtest gate, lobby-only fallback |
| R2 A synthesised horn sounds cheap when heard as music, not as a 3 s ceremony | M | H | the spike's go/no-go; **fallback:** record a tulnic player (already in FEEL §3.6's Tier R session) and ship 12 phrases as Opus mono at 16 kHz, ~24 kbps: ≈ 12 × 4 s × 3 KB/s ≈ 145 KB, inside the unused 220 KB audio budget |
| R3 Repetition over a long lobby wait or many games in a row | M | M | bags without repeats, three takes per phrase, lobby gaps widening after 3 min, the seed changes every game |
| R4 A change later lets the score read a private field | L | H | `SCORE_FIELDS` + Proxy test + source guard + history tests (§10.2) |
| R5 Devices disagree on a slot | L | L | the 2 s lock-in; the agreement test; disagreements are in the same key |
| R6 Cultural misreading (a funeral or ritual signal) | L | M | new phrases from the call's cells, no transcriptions; the consultant's three questions (§3.7) |
| R7 Low-end Android: render stalls or fps drops | L | M | 16 kHz, idle-time rendering ≥ 5 s ahead, silent-slot fallback, `perf:check` with the score on |
| R8 The JS budget | H | L | D4: amend to 131 KB or offset first |
| R9 iOS: other apps' audio (a user's own music) under ours | M | L | `audioSession.type = 'ambient'` already mixes with other audio; "Background music: Off" is one tap in settings |
| R10 Players do not notice a harmony change | M | M | measured directly ("I knew how close the end was", A/B); if flat, the night's accent (partial 11) moves into the calls, not the hum |

---

## 13. Decisions needed

| # | Decision | Default |
|---|---|---|
| D1 | Amend DESIGN §7.1 to allow a bed during play under §1.2's conditions | yes |
| D2 | In-game default: on, pending the playtest gate (§10.4) | on (both profiles; the speaker arrangement is the sparser one) |
| D3 | Protocol: `startedAt` in the game view; `serverNow` and `createdAt` on `room_update` | yes |
| D4 | JS budget: raise the played-game line to 131 KB, or find ≥ 5 KB to cut first | raise, and list the cut as M5 polish |
| D5 | Retune the wind to partials 5 and 11 | yes |
| D6 | Split `world.dark.01` into a Table knock and `mus.home` | yes |
| D7 | Commission a composer (3 days) for the library, or write it in-house against §3 | composer |
| D8 | If the spike fails: the recorded fallback (R2), or cut to the hum (§11.3, line 1) | recorded fallback |

---

## Appendix A — Phrase library: specification and examples

Notation: partial number, duration in seconds; `~` a scooped first note (−50 ¢, 70 ms, ≥ 80 ms attack); `→` a slur;
`↓n` a sag of n cents over the note; `|t` the breath cut t ms early. Every phrase is one breath.

| Id | Stage | Phrase | Ends | Cells |
|---|---|---|---|---|
| L1 | lobby | 5~ 1.2 → 6 0.6 → 8 1.4↓20 → 6 0.5 → 5 0.75 → 4 1.8 | home | leap, settle |
| L2 | lobby | 6~ 1.0 → 8 0.7 → 9 0.3 → 8 1.2 → 6 1.6 | 6 | leap |
| D1 | dusk | 6~ 1.0 → 8 1.8 → 9 0.3 → 8 1.3 \|40 | 8 | leap |
| D2 | dusk | 8~ 0.9 → 10 0.4 → 9 0.5 → 8 1.4 → 6 1.5↓20 | 6 | leap, fall |
| D3 | dusk | 6~ 1.6 → 8 0.7 → 12 1.1 → 8 1.9 | 8 | leap (wide) |
| E1 | evening | 6~ 0.8 → 8 0.6 → 7 1.0 → 6 0.45 → 5 1.8↓25 | 5 | fall, settle |
| E2 | evening | 5~ 1.1 → 6 0.5 → 8 0.8 → 6 0.7 → 5 1.4 \|50 | 5 | leap, settle |
| E3 | evening | 8~ 0.7 → 7 1.2 → 6 2.0↓15 | 6 | fall |
| N1 | night | 8~ 0.6 → 11 1.2 → 10 0.3 → 8 0.5 → 7 2.0↓35 | 7 | fall, accent |
| N2 | night | 7~ 0.7 → 8 0.4 → 7 1.3 \|60 | 7 | fragment |
| N3 | night | 6~ 0.9 → 8 0.5 → 11 1.6↓20 | 11 | leap, accent |
| A1 | answer | 8~ 0.5 → 7 0.6 → 6 1.1 | 6 | fall (the valley's) |
| A2 | answer (night) | 7~ 0.8 → 8 1.2 \|30 | 8 | fragment |

The durations above are written; the no-pulse test reads them. E.g. N1's inter-onset intervals are 0.6, 1.2, 0.3,
0.5 s — no three within ±10 %, none of 0.4–1.1 s twice. The full library (10 lobby, 8 per stage, 4 + 6 answers)
is written in M-S1.

## Appendix B — Voicing sheet

Hum band-pass Q: 60 at 232 Hz, rising linearly in log-frequency to 110 at 696 Hz. Levels in dB re the loudest partial
of the state (§4.1); state levels re the pond bed of the same state: speaker −4 dB, headphones −2 dB (provisional;
the harness sets them). Wander: ±3 dB per partial on smoothed random, 0.04–0.12 Hz. Low-pass 1.1 kHz, bell −6 dB at
2 kHz. Voicing ramps 25 ms, from the knock's onset. Swells: 6 s (dusk entry), 4 s (lobby after the podium), 1.5 s
(rejoin).

Calls: `renderHorn` at 16 kHz, harmonics capped below 7 kHz, lip −26 dB, dynamics low-pass capped at 900 Hz,
`wobble` 0.6. Answers: −6 dB, low-pass 650 Hz. Headphones repeats: −12 / −19 dB at +1.3 / +2.9 s, low-pass 520 / 380 Hz.

## Appendix C — Revision history

- **v1** — first plan.
