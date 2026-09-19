/* The design calls for sound at three moments — the press of a stamp, the knock of
 * the totem landing, the splinter of a destroyed set — and for a Sunet toggle in the
 * table header. No audio was shipped with the spec, so these are synthesised: short
 * filtered noise bursts and a wooden body resonance, which is close enough to a block
 * being struck and costs nothing to download.
 *
 * §6.6: sound is deliberately *not* disabled by prefers-reduced-motion. A player who
 * turns motion off still deserves the feedback.
 */

export type Cue = 'stamp' | 'knock' | 'splinter' | 'chime';

const STORAGE_KEY = 'pescuit:sound';

let ctx: AudioContext | null = null;
let enabled = load();

function load(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== 'off';
  } catch {
    return true;
  }
}

export function soundEnabled(): boolean {
  return enabled;
}

export function setSoundEnabled(on: boolean): void {
  enabled = on;
  try {
    localStorage.setItem(STORAGE_KEY, on ? 'on' : 'off');
  } catch {
    /* private mode — the toggle still works for this session */
  }
}

function audio(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!ctx) ctx = new Ctor();
  // Browsers start the context suspended until a gesture; every cue follows one.
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

/** A short burst of noise — the grain of the strike. */
function noise(ac: AudioContext, at: number, duration: number, freq: number, q: number, gain: number) {
  const frames = Math.max(1, Math.floor(ac.sampleRate * duration));
  const buffer = ac.createBuffer(1, frames, ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < frames; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
  const src = ac.createBufferSource();
  src.buffer = buffer;
  const filter = ac.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = freq;
  filter.Q.value = q;
  const amp = ac.createGain();
  amp.gain.setValueAtTime(gain, at);
  amp.gain.exponentialRampToValueAtTime(0.0001, at + duration);
  src.connect(filter).connect(amp).connect(ac.destination);
  src.start(at);
  src.stop(at + duration);
}

/** The body of the block, ringing briefly under the strike. */
function body(ac: AudioContext, at: number, freq: number, duration: number, gain: number) {
  const osc = ac.createOscillator();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(freq, at);
  osc.frequency.exponentialRampToValueAtTime(freq * 0.6, at + duration);
  const amp = ac.createGain();
  amp.gain.setValueAtTime(gain, at);
  amp.gain.exponentialRampToValueAtTime(0.0001, at + duration);
  osc.connect(amp).connect(ac.destination);
  osc.start(at);
  osc.stop(at + duration);
}

export function play(cue: Cue): void {
  if (!enabled) return;
  const ac = audio();
  if (!ac) return;
  const t = ac.currentTime;
  switch (cue) {
    case 'stamp': // ink meeting paper: dry, damped, no ring
      noise(ac, t, 0.05, 1800, 1.2, 0.18);
      body(ac, t, 180, 0.07, 0.1);
      return;
    case 'knock': // the totem landing on a post
      noise(ac, t, 0.035, 2600, 2, 0.14);
      body(ac, t, 320, 0.13, 0.16);
      return;
    case 'splinter': // a set destroyed — three cracks, not one
      noise(ac, t, 0.07, 1400, 0.8, 0.2);
      noise(ac, t + 0.045, 0.06, 2300, 1.4, 0.15);
      noise(ac, t + 0.1, 0.09, 900, 0.7, 0.13);
      return;
    case 'chime': // a power granted
      body(ac, t, 660, 0.18, 0.1);
      body(ac, t + 0.06, 990, 0.22, 0.07);
      return;
  }
}

/** Haptics travel with the sound where the device has them (§6.6). */
export function buzz(ms = 12): void {
  if (!enabled) return;
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* not supported */
  }
}
