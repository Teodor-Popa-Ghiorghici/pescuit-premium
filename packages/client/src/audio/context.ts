/* The audio context and its lifecycle (§3.5): created lazily, unlocked on the first pointerdown
 * or keydown, suspended after 30 s hidden and resumed on return, iOS 'interrupted' counted as
 * suspended, `navigator.audioSession.type = 'ambient'` where it exists. It also knows the output
 * latency (visual impacts are delayed by it, capped at 120 ms, plus a manual A/V offset for
 * Bluetooth) and holds the two output profiles.
 */

import type { Profile } from './cuesheet.js';

/** Speaker (the default: phone and laptop speakers) and Headphones (§3.3). */
export const PROFILES: Record<Profile, { label: string; highPassHz: number; shelfHz: number; shelfDb: number; privateTier: boolean }> = {
  speaker: { label: 'Speaker', highPassHz: 150, shelfHz: 3000, shelfDb: 2, privateTier: false },
  headphones: { label: 'Headphones', highPassHz: 30, shelfHz: 3000, shelfDb: 0, privateTier: true },
};

export type AudioStatus = 'unavailable' | 'locked' | 'running' | 'suspended' | 'interrupted';

const HIDDEN_SUSPEND_MS = 30_000;
export const OUTPUT_LATENCY_CAP_MS = 120;

type Ctor = typeof AudioContext;
const ctor = (): Ctor | undefined => (typeof window === 'undefined' ? undefined : window.AudioContext ?? (window as unknown as { webkitAudioContext?: Ctor }).webkitAudioContext);

let ctx: AudioContext | null = null;
let unlocked = false;
let suspendedByUs = false;
let hiddenTimer: ReturnType<typeof setTimeout> | undefined;
let installed = false;
const listeners = new Set<() => void>();

export function audioStatus(): AudioStatus {
  if (!ctor()) return 'unavailable';
  if (!ctx || !unlocked) return ctx && ctx.state === 'running' ? 'running' : 'locked';
  const s = ctx.state as string;
  return s === 'running' ? 'running' : s === 'interrupted' ? 'interrupted' : 'suspended';
}

/** subscribe for the "tap for sound" tab: it shows while the status is not 'running' */
export function onAudioStatus(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
const emit = (): void => listeners.forEach((l) => l());

/** ambient: mixes with other audio and follows the silent switch (Safari 16.4+) */
function setAmbient(): void {
  try {
    const s = (navigator as unknown as { audioSession?: { type: string } }).audioSession;
    if (s) s.type = 'ambient';
  } catch {
    /* not supported */
  }
}

/** The shared context, created on first use. */
export function getContext(): AudioContext | null {
  const C = ctor();
  if (!C) return null;
  if (!ctx) {
    setAmbient();
    try {
      ctx = new C({ latencyHint: 'interactive' });
    } catch {
      return null;
    }
    ctx.onstatechange = emit;
  }
  return ctx;
}

/** resume() is only honoured inside a gesture; called from the unlock listeners */
export function unlock(): void {
  const c = getContext();
  if (!c) return;
  suspendedByUs = false;
  const done = () => {
    unlocked = c.state === 'running' || unlocked;
    emit();
  };
  if (c.state !== 'running') void c.resume().then(done, done);
  else done();
}

let gestureHook: (() => void) | undefined;
/** something to run inside the first gesture (the engine builds its chain there) */
export function onGesture(fn: () => void): void {
  gestureHook = fn;
}

/** Installs the unlock and lifecycle listeners once. */
export function installLifecycle(): void {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  const gesture = () => {
    unlock();
    gestureHook?.();
    if (ctx && ctx.state === 'running') {
      for (const t of ['pointerdown', 'keydown', 'touchend']) window.removeEventListener(t, gesture, true);
    }
  };
  for (const t of ['pointerdown', 'keydown', 'touchend']) window.addEventListener(t, gesture, { capture: true, passive: true });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      hiddenTimer = setTimeout(() => {
        if (ctx && ctx.state === 'running') {
          suspendedByUs = true;
          void ctx.suspend().then(emit);
        }
      }, HIDDEN_SUSPEND_MS);
    } else {
      if (hiddenTimer) clearTimeout(hiddenTimer);
      hiddenTimer = undefined;
      // iOS may also leave the context 'interrupted' after a call or a lock: try to come back
      if (ctx && (suspendedByUs || (ctx.state as string) === 'interrupted')) {
        suspendedByUs = false;
        void ctx.resume().then(emit, emit);
      }
    }
  });
}

/** the output latency in ms where the browser exposes it (capped at 120 ms) */
export function outputLatencyMs(): number {
  if (!ctx) return 0;
  const l = (ctx.outputLatency ?? 0) * 1000;
  return Math.min(OUTPUT_LATENCY_CAP_MS, Math.max(0, Number.isFinite(l) ? l : 0));
}

/** How long visual impacts should wait so they land with the sound: the output latency plus the
 * player's manual A/V offset (positive = later pictures; for Bluetooth). */
export function visualDelayMs(manualOffsetMs = 0): number {
  return Math.max(0, outputLatencyMs() + manualOffsetMs);
}

/**
 * Seat panning (§3.5): desktop stereo and headphones. A phone's speaker is one point, so phones rely on
 * signatures - unless headphones mode is on: whatever the pointer, headphones are stereo.
 */
export function seatPanning(profile: Profile, coarsePointer: boolean): boolean {
  return profile === 'headphones' || !coarsePointer;
}

export function panningAvailable(profile: Profile = 'speaker'): boolean {
  let coarse = false;
  try {
    coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
  } catch {
    /* no media queries: treat as a fine pointer */
  }
  return seatPanning(profile, coarse);
}
