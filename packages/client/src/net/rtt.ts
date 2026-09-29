/* The ping round trip (§3.10, A14). The client pings on every socket open and every 5 s while it is
 * open; the server echoes the sender's clock in `pong.t`, so each pong is one measurement. The result
 * goes to the engine's `ServerClock.setRtt`, which halves it when it corrects the window clock's offset.
 * A pong without an echo (an older server) is measured against the last ping sent. */
import type { ClientMessage, ServerMessage } from '@pescuit/shared';

export const PING_EVERY_MS = 5000;

export interface RttProbeOptions {
  /** puts a message on the wire if the socket is open (a closed socket must not queue pings) */
  send: (msg: ClientMessage) => void;
  now: () => number;
  /** one measured round trip, ms */
  onRtt: (ms: number) => void;
  everyMs?: number;
}

export class RttProbe {
  private timer: ReturnType<typeof setInterval> | undefined;
  private lastSent: number | null = null;

  constructor(private readonly o: RttProbeOptions) {}

  /** ping now (the socket just opened, or the timer fired) */
  ping(): void {
    const t = this.o.now();
    this.lastSent = t;
    this.o.send({ type: 'ping', t });
  }

  /** feed every server message; pongs are measured, everything else ignored */
  onMessage(msg: ServerMessage): void {
    if (msg.type !== 'pong') return;
    const sent = typeof msg.t === 'number' ? msg.t : this.lastSent;
    if (sent === null) return;
    const rtt = this.o.now() - sent;
    if (Number.isFinite(rtt) && rtt >= 0) this.o.onRtt(rtt);
  }

  start(): void {
    this.stop();
    this.timer = setInterval(() => this.ping(), this.o.everyMs ?? PING_EVERY_MS);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
  }
}
