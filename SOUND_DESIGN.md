# Sound design — Pescuiește Extins

**Status: Step 1, for review. Nothing has been built or changed except this file.**

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
harmonic series, no lip attack, no valley) · ≈ 3.1 s dry + echoes ≈ 7 s · ambience ducks −10 dB
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
- *Space:* not a reverb. **Three discrete repeats** of only the final falling gesture (partials 7→6→5, ≈ 1.2 s), starting
  at 3.5 s, 4.9 s, 6.6 s after the call begins: −9, −16, −23 dB, low-passed 2600 / 1500 / 800 Hz (each darker). Irregular
  spacing, like walls at different distances.
- **I:** the 7th partial is left ≈ 31 cents flat of its equal-tempered neighbour (true to a natural horn), and the last
  note is cut ≈ 40 ms early (the breath ran out before the note finished).
- *Never blocks input:* fire-and-forget on the Music bus; the first turn's cues (`BEAT.start = 2400 ms`) and all input run
  independent of it; it counts as one voice group for the cap.

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
  Pool empty (`table.gofish.dry`, KEEP): thud only, plus a short skid of plank-D ticks. Lands **late** like the give.
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
  (30–45 clicks, sparse-dense-sparse, 500–1300 ms) and three landing slaps at ~1.2 / 1.28 / 1.36 s.
- **I (the wrong partial):** the groan's 3rd harmonic is 45 cents sharp.
- Speaker variant unchanged in spirit: riffle in 170 ms + one landing (≤ 250 ms).

**`table.impact`** · RETUNE — the weight of a strike on the board. Now plays **only** under Shark (0.8), Mantis (1.0),
Whale (1.0); currently it also plays under Tortoise, Jellyfish, Stickleback and Lanternfish (weights 0.55–0.75).
**`power.windup`** · RETUNE — the 240 ms noise riser now precedes only the three frame-breakers.

**`power.tortoise`** · KEEP (in palette) — two board thuds, then the cards slap back. No impact layer.

**`power.jellyfish`** · RETUNE — the drâmbă (jaw harp, metal) goes. *Source:* a wooden rattle that loses its rhythm: five
damped plank-D taps, gaps 40 / 55 / 80 / 120 / 180 ms, f0 falling 1100 → 800 Hz. **I:** the last tap starts mid-envelope
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

The mapping layer receives a **projected** object, built by one function (`soundInputOf`) that copies exactly these and
drops everything else. Today `record.ts` projects the *view* but passes `events` through as raw wire objects
(`e as unknown as PublicEvent`), so a cue could read `cardId`, `grantId` or `rank` at runtime; the tests then stuff those
fields to prove nothing does. Step 2 makes that structural: events are projected too, and a Proxy test fails on any other
key access.

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
| E11 | `POWER_GRANTED` | `type`, `playerId` **(never `rank`, `unbound`, `grantId`, `sourceSetId`)** |
| E12 | `POWER_USED` | `type`, `rank` — public at the moment of use in both modes; `rank ≠ squid` always (no such event exists for Squid) **(never `grantId`)** |
| E13 | `SHARK_JUMP` | `type` |
| E14 | `SET_DESTROYED` | `type` |
| E15 | `WHALE_SHUFFLE` | `type` |
| E16 | `JELLYFISH_STUN` | `type` |
| E17 | `LANTERNFISH_REFLECT` | `type`, `fromId` (the seat whose ask came back) |
| E18 | `TORTOISE_BLOCK` | `type` |
| E19 | `STICKLEBACK_STEAL`, `STICKLEBACK_WASTED` | `type` (both are public events; `count` unused) |
| E20 | `CLOWNFISH_BOUND` | `type` only — Deschis. **(never `boundRank`, `grantId`)** |
| E21 | `GAME_ENDED` | `type` |
| — | `WINDOW_OPENED`, `WINDOW_CLOSED` | **not read at all** (incl. `youAreEligible`, `context`) |

**View (redacted, per viewer — but only these fields, which are identical for every viewer)**
| ID | Field |
|---|---|
| V1 | `turnOrder` (seat index of a player id); the viewer's own `viewerId` (for "your turn") |
| V2 | `poolCount` (before / after) |
| V3 | `pendingWindow.type === 'RESPONSE_PENDING'` and `pendingWindow.context.askerId` / `.targetId` (spoken aloud) |
| V4 | `pendingWindow.deadlineAt`, `serverNow` (the server-clock deadline; one number for everyone) |
| V5 | `config.powerVisibility` |
| V6 | `sets.possible` (before / after) |
| V7 | `endPressure.misses`, `.limit` |
| V8 | `players[].score` (only `max`, for the number of podium pips) |
| V9 | `players[].connected` |

**Room message:** R1 = `room_update.players[].id`, `.connected` (waiting-room joins/leaves).

**Explicitly forbidden (a Proxy test asserts none is ever touched):** `hand`, `ownPowerGrants`, `pendingWindow.youAreEligible`,
every other `pendingWindow.context` key, `cardId`, `grantId`, `sourceSetId`, `unbound`, `boundRank`, `laidSets[].rank` /
`.spent` / `.destroyedByMantis`, `SET_LAID.rank`/`.setId`, `POWER_GRANTED.rank`, `WINDOW_OPENED.*`, `winners` (podium is
one cue), and `seq` as a *seed* (§5).

---

## 4. Secrecy and timing analysis

**Squid.** No Squid cue exists. I read the engine and client path to find what could still differ:
- The engine closes an honest "no", a Squid deny and a Squid claim through the same `closeWindow`, emitting
  `WINDOW_CLOSED(RESPONSE_PENDING) › REQUEST_FAILED › DREW_FROM_POOL › TURN_STARTED` in each (`engine.ts`, `DECISIONS.md`
  "Every response is a window"); Squid emits **no** `POWER_USED` (`recordPowerUsed`, engine line ~973).
- Every cue above reads only fields that are equal in those three worlds (E-rows and V-rows). `REQUEST_FAILED` reads
  no fields; `table.gofish` reads `poolCount`, which the draw changes identically.
- I have *not yet* re-run this against the new code — Step 2 extends `presentation-leak.test.ts` so that the honest-no /
  Squid-deny / Squid-claim triple is asserted equal in cue ids, delays and durations for every viewer (the test exists for
  the current cues; it will be re-pointed at the new palette).
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

**Seeds.** Variation is currently seeded from the room `seq`. `seq` counts events a given viewer never receives (owner-only
`CLOWNFISH_BOUND` in Ascuns), so two worlds that differ only in a hidden event would produce different micro-jitter for the
same public step. Harmless in practice, but it would make my "identical delay" test conditional. Default (D10): seed from
the count of public events the client has presented, which is the same for everyone who has seen the same public record.

**Small finding:** `cues.ts` reads `POWER_USED.viaClownfish`, which the wire never carries (a Clownfish copy is reported
with the copied rank). It is a dead branch and goes.

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
- **Audio is never the only channel:** every voiced event already has a visual (plank, chip, flight, log line, `aria-live`
  announcer). Step 2 adds a test that enumerates cue → visual/announcer twin for the *new* cues (world steps, notch ticks,
  eggs, hidden lay).

---

## 7. Decisions I need from you (each has a default; I will follow the default unless you veto)

| # | Decision | Default |
|---|---|---|
| D1 | Remove the five in-palette powers' melodic motifs (Tortoise, Lanternfish, Jellyfish, Stickleback, Clownfish) and `power.granted.<rank>`; give them wood/paper/board recipes. Keep/retune Shark, Mantis, Whale as the frame-breakers. Risk: the plan (§3.2) kept tonal cues so voice-chat noise suppressors would pass them to other players; knocks have less harmonic content. | yes |
| D2 | Remove țambal-based cues: uniform `power.granted` shimmer, Lanternfish glint, and the four score-race cues (`lead/breakaway/chase/clinch`). | yes |
| D3 | Remove the private (headphones) tier: `clock.eligible`, `power.granted.mine`, Ascuns `power.clownfish.bound`. Cost: an eligible player gets no *audible* prompt in a structural window; they still get the plank, the clock and the visual. | yes |
| D4 | One podium call for everyone instead of win/tie/lose music. (The podium screen already says who won.) | yes |
| D5 | Drop the dobă heartbeat (`amb.lastact`) and the pond's "life" layer (birds/fish/reeds) — the 12/6/1 steps replace the countdown. | yes |
| D6 | Allow ambience ducking under the rare signature cues only, overriding `DESIGN.md` §0.1 row 7.5 ("no ducking"). | yes |
| D7 | Gate the audition lab with `import.meta.env.DEV` so production carries no lab chunk. | yes |
| D8 | Turn totem: keep six seat signatures in one timbre family (so "who" is audible), or literally one tone for everyone. The blindfold test that validates seat identification was never run (README, "Not built"). | keep six |
| D9 | Drip pitch: your brief says a fast pitch **drop**. Physically, an entrained bubble's pitch tends to *rise*, so the existing bubbles rise. I follow the brief. The lab will offer both directions as takes so you can choose by ear. | drop |
| D10 | Seed variation from the public-event ordinal, not `seq`. | yes |
| D11 | Podium pips: unpitched ticks (default) or remove entirely. | unpitched |

---

## 8. What Step 2 will do, and how it will be verified

**Build (all inside `packages/client/src/audio/`, no protocol change, no new server fields):**
1. `cuesheet.ts` / `recipes.ts` / `render/*` / `live/*`: the palette above (new recipes for tulnic, world steps, notch,
   egg, hidden lay, wood-rattle jellyfish, reversed-knock lantern, pond drip, wind); delete §1.5.
2. `cues.ts`: one mapping layer over a projected input (`soundInputOf`), the ordinal seed, `durMs` on every request,
   the threshold crossings (12/6/1), notch ticks, pool-empty crossfade on the event's beat.
3. `mixer.ts` / `ambience.ts`: stepped low-pass/level states with a 25 ms ramp; ducking under the rare cues.
4. `lab.tsx` + `main.tsx`: a play button per cue **and per take**, gated to dev. *I cannot listen; the page is for you.*

**Tests (vitest, existing harness):**
- Two different private states + the same public event ⇒ identical `(id, delayMs, durMs)` for every viewer — for every
  event type in §2, including honest-no vs Squid deny vs Squid claim.
- A Proxy over the raw wire objects: any read outside §3 fails the test.
- No cue id contains `squid`; no cue is emitted for a Squid grant/use in either mode.
- Signature cues ≤ 1400 ms; only `mus.start` and `mus.podium` exceed it; no cue blocks (no `await` on audio in any input path).
- The forbidden list: no `sine`-only bleep recipes, no looped buffer, no `mus.*` loop.
- Every repeated cue has exactly 3 takes; the chain rise is monotone and capped.

**Offline measurement (I can run this here):** extend `tools/audio-check.cjs` to render each cue and take in headless
Chromium and report, per cue and profile: true peak, integrated/momentary loudness, active duration, clipping count. I will
also *measure* what is measurable about the spec rather than judge taste: the tulnic's pitches by FFT peak (are they
`58·n`?), the echo delays and levels, the ambience step values, the tick spacing. I will report the numbers as they come out
and say so for any check that fails.

**What I cannot verify and will not claim:** whether it sounds carved / tense / generic (I can't hear); iOS Safari unlock;
phone speakers; whether voice-chat noise suppression passes the cues; whether the tulnic phrase is culturally
appropriate (`FEEL_VISUAL_SOUND_PLAN.md` §11.8 already calls for a Romanian folk-music consultant before anything is
recorded, and this design needs the same review).

---

*Stopping here for your review.*
