/* The bank of rendered families. The renderers live in `render/catalog` and are imported
 * lazily; `loadRendered()` fetches the chunk (the waiting room calls it), `rendered(key)` builds
 * a buffer on first use and caches it, and `renderedBuffer(ctx, key)` wraps it as an
 * AudioBuffer at 32 kHz for one context. A recipe that asks before the chunk arrived plays
 * without that layer rather than waiting. */

type Catalog = typeof import('./render/catalog.js');

export const RENDER_RATE = 32000;

let catalog: Catalog | null = null;
let loading: Promise<void> | null = null;
const floats = new Map<string, Float32Array>();
const perCtx = new WeakMap<BaseAudioContext, Map<string, AudioBuffer>>();

export function loadRendered(): Promise<void> {
  loading ??= import('./render/catalog.js').then((m) => {
    catalog = m;
  });
  return loading;
}

export const renderedLoaded = (): boolean => catalog !== null;

/** The samples for a key, rendered on first use; null while the catalogue is still loading. */
export function rendered(key: string): Float32Array | null {
  const hit = floats.get(key);
  if (hit) return hit;
  if (!catalog) {
    void loadRendered();
    return null;
  }
  const built = catalog.build(key);
  if (built) floats.set(key, built);
  return built;
}

export function renderedBuffer(ctx: BaseAudioContext, key: string): AudioBuffer | null {
  let m = perCtx.get(ctx);
  if (!m) perCtx.set(ctx, (m = new Map()));
  const hit = m.get(key);
  if (hit) return hit;
  const data = rendered(key);
  if (!data) return null;
  const b = ctx.createBuffer(1, data.length, RENDER_RATE);
  b.copyToChannel(data as Float32Array<ArrayBuffer>, 0);
  m.set(key, b);
  return b;
}

export interface PreloadReport {
  keys: number;
  /** CPU milliseconds spent rendering (the work is sliced, so no single frame pays it all) */
  ms: number;
}

const now = (): number => (typeof performance !== 'undefined' ? performance.now() : Date.now());
const tick = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

/**
 * Renders the buffers the current profile will ask for, in slices of about 6 ms so no frame
 * stalls: the speaker profile plays the speaker variants and the headphones the full ones, the
 * ceremonies come last. Anything not yet rendered when a cue asks is rendered on demand.
 */
export async function preloadRendered(profile: 'speaker' | 'headphones' = 'speaker'): Promise<PreloadReport> {
  await loadRendered();
  const skip = profile === 'speaker' ? /\.full(\.|$)/ : /\.spk(\.|$)/;
  const keys = catalog!.KEYS.filter((k) => !skip.test(k));
  keys.sort((a, b) => Number(a.startsWith('end.')) - Number(b.startsWith('end.')));
  let spent = 0;
  let slice = now();
  for (const k of keys) {
    const t = now();
    rendered(k);
    spent += now() - t;
    if (now() - slice > 6) {
      await tick();
      slice = now();
    }
  }
  return { keys: keys.length, ms: spent };
}
