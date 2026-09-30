# Critic reviews of `MUSIC_PLAN.md`

The background-music plan was scored by a separate agent briefed as a very harsh AAA game designer and audio
director: 1 = unusable, 6 = passable, 8.5 = AAA quality. The brief allowed **one rewrite**, aiming for 8.5 or higher.
Each report is here verbatim. Round 2 used a fresh critic, given the round-1 report, so it would not simply check its
own list.

| Round | Plan | Commit | Score | Report |
|---|---|---|---|---|
| 1 | v1 | `6fad950` | **5.8** | [round-1.md](round-1.md) |
| 2 | v2 | `a084f35` | **7.1** | [round-2.md](round-2.md) |

**Outcome: 7.1 after the one allowed rewrite, below the 8.5 target.** The plan in the repository is v2, exactly as
scored.

## What round 2 accepted

Round 2 marked the round-1 engineering defects as fixed, or mostly fixed:
- the 1 s looping noise under the hum (now generated noise in an AudioWorklet);
- the renderer that re-attacked every note (now a separate legato voice);
- rendering on the main thread (now real time on the audio thread);
- the clock margin on headphones (A9, +2 dB);
- the state precedence;
- the ducks landing on the cut points.

It rated the Law 1 (secrecy) design the strongest part, at 8.5. All 16 example phrases pass the plan's own rules
(checked by script before round 2, and again by the critic).

## What stands between v2 and 8.5

Round 2 found problems that the rewrite itself introduced. Two of them were confirmed against the plan text before this
log was written:
- **The repetition bound is wrong.** Each pass is an independent permutation, so a phrase can come back two slots
  later, not ten.
- **`world.dark.01`'s −14.0 LUFS includes the horn note** that A8 moves to `mus.home`. The knock alone is about
  −27 LUFS.

Its ranked must-fixes, in short:

1. **The hum against the pond, in real bands.** With the §4.1 voicings, several upper partials would sit under the
   pond in their own third-octave band, so check #18 fails by design. The hum also ignores the ambience's activity
   envelope and the pond's wetness, so "the world stem is unchanged" holds only in the loudest state.
2. **The bed under the hum still loops at 1 s.** The pond and the wind read the shared 1 s buffer. And the wind's
   resonances would clash with a tuned drone.
3. **Sync on one timebase.** A backlogged presenter can land the chord cut up to about 2.9 s after the broadcast,
   while slot states lock at 2 s. The plan also has no design for the two ends that bypass the last set: a stall
   ending, and the tally jumping from 2 to 0.
4. **The Law 1 window test as written cannot pass.** A window's pause moves later changes against a fixed slot grid.
   The test should say "a pure function of public events and their broadcast times". The gust coupling is an input
   the field list does not declare.
5. **Internal contradictions:**
   - the repetition bound;
   - #20 against the `mus.home` duck;
   - call level against rule 3;
   - the speaker-subset rule, which is written two ways.
6. **Realism.** A horn's slur jumps between resonances rather than gliding. A 1.5 Hz bandwidth is a tuning fork's Q,
   not a wooden tube's. Identical noise on every phone combs in the call.
7. **Tonal function.** The "V → I" story is closer to an arc of register and colour than to a real dominant. Either
   establish the tonic's residue in play, or reword the claim.
8. **Re-budget the CPU from its own measurement:** 0.74 % of a core for an 8-harmonic voice, against a #23 gate that
   assumes 0.5 %.
9. **Production.**
   - Week 1 needs days for its two listening studies and the device run.
   - The listening-effort gate must survive every cut line.
   - The fallback's 9–12 recorded phrases do not fit 10-phrase bags.
10. **Listening-effort statistics.** The effort test needs a mixed model with 12–20 clip pairs, and Romanian speech.
