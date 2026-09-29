/* The voice pool (§3.5): a global cap of 14, per-bus caps, per-cue instance caps and cooldowns,
 * and priority stealing - Clock > Power > Table > UI > Ambience by the sheet's `prio`; the oldest
 * voice of the lowest priority is stolen. Pure bookkeeping in seconds of audio-context time, so
 * it is testable without any audio. */

import { BUSES, GLOBAL_VOICES, type BusName, type CueDef } from './cuesheet.js';

export interface Voice {
  id: number;
  cue: string;
  bus: BusName;
  prio: number;
  startedAt: number;
  endsAt: number;
  /** silences the voice (a short fade, then disconnect); set by the engine */
  stop?: () => void;
}

export type Admission =
  | { ok: true; id: number; steal: Voice[] }
  | { ok: false; reason: 'cooldown' | 'priority' };

export class VoicePool {
  private voices: Voice[] = [];
  private lastStart = new Map<string, number>();
  private nextId = 1;

  constructor(private readonly globalCap = GLOBAL_VOICES) {}

  private prune(now: number): void {
    this.voices = this.voices.filter((v) => v.endsAt > now);
  }

  active(now: number): Voice[] {
    this.prune(now);
    return this.voices.slice();
  }

  count(now: number, bus?: BusName): number {
    return this.active(now).filter((v) => !bus || v.bus === bus).length;
  }

  /** Decides whether `def` may start at `now` for `dur` seconds, and who it steals from. */
  admit(def: CueDef, now: number, dur: number): Admission {
    this.prune(now);
    const last = this.lastStart.get(def.id);
    if (def.cooldownMs > 0 && last !== undefined && now - last < def.cooldownMs / 1000 - 1e-6) return { ok: false, reason: 'cooldown' };

    const steal: Voice[] = [];
    const live = () => this.voices.filter((v) => !steal.includes(v));
    const oldestLowest = (from: Voice[]): Voice | undefined => from.reduce<Voice | undefined>((a, v) => (!a || v.prio < a.prio || (v.prio === a.prio && v.startedAt < a.startedAt) ? v : a), undefined);

    // the cue's own instance cap: the oldest of the same cue makes room
    const same = live().filter((v) => v.cue === def.id);
    if (same.length >= def.inst) steal.push(same.reduce((a, v) => (v.startedAt < a.startedAt ? v : a)));

    // the bus cap
    const inBus = live().filter((v) => v.bus === def.bus);
    if (inBus.length >= BUSES[def.bus].voices) {
      const victim = oldestLowest(inBus);
      if (!victim || victim.prio > def.prio) return { ok: false, reason: 'priority' };
      steal.push(victim);
    }

    // the global cap
    const all = live();
    if (all.length >= this.globalCap) {
      const victim = oldestLowest(all);
      if (!victim || victim.prio > def.prio) return { ok: false, reason: 'priority' };
      steal.push(victim);
    }

    const id = this.nextId++;
    this.voices = live().concat({ id, cue: def.id, bus: def.bus, prio: def.prio, startedAt: now, endsAt: now + dur });
    this.lastStart.set(def.id, now);
    for (const v of steal) v.stop?.();
    return { ok: true, id, steal };
  }

  /** attaches the engine's stop handle to an admitted voice */
  attach(id: number, stop: () => void): void {
    const v = this.voices.find((x) => x.id === id);
    if (v) v.stop = stop;
  }

  clear(): void {
    for (const v of this.voices) v.stop?.();
    this.voices = [];
  }
}
