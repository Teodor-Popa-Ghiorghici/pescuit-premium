# Pescuiește Extins — Feel, Visual & Sound Plan

*A plan to take the client from "a woodcut skin over a working engine" to a table
that feels, looks and — above all — sounds like one place. It rests on five kinds
of evidence, all in `docs/plan-evidence/` with the scripts that produced them:*

- *an audit of the shipped code (commit `05b3ae3`);*
- *a live 3- and 6-player session on desktop and phone;*
- *~5,000 seeded bot games, played by random bots and by bots that remember
  what the table reveals;*
- *layout mocks rendered from the game's own card art and fit-tested at real
  browser heights;*
- *an audio prototype that renders the plan's recipes through Chromium's Web
  Audio engine, measures them, and fails when a rule of §3 is broken.*

*Where this plan disagrees with `DESIGN.md`, §12 lists the amendment and the
reason. Revision history: Appendix E.*

---

## 0. The one-page version

Pescuiește Extins is **a bluffing game played by 3–6 friends over voice chat,
often on phones.** Four laws follow from that sentence:

1. **What leaves a device is public, and presentation never adds information.**
   Every speaker feeds a live microphone, and every animation can be seen on a
   stream. Sight, sound and haptics may only restate what the public record
   already says. (§3.2, §6)
2. **The table talks; the game whispers.** The best sound in this game is a
   friend saying *"Pescuiește!"*. The mix sits under speech and treats the voice
   call — which re-broadcasts every speaker — as part of the mix. (§3.3–3.4)
3. **Every ask is a four-beat drama** — ask, hold, answer, consequence — and cause
   visibly travels to effect. Frequent beats are short; rare beats are big.
   (§4)
4. **One glance, one thumb.** On a real phone browser (360×640, 390×664,
   375×548) the whole game is on one screen, and every timed action sits under
   the thumb. (§5.2)

**Where we are.** The woodcut foundation is real: tokens, two verified faces,
nineteen carvings, seals, the stamp, the travelling totem. But the audit (§1)
found:

- the game's central secret printed in every player's log;
- a Squid lie that can be told from an honest answer by the *shape* of the
  events every client receives;
- a deal whose seed is sent to everyone and could be brute-forced even if it
  weren't.

The sound layer is four synthesised cues wired straight to the speakers. Two of
them are tells over an open mic, and every event-driven cue falls silent for the
last 40–50 % of the game. No card ever moves between players. At six players on
a phone, your hand starts 479 px below the fold. And 98 % of well-played games
end with a run of asks that can no longer change the score: a median of 6 at
three players, 12 at six.

### 0.1 The twelve moves, ranked by impact ÷ cost

| # | Move | Why | Cost | When |
|---|---|---|---|---|
| 1 | Redact events per viewer; one event shape for every answer; a server-side CSPRNG deal with UUID card ids | Mode Ascuns is broken for everyone; a lie is detectable; the deal is recoverable | M | M0 |
| 2 | Law 1 in code: audio is a function of the public record, with the tells of the rules themselves never voiced | Voice chat carries every speaker to every player | S | M0 |
| 3 | One-screen phone table with a thumb-zone ask sheet (mocked, asserted, §5.2) | Today you scroll to act | M | M2 |
| 4 | Presentation timeline keyed on a server `seq`, driven by view diffs | Fixes the silent late game; carries all choreography | M | M1 |
| 5 | Card flights and the four-beat ask with wet and dry outcomes | The core verb has no cause → effect | M | M2 |
| 6 | Audio engine: the prototype-verified chain, loudness per output profile, live synthesis for frequent cues | The current design cannot be mixed, levelled or scaled | M | M1 |
| 7 | End the game the moment the score is final; the closing gate as the public countdown | Every well-played game ends in 6–12 dead asks | S | M3 |
| 8 | Server-authoritative window clock | The one place audio carries information is guessed | S | M0/M2 |
| 9 | Sorted, grouped hand with corner indices (mocked, §5.3) | The hand is unsorted and clipped | M | M2 |
| 10 | Nine power motifs and four signature moments | Powers fire about once a game each; they should land like events | L | M3 |
| 11 | The world arc: the pool drives act 1, the gate drives act 2 | A diegetic clock that is true at every player count | M | M4 |
| 12 | Texture and ink pass | DESIGN §1 rule 4 ("nothing is clean") is unbuilt | M | M4 |

### 0.2 Done means

- **Presentation adds no information.**
  - For any two histories with the same public record, every client's visuals,
    audio, haptics and timings are identical. The owner's private visuals are
    excepted, and private audio is heard only in headphones mode.
  - Public records that differ only in the tells the rules themselves create
    produce identical audio, up to the pause those windows add.
  - Both are proven by property tests (§6.5); what remains is listed in §6.6.
- **Loudness per output profile**, measured from seat 0's client over a
  human-paced five-player scene: *speaker* −18 ± 2 LUFS, *headphones*
  −23 ± 2 LUFS, true peak ≤ −1 dBTP, including the worst six-cue pile-up. The
  prototype already meets this with the chain in §3.3: −18.0 LUFS at −3.5 dBTP,
  and −23.0 LUFS at −1.8 dBTP.
- **The audio rules are checked, not asserted.** The prototype's harness fails on
  a seat-plank violation (§3.1), an echo-budget miss measured without any safety
  fade (§3.4), or a loudness, true-peak or clipping miss. All pass today; the
  same harness gates the product from M1 (§7.4).
- **One screen** at 360×640, 390×664 and 375×548 in every state, and on desktop
  at 1280×800 and 1024×768, with no page scroll. The mocks pass the asserted
  check (§7.4); the product must too.
- **Answer to rest: 0.8 s by design, ≤ 0.9 s p95 measured.** **Answer to the next
  possible input: 0.3 s by design, ≤ 0.35 s p95.** The overlaps are in §4.1; the
  margin absorbs delivery jitter and frame timing.
- **Input to visible response ≤ 50 ms p95** on a mid-range Android; **≥ 55 fps**
  during a six-player whale shuffle.
- **No dead ending.** Under rule §11.2 a decided game ends on the lay that decides
  it. With memory bots that covers 98–99 % of games; the rest still have a set
  possible in principle and end on the 2N rule, as today.
- **Playtests**, reported per round and pooled (n = 15, as counts): 0 whose-turn
  confusions in round 3; 0 private-information reports; ≤ 2 of 15 muted by the
  end (§9.2).

**Effort:** 50–64 engineering days (≈ 10–13 weeks for one engineer). Audio
production (≈ 6 days) and art (≈ 7 days) run beside the engineering path and do
not shorten it. A four-week cut (§8.3) ships the secrecy fixes, the phone table
and the core loop's feel.

---

## 1. Audit — what is there, what is broken

**S0** breaks the game's promise (secrecy or integrity) · **S1** breaks feel ·
**S2** degrades polish. Every finding was reproduced; references are to `05b3ae3`.

### S0 — the promise

| # | Finding | Evidence | Fix |
|---|---|---|---|
| A1 | **Every client receives the same unredacted events.** `view` is redacted per player; `events` is not. In Mode Ascuns every player's log reads *"Ana lays down a set of Squid"* and *"Ana gains the Squid power"*. | `server/room.ts:127-134`; `EventLog.tsx:65-72`; `i18n.ts:102,104` | M0 |
| A2 | **A Squid lie has a different event shape.** `handleDeclareSquid` nulls `pendingWindow` itself, so `afterResponsePending` never emits `WINDOW_CLOSED`. An honest "no" emits `WINDOW_CLOSED(RESPONSE_PENDING) › REQUEST_FAILED › DREW_FROM_POOL › TURN_STARTED`; a Squid deny or claim emits the same minus the first event. DECISIONS.md's "every response now takes the same shape" is false at the event level. | `engine.ts:405-412`; `squid-events.ts` | M0 |
| A3 | **The deal can be recovered.** `GAME_STARTED` sends the RNG seed to every client. Withholding it is not enough: the seed is 32 bits, so a player can brute-force it from their own seven cards. Any PRNG whose outputs reach the wire (card ids, for one) leaks its state. | `engine.ts:153`; `room.ts:87`; `rng.ts` | M0 |
| A4 | **Card ids encode rank** (`c12_squid`), and `DREW_FROM_POOL.cardId` goes to everyone. | `deck.ts:9-14`; `engine.ts:597` | M0 |
| A5 | **`WINDOW_OPENED` carries `eligiblePlayerIds` and the raw `SET_COMPLETED` context**, although `redact.ts` scrubs the same data from the view. | `engine.ts:300,803`; `redact.ts:61-75` | M0 |
| A6 | **A window's existence tells the table what someone holds.** Every window except the answer window opens only if someone can act in it: `TURN_START` (an active power), `REQUEST_DECLARED` (Lanternfish), `TRANSFER_PENDING` (Tortoise), `SET_COMPLETED` (Mantis), `TURN_END` (Shark). The view shows these windows to everyone. It is a rules matter (§11.1). | `engine.ts:265,340,452,532,803` | rules |
| A7 | **Audio tell #1.** The window chime plays only on *eligible* clients. | `InterruptPrompt.tsx:49-51` | M0 |
| A8 | **Audio tell #2.** The honest answer plays `stamp`; the Squid lie plays nothing. The answer buttons also differ in size and weight, which slows the liar's hand. | `InterruptPrompt.tsx:162-186`; `styles.css:132-145` | M0 |
| A9 | **Any client can close any window.** `SKIP_WINDOW` carries no player, the server forwards actions verbatim, and every `playerId` is client-asserted. | `engine.ts:709-735`; `server/index.ts:117-119` | M0 |

### S1 — feel

| # | Finding | Evidence | Fix |
|---|---|---|---|
| A10 | **The late game goes quiet.** The store keeps the last 300 events, and `useEventBeats` diffs by array *length*. In 99 % of 800 bot games the cap is reached at a median turn of 47–49 (of 80–102). From then on every event-driven cue stops; only the totem knock, the eligibility chime and local presses remain. | `store.tsx:8,100`; `beats.ts:58-65`; `eventcount.ts` | M0 |
| A11 | **On a phone, your turn starts with a scroll.** At 390×844: three players, the hand starts at y≈715, then ≈1110 once the log fills; six players, your first card is at y=1323. Asks are untimed, and the timed plank is fixed to the bottom. So the cost is not a missed deadline but a hunt for your own cards at the start of every turn. | `table-phone-3p-fullpage.png`; `six.cjs` | M2 |
| A12 | **Every event yanks the page.** The log's `scrollIntoView` scrolls the document. | `EventLog.tsx:135-137`; `table-phone-6p-log-yank.png` | M0 |
| A13 | **Nothing travels.** The totem is the only moving object. | README, "Known scope limitations" | M2/M3 |
| A14 | **The window clock is a guess.** It is timed from when the state is *received*, and the server's deadline is never sent. | `InterruptPrompt.tsx:35-46`; `room.ts:110-125` | M0 |
| A15 | **A dropped socket freezes the player.** `rejoin` is sent only on mount. | `net/client.ts:43-48`; `store.tsx:64-78` | M0 |
| A16 | **The sound engine cannot be mixed.** Four cues (three noise-and-body hits and a two-oscillator chime) go straight to `destination`: no master, limiter, volume, ducking, voice cap, variation or pan. | `sound.ts:11,39-107` | M1 |
| A17 | **The hand is unsorted and clipped**, and a ten-card hand overflows the page at 1280 px. | `table-desktop-midgame-overflow.png`; `styles.css:792,874-881` | M0/M2 |
| A18 | **Almost every well-played game ends with dead asks.** No game ends by laying every card. Each egg substituted into a set orphans one real card, so skilled play strands ~6 cards that can never form a set. The game then runs on until 2N consecutive asks capture and draw nothing. In 98–99 % of memory-bot games the score is final before the end, and a median 6 (3 players) to 12 (6 players) asks follow — a minute or two of dead play, unsignalled. | `engine.ts:606-611`; `ending.ts` | M3 (§11.2) |
| A19 | Declaring Jellyfish, Stickleback or Whale needs native `<select>`s under the clock. | `InterruptPrompt.tsx:326-393` | M3 |
| A20 | Haptics are `vibrate(10 or 24)` behind the sound toggle; iOS Safari has none. | `sound.ts:110-117` | M2 |

### S2 — polish

| # | Finding | Evidence |
|---|---|---|
| A21 | The "grain" is pinstripes; every edge is vector-perfect (DESIGN §3 unbuilt). | `tokens.css:107-108` |
| A22 | The sixth post stretches into a full-width plank. | `styles.css:589`; `table-desktop-6p.png` |
| A23 | *"You may lie with Squid"* is shown to every asked player. | `i18n.ts:81,188` |
| A24 | `maximum-scale=1` disables pinch-zoom (WCAG 1.4.4). | `index.html:5` |
| A25 | The log is an empty 300×340 block for the first minute; the hint appears twice. | `table-desktop-3p.png` |
| A26 | Vollkorn's lining "1" reads as a Roman "I", so the pool count 11 reads "II". | `styles.css:560-567` (`.pool__count`); caught in the first mocks |
| A27 | The 700 ms resolution beat of DESIGN §9.4 does not exist (§12 replaces it). | `beats.ts:73` |

**Keep:** the palette and tokens; the two faces with verified comma-below
diacritics; the nineteen carvings and seals; category by shape; notched geometry;
the totem and its FLIP; the stamp; the reduced-motion discipline; the plank and
frame for windows.

### 1.1 What the game actually does — the numbers this plan is sized on

Two bot populations bracket human play:

- **Random** — the engine's own bots.
- **Memory** — bots that remember what every public event reveals and ask where
  they know a match exists (`membot.ts`).

Each figure below comes from 300 games per cell (`eventfreq.ts`, `ending.ts`).

| Per game | 3 p random | 3 p memory | 6 p random | 6 p memory |
|---|---|---|---|---|
| Turns | 80 | 78 | 99 | 86 |
| Asks (each opens an answer window) | 79 | 76 | 95 | 74 |
| Successful asks | 22 | 23 | 22 | 29 |
| Go fish, pool wet | 45 | 45 | 24 | 26 |
| Go fish, pool dry | 11 | 7 | 48 | 17 |
| Draws from the pool | 45 | 44 | 24 | 23 |
| Sets laid (power / other) | 8 / 7 | 9 / 8 | 6 / 6 | 9 / 8 |
| Powers used, all nine together | 5.5 | 6.3 | 3.7 | 6.0 |
| Any *one* power's effect | 0.3–1.0 | ≈ 1 | 0.1–0.6 | 0.8–0.9 |
| Pool runs dry at (share of turns, median) | 80 % | 85 % | 34 % | 54 % |
| Games ending with every real card laid | 0 % | 0 % | 0 % | 0 % |
| Real cards stranded at the end (median) | 9 | 6 | 22 | 6 |
| Games whose score is final before they end | 40 % | 98 % | 10 % | 98 % |
| Asks played after the score was final (median, p90) | 0, 6 | 6, 9 | 0, 12 | 12, 17 |

Five consequences run through the plan:

1. **The ask, the turn and the answer window come 74–99 times a game.** They must
   be short, quiet and endlessly varied (§3.7).
2. **Each power fires about once a game or less.** Power moments can be big and
   ceremonial; nobody learns nine motifs from play alone (§3.8).
3. **The dry go-fish is common but not dominant** — 13 % of go-fish with skilled
   play at three players, up to 68 % with random play at six. It needs its own
   design, and a neutral one (§4.1).
4. **Games end by deadlock, not exhaustion.** Skilled play ends 98 % of games
   with stranded cards and a run of asks that cannot change the score. The end
   needs a rule (§11.2) and a public countdown (§3.9); the old "cards in play →
   0" clock is false.
5. **Two acts.** The pool is a true clock while it lasts; after it runs dry, the
   public no-progress count is the only honest measure of how close the end is.

---

## 2. Pillars

| Pillar | Test a change must pass |
|---|---|
| **P1 Carved, printed, pressed.** Every sight and sound has a physical source in a world of wood, paper, ink and water. | Can you name the object that made this mark or this sound? |
| **P2 The table talks; the game whispers.** | Does this sound compete with a sentence spoken over it — or, repeated by four other speakers 200 ms late, turn to mush? |
| **P3 Presentation never adds information.** | If a microphone or a camera caught this, would it tell anyone more than the public record does? |
| **P4 Every ask is a drama.** | Screen off: can a listener tell whose turn it is and what kind of thing happened (ask, give, go fish, lay, power, stun)? Sound off: can a watcher tell who asked whom, for what, and what happened? |
| **P5 One glance, one thumb.** | On a real phone browser: whose turn, can I act, how close is the end — each in one second — and is every timed action under the thumb? |

**The session has two acts, and the arc follows them.**

- **Act 1, fishing.** The pool is the clock: a public count that only falls. It
  drives the water and the light, from dusk to evening as the pool drains.
- **Act 2, the dry pond.** It begins the moment the pool empties: at 80–85 % of
  a three-player game, and at 34–54 % of a six-player one. Night falls. From
  here the only honest measure of the end is the public **no-progress count**:
  consecutive asks that capture and draw nothing, which ends the game at 2N. It
  is drawn as a **closing gate** (§3.9). A capture or a lay swings the gate back
  open.
- **Ceremony.** Under the rule proposed in §11.2, the game ends the moment the
  score can no longer change, so the last possible set *is* the finale.

**References — what to take from each.** *Inscryption:* a table that creaks and
cards with weight. *Pentiment:* an entire UI in the language of print.
*Balatro:* the count-up and stacked juice on flat 2-D cards. *Hearthstone:* a
board that answers every impact. *Return of the Obra Dinn:* two-value art kept
legible. *Jackbox:* short, voice-safe cues for a group on a call.

---

## 3. Sound design

### 3.1 Identity: wood by a pond

**Struck wood** — planks and mallets, the material of the *toacă* — is the voice of
the table. **The pond** (*balta*) is the voice of the world. **The shepherd's
flutes** are the voices of the powers. Paper, ink and one drum fill in the rest.

We borrow the toacă's **material, not its liturgy.** No monastery rhythm appears
anywhere, and the game-start call goes to the **tulnic**, the long horn Apuseni
shepherds use to call across valleys. A Romanian folk-music consultant reviews
the palette and the motifs before recording (§11.8).

**The grammar.** A sound's material tells you its *category* before anything
else:

| Material | Source | Means | Used by |
|---|---|---|---|
| **Wood, ringing** — planks A 180 Hz, B 320 Hz, C 620 Hz | the seats | "who" | seat signatures only: turn, ask, target, join, skipped |
| **Wood, small** — plank D, 1.2 kHz | the rules' clock and your own hand | "the table acknowledges" | ticks, presses, bonus, asked, answer, reveal, snaps and splinters |
| **The table top** — an unpitched thud | things landing | "it landed" | the close, give, lay, dry go fish, error, mantis, tortoise |
| **Paper** | the printed cards | "cards moved" | give, draw, steal, shuffle, flight |
| **Ink** | the stamp | "it is recorded" | answer, lay, score |
| **Water** | the pond | "the pool" | go fish, draw, ambience |
| **Breath** — fluier, caval, tulnic | the powers, the call to the table | "a power spoke" | the nine motifs, start, end |
| **Strings** — țambal | magic resolving | "something changed you can't see" | power granted, clownfish binding |
| **Skin** — dobă | weight | "this hurts" | shark, the power-set lay, the last act |
| **Silence** | — | "a secret" | Squid |

All wood shares the mode ratios of a free-free bar (1 : 2.756 : 5.404 : 8.933),
so it reads as one material at four sizes.

**A ringing A, B or C knock always means a seat.** No other cue may strike one:
the clock and the interface use plank D, and things that land use the table top,
which has no modal ring. The prototype's harness fails if any other cue strikes
A, B or C (`audio/metrics.md`). This keeps the one identity channel clean. Moving
identity onto plank size made the rule necessary: the answer window's close, a
single plank-B knock since v2, would otherwise have been seat B1's signature after
every answer.

**Seat signatures.** Each seat owns a knock, made from a plank size (A low, B
middle, C high) and a knock count (one or two). That gives six signatures, built
from categories any listener can tell apart. There is no absolute pitch to
learn, no octave pair to confuse, and no knock that glides.

- **Turn:** the new player's signature.
- **Ask:** the arrow-chip's short paper flick, then the *target's* signature as
  it lands. The asker is already known from the turn.
- **Waiting room:** each player's signature as they join.

Listen: `audio/wav/seat-signatures.wav`. Whether signatures really carry "who"
by ear is a claim for the M2 blindfold test (§9.3). If listeners score below 8 of
10 on seat, the fallback keeps signatures on the turn knock only, and the ask
lands on a neutral knock.

### 3.2 Law 1 — presentation never adds information

**The public record** is what a spectator holding no cards would receive: the
redacted view sequence and the redacted event stream (§6.1), both ordered by
`seq`.

**The guarantee.** Every client's sound — and every vibration strong enough to
hear on a desk — is a function of only:

- (a) the public record, with the rules' own tells erased (below);
- (b) public facts about the viewer's own seat (your turn, you were asked); and
- (c) the viewer's inputs whose *possibility* was already public when made.

Everything else is **private tier**: silent by default, audible only in
headphones mode. Visuals may draw on the viewer's private view (their hand,
their grants), but their durations and timings follow the public record.

**The rules' own tells are never voiced.** Five windows reveal holdings by
existing (A6). Audio behaves as if they were not there:

- They get no open cue, no ticks and no close cue.
- **The answer window's close fires when `RESPONSE_PENDING` leaves the view,
  whatever replaces it.** That may be nothing, the next player's `TURN_START`,
  a `TURN_END` or a `TRANSFER_PENDING`. It fires at the same offset from the
  answer every time.
- The pause such a window adds is the one thing sound cannot hide. It is a
  rules-level tell (§6.6).

| Input or signal | Public? | Sound by default |
|---|---|---|
| Ask, on your turn | yes | yes |
| Lay a set | yes | yes |
| Answer when asked | yes — the target was named aloud | yes: **one cue for every answer, Squid included** |
| The answer window closes | yes — it opens on every ask | yes: **`clock.close` on every client**; its opening is the ask's landing |
| Any other window opens or closes | its existence reveals holdings | **never** |
| Declare or decline in a reactive window | no | no; visual and private haptic only |
| "You are eligible" | no | headphones mode only |
| Your own power granted, Mode Ascuns | the grant is public, its rank is not | the uniform "power granted" cue only |
| Clownfish binding, Mode Ascuns | no | headphones mode only |
| Squid | never | never, in any mode |
| Hover | — | never |

**Headphones mode** (*Căști*) unlocks the private tier, shows a headphone glyph
in the top bar while it is on, and asks once per game, *"Still on headphones?"*
The private tier only ever voices the viewer's own secrets, so leaving it on over
speakers leaks the forgetful player's hand and no one else's.

**Haptics are only semi-private.** A phone buzzing on a desk is audible to a
laptop microphone, and an ERM motor may not spin up in 10 ms. The private pattern
is set per motor class by the desk test (§9.3); until then private haptics are
opt-in.

**Tonal material is reserved for public events.** Voice-chat noise suppressors
pass harmonic content and strip broadband noise, so a flute note is likelier
than a knock to reach the other players. We test this (§9.3) and design as if it
were true.

**Squid, sharpened.** Every answer — hand over, *"Pescuiește!"*, lie — has the same
local cue, haptic and plank animation. The two answer buttons are the same size
and weight (`mock-phone-answer-390x664.png`).

### 3.3 Law 2 — the voice-first mix, and a chain that is proven

**Loudness is set per output profile**, following ASWG-R001 (−24 LUFS home,
−18 LUFS portable):

| Profile | When | Integrated | True peak | Differences |
|---|---|---|---|---|
| **Speaker** (default) | phone and laptop speakers | −18 ± 2 LUFS | ≤ −1 dBTP | high-pass 150 Hz; +2 dB at 3 kHz; the **densifier**; UI and Clock +4 dB; speaker variants (§3.4) |
| **Headphones** | chosen in settings | −23 ± 2 LUFS | ≤ −1 dBTP | high-pass 30 Hz, flat; full tails; the private tier |

**The chain.** It was built and measured in the prototype; v2's order clipped.

```
cue ─► bus ─► profile EQ ─► [speaker: densifier] ─► program gain ─► glue comp ─► limiter ─► soft clip ─► user volume ─► out
Clock bus ─► profile EQ ─► program gain ──────────────────────────────────────────►┘ (joins at the limiter)
```

- **Program gain comes before the dynamics.** It is the loudness calibration.
  **User volume comes last and only attenuates.** v2 put the calibration after
  the limiter. The prototype needed +8 dB there to reach −18 LUFS and hit
  +6.3 dBTP.
- **The densifier is speaker-only**: a gentle `tanh` stage (drive 2.2), then
  4:1 compression from −26 dB (1 ms attack, 60 ms release). Struck wood has a
  peak-to-loudness ratio of ~22 dB, so −18 LUFS at −1 dBTP is unreachable
  without it.
- **The Clock bus skips the densifier and the glue** and meets the mix only at
  the limiter, so ticks keep a steady level whatever else is sounding.
- **Glue:** −20 dB, 3:1, knee 6, attack 5 ms, release 120 ms. **Limiter:** −4 dB,
  20:1, knee 0, attack 0, release 50 ms. **Soft clip** at −1 dBFS: a safety net
  that the measurements show never engages.

**Measured** (`audio/metrics.md`). The scene is three scripted, human-paced
minutes at five players, heard from seat 0. Thinks are lognormal around 6 s
(2–15 s) and holds lognormal around 2.5 s (at most the 12 s window). It carries
every frequent cue, including seat 0's own asked and answer cues, over the live
pond bed.

| Profile | Integrated | Short-term max | True peak | Worst six-cue pile-up | Samples near the clip |
|---|---|---|---|---|---|
| Speaker | −18.0 LUFS | −16.9 LUFS | −3.5 dBTP | −3.9 dBTP | 0 |
| Headphones | −23.0 LUFS | −16.4 LUFS | −1.8 dBTP | −1.8 dBTP | 0 |

The scene plays **24 cues a minute** (19 table, 4.3 clock, 0.7 power) at 4.7 asks
a minute — about one cue every 2.5 s.

- **Normalise by loudness per class, not by peak.** Raw recipe levels span 16 dB
  (the whale motif needs −10.1 dB, the dry go-fish +5.8 dB, `metrics.md`). *Transient* assets
  (< 200 ms) are normalised by K-weighted level over their active span;
  *sustained* ones by maximum momentary loudness. Per-cue levels then live in
  one place: the cue sheet (Appendix D).
- **Transient-first.** Informative cues carry their meaning in the first 250 ms.
- **Carve the sustain.** A −6 dB bell at 2 kHz and a 7 kHz low-pass on sustained
  sources. Only ambience sustains past 1.5 s, and it stays under −32 LUFS
  short-term.
- **No pumping.** Ambience follows a slow *table activity* envelope — rising over
  1.5 s, falling over 6 s, at most −4 dB — rather than ducking per cue.
- **Small speakers.** Weight below 150 Hz gets a saturated harmonic layer at
  120–400 Hz.

### 3.4 The call is part of the mix

**The model.** At a table of N, every all-client cue plays on N devices, and
each speaker device's microphone sends its copy into the call 100–300 ms late.
Transients become a brief flam, which reads as room. Tonal tails smear, and
noise suppressors pass them.

**The echo budget.** In the speaker profile, every public cue says what it has to
say in 250 ms. Energy after 250 ms sits at least 12 dB under the first 250 ms.
The budget is met **by design, per cue** — not by a generic fade, which the
prototype showed fails on multi-hit cues. The numbers below are measured with no
fade at all. The engine keeps a 250–400 ms fade on speaker variants only as a
safety net.

| Cue | Headphones | Speaker variant | Speaker energy after 250 ms |
|---|---|---|---|
| `table.lay` | four hits over 425 ms | the same four hits in 204 ms | none |
| `table.give` | 331 ms | a 150 ms slide, then the landing at 160 ms (192 ms) | none |
| `power.granted` | a 1.4 s țambal | the strings damped by hand at 180 ms (200 ms) | none |
| motifs | full, 0.9–1.1 s | the first two notes (214–226 ms) | none |
| `power.shark` | 427 ms | the snap moved to 120 ms; the drum's decay runs on | −36 dB |
| `power.whale` | 1.34 s: tulnic, riffle, redeal | the riffle in 170 ms and one landing (236 ms) | none |
| `power.jellyfish` | 538 ms | the drâmbă cut to 150 ms, then the stamp (192 ms) | none |
| `mus.start`, `mus.end.*` | — | exempt: heard once a game | — |

**Experiment E1 — actor emphasis.** The acting client plays the full cue while
bystanders play the speaker variant. It is compared in the call test with
*everyone plays the speaker variant*. The better-rated version that keeps "what
happened" accuracy wins.

**The call rig** (§7.5): five clients on speakers in one Discord call, plus a
headset recorder, with noise suppression on and off.

### 3.5 Architecture

| Bus | Level (Table = 0 dB) | Voices | Carries |
|---|---|---|---|
| UI | −10 dB (speaker +4) | 2 | presses, selections, errors, `table.answer`, the private eligibility figure |
| Table | 0 dB | 6 | turn, ask, give, go fish, draw, lay, flight, bonus |
| Power | +1 dB | 3 | the nine, reveal, granted |
| Clock | −8 dB (speaker +4) | 2 | the answer window's ticks and close — joins at the limiter |
| Music | −2 dB | 2 | start and end ceremonies |
| Ambience | −26 dB, activity-shaped | 3 live layers | water, life, the last act |

**Two ways to make a sound.**

- **Live synthesis** for every family heard more than 15 times a game (wood, the
  table top, paper, water drops). Each hit uses 6–10 nodes and draws an exciter from one
  shared noise buffer at a random offset. That gives continuous seeded variation
  and zero buffer memory; the seed is the event's `seq`, so renders reproduce.
- **Rendered at load in plain JS** for the rare, complex families (țambal
  strings, the riffle, the motifs), at 32 kHz. It must be plain JS: a
  `DelayNode` in a feedback cycle is clamped to one 128-frame render quantum, so
  a native Karplus–Strong loop cannot sound above ~375 Hz.
- **Ambience is generated live** from a looped 2 s noise buffer, modulated
  filters and scheduled one-shots. No long loops are stored.

| Budget | Value |
|---|---|
| Rendered buffers | ≈ 30 s at 32 kHz ≈ 3.8 MB |
| Recorded tier (M4), decoded | ≤ 6.5 MB |
| Download, all audio | ≤ 220 KB |
| Render at load | ≤ 150 ms on a mid-range Android, in the waiting room |
| Live synthesis | ≤ 10 nodes a hit, ≤ 14 voices, ~24 cues a minute |

**The rest of the engine:**

- **Voices.** Global cap 14. Priority Clock > Power > Table > UI > Ambience; the
  oldest voice of the lowest priority is stolen. Per-cue caps and cooldowns are
  in Appendix D.
- **`clock.eligible`** is private, on the UI bus, and times off the plank
  appearing in the view (+120 ms). The windows it serves play no Clock cue, so
  nothing competes.
- **Seat panning** adds position on desktop stereo and headphones only; phones
  rely on signatures. There is a mono setting.
- **One clock for sight and sound.** A lookahead scheduler (25 ms interval,
  100 ms horizon) runs on `AudioContext.currentTime`. Visual impacts are delayed
  by `outputLatency` where exposed (capped at 120 ms), with a manual A/V offset
  for Bluetooth.
- **Lifecycle.**
  - Unlock on the first `pointerdown` or `keydown`; a "tap for sound" tab appears
    while suspended.
  - Suspend after 30 s hidden and resume on return; iOS `interrupted` counts as
    suspended.
  - `navigator.audioSession.type = 'ambient'` where available. The silent switch
    cannot be detected, so settings say "no sound? check the silent switch".
- **Settings** (per device): master, effects, interface, ambience, music; mute (one
  tap); output profile; mono; *softer sounds*; A/V offset.

```
packages/client/src/audio/
  context.ts   unlock, lifecycle, audioSession, outputLatency, profiles
  mixer.ts     buses, activity envelope, the §3.3 chain, settings
  voices.ts    pool, priority, stealing, cooldowns, merging
  live/        wood.ts, tabletop.ts, paper.ts, water.ts — per-hit synthesis from (params, seed)
  render/      strings.ts, riffle.ts, breath.ts — JS sample renderers → AudioBuffer
  ambience.ts  the live pond and the last act (§3.9)
  cuesheet.ts  the cue sheet as data — Appendix D is generated from it
  cues.ts      PURE: (PublicRecord, SeatFacts) → CueRequest[]   ← the leak-tested function
  clock.ts     window tick scheduler bound to the server deadline
  lab.tsx      dev-only audio lab (§7.3)
```

The prototype in `docs/plan-evidence/audio/` is the reference for `mixer.ts` and
the recipes. It runs the same chain in the same engine.

### 3.6 Production

- **Tier P — procedural, M1–M3.** As above; the recipes are in Appendix B and the
  prototype.
- **Tier R — recorded one-shots, M4.**
  - Recordings, not library sounds: four real planks with two mallets, card
    stock, water (a basin and a pond's edge), a dobă and a tulnic.
  - A fluier and caval player records the motifs and the ceremonies.
  - Budget: one Foley day, a two-hour session (≈ €300–600), two days of editing.
  - Any online source must be CC0, listed in `audio/CREDITS.md`.
- **Formats.** Opus in WebM with an AAC fallback, mono, 48 kHz, ~48–64 kbps. One
  bank per bus, not a sprite, since encoder padding drifts. ≤ 220 KB, loaded
  eagerly at game start (DESIGN §9.1). No request is ever rank-named.
- **Swap-in without code.** Recordings become the exciters of the live families,
  under the same cue ids.

### 3.7 Frequency decides variation, length and level

| Plays per game | Treatment | Cues (plays, from §1.1) |
|---|---|---|
| > 60 | **live**, continuous variation, ≤ 250 ms, the lowest levels | `table.turn` (78–99), `table.ask` (74–95), `clock.close` (73–94) |
| 15–60 | **live**, ≤ 450 ms | go fish wet (24–45) and dry (7–48), give, flight, bonus (21–29), draw (23–45), `table.asked`, `table.answer`, `ui.select` and `ui.target` (12–26), `table.turn.you` (13–27) |
| 3–15 | 3–4 takes, may run long | lays (6–9 each kind), power granted, power used (4–6), reveal |
| < 3 | 1–2 premium takes, ceremony allowed | each power's effect, pool empty, start, end |

`cuesheet.ts` holds the sheet as data, and a unit test enforces this table on
it: play band, variation mode, maximum length and bus. Appendix D is generated
from the same data.

### 3.8 The nine motifs

- **Mode.** All in D Romanian minor (Dorian ♯4: D E F G♯ A B C) — the colour of
  the doina.
- **Instrument by type.** Reactive powers speak on the **fluier** (high, bright);
  active powers on the **caval** (low, breathy); Clownfish, the mimic, on the
  **drâmbă**.

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

- **When.** Only when the rank is public (`POWER_USED`; `POWER_GRANTED` in Mode
  Deschis), or privately in headphones mode. The speaker profile plays the
  two-note variant.
- **What for.** A power fires about once a game, so in play a motif is
  *ceremony*. Players learn the motifs in the Codex (§5.8), where recognition is
  tested for distinctiveness (§9.2).
- **Listen:** `power.used.lanternfish.wav` (the palindrome is visible in
  `audio/spectrograms.png`) and `power.used.whale.wav`.

### 3.9 The world arc: two acts and a gate

| Act | Clock (public) | Sound | Sight |
|---|---|---|---|
| **1 Fishing** | the pool count | `amb.water`: lapping, thinning as the pool drains; `table.draw` gets drier; fish jumps and reeds in `amb.life` | dusk; `--apa` steps darker once at half the pool |
| **2 The dry pond** | the **no-progress count**: consecutive asks that capture and draw nothing, 0 → 2N | the water drains to dry wind (`table.poolEmpty` marks the turn); `amb.lastact`, a low dobă pulse, enters at N and quickens from 2N − 2 | night (one more flat step of `--apa`); the **gate** under the basin shuts one notch per miss (`mock-phone-dry-pond-390x664.png`) |
| **Finale** | the score becomes final | the gate shuts, or the last set is pressed; the ceremony | the podium |

- **The count is public by construction.** It is advanced by public outcomes and
  reset by public ones: a capture, a draw, a refill, a set laid, a steal, a
  shuffle, a successful shark jump or reflection. The engine already keeps it
  (`staleRequestStreak`), so it goes into the view as
  `endPressure: { misses, limit }`. Nothing is derived client-side.
- **The gate swings both ways.** A capture or a lay throws it open again, with a
  wooden creak and the pulse dropping out. The last act can breathe.
- **Under rule §11.2** the game ends the moment the score is final, so the gate
  rarely closes. The finale becomes *the last possible lay*: its stamp, one held
  beat, then the ceremony. The gate stays as the public countdown for games that
  stall before they are decided.
- **Levels.** ≤ −32 LUFS short-term, carved per Law 2, shaped by the activity
  envelope, all generated live. **Default on**, playtest-gated: if 5 or more of
  the 15 pooled players switch it off, it ships off. No music bed during play
  (DESIGN §7.1 stands).

### 3.10 The window clock

- **Server-authoritative.** `pendingWindow.deadlineAt` and `serverNow` go into
  the view. The client keeps an offset from the minimum of the last five
  `serverNow − localNow` samples, corrected by half the ping round trip.
- **The answer window.**
  - It has no open cue: the ask's landing *is* the opening, and a second sound
    there would double the most frequent moment in the game. When a structural
    window comes between, the answer window opens later in silence; the pause is
    the rules' tell (§6.6).
  - Silence follows until *T* seconds remain, then a `clock.tick` each second,
    then `clock.tick.urgent` every 500 ms in the last 3 s — the same plank struck
    with a harder mallet, so urgency is density, not pitch.
  - `clock.close` sounds when `RESPONSE_PENDING` leaves the view, whatever follows
    it (§3.2).
  - *T* starts at 5 s and is re-set from playtest 1's answer times, so that most
    answers never tick.
- **Every other window is silent** until the rules decision (§11.1). The eligible
  player sees the plank and clock and feels the private haptic.

### 3.11 Haptics

Android Chrome only; every haptic has an audio or visual twin and its own toggle.

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

- Every informative sound has a visual twin (the mute test, §9.3).
- Seat signatures give listeners *who* without panning.
- The mixer, the output profiles, mono, *softer sounds* and the A/V offset are
  all in settings.
- Screen-reader announcements never depend on sound.

---

## 4. Feel

### 4.1 The ask, beat by beat

| Beat | What happens | Time |
|---|---|---|
| **0 Intent** | Phone: tap a card group — it lifts, and the ask sheet takes the pond's row. Tap a name. Desktop: drag the group onto a post, or tap-tap. The lift answers in ≤ 50 ms; `ui.select`, then `ui.target` in the target's signature. | human |
| **1 Ask** | The arrow-chip — a carved token bearing the rank's seal — flies from asker to target on an arc and lands with `table.ask`. The target's post wobbles 2 px; the log line stamps in. | 320 ms |
| **2 Hold** | The target's plank rises with `table.asked` and the 12·60·12 haptic, its two equal buttons in the thumb zone. Everyone else sees the *"Bogdan răspunde…"* banner and a compact clock. The arrow-chip rocks gently — the only idle motion in the game. | human |
| **3 Answer** | Any answer plays `table.answer` locally. When `RESPONSE_PENDING` leaves the view, every client plays `clock.close` and the uniform 220 ms close. | 220 ms |
| **4a Yes** | At +100 ms the chip flips to its ochre face. At +120 ms backs fly target → asker (460 ms, 60 ms stagger), with `table.flight`, then `table.give` on landing. At +640 ms the totem stamps in place (`table.bonus`). | rest at ≈ 700 ms for up to three cards; +60 ms per further card |
| **4b No, water in the pool** | At +100 ms the chip dives into the pond; the plop (`table.gofish`) and a ripple at +300 ms. A card rises and flies to the asker (+300 → +620 ms, `table.draw`). The totem leaves at +300 ms and lands at +760 ms. | rest at ≈ 800 ms |
| **4c No, the pool is dry** | At +100 ms the chip drops onto the basin floor: `table.gofish.dry` (183 ms, neutral), and the gate shuts a notch. The totem leaves at +300 ms and lands at +760 ms. | rest at ≈ 800 ms |

Times in beat 4 run from the answer, which for every client but the target is the
moment `RESPONSE_PENDING` leaves the view. **Answer to rest: 0.8 s by design**,
gated at ≤ 0.9 s p95 (§9.1). **Answer to the next possible input: 0.3 s by
design**, gated at ≤ 0.35 s p95, because the next player may act as the totem
leaves. Input is never blocked. A *table speed* setting (1× or 1.5×) scales every
table-lane duration.

**The dry go-fish is neutral and brief.** It is a knock on a dry floor, with no
joke and no repeated text. The ticker says *"— Pescuiește!"* and nothing more. Its
weight comes from the gate: each miss shuts a notch, and the final misses carry
the pulse of the last act.

### 4.2 The presentation timeline (replaces `beats.ts`)

- **Sequence numbers.** The server stamps every event and view with a per-room
  `seq`. The client presents in `seq` order. A reconnect never replays
  choreography; missed lines go to the log under *"while you were away"* (A10).
- **Pure choreography.** `choreography.ts` maps the public record and seat facts
  to `Beat`s — lane, duration, lead-in, flights, VFX, cue requests, haptics, masks
  — with no side effects. With `cues.ts`, it is what the leak tests compare
  (§6.5).
- **Lanes.** `table` plays in order; `hud` and `log` play in parallel.
- **View-driven transitions.** Openings and closings, arrivals and departures are
  derived from view diffs in `seq` order. The answer window "closes" when
  `RESPONSE_PENDING` leaves the view, whatever replaces it. Events only *label*
  diffs; they never trigger or suppress an animation on their own.
- **Masking.** Logic and input read the view the instant it arrives; only pixels
  wait. An arriving card is hidden until its flight lands (≤ 800 ms), and a
  departing card is drawn as a ghost until it takes off.
- **Backlog.** More than 1.2 s queued: play at 1.5× with each cue's short variant.
  More than 2.5 s: flush to the end state and play only the last landing.
- **Uniform close.** Every window closes with the same 220 ms animation; durations
  are part of what the leak tests compare (§12).
- **Reduced motion.** Beats still play in order; travel is instant; hit-stop,
  shake and impact frames are off. Audio is unchanged.

### 4.3 The juice kit — rarer means bigger

| Class | Events (plays per game) | Allowed |
|---|---|---|
| Light | turn, ask, answer, draw, go fish, tick, press (20–99) | stamp and sound; no shake; ≤ 320 ms of table time |
| Medium | give, bonus, lay, reveal, reflect, block, steal, stun (1–29) | flights, stamp, sound; shake ≤ 1 px |
| Heavy | shark, mantis, whale, pool empty, the last lay (≈ 1) | hit-stop 60–80 ms; trauma 0.4–0.6; one impact frame; the signature cue |
| Ceremony | game start, game end (1) | up to 3 s, never blocking input |

- **Hit-stop.** Table-lane animations pause for 60–80 ms at impact; audio does not
  pause.
- **Impact frame.** For two frames the table layer swaps ink and paper. At most
  one per heavy event and never two within a second (WCAG 2.3.1); never on text;
  off under reduced motion.
- **Trauma shake.** Offset is trauma² × 6 px (4 px on phones), from summed sines,
  translation only, on the table layer only.
- **Stepped VFX, "on threes":** 3–4 hand-cut SVG frames at 12 fps. Cards fly at
  60 fps and land with the stamp.
- **Flights.** FLIP along a quadratic arc lifted 40–80 px.
  - Duration: `clamp(distance ÷ 1.8 px/ms, 260, 460)` ms.
  - Rotation: from the source tilt, through a ±6° flutter, to the destination
    tilt.
  - Elevation peaks mid-flight at `--elev-3`, then snaps to `--elev-1`.
  - 60 ms stagger; at most twelve cards in flight at once.
- **Shark interception.** The cards turn at a hard corner at 55 % of their path.

### 4.4 Input under the clock

- **Phone.**
  - Asking is tap group → tap name. While it is open the ask sheet replaces the
    pond, so it always sits between the strip and the dock. On short screens it
    uses three compact columns (`mock-phone-ask-sheet-375x548.png`).
  - Its top row reaches above the bottom 45 %. That is acceptable because asks
    are untimed.
  - Timed actions live on the plank, entirely in the bottom 45 %, on targets
    ≥ 44 px. Plank buttons are 56 px.
- **The sheet carries the facts an ask depends on.**
  - A protected target shows the shell and the protected rank's seal. When that
    rank is the one being asked for, the row warns.
  - Unused power sets appear as pips, and face-up ones as seals in Mode Deschis.
  - Stunned players are disabled. Absent players are marked *plecat* (away) and
    answered by the server after the timeout.
- **Desktop.** Drag a group onto a post (8 px threshold), or tap-tap.
- **Keyboard.** `1`–`9` pick a group, `←`/`→` cycle targets, `Enter` asks. When
  asked, `Space` answers truthfully; in a window, `D` declares and `Esc`
  declines.
- **No `<select>` under the clock.**
  - Jellyfish: tap a target.
  - Stickleback: tap a target, then one of eight seals.
  - Whale: tap a highlighted adjacent pair.
  - The rest: one button.
- **Optimistic declare** stamps and locks the plank at once. Losing a race reads
  *"Prea târziu — Cezar a fost mai rapid."*
- **Latency.** Input → visual ≤ 50 ms p95 (Event Timing API); input → audio
  ≤ 80 ms plus output latency.

### 4.5 Legibility moments

- **Your turn uses every channel:**
  - the totem lands on your dock chip;
  - `table.turn.you` sounds;
  - a 16 ms haptic;
  - the dock lifts 8 px and its rope lights;
  - the top bar turns ochre;
  - the screen reader announces it.

  After 15 s idle, it knocks once more (`meta.nudge`).
- **Someone else's turn:** the totem's travel and their signature.
- **How close is the end:** in act 1, the pool plaque; in act 2, the gate and its
  number, *"3 încercări până se închide balta"*.

### 4.6 Connection feel

- Re-send `rejoin` on every socket `open` (A15).
- Under 1.5 s disconnected, show nothing. Longer, the table drains to
  `--ink-soft` and a carved plaque, *"Se reconectează…"*, appears. On rejoin: a
  460 ms re-ink and `meta.reconnected`.
- A dropped player's chip goes dashed with the hook (`mock-chip-states.png`). The
  player can still be asked; the server answers for them.

---

## 5. Visual design

### 5.1 What stays

Palette and tokens; Vollkorn for display text and Source Serif 4 for text **and
all numerals** (A26); the nineteen carvings and their seals; category by shape;
notched geometry; the totem.

### 5.2 The one-screen table — mocked, asserted

`docs/plan-evidence/mock/` renders every frame from the client's **real** card
art, seals, totem, hand fan, notch clock, fonts and tokens. `shoot.cjs` asserts
that:

- the top bar sits at the top edge;
- strip, dock, hand and plank are inside the viewport;
- the ask sheet lies between the strip and the dock;
- there is no sideways scroll, and on desktop no page scroll.

**All ten layout frames pass;** the chip sheet is a reference, not a layout.

| Frame | Proves |
|---|---|
| `mock-phone-your-turn-390x664` / `-360x640` / `-375x548` | the whole table at the iOS Safari, Android Chrome and iPhone SE heights |
| `mock-phone-ask-sheet-390x664` / `-375x548` | the sheet in the pond's row, with full names, protection and power pips |
| `mock-phone-answer-390x664` / `-375x548` | the answer plank: equal buttons, clock, card |
| `mock-phone-dry-pond-390x664` | the neutral dry go-fish and the gate |
| `mock-desktop-1280x800` / `-1024x768` | the pond table |
| `mock-chip-states` | the chip in eight states, including the real worst cases |

**Phone anatomy:**

- **Top bar**, 40 px.
- **Opponent strip**, 96 px — up to five 60×76 chips.
- **The pond** — flexible; 185 px at 375×548 and 283 px at 390×664.
- **Your dock** — fixed and safe-area aware. Cards are 116×174 when the screen is
  at least 660 px tall, and 104×156 below that; the hand grows into the room.
  Every plank rises over the dock; the ask sheet takes the pond's row.

**The chip** (60×76):

- **Name:** the first word, CSS-ellipsised; the full name is on the sheet and in
  the drawer.
- **Score:** the mark, the score in Source Serif 4 lining figures (a flagged 1),
  and power pips (◆ unused, ◇ used).
- **Foot:** the hand count and status seals.
- **Stunned** is branded, not tinted: the plate burns dark, the jellyfish seal
  goes to the status corner, the wood darkens, and **the score stays at full
  ink**.
- **Protected:** a verdigris shell and the protected rank's seal.
- **Disconnected:** a dashed border and the hook.
- **Current turn:** an ochre border with the totem on the edge.
- **Worst cases**, both proven: stunned + protected + offline + a long name + three
  power sets + 12 cards; and current + protected + offline + a long name. A
  stunned player never holds the totem.

**Desktop — the pond table** (`mock-desktop-1280x800.png`):

- Five opponent posts (150 px, fixed) stand on an arc along the top of a carved
  table, the outer ones lower.
- The pond sits at the table's centre, as the flight stage.
- Your post and hand run along the bottom, on paper, with 132×198 cards.
- The log is a 280 px tally board on the right: marks, seals, the last three
  lines at full ink.

The same layout fits at 1024×768. Between 600 and 1024 px the table scales and
the log becomes a drawer.

### 5.3 The hand

- **Sort** by category (powers, normal, eggs), then rank.
  - Duplicates **group**, with a step of 25 % of the card's width inside a group.
    That keeps the index strip clear.
  - The step between groups is computed from the width available, up to 60 %.
  - A ×N badge marks duplicates.
- **Corner index.** The seal is already carved into each card's top-left corner.
  Below it stands a vertical three-letter abbreviation (*REC, ȚES, HER…*). All
  nine cards stay identifiable at 360 px.
- **Layable sets tie themselves:** an ochre rope and a carved *"PUNE JOS"* tab.
  Eggs that complete a set move beside it.
- **Fit.** With `min-width: 0` on the panel (A17), the dock scrolls sideways with
  snap past eight groups.

### 5.4 Texture, ink and light

- **Surfaces.**
  - A paper grain tile (≤ 8 KB, 12–16 %).
  - A wood grain tile that replaces the stripes.
  - A water background of carved waves (≤ 10 KB).
  - The mocks use feTurbulence stand-ins for all three.
- **Light follows the acts**: `--apa` steps darker at half the pool and again when
  it empties — flat steps, no gradients.
- **Ink edges, baked in vector.** `scripts/bake-ink.mjs` jitters vertices along
  their normals with seeded noise (±1–2 units) and adds ink pools at junctions.
  - It is deterministic, one seed per asset, and never rank-derived for backs.
  - It is prototyped on two cards in M1. The fallback is to rasterise
    feTurbulence and feDisplacementMap and ship WebP.
- **Budget:** +30 KB. Contrast is re-audited with the grain applied; body text
  stays ≥ 7:1.

### 5.5 VFX in print

Stepped SVG sequences, 3–4 frames each, ≤ 2 KB each, reviewed in the Codex:

| Effect | Used for |
|---|---|
| ink burst | the stamp |
| wood chips | splinter |
| water ring and splash | go fish |
| dust puff | dry go fish |
| gate notch and creak | the last act |
| speed grooves | flight smear |
| shell clamp | Tortoise |
| bell stamp | Jellyfish |
| mirror glint | Lanternfish |
| barbed hook | Stickleback |
| spiral chips | Whale |
| roe burst | score |
| gate doors | start and end |

### 5.6 Player marks

Six carved marks — *brad*, *val*, *soare*, *funie*, *cruce*, *rozetă* — assigned by
seat and paired with the seat's signature. They appear on chips, the sheet, log
lines and arrow-chips. Identity is carried by shape and sound, never by colour.

### 5.7 Signature moments

- **The reveal** (Mode Ascuns, first use): the plate lifts, flips in three stepped
  frames, rises to the pond's centre with its seal and motif, holds 400 ms, and
  presses flat. About 1.3 s, never blocking.
- **The Mantis strike**: hit-stop, an impact frame, splinters; the crack stays.
- **The Shark's interception**: cards turn mid-flight; the water rushes.
- **The Whale**: twelve backs spiral at the pond's centre, then the redeal.
- **The pool empties**: the stack drains into the basin, the light steps to night,
  and the gate appears.
- **The last lay** (under §11.2): the set presses flat, one held beat, the gate
  doors close, and the podium follows. The winners' posts rise, ties are equal
  totems, and the pips count up.

### 5.8 Screens and chrome

- **Lobby**: the pond at dusk; the audio unlock is the first knock.
- **Waiting room**: each post carves in with its seat's signature; on start, the
  tulnic calls and the gate opens.
- **Top bar**: icon tabs with labels. Mute is one tap; a long-press opens the
  mixer. Language moves into the menu.
- **Rules**: adds the **Codex** — the nine powers, each with its motif.
- **Copy**: *"You may lie with Squid"* shows only with an unused Squid (A23).
  Ticker lines stay under one screen width.

### 5.9 Visual accessibility

- Remove `maximum-scale=1` (A24).
- Numerals are unambiguous (A26).
- Photosensitivity rules are in §4.3, reduced motion in §4.2.
- No state is carried by colour alone: stunned is a brand, protected a shell,
  offline a dash and a hook.

---

## 6. Secrecy and integrity

### 6.1 Per-viewer event redaction (M0)

`redactEventsForPlayer(state, events, viewerId)` goes in `engine/src/redact.ts`,
is applied per player in `room.broadcastState`, and reuses the `laidSets`
concealment predicate. The spectator view is the *public record* of §3.2.

| Event | Rule |
|---|---|
| `GAME_STARTED` | no seed (there is none to send — §6.3) |
| `DREW_FROM_POOL` | `cardId` for the drawer only |
| `SET_LAID` | `rank: null` while the set is concealed from the viewer |
| `POWER_GRANTED` | `rank: null` while the source set is concealed; `grantId` to the owner only |
| `CLOWNFISH_BOUND` | owner only in Mode Ascuns; everyone in Mode Deschis |
| `WINDOW_OPENED` | `eligiblePlayerIds` becomes `youAreEligible`; context through `redactWindowContext` |
| `POWER_USED` and effects | public as they are; `grantId` to the owner only |

### 6.2 One shape for every answer (M0)

`handleDeclareSquid` closes the window through `closeWindow`, so the honest "no",
the Squid deny and the Squid claim all emit
`WINDOW_CLOSED(RESPONSE_PENDING) › REQUEST_FAILED › …`. An engine test asserts
identical redacted streams for every viewer but the target. The first fixture
fails today (`squid-events.ts`).

### 6.3 Randomness that never reaches the wire (M0)

- **The deal.** The server shuffles with a CSPRNG (a Fisher–Yates shuffle using
  `crypto.randomInt`) and passes the ordered deck to `createGame`.
- **The Whale.** Its shuffle takes 128 bits of fresh `crypto.randomBytes` that
  the server attaches to the action before `reduce`. Nothing seeded persists
  between actions.
- **Tests only.** Seeded PRNGs stay for engine tests and bot simulations, which
  pass explicit decks and entropy. The engine stays pure and replayable from its
  inputs.
- **Card ids** are `crypto.randomUUID()`, independent of every shuffle. **Grant
  ids** reach their owners only.
- **Why not a seeded PRNG in production?** v2 proposed xoshiro128\*\* for the deal,
  with card ids from the same stream. Its output scrambler is invertible and its
  state transition is linear over GF(2), so a handful of outputs recover the whole
  state. No game-RNG output may reach a client in any form.
- **The test.** Every serialized server message is checked: no `seed`, `rngState`
  or `entropy` key; every card id a v4 UUID; no field equal to an engine-RNG
  output in a seeded replay.

### 6.4 Action binding (M0)

- The server overwrites `action.playerId` with the socket's player.
- `SKIP_WINDOW` carries a `playerId` and must come from an eligible player.
- Timeouts submit a server-only skip.
- Bots and tests are updated to match.

### 6.5 The guarantees, as tests

**`presentation-leak.test.ts`** is built in M0 for the event and view layer and
extended in M1 to `choreography.ts`, `cues.ts` and the haptics map.

- **Test 1 — same record, same presentation.** Pairs of histories with identical
  public records:
  - honest "no" vs Squid deny vs Squid claim;
  - two face-down power sets of different ranks, on paths that open no
    rank-dependent window;
  - a clownfish bound to different powers, in Ascuns;
  - different hands behind the same public actions.

  It asserts:
  - identical beats, durations, classes, cues and haptics for every non-owner;
  - identical audible output for every viewer, owners included, in default mode.
- **Test 2 — structural erasure.** Pairs whose public records differ *only* by a
  structural window that opens and closes without a declaration. Examples: a
  Shark held (a `TURN_END` window, declined) vs not; the next player holding an
  active power (a `TURN_START` window, skipped) vs not.

  It asserts that the audible output — cue ids, parameters and order — is
  identical, with times shifted only by the window's pause. This is what catches
  a close cue that goes missing when a structural window follows.

**Guards.**

- The client imports only `PublicEvent`.
- A lint rule rejects rank-named dynamic imports and bank keys.
- `cuesheet.ts` is checked against §3.7.

### 6.6 The tells that live in the rules

What sound cannot hide, the plan does not claim to hide:

- **A structural window's banner** and **the pause it causes** are visible to
  everyone.
- **The banner stays neutral** (*"fereastră deschisă"*, never the window's name).
- **The rules-tell test** enumerates the five windows and is marked
  *known-failing* until §11.1 is decided.

---

## 7. Tooling — so one person can tune a six-player game

### 7.1 The bot table

`?table=bots&n=6&seed=42&seat=0&speed=1&bots=memory` runs the engine and a bot
population in the browser, feeding seat 0's redacted record into the real store.
You play or watch seat 0 at 0.25–4× speed, with pause and step.

- The engine's random bots are one population.
- The memory bots from `membot.ts` are the other; they make realistic endings and
  a dry act.

≈ 1.5 days.

### 7.2 Scenario fixtures

Loaded from a menu:

- a shark window open;
- a mantis strike;
- a whale between full hands;
- a pool at one card;
- a dry pool with the gate at 2N − 2;
- the last possible lay;
- a ten-card hand;
- six 24-character names.

### 7.3 The audio lab

`?lab=audio`:

- every cue with its variations;
- recipe parameters on sliders;
- bus meters, the activity envelope and the voice count;
- an event → cue trace;
- short-term loudness;
- the profile switch.

It grows out of the prototype (`docs/plan-evidence/audio/`).

### 7.4 Automated checks

- **Layout.** `mock/shoot.cjs`'s assertions, pointed at the product: the phone
  frames at 360×640, 390×664 and 375×548, and the desktop frames at 1280×800 and
  1024×768, each with three and six players in every state.
- **Offline audio.** The prototype's harness (`audio/run.cjs`) renders every cue
  and a three-minute human-paced scene per profile, and exits non-zero on any of:
  - a cue other than a seat cue striking plank A, B or C (§3.1);
  - a speaker variant whose energy after 250 ms is less than 12 dB under its
    first 250 ms, measured without the safety fade (§3.4);
  - integrated loudness more than 2 LU off target;
  - true peak above −1 dBTP, in the scene or the worst six-cue pile-up;
  - any sample within 0.5 dB of the soft clip.

  All pass today. From M1 it runs against the product's cue sheet and mixer.
- **Unit.**
  - Test 1 and test 2 (§6.5).
  - The rules-tell test.
  - The cue-sheet rules (§3.7).
  - The RNG wire test (§6.3).
  - The 300-event regression.
- **Budgets.** Added JS ≤ 60 KB gzipped over today's 65 KB; audio downloads
  ≤ 220 KB; textures ≤ 30 KB.

### 7.5 The call rig

Five clients (three laptops, two phones) on speakers in one Discord call, plus a
headset recorder, for §9.3 and experiment E1.

---

## 8. Production plan

Focused days for one engineer comfortable with Web Audio, plus a part-time sound
designer and illustrator. Content work runs in parallel but does **not** shorten
the engineering path.

### 8.1 Milestones

| | Scope | Eng. days | Exit |
|---|---|---|---|
| **M0 Stop the bleeding** | Redaction (§6.1): 1.5 d. One answer shape (§6.2): 0.5 d. The CSPRNG deal, whale entropy and UUIDs, with test re-baselining (§6.3): 1.75 d. Action binding (§6.4): 1 d. Both audio tells and the view-driven close: 0.5 d. `seq` and the late-game fix: 0.5 d. `endPressure` in the view: 0.25 d. Auto-rejoin: 0.25 d. Log scroll, overflow, sixth post, zoom, numerals, copy: 0.5 d. `deadlineAt` and `serverNow`: 0.75 d. Client Vitest and test 1 at the event and view layer: 1 d. | 7.5–9.5 | test 1 passes at the event and view layer; the RNG wire test passes; a 1,000-event game still presents; a 5 s cut recovers without reload |
| **M1 Foundations** | The audio engine on the §3.3 chain, with current cues migrated; the timeline (§4.2); the bot table with both populations; fixtures; the lab; the offline audio harness; the Playwright checks; the ink-bake prototype on two cards | 8–10 | no regressions; six bots at 4× for 30 min with no drift; loudness per profile and test 2 in CI |
| **M2 The ask** | The phone table and the desktop table (§5.2); the hand and the ask sheet; drag and keyboard; flights, arrow-chip, masking, totem; beats 0–4c with their overlaps; seat signatures; the answer window's cues and the server clock; haptic tiers; the call rig's first run | 10–13 | layout checks green; answer to rest ≤ 0.9 s p95 in the bot table; playtest 1 |
| **M3 Powers and rules** | The motifs with speaker variants; every power cue; the four signature moments; declares without selects; optimistic declare. If accepted: the single answer plank (2 d), folding `TURN_START` (1 d), ending when the score is final (1 d); the gate either way (0.5 d). | 11–14 (+3 art) | every power has a public, rank-correct audiovisual in both modes; test 1 covers all nine; playtest 2 |
| **M4 World and ceremony** | Texture and ink; the two-act arc and the gate's sound; lobby and waiting-room audio; the tulnic and the ceremonies; the last-lay finale; the tally; marks; icons; the Codex; recorded banks | 8–10 (+4 audio, +4 art) | art review in the Codex; the ambience opt-out count; loudness re-verified with the recordings |
| **M5 Tune and gate** | Performance, accessibility, the mix pass (the blindfold, mute, call, desk and phone-speaker tests), playtest 3 and its fixes | 5–7 | every §0.2 item |

**Totals:** 50–64 engineering days — M0 7.5–9.5, M1 8–10, M2 10–13, M3 11–14,
M4 8–10, M5 5–7 — plus ≈ 6 days of audio production and ≈ 7 of art.

### 8.2 Critical path

M0 → M1 → M2 → M3. Motifs, Foley, textures and the VFX sheet run from M1–M2 and
land as swaps under existing ids.

### 8.3 Cut lines

- **Four weeks (~21 days).** M0; the minimal M1 (the chain, profiles, voices,
  live wood, paper and water, the timeline); and M2's core (the phone table, the
  hand, the ask sheet, give and draw flights, wet and dry go fish, the server
  clock). It delivers the secrecy, phone and core-loop gains.
- **Eight weeks:** plus the rest of M2, and M3 with the end rule.
- **Full:** everything.

---

## 9. Measurement

### 9.1 Automated gates (CI)

§7.4, plus:

- input latency ≤ 50 ms p95;
- ≥ 55 fps during a six-player whale;
- answer to rest ≤ 0.9 s p95.

All are measured in the bot table at 4× CPU throttling and confirmed on a real
mid-range Android at each milestone.

### 9.2 Playtests

**Protocol:** three rounds — after M2, M3 and M5 — of five players on Discord
voice, with at least one iPhone and one Android among them. Each runs 45 minutes
with an observer, recordings and a survey. **Every result is reported per round,
because the builds differ, and pooled (n = 15), as counts.**

| Measure | How | Target |
|---|---|---|
| Whose-turn confusions | observer tally | 0 in round 3 |
| Missed windows | timed-out eligible windows and the total (`?metrics=1`) | report both; investigate any miss |
| Answer time | median and p90 (`?metrics=1`) | sets *T* (§3.10) |
| Time from the score becoming final to the podium | `?metrics=1` | ≤ one beat under §11.2 |
| Muted by the end | count | ≤ 2 of 15 |
| Ambience turned off | count | ≥ 5 of 15 → ships off |
| "I always knew what just happened" (1–7) | median | ≥ 6 |
| "The table feels alive" (1–7) | median | ≥ 5.5 |
| "I knew how close the end was" (1–7), rounds 2–3 | median | ≥ 5.5 |
| Motif distinctiveness | after one Codex pass, match 8 motifs to 8 cards | median ≥ 6 of 8 |
| Private information heard or seen | reports and a review of the recordings | 0 |

### 9.3 Listening and device tests (M2 first pass, M5 sign-off)

- **Blindfold.** Screen off, ten turns. The listener names the seat (by
  signature) and the outcome type (ask, give, wet or dry go fish, lay, power,
  stun). Target: 8 of 10 on each; fallback per §3.1.
- **Mute.** A full game with sound off; no missed window attributable to missing
  audio.
- **Call.** The §7.5 rig, with noise suppression on and off:
  - no private-tier cue in default mode;
  - copies and smear per cue family;
  - the game's short-term loudness against the recorded speech level;
  - experiment E1's decision.
- **Desk.** An ERM and an LRA phone on a wooden desk beside a laptop microphone.
  The quietest perceptible private pattern the microphone cannot detect is chosen
  per motor class; a class with none keeps private haptics off.
- **Phone speaker.** Every cue audible and undistorted in the speaker profile at
  50 % volume, in quiet and in ~60 dBA café noise.

---

## 10. Risks

| Risk | L | I | Mitigation |
|---|---|---|---|
| R1 iOS Safari audio quirks | H | H | a device matrix per milestone; unlock on first gesture; `audioSession`; the silent-switch hint |
| R2 Bluetooth latency | M | M | `outputLatency` compensation; the A/V offset |
| R3 Flights drop frames on low-end Android | M | H | transform and opacity only; at most 12 in flight; flutter dropped first |
| R4 A future change re-leaks a secret | M | H | tests 1 and 2, the RNG wire test, `PublicEvent`-only imports, lint |
| R5 The call smears the mix | H | M | the echo budget met per cue; the speaker profile; E1; the rig from M2 |
| R6 Folk or liturgical material misreads | M | M | material, not liturgy; the tulnic calls; a consultant; a real player |
| R7 The vector ink bake reads as fake | M | M | the two-card prototype in M1; the raster fallback |
| R8 The rules decisions are refused | M | M | structural tells stay silent in audio and neutral in text; without §11.2 the gate is the countdown; both are documented |
| R9 Seat signatures don't carry "who" by ear | M | L | the M2 blindfold test and the §3.1 fallback |
| R10 Scope creep | H | M | the vertical slice first; the cut lines |

---

## 11. Decisions needed

**11.1 Uniform windows** — a rules change that needs a `DECISIONS.md` entry.

- **(a) Fold `TURN_START` into the turn.** Active powers are offered in the dock
  before the ask, with no window. Cost: none.
- **(b) The single answer plank.** The truth, the lie, the reflection and the
  protection all arrive on one plank. After a reflection, the asker always gets
  one short plank. Saves waits.
- **(c) Fixed-length beats for Mantis and Shark.** A 2.5–3 s beat after every
  power-set lay and every successful ask; only a declaration ends it early. Cost:
  ≈ 60–110 s a game (≈ 6–9 power lays and 22–29 successful asks).

*Recommended:* (a) and (b) in M3; (c) as a playtest A/B against accepting the
group-level tell.

**11.2 End the game when the score is final.** Whenever an action resolves with
no window open and the pool empty, the server asks one question. Could any rank
still reach a set from the cards left in hands — at least two real cards, at most
two eggs, as if every card could be gathered into one hand — or could four eggs
still make an eggs set? If not, no set can ever be laid or destroyed again, so
neither the score nor the power-set tie-break can move. The game ends at once with
`GAME_ENDED { reason: 'decided' }`.

- **Only at rest.** While a `SET_COMPLETED` window is open, a Mantis can still
  destroy the set just laid. A check made mid-window fired too early 70 times in
  2,400 bot games; the at-rest check never did (`ending.ts`, `membot.ts`).
- **The last lay is the finale.** With the pool empty the answer can only change
  when a lay resolves, so a decided game ends on its last lay.
- **What it removes:** a median 6–12 dead asks in 98–99 % of skilled games (§1.1,
  A18).
- **What remains:** a game in which a set is still possible in principle runs to
  the 2N rule, as today, with the gate as its countdown.
- **Strategy:** unchanged; once the check fires, nothing a player does can matter.
- **Cost:** about a day in M3.

*Recommended.* Without it, the gate (§3.9) is the public countdown to the 2N rule.

**11.3 Ambience default** — on, playtest-gated (§3.9).

**11.4 Phone asking** — the thumb-zone sheet on phones; drag on desktop.

**11.5 The uniform close** — replaces the 700 ms hold (§12).

**11.6 Recorded audio budget** — ≈ €300–600, plus a consultant session.

**11.7 Headphones mode** — ship it, off by default.

**11.8 A folk-music consultant** — 2–3 hours, before the M4 session.

---

## 12. Amendments to DESIGN.md

| § | DESIGN.md says | This plan says | Why |
|---|---|---|---|
| 2 | Vollkorn for display, including numerals on cards | Source Serif 4 lining figures for every numeral | Vollkorn's "1" reads as "I" (A26) |
| 5.4 | tap a post, then a card, then confirm | phone: tap a group, then a name, in the thumb zone; desktop: drag or tap-tap | the targets must be under the thumb |
| 6.2 | nothing may exceed `--dur-heavy` except game over | signature moments may run to 1.4 s, never blocking | rare moments need anticipation, turn and hold |
| 6.5 | the authoritative view updates immediately | logic and input do; arriving pixels are masked for ≤ 800 ms; transitions come from view diffs | otherwise cards appear before they fly, and event shapes could steer presentation |
| 7.1–7.2 | the toacă as the UI material; ambience off; one sprite | the material, not the liturgy; the tulnic calls; a two-act ambience, on and playtest-gated, generated live | cultural care; the pond is the world's voice; budgets close |
| 7.3 | `SET_LAID` identical for power and normal | identical for every *rank*; the category may differ | `isPowerSet` is already public |
| 7.3–7.4 | eligible players hear a distinct window figure and ticks | only the answer window is voiced, identically everywhere; its close follows its leaving the view | a distinct sound on one client is a tell; a missing close would be one too |
| 7.5 | duck ambience −6 dB under table cues; cap total output | a slow activity envelope; the chain of §3.3, proven in the prototype | per-cue ducking pumps; the calibration gain must precede the limiter |
| 8.2 | haptics as the eligibility signal | Android only; the private pattern is set by the desk test | iOS has no Vibration API; a buzzing phone is audible |
| 9.4 | hold 700 ms after every window closes | the same 220 ms close for every window; durations leak-tested | the hold hides nothing that uniform, pure choreography does not, and it would add half a second to the most frequent transition |

---

## Appendix A — Every event, every channel

| Event | Motion | Sound (default) | Haptic | Class |
|---|---|---|---|---|
| `GAME_STARTED` | the gate opens; the posts carve in | `mus.start` | — | ceremony |
| `TURN_STARTED` | the totem travels | `table.turn` (signature) / `table.turn.you` | 16 (you) | light |
| `TURN_SKIPPED_STUNNED` | the totem passes over the post | `table.skipped` | 40 (you) | light |
| `BONUS_TURN` | the totem stamps in place | `table.bonus` | — | light |
| `HAND_REFILLED` | *n* cards rise from the pool | `table.draw` × *n* | 6 each (you) | light |
| `REQUEST_MADE` | the arrow-chip flies asker → target | `table.ask` (the target's signature) | — | light |
| the answer window opens (view) | the plank (target); the banner (others) | none for the table — the ask's landing is the opening; `table.asked` (target) | 12·60·12 (target) | — |
| the answer window leaves the view, whatever follows | the uniform 220 ms close | `clock.close` | — | — |
| a structural window opens or closes (view) | the plank and frame (eligible); a neutral banner (others) | **none** | private (eligible) | — |
| `REQUEST_SUCCEEDED` | backs fly target → asker | `table.flight`, `table.give` | 30 (loser) | medium |
| `REQUEST_FAILED`, pool > 0 | the chip dives into the pond | `table.gofish` | — | light |
| `REQUEST_FAILED`, pool empty | the chip drops to the basin floor; the gate shuts a notch | `table.gofish.dry`; `amb.lastact` from N | — | light |
| `DREW_FROM_POOL` | a card rises from the pool | `table.draw` (or `table.poolEmpty`) | 6 (you) | light / heavy |
| `SET_LAID` | the group presses flat under the post; a pip is gouged; the gate swings open | `table.lay` / `table.lay.power` | — | medium |
| `SET_DESTROYED` | the Mantis strike | `power.mantis` | 20·30·40 (owner) | heavy |
| `POWER_GRANTED` | the collar or rosette core ignites — the same for every hidden rank | `power.granted` (the motif in Deschis) | — | medium |
| `POWER_USED` | the reveal (Ascuns) or the flip to spent (Deschis) | `power.used.<rank>`, `power.reveal` | — | medium |
| `CLOWNFISH_BOUND` | the owner's slot fills | private / public by mode | — | light |
| `SHARK_JUMP` | the interception | `power.shark` | 30 (loser) | heavy |
| `LANTERNFISH_REFLECT` | the chip mirrors and returns | `power.lanternfish` | 30 (loser) | medium |
| `TORTOISE_BLOCK` | the shell clamps; cards drop back | `power.tortoise` | — | medium |
| `JELLYFISH_STUN` | the bell brands the target's plate | `power.jellyfish` | 40 (target) | medium |
| `STICKLEBACK_STEAL` / `_WASTED` | a straight, fast yank / a yank that catches nothing | `power.stickleback` / `.miss` | 30 (target) | medium / light |
| `WHALE_SHUFFLE` | the spiral and the redeal | `power.whale` | 20 (both) | heavy |
| `GAME_ENDED` (`decided` / `streak`) | the last lay's beat, or the gate shutting; then the podium | `mus.end.*`, `table.tally` | 16 | ceremony |
| **Squid** | **nothing** | **nothing** | **nothing** | — |

## Appendix B — Synthesis recipes

The prototype in `docs/plan-evidence/audio/sketch.js` implements every row;
WAVs and spectrograms are beside it.

| Family | Made | Recipe |
|---|---|---|
| **Wood** | live | Exciter: a 3 ms noise burst from the shared buffer, band-passed at 2.5 × f0 (Q 1). Four sine modes at f0 × 1 / 2.756 / 5.404 / 8.933, amplitudes 1 / 0.5 / 0.25 / 0.12, T60 160 / 90 / 45 / 25 ms × size (A 1.4, B 1.0, C 0.7, D 0.45). *Damping* shortens and low-passes. *Hard mallet:* a 2 ms exciter band-passed at 4 × f0. Variation: f0 ±3 %, ratios ±1 %, exciter offset. Planks A–C ring only in seat cues. |
| **Seat signature** | live | Plank A, B or C, one knock or two 75 ms apart (the second at −2 dB). |
| **Table top** | live | *Thud:* a sine falling from 125/w Hz to 60 % of that over 50 ms, with a `tanh` harmonic layer at −10 dB, over a 35 ms noise burst band-passed at 440/√w Hz (w = weight). No modes, so no ring. *Slap* (a card laid): a 12 ms paper transient at 2.2 kHz on a thud. |
| **Paper** | live | *Slide:* noise through a band-pass swept 2.5 → 4.5 kHz (Q 1.2), 40–80 Hz amplitude grain. *Lift / flick:* a 25 ms burst, high-passed at 3 kHz. |
| **Water** | live | *Bubble:* a sine rising ~40 % over its 40–80 ms life (large 450 Hz, small 900–1600 Hz). *Plop:* one large and two to four small bubbles in 60 ms, plus a 120 ms splash. *Drip:* one 1.8–2.6 kHz bubble. |
| **Dry go fish** | live | One table-top thud, then three plank-D skid ticks at 70, 110 and 160 ms, falling in level (183 ms in all). |
| **Riffle** | rendered | 30–45 clicks, each high-passed at 2.5–4 kHz, sparse–dense–sparse over 0.8 s (170 ms in the speaker variant). |
| **Breath** | rendered, 32 kHz | *Fluier:* sine plus 2nd (−14 dB) and 3rd (−20 dB) harmonics; breath noise band-passed at f0 (Q 8) and 3 kHz; 50 ms attack with a −30-cent scoop; 5.5 Hz vibrato of ±12 cents after 150 ms. *Caval:* an octave down, breathier. *Tulnic:* harmonics 1–8 at −6 dB/octave, low-passed at 900 Hz, 200 ms attack. |
| **Strings (țambal)** | rendered, 32 kHz | Karplus–Strong in JS, three strings per course detuned ±4 cents, decay 0.996. The speaker variant is damped by hand at 180 ms. |
| **Skin (dobă)** | live | A sine falling 95 → 52 Hz, a 500 Hz slap, a `tanh` harmonic layer at −10 dB. |
| **Drâmbă** | rendered | A 10 %-duty pulse at 98 Hz through two swept band-pass formants, with a 6 Hz wobble. |
| **Ink stamp** | live | A sine falling 110 → 70 Hz over 60 ms with a `tanh` harmonic layer, then a 15 ms noise peel. |
| **Pond beds** | live | A looped noise buffer through a slowly drifting low-pass; drips from the water recipe every 3–8 s. |

## Appendix C — The cue bible

What each cue is made of and when it plays. *Heard by:*

- **all** — every client;
- **local** — the acting client, when the action's possibility is public;
- **you** — the seat a public fact concerns;
- **private** — headphones mode only.

Lengths are the headphones profile; the speaker variants follow §3.4. A ringing
plank A, B or C appears only in seat cues (§3.1).

**Interface**

| Cue | Trigger | Heard by | Material and recipe | Length |
|---|---|---|---|---|
| `ui.press` | a primary button | local | plank D, dry | 60 ms |
| `ui.press.soft` | a secondary button | local | plank D, damped | 50 ms |
| `ui.select` | a card group picked up on your turn | local | paper lift and a plank D tick | 80 ms |
| `ui.drop` | a group put back | local | paper settle | 60 ms |
| `ui.target` | a target chosen | local | the target's signature, damped | 90 ms |
| `ui.error` | a rejected action | local | a table-top thud — never a buzzer | 80 ms |
| `ui.toggle` | a setting switched | local | a paper flick and a plank-D tap, higher for on | 90 ms |
| `ui.copy` | the room link copied | local | a small ink stamp | 90 ms |

**The table**

| Cue | Trigger | Heard by | Material and recipe | Length |
|---|---|---|---|---|
| `table.turn` | `TURN_STARTED`, someone else | all | the new player's signature as the totem lands, panned to their post | ≤ 200 ms |
| `table.turn.you` | `TURN_STARTED`, you | you | your signature, then a bright plank D knock | 190 ms |
| `table.bonus` | `BONUS_TURN` | all | two quick plank D ticks, the second higher — *again* | 130 ms |
| `table.skipped` | `TURN_SKIPPED_STUNNED` | all | the stunned seat's signature, muffled, with a drâmbă wobble | 400 ms |
| `table.ask` | `REQUEST_MADE` | all | the arrow-chip's paper flick, then the target's signature as it lands | 200 ms |
| `table.asked` | the answer window opens, on the target | you | two plank-D taps — knock, knock — as your plank rises | 150 ms |
| `table.answer` | the target presses any answer | local | a small ink stamp and a plank-D tap: the answer is recorded — **identical for truth and lie** | 63 ms |
| `table.flight` | cards in flight | all | paper flutter, one per batch | 260 ms |
| `table.give` | `REQUEST_SUCCEEDED` | all | a paper slide, then the stack lands on the table top, heavier per card | 330 ms |
| `table.gofish` | `REQUEST_FAILED`, pool > 0 | all | the plop — one large bubble with an upward chirp, small ones, a short splash | 100–350 ms |
| `table.gofish.dry` | `REQUEST_FAILED`, pool empty | all | a table-top thud — the dry basin floor — and a short skid of plank-D ticks; neutral | 183 ms |
| `table.draw` | `DREW_FROM_POOL` | all | a wet paper lift; wetness follows the pool | 44–140 ms |
| `table.refill` | `HAND_REFILLED` | all | `table.draw` × count, 90 ms apart | ≤ 360 ms |
| `table.poolEmpty` | the last card leaves the pool | all | a drain gurgle into the hollow ring of the empty basin; act 2 begins | 1.2 s |
| `table.lay` | `SET_LAID`, normal or eggs | all | three cards slapped down, each heavier, and an ink stamp; the gate creaks open if shut | 425 ms (speaker 204 ms) |
| `table.lay.power` | `SET_LAID`, power set | all | `table.lay` with a low dobă — the same for all nine ranks | 450 ms |
| `table.tally` | game over, each pip | all | plank D, a step up per pip | 90 ms each |

**Ceremony**

| Cue | Trigger | Heard by | Material and recipe | Length |
|---|---|---|---|---|
| `mus.start` | `GAME_STARTED` | all | the tulnic calls the table — two long rising notes — and the gate opens | 2.4 s |
| `mus.end.win` / `.tie` / `.lose` | `GAME_ENDED` | you | fluier over dobă, rising / two fluiers in thirds / a gentle falling caval — never a "fail" sting | 2.5–3 s |
| `mus.lastlay` | the lay that makes the score final (§11.2) | all | the stamp, a held beat, the gate doors closing | 1.2 s |

**The clock** (the answer window only)

| Cue | Trigger | Heard by | Material and recipe | Length |
|---|---|---|---|---|
| `clock.tick` | each second from *T* to 3 s left | all | plank D | 60 ms |
| `clock.tick.urgent` | every 500 ms in the last 3 s | all | plank D with a harder mallet — density, not pitch or level | 60 ms |
| `clock.close` | `RESPONSE_PENDING` leaves the view, whatever follows | all | the plank lowered: a paper lift and a soft table-top thud | 54 ms |
| `clock.eligible` | a plank appears where you are eligible | private | a two-note rising fluier, +120 ms | 400 ms |

**Powers**

| Cue | Trigger | Heard by | Material and recipe | Length |
|---|---|---|---|---|
| `power.granted` | `POWER_GRANTED` whose rank is not public | all | a țambal shimmer over a low swell — the same for all nine | 1.4 s (speaker 200 ms) |
| `power.granted.<rank>` / `.mine` | Mode Deschis / your own grant in Ascuns | all / private | the rank's motif, soft | ≤ 1 s |
| `power.used.<rank>` | `POWER_USED` | all | the rank's motif, under the effect cue | 0.9–1.2 s (speaker two notes) |
| `power.reveal` | a face-down set flips on first use | all | three plank-D clacks, then an ink stamp | 400 ms |
| `power.shark` | `SHARK_JUMP` | all | a dobă hit, a water rush, the jaw snapping shut on plank D | 427 ms (speaker: the snap at 120 ms) |
| `power.lanternfish` | `LANTERNFISH_REFLECT` | all | a țambal glint, then the asker's signature — the ask comes back | 500 ms |
| `power.tortoise` | `TORTOISE_BLOCK` | all | the shell clamps — two table-top thuds — and the cards slap back | 450 ms |
| `power.jellyfish` | `JELLYFISH_STUN` | all | drâmbă through a sweeping formant, then the bell stamp | 540 ms (speaker 192 ms) |
| `power.stickleback` / `.miss` | `STICKLEBACK_STEAL` / `_WASTED` | all | a barbed scrape and a paper whip / the scrape, hollow | 280 / 180 ms |
| `power.mantis` | `SET_DESTROYED` | all | the club lands on the table top, the shell cracks, plank D splinters | 288 ms |
| `power.whale` | `WHALE_SHUFFLE` | all | a tulnic swell, the riffle, the redeal | 1.34 s (speaker 236 ms) |
| `power.clownfish.bound` | `CLOWNFISH_BOUND` | private in Ascuns; all in Deschis | a peg in a slot, then the copied motif on drâmbă | 600 ms |
| — | **Squid, in any form** | nobody | **silence** | — |

**World and meta**

| Cue | Trigger | Heard by | Material and recipe |
|---|---|---|---|
| `amb.water` | act 1, the pool | all | lapping, thinning as the pool drains; dry wind in act 2 |
| `amb.life` | act 1 | all | fish jumps, reeds, distant birds |
| `amb.lastact` | act 2, `endPressure.misses` ≥ N | all | a low dobă pulse, quickening from 2N − 2; stops when the gate swings open |
| `amb.gate` | each dry miss / each reset | all | the gate shuts a notch (a low creak) / swings open (a longer creak) |
| `amb.lobby` | lobby and waiting room | local | the full pond, louder |
| `meta.join` / `.leave` | a player joins / leaves or drops | all | their signature / the same, damped |
| `meta.reconnected` | you rejoin | you | a soft ink stamp |
| `meta.nudge` | your turn has been idle 15 s | you | one soft `table.turn.you` |

## Appendix D — The cue sheet

Levels are dB relative to the bus, after class normalisation (§3.3). **Prio** runs
from 0 to 5. **Var:** *live* means continuous seeded variation. **Short** is the
backlog variant. **Env:** *src* feeds the activity envelope; *ex* makes the
ambience fade under the cue. **Plays** are the §1.1 ranges across both bot
populations. `cuesheet.ts` holds this data, and a test enforces §3.7 on it.

| Cue | Bus | Plays | Level | Prio | Inst. | Cooldown | Var. | Max len | Short | Env |
|---|---|---|---|---|---|---|---|---|---|---|
| `ui.press` / `.soft` | UI | per input | 0 / −4 | 1 | 2 | 40 ms | live | 60 ms | same | — |
| `ui.select` / `ui.target` | UI | 12–26 | −2 | 1 | 2 | 60 ms | live | 90 ms | same | — |
| `ui.error` / `.toggle` / `.copy` | UI | rare | 0 / −3 | 1–2 | 1 | 100–250 ms | 2–3 | 120 ms | same | — |
| `table.answer` | UI | 12–26 | −4 | 2 | 1 | 200 ms | live | 70 ms | same | — |
| `clock.eligible` (private) | UI | per window | 0 | 4 | 1 | — | 1 | 400 ms | — | — |
| `table.turn` | Table | 78–99 | −6 | 2 | 1 | 150 ms | live | 200 ms | same | src |
| `table.ask` | Table | 74–95 | −4 | 2 | 1 | 150 ms | live | 200 ms | knock | src |
| `table.turn.you` | Table | 13–27 | −2 | 3 | 1 | 300 ms | live | 190 ms | signature | src |
| `table.bonus` | Table | 21–28 | −4 | 2 | 1 | 200 ms | live | 130 ms | one tick | src |
| `table.asked` | Table | 12–26 | −2 | 3 | 1 | — | live | 160 ms | one tap | — |
| `table.flight` | Table | 22–29 | −10 | 1 | 2 | 100 ms | live | 260 ms | dropped | — |
| `table.give` | Table | 22–29 | −2 | 3 | 1 | — | live | 340 ms | landing | src |
| `table.gofish` | Table | 24–45 | 0 | 3 | 1 | — | live | 350 ms | plop | src |
| `table.gofish.dry` | Table | 7–48 | −2 | 3 | 1 | — | live | 190 ms | thud | src |
| `table.draw` | Table | 23–45 | −6 | 2 | 3 | 60 ms | live | 140 ms | drip | src |
| `table.poolEmpty` | Table | 1 | +2 | 4 | 1 | — | 1 | 1.2 s | gurgle | src |
| `table.lay` / `.lay.power` | Table | 6–9 each | 0 | 3 | 1 | — | 4 / 3 | 450 ms | stamp | src |
| `table.tally` | Table | per pip | −6 | 2 | 2 | 60 ms | live | 90 ms | same | — |
| `clock.close` | Clock | 73–94 | −2 | 5 | 1 | — | live | 60 ms | same | — |
| `clock.tick` / `.urgent` | Clock | set by *T* | −2 / 0 | 5 | 1 | 900 / 400 ms | live | 60 ms | same | — |
| `power.granted` | Power | 5–8 | −2 | 4 | 1 | — | 3 | 1.4 s | 250 ms | src |
| `power.granted.<rank>` | Power | 5–8 | −4 | 4 | 1 | — | 1 each | 1 s | 2 notes | src |
| `power.used.<rank>` | Power | 4–6 | 0 | 4 | 1 | — | 1–2 each | 1.2 s | 2 notes | src |
| `power.reveal` | Power | ≤ 6 | 0 | 4 | 1 | — | 2 | 400 ms | clacks | src |
| `power.shark` / `.mantis` | Power | ≈ 1 | +2 | 4 | 1 | — | 2 | 430 ms | hit | src |
| `power.lanternfish` / `.tortoise` / `.jellyfish` / `.stickleback` | Power | ≤ 1 | 0 | 4 | 1 | — | 2 | 280–700 ms | first hit | src |
| `power.whale` | Power | ≈ 1 | +1 | 4 | 1 | — | 1 | 1.4 s | 400 ms | src |
| `power.clownfish.bound` | Power | ≈ 1 | −4 | 3 | 1 | — | 1 | 600 ms | peg | — |
| `mus.start` / `.end.*` / `.lastlay` | Music | 1 | 0 | 5 | 1 | — | 1 each | 3 s | — | ex |
| `amb.gate` | Ambience | 7–48 | −20 | 1 | 1 | 200 ms | live | 400 ms | — | — |
| `meta.*` | Table / UI | rare | −4 | 2 | 1 | 200 ms | live | 200 ms | same | — |
| ambience beds, life, last act | Ambience | continuous | −26 bus | 0 | 3 | — | live | — | — | target |
| **Squid** | — | — | — | — | — | — | — | — | — | — |

## Appendix E — Revision history

- **v1** (`55b451f`) — first plan. Review 1: **6.9/10**.
- **v2** (`a14d309`) — the Squid event-shape leak; a precise guarantee; per-profile
  loudness; the cue bible and sheet; the call model; live synthesis; seat voices;
  mocks at real heights; re-scoped M0. Review 2: **7.5/10**.
- **v3** — revised after review 2:
  - *Two audio fixes.*
    - The answer-window close now fires when `RESPONSE_PENDING` leaves the view,
      whatever follows, and the rules' own windows are never voiced (§3.2).
    - A new structural-erasure test catches the leak v2's close rule had (§6.5,
      test 2).
  - *The deal.*
    - A server-side CSPRNG, with per-action whale entropy and UUID card ids.
    - The seeded-PRNG design was dropped, because xoshiro's outputs reveal its
      state.
    - An RNG wire test (§6.3).
  - *The ending and the arc.*
    - The arc is re-based on how games really end, measured with memory bots:
      no game ends by laying every card, and skilled play leaves 6–12 dead asks
      (`ending.ts`, `membot.ts`).
    - A new rule ends the game when the score is final, with the last lay as the
      finale (§11.2).
    - The two-act arc, the public `endPressure` and the closing gate (§3.9).
  - *The audio prototype* (`docs/plan-evidence/audio/`).
    - The master chain was corrected: calibration before the limiter, the speaker
      densifier, the Clock bus bypassing the glue.
    - Per-cue speaker variants meet the echo budget.
    - Both profiles were measured on target with no clipping (§3.3).
  - *The cue sheet obeys the frequency rule.* Every cue heard more than 15 times
    a game is live, those heard more than 60 are ≤ 250 ms, and the sheet is data
    under test (§3.7).
  - *Seat signatures replace absolute pitch*, and the gliding knock is gone; the
    claim is conditional on the blindfold test (§3.1). The dry go-fish is neutral
    (§4.1). Every beat has specified overlaps, with answer to rest 0.8 s by design
    (§4.1).
  - *The plank grammar* (§3.1). Planks A–C now ring only for seats; the clock,
    the presses and the landings moved to plank D and a new table-top thud. The
    separate `clock.open` is gone, since the ask's landing is the opening.
  - *A self-checking prototype.* The harness fails on a grammar, echo-budget or
    loudness miss (§7.4). The echo budget is measured with no safety fade. The
    riffle, drâmbă, table-top and drifting pond-bed recipes are implemented, so
    Appendix B is complete. The scene is three minutes, with clamped thinks.
  - *The end check runs only at rest*, since a Mantis can still destroy the set
    just laid (§11.2).
  - *Visuals.*
    - Numerals moved to Source Serif 4 (A26).
    - The stunned state keeps the score, and the ask sheet shows protection and
      powers.
    - The real worst-case chips are shown.
    - A desktop mock at 1280×800 and 1024×768.
    - The ask sheet moved into the pond's row.
    - `shoot.cjs` now asserts the sheet, the plank and the top edge (§5.2).
  - *Numbers corrected:* effort 50–64; ~24 cues a minute; "successful asks"; the
    bus for `table.answer`. Playtests are reported per round and pooled.
