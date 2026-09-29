/* The audio engine's public surface. The UI feeds `cuesFor` from the public record, plays what
 * it returns, and starts the window clock from `clockTarget`. Nothing here is rank-named. */
export { getEngine, spawnVoice, AudioEngine } from './engine.js';
export { cuesFor, localAnswerCue, clockTarget, metaCue, SOUND_COLUMN, BEAT } from './cues.js';
export type { CueRequest, PublicRecord, PublicView, PublicEvent, PublicWindow, SeatFacts, PowerMode } from './cues.js';
export { hapticsFor, playHaptics, hapticSettings, setHapticSettings, hapticsSupported, vibrate } from './haptics.js';
export { CUES, cueDef, BUSES, type CueDef, type CueId } from './cuesheet.js';
export { loadRendered, preloadRendered } from './bank.js';
export { tickPlan, ServerClock, WindowClock, CLOCK_T_MS } from './clock.js';
export { onAudioStatus, audioStatus, visualDelayMs, installLifecycle } from './context.js';
export type { AudioSettings } from './mixer.js';
