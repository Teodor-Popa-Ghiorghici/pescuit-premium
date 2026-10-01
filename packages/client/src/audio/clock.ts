/* The window clock (§3.10), bound to the server's deadline. The answer window has no open cue -
 * the ask's landing is the opening. Silence follows until T seconds remain (T = 5 s, to be re-set
 * from playtest 1's answer times), then a click each second (`clock.tick`), then a double click
 * every 500 ms in the last 3 s (`clock.tick.urgent`): urgency is rhythm and density, not pitch.
 * `clock.close` is NOT this module's business: it sounds when RESPONSE_PENDING leaves the view
 * (cues.ts), on the answering device at its press. Every other window is silent (§3.2).
 *
 * `ServerClock` keeps the offset between the server's clock and ours: the minimum of the last
 * five `serverNow - localNow` samples, corrected by half the ping round trip. `WindowClock` walks
 * the tick plan against it from a lookahead poll (25 ms interval, 100 ms horizon) and hands
 * each due tick to `emit`, which schedules it on the audio clock.
 */

export const CLOCK_T_MS = 5000;
export const POLL_MS = 25;
export const HORIZON_MS = 100;

export type TickId = 'clock.tick' | 'clock.tick.urgent';
export type RopeTickId = 'clock.rope' | 'clock.rope.burn' | 'clock.rope.urgent' | 'clock.rope.out';
export interface Tick<Id extends string = TickId> {
  id: Id;
  /** milliseconds from the moment the window's remaining time was `remainingMs` */
  inMs: number;
  /** what remains of the window when this tick sounds, ms */
  remaining: number;
}

/**
 * The ticks of a window that has `remainingMs` left: a click at every whole second from T down to
 * (not including) 3 s, then a double click every 500 ms from 3 s to the deadline. A window that
 * opens with less than T left ticks only for the part that is left.
 */
export function tickPlan(remainingMs: number, T = CLOCK_T_MS): Tick[] {
  const ticks: Tick[] = [];
  for (let r = Math.floor(T / 1000) * 1000; r > 3000; r -= 1000) if (r <= remainingMs) ticks.push({ id: 'clock.tick', inMs: remainingMs - r, remaining: r });
  for (let r = 3000; r > 0; r -= 500) if (r <= remainingMs) ticks.push({ id: 'clock.tick.urgent', inMs: remainingMs - r, remaining: r });
  return ticks;
}

/** the rope's last stretch, ms: from here it strains twice a second */
export const ROPE_URGENT_MS = 5000;

/**
 * The turn's rope (HAND_AND_TURN_PLAN #5), as remaining values of the ask's clock: lit when `ropeMs` remain, a smoulder at
 * every whole second after that down to 5 s, a strain every 500 ms from 5 s, and the rope parting at 0.
 */
export function ropePlan(remainingMs: number, ropeMs: number): Tick<RopeTickId>[] {
  const ticks: Tick<RopeTickId>[] = [];
  const add = (id: RopeTickId, r: number) => r <= remainingMs && ticks.push({ id, inMs: remainingMs - r, remaining: r });
  add('clock.rope', ropeMs);
  for (let r = Math.ceil(ropeMs / 1000) * 1000 - 1000; r > ROPE_URGENT_MS; r -= 1000) if (r < ropeMs) add('clock.rope.burn', r);
  for (let r = Math.min(ROPE_URGENT_MS, ropeMs - 500); r > 0; r -= 500) add('clock.rope.urgent', r);
  add('clock.rope.out', 0);
  return ticks;
}

export class ServerClock {
  private samples: number[] = [];
  private rtt = 0;

  /** a `game_state` arrived carrying the server's `serverNow` (ms, epoch) at `localNow` (ms, epoch) */
  sample(serverNow: number, localNow: number): void {
    this.samples.push(serverNow - localNow);
    if (this.samples.length > 5) this.samples.shift();
  }

  /** the last measured ping round trip, ms */
  setRtt(ms: number): void {
    this.rtt = Math.max(0, ms);
  }

  /** server minus local, ms (0 until a sample arrives) */
  offset(): number {
    return this.samples.length ? Math.min(...this.samples) + this.rtt / 2 : 0;
  }

  /** the server's clock now, given the local time */
  serverNow(localNow: number): number {
    return localNow + this.offset();
  }
}

export interface WindowClockOptions<Id extends string = TickId> {
  /** the local clock, ms (epoch) */
  now: () => number;
  server: ServerClock;
  /** hands a tick to the audio scheduler, to sound `inMs` from now */
  emit: (id: Id, inMs: number) => void;
  T?: number;
  /** the ticks, as remaining values (the answer window's tickPlan by default; the rope's ropePlan for the turn) */
  plan?: () => ReadonlyArray<{ id: Id; remaining: number }>;
}

export class WindowClock<Id extends string = TickId> {
  private deadline: number | null = null;
  private key: string | null = null;
  private done = new Set<number>();
  private timer: ReturnType<typeof setInterval> | undefined;

  constructor(private readonly o: WindowClockOptions<Id>) {}

  /** Starts (or restarts, if the window changed) the clock for a window ending at `deadlineAt` (server ms). */
  start(deadlineAt: number, key = String(deadlineAt)): void {
    if (this.key === key && this.deadline !== null) return;
    this.stop();
    this.key = key;
    this.deadline = deadlineAt;
    this.done.clear();
    this.timer = setInterval(() => this.poll(), POLL_MS);
    this.poll();
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
    this.deadline = null;
    this.key = null;
    this.done.clear();
  }

  get running(): boolean {
    return this.deadline !== null;
  }

  /** Emits every tick due inside the lookahead horizon; exposed so tests can drive it. */
  poll(): void {
    if (this.deadline === null) return;
    const remaining = this.deadline - this.o.server.serverNow(this.o.now());
    // ticks sit at fixed remaining values, so compare each against what is left now
    const T = this.o.T ?? CLOCK_T_MS;
    const plan = this.o.plan ? this.o.plan() : (tickPlan(Number.MAX_SAFE_INTEGER, T) as unknown as ReadonlyArray<{ id: Id; remaining: number }>);
    for (const t of plan) {
      const due = remaining - t.remaining; // ms until this tick, from now (negative = already past)
      if (this.done.has(t.remaining)) continue;
      if (due < -HORIZON_MS) {
        this.done.add(t.remaining); // missed while nobody was looking: never sound it late
        continue;
      }
      if (due <= HORIZON_MS) {
        this.done.add(t.remaining);
        this.o.emit(t.id as Id, Math.max(0, due));
      }
    }
    if (remaining < -HORIZON_MS) this.stop();
  }
}
