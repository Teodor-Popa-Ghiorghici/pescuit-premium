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

/** Renders every keyed buffer now (the waiting room, on idle). Returns the milliseconds spent. */
export async function preloadRendered(): Promise<number> {
  await loadRendered();
  const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
  for (const k of catalog!.KEYS) rendered(k);
  return (typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0;
}
