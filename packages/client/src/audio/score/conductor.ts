/* conductor.ts - the score's decisions, on server time, with no Web Audio (MUSIC_PLAN §4.2, §5.2). It keeps the public
 * history, follows the hum's state as the table presents it, and turns the plan into timed messages for the synth. The
 * Score (index.ts) maps those times onto the audio clock; the tests and the harness drive a conductor directly, which is
 * how six clients' schedules are compared (the agreement test).
 *
 * Two timebases, on purpose:
 *   - a change of chord lands on the transient of the table cue that marks it (a darkening knock, the miss that shuts the
 *     gate, the last lay's stamp) - on PRESENTATION time, like the knock itself;
 *   - a far call starts on SERVER time, so every client in a call plays the same phrase at the same moment. A slot whose
 *     chord has not been cut yet on this client (a backlogged table) waits up to 3 s for the cut, then gives up (D-g).
 */

import type { Profile } from '../cuesheet.js';
import type { ScoreInput } from './input.js';
import { lengthOf, phraseById, TAKES } from './phrases.js';
import { cutOf, endedAtOf, pansOf, planSlots, snapshotOf, stateOf, type ScoreHistory, type Slot, type Snapshot } from './plan.js';
import type { ScoreNote, SynthMessage } from './synth.js';
import { ANSWER_DB, ANSWER_LP_HZ, ANSWER_REPEATS, CALL_LP_HZ, CALL_MS, CUT_S, DEFER_MS, FADE_S, HUM, POST_AFTER_MS, SWELL_S, type ScoreState } from './voicing.js';

export type { ScoreMode } from './levels.js';
import type { ScoreMode } from './levels.js';

/** a message for the synth at a server time. `aligned` messages leave the speaker at that server time (the audio clock
 *  is offset by the output latency); the rest follow the table's presentation, like the knock they sit on. */
export interface TimedMessage {
  atMs: number;
  aligned: boolean;
  msg: SynthMessage;
}

export interface Played {
  slot: number;
  atMs: number;
  phrase: string;
  take: number;
  kind: 'call' | 'answer';
}

const SILENT: readonly ScoreState[] = ['call', 'finale'];
const LOBBY_STATES: readonly ScoreState[] = ['lobby', 'post'];
const dbToLin = (d: number): number => 10 ** (d / 20);

export interface ConductorOptions {
  profile: Profile;
  mode: ScoreMode;
  /** stereo placement (headphones, not mono) */
  stereo: boolean;
  /** the per-client grain of the hum's noise (never a game input) */
  salt: number;
}

export class ScoreConductor {
  history: ScoreHistory | null = null;
  /** the state the hum is heading for (after the last scheduled change) */
  target: ScoreState | null = null;
  /** the hum's changes, in server ms, as scheduled on this client: what is presented when */
  cuts: Array<{ atMs: number; state: ScoreState }> = [];
  /** what this client played: the agreement test compares it */
  readonly played: Played[] = [];
  private posted = new Set<number>();
  private endedAt: number | null = null;

  constructor(public o: ConductorOptions) {}

  /** may the score sound in this state, in this mode? */
  allowed(state: ScoreState): boolean {
    if (this.o.mode === 'off') return false;
    if (this.o.mode === 'lobby') return LOBBY_STATES.includes(state);
    return true;
  }

  private humMessage(state: ScoreState | null, atMs: number, rampS: number): TimedMessage {
    const partials: Array<[number, number]> = state && this.allowed(state) ? HUM[state][this.o.profile].map(([p, d]) => [p, dbToLin(d)] as [number, number]) : [];
    return { atMs, aligned: false, msg: { type: 'hum', frame: 0, partials, rampS } };
  }

  /** the state the hum is presenting at server time t */
  presentedAt(t: number): ScoreState | null {
    let s: ScoreState | null = null;
    for (const c of this.cuts) if (c.atMs <= t) s = c.state;
    return s;
  }

  private latest(): Snapshot | null {
    const s = this.history?.snapshots;
    return s && s.length ? s[s.length - 1] : null;
  }

  private stateNow(t: number): ScoreState | null {
    const s = this.latest();
    return s && this.history ? stateOf(s, this.history.zero, t, this.endedAt) : null;
  }

  /** how a change of state sounds: a swell from silence, a cut on a knock, a longer fade out of the waiting room */
  private rampFor(from: ScoreState | null, to: ScoreState, rejoin: boolean): number {
    const silentFrom = from === null || SILENT.includes(from) || !this.allowed(from);
    const silentTo = SILENT.includes(to) || !this.allowed(to);
    if (silentTo) return from === 'lobby' || from === 'post' ? 1 : CUT_S;
    if (rejoin) return SWELL_S.rejoin;
    if (silentFrom) return to === 'dusk' ? SWELL_S.dusk : to === 'post' ? SWELL_S.post : to === 'lobby' ? SWELL_S.lobby : SWELL_S.rejoin;
    return CUT_S;
  }

  private change(to: ScoreState, atMs: number, rejoin: boolean): TimedMessage[] {
    const from = this.target;
    this.target = to;
    this.cuts.push({ atMs, state: to });
    if (this.cuts.length > 64) this.cuts.splice(0, this.cuts.length - 64);
    const out = [this.humMessage(to, atMs, this.rampFor(from, to, rejoin))];
    if (!rejoin && from !== null) out.push({ atMs, aligned: false, msg: { type: 'cut', frame: 0 } });
    return out;
  }

  /**
   * A new public broadcast. `live` steps carry the step's cues (ms from now, as the table will present them): a change of
   * state lands on its named cue. A first look, a rejoin or a tab coming back swells into the current state instead.
   */
  update(input: ScoreInput, opts: { nowMs: number; live: boolean; cues?: ReadonlyArray<{ id: string; at: number }> }): TimedMessage[] {
    const out: TimedMessage[] = [];
    // no zero, no clock: a source that does not say when its game started (an old server, a fixture) has no score
    if (input.zero <= 0 || input.at <= 0) return out;
    if (!this.history || this.history.zero !== input.zero || this.history.seed !== input.seed) {
      this.history = { seed: input.seed, zero: input.zero, snapshots: [] };
      this.posted.clear();
      this.endedAt = null;
      out.push({ atMs: opts.nowMs, aligned: false, msg: { type: 'seed', seed: input.seed, zero: input.zero, salt: this.o.salt } });
    }
    const snap = snapshotOf(input);
    const list = this.history.snapshots as Snapshot[];
    const last = list[list.length - 1];
    if (!last || snap.at >= last.at) list.push(snap);
    else {
      // a broadcast older than one already held (it cannot happen on one socket, but a rejoin's snapshot might): in order
      const k = list.findIndex((s) => s.at > snap.at);
      list.splice(k, 0, snap);
    }
    if (list.length > 400) list.splice(1, list.length - 400); // keep the first (the zero's) and the recent past
    if (this.endedAt === null) this.endedAt = endedAtOf(this.history);
    const to = this.stateNow(opts.nowMs);
    if (to === null) return out;
    if (to !== this.target) {
      if (opts.live && this.target !== null) {
        const c = cutOf(this.target, to, opts.cues ?? []);
        out.push(...this.change(to, opts.nowMs + c.at, false));
      } else out.push(...this.change(to, opts.nowMs, true));
    }
    return out;
  }

  /** the player changed the switch, the profile or the placement: the hum re-voices (a short swell, or silence) */
  configure(patch: Partial<ConductorOptions>, nowMs: number): TimedMessage[] {
    const was = this.o;
    this.o = { ...this.o, ...patch };
    if (was.mode === this.o.mode && was.profile === this.o.profile) return [];
    if (this.target === null) return [];
    const wasOn = this.allowedWith(was.mode, this.target);
    const isOn = this.allowed(this.target);
    if (!isOn) return [{ atMs: nowMs, aligned: false, msg: { type: 'silence', frame: 0, rampS: 0.5 } }];
    return [this.humMessage(this.target, nowMs, wasOn ? CUT_S * 4 : SWELL_S.rejoin)];
  }

  private allowedWith(mode: ScoreMode, state: ScoreState): boolean {
    return mode === 'on' ? true : mode === 'lobby' ? LOBBY_STATES.includes(state) : false;
  }

  /** a rejoin or a tab coming back: swell into the current state, drop nothing already decided */
  resume(nowMs: number): TimedMessage[] {
    if (this.target === null) return [];
    return [this.humMessage(this.target, nowMs, SWELL_S.rejoin)];
  }

  /**
   * Everything due in [now, now + horizon): the hum's time-driven changes (the call ending into dusk, the podium into the
   * waiting room's voicing) and the far calls of the slots that fall there.
   */
  tick(nowMs: number, horizonMs: number): TimedMessage[] {
    const h = this.history;
    if (!h) return [];
    const out: TimedMessage[] = [];
    // time-driven changes of state: the latest broadcast, read at a later time
    const ahead = this.stateNow(nowMs + horizonMs);
    if (ahead !== null && ahead !== this.target && this.target !== null) {
      const boundary = this.target === 'call' ? h.zero + CALL_MS : this.target === 'finale' && this.endedAt !== null ? this.endedAt + POST_AFTER_MS : nowMs;
      out.push(...this.change(ahead, Math.max(nowMs, boundary), false));
    }
    for (const slot of planSlots(h, nowMs - 200, nowMs + horizonMs)) {
      if (this.posted.has(slot.i)) continue;
      this.posted.add(slot.i);
      out.push(...this.playSlot(slot));
    }
    if (this.posted.size > 256) {
      const keep = [...this.posted].sort((a, b) => b - a).slice(0, 64);
      this.posted = new Set(keep);
    }
    return out;
  }

  private playSlot(slot: Slot): TimedMessage[] {
    if (!slot.active || !slot.phrase || !this.allowed(slot.state)) return [];
    if (this.o.profile === 'speaker' && !slot.speaker) return [];
    const call = phraseById(slot.phrase);
    if (!call) return [];
    let at = slot.t;
    if (this.presentedAt(at) !== slot.state) {
      // the chord this slot belongs to has not been cut here yet: wait for the cut, a little, or let the slot go (D-g)
      const cut = this.cuts.find((c) => c.state === slot.state && c.atMs > at && c.atMs <= at + DEFER_MS);
      if (!cut) return [];
      at = cut.atMs + FADE_S * 1000;
    }
    const seed = this.history!.seed;
    const pans = pansOf(seed);
    const out: TimedMessage[] = [this.phrase(call.notes, slot.take, at, { gainDb: 0, lpHz: CALL_LP_HZ, pan: this.o.stereo ? pans.near : 0, seed: seed ^ (slot.i * 2 + 1), tag: slot.i, repeats: false })];
    this.played.push({ slot: slot.i, atMs: at, phrase: call.id, take: slot.take, kind: 'call' });
    const ans = slot.answer;
    if (ans && (this.o.profile === 'headphones' || ans.speaker)) {
      const a = phraseById(ans.id);
      if (a) {
        const lastBegins = (lengthOf(call.notes) - call.notes[call.notes.length - 1].d) * 1000;
        const aAt = at + lastBegins + ans.delayS * 1000;
        out.push(this.phrase(a.notes, ans.take, aAt, { gainDb: ANSWER_DB, lpHz: ANSWER_LP_HZ, pan: this.o.stereo ? pans.far : 0, seed: seed ^ (slot.i * 2 + 2), tag: slot.i, repeats: this.o.profile === 'headphones' }));
        this.played.push({ slot: slot.i, atMs: aAt, phrase: a.id, take: ans.take, kind: 'answer' });
      }
    }
    return out;
  }

  private phrase(notes: readonly ScoreNote[], take: number, atMs: number, p: { gainDb: number; lpHz: number; pan: number; seed: number; tag: number; repeats: boolean }): TimedMessage {
    const tk = TAKES[take % TAKES.length];
    return {
      atMs,
      aligned: true,
      msg: {
        type: 'phrase', frame: 0, notes: notes.map((n) => ({ ...n })), scoopCents: tk.scoopCents, sagScale: tk.sagScale, extraTrimMs: tk.extraTrimMs,
        gain: dbToLin(p.gainDb), lpHz: p.lpHz, pan: p.pan, lipDb: -26, wobble: 0.6, repeats: p.repeats ? ANSWER_REPEATS.map((r) => ({ ...r })) : [], seed: p.seed >>> 0, tag: p.tag,
      },
    };
  }
}
