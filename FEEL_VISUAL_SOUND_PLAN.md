# Pescuiește Extins — Feel, Visual & Sound Plan

*A plan to take the client from "a woodcut skin over a working engine" to a table
that feels, looks and — above all — sounds like one place. It is grounded in an
audit of the shipped code (commit `05b3ae3`), a live 3- and 6-player session on
desktop and phone, ~2,600 seeded bot games, and layout mocks rendered from the
game's own card art. Evidence and every script that produced it live in
`docs/plan-evidence/` (see its README). Where this plan disagrees with
`DESIGN.md`, §12 lists the amendment and the reason. Revision history: Appendix E.*

---

## 0. The one-page version

Pescuiește Extins is **a bluffing game played by 3–6 friends over voice chat,
often on phones.** Four laws follow from that sentence:

1. **What leaves a device is public, and presentation never adds information.**
   Every speaker feeds a live microphone and every animation can be seen on a
   stream. Sight, sound and haptics may only restate what the public record
   already says. (§3.2, §6)
2. **The table talks; the game whispers.** The best sound in this game is a
   friend saying *"Pescuiește!"*. The mix sits under speech, and it counts the
   voice call — which re-broadcasts every speaker — as part of the mix. (§3.3–3.4)
3. **Every ask is a four-beat drama** — ask, hold, answer, consequence — and cause
   visibly travels to effect. Frequent beats are short; rare beats are big. (§4)
4. **One glance, one thumb.** On a real phone browser (360×640, 390×664), all of
   the game is on one screen and every timed action sits under the thumb. (§5.2)

**Where we are.** The woodcut foundation is real: tokens, two verified faces,
nineteen carvings, seals, the stamp, the travelling totem. But the audit (§1)
found the game's central secret printed in every player's log, and a Squid lie
that can be told from an honest answer by the *shape* of the events every client
receives. The sound layer is four synthesised cues wired straight to the
speakers: two are tells over an open mic, and the event-driven ones fall silent
for the last 40–50 % of every game. No card ever moves between players. At six
players on a phone, your hand starts 479 px below the fold.

### 0.1 The twelve moves, ranked by impact ÷ cost

| # | Move | Why | Cost | When |
|---|---|---|---|---|
| 1 | Redact events per viewer; make a Squid lie event-identical to an honest "no"; a 128-bit seed that is never sent | Mode Ascuns is broken for everyone; a lie is detectable | M | M0 |
| 2 | Law 1 in code: audio is a function of the public record; fix the two live audio tells | Voice chat carries every speaker to every player | S | M0 |
| 3 | One-screen phone table with a thumb-zone ask sheet (mocked and fit-tested, §5.2) | Today you scroll to act; the targets are out of reach | M | M2 |
| 4 | Presentation timeline keyed on a server `seq` | Fixes the silent late game; carries all choreography | M | M1 |
| 5 | Card flights and the four-beat ask, with a designed *dry* go-fish | The core verb has no cause → effect; at 5–6 players most go-fish land on an empty pool | M | M2 |
| 6 | Audio engine: buses, loudness per output profile, live synthesis for frequent cues, seat voices | The current design cannot be mixed, levelled or scaled | M | M1 |
| 7 | Server-authoritative window clock with scheduled ticks | The one place audio carries information is guessed | S | M0/M2 |
| 8 | Sorted, grouped hand with corner indices (mocked, §5.3) | The hand is unsorted and clipped | M | M2 |
| 9 | Nine power motifs and four signature moments | Powers are rare (< 1 use each per game) and should land like events | L | M3 |
| 10 | The world arc: cards-in-play drives light and life; the pool drives water | A diegetic clock that is true at every player count | M | M4 |
| 11 | Texture and ink pass (grain, wood, baked edges) | DESIGN §1 rule 4 ("nothing is clean") is unbuilt | M | M4 |
| 12 | Bot-table harness, audio lab, call rig | One person can tune a six-player game on a voice call | S | M1 |

### 0.2 Done means

- **Presentation adds no information.** For any two histories that give the table
  the same public record, every client's visuals, audio, haptics and timings are
  identical — the owner's private visuals excepted, and private audio only in
  headphones mode. Proven by a property test (§6.5). The tells that live in the
  *rules themselves* are listed in §6.6; they go away only with the rules decision
  in §11.1, and until then the audio layer does not voice them.
- **Loudness per output profile**, rendered offline from seat 0's client over a
  scripted five-player game paced at human think-times: *speaker* −18 ± 2 LUFS,
  *headphones* −23 ± 2 LUFS, true peak ≤ −1 dBTP; no clip in a six-event burst
  (§3.3).
- **One screen** at 360×640, 390×664 and 375×548, with three and six players, in
  every state: the dock, the plank and the ask sheet are fully on screen with no
  sideways scroll. The mocks already pass this check (§5.2); the product must too
  (§7.4).
- Input → visible response **≤ 50 ms p95** on a mid-range Android; **≥ 55 fps**
  during a six-player whale shuffle.
- Pooled playtests (15 players over 3 rounds, reported as counts): **0**
  whose-turn confusions in round 3; **0** private-information reports from
  recordings or players; **≤ 2 of 15** muted by the end (§9.2).

**Effort:** 51–62 engineering days; ≈ 6 days of audio production and ≈ 7 days of
art, which run beside the engineering path and do not shorten it. One engineer:
about 12–13 weeks. A four-week cut (§8.3) ships the secrecy fixes, the phone
table and the core loop's feel.

---

## 1. Audit — what is there, what is broken

**S0** breaks the game's promise (secrecy or integrity) · **S1** breaks feel ·
**S2** degrades polish. Every finding was reproduced; references are to `05b3ae3`.

### S0 — the promise

| # | Finding | Evidence | Fix |
|---|---|---|---|
| A1 | **Every client receives the same unredacted events.** `view` is redacted per player; `events` is not. In Mode Ascuns every player's log reads *"Ana lays down a set of Squid"* and *"Ana gains the Squid power"*. | `server/room.ts:127-134`; `EventLog.tsx:65-72`; `i18n.ts:102,104` | M0 |
| A2 | **A Squid lie has a different event shape.** `handleDeclareSquid` nulls `pendingWindow` itself, so `afterResponsePending` never emits `WINDOW_CLOSED`. Honest "no": `WINDOW_CLOSED(RESPONSE_PENDING) › REQUEST_FAILED › DREW_FROM_POOL › TURN_STARTED`. Squid deny and Squid claim: the same, minus the first event. Every socket carries the difference; DECISIONS.md's "every response now takes the same shape" is false at the event level. | `engine.ts:405-412`; reproduced by `squid-events.ts` | M0 |
| A3 | **The deal can be recovered.** `GAME_STARTED` sends the RNG seed to every client. The shuffle is not in the client bundle, but it is in the engine's source; and because the seed is only 32 bits, withholding it is not enough — a player can brute-force it from their own seven cards. | `engine.ts:153`; `room.ts:87`; `rng.ts` | M0 |
| A4 | **Card ids encode rank** (`c12_squid`), and `DREW_FROM_POOL.cardId` goes to everyone, so every draw's rank is in every player's frame. | `deck.ts:9-14`; `engine.ts:597` | M0 |
| A5 | **`WINDOW_OPENED` carries `eligiblePlayerIds` and the raw `SET_COMPLETED` context** — who holds which reactive power, and a hidden set's rank — although `redact.ts` scrubs the same data from the view. | `engine.ts:300,803`; `redact.ts:61-75` | M0 |
| A6 | **A window's existence tells the table what someone holds.** Every window except the answer window opens only if someone can act in it: `TURN_START` (the current player holds an unused active power — in Ascuns this sorts a face-down set into active or reactive), `REQUEST_DECLARED` (the target holds Lanternfish), `TRANSFER_PENDING` (the loser holds Tortoise), `SET_COMPLETED` (someone holds Mantis), `TURN_END` (someone holds Shark). The view shows the window to everyone, so no presentation layer can hide this; it is a rules decision (§11.1). | `engine.ts:265,340,452,532,803` | M3 (rules) |
| A7 | **Audio tell #1.** The window chime plays only on *eligible* clients; over an open mic the table hears whose speakers chimed. | `InterruptPrompt.tsx:49-51` | M0 |
| A8 | **Audio tell #2.** The honest answer plays `stamp`; the Squid lie plays nothing. The answer buttons also differ in size and weight (`btn--go` vs `btn--ghost`), which slows the liar's hand. | `InterruptPrompt.tsx:162-186`; `styles.css:132-145` | M0 |
| A9 | **Any client can close any window.** `SKIP_WINDOW` carries no player, and the server forwards actions verbatim, so an asker can close the target's answer window before a Squid can be declared. Every other action's `playerId` is client-asserted too. | `engine.ts:709-735`; `server/index.ts:117-119` | M0 |

### S1 — feel

| # | Finding | Evidence | Fix |
|---|---|---|---|
| A10 | **The late game goes quiet.** The store keeps the last 300 events; `useEventBeats` diffs by array *length*, so once the array is full nothing is "fresh" again. Over 800 seeded bot games, 99 % pass 300 events, at a median turn of 47–49 out of 80 (3 players) to 102 (6 players). Every event-driven cue stops for the last 40–50 % of the game; only the totem knock, the eligibility chime and local button presses remain. Log lines are keyed by index, which also shifts at the cap. | `store.tsx:8,100`; `beats.ts:58-65`; `EventLog.tsx:144`; `eventcount.ts` | M0 |
| A11 | **On a phone, your turn starts with a scroll.** At 390×844, three players: the hand starts at y≈715, then ≈1110 once the log fills; six players: the post column is 1015 px and your first card is at y=1323. Asks have no timer, and timed windows appear on a plank fixed to the bottom (which then covers the hand), so the cost is not a missed deadline — it is a hunt for your own cards at the start of every turn. | `table-phone-3p-fullpage.png`; `six.cjs` | M2 |
| A12 | **Every event yanks the page.** The log's `scrollIntoView` scrolls the *document*; on a phone the viewport jumps to the log after each event. | `EventLog.tsx:135-137`; `table-phone-6p-log-yank.png` | M0 |
| A13 | **Nothing travels.** Asks, gives, draws, steals, jumps and shuffles update in place; the totem is the only moving object. | README, "Known scope limitations" | M2/M3 |
| A14 | **The window clock is a guess.** The countdown starts when the client *receives* the state; the server deadline is never sent, so latency skews it and a reload restarts it at 12 while the server may have 2 s left. | `InterruptPrompt.tsx:35-46`; `room.ts:110-125` | M0 |
| A15 | **A dropped socket freezes the player.** The socket reconnects but `rejoin` is sent only on mount; after any blip the table re-saturates and no state arrives until a manual reload. | `net/client.ts:43-48`; `store.tsx:64-78` | M0 |
| A16 | **The sound engine cannot be mixed.** Four cues — three noise-and-body hits and a two-oscillator chime — each wired straight to `destination`: no master, limiter, volume, ducking, voice cap, variation or pan. A fresh noise buffer is allocated per hit. The context is created on the first cue, which after a reload is not inside a gesture. | `sound.ts:11,39-107` | M1 |
| A17 | **The hand is unsorted and clipped.** Duplicates are scattered, the centred rank name is the first thing the overlap hides, and a ten-card hand overflows its panel and the page at 1280 px (a flex item without `min-width: 0`). | `table-desktop-midgame-overflow.png`; `styles.css:792,874-881` | M0/M2 |
| A18 | Declaring Jellyfish, Stickleback or Whale needs native `<select>`s under the clock, contrary to DESIGN §8.3. | `InterruptPrompt.tsx:326-393` | M3 |
| A19 | The fixed 700 ms resolution beat of DESIGN §9.4 does not exist (`DUR.event` is only a cutoff). §12 argues for replacing it rather than building it. | `beats.ts:73` | M2 |
| A20 | Haptics are `vibrate(10 or 24)` behind the *sound* toggle; iOS Safari has no Vibration API. | `sound.ts:110-117`; `beats.ts:76` | M2 |

### S2 — polish

| # | Finding | Evidence |
|---|---|---|
| A21 | The "grain" is pinstripes (`repeating-linear-gradient`); every edge is vector-perfect. DESIGN §3 (paper tile, baked ink) was never built. | `tokens.css:107-108` |
| A22 | The sixth post stretches into a full-width plank (`flex: 1 1 150px`). | `styles.css:589`; `table-desktop-6p.png` |
| A23 | "You may lie with Squid" is shown to every asked player, with or without a Squid. | `i18n.ts:81,188`; `answer-plank-phone-fullpage.png` |
| A24 | `maximum-scale=1` disables pinch-zoom on the platform where text is smallest (WCAG 1.4.4). | `index.html:5` |
| A25 | The log is an empty 300×340 block for the first minute; the "tap a post, then a card" hint appears twice. | `table-desktop-3p.png` |

**Keep:** the palette and tokens; Vollkorn and Source Serif 4 with verified
comma-below diacritics; the nineteen carvings and the seal system; category
carried by shape; notched geometry; the totem and its FLIP; the stamp; the
reduced-motion discipline; the plank-and-frame metaphor for windows.

### 1.1 What the game actually does — the numbers this plan is sized on

From 300 seeded bot games per player count (`eventfreq.ts`, `arc.ts`). Bots
ask at random, so humans will succeed more often; the *shape* is what matters.

| Per game | 3 players | 6 players |
|---|---|---|
| Turns | 79 | 102 |
| Asks (each opens an answer window) | 78 | 97 |
| Go fish | 56 | 74 |
| … of which the pool was already empty | 21 % | 67 % |
| Cards given | 21 | 22 |
| Draws from the pool | 45 | 24 |
| Sets laid (of which power sets) | 15 (≈ 8) | 12 (≈ 6) |
| Powers used, all nine together | 5.4 | 3.7 |
| Any *one* power's effect (shark jump, whale, …) | 0.3–0.9 | 0.1–0.6 |
| Pool runs dry at (median, share of the game) | 80 % | 36 % |
| Real cards still in play at ¼ · ½ · ¾ of the game (of 60) | 54 · 44 · 27 | 51 · 44 · 33 |

Four consequences run through the rest of the plan:

1. **The ask, the turn and the go-fish are heard 60–100 times a game.** They must be
   short, quiet and endlessly varied (§3.7).
2. **Each power fires less than once a game.** Power moments can be big and
   ceremonial, and nobody will learn nine motifs from play alone (§3.8).
3. **At 5–6 players the pool is dry for most of the game.** "Go fish into an empty
   pond" is the most common outcome and needs its own design (§4.1).
4. **The pool is the wrong clock for the session's arc; cards in play is the right
   one.** It falls roughly linearly from 60 to 0 at every player count, is
   public, and *is* the end condition (RULES §7) (§2, §3.9).

---

## 2. Pillars

| Pillar | Test a change must pass |
|---|---|
| **P1 Carved, printed, pressed.** Every sight and sound has a physical source in a world of wood, paper, ink and water. | Can you name the object that made this mark or this sound? |
| **P2 The table talks; the game whispers.** | Does this sound compete with a sentence spoken over it — or, repeated by four other speakers 200 ms late, turn to mush? |
| **P3 Presentation never adds information.** | If a microphone or a camera caught this, would it tell anyone more than the public record does? |
| **P4 Every ask is a drama.** | Screen off: can a listener name whose turn it is and what kind of thing just happened (ask, give, go fish, lay, power, stun)? Sound off: can a watcher name who asked whom, for what, and what happened? |
| **P5 One glance, one thumb.** | On a real phone browser: whose turn, can I act, how close is the end — each in one second — and is every timed action under my thumb? |

**The session arc follows the cards in play** — the real cards not yet laid, a
public number that falls from 60 to 0 and ends the game when it gets there. It
drives *light and life*: the pond goes from dusk to night in three steps, fewer
fish break the surface, and a tension layer enters for the last dozen cards. The
**pool** drives only *water*: how wet a draw sounds, whether a go-fish splashes or
clatters, and when the pond drains to a dry basin. At three players the basin is
an ending; at six it is the second half of the game — and both read correctly.

**References — what to take from each.** *Inscryption:* a table that creaks and
cards with weight. *Pentiment:* an entire UI in the language of print.
*Balatro:* the count-up and stacked juice on flat 2-D cards. *Hearthstone:* a
board that answers every impact. *Return of the Obra Dinn:* two-value art kept
legible; stingers that carry beats. *Jackbox:* short, voice-safe cues for a
group on a call.

---

## 3. Sound design

### 3.1 Identity: wood by a pond

**Struck wood** — planks and mallets, the material of the *toacă* — is the voice of
the table. **The pond** (*balta*) is the voice of the world. **The shepherd's
flutes** are the voices of the powers. Paper, ink and one drum fill in the rest.

We borrow the toacă's **material, not its liturgy.** It is a monastery instrument;
its rhythms call people to prayer, and a UI click or a "game start" built on
them could read as disrespect. So no monastery rhythms appear anywhere, and the
game-start call goes to the **tulnic**, the long horn Apuseni shepherds use to
call across valleys — a secular summons to gather. A Romanian folk-music
consultant reviews the palette and the motifs before recording (§11.7).

**The grammar.** A sound's material tells you its *category* before its pitch
tells you anything else:

| Material | Source in the world | Means | Used by |
|---|---|---|---|
| **Wood** — planks of four sizes | the table and its rules | "the table acknowledges" | turn, ask, answer, clock, press, lay |
| **Paper** | the printed cards | "cards moved" | give, draw, steal, shuffle, flight |
| **Ink** | the stamp | "it is recorded" | lay, score, log |
| **Water** | the pond | "the pool" | go fish, draw, ambience |
| **Breath** — fluier, caval, tulnic | the powers' voices, the call to the table | "a power spoke" | the nine motifs, start, end |
| **Strings** — țambal | magic resolving | "something changed that you can't see" | power granted, clownfish binding |
| **Skin** — dobă | weight | "this hurts" | shark, mantis, whale |
| **Silence** | — | "a secret" | Squid |

The four planks — **A** 180 Hz, **B** 320 Hz, **C** 620 Hz, **D** 1.2 kHz — share
the mode ratios of a free-free bar (1 : 2.756 : 5.404 : 8.933), so every wooden
sound reads as one material at four sizes.

**Seat voices.** Each seat owns a pitch from the D pentatonic (D E G A B D′), the
same pitch its post knocks with when a player joins the waiting room — the room
tunes up as it fills. The turn knock carries the new player's pitch; the ask
knock glides from the asker's pitch to the target's. With the screen off you can
still hear whose turn it is and who asked whom (P4). On desktop stereo and
headphones, seat panning (§3.5) adds position; on a phone speaker, pitch does the
work alone.

### 3.2 Law 1 — presentation never adds information

**The public record** is what a spectator holding no cards would receive: the
redacted view sequence and the redacted event stream (§6.1), both ordered by
`seq`.

**The guarantee.** Every client's sound — and every vibration strong enough to hear
on a desk — is a function of only:

- (a) the public record;
- (b) public facts about the viewer's own seat (your turn, you were asked); and
- (c) the viewer's inputs whose *possibility* was already public when made.

Everything else is **private tier**: silent by default, audible only in headphones
mode. Visuals may use the viewer's private view (their hand, their grants), but
their *durations and timings* follow the public record.

| Input or signal | Public? | Sound by default |
|---|---|---|
| Ask, on your turn | yes | yes |
| Lay a set | yes — any player, any rest point | yes |
| Answer when asked | yes — the target was named aloud | yes: **one cue for every answer, Squid included** |
| The answer window opens | yes — it opens on every ask | yes: **one uniform cue on every client** |
| Any other window opens | its existence is visible, but it reveals holdings (A6) | **no cue** until the rules decision (§11.1) makes windows uniform |
| Declare or decline in a reactive window | no — eligibility is private | no; visual and private haptic only |
| "You are eligible" | no | headphones mode only |
| Your own power granted, Mode Ascuns | the grant is public, its rank is not | the uniform "power granted" cue only |
| Clownfish binding, Mode Ascuns | no | headphones mode only |
| Squid | never | never, in any mode |
| Hover | — | never; there are no hover sounds |

**Closings come from the view, not from events.** The close cue and the uniform
close animation fire when `pendingWindow` goes from set to `null` in the
`seq`-ordered view, never on a `WINDOW_CLOSED` event. That is defence in depth
behind the engine fix (§6.2) that makes every answer emit the same events.

**Headphones mode** (*Căști*) unlocks the private tier: the eligibility figure,
your own power's motif when granted, the clownfish binding. While it is on, a
headphone glyph sits in the header, and each new game asks once, *"Still on
headphones?"*

**Haptics are only semi-private.** A phone buzzing on a wooden desk is audible to a
laptop microphone, while an ERM motor may not even spin up in 10 ms. The private
haptic pattern is set per motor class by the desk test (§9.3); until then private
haptics are opt-in.

**Tonal material is reserved for public events.** Voice-chat noise suppressors are
built to pass harmonic, voice-like content and to strip broadband noise, so a
flute note is more likely than a knock to reach the other players. We test this
(§9.3) but design as if it were true.

**Squid, sharpened.** Every answer — hand over, *"Pescuiește!"*, lie — produces the
same local cue, haptic and plank animation, and the two answer buttons are the
same size and weight (mock: `mock-phone-answer-390x664.png`), so reaching for the
lie is no slower than reaching for the truth.

### 3.3 Law 2 — the voice-first mix

**Loudness is set per output profile**, following ASWG-R001 (−24 LUFS home,
−18 LUFS portable):

| Profile | When | Integrated | True peak | Differences |
|---|---|---|---|---|
| **Speaker** (default) | phone and laptop speakers | −18 ± 2 LUFS | ≤ −1 dBTP | high-pass 150 Hz; +2 dB shelf at 3 kHz; UI and Clock buses +4 dB; tails cut to the echo budget (§3.4) |
| **Headphones** | chosen in settings | −23 ± 2 LUFS | ≤ −1 dBTP | high-pass 30 Hz, flat; full tails; the private tier |

Both are measured offline (§7.4) from **seat 0's client** over a scripted
five-player game paced at human think-times — asks at a median 6 s and answers at
2.5 s, lognormal, σ 0.5 — until playtest 1 supplies real distributions.

- **Normalise by loudness per class, not by peak.** A 30 ms tick and a 900 ms
  țambal swell at equal peak differ by 10–20 dB in loudness. *Transient* assets
  (< 200 ms) are normalised by K-weighted RMS over their active length;
  *sustained* assets by their maximum momentary loudness (400 ms, BS.1770). Per-cue
  levels then live in one place, the cue sheet (Appendix D).
- **Transient-first.** Informative cues carry their meaning in the first 250 ms.
  Transients slip between syllables; sustained sound masks speech.
- **Carve the sustain.** Sustained sources get a −6 dB bell at 2 kHz (Q 0.7) and a
  7 kHz low-pass; nothing but ambience sustains past 1.5 s; ambience stays under
  −32 LUFS short-term.
- **No pumping.** Ambience does not duck per cue. Its level follows a slow *table
  activity* envelope — a leaky integrator of Table and Power cue energy (rise
  1.5 s, fall 6 s, at most −4 dB) — so a busy stretch sinks it gently and a quiet
  one lets it back. There is no per-window duck: with ~100 answer windows a game
  it would pump.
- **Small speakers.** Anything weighted below 150 Hz (dobă, tulnic, plank A) gets a
  saturated harmonic layer at 120–400 Hz so a phone implies the fundamental it
  cannot play.
- **Master chain:** profile EQ → glue compressor (−20 dB, 3:1, knee 6, attack
  5 ms, release 120 ms) → limiter (−3 dB, 20:1, attack 1 ms, release 60 ms) →
  soft clip (a safety net the offline tests prove never engages) → master gain.

### 3.4 The call is part of the mix

**The model.** At a table of N players, every all-client cue plays N times — once
on each device — and each speaker device's microphone sends its copy into the
call 100–300 ms late. A listener hears their own cue, then up to N−1 delayed
repeats, thinned unpredictably by echo cancellation and noise suppression. Short
transients become a brief flam, which reads as room. Tonal tails become a smear,
and they are exactly what suppressors let through.

**The echo budget** (speaker profile):

- Every public cue's energy after 250 ms sits at least 12 dB below its first
  250 ms. Tails are a headphones luxury.
- Tonal power cues play a two-note *speaker cut* at −4 dB. The full motif plays
  in the headphones profile.
- The start and end ceremonies play in full. They are heard once a game, and a
  little bloom there is welcome.

**Experiment E1 — actor emphasis.** The acting client plays the full cue while
bystanders play only its transient. It is tested against *everyone full* and
*speaker cuts* in the call test. Decision rule: adopt whichever the pooled
listeners rate least smeared without losing "what happened" accuracy.

**The call rig** (§9.3): five clients on laptop and phone speakers in one Discord
call, plus a headset listener recording the far end, with noise suppression on
and off. It measures copies per cue, smear ratings, the loudness of the game
under speech, and any private-tier leak.

### 3.5 Architecture

```
cue request ─► voice pool (priority · steal · cooldown · merge) ─► voice ─► gain ─► pan ─┐
   live voices: exciter + resonators, built per hit     rendered voices: AudioBuffer   │
                                                                                       ▼
 UI ─┐ Table ─┐ Power ─┐ Clock ─┐ Music ─┐ Ambience ◄── slow activity envelope ◄── Table, Power
     └────────┴────────┴────────┴────────┴──────────────────────────────────────────► pre-master
pre-master ─► profile EQ ─► glue comp ─► limiter ─► soft clip ─► master gain ─► destination
```

| Bus | Level (Table = 0 dB) | Voices | Carries |
|---|---|---|---|
| UI | −10 dB (speaker +4) | 2 | presses, selections, errors, the private eligibility figure |
| Table | 0 dB | 6 | turn, ask, answer, give, go fish, draw, lay, flights |
| Power | +1 dB | 3 | the nine, reveal, granted |
| Clock | −8 dB (speaker +4; urgent +3) | 2 | answer-window open, ticks, close |
| Music | −2 dB | 2 | start and end ceremonies |
| Ambience | −26 dB, activity-shaped | 3 layers, live | the pond: water, life, tension |

**Two ways to make a sound.** Each family uses whichever is cheaper at its play
count (§3.7):

- **Live synthesis — the frequent, short families** (wood, paper, water drops).
  Each hit is built from 6–10 nodes: an exciter burst taken at a random offset
  from one shared 1 s noise buffer, a bank of decaying sine modes, envelopes, and
  a pan. That gives infinite, seeded parameter variation at zero buffer memory.
  The seed comes from the event's `seq`, so offline renders are reproducible.
- **Rendered at load, in plain JS — the complex, rare families** (țambal strings,
  the whale riffle, the motifs). These are computed sample by sample into
  32 kHz `AudioBuffer`s while the waiting room is open. It has to be plain JS: a
  Web Audio `DelayNode` inside a feedback cycle is clamped to at least one render
  quantum (128 frames), so a native Karplus–Strong loop cannot sound above
  ~375 Hz.
- **Ambience is generated live.** A looped 2 s noise buffer runs through slowly
  modulated filters for the water and wind beds, and a scheduler fires live
  one-shots (drips, fish jumps, reeds, creaks). No 100-second loops are stored or
  downloaded.

| Budget | Value |
|---|---|
| Rendered buffers | ≈ 30 s at 32 kHz ≈ 3.8 MB |
| Shared noise buffers | ≈ 0.4 MB |
| Recorded tier (M4), decoded | ≤ 6.5 MB |
| Download, all audio | ≤ 220 KB (recorded one-shots only) |
| Render time at load | ≤ 150 ms on a mid-range Android, never mid-game |
| Live synthesis cost | ≤ 10 nodes per hit, ≤ 14 voices; ~13 table cues a minute at human pace |

**The rest of the engine:**

- **Voices.** Global cap 14. Priority Clock > Power > Table > UI > Ambience; the
  oldest voice of the lowest priority is stolen. Cooldowns and instance caps are
  per cue (Appendix D). Two identical requests within 30 ms merge.
  `clock.eligible` lives on the UI bus, 120 ms after `clock.open`, so the two
  never compete for a Clock voice.
- **Seat panning.** A cue with a `from` or `to` player pans toward that post
  (equal-power, |pan| ≤ 0.35) and glides from → to. It pays off on desktop stereo
  and headphones only; phones rely on seat pitch. There is a mono setting.
- **One clock for sight and sound.** A lookahead scheduler (25 ms interval,
  100 ms horizon) runs on `AudioContext.currentTime`. Visual impacts read their
  times from the same timeline and are delayed by `outputLatency` where exposed
  (capped at 120 ms); a manual A/V offset covers Bluetooth.
- **Lifecycle.**
  - The context is created and unlocked on the first `pointerdown` or `keydown`
    anywhere, not on the first cue. If sound is requested while suspended, a
    "tap for sound" tab appears.
  - Suspend after 30 s hidden and resume on return; iOS `interrupted` is treated
    as suspended.
  - `navigator.audioSession.type = 'ambient'`, where available, mixes with a call
    on the same phone and respects the silent switch. The switch cannot be
    detected, so the audio settings say "no sound? check the silent switch".
- **Settings** (per device): master, effects, interface, ambience, music; mute (one
  tap in the header); output profile (speaker or headphones, the latter unlocking
  the private tier); mono; *softer sounds* (−6 dB above 4 kHz, slower attacks);
  A/V offset.

```
packages/client/src/audio/
  context.ts   unlock, lifecycle, audioSession, outputLatency, profiles
  mixer.ts     buses, activity envelope, master chain, settings
  voices.ts    pool, priority, stealing, cooldowns, merging
  live/        wood.ts, paper.ts, water.ts — per-hit synthesis from (params, seed)
  render/      strings.ts, riffle.ts, breath.ts — JS sample renderers → AudioBuffer
  ambience.ts  the live pond: beds, one-shot scheduler, arc states (§3.9)
  cues.ts      PURE: (PublicRecord, SeatFacts) → CueRequest[]   ← the leak-tested function
  clock.ts     window tick scheduler bound to the server deadline
  lab.tsx      dev-only audio lab (§7.3)
```

### 3.6 Production

- **Tier P — procedural, M1–M3.** Live and rendered as above. Recipes are in
  Appendix B.
- **Tier R — recorded one-shots, M4.** These replace the families that carry the
  most meaning, recorded rather than taken from a library:
  - four real planks with two mallets, and card stock;
  - water — a basin and a real pond's edge;
  - a dobă, and a tulnic;
  - a fluier and caval player for the nine motifs and the start and end
    ceremonies.

  The budget is one Foley day, a two-hour musician session (≈ €300–600) and two
  days of editing. Any online source must be CC0, and every file is listed in
  `audio/CREDITS.md`.
- **Formats.** Opus in WebM with an AAC fallback, mono, 48 kHz, ≈ 48–64 kbps;
  one bank per bus, not a single sprite (encoder padding makes sprite offsets
  drift). ≤ 220 KB. Every bank loads eagerly when the game starts (DESIGN §9.1);
  no request is ever rank-named.
- **Swap-in without code.** Recorded takes become the *exciters* of the live
  families and the buffers of the rendered ones, under the same cue ids.

### 3.7 Frequency decides variation, length and level

| Plays per game | Treatment | Cues |
|---|---|---|
| > 60 | live synthesis, continuous seeded variation, the lowest levels, ≤ 250 ms | turn, ask, answer, answer-window open and close, go fish (at 6 p) |
| 15–60 | live or 6–8 takes, ≤ 450 ms | give, bonus, draw, lay, go fish (at 3 p), dry go fish (at 6 p) |
| 3–15 | 3–4 takes, may run long | power granted, power used, reveal |
| < 3 | 1–2 premium takes, ceremony allowed | each power's effect, pool empty, start, end |

Appendix C is the **cue bible** — what every cue is made of and when it plays.
Appendix D is the **cue sheet** — how each one is mixed. For each cue it gives:

- plays per game at three and six players;
- level relative to its bus;
- priority, instance cap and cooldown;
- the variation count;
- the *short variant* the backlog plays at 1.5× (§4.2);
- its role in the activity envelope.

### 3.8 The nine motifs

- **Mode.** All nine are in D Romanian minor (Dorian ♯4: D E F G♯ A B C) — the
  colour of the doina — so they sound like one family.
- **Instrument by type.** Reactive powers, which interrupt out of turn, speak on
  the **fluier** (high, bright). Active powers, played on your own turn, speak on
  the **caval** (low, breathy). Clownfish, the mimic, speaks on the **drâmbă**.

| Power | Instrument | Motif | Why |
|---|---|---|---|
| Shark | fluier | a low note, then a leap of a minor seventh, cut short | jumping in |
| Tortoise | fluier | one note struck three times; begins and ends on the same pitch | enclosed |
| Lanternfish | fluier | a five-note palindrome, A B C B A | mirror symmetry, like its carving |
| Mantis Shrimp | fluier | an accented high G♯ falling a tritone to D | the strike and the crack |
| Jellyfish | caval | a trill that sags 50 cents and stops | stunned |
| Stickleback | caval | three barbed grace notes into one short note | the hooks |
| Whale | caval | two long notes, a falling major sixth, with a swell | the heaviest thing in the sea |
| Clownfish | drâmbă | the motif of the power it copied | its body is an empty slot |
| Squid | — | **a rest** | the one motif the game never plays |

- **When they play.** Only when the rank is public (`POWER_USED`; `POWER_GRANTED`
  in Mode Deschis), or privately in headphones mode. In the speaker profile they
  play as two-note cuts (§3.4).
- **What they are for.** A power fires less than once a game (§1.1), so in play a
  motif is *ceremony*: it marks a rare, big moment and makes it feel authored.
  Players learn the motifs in the Codex (§5.8), where each plays beside its card.
  Recognition is tested there for distinctiveness (§9.2), not expected from play.

### 3.9 The world arc

Two public axes drive the ambience and its visual twin (§5.4):

| Axis | Source | Drives |
|---|---|---|
| **Progress** | cards in play = 60 − real cards laid | light (dusk → evening → night at 40 and 20 cards); life (fish jumps, birds and reeds thin out as cards fall); the **last light** at ≤ 12 cards: a sparse, low dobă pulse (one hit every 6 s) and a short room tail on the clock |
| **Water** | the pool count | the water bed (lapping → shallow → dry wind in the basin); the wetness of `table.draw`; wet or dry go fish (§4.1); the basin visual |

- All states **crossfade over 3 s and only move forward**: cards in play and the
  pool never rise.
- **Levels:** ≤ −32 LUFS short-term, carved per Law 2, shaped by the activity
  envelope; generated live (§3.5).
- **Default on**, and louder in the lobby. This reverses DESIGN §7.2 and is
  playtest-gated: if 5 or more of the 15 pooled playtesters turn it off, it
  ships off.
- **No music bed during play.** DESIGN §7.1 stands. The pond is atmosphere, not
  music.

### 3.10 The window clock

- **Server-authoritative.** `pendingWindow.deadlineAt` (server epoch ms) joins the
  view, and every `game_state` carries `serverNow`. The client keeps an offset:
  the minimum of the last five `serverNow − localNow` samples, corrected by half
  the ping round trip. The notches and the ticks both read
  `deadlineAt − (now + offset)`.
- **Shape (answer window).** `clock.open` as it opens, then silence until *T* s
  remain, `clock.tick` each second from *T*, and `clock.tick.urgent` every 500 ms
  in the last 3 s while the notches turn *roșu*; the close comes from the view. *T*
  starts at 5 s and is re-set from playtest 1's answer-time distribution so that
  most answers never tick.
- **Other windows** play no clock sound until the rules decision (§11.1); the
  eligible player sees the plank and clock and feels the private haptic.

### 3.11 Haptics

Android Chrome only. Every haptic has an audio or visual twin; haptics have their
own toggle.

| Signal | Pattern (ms) | Tier |
|---|---|---|
| your turn | 16 | public |
| you were asked | 12 · 60 · 12 | public |
| a window where you are eligible | set per motor class by the desk test; opt-in until then | private |
| a card lands in your hand | 6 | public |
| cards taken from you | 30 | public |
| you are stunned | 40 | public |
| your set destroyed | 20 · 30 · 40 | public |
| Squid | none | — |

iOS 18 Safari's haptic on toggling an `<input type="checkbox" switch>` is an
undocumented side effect. It is worth a one-day spike for "your turn" and "you
were asked" only, and never for private signals.

### 3.12 Audio accessibility

Every informative sound has a visual twin (the mute test, §9.3). Seat pitch gives
listeners *who* without panning. The mixer, the output profiles, mono, *softer
sounds* and the A/V offset are all in settings. Screen-reader announcements never
depend on sound (DESIGN §10).

---

## 4. Feel

### 4.1 The ask, beat by beat

| Beat | Asker | Target | Everyone else | Time |
|---|---|---|---|---|
| **0 Intent** | Phone: tap a card group, which lifts; a thumb-zone sheet of targets rises (`mock-phone-ask-sheet-390x664.png`); tap a name. Desktop: drag the group onto a post, or tap-tap. The lift answers in ≤ 50 ms; `ui.select`, `ui.target`. | — | — | human |
| **1 Ask** | an arrow-chip — a carved token bearing the rank's seal — flies from the asker's post to the target's on an arc and lands with `table.ask`, gliding asker-pitch → target-pitch; the post wobbles 2 px; the log line stamps in | same | same | 320 ms |
| **2 Hold** | banner *"Bogdan răspunde…"* and a compact clock | the plank rises with `table.asked` and the 12·60·12 haptic; two equal buttons in the thumb zone (`mock-phone-answer-390x664.png`) | banner and compact clock | human |
| | the arrow-chip rocks gently on the target's post — the only idle motion in the game | | | |
| **3 Answer** | — | any answer: `table.answer`; the plank sinks | — | 220 ms, uniform |
| **4a Yes** | the chip flips to its ochre face; backs fly target → asker, 60 ms apart, `table.give`; they turn face-up in the dock; the totem stamps in place, `table.bonus` | the cards leave the dock; 30 ms haptic | backs fly between posts | ≈ 700 ms |
| **4b No, water in the pool** | the chip dives into the pond, `table.gofish`, a ripple; a card rises to the asker, `table.draw`; the totem moves on | — | same | ≈ 1.0 s |
| **4c No, the pool is dry** | the chip clatters onto the dry basin floor and skids to rest, `table.gofish.dry`; nothing rises; the totem moves on (`mock-phone-dry-pond-390x664.png`) | — | same | ≈ 0.6 s |

At six players, beat 4c is the most common outcome in the game, so it is also the
shortest. It is played for a small laugh: the arrow-chip, a dusty knock, *"balta e
goală"*. Engine overhead outside the human hold is 0.6–1.0 s, and **input is
never blocked** — the next player may start their ask while the totem is in the
air. A *table speed* setting (1× or 1.5×) scales every table-lane duration.

### 4.2 The presentation timeline (replaces `beats.ts`)

- **Sequence numbers.** The server stamps every event and every view with a
  per-room `seq`. The client presents in `seq` order and tracks the last `seq` it
  presented. A reconnect never replays choreography: missed lines go to the log
  under a *"while you were away"* divider. This retires A10 by construction.
- **Pure choreography.** `choreography.ts` maps the public record and seat facts
  to `Beat`s — lane, duration, lead-in, flights, VFX, cue requests, haptics,
  masks — with no side effects. Together with `cues.ts` it is what the leak test
  compares (§6.5).
- **Lanes.** `table` plays in order; `hud` (pips, counts) and `log` play in
  parallel.
- **View-driven transitions.** Window openings and closings, arrivals and
  departures are derived from view diffs in `seq` order. Events only *label*
  those diffs: they never make an animation happen on their own, nor stop one.
- **Masking.** Logic and input read the authoritative view the instant it
  arrives; only pixels wait. An arriving card is laid out but hidden until its
  flight lands (never longer than 800 ms), and a departing card is drawn as a
  ghost until it takes off.
- **Backlog.** More than 1.2 s queued: play at 1.5× with each cue's short variant
  (Appendix D). More than 2.5 s: flush to the end state and play only the last
  landing.
- **Uniform close.** Every window closes with the same 220 ms animation, however
  it closed. Durations are part of the output the leak test compares (§12
  explains why this replaces the 700 ms hold).
- **Reduced motion.** Beats still play in order, but travel is instant; stamps
  become a one-frame ink saturation; hit-stop, shake and impact frames are off.
  Audio is unchanged.

### 4.3 The juice kit — rarer means bigger

| Class | Events (plays per game) | Allowed |
|---|---|---|
| Light | turn, ask, answer, draw, go fish, tick, press (40–100) | stamp and sound; no shake; ≤ 320 ms of table time |
| Medium | give, bonus, lay, reveal, reflect, block, steal, stun (5–25) | flights, stamp, sound; shake ≤ 1 px |
| Heavy | shark, mantis, whale, pool empty (< 1 each) | hit-stop 60–80 ms; trauma 0.4–0.6; one impact frame; the signature cue |
| Ceremony | game start, game end (1) | up to 3 s, never blocking input |

- **Hit-stop.** Pause the table lane's animations for 60–80 ms at impact. Audio
  does not pause: the impact sound *is* the freeze.
- **Impact frame.** For two frames (≈ 33 ms) the table layer swaps ink and paper —
  a negative print. At most one per heavy event, never two within a second
  (WCAG 2.3.1), never on text or HUD, off under reduced motion.
- **Trauma shake.** Trauma decays at 1.6/s; offset = trauma² × 6 px (4 px on
  phones), from summed sines. Translation only, on the table layer only, so the
  fixed plank stays put.
- **Stepped VFX, "on threes."** Splashes, splinters, ink bursts and glints are 3–4
  hand-cut SVG frames at 12 fps — a flip-book of woodblock prints. Cards are
  objects: they fly at 60 fps and land with the stamp.
- **Flights.** FLIP from rect to rect along a quadratic arc lifted 40–80 px toward
  the table's centre.
  - Duration: `clamp(distance ÷ 1.8 px/ms, 260, 460)` ms.
  - Rotation: from the source tilt, through a ±6° flutter, to the destination
    tilt.
  - Elevation peaks mid-flight at `--elev-3`, then snaps to `--elev-1`.
  - 60 ms stagger; at most twelve cards in flight at once.
- **Shark interception.** The cards turn at a hard corner at 55 % of their path —
  the only reversal in the game — and the shark's seal stamps at the corner.

### 4.4 Input under the clock

- **Phone.**
  - Asking is tap group → tap name, both in the thumb zone (the ask sheet).
  - Answering uses the plank's two equal buttons.
  - Every timed action lives in the bottom 45 % of the screen on targets
    ≥ 44×44 px. Sheet rows are 56 px.
- **Desktop.** Drag a group onto a post (8 px threshold, so a tap still
  selects), or tap-tap.
- **Keyboard.** `1`–`9` pick a group; `←`/`→` cycle targets; `Enter` asks. When
  asked, `Space` answers truthfully. In a window, `D` declares and `Esc`
  declines.
- **No `<select>` under the clock.**
  - Jellyfish: tap a target.
  - Stickleback: tap a target, then one of eight seals.
  - Whale: tap one of the highlighted adjacent pairs, drawn as rope links between
    chips.
  - Tortoise, Mantis, Shark, Lanternfish: one button.
- **Optimistic declare.** The tap stamps and locks the plank at once; the next
  view reconciles. Losing a race to another holder reads *"Prea târziu — Cezar a
  fost mai rapid."*
- **Latency.** Input → visual ≤ 50 ms p95 on a mid-range Android, measured with
  the Event Timing API. Input → audio ≤ 80 ms plus device output latency.

### 4.5 Legibility moments

- **Your turn** is the most important transition, so it uses every channel:
  - the totem lands on your dock chip;
  - `table.turn.you` sounds in your seat's pitch;
  - a 16 ms haptic;
  - the dock's rope lights and the dock lifts 8 px;
  - the top bar turns ochre;
  - the screen reader announces it.

  Idle for 15 s, it knocks once more (`meta.nudge`).
- **Someone else's turn:** the totem's travel and one knock in their pitch.
- **A window:** the plank and the inset frame if you can act; the banner if you
  can't.

### 4.6 Connection feel

- Re-send `rejoin` on every socket `open` when a session exists (A15).
- Disconnected under 1.5 s: show nothing. Longer: the table drains to
  `--ink-soft` and a carved plaque, *"Se reconectează…"*, replaces the red bar. On
  rejoin: a 460 ms re-ink sweep and `meta.reconnected`.
- A dropped player's chip goes dashed and wears the "gone fishing" hook
  (`mock-chip-states.png`). It can still be asked, and the server answers for it
  after the timeout (*plecat · auto* on the ask sheet).

---

## 5. Visual design

### 5.1 What stays

Palette and tokens; Vollkorn and Source Serif 4; the nineteen carvings and their
seals; category by shape; notched geometry; the totem.

### 5.2 The one-screen table — mocked and fit-tested

The mocks in `docs/plan-evidence/` are rendered by `docs/plan-evidence/mock/`
from the client's **real** card art, seals, totem, notch clock, fonts and tokens.
Its `shoot.cjs` asserts the one-screen rule at real browser heights, and **all
frames pass**:

| Frame | Size | What it proves |
|---|---|---|
| `mock-phone-your-turn-390x664.png` | iOS Safari with toolbars | the whole table, your turn, six players |
| `mock-phone-your-turn-360x640.png` | Android Chrome | same, narrower |
| `mock-phone-your-turn-375x548.png` | iPhone SE Safari | the smallest target still fits; the pond absorbs the difference |
| `mock-phone-ask-sheet-390x664.png` | | targets in the thumb zone, full names, stunned disabled |
| `mock-phone-answer-390x664.png` | | the answer plank: equal buttons, clock, card |
| `mock-phone-dry-pond-390x664.png` | | the empty-pool go fish |
| `mock-chip-states.png` | 2× | eight chip states, including the worst case |

**Phone anatomy** (390 wide):

- **Top bar**, 40 px — turn, sound, menu.
- **Opponent strip**, 96 px — up to five chips of 60×76 px.
- **The pond** — flexible, 185–300 px (measured at 375×548 and 390×664). The pool stack and count, the flight
  stage, and a one-line ticker that taps open the log drawer.
- **Your dock**, 227 px, fixed and safe-area aware — your chip and the hand at
  104×156. Every plank and sheet rises over this area.

**The chip** (60×76) carries eight states, proven in the chip sheet:

- a name plate — first word, CSS ellipsis; the full name is on the ask sheet, the
  plank and the drawer;
- mark and score;
- power pips — ◆ unused, ◇ used or destroyed;
- hand count;
- status seals: stunned *branded* with the jellyfish seal and inked at 45 %;
  protected by a verdigris shell and seal; disconnected dashed, with the hook;
- the current turn: an ochre border with the totem on the top edge.

**Desktop** (≥ 1024 px) — *the pond table*:

- the opponents' posts stand on an arc above a wooden surface, with the pool at
  its centre;
- your post and hand sit at the bottom centre;
- the log is a 280 px tally board on the right;
- posts have a fixed width of 150 px (A22).

Between 600 and 1024 px, the desktop arrangement scales and the log becomes the
drawer. The desktop target frame is M2's first deliverable, fit-tested the same
way at 1280×800 and 1024×768.

### 5.3 The hand

- **Sort** by category (powers, then normal, then eggs), then rank. Duplicates
  **group**: a 26 px step inside a group, which keeps the 22 px index strip
  clear, and a group step computed from the width available (36 px at 390 and
  30 px at 360, with nine cards in six groups). A ×N badge marks duplicates.
- **Corner index.** The carved seal is already in each card's top-left corner.
  Below it stands a vertical three-letter abbreviation (*REC, ȚES, HER…*), so a
  fanned hand reads like a real one. The mock shows all nine cards identifiable
  at 360 px.
- **Layable sets tie themselves.** The group lifts 6 px and gains an ochre rope
  and a carved *"PUNE JOS"* tab — the set is the button. Eggs that complete a set
  move beside it.
- **Fit.** Overlap comes from the width available (with `min-width: 0` on the
  panel, A17). Past eight groups the dock scrolls sideways with snap.

### 5.4 Texture, ink and light

- **Paper grain**: one 256×256 fractal-noise PNG (≤ 8 KB) on paper surfaces, at
  12–16 %, static.
- **Wood grain**: a 512×128 directional-turbulence tile replaces the stripes.
- **Water**: the background becomes a low-contrast relief of carved waves
  (≤ 10 KB). The mocks use feTurbulence and SVG stand-ins for all three.
- **Light follows the progress axis** (§3.9): `--apa` steps to two darker flat
  tokens at 40 and 20 cards in play. There are no gradients; the night comes in
  two cuts.
- **Ink edges, baked in vector.** `scripts/bake-ink.mjs` subdivides each carving's
  paths and offsets vertices along their normals by seeded noise (±1–2 units),
  then adds ink pools at junctions.
  - It is deterministic, with one seed per asset, never rank-derived for backs.
  - Its output is committed.
  - It is prototyped on two cards in M1 and reviewed in the Codex. If it reads as
    fake, the fallback is to rasterise feTurbulence and feDisplacementMap in
    headless Chromium and ship WebP.
- **Budget**: +30 KB. Contrast is re-audited with the grain applied; body text
  stays ≥ 7:1.

### 5.5 VFX in print

Stepped SVG sequences, 3–4 frames each, ≤ 2 KB each, on one sheet reviewed in the
Codex:

| Effect | Used for |
|---|---|
| ink burst | the stamp |
| wood chips | splinter |
| water ring and splash | go fish |
| dust puff and skid marks | dry go fish |
| carved speed grooves | flight smear |
| shell clamp | Tortoise |
| bell stamp | Jellyfish |
| mirror glint | Lanternfish |
| barbed hook | Stickleback |
| spiral chips | Whale |
| roe burst | score |
| gate doors | game start |

### 5.6 Player marks

Six carved marks, assigned by seat and paired with the seat's pitch: *brad* (fir),
*val* (wave), *soare* (sun), *funie* (rope knot), *cruce* (cross-hatch) and
*rozetă* (rosette). They appear on chips, the ask sheet, log lines and
arrow-chips. Identity is carried by shape and sound, never by colour.

### 5.7 Signature moments

- **The reveal** (Mode Ascuns, a hidden power's first use): the face-down plate
  lifts (120 ms), flips in three stepped frames, rises to `md` at the pond's
  centre with its seal and motif, holds 400 ms, and presses flat again. About
  1.3 s, never blocking. It is the payoff of Mode Ascuns, and at < 1 per power per
  game it can afford the time.
- **The Mantis strike**: hit-stop, an impact frame, splinters; the crack stays on
  the plate.
- **The Shark's interception**: the cards turn mid-flight; the water rushes.
- **The Whale**: both hands rise, twelve backs spiral at the pond's centre
  (900 ms), then the redeal (460 ms).
- **The pool empties**: the stack drains into a carved basin and stays that way.
- **Game over**: the winners' posts rise; a tie is equal totems; the roe pips
  count up one by one.

### 5.8 Screens and chrome

- **Lobby**: the pond at dusk. Sound wakes on the first tap — the unlock *is* the
  first knock.
- **Waiting room**: each post carves in on join with its seat's pitch; the host's
  Start is the heaviest element; on start, the tulnic calls and the gate opens.
- **Top bar**: icon tabs with labels. Mute is one tap; a long-press opens the
  mixer. Language moves into the menu.
- **Rules**: adds the **Codex** of DESIGN §5.8 — the nine powers, each with its
  motif. It is where motifs are learned.
- **Copy**: *"You may lie with Squid"* appears only with an unused Squid (A23).

### 5.9 Visual accessibility

Remove `maximum-scale=1` (A24). Focus rings stay. Photosensitivity rules are in
§4.3 and reduced motion in §4.2. Grain is contrast-checked. States are never
carried by colour alone: stunned is a brand, protected a shell, offline a dash and
a hook.

---

## 6. Secrecy and integrity

### 6.1 Per-viewer event redaction (M0)

A new `redactEventsForPlayer(state, events, viewerId)` in `engine/src/redact.ts`,
applied per player in `room.broadcastState`, reusing the concealment predicate
that `laidSets` already uses. The spectator view — no cards, no grants — is the
*public record* of §3.2.

| Event | Rule |
|---|---|
| `GAME_STARTED` | drop `seed` |
| `DREW_FROM_POOL` | `cardId` for the drawer only |
| `SET_LAID` | `rank: null` while the set is concealed from the viewer |
| `POWER_GRANTED` | `rank: null` while the source set is concealed; `grantId` to the owner only |
| `CLOWNFISH_BOUND` | owner only in Mode Ascuns; everyone in Mode Deschis |
| `WINDOW_OPENED` | `eligiblePlayerIds` becomes `youAreEligible`; context through the existing `redactWindowContext` |
| `POWER_USED` and every effect event | public as they are; `grantId` to the owner only |

### 6.2 One shape for every answer (M0)

`handleDeclareSquid` closes the window through `closeWindow`, like every other
path, so the honest "no", the Squid deny and the Squid claim all emit
`WINDOW_CLOSED(RESPONSE_PENDING) › REQUEST_FAILED › …`. `WINDOW_CLOSED` says
nothing about powers, so emitting it is safe; omitting it was the leak. An engine
test asserts that the three paths produce identical redacted streams for every
viewer other than the target.

### 6.3 Seed and ids (M0)

- **The seed.** The server fills the 128-bit state of a xoshiro128\*\* PRNG from
  `crypto.randomBytes(16)`, replacing the 32-bit mulberry32. The seed is never sent. Tests keep
  explicit seeds; seed-pinned expectations are re-baselined.
- **Card ids** become random tokens from the same stream.
- **Grant ids** reach their owners only.

### 6.4 Action binding (M0)

- The server overwrites `action.playerId` with the socket's player.
- `SKIP_WINDOW` gains a `playerId` and must come from an eligible player.
- The room's timeout submits a server-only skip.
- Bots and engine tests are updated to match.

### 6.5 The guarantee, as a test

`presentation-leak.test.ts` is built in M0 (for the event and view layer) and
extended in M1 (for `choreography.ts`, `cues.ts` and the haptics map). It
generates **pairs of histories whose public records are identical** and asserts
the two conditions below.

The fixtures:

1. an honest "no" vs a Squid deny vs a Squid claim — the first fixture, and the
   one that fails today;
2. two face-down power sets of different ranks, each on a path that opens no
   rank-dependent window — Tortoise vs Lanternfish while their owner is never
   asked;
3. a clownfish bound to different powers, in Mode Ascuns;
4. two different hands behind the same public actions — the same asks, answers
   and draws.

The assertions:

- **For every non-owner viewer**, every output is identical: beats, durations,
  classes, cues, haptics.
- **For every viewer, the owner included, in default mode**, the audible output —
  cues, and haptics above the private threshold — is identical.

Two structural guards back it up:

- The client imports only the redacted `PublicEvent` type. Nothing in
  `components/`, `audio/` or `motion/` can name a raw `GameEvent`.
- A lint rule rejects any dynamic `import()` or bank key containing a power
  rank's name.

### 6.6 The tells that live in the rules

A6's five windows reveal holdings by existing. The rules-tell test enumerates
them and is marked *known-failing* until §11.1 is decided — so the gap is tracked,
not forgotten. Until then:

- the audio layer does not voice these windows (§3.2);
- the banner is kept neutral: *"fereastră deschisă"*, never the window's name;
- the plan claims only what §6.5 proves.

---

## 7. Tooling — so one person can tune a six-player game

### 7.1 The bot table

`?table=bots&n=6&seed=42&seat=0&speed=1` runs `createGame`, `reduce` and the
existing bots in the browser, feeding seat 0's redacted record into the real
store. You play or watch seat 0 at 0.25–4× speed, with pause and step.
≈ 1.5 days.

### 7.2 Scenario fixtures

Built on the engine's test helpers and loaded from a menu:

- a shark window open;
- a mantis strike;
- a whale between two full hands;
- a pool at one card, and a dry pool;
- a ten-card hand;
- six players with 24-character names.

### 7.3 The audio lab

`?lab=audio`:

- every cue, with its variations;
- the recipe parameters on sliders;
- bus meters, the activity envelope and a live voice count;
- an event → cue trace;
- short-term loudness;
- a profile switch (speaker or headphones).

### 7.4 Automated checks

- **Layout** (Playwright): `mock/shoot.cjs`'s checks, pointed at the product — at
  360×640, 390×664 and 375×548, with three and six players, in every state; and
  at 1280×800 with a twelve-card hand.
- **Offline audio** (headless Chromium): every cue rendered through an
  `OfflineAudioContext` and checked for level, length and non-silence; the
  human-paced scripted game rendered per profile from seat 0 and checked for
  integrated loudness and true peak (a ~100-line BS.1770 meter).
- **Unit**:
  - the leak test (§6.5);
  - the rules-tell test (§6.6);
  - a snapshot of the cue sheet per event × seat role × mode;
  - the 300-event regression — a 1,000-event game still presents at the end.
- **Budgets**: added JS ≤ 60 KB gzipped over today's 65 KB; audio downloads
  ≤ 220 KB; textures ≤ 30 KB.

### 7.5 The call rig

Five clients (three laptops, two phones) on speakers in one Discord call, plus a
headset listener recording the far end. It runs the §9.3 call test and
experiment E1.

---

## 8. Production plan

Focused days for one engineer who is comfortable with Web Audio, plus a
part-time sound designer and illustrator. Content work (motifs, Foley, textures,
VFX) runs in parallel but does **not** shorten the engineering path.

### 8.1 Milestones

**M0 — Stop the bleeding** · 7–9 engineering days.

- *Scope:*
  - event redaction (§6.1): 1.5 d;
  - one shape for every answer (§6.2): 0.5 d;
  - the 128-bit seed, the new PRNG and card ids, with test re-baselining: 1.5 d;
  - action binding (§6.4): 1 d;
  - the two audio tells and view-driven closes: 0.5 d;
  - `seq` and the late-game fix: 0.5 d;
  - auto-rejoin: 0.25 d;
  - the log scroll, hand overflow, sixth post, pinch-zoom and copy: 0.5 d;
  - `deadlineAt`, `serverNow` and the clock offset: 0.75 d;
  - Vitest in the client and the leak test's event and view layer: 1 d.
- *Exit:*
  - the leak test passes fixtures 1–4 at the event and view layer;
  - a 1,000-event game still presents at its end;
  - a 5 s network cut recovers without a reload.
- *Demo:* Mode Ascuns with three players — nobody's log or socket names a hidden
  set, and a Squid lie cannot be told from the wire.

**M1 — Foundations** · 8–10 engineering days.

- *Scope:*
  - the audio engine (§3.5), with every current cue migrated;
  - the presentation timeline (§4.2);
  - the bot table and fixtures;
  - the audio lab;
  - the offline loudness renderer;
  - the Playwright checks;
  - the ink-bake prototype on two cards.
- *Exit:*
  - no regressions;
  - six bots at 4× for 30 minutes with no drift and no voice leaks;
  - loudness per profile in CI;
  - the leak test extended to cues and choreography.
- *Demo:* the bot table and the lab, live.

**M2 — Vertical slice: the ask** · 10–13 engineering days.

- *Scope:*
  - the phone table (§5.2) and the desktop target frame, then the desktop
    table;
  - the hand (§5.3), the ask sheet, drag and keyboard;
  - flights, the arrow-chip and masking; the totem;
  - beats 0–4c with their cues, seat voices and variation;
  - the answer window's uniform cue and the server clock;
  - haptic tiers and the uniform close;
  - the call rig's first run.
- *Exit:*
  - every layout check green;
  - playtest 1 (§9.2): no scrolling to act and 0 whose-turn confusions observed;
  - engine overhead per ask ≤ 1.0 s.
- *Demo:* a five-player game on phones, end to end, over a real voice call.

**M3 — The nine powers and the rules decision** · 10–13 engineering days
(+3 art).

- *Scope:*
  - the procedural motifs, with speaker cuts;
  - every power cue;
  - the four signature moments;
  - declares without selects; optimistic declare and "too late";
  - if §11.1 is accepted: the single answer plank (2 d) and folding `TURN_START`
    into the turn (1 d), inside the range.
- *Exit:*
  - every power has a rank-correct, public audiovisual in both modes;
  - leak-test fixtures cover all nine;
  - the rules-tell test passes or is recorded as a decided exception;
  - playtest 2.
- *Demo:* the power showcase in the bot table.

**M4 — World and ceremony** · 8–10 engineering days (+4 audio production,
+4 art).

- *Scope:*
  - the texture and ink bake;
  - the world arc (§3.9) and its light steps;
  - lobby and waiting-room audio, with seat pitches;
  - the tulnic start and the end ceremonies; the tally;
  - player marks; top-bar icons; the Codex;
  - the recorded tier swapped in.
- *Exit:*
  - art review in the Codex at three sizes;
  - the ambience opt-out count measured;
  - loudness re-verified with the recordings.
- *Demo:* the full session arc, lobby to tally.

**M5 — Tune and gate** · 5–7 engineering days.

- *Scope:*
  - performance on a mid-range Android;
  - the accessibility audit;
  - the mix pass (the blindfold, mute, call, desk and phone-speaker tests);
  - playtest 3 and its fixes.
- *Exit:* every §0.2 item.
- *Demo:* the release candidate.

**Totals:** 51–62 engineering days (≈ 12–13 weeks for one engineer), ≈ 6 days of
audio production including motif writing, and ≈ 7 days of art.

### 8.2 Critical path

M0 → M1 (timeline and audio engine) → M2 → M3 is the spine. Motif writing and
the Foley session run from M2, the texture tiles and VFX sheet from M1; all of
them land as bank and asset swaps under existing ids.

### 8.3 Cut lines

- **Four weeks (~21 days).** M0; the minimal M1 (mixer, profiles, voices, live
  wood/paper/water, timeline — no lab); and M2's core (the phone table, the
  hand, the ask sheet, give and draw flights, wet and dry go fish, the server
  clock). It delivers the secrecy fixes, the phone fix and the core loop's feel —
  most of what players will perceive.
- **Eight weeks:** plus the rest of M2, and M3 without the rules change.
- **Full:** everything.

---

## 9. Measurement

### 9.1 Automated gates (CI)

- The leak test and the rules-tell test.
- The cue-sheet snapshot.
- Loudness per profile, human-paced, from seat 0; a six-event burst with no clip.
- The layout checks at the §5.2 sizes.
- The 300-event regression.
- The bundle and asset budgets.
- Input latency ≤ 50 ms p95 and ≥ 55 fps during a six-player whale, measured in
  the bot table at 4× CPU throttling and confirmed on a real mid-range Android at
  each milestone.

### 9.2 Playtests

**Protocol:** three rounds — after M2, M3 and M5 — of five players on Discord
voice, with at least one iPhone and one Android among them. Each round runs
45 minutes with an observer, screen recordings and a short survey. **Results are
pooled across rounds (n = 15) and reported as counts.** Five players cannot
support percentage gates.

| Measure | How | Target |
|---|---|---|
| Whose-turn confusions | observer tally per session | 0 in round 3 |
| Missed windows | eligible windows that timed out, and the total, from `?metrics=1` | report both; investigate any miss |
| Answer time | median and p90 when asked, from `?metrics=1` | sets the tick threshold *T* (§3.10) |
| Muted by the end | count | ≤ 2 of 15 |
| Ambience turned off | count | ≥ 5 of 15 → ships off |
| "I always knew what just happened" | 1–7, median | ≥ 6 |
| "The table feels alive" | 1–7, median | ≥ 5.5 |
| Motif distinctiveness | after one Codex pass, match 8 motifs to 8 cards | median ≥ 6 of 8 (pooled) |
| Private information heard or seen | reports, plus a review of the call recordings | 0 |

`?metrics=1` records timings locally and offers a JSON download at the end of the
game; there is no server telemetry.

### 9.3 Listening and device tests (M2 first pass, M5 sign-off)

- **Blindfold.** With the screen off, a listener names, for ten turns, whose turn
  it is (seat pitch) and the outcome type (ask, give, wet or dry go fish, lay,
  power, stun). Target: 8 of 10.
- **Mute.** A full game with sound off; no missed window is attributable to
  missing audio.
- **Call.** The §7.5 rig, with noise suppression on and off:
  - no private-tier cue in default mode;
  - copies and smear per cue family;
  - the game's short-term loudness against the speakers' speech level, as
    measured in the recording;
  - experiment E1's decision.
- **Desk.** An ERM phone and an LRA phone on a wooden desk beside a laptop mic,
  running the private pattern candidates. The quietest perceptible pattern that
  the mic cannot detect becomes the private pattern for that class; a class
  with none keeps private haptics off.
- **Phone speaker.** Every cue audible and undistorted in the speaker profile at
  50 % volume, in a quiet room and in ~60 dBA café noise.

---

## 10. Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| R1 iOS Safari audio quirks (silent switch, interruptions, unlock) | H | H | a device matrix per milestone; unlock on first gesture; `audioSession`; the silent-switch hint |
| R2 Bluetooth output latency desynchronises hits | M | M | `outputLatency` compensation; the manual A/V offset |
| R3 Flights drop frames on low-end Android | M | H | transform and opacity only; `will-change` on fliers only; at most 12 in flight; flutter dropped first |
| R4 A future change re-leaks a secret | M | H | the leak test in CI; the `PublicEvent`-only import rule; the lint rule |
| R5 The call smears the mix | H | M | the echo budget; the speaker profile; E1; the call rig from M2 |
| R6 Folk or liturgical material reads as kitsch or disrespect | M | M | material, not liturgy; the tulnic, not the toacă, calls; a folk consultant; a real player |
| R7 The vector ink bake reads as fake | M | M | the two-card prototype in M1; the raster fallback |
| R8 The rules decision is refused | M | M | the tells stay silent in audio and neutral in text, and are documented in DECISIONS.md |
| R9 Scope creep | H | M | the vertical slice first; the cut lines |

---

## 11. Decisions needed

**11.1 Uniform windows** — a rules change that needs a `DECISIONS.md` entry.

- **(a) Fold `TURN_START` into the turn.** Active powers are offered in the dock
  before the ask, with no window and no timer. Cost: none.
- **(b) The single answer plank.** The target's options — the truth, the Squid
  lie, the Lanternfish reflection, the Tortoise protection — arrive on one plank.
  After a reflection, the asker always gets one short "protect or accept" plank.
  Saves up to two waits per ask.
- **(c) Mantis and Shark become fixed-length beats for everyone.** After every
  power-set lay and every successful transfer there is a 2.5–3 s beat that no one
  can skip and only a declaration ends early. It costs ≈ 75–80 s a game (≈ 8
  power lays and 22 transfers).

*Recommended:* (a) and (b) in M3; (c) as a playtest A/B against accepting the
group-level tell.

**11.2 Ambience default** — on, playtest-gated (§3.9).

**11.3 Phone asking** — the thumb-zone sheet on phones; drag on desktop.

**11.4 The uniform close** — replaces the 700 ms hold (§12).

**11.5 Recorded audio budget** — ≈ €300–600, plus a consultant session.

**11.6 Headphones mode** — ship it, off by default.

**11.7 A folk-music consultant** — 2–3 hours on the palette and the motifs, before
the M4 session.

---

## 12. Amendments to DESIGN.md

| § | DESIGN.md says | This plan says | Why |
|---|---|---|---|
| 5.4 | tap a post, then a card, then confirm | phone: tap a group, then a name, in the thumb zone; desktop: drag or tap-tap | the targets must be under the thumb (mocked) |
| 6.2 | nothing may exceed `--dur-heavy` except game over | signature moments may run to 1.4 s and never block | rare moments need anticipation, turn and hold |
| 6.5 | the authoritative view updates immediately | logic and input do; arriving pixels are masked for ≤ 800 ms; transitions come from view diffs | otherwise cards appear before they fly, and event shapes could steer presentation |
| 7.1–7.2 | the toacă as the UI material; ambience off; one sprite | the plank's material, not its liturgy; the tulnic calls; ambience on and playtest-gated, generated live; live synthesis plus banks | cultural care; the pond is the world's voice; budgets close |
| 7.3 | `SET_LAID` identical for power and normal | identical for every *rank*; the category may differ | `isPowerSet` is already public |
| 7.3 / 7.4 | eligible players hear a distinct window figure and ticks | only the answer window is voiced, identically on every client; eligibility is private tier | a distinct sound on one client is a tell over voice chat |
| 7.5 | duck ambience −6 dB under table cues | a slow activity envelope, at most −4 dB | per-cue ducking pumps at ~100 windows a game |
| 8.2 | haptics as the eligibility signal | Android only; the private pattern is set by the desk test | iOS has no Vibration API; a buzzing phone on a desk is audible |
| 9.4 | hold 700 ms after every window closes | every window closes with the same 220 ms animation; durations are leak-tested | the hold hides nothing that uniform, pure choreography does not, and it would add half a second to the most frequent transition |

---

## Appendix A — Every event, every channel

| Event | Motion | Sound (default) | Haptic | Class |
|---|---|---|---|---|
| `GAME_STARTED` | the gate opens; the posts carve in | `mus.start` | — | ceremony |
| `TURN_STARTED` | the totem travels | `table.turn` / `table.turn.you` (seat pitch) | 16 (you) | light |
| `TURN_SKIPPED_STUNNED` | the totem passes over the post; the post shudders 2 px | `table.skipped` | 40 (you) | light |
| `BONUS_TURN` | the totem stamps in place | `table.bonus` | — | light |
| `HAND_REFILLED` | *n* cards rise from the pool, 90 ms apart | `table.draw` × *n* | 6 each (you) | light |
| `REQUEST_MADE` | the arrow-chip flies asker → target | `table.ask` (pitch glide) | — | light |
| answer window opens (view) | the plank (target), the banner (others) | `clock.open`; `table.asked` (target) | 12·60·12 (target) | — |
| any other window opens (view) | the plank and frame (eligible), a neutral banner (others) | none until §11.1 | private (eligible) | — |
| any window closes (view) | the uniform 220 ms close | `clock.close` (answer window only) | — | — |
| `REQUEST_SUCCEEDED` | backs fly target → asker | `table.flight`, `table.give` | 30 (loser) | medium |
| `REQUEST_FAILED`, pool > 0 | the chip dives into the pond; ripple | `table.gofish` | — | light |
| `REQUEST_FAILED`, pool = 0 | the chip clatters into the dry basin | `table.gofish.dry` | — | light |
| `DREW_FROM_POOL` | a card rises from the pool | `table.draw` (or `table.poolEmpty`) | 6 (you) | light / heavy |
| `SET_LAID` | the group converges, presses flat under the post; a pip is gouged | `table.lay` / `table.lay.power` | — | medium |
| `SET_DESTROYED` | the Mantis strike | `power.mantis` | 20·30·40 (owner) | heavy |
| `POWER_GRANTED` | the collar, or the back's rosette core, ignites in indigo — identical for every hidden rank | `power.granted` (the motif in Deschis) | — | medium |
| `POWER_USED` | the reveal (Ascuns) or the flip to spent (Deschis) | `power.used.<rank>`, `power.reveal` | — | medium |
| `CLOWNFISH_BOUND` | the owner's slot fills (owner only in Ascuns) | private / public by mode | — | light |
| `SHARK_JUMP` | the interception | `power.shark` | 30 (loser) | heavy |
| `LANTERNFISH_REFLECT` | the chip mirrors about the pond and returns; cards follow the reflected path | `power.lanternfish` | 30 (loser) | medium |
| `TORTOISE_BLOCK` | the shell clamps over the post; incoming cards strike it and drop back | `power.tortoise` | — | medium |
| `JELLYFISH_STUN` | the bell brands the target's chip | `power.jellyfish` | 40 (target) | medium |
| `STICKLEBACK_STEAL` | cards yanked in a straight line, fast | `power.stickleback` | 30 (target) | medium |
| `STICKLEBACK_WASTED` | the yank catches nothing; one splinter | `power.stickleback.miss` | — | light |
| `WHALE_SHUFFLE` | the spiral and the redeal | `power.whale` | 20 (both) | heavy |
| `GAME_ENDED` | the podium and the tally | `mus.end.*`, `table.tally` | 16 | ceremony |
| **Squid** | **nothing** | **nothing** | **nothing** | — |

## Appendix B — Synthesis recipes

| Family | Made | Recipe |
|---|---|---|
| **Wood** | live | Exciter: a 3 ms noise burst from the shared buffer at a random offset, band-passed at 2.5 × f0 (Q 1). Four sine modes at f0 × 1 / 2.756 / 5.404 / 8.933, amplitudes 1 / 0.5 / 0.25 / 0.12, T60 160 / 90 / 45 / 25 ms × size (A 1.4, B 1.0, C 0.7, D 0.45). *Damping* (0–1) shortens decays and low-passes. Seat pitch sets f0 on the pentatonic. Variation: f0 ±3 %, ratios ±1 %, exciter offset. |
| **Paper** | live | *Slide*: noise through a band-pass swept 2.5 → 4.5 kHz (Q 1.2), 15 ms attack, 40 ms release, 30 % grain from 40–80 Hz modulation. *Lift*: a 25 ms burst, high-passed at 3 kHz. |
| **Riffle** | rendered | 30–45 clicks (3 ms, high-passed at 4 kHz) on an accelerando–ritardando curve over 900 ms. |
| **Water** | live | *Bubble*: a sine rising ~40 % over its 40–80 ms life, decay τ 20–40 ms; large 450 Hz, small 900–1600 Hz. *Plop*: one large and two to four small within 60 ms, plus a 120 ms splash (noise band-passed 1.5–4 kHz). *Dry go fish*: two plank-A knocks with heavy damping, then 3–5 plank-D skid ticks decelerating over 250 ms, then a 60 ms dust hiss. *Drip*: one 1.8–2.6 kHz bubble. |
| **Breath** | rendered, 32 kHz | *Fluier*: sine plus 2nd (−14 dB) and 3rd (−20 dB) harmonics; breath noise band-passed at f0 (Q 8, −18 dB) and 3 kHz (Q 1, −26 dB); 50 ms attack with a −30-cent scoop; 5.5 Hz vibrato ±12 cents after 150 ms; D5–D6. *Caval*: an octave lower, breath at −12 dB. *Tulnic*: harmonics 1–8 at −6 dB/octave, 70–110 Hz, low-passed at 900 Hz, 200 ms attack. |
| **Strings (țambal)** | rendered, 32 kHz | Karplus–Strong in JS (a two-point average, decay 0.996); three strings per course detuned ±4 cents; a low-passed noise hammer; T60 1.5–2.5 s (speaker cut: 400 ms). |
| **Skin (dobă)** | live | A sine falling 95 → 52 Hz over 120 ms, decay τ 180 ms; a 30 ms slap (noise band-passed at 500 Hz); a `tanh` harmonic layer at −10 dB for small speakers. |
| **Drâmbă** | rendered | A 10 %-duty pulse at 98 Hz through two band-pass formants swept 300 → 700 and 900 → 2200 Hz over 400 ms (Q 6), with a 6 Hz formant wobble. |
| **Ink stamp** | live | A sine falling 110 → 70 Hz over 60 ms, then a 15 ms high-passed noise peel at +40 ms. |
| **Pond beds** | live | Water: a looped 2 s noise buffer through a 600 Hz low-pass with 0.2–0.5 Hz amplitude and cutoff drift. Basin wind: a band-pass at 300–900 Hz with a slow drift. Life one-shots come from the water and wood recipes. |

## Appendix C — The cue bible

What each cue is made of, and when it plays. *Heard by*:

- **all** — every client (the public record);
- **local** — the acting client, and only when the action's possibility was
  public;
- **you** — the seat a public fact concerns;
- **private** — headphones mode only.

Lengths are the audible core in the headphones profile; the speaker profile
trims tails to the echo budget (§3.4). Mix values are in Appendix D.

**Interface**

| Cue | Trigger | Heard by | Material and recipe | Length |
|---|---|---|---|---|
| `ui.press` | a primary button | local | plank C, dry | 60 ms |
| `ui.press.soft` | a secondary button | local | plank C, damped | 50 ms |
| `ui.select` | a card group picked up on your turn | local | paper lift and a plank D tick | 80 ms |
| `ui.drop` | a group put back | local | paper settle | 60 ms |
| `ui.target` | a target chosen (sheet row or post) | local | plank B, hollow, in the target seat's pitch | 90 ms |
| `ui.error` | a rejected action | local | plank A, heavily damped — a thud, never a buzzer | 120 ms |
| `ui.toggle` | a setting switched | local | two knocks, rising for on and falling for off | 120 ms |
| `ui.copy` | the room link copied | local | a small ink stamp | 90 ms |

**The table**

| Cue | Trigger | Heard by | Material and recipe | Length |
|---|---|---|---|---|
| `table.turn` | `TURN_STARTED`, someone else | all | plank B in the new player's seat pitch as the totem lands, panned to their chip | 180 ms |
| `table.turn.you` | `TURN_STARTED`, you | you | the same knock in your pitch, then a bright plank C "door knock" 90 ms later | 300 ms |
| `table.bonus` | `BONUS_TURN` | all | the totem knocks twice in place, the second a step higher | 260 ms |
| `table.skipped` | `TURN_SKIPPED_STUNNED` | all | the stunned seat's knock, muffled (low-pass 600 Hz), with a drâmbă wobble tail | 400 ms |
| `table.ask` | `REQUEST_MADE` | all | plank B gliding from the asker's pitch to the target's — a wooden *"hm?"* — panned along the arrow-chip's flight | 200 ms |
| `table.asked` | the answer window opens, on the target | you | two knocks on your own chip: *knock-knock* | 240 ms |
| `table.answer` | the target presses any answer | local | plank B, firm — **identical for truth and lie** | 80 ms |
| `table.flight` | cards in flight | all | paper flutter and air, one per batch, as long as the flight | 260–460 ms |
| `table.give` | `REQUEST_SUCCEEDED` | all | a paper slide that lengthens with the count, then a stack thud on plank A, lower per card; panned target → asker | 250–450 ms |
| `table.gofish` | `REQUEST_FAILED`, pool > 0 | all | the plop — one large bubble with an upward chirp, two to four small ones, a short splash — the punctuation after a human *"Pescuiește!"* | 350 ms |
| `table.gofish.dry` | `REQUEST_FAILED`, pool empty | all | two dull knocks as the chip hits the dry basin floor, a decelerating skid of small ticks, a puff of dust | 400 ms |
| `table.draw` | `DREW_FROM_POOL` | all | a wet paper lift — drip and paper; wetness follows the water axis; panned pool → player | 140 ms |
| `table.refill` | `HAND_REFILLED` | all | `table.draw` × count, 90 ms apart, a step up each | ≤ 360 ms |
| `table.poolEmpty` | the last card leaves the pool | all | a drain gurgle into the hollow ring of the empty basin (plank A, long) | 1.2 s |
| `table.lay` | `SET_LAID`, normal or eggs | all | three descending knocks (C, B, A), an ink stamp, a chisel scrape as the score pip is gouged | 500 ms |
| `table.lay.power` | `SET_LAID`, power set | all | `table.lay` with a low dobă under the last knock — the same for all nine ranks | 550 ms |
| `table.tally` | game over, each score pip | all | plank D, rising a step per pip | 90 ms each |

**Ceremony**

| Cue | Trigger | Heard by | Material and recipe | Length |
|---|---|---|---|---|
| `mus.start` | `GAME_STARTED` | all | the tulnic calls the table — two long, rising notes — and the gate creaks open | 2.6 s |
| `mus.end.win` | `GAME_ENDED`, you won | you | fluier over dobă, a rising cadence | 3 s |
| `mus.end.tie` | `GAME_ENDED`, you share the win | you | two fluiers in parallel thirds — two equal totems, in sound | 3 s |
| `mus.end.lose` | `GAME_ENDED`, you did not win | you | caval, a gentle falling cadence — dignified, never a "fail" sting | 2.5 s |

**The clock**

| Cue | Trigger | Heard by | Material and recipe | Length |
|---|---|---|---|---|
| `clock.open` | the answer window opens | all | a plank C pickup (short–long) and a soft breath; folded into `table.ask`'s landing whenever the two coincide, which is almost always | 350 ms |
| `clock.tick` | each second from *T* down to 3 s | all | plank D | 30 ms |
| `clock.tick.urgent` | every 500 ms in the last 3 s | all | plank D and C alternating — urgency from density and brightness, never from level | 30 ms |
| `clock.close` | the answer window closes (view) | all | one resolving plank B knock | 120 ms |
| `clock.eligible` | a window opens where you are eligible | private | a two-note rising fluier | 400 ms |

**Powers**

| Cue | Trigger | Heard by | Material and recipe | Length |
|---|---|---|---|---|
| `power.granted` | `POWER_GRANTED` whose rank is not public | all | a țambal shimmer (three detuned courses) over a low swell — the same for all nine | 900 ms |
| `power.granted.<rank>` | `POWER_GRANTED`, Mode Deschis | all | the rank's motif, soft (§3.8) | ≤ 1 s |
| `power.granted.mine` | your own grant, Mode Ascuns | private | your rank's motif | ≤ 1 s |
| `power.used.<rank>` | `POWER_USED` | all | the rank's motif, under the effect cue that follows | ≤ 1.2 s |
| `power.reveal` | a face-down set flips on first use | all | three wooden clacks on the flip frames, then an ink stamp | 400 ms |
| `power.shark` | `SHARK_JUMP` | all | a dobă hit; a fast water rush (noise, low-pass swept 400 Hz → 4 kHz); a jaw snap (two plank C hits 30 ms apart) | 600 ms |
| `power.lanternfish` | `LANTERNFISH_REFLECT` | all | a high țambal glint, then the ask knock played backwards | 500 ms |
| `power.tortoise` | `TORTOISE_BLOCK` | all | the shell clamps — hollow plank A, then plank B 60 ms later — and the cards slap back | 450 ms |
| `power.jellyfish` | `JELLYFISH_STUN` | all | drâmbă through a sweeping formant, then the bell stamp | 700 ms |
| `power.stickleback` | `STICKLEBACK_STEAL` | all | a barbed scrape (noise, band-pass swept 1 → 5 kHz), a paper whip, an abrupt cut | 280 ms |
| `power.stickleback.miss` | `STICKLEBACK_WASTED` | all | the same scrape, shorter and hollow, catching no paper | 180 ms |
| `power.mantis` | `SET_DESTROYED` | all | the club — plank A struck hard with a noise crack — then four to six plank D splinters, 20–60 ms apart | 700 ms |
| `power.whale` | `WHALE_SHUFFLE` | all | a low tulnic swell, a riffle (≈ 40 paper grains over 900 ms), the redeal | 1.4 s |
| `power.clownfish.bound` | `CLOWNFISH_BOUND` | private in Ascuns; all in Deschis | a peg clicking into a slot, then the copied motif on drâmbă, *pp* | 600 ms |
| — | **Squid, in any form** | nobody | **silence** | — |

**World and meta**

| Cue | Trigger | Heard by | Material and recipe | Length |
|---|---|---|---|---|
| `amb.water` | the water axis (§3.9) | all | lapping, then shallow, then dry wind in the basin — a live bed | continuous |
| `amb.life` | the progress axis | all | fish jumps, reeds, distant birds; density falls with the cards in play | one-shots |
| `amb.lastlight` | ≤ 12 cards in play | all | a low dobă pulse every 6 s and a short room tail on the clock | continuous |
| `amb.lobby` | lobby and waiting room | local | the full pond, louder | continuous |
| `meta.join` | a player joins | all | a knock on the new post in that seat's pitch — the room tunes up | 150 ms |
| `meta.leave` | a player leaves or drops | all | the same knock, damped, a step down | 150 ms |
| `meta.reconnected` | you rejoin after a drop | you | a soft ink stamp as the table re-inks | 200 ms |
| `meta.nudge` | your turn has been idle 15 s | you | one soft `table.turn.you` knock | 180 ms |

## Appendix D — The cue sheet

Levels are dB relative to the cue's bus, after class normalisation (§3.3).
**Prio** runs from 0 (lowest) to 5. **Var:** *live* means continuous seeded
variation. **Short** is the backlog variant. **Env:** *src* feeds the ambience
activity envelope; *ex* makes the ambience fade under it. Plays per game are
3p / 6p from §1.1.

| Cue | Bus | Plays (3p/6p) | Level | Prio | Inst. | Cooldown | Var. | Short | Env |
|---|---|---|---|---|---|---|---|---|---|
| `ui.press` | UI | per input | 0 | 1 | 2 | 40 ms | live | same | — |
| `ui.press.soft` | UI | per input | −4 | 1 | 2 | 40 ms | live | same | — |
| `ui.select` | UI | ~80 / 100 | −2 | 1 | 2 | 60 ms | live | same | — |
| `ui.drop` | UI | per input | −4 | 1 | 1 | 60 ms | live | same | — |
| `ui.target` | UI | ~80 / 100 | −2 | 1 | 1 | 80 ms | live (seat pitch) | same | — |
| `ui.error` | UI | rare | 0 | 2 | 1 | 250 ms | 3 | same | — |
| `ui.toggle` / `ui.copy` | UI | rare | −3 | 1 | 1 | 100 ms | 2 | same | — |
| `clock.eligible` (private) | UI | per window | 0 | 4 | 1 | — | 1 | — | — |
| `table.turn` | Table | 79 / 102 | −6 | 2 | 1 | 150 ms | live (seat pitch) | same | src |
| `table.turn.you` | Table | ~26 / 17 | −2 | 3 | 1 | 300 ms | 3 | knock | src |
| `table.bonus` | Table | 21 / 22 | −4 | 2 | 1 | 200 ms | 4 | one knock | src |
| `table.skipped` | Table | ≤ 1 | −4 | 2 | 1 | — | 2 | muffled knock | src |
| `table.ask` | Table | 78 / 97 | −4 | 2 | 1 | 150 ms | live (pitch glide) | knock | src |
| `table.asked` | Table | ~26 / 16 | −2 | 3 | 1 | — | 3 | one knock | — |
| `table.answer` | UI | ~26 / 16 | −4 | 2 | 1 | 200 ms | live | same | — |
| `table.flight` | Table | 21 / 22 | −10 | 1 | 2 | 100 ms | live | dropped | — |
| `table.give` | Table | 21 / 22 | −2 | 3 | 1 | — | live (count-scaled) | thud | src |
| `table.gofish` | Table | 44 / 24 | 0 | 3 | 1 | — | live (bubble model) | plop | src |
| `table.gofish.dry` | Table | 12 / 50 | −2 | 3 | 1 | — | live | knock | src |
| `table.draw` | Table | 45 / 24 | −6 | 2 | 3 | 60 ms | live | drip | src |
| `table.poolEmpty` | Table | 1 | +2 | 4 | 1 | — | 1 | gurgle | src |
| `table.lay` | Table | ~7 / 6 | 0 | 3 | 1 | — | 4 | stamp | src |
| `table.lay.power` | Table | ~8 / 6 | 0 | 3 | 1 | — | 3 | stamp and drum | src |
| `table.tally` | Table | per pip | −6 | 2 | 2 | 60 ms | live | same | — |
| `clock.open` (answer) | Clock | 78 / 96 | 0 | 5 | 1 | — | 3 | pickup | — |
| `clock.tick` | Clock | set by *T* | −2 | 5 | 1 | 900 ms | live | same | — |
| `clock.tick.urgent` | Clock | set by *T* | 0 | 5 | 1 | 400 ms | live | same | — |
| `clock.close` (answer) | Clock | 78 / 96 | −2 | 5 | 1 | — | 3 | same | — |
| `power.granted` | Power | 7 / 5 | −2 | 4 | 1 | — | 3 | attack (250 ms) | src |
| `power.granted.<rank>` (Deschis) | Power | 7 / 5 | −4 | 4 | 1 | — | 1 each | 2 notes | src |
| `power.used.<rank>` | Power | 5 / 4 | 0 | 4 | 1 | — | 1–2 each | 2 notes | src |
| `power.reveal` | Power | ≤ 5 | 0 | 4 | 1 | — | 2 | clacks | src |
| `power.shark` | Power | 0.8 / 0.6 | +2 | 4 | 1 | — | 2 | hit and snap | src |
| `power.lanternfish` | Power | 0.9 / 0.6 | 0 | 4 | 1 | — | 2 | glint | src |
| `power.tortoise` | Power | 0.6 / 0.3 | 0 | 4 | 1 | — | 2 | clamp | src |
| `power.jellyfish` | Power | 0.9 / 0.5 | 0 | 4 | 1 | — | 2 | bell stamp | src |
| `power.stickleback` / `.miss` | Power | 0.9 / 0.6 | 0 / −2 | 4 | 1 | — | 2 / 1 | scrape | src |
| `power.mantis` | Power | 0.7 / 0.5 | +2 | 4 | 1 | — | 2 | strike | src |
| `power.whale` | Power | 0.8 / 0.6 | +1 | 4 | 1 | — | 1 | swell head (400 ms) | src |
| `power.clownfish.bound` | Power | 0.8 / 0.6 | −4 | 3 | 1 | — | 1 | peg | — |
| `mus.start` (tulnic) | Music | 1 | 0 | 5 | 1 | — | 1 | — | ex |
| `mus.end.win` / `.tie` / `.lose` | Music | 1 | 0 | 5 | 1 | — | 1 each | — | ex |
| `meta.join` / `.leave` / `.reconnected` / `.nudge` | Table / UI | rare | −4 | 2 | 1 | 200 ms | live (seat pitch) | same | — |
| ambience beds and life | Ambience | continuous | −26 bus | 0 | 3 | — | live | — | target |
| **Squid** | — | — | — | — | — | — | — | — | — |

## Appendix E — Revision history

- **v1** (`55b451f`) — first plan.
- **v2** — revised after the first review, which scored v1 6.9/10:
  - *New findings:* the Squid event shape (A2), confirmed and added as an S0
    finding; the window-existence tells (A6).
  - *Corrections:* the seed finding (A3 — the shuffle is not in the bundle; the
    32-bit seed is brute-forceable); the §0 overstatements; A11's "12 s clock"
    claim; the unverified claims about answer times, dB under voice and
    desk-safe haptics.
  - *New sections and rules:* a precise guarantee, view-driven closes and paired
    fixtures (§3.2, §6.5–6.6); the world arc re-based on cards in play, with a
    designed dry go-fish (measured by `arc.ts`); loudness per output profile and
    class normalisation; frequency-scaled variation (`eventfreq.ts`) and the cue
    sheet (Appendices C and D); the call as part of the mix (§3.4); live synthesis and
    live ambience (the budgets close); the slow activity envelope instead of
    ducking; seat voices; material rather than liturgy.
  - *Proof and gates:* the thumb-zone ask sheet; mocks rendered from real art and
    fit-tested at real browser heights; pooled, count-based gates; the redefined
    blindfold test.
  - *Production:* M0 re-scoped and re-estimated; the calendar claim dropped.
