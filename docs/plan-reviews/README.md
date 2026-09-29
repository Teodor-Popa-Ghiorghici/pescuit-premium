# Critic reviews of `FEEL_VISUAL_SOUND_PLAN.md`

The plan was scored by a separate agent briefed as a very harsh AAA game designer:
1 = unusable, 6 = passable, 8.5 = AAA quality. The brief was to rewrite the plan,
up to three times, until it scored 8.5 or higher. Each report is here verbatim.

| Round | Plan | Commit | Score | Report |
|---|---|---|---|---|
| 1 | v1 | `55b451f` | **6.9** | [round-1.md](round-1.md) |
| 2 | v2 | `a14d309` | **7.5** | [round-2.md](round-2.md) |
| 3 | v3 | `f15a0ea` | **7.5** | [round-3.md](round-3.md) |
| 4 | v4 | `cde59fa` | **8.2** | [round-4.md](round-4.md) |

**Outcome: 8.2 after the third and final rewrite — below the 8.5 target.** The
plan in the repository is v4, exactly as scored.

## What stands between v4 and 8.5

Round 4 found every round-3 must-fix resolved and ranked three new ones. The first
two were confirmed against the code before this log was written.

1. **The tally of sets still possible — the plan's one clock — claims more than
   its maths gives.**
   - In Mode Deschis a used power set turns face down (`engine.ts:954`), and
     the public check reads ranks only from face-up sets. So the count can rise,
     and it can differ from the omniscient count. That makes v4's "only falls"
     and "identical in Mode Deschis" false.
   - "The last set is always announced" was observed in bot games, not proven.
   - The count is an upper bound, yet its labels ("încă 9 seturi", "ultimul
     set") read as promises. A game that stalls announces its last set and never
     lays it.
   - The stall ending gets no design of its own, although with random bots it
     ends most games.
2. **An absent player's turn is undefined.** The mocks show "Elena e plecată —
   tura trece" (Elena is away, the turn passes), which STATE_MACHINE.md
   (lines 246–252) rejects: the room waits rather than inventing a forced pass.
   The plan must decide between a turn timer with an auto-pass and a visible "the
   table waits", and the mocks must follow.
3. **The confusability claims outrun the check.** Two pairs share a rhythm and
   fall under the seat-step bar, and escape only because the check compares cues
   moment by moment. "The only three-onset figure in the game" is false by the
   harness's own table.

## Status of item 1 after M0 (engine side)

The Deschis defect is fixed in the engine: a laid set's rank counts as public when the set is
face up **or the game is in Mode Deschis**, so the count no longer forgets a rank the table
already knows, never rises, and equals the omniscient count in Deschis (property test over
seeded bot games; `packages/engine/test/endCheckProperty.test.ts`). It is still an upper bound
in both modes, so "at most k sets" wording (`game.setsAtMost*`) and the stall ending's design
remain client work; "the last set is always announced" is still an observation, not a
guarantee. Item 2 (an absent player's own turn) is unchanged: the room waits. See
`DECISIONS.md`, "Deciding the game" and "Absent players".

