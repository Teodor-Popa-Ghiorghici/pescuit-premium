# Sound design — Pescuiește Extins

**Status: implemented (Step 2). Sections marked _[as built]_ record where the build differs from the design that was reviewed; §9 lists what was measured and what was not.**

The sound is *carved and printed, not polished*: dry, close, material, slightly off-square. Two values, one accent, no
gradients or glow — in audio terms: one dry register (wood, paper, ink), one accent (the horn), and no reverb wash.

---

## 0. What I found before designing (read this first)

**The repo already has a complete audio module** (`packages/client/src/audio/`, milestone M1 in `FEEL_VISUAL_SOUND_PLAN.md`
§3, `DESIGN.md` §7, `DECISIONS.md`). It already has exactly the structure you asked for:

| You asked for | Already there |
|---|---|
| engine: context lifecycle, buses, limiter | `context.ts`, `mixer.ts`, `worklet.ts` + `dynamics.ts` (lookahead limiter) |
| voice recipes as pure functions | `recipes.ts` (+ `live/*`, `render/*`) |
| cue palette | `cuesheet.ts` |
| one mapping layer, events → cues | `cues.ts` → `cuesFor(record, facts)`, pure, leak-tested |
| audition page | `lab.tsx` at `?lab=audio` |

So I will **not** rebuild it. Step 2 edits this module. Below, every cue is marked **KEEP / RETUNE / NEW / REMOVE**.

**What I verified by running it (this session, before touching anything):**
- `npm ci` OK. The 9 audio-related client test files: **151 tests pass** (`cues`, `cuesheet`, `recipes`, `motifs`,
  `presentation-leak`, `clock`, `voices`, `dynamics`, `engine`).
- `npm run audio:check` runs here (esbuild + headless Chromium + `OfflineAudioContext`) and reports **9/9 checks passing**
  with per-cue peak, loudness, active duration and clipping. So the offline measurement you asked for *is* possible in this
  environment. I did not use `--write-calibration`; the working tree is unchanged.

**Stack facts (checked in the code, not assumed):**
- No Tone.js in any `package.json` → Web Audio directly. Nothing to change.
- **No CSP exists anywhere** (`staticServer.ts` sets none, `index.html` has no meta CSP, `railway.json` none). The limiter
  worklet is loaded from a `Blob` URL (`worklet.ts`), so *if* a CSP is added later it needs `script-src blob:` /
  `worker-src blob:`, or the engine falls back to a main-thread `ScriptProcessor`. Nothing to do now; flagged.
- **The audition lab currently ships to production.** `main.tsx` dynamic-imports `audio/lab.js` on `?lab=audio` with no
  `import.meta.env.DEV` guard; a production `vite build` (run here) emits it as `lab-*.js`, 12 KB (4.8 KB gzip), reachable by URL on the live site. The
  neighbouring dev tables (`?table=bots`, `?fixture=`) ship the same way as `mount-*.js`, 48 KB. You asked for dev-only.
  Step 2 gates the audio lab (decision D7); the other dev entry points are out of scope unless you say so.

**Where the existing design and your brief disagree.** The earlier plan wins over `DESIGN.md` where they differ
(`DESIGN.md` §0.1), but your brief is newer and more specific about the material, so I default to your brief and list each
conflict as a decision in §7. The big ones:

1. **Eight melodic flute/caval motifs** (`motifs.ts`, D "Romanian minor") play for Shark, Tortoise, Lanternfish, Mantis,
   Jellyfish, Stickleback, Whale, Clownfish, plus `power.granted.<rank>` in Mode Deschis. You say only Shark, Mantis and
   Whale may break the palette. Five of those motifs must go.
2. **Țambal strings** (a struck-string material): `power.granted` is "a țambal shimmer" (chime-like), the Lanternfish is "a
   țambal glint" (2 kHz+ sparkle), and the four score-race cues (`table.lead` "climbs D-A-D", `table.breakaway` "runs up
   four", `table.clinch` "rolled chord") are exactly the level-up arpeggios and jingles you banned.
3. **A private tier** (`clock.eligible`, `power.granted.mine`, Ascuns `power.clownfish.bound`) that plays *only for the
   eligible / owning player, in headphones mode*. You require interrupt-window audio to be identical for every client and
   private-card actions to sound identical whatever the card is. These three violate that.
4. **Per-viewer result music** (`mus.end.win/tie/lose`, ascending fluier runs over dobă) instead of one bare tulnic phrase.
5. **`mus.lastset` is 1538 ms** measured and `table.clinch` 2195 ms; signature moments must be ≤ 1.4 s.
6. **Ambience has extras you did not ask for and one you banned:** distant birds are oscillator chirps (sine bleeps),
   plus fish jumps, reeds, and a dobă heartbeat pulse from 3 sets remaining. The water→wind change is a 1.5–2 s glide
   (`setTargetAtTime`), and the wind's "gusts" are a 0.13 Hz sine LFO (periodic, not occasional).
7. **`DESIGN.md` §0.1 row 7.5 says "no ducking".** You want ambience to duck under signature moments. Reconcilable: duck
   only under the rare, once-per-game-scale cues (never under frequent table cues, which is what pumps).

---

## 1. Palette

Vocabulary reused from the existing engine, so the new material sits with the old:
- **Bar** — a thick wooden plank/board struck with a mallet. Modes `1 : 2.756 : 5.404 : 8.933` (free–free bar). Seat planks
  A 180 Hz / B 320 Hz / C 620 Hz; plank D 1200 Hz is "the table acknowledges / your own hand".
- **Board** — the table top: an unpitched thud, no modal ring, so it can never be mistaken for a seat.
- **Ink press** — a falling sine 110 → 70 Hz over 60 ms plus a 15 ms peel. Existing `stamp`.
- All bodies below 150 Hz get a tanh harmonic layer at 120–400 Hz (phone speakers). **No cue depends on sub-bass.**

Notation: **T** = transient, **B** = body, **L** = tail. `A/D` = attack/decay in ms. **I** = the one deliberate imperfection.
"3 var." = three takes chosen by the public seed (§5). Lengths are the headphones profile; speaker variants stay ≤ 250 ms
for all-client public cues (existing echo budget, checked by `audio:check`).

### 1.1 Ceremony and world

**`mus.start` — tulnic call** · RETUNE (currently two equal-tempered notes, 45 and 50 MIDI, which are *not* on one
harmonic series, no lip attack, no valley) · 3.2 s dry + repeats ≈ 8.3 s · ambience ducks −10 dB for 3.3 s
- *Source:* a tulnic — 3 m conical spruce horn, no finger holes, so only partials of one fundamental. Fundamental
  **58 Hz** (never sounded; natural-horn low notes are weak). Phrase, one breath, no gap > 60 ms:
  partial 6 (348 Hz) → 8 (464) → 7 (≈406) → 6 (348) → 5 (290). Every note is `58 × n`; nothing is rounded to equal
  temperament. All notes ≥ 290 Hz, so phones reproduce them.
- *T (lip):* band-limited noise, bandpass 420 Hz Q 1.2, 90 ms *slow* attack, −20 dB re body. Each note enters with a
  −50 cent scoop over 70 ms.
- *B (horn):* harmonics 1–10 at amplitude `1/h^1.2`, through a low-pass that opens with dynamics (500 → 1100 Hz, Q 0.8) and
  a 380 Hz bell bump. Unsteady lip: ±5 cent random walk near 5 Hz (not a regular vibrato).
- *L (breath):* noise, bandpass 300–900 Hz, −24 dB re body while held, rising to −12 dB as the last two notes sag
  (−35 then −60 cents) — the breath running out. The phrase *falls off* at the end.
- *Space:* not a reverb. **Three discrete repeats** of only the final falling gesture (partials 7→6→5, 1.55 s), starting
  at 3.5 s, 4.9 s, 6.6 s after the call begins: −9, −16, −23 dB, low-passed at **1000 / 650 / 420 Hz** _[as built: the design's
  2600 / 1500 / 800 Hz sat above the horn's own ~1 kHz roll-off, so the first two repeats were not measurably darker]_ (each
  darker, and carved for speech like the call). Irregular spacing, like walls at different distances. The call is 3.2 s; the
  last repeat ends at ≈ 8.2 s (`mus.start` is 8.3 s).
- **I:** the 7th partial is left ≈ 31 cents flat of its equal-tempered neighbour (true to a natural horn), and the last
  note is cut ≈ 40 ms early (the breath ran out before the note finished).
- *Never blocks input:* fire-and-forget on the Music bus; the first turn's cues (`BEAT.start = 2400 ms`) and all input run
  independent of it (a source guard asserts no input path awaits an engine call). _[as built: it takes one voice from the pool
  and the pool's `inst` cap; the repeats are extra buffer sources inside that one voice, not extra voices]_

**`mus.podium` — the horn returns, resolved and bare** · NEW (replaces `mus.end.win/tie/lose`) · ≈ 2.4 s · ducks ambience
- Same instrument and fundamental. One breath, stepwise down to home: partial 6 → 5 → **4** (348 → 290 → 232 Hz), held and
  decaying. *Bare:* no echoes, no scoop drift, no accompaniment (the current versions play over dobă hits).
- **I:** the final note settles ≈ 12 cents flat and stays there — it does not correct.
- One cue for everyone; who won is on the podium screen (see D4).

**`world.dark.12` / `.06` / `.01` — darkening steps** · NEW · ≈ 160 ms each; `.01` also carries the last-set horn note
- *Source:* a mallet on the wooden basin rim, a hand stopping the ring.
- *T:* noise burst, bandpass 900 Hz, 4 ms. *B:* thick bar, f0 **140 / 110 / 85 Hz** (each step lower), T60 90–140 ms, then
  hand-stopped at 160 ms. No tail.
- *The ambience step, at the same instant* (a flat step, not a sweep): ambience-stem low-pass **4200 → 3000 → 2100 → 1400 Hz**
  and level **0 → −1.5 → −3 → −4.5 dB**, applied as a **25 ms linear ramp** (click-free), fixed values, never animated.
- `.01` = "the last set": the knock, then **one bare tulnic note, partial 4 (232 Hz)**, 0.2 s attack, 0.7 s hold, 0.3 s
  release. Total ≤ **1.2 s** (limit 1.4; currently 1.54 s). Ducks ambience.
- **I:** the `.06` knock rings ≈ 8 ms longer than its neighbours (a slightly stubborn plank).

**`world.notch` — the chisel tick** · NEW · 30 ms, −14 dB · 3 var.
- *Source:* a small chisel tapped into the rim. *T:* bandpass 3200 Hz Q 2, 2.5 ms. *B:* plank-D mode at 2000 / 2100 / 2250 Hz
  (the three takes), T60 12 ms. No tail.
- One per notch that counts down (`sets.possible` before − after, capped at 3), 70 ms apart, first on the visual notch beat.
- **I:** take 3 has a 6 ms "chip" flam (a second, smaller tick).

**`amb.pond` — water while the pool lasts** · RETUNE
- *Bed:* noise, low-pass 500 Hz, gain modulated by *smoothed random* (low-passed noise, ~0.4–0.9 Hz, irregular), plus a
  faint lapping shelf at 2 kHz. −26 dB bus (existing). No oscillators.
- *Drips:* **one every 3–8 s** (low density). Noise burst through a resonant bandpass (Q 25) sweeping **2400 → 1300 Hz in
  35 ms** — a fast pitch *drop* — plus a dull 6 ms tap. 3 var., ±5 %. **No sine bleeps.**
- *Removed:* distant birds (sine chirps at 2.6–3.5 kHz), fish jumps, reeds (D5).
- **I:** every ~10th drip is doubled 90 ms later, smaller (a drip off the same reed).

**`amb.wind` — once the pool is dry** · RETUNE
- *Bed:* noise through **two narrow resonant bandpasses** (Q 18 and 30) at ≈ 310 Hz and ≈ 640 Hz, each drifting ±12 % by
  its own slow random walk (6–14 s) — wind finding the gaps in a plank wall. −26 dB bus.
- *Gusts:* **occasional**, one every 12–30 s at random: 1.8 s swell, +8 dB, resonances ×1.3, 700 ms attack, 1.1 s decay.
  Replaces the 0.13 Hz sine LFO.
- **I:** the 640 Hz resonance is slightly unstable — it whistles for ≈ 200 ms a few times a minute.
- *Switch:* on the public pool-empty event (`DREW_FROM_POOL.poolEmpty`), a fixed **400 ms equal-power crossfade** (currently
  it changes 1.5–2 s after the *view* arrives, not on the event's beat).

### 1.2 The table

**`table.turn` / `.turn.you` — the turn totem** · RETUNE
- *Source:* one wooden totem bar, mallet on thick oak. Keeps the six seat signatures (plank A/B/C × one or two knocks, 75 ms
  apart) — same timbre family, one tone per seat (see D8).
- *T:* felt-on-wood noise, bandpass 1.1 kHz, 3 ms. *B:* bar modes at 180 / 320 / 620 Hz, T60 160 / 90 / 45 / 25 ms × size.
  *L:* none. ≤ 200 ms, lands **on time**.
- **Chain:** each consecutive bonus turn by the same player raises pitch **+1.2 %**, up to 5 steps (+6 %); resets on a
  change of player. **Never a jingle:** one knock (or seat pair) per turn, no melody.
- **I:** the second partial is detuned +1.5 % from the bar ratio.
- `.you` = the same signature plus a soft plank-D knock 130 ms later (a public fact: it is your turn).

**`table.bonus`** · KEEP/RETUNE — the asker's own signature again, −4 dB, softer mallet; carries the chain rise.
**`table.skipped`** · RETUNE — the stunned seat's signature muffled (cloth over the bar); the jaw-harp wobble goes, replaced
by one dead knock (stopped, no ring).

**`table.ask` — the hard knock** · RETUNE
- Paper flick (bandpass 3 kHz, 25 ms) → the target's signature, harder mallet (+2 dB, 2 ms transient). **Lands exactly on
  the beat** (`BEAT.askCue`). 3 var.
- **I:** the paper flick precedes the knock by a slightly different gap each take (70 / 80 / 95 ms).

**`table.asked`** · KEEP — the target's plank rises: three plank-D taps (the only 3-onset figure). Public fact ("you were
named aloud").

**`table.give` — hand-over, the answering knock** · RETUNE
- *Feel:* the answer lands **35–65 ms late** (a fixed function of the public seed), so the ask and answer sound like two
  hands, not a grid.
- *T:* **paper scuff**, not a snap — bandpass 1.6–2.4 kHz, 6 ms attack, 25 ms decay, −20 dB re body. *B:* dull ink-press thud,
  sine 118 → 70 Hz over 55 ms + tanh, plus board noise bandpass 380 Hz Q 1, 30 ms; heavier/lower per `count` (public).
  *L:* board ring, 210 Hz low-passed, 60 ms. ≤ 340 ms; 3 var.
- **I:** take B cuts its tail ≈ 9 ms early.

**`table.gofish` — the "Pescuiește!" refusal** · RETUNE
- The current one is one large bubble with an *upward chirp* plus small bubbles — a cartoon bloop, the "casual mobile pop".
  New: a flat hand on the board (dull thud, weight 0.9) → if the pool has water, one drip (the §1.1 drip recipe) 40 ms later.
  Pool empty (`table.gofish.dry`, KEEP): thud only, plus a short skid of plank-D ticks. Lands **late** like the give. _[as built: the drip follows the hand by 115 ms, not 40: at 40 ms it shared a rhythm with the Shark's flam, and at 100 ms with a seat's second knock (75 ms) — the confusability check caught both]_
- Identical for honest refusal and Squid deny/claim — see §4.

**`table.flight`** · KEEP (paper flutter) · **`table.draw`** · RETUNE — a card lifted from the water: paper lift + one small
drip; same whatever the card. 3 var. **`table.refill`** · KEEP — `draw × count`, 90 ms apart.

**`table.lay` — set laid, open** · RETUNE (normal/eggs sets are always face up; power sets in Mode Deschis are face up)
- Three pressings, each heavier (the dull ink-press thud + faint scuff of `table.give`, *not* the current 12 ms snap),
  then the ink stamp. 425 ms (speaker 204 ms). 3 var.
- **`table.lay.power`** (open power set, Deschis) = `table.lay` + one low dobă hit. The same for all nine ranks.
- **`table.lay.hidden`** (power set in Mode Ascuns, face down) · NEW — the same three pressings, but the stamp is replaced
  by a muffled board turn-over: cloth scuff (low-passed 1.2 kHz) and a dead thump, no ink peel. Then the dobă hit.
  Which of the four plays is a function of `config.powerVisibility` and `isPowerSet` only — never of the rank.
- **I:** the third pressing is 10 ms early on take C.

**`table.egg` — the wildcard tick** · NEW · 40 ms each, ochre register, 3 var.
- *Source:* a small unglazed clay egg tapped on a board. *T:* bandpass 4.2 kHz, 1.5 ms. *B:* two non-harmonic modes,
  740–840 Hz and ×2.2 (1.6–1.85 kHz), T60 38 / 20 ms, 3 % downward drop in the first 10 ms. No tail.
- Played **only** from `SET_LAID.eggCount` (public), one tick per egg, 55–80 ms apart, starting 90 ms after the last
  pressing. **Eggs are never sounded on a draw or any private action** — a draw is a draw (§4).
- **I:** the lowest take carries a faint buzz (a hairline crack in the glaze).

**`table.poolEmpty`** · KEEP/RETUNE — drain gurgle, board thud, hollow basin ring (≤ 1.2 s). Triggers the `amb.pond` →
`amb.wind` crossfade on the same beat.
**`table.tally`** (podium pips) · RETUNE (D11) — currently rises 2 semitones per pip up to 18 pips = a three-octave scale.
Proposal: unpitched plank-D ticks, ±5 % jitter, no rise.

### 1.3 The powers

Only **Shark, Mantis Shrimp and Whale** may leave the palette. Each breaks it in its own way; the other five stay in
wood/paper/board.

**`power.shark` — frame-break #1** · RETUNE · ≤ 460 ms
- *T:* the jaws on hardwood — a **cracked-wood transient**, noise high-passed 2.8 kHz, 2 ms, doubled 7 ms later (a splinter).
- *B:* dobă thump, sine 95 → 52 Hz, **40 ms after** the snap (the flam that keeps it apart from seat A).
- *L:* **splintering fibres** — ≈ 12 micro-bursts of noise 2–6 kHz, density decaying over 180 ms; water churn under it.
- **I (the wrong-sounding partial):** an inharmonic ring at 1870 Hz, 25 ms, −18 dB.

**`power.mantis` — frame-break #2** · RETUNE · ≤ 300 ms
- *T:* club crack (noise high-passed 3.5 kHz, 1.5 ms) then five shell-crack clicks 60 → 20 ms apart. *B:* board thud at
  weight 1.6. *L:* frame splinter — descending granular fibres 5 → 1.2 kHz over 120 ms.
- **I:** a detuned pair at 2630 Hz / 2667 Hz that beats at 37 Hz for 40 ms.

**`power.whale` — frame-break #3, the largest and lowest** · RETUNE · ≤ **1.4 s** (currently 1358 ms)
- *T:* a heavy plank slam, cracked-wood front (0–120 ms). *B:* a wooden **hull groan** 60–700 ms — a 55 Hz pulse
  low-passed and swept 300 → 120 Hz, resonant creak (bandpass 90–140 Hz Q 10, swept down over 400 ms), plus its
  harmonics at 165 / 220 / 330 Hz through tanh so phones hear it. *L:* the shuffle of the two hands — paper riffle
  (30–45 clicks, sparse-dense-sparse, 500–1300 ms) and three landing slaps at 1.14 / 1.22 / 1.30 s _[as built: earlier than designed so the cue ends inside 1.4 s]_.
- **I (the wrong partial):** the groan's 3rd harmonic is 45 cents sharp.
- Speaker variant unchanged in spirit: riffle in 170 ms + one landing (≤ 250 ms).

**`table.impact`** · RETUNE — the weight of a strike on the board. Now plays **only** under Shark (0.8), Mantis (1.0),
Whale (1.0); currently it also plays under Tortoise, Jellyfish, Stickleback and Lanternfish (weights 0.55–0.75).
**`power.windup`** · RETUNE — the 240 ms noise riser now precedes only the three frame-breakers.

**`power.tortoise`** · KEEP (in palette) — two board thuds, then the cards slap back. No impact layer.

**`power.jellyfish`** · RETUNE — the drâmbă (jaw harp, metal) goes. *Source:* a wooden rattle that loses its rhythm: five
damped plank-D taps, gaps 32 / 44 / 64 / 96 / 144 ms _[as built: the design's 40 / 55 / 80 / 120 / 180 would have run past 460 ms]_, f0 falling 1100 → 800 Hz. **I:** the last tap starts mid-envelope
(missing its attack — "stuttering broken stroke"). ≤ 450 ms.

**`power.lanternfish` (reflect)** · RETUNE — the țambal glint goes. *Source:* the ask coming back. The target's signature
struck with a **reversed envelope** (swell 90 ms, then chopped), then the asker's signature struck normally. All plank/bar.
**I:** the reversed knock is tuned 2 % sharp. ≤ 400 ms.

**`power.stickleback` / `.miss`** · KEEP — barbed paper scrape and a whip / the scrape hollow, then a dead tap.

**`power.granted`** · RETUNE, and **uniform in both modes for every rank** — a power came into being. *Source:* a peg driven
into a wooden rack. *T:* two dull plank-D taps 70 ms apart (1000 then 900 Hz, damping 0.8). *B:* a rope-twist creak, bandpass
700 → 520 Hz Q 6 over 220 ms with a 30 Hz grain, −14 dB. No tail. ≈ 300 ms, 3 var. **I:** the second tap is 15 ms late.
- Replaces the țambal shimmer, `power.granted.<rank>` (×8) and `power.granted.mine`.

**`power.reveal`** · KEEP — three plank-D clacks then an ink stamp when a face-down set first flips (Ascuns `POWER_USED`).
400 ms.

**`power.clownfish.bound`** · RETUNE, Deschis only — one peg-in-slot tap and a short creak, 200 ms. Ascuns: silent for
everyone (the event is owner-only there, so the owner's client says nothing either).

**Squid: no cue, no id, no motif, no reveal, no clock effect.** `SILENT_RANKS` and the absence of any Squid row in
`cuesheet.ts` stay.

### 1.4 The clock and meta

**`clock.tick` / `clock.tick.urgent` / `clock.close`** · KEEP (retune levels) — dry, stopped plank-D click; 1 per second
from 5 s remaining, then a double click every 500 ms in the last 3 s. **Tightened by spacing, not volume:** the urgent
click's level becomes equal to `clock.tick` (today +2 dB). Timing follows the server's deadline exactly (no jitter on
the schedule; ±5 % pitch only). Sits on its own Clock bus at −8 dB.
**`meta.join` / `.leave` / `.reconnected` / `.nudge`** · KEEP. **`amb.gate`** (stall creak) · KEEP.
**UI cues (`ui.*`)** · KEEP — all wood/paper/board; none is a sine bleep.

### 1.5 To be removed (defaults; see §7)

`power.used.{shark,tortoise,lanternfish,mantis,jellyfish,stickleback,whale,clownfish}` (8 motifs) · `power.granted.{…}` (8)
· `power.granted.mine` · `clock.eligible` · `table.lead` · `table.breakaway` · `table.chase` · `table.clinch` ·
`mus.end.win/tie/lose` · `mus.lastset` (folded into `world.dark.01`) · `amb.life` (birds, fish, reeds) · `amb.lastact`
(dobă pulse) · the țambal, drâmbă and fluier/caval renderers only they use. Net: 26 cue ids removed, 7 added (`mus.podium`, `world.dark.12/.06/.01`, `world.notch`, `table.egg`, `table.lay.hidden`).

---

## 2. Event → cue table

"Reads" refers to the field IDs of §3. "±" is the humanising lag/jitter of §5. All offsets are ms from the step's start
(`BEAT.*` in `cues.ts`, which stays the audio truth; visuals follow it).

| Trigger (what the client actually receives) | Cue(s) | Offset | Reads |
|---|---|---|---|
| `GAME_STARTED` | `mus.start` | 0 | E1 |
| `TURN_STARTED` (another player) | `table.turn` | 760 (2400 after start) | E2, V1, S1 |
| `TURN_STARTED` (you) | `table.turn.you` | same | E2, V1, S1 |
| `BONUS_TURN` (asker keeps the turn) | `table.bonus`, chain +1.2 % | 620 | E3, V1 |
| `TURN_SKIPPED_STUNNED` | `table.skipped` | with turn slot (+420 each) | E4, V1 |
| `HAND_REFILLED` | `table.refill × min(4,count)` | 0 | E5 |
| `REQUEST_MADE` | `table.ask` | 250 | E6, V1 |
| view: `RESPONSE_PENDING` enters, you are the named target | `table.asked` | 340 | V3 |
| view: `RESPONSE_PENDING` present | `clock.tick*` per the server deadline (last 5 s only) | server clock | V3, V4 |
| view: `RESPONSE_PENDING` leaves, whatever replaces it (answer, **timeout**, server skip) | `clock.close` (the answering device already played it at its press) | 0 | V3 |
| `REQUEST_SUCCEEDED` | `table.flight`, `table.give` (late ±) | 100, 450 + lag | E7 |
| `REQUEST_FAILED` — the "Pescuiește!" refusal | `table.gofish` (wet if pool > 0, else `.dry`), late ± | 300 + lag | E8, V2 |
| `DREW_FROM_POOL` | `table.draw` | 600 | E9, V2 |
| `DREW_FROM_POOL` with `poolEmpty` (the last card) | `table.poolEmpty` + pond→wind crossfade | 600 | E9 |
| `SET_LAID`, normal / eggs (face up) | `table.lay` (+ `table.egg × eggCount`) | 0 | E10, V5 |
| `SET_LAID`, power set, Mode Deschis (open) | `table.lay.power` (+ eggs) | 0 | E10, V5 |
| `SET_LAID`, power set, Mode Ascuns (hidden) | `table.lay.hidden` (+ eggs) | 0 | E10, V5 |
| **eggs / wildcards** | `table.egg` per egg in the laid set — never on draw, hand-over or refill | after lay | E10 (`eggCount`) |
| a set completed (any) → set count | covered by `SET_LAID` above; `sets.possible` change → `world.notch × Δ` | 300 | V6 |
| `POWER_GRANTED` (any rank, either mode) | `power.granted` (uniform) | 0 | E11 (`playerId` only) |
| `POWER_USED`, Mode Ascuns | `power.reveal`, then the effect cue | 0, then 450 | E12 |
| `POWER_USED`, Mode Deschis | the effect cue (no reveal) | 300 | E12 |
| `SHARK_JUMP` | `power.windup`, `power.shark`, `table.impact(0.8)` | strike | E13 |
| `SET_DESTROYED` (Mantis) | `power.windup`, `power.mantis`, `table.impact(1.0)` | strike | E14 |
| `WHALE_SHUFFLE` | `power.windup`, `power.whale`, `table.impact(1.0)` | strike | E15 |
| `JELLYFISH_STUN` | `power.jellyfish` | strike | E16 |
| `LANTERNFISH_REFLECT` | `power.lanternfish` | strike | E17, V1 |
| `TORTOISE_BLOCK` | `power.tortoise` | strike | E18 |
| `STICKLEBACK_STEAL` / `_WASTED` | `power.stickleback` / `.miss` | strike | E19 |
| `CLOWNFISH_BOUND` | Deschis: `power.clownfish.bound`. Ascuns: nothing | 0 | E20 |
| **Squid, in any form** | **nothing. No event exists, no cue exists.** | — | — |
| `sets.possible` crosses **12** downward | `world.dark.12` + ambience step 1 | after the lay's notch beat | V6 |
| `sets.possible` crosses **6** | `world.dark.06` + ambience step 2 | same | V6 |
| `sets.possible` reaches **1** ("the last set") | `world.dark.01` + bare tulnic note (≤ 1.2 s) + ambience step 3 | same | V6 |
| `endPressure.misses` reaches N/2, then resets | `amb.gate` shut / open | 300 / 200 | V7 |
| turn totem change | `table.turn*` (row above) | — | — |
| `WINDOW_OPENED` / `WINDOW_CLOSED`, structural (`TURN_START`, `REQUEST_DECLARED`, `TRANSFER_PENDING`, `SET_COMPLETED`, `TURN_END`) — open, close **or timeout** | **silent, for every client, eligible or not** | — | none (deliberately unread) |
| `GAME_ENDED` | `mus.podium`; `table.tally` per pip (unpitched) | 0; 900 + 110 k | E21, V8 |
| player joins the waiting room / rejoins | `meta.join` | 0 | R1 |
| player leaves / disconnects | `meta.leave` (damped) | 0 | R1, V9 |
| you reconnect (snapshot) | `meta.reconnected`; **no replay** of missed events | 0 | — |
| your turn idle 15 s | `meta.nudge` | 15000 | V1 |
| answer/other inputs you make | `ui.*` (local, only for actions whose possibility was public) | 0 | — |

Structural-window timeouts have **no event of their own**: they close through the same path as an answer, so there is
nothing to voice and nothing for a cue to key on — by construction, not by discipline.

---

## 3. Public fields a cue may read — and nothing else

_[as built]_ The mapping layer (`cuesFor`, `audio/cues.ts`) receives the raw record and immediately projects it: one function,
`soundInputOf`, copies exactly the fields below into a fresh object, and everything after it reads only that object. The list
exists in code as `SOUND_FIELDS`. Before, `record.ts` projected the *view* but passed `events` through as raw wire objects, so a
cue could have read `cardId`, `grantId` or `rank` at runtime and only the tests stood in the way. Now `test/soundfields.test.ts`
hands `cuesFor` a Proxy over a record stuffed with every private field and fails on any property read that is not on this list
(and a second test proves the spy can fail). The table below is the as-built list; it is *narrower* than the design's.

**Events**
| ID | Event | Fields |
|---|---|---|
| E1 | `GAME_STARTED` | `type` |
| E2 | `TURN_STARTED` | `type`, `playerId` |
| E3 | `BONUS_TURN` | `type`, `playerId` |
| E4 | `TURN_SKIPPED_STUNNED` | `type`, `playerId` |
| E5 | `HAND_REFILLED` | `type`, `count` |
| E6 | `REQUEST_MADE` | `type`, `targetId` *(not `rank`, though it is spoken aloud — no cue needs it)* |
| E7 | `REQUEST_SUCCEEDED` | `type`, `count` |
| E8 | `REQUEST_FAILED` | `type` |
| E9 | `DREW_FROM_POOL` | `type`, `poolEmpty` **(never `cardId`)** |
| E10 | `SET_LAID` | `type`, `isPowerSet`, `eggCount` **(never `rank`, `setId`)** |
| E11 | `POWER_GRANTED` | `type` **(never `playerId`, `rank`, `unbound`, `grantId`, `sourceSetId`)** |
| E12 | `POWER_USED` | `type` **(never `rank` — public at the moment of use, but no cue needs it — nor `grantId`)**. A Squid use has no event; `record.ts` also drops one before anything sees it, as defence in depth |
| E13 | `SHARK_JUMP` | `type` |
| E14 | `SET_DESTROYED` | `type` |
| E15 | `WHALE_SHUFFLE` | `type` |
| E16 | `JELLYFISH_STUN` | `type` |
| E17 | `LANTERNFISH_REFLECT` | `type`, `playerId` (the reflector's seat), `fromId` (the seat whose ask came back) |
| E18 | `TORTOISE_BLOCK` | `type` |
| E19 | `STICKLEBACK_STEAL`, `STICKLEBACK_WASTED` | `type` (both are public events; `count` unused) |
| E20 | `CLOWNFISH_BOUND` | `type` only — Deschis. **(never `boundRank`, `grantId`)** |
| E21 | `GAME_ENDED` | `type` |
| — | `WINDOW_OPENED`, `WINDOW_CLOSED` | **not read at all** (incl. `youAreEligible`, `context`) |

**View (redacted, per viewer — but only these fields, which are identical for every viewer)**
| ID | Field |
|---|---|
| V1 | `players` (the turn order, as `turnOrder`: the seat index of a player id); the viewer's own id (`facts.playerId`, for "your turn" and "you were asked") |
| V2 | `poolCount` (before / after) |
| V3 | `window.type === 'RESPONSE_PENDING'` and `window.askerId` / `.targetId` (spoken aloud) — the answer window only |
| V4 | `pendingWindow.deadlineAt`, `serverNow` — read by `clockTarget` and the window clock, not by `cuesFor` (one number for everyone) |
| V5 | `mode` (`config.powerVisibility`) |
| V6 | `setsPossible` (`sets.possible`, before / after) |
| V7 | `endPressure.misses`, `.limit` |
| V8 | `scores` (only the highest, for the number of podium pips) |
| V9 | `players[].connected` — read by `presenter.ts` and the waiting-room hook to play `meta.join` / `meta.leave`, not by `cuesFor` |
| D1 | `chain` (the run of bonus turns, kept by the presenter from `BONUS_TURN` / `TURN_STARTED` events — `chainAfter`) |
| D2 | `ordinal` (how many cues this client has been handed: seeds the variation; see §4) |

**Room message:** R1 = `room_update.players[].id`, `.connected` (waiting-room joins/leaves; `hooks/useLobbyAudio.ts`).

**Explicitly forbidden (the Proxy test asserts none is ever touched):** `hand`, `ownPowerGrants`, `pendingWindow.youAreEligible`,
every other `pendingWindow.context` key, `cardId`, `grantId`, `sourceSetId`, `unbound`, `boundRank`, `laidSets[]` (any field),
`SET_LAID.rank`/`.setId`, `POWER_GRANTED.*`, `POWER_USED.rank`, `WINDOW_OPENED.*`, `winners` (the podium is one cue), the
viewer's `eligible` / `eligibleBefore` / `grantRank` / `headphones` facts (they remain in `SeatFacts` for haptics only), and the
room's `seq`.

---

## 4. Secrecy and timing analysis

**Squid.** No Squid cue exists. I read the engine and client path to find what could still differ:
- The engine closes an honest "no", a Squid deny and a Squid claim through the same `closeWindow`, emitting
  `WINDOW_CLOSED(RESPONSE_PENDING) › REQUEST_FAILED › DREW_FROM_POOL › TURN_STARTED` in each (`engine.ts`, `DECISIONS.md`
  "Every response is a window"); Squid emits **no** `POWER_USED` (`recordPowerUsed`, engine line ~973).
- Every cue above reads only fields that are equal in those three worlds (E-rows and V-rows). `REQUEST_FAILED` reads
  no fields; `table.gofish` reads `poolCount`, which the draw changes identically.
- _[as built]_ Re-checked against the new code, by reading and by test. By reading: the only other places that play sound are
  `Windows.tsx` (the answering press: `truth` and `lie` both call `send(..., { cue: true })`, which plays `localAnswerCue(view.seq)` —
  one cue, seeded from the view being answered, whichever button), `GameTable.tsx` (`ui.*` for the table's own controls, `meta.reconnected`),
  `presenter.ts` (the cues `cuesFor` returned; `meta.join/leave` from `connected`, `meta.nudge` from your own idle turn) and `Codex.tsx`
  (a preview; Squid is a rest). None reads a hand, a grant or an eligibility flag. By test: `cues.test.ts` asserts an honest no, a Squid deny and
  a Squid claim give identical `(id, at, durMs, params, seed)` for every viewer, and that a Squid grant sounds exactly like any grant;
  `presentation-leak.test.ts` (real engine games, redacted per viewer) asserts the same through the choreography.
- **One rules-level tell I cannot fix from audio** (already documented, `DECISIONS.md`): a third player's Clownfish that
  binds to a silently-used Squid learns, owner-only, that one was used. Not audible to anyone else; not touched.

**Draws, hidden lays, private cards.** `DREW_FROM_POOL` carries `cardId` to the drawer only; the cue reads `poolEmpty`
and `poolCount`. `table.egg` reads `eggCount` of a *laid* set (public in the view by design) and is never played on a draw,
refill, hand-over or Whale shuffle, so an egg is never audible until it is on the table. Hidden lays sound as a function of
`(powerVisibility, isPowerSet, eggCount)` — the same for all nine ranks.

**Latency, duration, count.** Every timing is either a constant (`BEAT.*`), the server's deadline, or a humanised lag drawn
from a *public* seed (§5). Every cue declares its duration statically (`durMs`) from its definition and public params
(`count`, `eggCount`, notches Δ) — never measured from a private render. Step 2's test compares `(id, delayMs, durMs)`
across private states and fails on any difference.

**Interrupt windows — what I can and cannot promise.**
- **Achievable, and done by design:** identical audio for every client. The answer window ticks and closes the same for
  everyone (it always opens, for every ask, and its identity is public). Every structural window is silent for everyone —
  the eligible player too. This needs removing `clock.eligible`, which is the only reason those windows currently differ
  by client (D3).
- **Impossible without a protocol change, so flagged, not changed:** *that a structural window opens at all, and how long
  it lasts, is visible in the public view* (`TURN_START` / `REQUEST_DECLARED` / `TRANSFER_PENDING` / `SET_COMPLETED` /
  `TURN_END` open only when someone holds the matching power). Audio staying silent through it does not hide the
  pause. This is `DECISIONS.md` "Uniform windows: decided and deferred" (§11.1), covered by five `it.fails` tests. It
  stays your call.
- A player who deliberates for a long time before answering is audible to the table once the clock starts ticking (last
  5 s). That is public information (the wait itself), not a leak of a hidden field.

**Seeds.** _[as built, D10]_ Variation used to be seeded from the room `seq`, which counts events a given viewer never receives
(owner-only `CLOWNFISH_BOUND` in Ascuns). It is now seeded from the cue's own place in the run of cues this client has been
handed (`record.ordinal + index in the step`), which is a count of *voiced public cues*. Building that surfaced a second
requirement my first attempt (a hash of the step's content) missed: a silent structural window splits one step into two, so
the seed must not depend on where a step is cut. The ordinal does not: `cues.test.ts` replays the five structural-window
histories and asserts the same cues, params, durations *and seeds* with the window in the way and out of it.

**Small findings.** `cues.ts` read `POWER_USED.viaClownfish`, which the wire never carries (a Clownfish copy is reported with
the copied rank): a dead branch, removed (`choreography.ts` still names it for the art, behind a cast). And my first cut of the
"two private states" test stuffed `rank: 'squid'` onto every event, `POWER_USED` included, and it failed — because a version of
the mapping that read `POWER_USED.rank` (to stay silent for Squid) changed its own timing. That is the argument for reading
no rank at all, and it is why the adapter, not the mapping, drops a (non-existent) Squid use.

---

## 5. Variation, feel and mix

- **Frequently repeated cues** (`table.turn/ask/give/gofish/draw/lay`, `world.notch`, `table.egg`, drips): **3 discrete takes**
  (take = public seed mod 3, each with a distinct character — e.g. pitch −4 % / 0 / +4 %, attack ±1 ms), on top of a
  continuous **±5 % pitch**, **±1.5 dB gain** and **±6 ms timing** jitter. Today they use continuous seeded variation with
  ±3 % pitch and no discrete takes.
- **Chains rise:** consecutive bonus turns +1.2 % each, capped at +6 %.
- **Feel, not a grid:** hard knocks (`table.ask`, the strike of a power) land on the beat; answering knocks
  (`table.give`, `table.gofish`) land 35–65 ms late; the two never share an onset.
- **One imperfection per sound** — listed as **I** for each cue above. Chosen, not random.
- **Mix.** SFX above ambience (ambience bus −26 dB, unchanged). Ambience ducks −10 dB under: `mus.start`, `mus.podium`,
  `world.dark.*`, `power.shark`, `power.mantis`, `power.whale`, `power.reveal` — all rare, so it does not pump; not under
  frequent table cues. Global voice cap 14 with per-bus caps and priority stealing (existing `voices.ts`). Harsh content is
  low-passed (tonal cues carry a 7 kHz low-pass and a −6 dB bell at 2 kHz for speech room; the tulnic is low-passed at
  900–1100 Hz). Nothing below 150 Hz is relied on (speaker profile high-passes there; weight lives in 120–400 Hz
  harmonics).
- **Signature moments** — the reveal (400 ms), the last set (≤ 1.2 s), the whale (≤ 1.4 s) — are ≤ 1.4 s and are
  fire-and-forget on the audio clock; input is never gated on any audio.

---

## 6. Product behaviour (already implemented; verified by reading, not on a device)

- **Unlock** on the first `pointerdown` / `keydown` / `touchend` (`context.ts`); `resume()` inside the gesture;
  `navigator.audioSession.type = 'ambient'` where present; iOS `interrupted` state treated as suspended and resumed.
  *Not verified on iOS Safari here — no device.*
- **Mute + volumes, persisted** (`mixer.ts`, `localStorage`, all access in try/catch): master mute, master volume, and
  separate effects / interface / ambience / music volumes, plus "softer sounds" and mono. Your brief asked for master +
  SFX + ambience; the extra sliders already exist and stay.
- **Hidden tab:** context suspended after 30 s hidden, resumed on return; queued cues that went stale are dropped rather
  than played late.
- **Audio is never the only channel:** every voiced event already had a visual (plank, chip, flight, log line, `aria-live`
  announcer) — except one. _[as built]_ The eggs in a set laid (`table.egg`) were audio-only: nothing on screen or in the log
  said how many eggs a set used, though `eggCount` is public. The log line for a set laid now says so (`log.setLaidEggs`,
  `log.setLaidHiddenEggs`, in both languages and both lengths). `test/soundtwins.test.ts` walks from each new cue to its twin: the
  egg line, the hidden-lay line, the rim's notch (as many ticks as notches knocked out), the light's step and its screen-reader
  announcement, the podium, the start beat, the seconds on the plank.

---

## 7. Decisions (each was applied at its default; nobody vetoed)

| # | Decision | Applied |
|---|---|---|
| D1 | Remove the five in-palette powers' melodic motifs (Tortoise, Lanternfish, Jellyfish, Stickleback, Clownfish) and `power.granted.<rank>`; give them wood/paper/board recipes. Keep/retune Shark, Mantis, Whale as the frame-breakers. Risk: the plan (§3.2) kept tonal cues so voice-chat noise suppressors would pass them to other players; knocks have less harmonic content. | yes |
| D2 | Remove țambal-based cues: uniform `power.granted` shimmer, Lanternfish glint, and the four score-race cues (`lead/breakaway/chase/clinch`). | yes |
| D3 | Remove the private (headphones) tier: `clock.eligible`, `power.granted.mine`, Ascuns `power.clownfish.bound`. Cost: an eligible player gets no *audible* prompt in a structural window; they still get the plank, the clock and the visual. | yes |
| D4 | One podium call for everyone instead of win/tie/lose music. (The podium screen already says who won.) | yes |
| D5 | Drop the dobă heartbeat (`amb.lastact`) and the pond's "life" layer (birds/fish/reeds) — the 12/6/1 steps replace the countdown. | yes |
| D6 | Allow ambience ducking under the rare signature cues only, overriding `DESIGN.md` §0.1 row 7.5 ("no ducking"). | yes |
| D7 | Gate the audition lab with `import.meta.env.DEV` so production carries no lab chunk. | yes |
| D8 | Turn totem: keep six seat signatures in one timbre family (so "who" is audible), or literally one tone for everyone. The blindfold test that validates seat identification was never run (README, "Not built"). | kept six (one timbre family, each bar's second partial 1.5 % off) |
| D9 | Drip pitch: your brief says a fast pitch **drop**. Physically, an entrained bubble's pitch tends to *rise*, so the existing bubbles rise. I follow the brief. The lab will offer both directions as takes so you can choose by ear. | drop; the lab has both directions (a `drip: rises` button) |
| D10 | Seed variation from the public-event ordinal, not `seq`. | yes |
| D11 | Podium pips: unpitched ticks (default) or remove entirely. | unpitched, still one per pip |

---

---

## 8. As built

**Where the build differs from the design that was reviewed**
- _Seeds:_ the variation is seeded by the cue's place in the run of cues handed out (`ordinal`), not by a hash of the step (§4).
- _POWER_USED / POWER_GRANTED:_ read no fields at all (the design allowed `rank` / `playerId`); the adapter drops a Squid use.
- _Valley:_ low-passes 1000 / 650 / 420 Hz instead of 2600 / 1500 / 800 (the design's were above the horn's roll-off; measured, §9).
- _Levels:_ `power.mantis` −4.5 dB, `power.lanternfish` and `power.tortoise` −1.5 dB, `table.gofish` −2.5 dB (the limiter was moving
  them by 1-3 dB), the two clock cues −1.2 dB (ten loudness units over the loudest bed, with the bed's window at 12-20 under the anchor).
- _Crack:_ band-limited to 3-6 kHz; at 8 kHz Mantis' inter-sample peaks crossed −1 dBTP.
- _Confusability fixes:_ the `table.gofish` drip at +115 ms, the speaker Mantis' clicks 40 ms in, the speaker `table.egg` at 55 ms.
- _Eggs get a log line_ (§6), which the design did not foresee.
- _Codex:_ its "motif" buttons now play each power's own cue and the stave drawing is gone; its copy no longer says "motif" or "stave".
- _Tests added or rewritten:_ `cues`, `cuesheet`, `recipes`, `engine`, `choreography`, `world`, `presentation-leak` (re-pointed at the new
  palette); new `soundfields` (the Proxy), `soundguards` (source rules), `soundtwins`, `horn` (pitches by FFT). `motifs.test.ts` is gone with the motifs.

**Removed:** 26 cue ids (§1.5), `motifs.ts`, the țambal / breath / drâmbă renderers, the private tier, the dobă pulse, the pond's birds, fish and reeds.

---

## 9. Measured, and not

Measured by `npm run audio:check --workspace=packages/client` (esbuild + headless Chromium + `OfflineAudioContext` at 48 kHz, the product's
recipes → per-voice mastering → buses → stems → profile EQ → program gain → the same limiter the worklet runs). **13 of 13 checks pass**:
plank grammar · confusability · echo budget · peaks (true peak ≤ −1 dBTP in a 3-minute scene and the six-cue pile-up; the soft clip never
engages) · headroom · ambience (12-20 LU under the anchor in five pond states) · clock (≥ 10 LU over the loudest bed) · balance ·
**palette** (only Shark, Mantis, Whale break the frame, and all three do) · **duration** (nothing but the call and the podium over 1.4 s) ·
**the valley** · **the darkening steps** · calibration. The last four are new.

| Scene | Speaker | Headphones |
|---|---|---|
| whole mix, integrated | −29.5 LUFS | −32.2 LUFS |
| short-term max | −22.6 LUFS | −24.3 LUFS |
| true peak, scene / six-cue burst | −1.3 / −1.4 dBTP | −1.5 / −1.5 dBTP |
| limiter, max gain reduction / time over 1 dB | 2.5 dB / 0.08 % | 2.5 dB / 0.002 % |
| soft-clip samples | 0 | 0 |
| bed under the anchor (five states) | 14.1 to 19.8 LU | 13.3 to 19.1 LU |

The tulnic, measured on the rendered `mus.start` (headphones variant): each held note's pitch is its partial of 58 Hz within 2.5 %
(`test/horn.test.ts`, FFT); the three repeats begin at 3.55 / 4.95 / 6.65 s (designed 3.5 / 4.9 / 6.6, plus half a 40 ms frame), at
−8.2 / −14.9 / −22.0 dB re the dry gesture (designed −9 / −16 / −23) and at −22.4 / −30.8 / −38.5 dB brightness (energy above 1.2 kHz re
below; the dry gesture is −19.3). The three darkening steps land at −1.5 / −3 / −4.5 dB at 300 Hz (measured within 0.03 dB of designed) and at the designed
low-pass at 3 kHz (within 0.2 dB), in a 20 ms ramp (10-90 %), with a click ratio of 1.00.

Per cue, one rendering (seed 3; headphones variant, before the chain; "speaker" and "headphones" columns after the chain):

| Cue | Active ms (sheet max) | Raw sample peak dBFS | Active LUFS | Momentary max LUFS | Speaker: sample / true peak dB | Headphones: sample / true peak dB | Clipped samples |
|---|---|---|---|---|---|---|---|
| `ui.press` | 41 (60) | -6.4 | -21.9 | -31.8 | -7.9 / -7.9 | -14.4 / -14.4 | 0 |
| `ui.press.soft` | 26 (60) | -9.5 | -23.4 | -35.3 | -12.0 / -12.0 | -19.4 / -19.3 | 0 |
| `ui.select` | 59 (90) | -9.2 | -25.2 | -33.5 | -9.9 / -7.3 | -15.8 / -15.8 | 0 |
| `ui.drop` | 60 (90) | -14.7 | -30.4 | -38.7 | -12.9 / -12.8 | -17.2 / -17.1 | 0 |
| `ui.target` | 96 (90) | -10.8 | -26.8 | -33.0 | -8.0 / -8.0 | -14.8 / -14.8 | 0 |
| `ui.error` | 89 (120) | -6.3 | -21.6 | -28.2 | -10.3 / -10.3 | -14.6 / -14.5 | 0 |
| `ui.toggle` | 61 (120) | -11.7 | -27.9 | -36.1 | -10.8 / -8.6 | -17.1 / -16.2 | 0 |
| `ui.copy` | 62 (120) | -6.2 | -20.4 | -28.5 | -10.8 / -10.8 | -17.0 / -17.0 | 0 |
| `table.turn` | 207 (200) | -6.5 | -23.0 | -25.9 | -7.0 / -7.0 | -10.4 / -10.4 | 0 |
| `table.ask` | 184 (200) | -4.5 | -22.7 | -26.1 | -4.4 / -4.4 | -7.2 / -7.2 | 0 |
| `table.turn.you` | 193 (190) | -6.5 | -22.6 | -25.7 | -2.2 / -2.2 | -6.9 / -6.9 | 0 |
| `table.bonus` | 214 (200) | -9.6 | -26.1 | -28.8 | -5.0 / -5.0 | -8.4 / -8.4 | 0 |
| `table.skipped` | 150 (400) | -8.0 | -28.3 | -32.5 | -3.5 / -3.4 | -7.1 / -7.1 | 0 |
| `table.asked` | 124 (120) | -8.0 | -24.5 | -29.6 | -3.7 / -3.7 | -5.0 / -5.0 | 0 |
| `table.flight` | 260 (260) | -12.8 | -23.5 | -25.4 | -13.7 / -13.5 | -18.2 / -17.7 | 0 |
| `table.give` | 342 (340) | -4.7 | -22.6 | -23.3 | -7.5 / -7.5 | -4.5 / -4.5 | 0 |
| `table.gofish` | 167 (350) | -1.3 | -22.6 | -26.4 | -1.5 / -1.5 | -3.7 / -3.7 | 0 |
| `table.gofish.dry` | 188 (190) | -2.3 | -23.8 | -27.1 | -2.7 / -2.6 | -4.2 / -4.2 | 0 |
| `table.draw` | 47 (140) | -8.3 | -24.8 | -34.0 | -7.5 / -5.0 | -10.1 / -8.8 | 0 |
| `table.refill` | 228 (360) | -7.2 | -26.8 | -29.2 | -6.8 / -2.9 | -8.4 / -6.3 | 0 |
| `table.poolEmpty` | 1032 (1200) | -6.5 | -24.5 | -22.7 | -3.2 / -3.2 | -5.3 / -5.2 | 0 |
| `table.lay` | 425 (450) | -3.5 | -23.0 | -23.2 | -2.9 / -2.9 | -1.5 / -1.5 | 0 |
| `table.lay.power` | 524 (450) | -2.1 | -19.4 | -18.4 | -1.5 / -1.5 | -2.4 / -2.4 | 0 |
| `table.lay.hidden` | 524 (450) | -2.1 | -20.0 | -19.2 | -2.7 / -2.7 | -2.3 / -2.3 | 0 |
| `table.egg` | 225 (330) | -2.5 | -21.6 | -24.1 | -9.5 / -9.5 | -11.2 / -11.2 | 0 |
| `table.impact` | 234 (380) | 5.3 | -12.7 | -15.1 | -2.4 / -2.4 | -3.9 / -3.9 | 0 |
| `table.tally` | 48 (90) | -8.3 | -24.3 | -33.5 | -7.9 / -7.9 | -10.0 / -10.0 | 0 |
| `world.dark.12` | 204 (180) | -7.6 | -24.1 | -27.0 | -2.7 / -2.7 | -3.9 / -3.9 | 0 |
| `world.dark.06` | 204 (180) | -7.7 | -23.7 | -26.6 | -6.4 / -6.4 | -2.8 / -2.8 | 0 |
| `world.dark.01` | 1267 (1320) | -7.5 | -16.4 | -14.0 | -11.7 / -11.7 | -16.3 / -16.3 | 0 |
| `world.notch` | 11 (50) | -9.6 | -21.2 | -36.8 | -16.4 / -16.3 | -20.6 / -20.6 | 0 |
| `mus.start` | 7961 (8300) | -7.0 | -18.4 | -12.1 | -13.6 / -13.6 | -18.5 / -18.5 | 0 |
| `mus.podium` | 2386 (2600) | -6.2 | -14.9 | -12.6 | -11.5 / -11.5 | -16.9 / -16.9 | 0 |
| `clock.tick` | 17 (60) | -13.9 | -28.3 | -42.0 | -6.7 / -6.6 | -13.7 / -13.7 | 0 |
| `clock.tick.urgent` | 64 (60) | -13.9 | -31.1 | -39.1 | -6.2 / -5.5 | -12.1 / -12.1 | 0 |
| `clock.close` | 56 (60) | -6.2 | -21.0 | -29.6 | -7.2 / -7.2 | -12.1 / -12.1 | 0 |
| `power.granted` | 265 (320) | -8.7 | -29.3 | -31.1 | -1.6 / -1.5 | -3.6 / -3.6 | 0 |
| `power.windup` | 245 (260) | -3.9 | -22.9 | -25.0 | -5.8 / -5.8 | -9.7 / -9.5 | 0 |
| `power.reveal` | 318 (400) | -3.6 | -22.0 | -23.0 | -1.6 / -1.6 | -1.5 / -1.5 | 0 |
| `power.shark` | 449 (460) | 2.5 | -15.2 | -14.7 | -1.5 / -1.5 | -1.7 / -1.7 | 0 |
| `power.mantis` | 202 (320) | -0.4 | -23.5 | -26.4 | -1.5 / -1.4 | -4.7 / -4.7 | 0 |
| `power.lanternfish` | 369 (400) | -5.8 | -23.8 | -24.2 | -1.5 / -1.5 | -3.6 / -3.6 | 0 |
| `power.tortoise` | 350 (450) | -0.1 | -21.8 | -22.4 | -1.5 / -1.5 | -2.3 / -2.3 | 0 |
| `power.jellyfish` | 412 (460) | -7.5 | -27.8 | -28.2 | -1.5 / -1.5 | -2.0 / -2.0 | 0 |
| `power.stickleback` | 229 (280) | -6.7 | -19.9 | -22.4 | -1.5 / -0.8 | -4.7 / -4.3 | 0 |
| `power.stickleback.miss` | 208 (200) | -13.5 | -31.8 | -34.6 | -1.5 / -1.5 | -1.6 / -1.6 | 0 |
| `power.whale` | 1334 (1400) | 1.0 | -19.8 | -15.1 | -1.5 / -0.1 | -1.5 / -1.5 | 0 |
| `power.clownfish.bound` | 200 (220) | -8.6 | -27.4 | -30.4 | -5.2 / -5.2 | -5.8 / -5.8 | 0 |
| `amb.gate` | 279 (400) | -34.4 | -46.4 | -47.9 | -49.5 / -49.5 | -52.9 / -52.9 | 0 |
| `meta.join` | 208 (200) | -8.4 | -24.9 | -27.7 | -5.0 / -5.0 | -8.4 / -8.4 | 0 |
| `meta.leave` | 135 (200) | -9.2 | -27.2 | -31.9 | -4.8 / -4.8 | -7.1 / -7.1 | 0 |
| `meta.reconnected` | 62 (200) | -6.2 | -20.3 | -28.4 | -12.7 / -12.7 | -17.7 / -17.6 | 0 |
| `meta.nudge` | 193 (200) | -6.5 | -22.6 | -25.7 | -4.2 / -4.2 | -8.9 / -8.9 | 0 |

**Not verified, and not claimed:** how any of it sounds (that is what the audition page and your ears are for); whether "carved,
dry, tense" is what a listener would say; iOS Safari's unlock and the silent switch; phone speakers, headphones, Bluetooth latency;
whether voice-chat noise suppression passes the knocks to the other players (the earlier plan kept tonal cues for that reason; D1
gives it up, unmeasured); whether the tulnic phrase and its partials are culturally right (`FEEL_VISUAL_SOUND_PLAN.md` §11.8 asks for a
Romanian folk-music consultant before anything is recorded, and this needs the same); real-device performance of the added nodes (Mantis
is 62 nodes, Shark 56, Whale 53, against a budget of 10 a hit that the harness reports but does not gate — the frame-breakers are rare);
the seat-signature blindfold test (D8), never run in this repo.
