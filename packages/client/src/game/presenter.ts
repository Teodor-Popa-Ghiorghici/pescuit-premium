/* presenter.ts - the presentation timeline (§4.2). One per page, fed by the store with every server
 * message in the order it arrived. It never decides anything: `choreograph` (pure) turns a step into
 * beats, and this plays them - on two lanes, against the DOM - and hands the step's cues and
 * haptics to the audio engine on its lookahead clock, aligned to the visual beats.
 *
 *  - Logic and input read the view the instant it arrives; only pixels wait. An arriving card, the
 *    totem, a plank, a laid set, the podium are masked until their beat lands (cards: at most 800 ms);
 *    a departing card is drawn as a ghost until it takes off.
 *  - The table lane plays in order; hud and log play in parallel. A beat anchored to `arrival` starts
 *    when the message arrives (a plank must never wait behind a flight), the rest when the table is free.
 *  - More than 1.2 s queued: 1.5x with each cue's short variant. More than 2.5 s (or a hidden tab):
 *    flush to the end state and play only the last landing.
 *  - A snapshot (a rejoin) never replays choreography: it only re-syncs.
 *  - Reduced motion: order kept, travel instant; no hit-stop, shake or impact frame. Audio unchanged.
 */
import type { RedactedView } from '@pescuit/engine';
import type { WireEvent } from '@pescuit/shared';
import { rankName, t as tr, type Locale } from '@pescuit/shared';
import { LEAD_ACCENT, POWER_ACCENT } from '../art/accent.js';
import { SPRITE_SIZE } from '../art/sprites.js';
import { clockTarget, darkStepOf, metaCue } from '../audio/cues.js';
import { getEngine } from '../audio/engine.js';
import { playHaptics } from '../audio/haptics.js';
import { prefersReducedMotion, stamp } from '../motion.js';
import { choreograph, TIME, type Anchor, type Beat, type Callout, type Choreography, type Flight, type Mask, type Op } from './choreography.js';
import { announce } from './announce.js';
import { metrics } from './metrics.js';
import { getTableSpeed } from './presentationSettings.js';
import { factsOf, publicViewOf, recordOf } from './record.js';
import { Stage, hash01, type Box } from './stage.js';
import { lightOf, stageChanged, worldStage } from './world.js';

export interface Message {
  view: RedactedView;
  events: readonly WireEvent[];
  snapshot: boolean;
}

/** a card in your hand may stay hidden this long, no more (§4.2) */
const CARD_MASK_CAP_MS = 800;
const BACKLOG_FAST_MS = 1200;
const BACKLOG_FLUSH_MS = 2500;

const windowKey = (v: RedactedView | null): string | null => {
  const w = v?.pendingWindow;
  if (!w) return null;
  const c = w.context as Record<string, unknown>;
  return `${w.type}:${String(c.askerId ?? '')}>${String(c.targetId ?? '')}`;
};

interface StepCtx {
  arrive: Map<string, string>;
  depart: Map<string, string>;
  stays: HTMLElement[];
  /** table-lane landings not yet done; at zero the step is at rest (answer -> rest is measured to here) */
  pending: number;
}

export class Presenter {
  readonly stage = new Stage();
  private me: string | null = null;
  private last: RedactedView | null = null;
  private tableFreeAt = 0;
  private timers = new Map<ReturnType<typeof setTimeout>, (() => void) | null>();
  private masks = new Map<string, { target: Mask['target']; ref?: string }>();
  private cardMasks = new Set<string>();
  private ghosts = new Set<HTMLElement>();
  private presented: string | null = null;
  private pendingTurns = 0;
  private listeners = new Set<() => void>();
  private localClose: string | null = null;
  private poolStart = 0;
  /** consecutive bonus turns by the same player, from the public events (the totem rises along it) */
  private chain = 0;
  /** the cues handed to the engine so far this game: it seeds the variation (a public count; see PublicRecord.ordinal) */
  private ordinal = 0;
  private windowUI: { node: HTMLElement; box: DOMRect; at: number; frame: HTMLElement | null } | null = null;
  private nudge: ReturnType<typeof setTimeout> | undefined;
  private nudgeFor: string | null = null;
  /** the count the light has been set for (the world's stage follows what the table has SHOWN) */
  private shownTally: number | null = null;
  private snapshotQueued = false;
  /** the language the proclamations are written in */
  locale: Locale = 'ro';
  /** the room this table is in: the background score's seed (MUSIC_PLAN §5.1, S6) */
  private room: string | null = null;

  /* ------------------------------------------------------------- state */

  setSelf(id: string | null): void {
    this.me = id;
    this.stage.me = id;
  }

  setRoom(code: string | null): void {
    this.room = code;
  }

  /** the background score reads the public view through its own projection; the presenter only hands it over */
  private score(view: RedactedView, opts: { live: boolean; cues?: ReadonlyArray<{ id: string; at: number }> }): void {
    if (this.room) getEngine().setScore({ roomCode: this.room, view }, opts);
  }

  /** a game has just started, live (never on a rejoin or a table reached as a snapshot): the hand is dealt in (HAND_AND_TURN_PLAN #2) */
  private dealListeners = new Set<() => void>();
  /** when the last live deal happened (performance.now()): a hand mounted just after it still deals in */
  dealtAt = -1e9;
  onDeal = (cb: () => void): (() => void) => {
    this.dealListeners.add(cb);
    return () => this.dealListeners.delete(cb);
  };

  /** the seat whose turn the table has shown so far: the chrome (top bar, dock, ochre chip) follows it, the input follows the view */
  getPresented = (): string | null => this.presented;
  subscribe = (cb: () => void): (() => void) => {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  };
  private setPresented(id: string | null): void {
    if (this.presented === id) return;
    this.presented = id;
    this.listeners.forEach((l) => l());
  }

  /** nothing carries over from one game (or room) to the next */
  reset(): void {
    this.finalizeAll();
    this.last = null;
    this.tableFreeAt = 0;
    this.presented = null;
    this.poolStart = 0;
    this.localClose = null;
    this.shownTally = null;
    this.chain = 0;
    this.ordinal = 0;
    getEngine().setTurnRope(null);
    if (typeof document !== 'undefined') {
      delete document.documentElement.dataset.light;
      delete document.documentElement.dataset.stage;
    }
    this.listeners.forEach((l) => l());
    getEngine().setAnswerWindow(null);
  }

  /** §3.9 - the light follows the tally: --apa steps one flat step darker at 12, 6 and 1 sets still possible.
   *  It is set when the notch that took the count there has been knocked out (a step's `notch` op), or at once
   *  when nothing is being knocked (a rejoin, the first look, a step without a lay). */
  private setStage(possible: number | null, ended: boolean): void {
    const before = this.shownTally;
    this.shownTally = possible;
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    const stage = worldStage(possible, ended);
    const light = lightOf(stage);
    if (root.dataset.light !== light) root.dataset.light = light;
    if (root.dataset.stage !== stage) root.dataset.stage = stage;
    const changed = stageChanged(before, possible, ended);
    if (changed === 'evening' || changed === 'night' || changed === 'last') announce({ key: `a11y.stage.${changed}` });
  }

  /** the answering device plays `clock.close` at its press (§3.2); the presenter must not play it again */
  press(view: RedactedView | null, closeCue: boolean): void {
    metrics.pressed(performance.now());
    if (closeCue) this.localClose = windowKey(view);
    this.resetNudge();
  }

  /* ------------------------------------------------------------ timers */

  private sched(ms: number, run: () => void, final?: () => void): void {
    const id = setTimeout(() => {
      this.timers.delete(id);
      run();
    }, Math.max(0, ms));
    this.timers.set(id, final ?? null);
  }

  /** every pending beat is finished at once: the table is already correct, only the pixels catch up */
  private finalizeAll(): void {
    const finals = [...this.timers.values()];
    for (const id of this.timers.keys()) clearTimeout(id);
    this.timers.clear();
    for (const f of finals) f?.();
    this.pendingTurns = 0;
    for (const [id, m] of [...this.masks]) {
      this.stage.mask(m.target, m.ref, false);
      this.masks.delete(id);
    }
    for (const c of this.cardMasks) this.stage.maskCard(c, false);
    this.cardMasks.clear();
    for (const g of this.ghosts) g.remove();
    this.ghosts.clear();
    this.stage.clearFliers();
    this.stage.clearCallout();
  }

  /* ------------------------------------------------------------- masks */

  private addMask(id: string, m: Mask, until: number): void {
    this.masks.set(id, { target: m.target, ref: m.ref });
    this.stage.mask(m.target, m.ref, true);
    this.sched(until, () => this.releaseMask(id), () => this.releaseMask(id));
  }
  private releaseMask(id: string): void {
    const m = this.masks.get(id);
    if (!m) return;
    this.masks.delete(id);
    this.stage.mask(m.target, m.ref, false);
  }
  private releaseMasksOf(target: Mask['target'], ref?: string): void {
    for (const [id, m] of [...this.masks]) if (m.target === target && (ref === undefined || m.ref === ref)) this.releaseMask(id);
  }
  /** `landed`: the card's flight reached the hand - it is pressed in (HAND_AND_TURN_PLAN #2), not just shown */
  private releaseCard(id: string | undefined, landed = false): void {
    if (!id || !this.cardMasks.delete(id)) return;
    this.stage.maskCard(id, false);
    if (landed) this.stage.pressIn(id);
  }

  /** after every render: what React just redrew is masked again if its beat has not landed */
  afterRender(): void {
    for (const m of this.masks.values()) this.stage.mask(m.target, m.ref, true);
    for (const c of this.cardMasks) this.stage.maskCard(c, true);
    // the plank's picture for the uniform close is taken after the frame's layout, never inside the commit: measuring
    // right after React has touched the DOM forces a synchronous layout on every render (measured: 19 ms at 4x CPU)
    if (!this.snapshotQueued && typeof requestAnimationFrame === 'function') {
      this.snapshotQueued = true;
      requestAnimationFrame(() => {
        this.snapshotQueued = false;
        this.snapshotWindow();
      });
    }
  }

  /** the plank and frame as they last looked: what the uniform 220 ms close draws when they are gone */
  private snapshotWindow(): void {
    const now = performance.now();
    if (this.windowUI && now - this.windowUI.at < 250) return;
    const plank = document.querySelector<HTMLElement>('[data-plank]') ?? document.querySelector<HTMLElement>('[data-banner]');
    if (!plank) return;
    this.windowUI = { node: plank.cloneNode(true) as HTMLElement, box: plank.getBoundingClientRect(), at: now, frame: null };
  }

  private closeGhost(): void {
    const g = this.windowUI;
    this.windowUI = null;
    if (!g || g.box.width === 0) return;
    if (document.querySelector('[data-plank],[data-banner]')) return; // another window took its place: it has its own animation
    const layer = document.querySelector<HTMLElement>('[data-fliers]');
    if (!layer) return;
    const n = g.node;
    n.removeAttribute('data-masked');
    n.setAttribute('aria-hidden', 'true');
    n.classList.add('window-ghost');
    Object.assign(n.style, { position: 'fixed', left: `${g.box.left}px`, top: `${g.box.top}px`, width: `${g.box.width}px`, height: `${g.box.height}px`, margin: '0', animation: 'none', pointerEvents: 'none', zIndex: '1' });
    layer.appendChild(n);
    // the same close for every window: 220 ms, stepped
    const a = n.animate?.([{ opacity: 1, transform: 'translateY(0)' }, { opacity: 0, transform: 'translateY(28px)' }], { duration: TIME.close, easing: 'steps(3, end)', fill: 'forwards' });
    if (a) a.onfinish = () => n.remove();
    else n.remove();
  }

  /* ---------------------------------------------------------- audio world */

  /**
   * `hold` keeps the wind and the darkening step where they were: during play they turn on the beat of their own event
   * (`worldAt`, from the cues below), not when the view arrives. A first look and a rejoin set them at once.
   */
  private world(view: RedactedView, hold: { dry?: boolean; step?: boolean } = {}): void {
    const engine = getEngine();
    this.poolStart = Math.max(this.poolStart, view.poolCount);
    engine.setWorld({
      poolCount: view.poolCount,
      poolStart: Math.max(1, this.poolStart),
      scene: 'game',
      ...(hold.dry ? {} : { dry: view.poolCount <= 0 }),
      ...(hold.step ? {} : { step: darkStepOf(view.sets.possible) }),
    });
    engine.setAnswerWindow(view.status === 'ENDED' ? null : clockTarget(publicViewOf(view)));
    // the turn's rope: public, the same for every seat (HAND_AND_TURN_PLAN #5)
    const tc = view.status === 'IN_PROGRESS' ? view.turnClock : null;
    engine.setTurnRope(tc ? { key: `${view.currentPlayerId}:${tc.deadlineAt}`, deadlineAt: tc.deadlineAt, ropeMs: tc.ropeMs } : null);
  }

  /** your turn has waited 15 s: one soft knock (`meta.nudge`, §4.5) */
  private resetNudge(): void {
    clearTimeout(this.nudge);
    this.nudge = undefined;
    const v = this.last;
    if (!v || !this.me || v.status !== 'IN_PROGRESS' || v.currentPlayerId !== this.me || v.pendingWindow) return;
    const key = `${v.turnCounter}:${v.seq}`;
    this.nudgeFor = key;
    this.nudge = setTimeout(() => {
      const cur = this.last;
      if (!cur || this.nudgeFor !== key || cur.currentPlayerId !== this.me || cur.pendingWindow) return;
      getEngine().playRequests([metaCue('nudge', Math.max(0, cur.turnOrder.indexOf(this.me!)), cur.seq)]);
    }, 15_000);
  }

  /* ------------------------------------------------------------ the entry */

  present(msg: Message): void {
    const { view, events, snapshot } = msg;
    const engine = getEngine();
    const me = this.me ?? view.viewerId;
    this.stage.me = me;
    this.stage.reduced = prefersReducedMotion();
    metrics.init();
    const prev = this.last;
    const now = performance.now();

    // metrics: windows and the tally
    const pw = prev?.pendingWindow;
    const nw = view.pendingWindow;
    const desc = (v: RedactedView | null, w: NonNullable<RedactedView['pendingWindow']> | null | undefined) =>
      w && v ? { key: windowKey(v)!, answerOnMe: w.type === 'RESPONSE_PENDING' && (w.context as { targetId?: string }).targetId === me, eligible: w.youAreEligible, deadlineAt: w.deadlineAt } : null;
    metrics.view(desc(prev, pw), desc(view, nw), { before: prev?.sets.possible ?? null, after: view.sets.possible }, now);

    this.last = view;
    const live = !(snapshot || (!prev && !events.some((e) => e.type === 'GAME_STARTED')));
    // the wind and the darkening turn on the beat of the event that says so; anything else is set now
    const dryNow = live && !!prev && prev.poolCount > 0 && view.poolCount === 0 && events.some((e) => e.type === 'DREW_FROM_POOL' && e.poolEmpty);
    const stepNow = live && !!prev && darkStepOf(view.sets.possible) !== darkStepOf(prev.sets.possible);
    this.world(view, { dry: dryNow, step: stepNow });
    this.resetNudge();

    // a seat that drops or comes back: its signature, damped for the drop (public: the chips show it)
    if (prev && !snapshot) {
      view.players.forEach((p, i) => {
        const was = prev.players.find((x) => x.id === p.id);
        if (!was || p.id === me || was.connected === p.connected) return;
        engine.playRequests([metaCue(p.connected ? 'join' : 'leave', i, view.seq)]);
      });
    }

    const startsGame = events.some((e) => e.type === 'GAME_STARTED');
    if (startsGame && !snapshot && !this.stage.reduced) {
      this.dealtAt = now;
      this.dealListeners.forEach((l) => l());
    }
    if (snapshot || (!prev && !startsGame)) {
      // a rejoin, or the first look at a table already in progress: never replay choreography
      this.finalizeAll();
      this.setPresented(view.currentPlayerId);
      this.setStage(view.sets.possible, view.status === 'ENDED');
      this.tableFreeAt = 0;
      this.chain = 0;
      this.score(view, { live: false });
      return;
    }

    // the boxes of the cards that are about to leave your hand, while the page still shows them
    if (prev) {
      const nowIds = new Set(view.hand.map((c) => c.id));
      this.stage.snapshot(prev.hand.filter((c) => !nowIds.has(c.id)).map((c) => c.id));
    }
    const reduced = this.stage.reduced;
    const queued = Math.max(0, this.tableFreeAt - now);
    const hidden = typeof document !== 'undefined' && document.hidden;
    // the thresholds are in table time: a calmer table queues longer for the same backlog
    const slow = 1 / getTableSpeed();
    const flush = queued > BACKLOG_FLUSH_MS * slow || hidden;
    const fast = queued > BACKLOG_FAST_MS * slow;
    const record = recordOf(prev, view, events, view.seq, this.chain, this.ordinal);
    this.chain = record.chain ?? 0;
    const closedAnswer = prev?.pendingWindow?.type === 'RESPONSE_PENDING' && windowKey(prev) !== windowKey(view);
    const facts = factsOf(prev, view, me, { headphones: engine.headphones, closePlayedLocally: closedAnswer && this.localClose !== null && this.localClose === windowKey(prev) });
    if (closedAnswer) {
      this.localClose = null;
      metrics.answerLeft(now);
    }
    const ch = choreograph(record, facts, { speed: getTableSpeed() * (fast ? 1.5 : 1), short: fast, flush, reduced });
    // a backlog flush drops the beats the knock lived on: the ambience still turns, at once
    const cues = ch.beats.flatMap((b) => b.cues);
    this.ordinal += cues.length;
    if (dryNow && !cues.some((c) => c.id === 'table.poolEmpty')) engine.worldAt({ dry: true });
    if (stepNow && !cues.some((c) => c.params?.step !== undefined)) engine.worldAt({ step: darkStepOf(view.sets.possible) });
    if (flush) this.finalizeAll();
    // the light: after the knock if this step knocks a notch out of the rim, otherwise now
    if (!ch.beats.some((b) => b.ops.some((o) => o.op === 'notch')) || flush) this.setStage(view.sets.possible, view.status === 'ENDED');
    metrics.step(ch.beats.map((b) => b.kind), ch.tableMs, queued, now);
    this.play(ch, prev, view, now);
  }

  /* ------------------------------------------------------------ playing */

  private play(ch: Choreography, prev: RedactedView | null, view: RedactedView, now: number): void {
    const engine = getEngine();
    const vd = engine.visualDelayMs();
    const arrival = now;
    const tableStart = Math.max(now, this.tableFreeAt);
    const originOf = (b: Beat): number => (b.anchor === 'arrival' ? arrival : tableStart);

    // your own hand: which cards arrive and which leave (private visuals; durations follow the public record)
    const prevIds = new Set(prev?.hand.map((c) => c.id) ?? []);
    const nowIds = new Set(view.hand.map((c) => c.id));
    const arriving = view.hand.filter((c) => !prevIds.has(c.id)).map((c) => c.id);
    const departing = (prev?.hand ?? []).filter((c) => !nowIds.has(c.id)).map((c) => c.id);
    const ctx: StepCtx = { arrive: new Map(), depart: new Map(), stays: [], pending: 0 };
    const landing = (): void => {
      if (--ctx.pending === 0) metrics.atRest(performance.now());
    };
    const toMe = ch.beats.flatMap((b) => b.flights.filter((f) => f.toHand).map((f) => ({ f, t: originOf(b) + f.land }))).sort((a, b) => a.t - b.t);
    toMe.forEach(({ f }, i) => arriving[i] && ctx.arrive.set(f.key, arriving[i]));
    const fromMe = ch.beats.flatMap((b) => b.flights.filter((f) => f.fromHand).map((f) => ({ f, t: originOf(b) + f.start }))).sort((a, b) => a.t - b.t);
    fromMe.forEach(({ f }, i) => departing[i] && ctx.depart.set(f.key, departing[i]));

    // arriving cards are hidden until their flight lands (never longer than 800 ms); departing ones are ghosts
    for (const [key, id] of ctx.arrive) {
      const f = toMe.find((x) => x.f.key === key)!;
      this.cardMasks.add(id);
      this.stage.maskCard(id, true);
      // the cap is in table time, like the flight it waits for: at the calm default a draw lands a third later
      const until = Math.min(f.t + vd - now, CARD_MASK_CAP_MS / getTableSpeed());
      this.sched(until, () => this.releaseCard(id, true), () => this.releaseCard(id));
    }
    if (!ch.beats.some((b) => b.flights.length) || this.stage.reduced) {
      /* nothing flies: nothing to ghost */
    } else {
      for (const [key, id] of ctx.depart) this.ghost(key, id);
    }

    const timed: Array<{ id: string; at: number }> = [];
    for (const beat of ch.beats) {
      const origin = originOf(beat);
      const lead = origin - now;
      // audio: the cues are handed to the engine's lookahead scheduler, aligned to this beat
      for (const c of beat.cues) {
        engine.play(c.id, c.params, { delayMs: lead + c.at, seed: c.seed });
        timed.push({ id: c.id, at: lead + c.at });
        // the ambience turns with the cue that marks it: the pond to wind on the last card, one flat step darker on the knock
        if (c.id === 'table.poolEmpty') engine.worldAt({ dry: true }, lead + c.at);
        if (c.params?.step !== undefined) engine.worldAt({ step: c.params.step }, lead + c.at);
      }
      if (beat.haptics.length) playHaptics(beat.haptics, lead);
      // pixels: a beat's masks, flights, effects, ops and juice
      beat.masks.forEach((m, i) => {
        const ref = m.target === 'tally' ? this.tallyRef(beat, m) : m.ref;
        this.addMask(`${beat.id}:m${i}`, { ...m, ref }, lead + vd + m.until);
      });
      for (const f of beat.flights) {
        if (beat.lane === 'table') ctx.pending++;
        this.sched(lead + vd + f.start, () => this.flight(f, ctx, origin, vd, beat.lane === 'table' ? landing : undefined), () => this.releaseCard(ctx.arrive.get(f.key)));
      }
      for (const v of beat.vfx) this.sched(lead + vd + v.at, () => this.stage.vfx(v.kind, this.stage.anchor(v.anchor, 'to'), v.size));
      for (const op of beat.ops) {
        const isTurn = op.op === 'turnLanded';
        const counts = beat.lane === 'table' && (isTurn || op.op === 'settle');
        if (isTurn) this.pendingTurns++;
        if (counts) ctx.pending++;
        this.sched(lead + vd + op.at, () => {
          if (isTurn) this.pendingTurns = Math.max(0, this.pendingTurns - 1);
          this.doOp(op);
          if (counts) landing();
        }, () => {
          if (isTurn) this.pendingTurns = Math.max(0, this.pendingTurns - 1);
          this.finalOp(op);
        });
      }
      if (beat.juice) {
        const j = beat.juice;
        this.sched(lead + vd + j.at, () => {
          if (j.hitStopMs) {
            this.stage.hitStop(j.hitStopMs);
            this.tableFreeAt += j.hitStopMs;
          }
          if (j.trauma) this.stage.addTrauma(j.trauma);
          if (j.impact) this.stage.impact();
        });
      }
      // fliers that linger (the whale's spiral) go when the beat does
      this.sched(lead + vd + beat.at + beat.dur + 60, () => {
        for (const el of ctx.stays) this.stage.remove(el);
        ctx.stays.length = 0;
      }, () => {
        for (const el of ctx.stays) this.stage.remove(el);
        ctx.stays.length = 0;
      });
    }

    // the background score: a change of chord lands on the transient of the cue that marks it (MUSIC_PLAN §4.2)
    this.score(view, { live: true, cues: timed });

    // the table lane is busy until this step has landed
    if (ch.tableMs > 0) {
      this.tableFreeAt = tableStart + ch.tableMs;
      // a step with nothing to land is at rest when its table time is up
      if (ctx.pending === 0) this.sched(this.tableFreeAt - now + vd, () => metrics.atRest(performance.now()));
    }
    // a step that moves no totem still moves the chrome along with the view
    if (!ch.beats.some((b) => b.ops.some((o) => o.op === 'turnLanded')) && this.pendingTurns === 0) this.setPresented(view.currentPlayerId);
    if (view.status === 'ENDED' && ch.podiumAt === null) this.setPresented(view.currentPlayerId);
  }

  private tallyRef(beat: Beat, _m: Mask): string | undefined {
    const n = beat.ops.find((o): o is Extract<Op, { op: 'notch' }> => o.op === 'notch');
    return n ? `${n.from}:${n.to}` : undefined;
  }

  /* ------------------------------------------------------------ flights */

  private ghost(key: string, id: string): void {
    const el = this.stage.spawn('back');
    const b = this.stage.handCardBox(id);
    if (!el || !b) return;
    this.stage.place(el, b, Stage.BASE.BACK, b.w / Stage.BASE.BACK.w);
    el.dataset.ghost = key;
    this.ghosts.add(el);
  }

  private boxFor(f: Flight, role: 'from' | 'to', a: Anchor, ctx: StepCtx): Box | null {
    const s = this.stage;
    if (f.what === 'totem') return a.k === 'seat' ? s.totemSpot(a.id) : s.anchor(a, role);
    if (f.what === 'chip' && a.k === 'seat') return role === 'to' ? s.chipSpot(a.id) : s.anchor(a, role);
    if (role === 'to' && f.toHand) return s.handCardBox(ctx.arrive.get(f.key)) ?? s.anchor(a, role);
    if (role === 'from' && f.fromHand) return s.handCardBox(ctx.depart.get(f.key)) ?? s.anchor(a, role);
    if (f.what === 'back' && a.k === 'seat') return s.fanBox(a.id) ?? s.anchor(a, role);
    return s.anchor(a, role);
  }

  private flight(f: Flight, ctx: StepCtx, origin: number, vd: number, landing?: () => void): void {
    const s = this.stage;
    const from = this.boxFor(f, 'from', f.from, ctx);
    const to = this.boxFor(f, 'to', f.to, ctx);
    const landsIn = Math.max(0, origin + vd + f.land - performance.now());
    const ghost = [...this.ghosts].find((g) => g.dataset.ghost === f.key);
    const done = (el: HTMLElement | null): void => {
      this.landed(f, el, ctx);
      landing?.();
    };
    const chipKey = f.what === 'chip' && f.from.k === 'seat' ? f.key : null;
    // no room in the air, reduced motion, or nowhere to fly from or to: the flight is its landing
    // the power's embodiment always flies (it is what says what happened); cards wait for room in the air
    const cannot = !from || !to || f.instant || (f.what !== 'fx' && !s.roomInAir) || (f.from.k === 'chip' && !s.chip);
    if (cannot) {
      ghost?.remove();
      if (ghost) this.ghosts.delete(ghost);
      if (f.what === 'chip' && f.end === 'stay' && to) {
        const el = s.spawn(`chip:${f.rank ?? ''}`);
        if (el) {
          s.place(el, to, Stage.BASE.CHIP);
          s.holdChip(el, f.key);
        }
      }
      this.sched(landsIn, () => done(null));
      return;
    }
    let el: HTMLElement | null;
    let base: { w: number; h: number };
    if (f.what === 'chip') {
      base = Stage.BASE.CHIP;
      if (f.from.k === 'chip') el = s.chip;
      else {
        el = s.spawn(`chip:${f.rank ?? ''}`);
        if (chipKey) s.releaseChip(0);
      }
    } else if (f.what === 'totem') {
      base = Stage.BASE.TOTEM;
      el = s.spawn('totem');
    } else if (f.what === 'fx' && f.sprite) {
      base = SPRITE_SIZE[f.sprite];
      el = s.spawn(`sprite:${f.sprite}`);
    } else {
      base = Stage.BASE.BACK;
      el = ghost ?? s.spawn('back');
      if (ghost) this.ghosts.delete(ghost);
    }
    if (!el) {
      this.sched(landsIn, () => done(null));
      return;
    }
    if (f.mirror) {
      const inner = el.querySelector<HTMLElement>(f.what === 'fx' ? 'svg' : '.chip-token__in');
      if (inner) inner.style.transform = 'scaleX(-1)';
    }
    const dur = Math.max(1, f.land - f.start);
    const cardScale = (b: Box): number => Math.max(0.35, b.w / Stage.BASE.BACK.w);
    const scaleFrom = f.what === 'back' ? cardScale(from!) : f.scale ? f.scale[0] : 1;
    const scaleTo = f.what === 'back' ? cardScale(to!) : f.scale ? f.scale[1] : f.end === 'dive' ? 0.35 : 1;
    s.fly(el, {
      key: f.key,
      base,
      from: from!,
      to: to!,
      dur,
      byDistance: f.what === 'back',
      corner: f.corner,
      straight: f.straight,
      lift: f.lift,
      scaleFrom,
      scaleTo,
      tiltFrom: f.what === 'chip' ? (hash01(f.key) * 2 - 1) * 8 : f.what === 'fx' ? 0 : undefined,
      tiltTo: f.what === 'chip' ? -6 : f.what === 'fx' ? 0 : undefined,
      onLand: () => done(el),
    });
  }

  private landed(f: Flight, el: HTMLElement | null, ctx: StepCtx): void {
    const s = this.stage;
    this.releaseCard(ctx.arrive.get(f.key));
    switch (f.end) {
      case 'stay':
        if (el && f.what === 'chip') s.holdChip(el, f.key);
        else if (el) ctx.stays.push(el);
        break;
      case 'vanish':
      case 'dive':
      case 'press':
        if (f.what === 'chip' && f.end === 'dive') s.releaseChip(0);
        s.remove(el);
        break;
      case 'drop':
        if (!el) s.releaseChip(140); // nothing flew (reduced motion): the chip is simply done
        else {
          // the chip lies on the basin floor a moment, then is gone
          s.letGoChip();
          el.classList.remove('is-held');
          el.classList.add('is-dropped');
          s.place(el, s.anchor({ k: 'basin' }, 'to') ?? { cx: 0, cy: 0, w: 0, h: 0 }, Stage.BASE.CHIP, 1, 9);
          this.sched(700, () => s.remove(el));
        }
        break;
      case 'fade':
        if (el && typeof el.animate === 'function' && !s.reduced) {
          el.getAnimations().forEach((a) => a.commitStyles?.());
          el.getAnimations().forEach((a) => a.cancel());
          el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 160, easing: 'steps(3, end)', fill: 'forwards' }).onfinish = () => el.remove();
        } else s.remove(el);
        break;
      case 'settle':
        s.remove(el);
        if (f.what === 'totem') {
          this.releaseMasksOf('totem');
          s.bounceTotem();
        }
        break;
    }
  }

  /* --------------------------------------------------------------- ops */

  /** the end state of an op that must not be lost when a backlog is flushed */
  private finalOp(op: Op): void {
    switch (op.op) {
      case 'turnLanded':
        this.setPresented(this.last?.currentPlayerId ?? op.playerId);
        break;
      case 'podium':
        metrics.podium(performance.now());
        break;
      case 'notch':
        this.setStage(op.to, false);
        break;
      default:
        break;
    }
  }

  private doOp(op: Op): void {
    const s = this.stage;
    switch (op.op) {
      case 'wobble':
        s.wobble(op.anchor.k === 'seat' ? s.playerEl(op.anchor.id) : null);
        break;
      case 'plankRise':
        this.releaseMasksOf('plank');
        break;
      case 'closeWindow':
        this.closeGhost();
        break;
      case 'chipFlip':
        s.flipChip();
        break;
      case 'chipRelease':
        s.releaseChip(140);
        break;
      case 'settle':
        s.bounceTotem();
        break;
      case 'turnLanded':
        this.setPresented(op.playerId);
        this.releaseMasksOf('totem');
        s.bounceTotem();
        break;
      case 'ignite':
        s.ignite(op.owner, op.setId);
        break;
      case 'reveal':
        s.reveal(op.owner, op.rank);
        break;
      case 'spent':
        s.pulseSets(op.owner);
        break;
      case 'notch':
        this.releaseMasksOf('tally');
        this.setStage(op.to, false);
        s.notchDelta(op.from - op.to);
        break;
      case 'drain':
        s.drain();
        announce({ key: 'a11y.poolDry' });
        break;
      case 'press':
        this.releaseMasksOf('set', op.setId);
        s.pressSet(op.setId, op.owner);
        break;
      case 'brand':
        if (op.anchor.k === 'seat') stamp(s.playerEl(op.anchor.id));
        break;
      case 'slot':
        s.pulseSets(op.owner);
        break;
      case 'crack':
        this.releaseMasksOf('crack', op.setId);
        break;
      case 'gate': {
        s.wobble(document.querySelector('[data-gate]'));
        const ep = this.last?.endPressure;
        announce(op.open ? { key: 'a11y.gateOpens' } : { key: 'a11y.gateShuts', params: { count: ep ? Math.max(0, ep.limit - ep.misses) : 0 } });
        break;
      }
      case 'carve':
        s.carve();
        break;
      case 'podium':
        this.releaseMasksOf('podium');
        metrics.podium(performance.now());
        break;
      case 'stamp':
        stamp(document.querySelector('[data-ticker]'));
        break;
      case 'focus':
        s.focus(op.seats, op.until - op.at);
        break;
      case 'charge':
        s.charge(op.seat, POWER_ACCENT[op.rank] ?? LEAD_ACCENT, Math.max(120, TIME.windup - 20));
        break;
      case 'tether':
        s.tether(s.anchor(op.from, 'from'), s.anchor(op.to, 'to'), op.style, op.dur);
        break;
      case 'callout':
        this.callout(op.callout, op.dur);
        break;
      case 'jolt':
        s.jolt(op.anchor.k === 'seat' ? s.playerEl(op.anchor.id) : null);
        break;
      case 'scorePop':
        this.releaseMasksOf('score');
        s.scorePop(op.owner);
        break;
    }
  }

  /* ------------------------------------------------------ the proclamation */

  private nameOf(id: string | undefined): string {
    if (!id) return '';
    return this.last?.players.find((p) => p.id === id)?.name ?? id;
  }

  /** writes the proclamation in the table's language, from public facts only, and says it to the screen reader too */
  private callout(c: Callout, ms: number): void {
    const L = this.locale;
    const cards = c.cardRank ? (c.count !== undefined ? `${c.count}× ${rankName(c.cardRank, L)}` : rankName(c.cardRank, L)) : '';
    const second = c.actor && this.last ? Math.max(0, ...this.last.players.filter((p) => p.id !== c.actor).map((p) => p.score)) : 0;
    const params: Record<string, string | number> = {
      actor: this.nameOf(c.actor),
      target: this.nameOf(c.target),
      other: this.nameOf(c.other),
      cards,
      rank: c.cardRank ? rankName(c.cardRank, L) : '',
      score: c.score ?? 0,
      second: c.kind === 'lead' ? (c.count ?? second) : second,
      margin: c.margin ?? 0,
    };
    const lineKey = `callout.${c.key}.line`;
    const line = tr(L, lineKey, params);
    const isPower = c.kind === 'power' || c.kind === 'guard' || c.kind === 'miss';
    const powerName = c.rank ? rankName(c.rank, L).toUpperCase() : '';
    const title = isPower ? (c.via ? `${rankName(c.via, L).toUpperCase()} \u2192 ${powerName}` : `${powerName}!`) : tr(L, `callout.${c.key}.title`, params);
    const tpl = (sel: string): Element | null => document.querySelector(`[data-tpl="${sel}"] svg`)?.cloneNode(true) as Element | null;
    const seal = isPower && c.rank ? tpl(`chip:${c.rank}`) : tpl('sprite:crown');
    const via = c.via ? tpl(`chip:${c.via}`) : null;
    const accent = isPower ? (POWER_ACCENT[c.rank ?? ''] ?? LEAD_ACCENT) : LEAD_ACCENT;
    this.stage.callout({ kind: c.kind, title, line: line.charAt(0).toUpperCase() + line.slice(1), seal, via, accent, ms });
    announce({ key: lineKey, params });
  }
}

/** the one presenter of the page */
export const presenter = new Presenter();
