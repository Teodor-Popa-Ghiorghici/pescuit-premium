# Pescuiește Extins — Feel, Visual & Sound Plan

*A plan to take the client from "a woodcut skin over a working engine" to a table
that feels, looks and — above all — sounds like one place. It is grounded in an
audit of the shipped code and a live 3- and 6-player session on desktop
(1280×800) and phone (390×844); screenshots are in `docs/plan-evidence/`. Where
it disagrees with `DESIGN.md`, §12 lists each amendment and the reason for it.*

---

## 0. The one-page version

Pescuiește Extins is **a bluffing game played by 3–6 friends over voice chat,
often on phones.** Four laws follow from that sentence and govern everything
below:

1. **What leaves a device is public.** Every player's speakers feed a live
   microphone. A sound that depends on private information is a tell. (§3.2)
2. **The table talks; the game whispers.** The best sound in this game is a
   friend saying *"Pescuiește!"*. The mix is built to sit under speech. (§3.3)
3. **Every ask is a four-beat drama** — ask, hold, answer, consequence — and
   cause visibly travels to effect. (§4.1)
4. **One glance, one thumb.** On a 390×844 phone, everything needed to act is on
   screen, under the thumb, without scrolling. (§5.2)

The woodcut foundation is real: tokens, two verified faces, nineteen carvings,
seals, the stamp, the travelling totem. But the audit (§1) found the game's
central secret printed in every player's log; a sound layer of four noise bursts
wired straight to the speakers — two of them tells over an open mic, all of them
silent for the last 40–50 % of every game; no card that ever moves between
players; and a phone layout that, at six players, starts your hand 479 px below
the fold.

### 0.1 The twelve moves, ranked by impact ÷ cost

| # | Move | Why | Cost | When |
|---|---|---|---|---|
| 1 | Redact events per viewer; stop shipping the seed and rank-bearing card ids | Mode Ascuns is broken for everyone today | S | M0 |
| 2 | Mic-safe audio law; fix the two live audio tells | Voice chat carries every speaker to every player | S | M0 |
| 3 | One-screen phone table (docked hand, opponent strip) | Acting on your turn requires scrolling past every post | M | M2 |
| 4 | Presentation timeline keyed on a server `seq` | Fixes the silent late game; carries all choreography | M | M1 |
| 5 | Card flights and the four-beat ask | The core verb has no cause → effect | M | M2 |
| 6 | Audio engine: buses, limiter, voices, variation, seat panning | The current design cannot be mixed, levelled or scaled | M | M1 |
| 7 | Server-authoritative window clock with scheduled ticks | The one place audio carries information is guessed | S | M0/M2 |
| 8 | Sorted, grouped hand with corner indices; drag-to-ask | The hand is unsorted and clipped; asking is three taps | M | M2 |
| 9 | Nine power motifs and four signature moments | Powers are the game's identity; today they are log lines | L | M3 |
| 10 | The pond: ambience that drains with the pool | A diegetic clock and the world's voice | M | M4 |
| 11 | Texture and ink pass (grain, wood, baked edges) | DESIGN §1 rule 4 ("nothing is clean") is unbuilt | M | M4 |
| 12 | Bot-table harness and audio lab | One person can tune a six-player game | S | M1 |

### 0.2 Done means

- **Zero** private-information-dependent sounds or haptics in default mode —
  proven by a property test, not a review (§6.4).
- Integrated loudness **−23 ± 2 LUFS**, true peak **≤ −1 dBTP** over a scripted
  five-player bot game rendered offline; no clip in a six-event burst (§9.1).
- At **360×740** and **390×844** with **six** players, in every state, the hand,
  the clock and the primary action are fully on screen, with no horizontal page
  scroll (§5.2, automated).
- Input → visible response **≤ 50 ms p95** on a mid-range Android; card flights
  hold **≥ 55 fps** in a six-player whale shuffle (§9.1).
- Playtest round 3: whose-turn confusions **0** per session; missed windows
  **< 10 %**; "I always knew what just happened" **≥ 6/7**; players who muted by
  the end **< 20 %** (§9.2).

**Effort:** ≈ 46 engineering days (range 40–52), ≈ 6 days of audio production,
≈ 7 days of art. Critical path M0 → M1 → M2 → M3. A two-week cut (§8.3) delivers
the secrecy fixes, the phone layout and the core loop's feel.

---

## 1. Audit — what is there, what is broken

Severity: **S0** breaks the game's promise (secrecy or integrity) · **S1** breaks
feel · **S2** degrades polish. Every finding was reproduced; file and line
references are to commit `05b3ae3`.

### S0 — the promise

| # | Finding | Evidence | Fix |
|---|---|---|---|
| A1 | **Every client receives the same unredacted events.** `view` is redacted per player; `events` is not. In Mode Ascuns every player's log reads *"Ana lays down a set of Squid"* and *"Ana gains the Squid power"*. | `server/room.ts:127-134`; `EventLog.tsx:65-72`; `i18n.ts:102,104` | M0 |
| A2 | **`GAME_STARTED` carries the RNG seed.** The engine that deals from it ships in the client bundle, so every hand and the entire pool can be reconstructed. | `engine.ts:153` | M0 |
| A3 | **Card ids encode rank** (`c12_squid`) and `DREW_FROM_POOL.cardId` goes to everyone, so every draw's rank is in every player's WebSocket frame. | `deck.ts:9-14`; `engine.ts:597` | M0 |
| A4 | **`WINDOW_OPENED` carries `eligiblePlayerIds` and the raw `SET_COMPLETED` context** — who holds Mantis/Shark/Tortoise/Lanternfish, and a hidden set's rank — although `redact.ts` scrubs the same data from the view. | `engine.ts:300,803`; `redact.ts:61-75` | M0 |
| A5 | **Audio tell #1.** The window chime plays only on *eligible* clients. Over an open mic the table hears whose speakers chimed — i.e. who holds the reactive power. | `InterruptPrompt.tsx:49-51` | M0 |
| A6 | **Audio tell #2.** The honest answer plays `stamp`; the Squid lie plays nothing. A click versus silence identifies a lie. The answer buttons also differ in size (`btn--go` vs `btn--ghost`), which slows the liar's hand — a UI-induced hesitation. | `InterruptPrompt.tsx:162-186` | M0 |
| A7 | **Any client can close any window.** `SKIP_WINDOW` carries no player and the server forwards actions verbatim, so an asker can close the target's answer window before a Squid can be declared. `playerId` in every other action is likewise client-asserted. | `engine.ts:709-711`; `server/index.ts:117-119` | M0 |

### S1 — feel

| # | Finding | Evidence | Fix |
|---|---|---|---|
| A8 | **The late game is silent.** The store keeps the last 300 events; `useEventBeats` diffs by array *length*, so once the array is full nothing is ever "fresh" again. Measured over 800 seeded bot games: 99 % pass 300 events, at a median turn of 47–49 out of 80 (3 players) to 102 (6 players) — **the last 40–50 % of every game plays in silence**, exactly where the endgame should peak. Log lines are keyed by array index, which also shifts at the cap. | `store.tsx:8,100`; `beats.ts:58-65`; `EventLog.tsx:144` | M0 |
| A9 | **On a phone your hand is below the fold.** Measured at 390×844: three players — hand at y≈715 at the start, ≈1110 once the log fills; six players — the post column alone is 1015 px tall and your first card starts at y=1323. You scroll to act inside a 12 s clock. | `table-phone-3p-fullpage.png`; `docs/plan-evidence/six.cjs` | M2 |
| A10 | **Every event yanks the page.** The log calls `scrollIntoView` on a sentinel, which scrolls the *document*; on a phone the viewport jumps to the log after each event. | `EventLog.tsx:135-137`; `table-phone-6p-log-yank.png` | M0 |
| A11 | **Nothing travels.** Asks, gives, draws, steals, jumps and shuffles update in place; the only moving object is the totem. | README, "Known scope limitations" | M2/M3 |
| A12 | **The window clock is a guess.** The countdown starts when the client *receives* the state; the server's deadline is never sent, so latency skews it and a reload restarts it at 12 while the server may have 2 s left. | `InterruptPrompt.tsx:35-46`; `room.ts:110-125` | M0 |
| A13 | **A dropped socket freezes the player.** The socket reconnects, but `rejoin` is sent once on mount only; after any blip the table re-saturates yet no state arrives until a manual reload. | `net/client.ts:43-48`; `store.tsx:64-78` | M0 |
| A14 | **The sound engine cannot be mixed.** Four cues, each wired straight to `destination`: no master, limiter, volume, ducking, voice cap, variation or pan; a fresh noise buffer is allocated per hit; the context is created on the first cue, which after a reload is not inside a gesture. | `sound.ts:11,39-81` | M1 |
| A15 | **The hand is unsorted and clipped.** Duplicates are scattered (two Țestoasă at opposite ends), the centred rank name is the first thing the overlap hides, and a ten-card hand overflows its panel and the page at 1280 px (flex item without `min-width: 0`). | `table-desktop-midgame-overflow.png`; `styles.css:792,874-881` | M0/M2 |
| A16 | Declaring Jellyfish, Stickleback or Whale needs native `<select>`s under the clock, contrary to DESIGN §8.3. | `InterruptPrompt.tsx:326-393` | M3 |
| A17 | The fixed 700 ms resolution beat of DESIGN §9.4 does not exist (`DUR.event` is only a cutoff). §12 argues for replacing it rather than building it. | `beats.ts:73` | M2 |
| A18 | Haptics are `vibrate(10 or 24)` behind the *sound* toggle; iOS Safari has no Vibration API at all. | `sound.ts:110-117`; `beats.ts:76` | M2 |

### S2 — polish

| # | Finding | Evidence |
|---|---|---|
| A19 | The "grain" is pinstripes (`repeating-linear-gradient`); every edge is vector-perfect. DESIGN §3 (paper tile, baked ink) was never built. | `tokens.css:107-108`; all screenshots |
| A20 | The sixth post stretches into a full-width plank (`flex: 1 1 150px`). | `styles.css:589`; `table-desktop-6p.png` |
| A21 | "You may lie with Squid" is shown to every asked player, with or without a Squid. | `i18n.ts:81,188`; `answer-plank-phone-fullpage.png` |
| A22 | `maximum-scale=1` disables pinch-zoom on the platform where text is smallest (WCAG 1.4.4). | `index.html:5` |
| A23 | The log is a 300×340 blank block for the first minute; the "tap a post, then a card" hint appears twice on screen. | `table-desktop-3p.png` |

**Keep:** the palette and tokens; Vollkorn and Source Serif 4 with verified
comma-below diacritics; the nineteen carvings and the seal system; category
carried by shape; notched geometry; the totem and its FLIP; the stamp; the
reduced-motion discipline; the plank-and-frame metaphor for windows.

---

## 2. Pillars

| Pillar | Test a change must pass |
|---|---|
| **P1 Carved, printed, pressed.** Every sight and sound has a physical source in a world of wood, paper, ink and water. | Can you name the object that made this mark or this sound? |
| **P2 The table talks; the game whispers.** | Does this sound compete with a sentence spoken over it? |
| **P3 What leaves the device is public.** | If a microphone or a camera caught this, would it tell anyone more than the public view does? |
| **P4 Every ask is a drama.** | Can a spectator narrate who asked whom, for what, and what happened — with the sound off? With the screen off? |
| **P5 One glance, one thumb.** | At arm's length on a phone: whose turn, can I act, how close is the end — each in one second, and is my next action under my thumb? |

**The session arc follows the pool** — the only monotonic clock the game has.
*Arrival* (lobby: the pond at dusk, a carved gate) → *opening* (full pond, lively
water) → *the rhythm* (the ask loop) → *draining* (the pool thins and so does the
water) → *the basin* (pool empty: dry wood, wind; every ask counts) →
*ceremony* (the tally, the totems). Audio and visual intensity rise as the water
falls; nothing else escalates on a timer.

**References — what to take from each.** *Inscryption:* a table that creaks and
cards with weight. *Pentiment:* an entire UI in the language of print.
*Balatro:* the count-up and stacked juice on flat 2-D cards. *Hearthstone:*
drag-to-target and a board that answers every impact. *Return of the Obra Dinn:*
two-value art kept legible, stingers that carry story beats. *Jackbox:* short,
voice-safe cues designed for a group on a call.

---

## 3. Sound design

### 3.1 Identity: a toacă by a pond

The toacă — the wooden plank struck with mallets outside the wooden churches of
Maramureș — is the voice of the table. The pond (*balta*) is the voice of the
world. The shepherd's flute is the voice of the powers. Everything else is
paper, ink, and one drum.

**The grammar.** A sound's material tells you its *category* before its pitch
tells you anything else:

| Material | Source in the world | Means | Used by |
|---|---|---|---|
| **Wood** — four toacă planks | the table and its rules | "the table acknowledges" | turn, ask, answer, clock, press, lay |
| **Paper** | the printed cards | "cards moved" | give, draw, steal, shuffle, flight |
| **Ink** | the stamp | "it is recorded" | lay, score, log |
| **Water** | the pond | "the pool" | go fish, draw, ambience, pool empty |
| **Breath** — fluier, caval, tulnic | the powers' voices | "a power spoke" | the nine motifs, start, end |
| **Strings** — țambal | magic resolving | "something changed you can't see" | power granted, clownfish binding |
| **Skin** — dobă | weight | "this hurts" | shark, mantis, whale |
| **Silence** | — | "a secret" | Squid |

The four planks — **A** 180 Hz (large), **B** 320 Hz (post), **C** 620 Hz
(small), **D** 1.2 kHz (tick) — all use the mode ratios of a free-free bar
(1 : 2.756 : 5.404 : 8.933), so every wooden sound in the game reads as one
material at four sizes.

### 3.2 Law 1 — public sound (mic-safe by construction)

**Definition.** A client's *audible output* — every sound, and every vibration
loud enough to hear on a desk — must be a function of only:

- (a) the **public** event stream: the redacted events a viewer who owns nothing
  would receive; and
- (b) inputs whose **possibility was already public** when they were made.

Everything else is **private tier**, and the private tier is silent by default.

| Input or signal | Possibility public? | Sound by default |
|---|---|---|
| Ask (on your turn) | yes — whose turn is public | yes |
| Lay a set | yes — any player at any rest point | yes |
| Answer when asked | yes — the target was named aloud | yes, **one identical cue for every answer, Squid included** |
| Declare or decline at `TURN_START` | yes — the window is visible to everyone | yes |
| Declare or decline in a reactive window (Lanternfish, Tortoise, Mantis, Shark) | **no** — eligibility is private | **no** — visual and haptic only |
| A window opens | yes | yes — **one uniform cue on every client** |
| "You are eligible" | no | headphones mode only |
| Your power granted, Mode Ascuns | category public, rank private | the uniform "power granted" cue only |
| Clownfish binding, Mode Ascuns | no | headphones mode only |
| Squid | never | never, in any mode, for anyone |
| Hover | — | never — no hover sounds anywhere |

**Headphones mode** (*Căști*) is a per-device toggle that unlocks the private
tier: the eligibility motif, your own power's motif when granted, the clownfish
binding. While it is on, a headphone glyph sits in the header, and each new game
asks once, "Still on headphones?" — a single tap.

**Haptics are only semi-private.** A phone vibrating on a wooden desk is audible
to a laptop microphone. Private-tier haptics default to a single pulse of at
most 12 ms; stronger alerts are opt-in.

**Tonal material is reserved for public events.** Voice-chat noise suppressors
are built to pass harmonic, voice-like content and to remove broadband noise, so
a flute note is far more likely than a knock to survive the trip to other
players. We treat that as a hypothesis and test it (§9.3), but design as if it is
true: breath and strings never carry private information outside headphones
mode.

**Squid, sharpened.** When you are asked, every answer — hand over, *"Pescuiește!"*,
lie — produces the same local cue, the same haptic and the same plank
animation, and the answer buttons are the same size and weight, so reaching
for the lie is not slower than reaching for the truth.

### 3.3 Law 2 — the voice-first mix

- **Loudness reference.** Integrated **−23 ± 2 LUFS**, true peak **≤ −1 dBTP**,
  over a scripted three-minute, five-player bot game rendered offline (§9.1). At
  the default master (70 %) a typical turn sits roughly 8–10 dB under
  conversational voice chat.
- **Transient-first.** Informative cues carry their meaning in the first
  250 ms. Transients slip between syllables; it is sustained sound that masks
  speech.
- **Carve the sustain.** Sustained sources — ambience, the whale swell, țambal
  tails, the held note of a motif — get a −6 dB bell at 2 kHz (Q 0.7) and a
  7 kHz low-pass. Nothing but ambience sustains longer than 1.5 s. Ambience
  never exceeds −32 LUFS short-term.
- **Ducking.** Ambience ducks −6 dB under Table and Power cues (attack 20 ms,
  release 400 ms) and −3 dB for the length of every answer window — *the table
  holds its breath.*
- **Small speakers.** Anything that carries weight below 150 Hz (dobă, tulnic,
  plank A) gets a saturated harmonic layer at 120–400 Hz, so a phone speaker
  implies the fundamental it cannot play.
- **Master chain.** profile EQ (*speaker*: high-pass 150 Hz, +2 dB shelf at
  3 kHz; *headphones*: high-pass 30 Hz, flat) → glue compressor (−20 dB, 3:1,
  knee 6, attack 5 ms, release 120 ms) → limiter (−3 dB, 20:1, attack 1 ms,
  release 60 ms) → a soft-clip safety net that the offline tests prove never
  engages → master gain.

### 3.4 Architecture

```
cue request ─► voice pool (priority · steal · cooldown · merge) ─► voice: buffer ► gain ► pan ─┐
                                                                                              ▼
   UI ─┐  Table ─┐  Power ─┐  Clock ─┐  Ambience ◄── sidechain duck (Table, Power, hold) ─┐  Music ─┐
       └─────────┴─────────┴─────────┴───────────────────────────────────────────────────┴────────┴─► pre-master
pre-master ─► profile EQ ─► glue comp ─► limiter ─► soft-clip ─► master gain ─► destination
```

| Bus | Level (Table = 0 dB) | Voices | Ducked by | Carries |
|---|---|---|---|---|
| UI | −10 dB | 2 | — | presses, selections, errors |
| Table | 0 dB | 6 | — | turn, ask, give, draw, lay, flights |
| Power | +1 dB | 3 | — | the nine, reveal, granted |
| Clock | −8 dB (urgent −5 dB) | 1 (never stolen) | — | window open, ticks, close |
| Ambience | −26 dB | 3 layers | Table/Power −6 dB, hold −3 dB | the pond, the basin |
| Music | −2 dB | 2 | — | start and end motifs only |

- **Voices.** Global cap 14. Priority Clock > Power > Table > UI > Ambience;
  steal the oldest of the lowest priority. Per-cue cooldowns (draw 60 ms, press
  40 ms). Two identical requests within 30 ms merge (no flams). A run of more
  than three identical cues walks up a semitone per repeat.
- **Variation.** Every family is pre-rendered with 4–6 seeded variations;
  playback adds ±40 cents, ±1.5 dB and 0–6 ms of start jitter, drawn from a
  shuffle-bag so no variation repeats back to back.
- **Seat panning.** A cue with a `from` or `to` player pans to that post's
  horizontal screen position (equal-power, |pan| ≤ 0.35); travelling cues glide
  from → to over their length. A mono setting collapses it. Sounds come from
  where they happen.
- **One clock for sight and sound.** Ticks and multi-hit cues are scheduled on
  `AudioContext.currentTime` by a lookahead scheduler (25 ms interval, 100 ms
  horizon). Visual impacts read their times from the same timeline and are
  delayed by `outputLatency` where the browser exposes it (capped at 120 ms), so
  a card lands on its sound. A manual A/V offset in settings covers Bluetooth.
- **Lifecycle.** Create and unlock the context on the first `pointerdown` or
  `keydown` anywhere — not on the first cue. If a cue is requested while
  suspended, a small "tap for sound" tab appears in the header. Suspend after
  30 s hidden; resume on return; treat iOS `interrupted` as suspended. Set
  `navigator.audioSession.type = 'ambient'` where available, so the game mixes
  with a voice call on the same phone and respects the silent switch.
- **Settings** (persisted per device): master, effects, interface, ambience,
  music; mute (one tap, in the header); headphones mode; mono; *softer sounds*
  (−6 dB above 4 kHz and slower attacks, for sensory-sensitive players);
  A/V offset.

```
packages/client/src/audio/
  context.ts   unlock, suspend/resume, audioSession, outputLatency
  mixer.ts     buses, ducking, master chain, profiles, settings
  voices.ts    pool, priority, stealing, cooldowns, merging
  bank.ts      renders recipes to AudioBuffers at load; loads recorded banks eagerly
  recipes/     wood, paper, water, breath, strings, skin, drâmbă — pure (params, seed) → buffer
  cues.ts      PURE: (PublicEvent, ViewerCtx) → CueRequest[]   ← the leak-tested function
  clock.ts     window tick scheduler bound to the server deadline
  lab.tsx      dev-only audio lab (§7.3)
```

### 3.5 Production — procedural at load, recorded where it counts

- **Tier P, procedural (0 bytes).** Every recipe (Appendix B) is a pure function
  of parameters and a seed, rendered once into `AudioBuffer`s by an
  `OfflineAudioContext` while the waiting room is open — never mid-game. About
  seventy buffers averaging 0.4 s mono is ≈ 5 MB of memory; render budget
  ≤ 150 ms on a mid-range Android. Each variation is normalised at render to
  −6 dBFS peak, so level lives in the bus table, not scattered across recipes.
- **Tier R, recorded (M4).** The eight families that carry the most meaning are
  replaced by recordings: a real toacă (a beech plank and two mallets, four
  sizes), card stock, water (a basin and a real pond), a dobă, and a
  fluier/caval player for the nine motifs and the start and end cues.
  Budget: one Foley day, one two-hour musician session (≈ €300–600), two days
  of editing. Online sources only if CC0; every file is listed in
  `audio/CREDITS.md`.
- **Formats and loading.** Opus in WebM with an AAC fallback, mono, 48 kHz,
  ≈ 64 kbps. One bank per bus rather than a single sprite (encoder padding makes
  sprite offsets drift). ≤ 220 KB in total. Every bank loads eagerly when the
  game starts (DESIGN §9.1) — no request is ever rank-named.
- **Swap-in without code.** Recorded and procedural variants share cue ids, so
  moving a family from tier P to tier R is a bank change.

### 3.6 The cue bible

*Heard by:* **all** = every client; **local** = the client that acted (allowed
by Law 1 only when the action's possibility was public); **you** = the viewer the
event concerns, where that fact is public; **private** = headphones mode only.
Lengths are the audible core; tails are carved per Law 2.

**Interface**

| Cue | Trigger | Heard by | Bus | Material and recipe | Length |
|---|---|---|---|---|---|
| `ui.press` | primary button (public-possibility inputs only) | local | UI | plank C, dry | 60 ms |
| `ui.press.soft` | secondary button | local | UI | plank C, damped, −4 dB | 50 ms |
| `ui.select` | card group picked up, on your turn | local | UI | paper lift + plank D tick | 80 ms |
| `ui.drop` | card put back | local | UI | paper settle | 60 ms |
| `ui.target` | a post chosen as the ask target | local | UI | plank B, hollow, panned to the post | 90 ms |
| `ui.error` | rejected or illegal action | local | UI | plank A heavily damped — a thud, never a buzzer | 120 ms |
| `ui.toggle` | a setting switched | local | UI | two knocks, rising for on, falling for off | 120 ms |
| `ui.copy` | room link copied | local | UI | small ink stamp | 90 ms |

**The table**

| Cue | Trigger | Heard by | Bus | Material and recipe | Length |
|---|---|---|---|---|---|
| `table.gameStart` | `GAME_STARTED` | all | Music | the toacă call — ~14 strikes on planks A/B, accelerating as monastery toacă patterns do — then the gate creaks open | 2.6 s |
| `table.turn` | `TURN_STARTED`, someone else | all | Table | plank B as the totem lands, panned to the post | 180 ms |
| `table.turn.you` | `TURN_STARTED`, you | you | Table | plank B, then a bright plank C "door knock" 90 ms later | 300 ms |
| `table.bonus` | `BONUS_TURN` | all | Table | the totem knocks twice in place, the second a tone higher | 260 ms |
| `table.skipped` | `TURN_SKIPPED_STUNNED` | all | Table | plank B muffled (low-pass 600 Hz) with a drâmbă wobble tail | 400 ms |
| `table.ask` | `REQUEST_MADE` | all | Table | plank B with a +2-semitone lift — a wooden *"hm?"* — panned asker → target over the arrow-chip's flight | 200 ms |
| `table.asked` | answer window opens, on the target | you | Clock | two knocks on your own post: *knock-knock* | 240 ms |
| `table.answer` | the target presses any answer | local | UI | plank B, firm — **identical for truth and lie** | 80 ms |
| `table.flight` | cards in flight | all | Table | paper flutter and air, length = flight, one per batch | 260–460 ms |
| `table.give` | `REQUEST_SUCCEEDED` | all | Table | paper slide (length grows with count) + stack thud on plank A, lower per card; panned target → asker | 250–450 ms |
| `table.gofish` | `REQUEST_FAILED` | all | Table | the plop: one large bubble with an upward chirp, two to four small ones, a short splash, a ring — the punctuation after a human *"Pescuiește!"* | 350 ms |
| `table.draw` | `DREW_FROM_POOL` | all | Table | wet paper lift — drip + paper; wetness follows the pool level (§3.8); panned pool → player | 140 ms |
| `table.refill` | `HAND_REFILLED` | all | Table | `table.draw` × count, 90 ms apart, a semitone up each | ≤ 360 ms |
| `table.poolEmpty` | `DREW_FROM_POOL` with `poolEmpty` | all | Table + Ambience | a drain gurgle into the hollow ring of the empty basin (plank A, long) | 1.2 s |
| `table.lay` | `SET_LAID`, normal or eggs | all | Table | three descending knocks (C, B, A), an ink stamp, a chisel scrape as the score pip is gouged | 500 ms |
| `table.lay.power` | `SET_LAID`, power set | all | Table | `table.lay` with a low dobă under the last knock — same for all nine ranks; the category is already public | 550 ms |
| `table.tally` | game over, each score pip | all | Table | plank D, rising a step per pip | 90 ms each |
| `table.gameEnd.win` | `GAME_ENDED`, you won | you | Music | fluier over dobă, a rising cadence | 3 s |
| `table.gameEnd.tie` | `GAME_ENDED`, you share the win | you | Music | two fluiers in parallel thirds — two equal totems, in sound | 3 s |
| `table.gameEnd.lose` | `GAME_ENDED`, you did not win | you | Music | caval, a gentle falling cadence — dignified, never a "fail" sting | 2.5 s |

**Windows and the clock** (all uniform across clients except where marked)

| Cue | Trigger | Heard by | Bus | Material and recipe | Length |
|---|---|---|---|---|---|
| `clock.open` | `WINDOW_OPENED` — any type, any viewer | all | Clock | plank C pickup (short–long) with a soft breath swell; for an answer window it is folded into `table.ask`'s landing | 350 ms |
| `clock.tick` | each whole second between 5 s and 3 s left | all | Clock | plank D | 30 ms |
| `clock.tick.urgent` | every 500 ms in the last 3 s | all | Clock | alternating plank D and C — urgency from density and brightness, never from level | 30 ms |
| `clock.close` | `WINDOW_CLOSED` | all | Clock | one resolving plank B knock, at the uniform close (§4.2) | 120 ms |
| `clock.eligible` | a window opens where you are eligible | private | Clock | two-note rising fluier | 400 ms |

**Powers** (public events only, unless marked)

| Cue | Trigger | Heard by | Bus | Material and recipe | Length |
|---|---|---|---|---|---|
| `power.granted` | `POWER_GRANTED` whose rank is not public | all | Power | țambal shimmer (three detuned courses) over a low swell — the same for all nine | 900 ms |
| `power.granted.<rank>` | `POWER_GRANTED`, Mode Deschis | all | Power | the rank's motif, soft (§3.7) | ≤ 1 s |
| `power.granted.mine` | your own grant, Mode Ascuns | private | Power | your rank's motif | ≤ 1 s |
| `power.used.<rank>` | `POWER_USED` | all | Power | the rank's motif, full, under the effect cue that follows | ≤ 1.2 s |
| `power.reveal` | a face-down set flips on first use | all | Power | three wooden clacks on the flip frames, then an ink stamp | 400 ms |
| `power.shark` | `SHARK_JUMP` | all | Power | dobă hit, a fast water rush (noise, low-pass swept 400 Hz → 4 kHz), a jaw snap (two plank C hits 30 ms apart); hit-stop | 600 ms |
| `power.lanternfish` | `LANTERNFISH_REFLECT` | all | Power | a high țambal glint, then the ask knock played backwards | 500 ms |
| `power.tortoise` | `TORTOISE_BLOCK` | all | Power | the shell clamps — hollow plank A, then plank B 60 ms later — and the cards slap back | 450 ms |
| `power.jellyfish` | `JELLYFISH_STUN` | all | Power | drâmbă through a sweeping formant, then the bell stamp — the one non-percussive power | 700 ms |
| `power.stickleback` | `STICKLEBACK_STEAL` | all | Power | a barbed scrape (noise, band-pass swept 1 → 5 kHz), a paper whip, an abrupt cut | 280 ms |
| `power.stickleback.miss` | `STICKLEBACK_WASTED` | all | Power | the same scrape, shorter and hollow, catching no paper | 180 ms |
| `power.mantis` | `SET_DESTROYED` | all | Power | the club — plank A struck hard with a noise crack — then four to six plank D splinters 20–60 ms apart; hit-stop and impact frame | 700 ms |
| `power.whale` | `WHALE_SHUFFLE` | all | Power | a low tulnic swell, a riffle (≈ 40 paper grains over 900 ms), the redeal | 1.4 s |
| `power.clownfish.bound` | `CLOWNFISH_BOUND`, Mode Ascuns | private | Power | a peg clicking into a slot, then the copied motif on drâmbă, *pp*; in Mode Deschis a public version plays for all | 600 ms |
| — | **Squid, in any form** | nobody | — | **silence** | — |

**World and meta**

| Cue | Trigger | Heard by | Bus | Material and recipe |
|---|---|---|---|---|
| `amb.pond.full` / `.mid` / `.low` | pool above 60 % / 25–60 % / below 25 % of its starting size | all | Ambience | lapping water, reeds, sparse drips; each state thinner; 24 s loops, 3 s crossfades |
| `amb.basin` | pool empty | all | Ambience | dry wind through the gate, rare creaks; 30 s loop |
| `amb.lobby` | lobby and waiting room | local | Ambience | `amb.pond.full` with a distant toacă every ~20 s |
| `meta.join` | a player joins the room | all | Table | a knock on a new post; pitch walks up a pentatonic — the room tunes up as it fills |
| `meta.leave` | a player leaves or drops | all | Table | the same knock, damped, a step down |
| `meta.reconnected` | you rejoin after a drop | you | UI | a soft ink stamp as the table re-inks |
| `meta.nudge` | your turn has been idle 15 s | you | Table | one soft `table.turn.you` knock |

### 3.7 The nine motifs

- **Mode.** All nine are written in D *Romanian minor* (Dorian ♯4:
  D E F G♯ A B C) — the colour of the doina — so they sound like one family.
- **Instruments carry the power's type.** Reactive powers, which interrupt out
  of turn, speak on the **fluier** (high, bright). Active powers, played on your
  own turn, speak on the **caval** (low, breathy, deliberate). Clownfish speaks
  on the **drâmbă**, the mimic.
- **Form follows mechanic**, exactly as the carvings do (DESIGN §4.6):

| Power | Instrument | Motif | Why |
|---|---|---|---|
| Shark | fluier | a low note, then a leap of a minor seventh, cut short | jumping in |
| Tortoise | fluier | one note struck three times; begins and ends on the same pitch | enclosed |
| Lanternfish | fluier | a five-note palindrome, A B C B A | mirror symmetry, like its carving |
| Mantis Shrimp | fluier | one accented high G♯, falling a tritone to D | the strike and the crack |
| Jellyfish | caval | a trill that sags 50 cents and stops | stunned |
| Stickleback | caval | three barbed grace notes into one short note | the hooks |
| Whale | caval | two long notes, a falling major sixth, with a swell | the heaviest thing in the sea |
| Clownfish | drâmbă | the motif of the power it copied | its body is an empty slot |
| Squid | — | **a rest** | the one motif the game never plays |

- **Ownership.** A motif plays only when its rank is public (`POWER_USED`;
  `POWER_GRANTED` in Mode Deschis) — or privately, in headphones mode.
- **Learning them.** The Codex (§5.8) plays each motif beside its card. Target:
  players name at least six of eight motifs by ear after two games (§9.2).
- **Authenticity.** The motifs and the toacă call are written with a Romanian
  folk musician consulting, and recorded by a player, not a sample library
  (risk R6).

### 3.8 The pond — adaptive ambience

- The world sounds the one clock the game has. Ambience moves through
  **full → mid → low → basin** as `poolCount` falls against the starting pool
  (66 − 7 × players). It crossfades over 3 s and never moves back toward full.
- Each state is two or three layers: a water bed, detail one-shots at random
  intervals, reeds. Detail density falls with the level. The basin replaces
  water with dry wind and creaking wood.
- `table.draw` follows the same level — the card you pull comes out of less and
  less water — and in the basin the clock's ticks gain a short, hollow room
  reverb. The same information, in an emptier space.
- Level ≤ −32 LUFS short-term, carved and ducked per Law 2.
- **Default: on**, at the bus default, and louder in the lobby. This reverses
  DESIGN §7.2's "off by default" (see §12) and is playtest-gated: if more than
  30 % of playtesters switch it off, it ships off.
- **No music bed during play.** DESIGN §7.1 stands: the pond is atmosphere, not
  music.

### 3.9 The window clock

- **Server-authoritative.** `pendingWindow.deadlineAt` (server epoch ms) is added
  to the view, and every `game_state` carries `serverNow`. The client keeps a
  clock offset (the minimum of the last five `serverNow − localNow` samples,
  corrected by half the ping round-trip). The notch clock and the ticks both
  read `deadlineAt − (now + offset)`, so a reload or a slow network no longer
  moves the deadline.
- **Shape.** `clock.open` when the window opens; silence until 5 s remain (most
  answers land in 1–4 s, and the table should not tick through every ask);
  `clock.tick` each second from 5 s; `clock.tick.urgent` every 500 ms in the last
  3 s, while the notches turn *roșu*; `clock.close` at the uniform close. The
  5 s threshold is a playtest parameter.
- **Uniform.** Every client hears the same clock at the same level. Eligibility
  shows in the frame and the plank, and — privately — in a 10 ms haptic.

### 3.10 Haptics

Android Chrome only: iOS Safari exposes no Vibration API, so every haptic has an
audio or visual twin. Haptics get their own toggle; a player who mutes sound at
work may still want them.

| Signal | Pattern (ms) | Tier |
|---|---|---|
| your turn | 16 | public |
| you were asked | 12 · 60 · 12 | public |
| a window where you are eligible | 10 | private (desk-safe) |
| … with *stronger alerts* on | 16 · 40 · 16, plus 8 per urgent tick | private, opt-in |
| a card lands in your hand | 6 | public |
| cards taken from you | 30 | public |
| you are stunned | 40 | public |
| your set destroyed | 20 · 30 · 40 | public |
| Squid | none | — |

### 3.11 Audio accessibility

Every informative sound has a visual twin (checked by the mute test, §9.3):
`table.turn.you` ↔ totem, header and lifted dock; the clock ↔ the notches;
`table.asked` ↔ the plank. The mixer, mono, *softer sounds*, the A/V offset and
headphones mode are all in the settings of §3.4. Screen-reader announcements
never depend on sound (DESIGN §10).

---

## 4. Feel

### 4.1 The ask, beat by beat

| Beat | Asker | Target | Everyone else | Time |
|---|---|---|---|---|
| **0 Intent** | drags a card group onto a post (or taps card, then post, then Ask). The card lifts on touch in ≤ 50 ms; valid posts light with an ochre rope; `ui.select`, `ui.target`. On release the card springs home and an **arrow-chip** — a small carved token bearing the rank's seal — is born at the asker's post. | — | — | human |
| **1 Ask** | the arrow-chip flies to the target's post on an arc and lands with `table.ask`; the post wobbles 2 px; the log line stamps in | same | same | 320 ms |
| **2 Hold** | banner: *"Bogdan is answering…"*, compact clock | the plank rises with `table.asked` and the 12·60·12 haptic; answer buttons in the thumb zone | banner and compact clock | human, typically 1–4 s |
| | the arrow-chip rocks gently on the target's post — the only idle motion in the game; ambience ducks 3 dB | | | |
| **3 Answer** | — | presses: `table.answer`, the plank sinks — identical for every answer | — | 220 ms, uniform |
| **4 Consequence — yes** | the arrow-chip flips to its ochre face; card backs fly target → asker (60 ms stagger), `table.give`; they turn face-up as they land in the dock; the totem stamps in place, `table.bonus` | the cards leave the dock, `30 ms` haptic | backs fly between posts | ≈ 700 ms |
| **4 Consequence — no** | the arrow-chip dives into the pond, `table.gofish` and a ripple; one card rises from the pool to the asker, `table.draw`; the totem travels on, `table.turn` | — | same | ≈ 1.0 s |

Engine overhead, excluding the human hold, is ≈ 1.2 s for a success and ≈ 1.5 s
for a failure, and **input is never blocked**: the next player may start their
own ask while the totem is still in the air.

### 4.2 The presentation timeline (replaces `beats.ts`)

- **Sequence numbers.** The server stamps every event with a per-room `seq`.
  The client tracks the last `seq` it has presented; a reconnect never replays
  choreography — missed lines go to the log under a "while you were away"
  divider. This retires A8 by construction.
- **Pure choreography.** `choreography.ts` maps `(PublicEvent, ViewerCtx)` to a
  `Beat` — lane, duration, lead-in (overlap with the previous beat), flights,
  VFX, cue requests, haptics, masks — with no side effects. Along with
  `cues.ts` it is the function the leak test compares (§6.4).
- **Lanes.** `table` plays beats in order; `hud` (pips, counts) and `log` play in
  parallel.
- **Masking — the one refinement to DESIGN §6.5.** Logic and input read the
  authoritative view the instant it arrives. Only pixels wait: an arriving card
  is laid out but hidden until its flight lands (never longer than 800 ms), and
  a departing card is drawn as a ghost until it takes off. Without this, cards
  appear in your hand *before* they fly there.
- **Backlog.** If more than 1.2 s of beats is queued, play at 1.5× with the short
  sound variants; beyond 2.5 s, flush to the end state and play only the last
  landing.
- **Uniform close.** Every window closes with the same 220 ms animation, however
  it closed. Durations are part of the output the leak test compares, so no
  outcome can take longer to present than another (§12 explains why this
  replaces the 700 ms hold).
- **Reduced motion.** Beats still play in order — order carries meaning — but
  travel is instant, stamps become a one-frame ink saturation, and hit-stop,
  shake and impact frames are off. Audio is unchanged.

### 4.3 The juice kit and its budget

| Class | Events | What is allowed |
|---|---|---|
| Light | draw, refill, lay, tick, press | stamp and sound; no shake |
| Medium | give, turn change, reflect, block, steal, stun, reveal | flights, stamp, sound; shake ≤ 1 px |
| Heavy | shark, mantis, whale, pool empty | hit-stop 60–80 ms; trauma 0.4–0.6; one impact frame; the signature cue |
| Ceremony | game start, game end | up to 3 s, never blocking input |

- **Hit-stop.** Pause the table lane's running animations for 60–80 ms at the
  moment of impact. Audio does not pause — the impact sound *is* the freeze.
- **Impact frame.** For exactly two frames (≈ 33 ms) the table layer swaps ink
  and paper — a negative print. At most one per heavy event and never two
  within a second (WCAG 2.3.1); never on text or HUD; off under reduced motion.
- **Trauma shake.** `trauma` in [0, 1] decays at 1.6 per second; offset is
  `trauma² × 6 px` (4 px on phones), from summed sines rather than random
  jitter, translation only, on the table layer only (the fixed plank must not
  move — see the note in `GameTable.tsx`).
- **Stepped VFX, "on threes".** Splashes, splinters, ink bursts and glints are
  3–4 hand-cut SVG frames at 12 fps — a flip-book of woodblock prints. Cards
  are objects: they fly smoothly at 60 fps and land with the stamp.
- **Flights.** FLIP from the source rect to the destination rect along a
  quadratic arc lifted 40–80 px toward the table's centre; duration
  `clamp(distance ÷ 1.8 px/ms, 260, 460) ms`; rotation from the source tilt,
  through a ±6° flutter, to the destination tilt; elevation peaks mid-flight
  (`--elev-3`) and snaps to `--elev-1` on landing; 60 ms stagger; at most twelve
  in flight.
- **Shark interception.** Cards in flight retarget at 55 % of their path with a
  hard corner — the only reversal in the game — and the shark's seal stamps at
  the corner.

### 4.4 Input under the clock

- **Drag-to-ask is primary** — on touch and mouse, with an 8 px threshold so a
  tap still selects. It is the physical gesture: show a fish, point at a friend.
- **Tap card → tap post → Ask** (a thumb-zone button) is the accessible
  alternative. Keyboard: `1`–`9` pick a group, `←`/`→` cycle posts, `Enter`
  asks; when asked, `Space` answers truthfully; in a window, `D` declares the
  offered power and `Esc` declines.
- **No `<select>` under the clock.** Jellyfish: tap a post. Stickleback: tap a
  post, then one of eight seals on the plank. Whale: tap one of the highlighted
  adjacent pairs, drawn as rope links between posts. Tortoise, Mantis, Shark,
  Lanternfish: one button.
- **Optimistic declare.** The tap stamps the plank and locks it at once; the next
  state reconciles it. Losing a race — two holders in one window — reads
  *"Prea târziu — Cezar a fost mai rapid."*
- **Targets and reach.** Everything reachable under the clock is ≥ 44×44 px and
  lives in the bottom 45 % of a phone screen.
- **Latency.** Input → visual ≤ 50 ms p95 on a mid-range Android, measured with
  the Event Timing API in the harness; input → audio ≤ 80 ms plus device output
  latency.

### 4.5 Legibility moments

- **Your turn** is the most important transition in the game, so it uses every
  channel: the totem lands on your chip, `table.turn.you`, a 16 ms haptic, the
  dock's rope lights and the dock lifts 8 px, the header turns ochre, and the
  screen reader announces it. Idle for 15 s, it knocks once more (`meta.nudge`).
- **Someone else's turn** is the totem's travel and a panned knock — nothing
  more.
- **A window**: the inset frame and the plank if you can act, the banner if you
  can't, the uniform cue for everyone.

### 4.6 Connection feel

- Re-send `rejoin` on every socket `open` when a session exists (A13).
- Disconnected for less than 1.5 s: show nothing — a blip should not flash the
  UI. Longer: the table drains to `--ink-soft` and a small carved plaque,
  *"Se reconectează…"*, replaces the red bar. On rejoin: a 460 ms re-ink sweep
  and `meta.reconnected`.
- Other players: a dropped post dims and wears a "gone fishing" mark; its return
  is `meta.join`.

---

## 5. Visual design

### 5.1 What stays

Palette and tokens; Vollkorn and Source Serif 4; the nineteen carvings and their
seals; category by shape; notched geometry; the totem. Everything below builds
on them rather than replacing them.

### 5.2 The one-screen table

**Phone** — reference 390×844, minimum 360×740:

```
┌─────────────────────────────────┐
│ Rândul tău            🔊   ☰    │  44  top bar: turn · sound · menu (rules, Codex, language)
├─────────────────────────────────┤
│ [ᛟ B][✺ C][≋ D][☼ E][⌘ F]       │  76  opponent strip: one chip per opponent (≤ 5, 60–64 px):
│   ▲ totem                       │      mark · name · score · hand count · status seals · sets
├─────────────────────────────────┤
│          ▦  balta 38            │ 200  the pond: pool stack and count, the flight stage,
│   Ana → Bogdan: Țestoasă?       │      a one-line event ticker (tap → the log drawer)
├─────────────────────────────────┤
│ [you ●●○ · 2 sets]      [Pune]  │ 270  your dock, fixed and safe-area aware: your chip,
│ ╭──╮╭──╮╭──╮╭──╮╭──╮╭──╮        │      the sorted hand (lg at 0.72), the action row.
│ │  ││  ││  ││  ││  ││  │        │      Every plank rises over this area — the thumb zone.
└─────────────────────────────────┘
```

44 + 76 + 200 + 270 = 590 px: it fits 360×740 with room to spare. Five chips
at 60 px with 6 px gaps is 324 px, which fits the 328 px content width of a
360 px screen.

**Desktop** (≥ 1024 px) — *the pond table*: the opponents' posts stand on an arc
above a wooden table surface with the pool at its centre, your post and hand sit
at the bottom centre, and the log is a 280 px tally board on the right. Posts
have a fixed width (150 px) and never grow (A20). The header shrinks to a 48 px
bar. Between 600 and 1024 px, the desktop arrangement scales and the log
becomes the drawer.

**Checked by machine** (§7.4): at 360×740 and 390×844 with three and six
players, in each of idle, your turn, asked, eligible and game over, the dock and
any plank are fully inside the viewport and `scrollWidth ≤ innerWidth`.

### 5.3 The hand

- **Sort** by category (powers, then normal fish, then eggs), then by rank order.
  Duplicates **group**: 70 % overlap inside a group, 35 % between groups, a count
  badge (×2, ×3), and set-progress ticks on the group's rope — three of four,
  with eggs drawn as dashed ticks that could fill the gap.
- **Corner index** on every card: the seal (24 px) over a three-letter
  abbreviation, down the left edge — so a fanned hand reads like a real one.
  Today the centred name is the first thing the overlap hides.
- **Fan** in an arc — rotation `(i − c) × min(4°, 24° ÷ n)`, a 0–10 px parabola —
  plus a ±0.6° jitter seeded by card id, stable across renders.
- **Fit** by computing overlap from the width available (and `min-width: 0` on
  the panel — A15). Past eight groups the dock scrolls horizontally, with snap.
- **Layable sets tie themselves**: the group gains an ochre rope and a carved
  *"Pune jos"* tab (DESIGN §5.4). The set is the button.

### 5.4 Texture and ink — DESIGN §3, built at last

- **Paper grain**: one 256×256 fractal-noise PNG (≤ 8 KB) on every paper
  surface, multiplied at 12–16 %, static.
- **Wood grain**: a 512×128 directional-turbulence tile replaces the stripes on
  posts, pool and planks.
- **Water**: the app background becomes a low-contrast relief of carved waves
  (≤ 10 KB) instead of pinstripes. It should read as the pond.
- **Ink edges, baked in vector.** `scripts/bake-ink.mjs` subdivides each
  carving's polygons and paths and offsets their vertices along the normals by
  seeded noise (±1–2 units in the 264-wide space), then adds ink pools at
  junctions — deterministic, one seed per asset, never derived from rank for
  backs (DESIGN §9.6), output committed. If the vector bake reads as fake in
  review, the fallback is to render feTurbulence + feDisplacementMap in
  headless Chromium and ship WebP.
- **Budget**: +30 KB in total. Contrast is re-audited with the grain applied:
  body text must stay ≥ 7:1.

### 5.5 VFX in print

Stepped SVG sequences, 3–4 frames each, ≤ 2 KB each, on one sheet reviewed in
the Codex beside the cards: an ink burst (the stamp), wood chips (splinter), a
water ring and splash (go fish), carved speed grooves (flight smear, two
frames), the shell clamp (Tortoise), the bell stamp (Jellyfish), a mirror glint
(Lanternfish), a barbed hook (Stickleback), spiral chips (Whale), a roe burst (a
score pip), and the gate doors (game start).

### 5.6 Player marks

Six carved marks assigned by seat — *rozetă* (rosette), *brad* (fir), *val*
(wave), *soare* (sun), *funie* (rope knot), *cruce* (cross-hatch) — on chips,
log lines and arrow-chips. Identity is carried by shape, not colour: safe for
colour-blind players, and "two values, one accent" survives.

### 5.7 Signature moments

- **The reveal** (Mode Ascuns, a hidden power's first use): the face-down plate
  lifts (120 ms), flips in three stepped frames — back, edge, face — rises to
  `md` at the pond's centre with its seal stamped and its motif playing, holds
  400 ms, and returns to press flat. ≈ 1.3 s, never blocking. This is the payoff
  of Mode Ascuns; today it is a log line.
- **The Mantis strike**: hit-stop 80 ms, an impact frame, splinters on the
  struck set, trauma 0.6; the crack stays on the plate.
- **The Shark's interception**: the cards turn at a hard corner mid-flight; the
  water rushes.
- **The Whale**: both hands rise; twelve backs spiral at the pond's centre
  (900 ms); the redeal (460 ms).
- **The pool empties**: the stack drains into an empty carved basin with a
  ripple, and stays that way — the endgame is visible from across the room.
- **Game over**: the winners' posts rise; a tie is equal totems; the roe pips
  count up one by one (`table.tally`).

### 5.8 Screens and chrome

- **Lobby**: the pond at dusk. Sound wakes on the first tap — the unlock *is*
  the first knock.
- **Waiting room**: each post carves in on join (a stamp and `meta.join`; the
  room tunes up as it fills); the host's Start is the heaviest thing on screen;
  on start the gate opens to the toacă call.
- **Header**: carved icon tabs with labels; mute is one tap and a long-press (or
  right-click) opens the mixer; language moves into the menu.
- **Rules**: add the **Codex** tab of DESIGN §5.8 — the nine powers, each with
  its motif. It is also where the motifs are learned.
- **Copy**: *"You may lie with Squid"* only for a player holding an unused
  Squid; otherwise *"You have (no) Țestoasă — answer."* (A21)

### 5.9 Visual accessibility

Remove `maximum-scale=1` (A22). Focus rings stay. Photosensitivity rules are in
§4.3, reduced motion in §4.2. Every new surface is contrast-checked with its
grain applied.

---

## 6. Secrecy and integrity — M0

### 6.1 Per-viewer event redaction

A new `redactEventsForPlayer(state, events, viewerId)` in `engine/src/redact.ts`,
applied per player in `room.broadcastState`, reusing the concealment predicate
`laidSets` already uses:

| Event | Rule |
|---|---|
| `GAME_STARTED` | drop `seed` |
| `DREW_FROM_POOL` | `cardId` for the drawer only |
| `SET_LAID` | `rank: null` when the set is concealed from the viewer |
| `POWER_GRANTED` | `rank: null` when the source set is concealed; `grantId` to the owner only |
| `CLOWNFISH_BOUND` | owner only in Mode Ascuns; everyone in Mode Deschis |
| `WINDOW_OPENED` | replace `eligiblePlayerIds` with `youAreEligible`; context through the existing `redactWindowContext` |
| `POWER_USED` and every effect event | public as they are; `grantId` to the owner only |

### 6.2 Seed and ids

Stop sending the seed. Card ids become random tokens drawn from the seeded RNG —
deterministic for tests, unguessable without the seed. Grant ids reach owners
only.

### 6.3 Action binding

The server overwrites `action.playerId` with the socket's player.
`SKIP_WINDOW` gains a `playerId` and must come from an eligible player (the
target, for an answer window); the room's timeout submits a server-only skip.
The engine tests and bots are updated to match.

### 6.4 Types and the gate

- The client imports only `PublicEvent`, the redacted union. Nothing in
  `components/`, `audio/` or `motion/` can name a raw `GameEvent`.
- `presentation-leak.test.ts` (DESIGN §9.7) is built in M1 and extended to the
  audible layer. It constructs **paired** states that differ only in hidden
  information — who holds Mantis; which power lies face-down; a Squid denial
  versus an honest *"no"* — drives the same actions through the engine,
  redaction, `choreography.ts`, `cues.ts` and the haptics map for every viewer,
  and asserts:
  1. every output (beats, durations, cues, haptics, classes) is identical for
     every viewer other than the owner of the hidden thing; and
  2. the **audible** outputs — cues and haptics above the private threshold —
     are identical for *every* viewer, the owner included, in default mode.
- A lint rule rejects any dynamic `import()` or bank key containing a power
  rank's name (DESIGN §9.1).

---

## 7. Tooling — so one person can tune a six-player game

### 7.1 The bot table

`?table=bots&n=6&seed=42&seat=0&speed=1` runs `createGame`, `reduce` and the
existing bots (`engine/src/cli/bot.ts`) inside the browser, feeding viewer
seat 0's redacted state and events into the real store. You play seat 0 or watch
it; speed runs from 0.25× to 4×; pause and step work at any point. ≈ 1.5 days,
and it unlocks everything else in this plan.

### 7.2 Scenario fixtures

Built on the engine's test helpers: *shark window open*, *mantis strike*,
*whale between two full hands*, *pool at one card*, *a ten-card hand*, *six
players with long names*. Each loads from a menu in the bot table.

### 7.3 The audio lab

`?lab=audio`: every cue with a play button and its variations; recipe parameters
on sliders (recipes are data); bus meters; a live voice count; an
event → cue trace; short-term loudness. Dev builds only.

### 7.4 Automated checks

- **Layout** (Playwright, headless Chromium): the scripts used for this audit's
  evidence, turned into assertions — viewport containment at 360×740 and
  390×844 with three and six players, in every state; no horizontal scroll at
  1280×800 with a twelve-card hand.
- **Offline audio**: headless Chromium renders every cue, and a scripted
  three-minute bot game, through an `OfflineAudioContext`; asserts each cue's
  peak (≤ −6 dBFS pre-bus), its length and that it is not silent, plus the
  game's integrated loudness and true peak (a ~100-line BS.1770 meter).
- **Unit**: the leak test (§6.4), a snapshot of cue ids per event × viewer role
  × mode, and the 300-event regression (a 1,000-event bot game still produces
  beats at the end).
- **Budgets** (DESIGN §11): added JS ≤ 60 KB gzipped over today's 65 KB; audio
  banks ≤ 220 KB; textures ≤ 30 KB.

---

## 8. Production plan

Estimates are focused days for one engineer who is comfortable with Web Audio,
plus a part-time sound designer and illustrator; ranges reflect unknowns, not
padding.

### 8.1 Milestones

| | Scope | Eng. days | Exit criteria | Demo |
|---|---|---|---|---|
| **M0 Stop the bleeding** | §6.1–6.3; the two audio tells (A5, A6); `seq` and the silent late game (A8); auto-rejoin (A13); the log scroll (A10); hand overflow and the sixth post (A15, A20); `deadlineAt` + `serverNow` (A12); pinch-zoom, copy (A21, A22) | 3.5–4.5 | the leak test's event half passes; a 1,000-event bot game still sounds at the end; a 5 s network cut recovers without reload | Mode Ascuns with three players: nobody's log names a hidden set |
| **M1 Foundations** | the audio engine (§3.4) with every current cue migrated; the presentation timeline (§4.2); bot table and fixtures; audio lab; client test setup (Vitest) and the Playwright checks | 7–9 | no regressions; six bots at 4× for 30 minutes with no drift or voice leaks; the offline loudness test runs in CI | the bot table and the lab, live |
| **M2 Vertical slice: the ask** | the one-screen phone table and the desktop pond table; the hand (§5.3) with drag-to-ask, tap-tap and keyboard; flights, the arrow-chip, masking, the totem; the ask's cues with variations and panning; the uniform window cue and the server clock; the haptics tiers; the uniform close | 9–12 | every layout check green; playtest 1 (§9.2): no scrolling to act, zero whose-turn confusions observed, ask overhead ≤ 1.5 s | a five-player game on phones, played end to end |
| **M3 The nine powers** | the motifs (procedural stand-ins); every power cue; the four signature moments; declares without selects; optimistic declare and "too late"; the single answer plank if §11.2 is accepted | 9–12 (+3 art) | every power has a rank-correct, public audiovisual in both modes; the leak test covers all nine in both modes; playtest 2 | a scripted power showcase in the bot table |
| **M4 World and ceremony** | texture and ink bake; the pond; lobby and waiting-room audio; start and end motifs; the tally; player marks; header icons; the Codex; the recorded banks swapped in | 7–9 (+4 audio production, +4 art) | art review in the Codex at three sizes; the ambience opt-out rate measured; loudness re-verified with recordings | the full session arc, lobby to tally |
| **M5 Tune and gate** | performance on a mid-range Android; the accessibility audit; the mix pass (the blindfold, mute, Discord and phone-speaker tests); playtest 3 and its fixes | 4–6 | every "done means" item in §0.2 | release candidate |

**Totals**: ≈ 40–52 engineering days, ≈ 6 days of audio production (including
motif writing), ≈ 7 days of art. With one engineer, 10–11 calendar weeks; with
the sound designer working in parallel from M1, about 8.

### 8.2 Critical path and parallel work

M0 → M1 (timeline and audio engine) → M2 → M3 is the spine. The motifs and the
Foley session can be written and recorded from M2 onward, the texture tiles and
the VFX sheet from M1 onward; both land in M4 as bank and asset swaps without
code changes.

### 8.3 Cut lines

- **Two weeks (~12 days)**: M0, the minimal M1 (mixer, master, voices, timeline;
  no lab), and M2's phone table, hand sorting and grouping, give and draw
  flights, the go-fish plop and the uniform server clock. This is the
  secrecy fix, the phone fix and the core loop's feel — most of the perceived
  gain.
- **Six weeks**: plus M3 with procedural motifs.
- **Full**: everything.

---

## 9. Measurement

### 9.1 Automated gates (CI)

The leak test; the cue snapshot; offline loudness (−23 ± 2 LUFS integrated,
≤ −1 dBTP) and a six-event burst without clipping; the layout checks; the
300-event regression; the bundle and asset budgets; input latency ≤ 50 ms p95
and ≥ 55 fps during a six-player whale shuffle, both measured in the bot table
on a throttled profile (4× CPU slowdown) as a proxy for a mid-range Android,
then confirmed once on a real device per milestone.

### 9.2 Playtests

Three rounds — after M2, M3 and M5 — of five players on Discord voice, at least
one iPhone and one Android among them, 45 minutes each, with an observer,
screen recordings and a short survey.

| Metric | Target by round 3 |
|---|---|
| Whose-turn confusions observed | 0 per session |
| Missed windows (eligible, timed out without choosing) | < 10 % of eligible windows |
| Median time to answer when asked | ≤ 3 s |
| Players who muted by the end | < 20 % |
| Players who switched the ambience off | < 30 % (else it ships off) |
| "The table feels alive" (1–7) | ≥ 5.5 |
| "I always knew what just happened" (1–7) | ≥ 6 |
| Motifs named by ear after two games | ≥ 6 of 8 |
| Private information heard through someone's speakers | 0 reports, and none in the recordings |

Timings come from an opt-in `?metrics=1` flag that records locally and offers a
JSON download at game end — no server telemetry.

### 9.3 The listening tests (M5)

- **Blindfold**: a listener with the screen off narrates ten turns; at least
  eight are right.
- **Mute**: a full game with sound off; no missed window is attributable to
  missing audio.
- **Discord**: two machines on a call, one player's game audio on speakers,
  noise suppression on and off; record the far end. Confirm that no
  private-tier cue plays in default mode, and measure which cue families
  survive suppression (this settles the tonal-material hypothesis of §3.2).
- **Phone speaker**: every cue is audible and undistorted on a mid-range phone
  at 50 % volume, in a quiet room and a noisy one.

---

## 10. Risks

| Risk | L | I | Mitigation |
|---|---|---|---|
| R1 iOS Safari audio quirks (silent switch, interruptions, unlock) | H | H | a device test matrix per milestone; unlock on first gesture; `audioSession` where available; the visible "tap for sound" state |
| R2 Bluetooth output latency (150–300 ms) desynchronises hits | M | M | `outputLatency` compensation; the manual A/V offset |
| R3 Flights drop frames on low-end Android | M | H | transform/opacity only; `will-change` on flying elements only; at most 12 flights; flutter dropped first under load |
| R4 A future change re-leaks a secret | M | H | the leak test in CI; `PublicEvent` as the only importable event type; the lint rule |
| R5 The ambience annoys | M | M | a low default; playtest-gated default; a one-tap slider |
| R6 Folk material reads as kitsch | M | M | a folk musician consulting; restraint — one instrument per meaning; a real player, not a library |
| R7 The vector ink bake reads as fake | M | M | review in the Codex early (M1 prototype on two cards); the raster fallback |
| R8 Scope creep | H | M | the vertical slice first; the cut lines of §8.3 |

---

## 11. Decisions needed

1. **Ambience default** — recommended *on*, low, and playtest-gated (§3.8).
2. **The single answer plank** (an engine change). Today a target may face up to
   three sequential windows for one ask: Lanternfish?, answer, Tortoise?. The
   Lanternfish and Tortoise windows open only when the target holds that power,
   so their mere appearance on everyone's banner tells the table what the target
   holds — a structural tell no presentation layer can hide. Offering reflect,
   lie, protect and the honest answer on **one** plank removes the tell and two
   waits from every ask. It changes window sequencing, so it needs a rules call
   and a `DECISIONS.md` entry. Recommended; it would land in M3.
3. **Drag-to-ask as the primary gesture**, with tap-tap as the fallback.
   Recommended.
4. **Replace the 700 ms hold with the uniform close** (§12).
5. **Recorded audio budget** — ≈ €300–600 for a musician session and Foley
   props.
6. **Headphones mode** — recommended, off by default.

---

## 12. Amendments to DESIGN.md

| § | DESIGN.md says | This plan says | Why |
|---|---|---|---|
| 5.4 | tap a post, then a card, then confirm | drag-to-ask primary; tap-tap as the fallback | one gesture, and it is the physical one |
| 6.2 | nothing may exceed `--dur-heavy` except game over | signature moments may run to 1.4 s, never blocking input | a reveal needs anticipation, turn and hold |
| 6.5 | the authoritative view updates immediately | logic and input do; arriving pixels are masked for at most 800 ms | otherwise cards appear before they fly |
| 7.2 | ambience off by default; one sprite | ambience on, playtest-gated; banks per bus; procedural rendered at load | the pond is the world's voice; sprites drift |
| 7.3 | `SET_LAID` identical for power and normal | identical for every *rank*; the category may differ | `isPowerSet` is already public |
| 7.3 / 7.4 | eligible players hear a distinct window figure and ticks | every client hears the same window cue and ticks; eligibility is private tier | a distinct sound on one client is a tell over voice chat |
| 8.2 | haptics as the eligibility signal | Android only; private haptics ≤ 12 ms by default | iOS has no Vibration API; a buzzing phone on a desk is audible |
| 9.4 | hold 700 ms after every window closes | every window closes with the same 220 ms animation, and durations are covered by the leak test | the hold hides nothing that uniform, pure choreography does not already hide — the human's decision time is visible either way — and it would add half a second to the game's most frequent transition |

---

## Appendix A — Every event, every channel

| Event | Motion | Sound (default) | Haptic | Class |
|---|---|---|---|---|
| `GAME_STARTED` | the gate opens; the posts carve in | `table.gameStart` | — | ceremony |
| `TURN_STARTED` | the totem travels | `table.turn` / `table.turn.you` | 16 (you) | medium |
| `TURN_SKIPPED_STUNNED` | the totem passes over the post; the post shudders 2 px | `table.skipped` | 40 (you) | medium |
| `BONUS_TURN` | the totem stamps in place | `table.bonus` | — | light |
| `HAND_REFILLED` | *n* cards rise from the pool, 90 ms apart | `table.refill` | 6 each (you) | light |
| `REQUEST_MADE` | the arrow-chip flies asker → target | `table.ask` | — | medium |
| `WINDOW_OPENED` | frame and plank (eligible) or banner (not) | `clock.open`; `table.asked` (target) | 12·60·12 (asked), 10 (eligible) | — |
| `WINDOW_CLOSED` | the uniform 220 ms close | `clock.close` | — | — |
| `REQUEST_SUCCEEDED` | backs fly target → asker | `table.flight`, `table.give` | 30 (loser) | medium |
| `REQUEST_FAILED` | the arrow-chip dives into the pond; ripple | `table.gofish` | — | medium |
| `DREW_FROM_POOL` | a card rises from the pool to the player | `table.draw` (or `table.poolEmpty`) | 6 (you) | light / heavy |
| `SET_LAID` | the group converges, turns to one angle, presses flat under the post; a pip is gouged | `table.lay` / `table.lay.power` | — | light |
| `SET_DESTROYED` | the Mantis strike (§5.7) | `power.mantis` | 20·30·40 (owner) | heavy |
| `POWER_GRANTED` | the collar or the back's rosette core ignites in indigo — identical for every hidden rank | `power.granted` (or the motif, Deschis) | — | light |
| `POWER_USED` | the reveal (Ascuns) or the flip to spent (Deschis) | `power.used.<rank>`, `power.reveal` | — | medium |
| `CLOWNFISH_BOUND` | the owner's slot fills with the copied seal (owner only in Ascuns) | private / public per mode | — | light |
| `SHARK_JUMP` | the interception | `power.shark` | 30 (loser) | heavy |
| `LANTERNFISH_REFLECT` | the arrow-chip mirrors about the pond and returns; cards travel the reflected path | `power.lanternfish` | 30 (loser) | medium |
| `TORTOISE_BLOCK` | the shell clamps over the post; incoming cards strike it and drop back | `power.tortoise` | — | medium |
| `JELLYFISH_STUN` | the bell stamps over the post; its ink drops to 60 % | `power.jellyfish` | 40 (target) | medium |
| `STICKLEBACK_STEAL` | cards yanked in a straight line, fast, no arc | `power.stickleback` | 30 (target) | medium |
| `STICKLEBACK_WASTED` | the yank catches nothing; one splinter chip | `power.stickleback.miss` | — | light |
| `WHALE_SHUFFLE` | the spiral and the redeal (§5.7) | `power.whale` | 20 (both targets) | heavy |
| `GAME_ENDED` | the podium, the tally | `table.gameEnd.*`, `table.tally` | 16 | ceremony |
| **Squid** | **nothing** | **nothing** | **nothing** | — |

## Appendix B — Synthesis recipes (tier P)

| Family | Recipe |
|---|---|
| **Wood (toacă)** | Exciter: a 3 ms noise burst, band-passed at 2.5 × f0 (Q 1). Four modes at f0 × 1 / 2.756 / 5.404 / 8.933, amplitudes 1 / 0.5 / 0.25 / 0.12, T60 160 / 90 / 45 / 25 ms scaled by size (A 1.4, B 1.0, C 0.7, D 0.45). *Damping* (0–1) shortens the decays and low-passes the whole. Variation: f0 ± 3 %, ratios ± 1 %, exciter seed. |
| **Paper** | *Slide*: pink noise through a band-pass swept 2.5 → 4.5 kHz (Q 1.2), 15 ms attack, 40 ms release, 30 % amplitude grain from 40–80 Hz filtered noise. *Lift*: a 25 ms white burst, high-passed at 3 kHz. *Riffle*: 30–45 clicks (3 ms, high-passed at 4 kHz) on an accelerando–ritardando curve over 900 ms. |
| **Water** | *Bubble*: a sine whose pitch rises ~40 % over its 40–80 ms life with an exponential decay (τ 20–40 ms); large 450 Hz, small 900–1600 Hz. *Plop*: one large and two to four small bubbles within 60 ms, plus a 120 ms splash (noise band-passed 1.5–4 kHz). *Drip*: one 1.8–2.6 kHz bubble. *Lapping*: brown noise low-passed at 600 Hz with 0.2–0.5 Hz amplitude modulation, plus sparse bubbles. |
| **Breath** | *Fluier*: sine plus 2nd (−14 dB) and 3rd (−20 dB) harmonics; breath noise band-passed at f0 (Q 8, −18 dB) and at 3 kHz (Q 1, −26 dB); 50 ms attack with a −30-cent scoop; 5.5 Hz vibrato of ±12 cents after 150 ms; 120 ms release; D5–D6. *Caval*: the same an octave lower, breath at −12 dB. *Tulnic*: harmonics 1–8 rolling off at 6 dB/octave at 70–110 Hz, low-passed at 900 Hz, 200 ms attack. |
| **Strings (țambal)** | Karplus–Strong per string (two-point average, decay 0.996); three strings per course detuned ±4 cents; a hammer excitation of low-passed noise (5 kHz); T60 1.5–2.5 s, carved per Law 2. |
| **Skin (dobă)** | A sine falling 95 → 52 Hz over 120 ms, decay τ 180 ms; a 30 ms slap of noise band-passed at 500 Hz (Q 0.8); a `tanh` harmonic layer (drive 3) at −10 dB for small speakers. |
| **Drâmbă** | A 10 %-duty pulse at 98 Hz through two band-pass formants swept 300 → 700 Hz and 900 → 2200 Hz over 400 ms (Q 6), with a 6 Hz formant wobble; 20 ms attack, 500 ms decay. |
| **Ink stamp** | A sine falling 110 → 70 Hz over 60 ms, then a 15 ms high-passed (2 kHz) noise peel at +40 ms. |
