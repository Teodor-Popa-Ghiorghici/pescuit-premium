/* stage.ts - the presenter's hands. Everything that touches the page lives here: finding the anchors
 * the choreography names, cloning the fliers and effects out of the flight layer's templates, flying
 * them along a quadratic arc with the Web Animations API (transform and opacity only, §4.3), masking
 * and unmasking the pixels that arrive before their flight does, and the juice - hit-stop, trauma
 * shake, the impact frame - which only ever touches the table layer.
 *
 * It knows nothing of the game: no card ranks except the seal a chip is asked to bear, no view, no
 * events. It is told where to fly and when.
 */
import type { Anchor, MaskTarget, VfxKind } from './choreography.js';
import { flightMs } from './choreography.js';
import { VFX_STEP_MS, vfxMs } from '../art/vfx.js';

export interface Box {
  cx: number;
  cy: number;
  w: number;
  h: number;
}

const MAX_IN_FLIGHT = 12;
/** a card as the flier's template draws it */
const BACK = { w: 60, h: 90 };
const CHIP = { w: 46, h: 34 };
const TOTEM = { w: 20, h: 28 };

const q = <T extends Element = HTMLElement>(sel: string): T | null => (typeof document === 'undefined' ? null : document.querySelector<T>(sel));
const box = (el: Element | null | undefined): Box | null => {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return r.width === 0 && r.height === 0 ? null : { cx: r.left + r.width / 2, cy: r.top + r.height / 2, w: r.width, h: r.height };
};
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
const smooth = (t: number): number => t * t * (3 - 2 * t);

/** a deterministic 0..1 from a string */
export function hash01(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return ((h >>> 0) % 10000) / 10000;
}

export interface FlyOptions {
  key: string;
  base: { w: number; h: number };
  from: Box;
  to: Box;
  /** ms the flight may take at most; shortened by the distance rule for cards */
  dur: number;
  /** cards obey clamp(distance / 1.8, 260, 460); chips and totems fly their nominal time */
  byDistance: boolean;
  corner?: number;
  /** no lift: a straight line */
  straight?: boolean;
  scaleFrom?: number;
  scaleTo?: number;
  tiltFrom?: number;
  tiltTo?: number;
  /** ms to wait before taking off (a landing at a fixed moment: the rest of the nominal time) */
  delay?: number;
  onLand?: () => void;
}

export class Stage {
  me: string | null = null;
  reduced = false;
  /** fliers in the air right now: at most twelve (R3) */
  inFlight = 0;
  private held: { el: HTMLElement; key: string } | null = null;
  private lastImpactAt = -1e9;
  private trauma = 0;
  private shakeRaf = 0;
  private shakeLast = 0;
  private handRects = new Map<string, Box>();
  /** every WAAPI flight in the air: hit-stop pauses these without asking the document for its animations */
  private airborne = new Set<Animation>();
  private phoneShake = false;

  /* ------------------------------------------------------------ anchors */

  /** reads the page now: the caches that let a departed card or a moved totem still have an origin */
  snapshot(ids: readonly string[]): void {
    // only the cards about to leave: reading every card's box on every message forces a layout each time
    for (const id of ids) {
      const b = box(q(`[data-hand-card-id="${CSS.escape(id)}"]`));
      if (b) this.handRects.set(id, b);
    }
    if (this.handRects.size > 60) for (const k of [...this.handRects.keys()].slice(0, 30)) this.handRects.delete(k);
  }

  handCardBox(id: string | undefined): Box | null {
    if (!id) return null;
    return box(q(`[data-hand-card-id="${CSS.escape(id)}"]`)) ?? this.handRects.get(id) ?? null;
  }

  /** the resting place of your hand's cards, as a card-sized box */
  private handBox(): Box | null {
    const h = q('[data-hand]');
    const b = box(h);
    if (!b) return box(q('[data-me]'));
    const cw = parseFloat(h ? getComputedStyle(h).getPropertyValue('--cw') : '') || 100;
    return { cx: b.cx, cy: b.cy, w: cw, h: cw * 1.5 };
  }

  anchor(a: Anchor, role: 'from' | 'to'): Box | null {
    switch (a.k) {
      case 'seat': {
        if (a.id === this.me) return this.handBox();
        const b = box(q(`[data-player-id="${CSS.escape(a.id)}"]`));
        return b ? { cx: b.cx, cy: b.cy, w: 30, h: 45 } : null;
      }
      case 'pool': {
        const b = box(q('[data-pool]'));
        return b ? { cx: b.cx, cy: b.cy, w: 44, h: 66 } : null;
      }
      case 'basin':
        return box(q('[data-basin]')) ?? null;
      case 'center': {
        const b = box(q('[data-basin]')) ?? box(q('[data-pond]'));
        return b ? { cx: b.cx, cy: b.cy, w: 44, h: 66 } : null;
      }
      case 'chip':
        return this.held ? box(this.held.el) : null;
      case 'set': {
        const byId = a.id ? box(q(`[data-set-id="${CSS.escape(a.id)}"]`)) : null;
        const byOwner = byId ?? box(q(`[data-laid-owner="${CSS.escape(a.owner)}"]`));
        if (byOwner) return { cx: byOwner.cx, cy: byOwner.cy, w: Math.min(byOwner.w, 22), h: Math.min(byOwner.h, 30) };
        return this.anchor({ k: 'seat', id: a.owner }, role);
      }
      case 'tally':
        return box(q('[data-tally]'));
      case 'gate':
        return box(q('[data-gate]')) ?? box(q('[data-basin]'));
    }
  }

  playerBox(id: string): Box | null {
    return id === this.me ? box(q('[data-me]')) : box(q(`[data-player-id="${CSS.escape(id)}"]`));
  }

  /* ------------------------------------------------------------ fliers */

  private layer(): HTMLElement | null {
    return q('[data-fliers]');
  }

  spawn(template: string): HTMLElement | null {
    const layer = this.layer();
    const tpl = q(`[data-tpl="${template}"]`);
    if (!layer || !tpl) return null;
    const el = tpl.cloneNode(true) as HTMLElement;
    el.removeAttribute('data-tpl');
    el.classList.add('flier');
    el.style.opacity = '0';
    layer.appendChild(el);
    return el;
  }

  /** places a flier at a box without animating it (a chip that has landed) */
  place(el: HTMLElement, b: Box, base: { w: number; h: number }, scale = 1, tilt = 0): void {
    el.style.transform = `translate(${b.cx - base.w / 2}px, ${b.cy - base.h / 2}px) rotate(${tilt}deg) scale(${scale})`;
    el.style.opacity = '1';
  }

  /** Flies `el` from one box to another along a quadratic arc lifted 40-80 px; a hard corner for the Shark. */
  fly(el: HTMLElement, o: FlyOptions): Animation | null {
    if (typeof el.animate !== 'function') {
      this.place(el, o.to, o.base, o.scaleTo ?? 1);
      o.onLand?.();
      return null;
    }
    const dx = o.to.cx - o.from.cx;
    const dy = o.to.cy - o.from.cy;
    const dist = Math.hypot(dx, dy);
    const dur = o.byDistance ? Math.min(o.dur, flightMs(dist)) : o.dur;
    const delay = Math.max(0, (o.delay ?? 0) + (o.dur - dur));
    const r = hash01(o.key);
    const lift = o.straight ? 0 : 40 + r * 40;
    const flutter = (hash01(o.key + 'f') * 2 - 1) * 6;
    const tilt0 = o.tiltFrom ?? (hash01(o.key + 'a') * 2 - 1) * 4;
    const tilt1 = o.tiltTo ?? (hash01(o.key + 'b') * 2 - 1) * 3;
    const s0 = o.scaleFrom ?? 1;
    const s1 = o.scaleTo ?? 1;
    const frames: Keyframe[] = [];
    const at = (t: number, x: number, y: number, te: number, extra: Partial<Keyframe> = {}): void => {
      const rot = lerp(tilt0, tilt1, te) + flutter * Math.sin(Math.PI * te);
      const s = lerp(s0, s1, te);
      frames.push({ offset: t, transform: `translate(${x - o.base.w / 2}px, ${y - o.base.h / 2}px) rotate(${rot.toFixed(2)}deg) scale(${s.toFixed(3)})`, opacity: 1, ...extra });
    };
    if (o.corner !== undefined) {
      // a hard turn: the path bends sharply at `corner`, towards the side the interceptor sits
      const kx = o.from.cx + dx * o.corner + (-dy / (dist || 1)) * 44;
      const ky = o.from.cy + dy * o.corner + (dx / (dist || 1)) * 44;
      at(0, o.from.cx, o.from.cy, 0);
      at(o.corner, kx, ky, o.corner);
      at(1, o.to.cx, o.to.cy, 1);
    } else {
      const N = 10;
      const mx = (o.from.cx + o.to.cx) / 2;
      const my = (o.from.cy + o.to.cy) / 2 - 2 * lift;
      for (let i = 0; i <= N; i++) {
        const t = i / N;
        const te = smooth(t);
        const x = (1 - te) * (1 - te) * o.from.cx + 2 * (1 - te) * te * mx + te * te * o.to.cx;
        const y = (1 - te) * (1 - te) * o.from.cy + 2 * (1 - te) * te * my + te * te * o.to.cy;
        at(t, x, y, te);
      }
    }
    this.inFlight++;
    const a = el.animate(frames, { duration: Math.max(1, dur), delay, easing: 'linear', fill: 'both' });
    this.airborne.add(a);
    // elevation peaks mid-flight at --elev-3, then snaps to --elev-1
    const lifted = el.querySelector<HTMLElement>('.flier__lift');
    lifted?.animate([{ opacity: 0 }, { opacity: 1, offset: 0.5 }, { opacity: 0 }], { duration: Math.max(1, dur), delay, fill: 'both' });
    let done = false;
    const land = (): void => {
      if (done) return;
      done = true;
      this.airborne.delete(a);
      this.inFlight = Math.max(0, this.inFlight - 1);
      o.onLand?.();
    };
    a.onfinish = land;
    a.oncancel = land;
    return a;
  }

  /** can another card take to the air? (at most twelve at once) */
  get roomInAir(): boolean {
    return this.inFlight < MAX_IN_FLIGHT;
  }

  remove(el: HTMLElement | null | undefined): void {
    el?.getAnimations?.().forEach((a) => a.cancel());
    el?.remove();
  }

  clearFliers(): void {
    this.layer()?.replaceChildren();
    this.held = null;
    this.inFlight = 0;
  }

  /* ------------------------------------------------------ the arrow-chip */

  get chip(): HTMLElement | null {
    return this.held?.el ?? null;
  }
  holdChip(el: HTMLElement, key: string): void {
    this.releaseChip(0);
    this.held = { el, key };
    el.classList.add('is-held');
  }
  /** the chip stays where it is on the page, but is no longer the one the next beats act on */
  letGoChip(): void {
    this.held = null;
  }
  chipKey(): string | null {
    return this.held?.key ?? null;
  }
  releaseChip(fadeMs = 120): void {
    const h = this.held;
    this.held = null;
    if (!h) return;
    if (fadeMs > 0 && typeof h.el.animate === 'function') {
      const a = h.el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: fadeMs, fill: 'forwards' });
      a.onfinish = () => h.el.remove();
    } else h.el.remove();
  }
  /** the chip flips to its ochre face */
  flipChip(): void {
    const el = this.held?.el;
    if (!el) return;
    const inner = el.querySelector<HTMLElement>('.chip-token__in') ?? el;
    if (typeof inner.animate === 'function' && !this.reduced) {
      inner.animate([{ transform: 'scaleX(1)' }, { transform: 'scaleX(0.06)', offset: 0.45 }, { transform: 'scaleX(1)' }], { duration: 160, easing: 'steps(4, end)' });
      setTimeout(() => el.classList.add('is-yes'), 70);
    } else el.classList.add('is-yes');
  }

  /* ------------------------------------------------------------- effects */

  /** a stepped effect, centred on a box, gone when its last frame has been shown */
  vfx(kind: VfxKind, b: Box | null, sizePx = 64): void {
    if (!b) return;
    const el = this.spawn(`vfx:${kind}`);
    if (!el) return;
    el.classList.add('vfx-host');
    el.style.setProperty('--vfx-step', `${VFX_STEP_MS}ms`);
    const s = kind === 'gateDoors' ? Math.min(window.innerWidth, 420) : sizePx;
    const svg = el.querySelector('svg');
    svg?.setAttribute('width', String(s));
    svg?.setAttribute('height', String(kind === 'gateDoors' ? Math.round(s * 0.62) : s));
    const h = kind === 'gateDoors' ? s * 0.62 : s;
    el.style.transform = `translate(${b.cx - s / 2}px, ${b.cy - h / 2}px)`;
    el.style.opacity = '1';
    setTimeout(() => el.remove(), vfxMs(kind) + 60);
  }

  wobble(el: Element | null | undefined): void {
    if (!el || this.reduced || typeof (el as HTMLElement).animate !== 'function') return;
    (el as HTMLElement).animate([{ translate: '0 0' }, { translate: '-2px 0' }, { translate: '2px 0' }, { translate: '0 0' }], { duration: 160, easing: 'steps(4, end)' });
  }

  /* --------------------------------------------------------------- masks */

  private static SEL: Record<MaskTarget, (ref?: string) => string> = {
    totem: () => '[data-totem]',
    plank: () => '[data-plank]',
    set: (r) => `[data-set-id="${r ? CSS.escape(r) : ''}"]`,
    crack: (r) => `[data-set-id="${r ? CSS.escape(r) : ''}"]`,
    tally: () => '[data-tally]',
    podium: () => '[data-podium]',
  };
  private static TOKEN: Record<MaskTarget, string> = { totem: 'hide', plank: 'soft', set: 'hide', crack: 'crack', tally: 'tally', podium: 'hide' };

  private tokens(el: Element): string[] {
    return (el.getAttribute('data-masked') ?? '').split(' ').filter(Boolean);
  }
  private setTokens(el: Element, t: string[]): void {
    if (t.length) el.setAttribute('data-masked', t.join(' '));
    else el.removeAttribute('data-masked');
  }
  mask(target: MaskTarget, ref: string | undefined, on: boolean): void {
    const token = Stage.TOKEN[target];
    for (const el of document.querySelectorAll(Stage.SEL[target](ref))) {
      const t = this.tokens(el).filter((x) => x !== token);
      if (on) t.push(token);
      this.setTokens(el, t);
      if (target === 'tally') this.keepNotches(el as HTMLElement, on ? ref : undefined);
    }
  }
  /** the notches that were just knocked out stay lit until the knock: `ref` is "from:to" */
  private keepNotches(el: HTMLElement, ref: string | undefined): void {
    const notches = el.querySelectorAll('.tally__notch');
    notches.forEach((n) => n.removeAttribute('data-keep'));
    if (!ref) return;
    const [from, to] = ref.split(':').map(Number);
    notches.forEach((n, i) => {
      if (i >= to && i < from) n.setAttribute('data-keep', '');
    });
  }
  maskCard(id: string, on: boolean): void {
    const el = q(`[data-hand-card-id="${CSS.escape(id)}"]`);
    if (!el) return;
    const t = this.tokens(el).filter((x) => x !== 'hide');
    if (on) t.push('hide');
    this.setTokens(el, t);
  }

  /* --------------------------------------------------------------- juice */

  /** trauma shake: offset = trauma^2 x 6 px (4 px on phones), summed sines, translation only, table layer only */
  addTrauma(t: number): void {
    if (this.reduced) return;
    this.trauma = Math.min(1, this.trauma + t);
    if (this.shakeRaf) return;
    this.phoneShake = window.innerWidth < 900; // read once: not every frame
    this.shakeLast = performance.now();
    const step = (now: number): void => {
      const dt = Math.min(0.05, (now - this.shakeLast) / 1000);
      this.shakeLast = now;
      this.trauma = Math.max(0, this.trauma - dt * 1.7);
      const layer = q('[data-table-layer]');
      const amp = this.trauma * this.trauma * (this.phoneShake ? 4 : 6);
      if (layer) {
        const s = now / 1000;
        layer.style.translate = amp < 0.05 ? '' : `${((Math.sin(s * 47) + Math.sin(s * 31 + 1.3)) / 2) * amp}px ${((Math.sin(s * 41 + 0.7) + Math.sin(s * 27)) / 2) * amp}px`;
      }
      if (this.trauma > 0) this.shakeRaf = requestAnimationFrame(step);
      else {
        this.shakeRaf = 0;
        if (layer) layer.style.translate = '';
      }
    };
    this.shakeRaf = requestAnimationFrame(step);
  }

  /** hit-stop: table-lane animations pause for `ms`; audio does not */
  hitStop(ms: number): void {
    if (this.reduced || this.airborne.size === 0) return;
    const paused = [...this.airborne].filter((a) => a.playState === 'running');
    paused.forEach((a) => a.pause());
    setTimeout(() => paused.forEach((a) => a.playState === 'paused' && a.play()), ms);
  }

  /** the impact frame: ink and paper swap for two frames; at most one a second (WCAG 2.3.1), never on text, off under reduced motion */
  impact(): boolean {
    if (this.reduced) return false;
    const now = performance.now();
    if (now - this.lastImpactAt < 1000) return false;
    const layer = q('[data-table-layer]');
    if (!layer) return false;
    this.lastImpactAt = now;
    const fliers = q('[data-flight-layer]');
    layer.classList.add('is-impact');
    fliers?.classList.add('is-impact');
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        layer.classList.remove('is-impact');
        fliers?.classList.remove('is-impact');
      }),
    );
    return true;
  }

  /* -------------------------------------------------------- seat details */

  playerEl(id: string): HTMLElement | null {
    return id === this.me ? q('[data-me]') : q(`[data-player-id="${CSS.escape(id)}"]`);
  }

  /** where the totem stands on a seat: the edge of a chip or post, the left of your dock */
  totemSpot(id: string): Box | null {
    const b = this.playerEl(id)?.getBoundingClientRect();
    if (!b || (b.width === 0 && b.height === 0)) return null;
    return id === this.me ? { cx: b.left + 24, cy: b.top + 16, w: TOTEM.w, h: TOTEM.h } : { cx: b.left + b.width / 2, cy: b.top + 2, w: TOTEM.w, h: TOTEM.h };
  }

  /** where the arrow-chip rests: the corner of the target's post */
  chipSpot(id: string): Box | null {
    const b = this.playerEl(id)?.getBoundingClientRect();
    if (!b || (b.width === 0 && b.height === 0)) return null;
    return id === this.me ? { cx: b.left + b.width / 2, cy: b.top + 6, w: CHIP.w, h: CHIP.h } : { cx: b.right - 22, cy: b.top + 8, w: CHIP.w, h: CHIP.h };
  }

  /** the totem knocks as it lands */
  bounceTotem(): void {
    const el = q('[data-totem]');
    if (!el || this.reduced || typeof el.animate !== 'function') return;
    el.animate([{ translate: '0 -7px' }, { translate: '0 2px', offset: 0.6 }, { translate: '0 0' }], { duration: 160, easing: 'steps(4, end)' });
  }

  /** a power set's collar or rosette core ignites - the same for every hidden rank */
  ignite(owner: string, setId?: string): void {
    const plate = (setId ? q(`[data-set-id="${CSS.escape(setId)}"]`) : null) ?? [...document.querySelectorAll<HTMLElement>(`[data-laid-owner="${CSS.escape(owner)}"] .setplate`)].pop() ?? null;
    const core = plate?.querySelector<HTMLElement>('.setplate__core');
    if (!core || this.reduced || typeof core.animate !== 'function') return;
    core.animate([{ transform: 'scale(0.3)', opacity: 0.3 }, { transform: 'scale(1.7)', opacity: 1, offset: 0.5 }, { transform: 'scale(1)', opacity: 1 }], { duration: 300, easing: 'steps(4, end)' });
  }

  pulseSets(owner: string): void {
    const el = q(`[data-laid-owner="${CSS.escape(owner)}"]`) ?? this.playerEl(owner);
    if (!el || typeof el.animate !== 'function') return;
    el.animate([{ opacity: 0.4 }, { opacity: 1 }], { duration: 160, easing: 'steps(3, end)' });
  }

  /** a laid group presses flat: the plate stamps and a pip is gouged */
  pressSet(setId: string | undefined, owner: string): void {
    const el = (setId ? q(`[data-set-id="${CSS.escape(setId)}"]`) : null) ?? [...document.querySelectorAll<HTMLElement>(`[data-laid-owner="${CSS.escape(owner)}"] .setplate`)].pop() ?? null;
    if (!el) return;
    el.classList.add('is-new');
    setTimeout(() => el.classList.remove('is-new'), 400);
    if (!this.reduced && typeof el.animate === 'function') el.animate([{ transform: 'scale(1.35)', opacity: 0.5 }, { transform: 'scale(0.96)', offset: 0.5, opacity: 1 }, { transform: 'scale(1)' }], { duration: 220, easing: 'cubic-bezier(0.2,0.9,0.25,1)' });
  }

  /** the posts carve in, one after another (game start) */
  carve(): void {
    if (this.reduced) return;
    const posts = [...document.querySelectorAll<HTMLElement>('[data-player-id]')];
    posts.forEach((p, i) => {
      if (typeof p.animate === 'function') p.animate([{ opacity: 0, translate: '0 10px' }, { opacity: 1, translate: '0 0' }], { duration: 260, delay: i * 90, easing: 'steps(4, end)', fill: 'backwards' });
    });
  }

  /**
   * The reveal (Mode Ascuns, first use of a power - §5.7): the owner's plate lifts, flips in three
   * stepped frames, rises to the pond's centre with its seal, holds 400 ms and presses flat. About
   * 1.3 s, and it never blocks: it is a flier in the layer over the table, and input passes through it.
   */
  reveal(owner: string, rank: string): void {
    const seal = this.spawn(`chip:${rank}`);
    const layer = this.layer();
    if (!seal || !layer) return;
    const svg = seal.querySelector('svg')?.cloneNode(true) as SVGElement | undefined;
    seal.remove();
    const from = this.totemSpot(owner) ?? this.anchor({ k: 'center' }, 'from');
    const mid = this.anchor({ k: 'center' }, 'to');
    if (!from || !mid) return;
    const plate = document.createElement('div');
    plate.className = 'flier reveal';
    plate.setAttribute('aria-hidden', 'true');
    plate.innerHTML = '<div class="reveal__f0"></div><div class="reveal__f1"></div><div class="reveal__f2"><span class="reveal__seal"></span></div>';
    if (svg) plate.querySelector('.reveal__seal')?.appendChild(svg);
    layer.appendChild(plate);
    const W = 46;
    const H = 60;
    const at = (b: { cx: number; cy: number }, dy: number, s: number): string => `translate(${b.cx - W / 2}px, ${b.cy - H / 2 + dy}px) scale(${s})`;
    const total = 1300;
    const end = (): void => plate.remove();
    if (this.reduced || typeof plate.animate !== 'function') {
      plate.classList.add('is-face');
      plate.style.transform = at(mid, 0, 1.5);
      plate.style.opacity = '1';
      setTimeout(end, 400);
      return;
    }
    plate.animate(
      [
        { transform: at(from, 0, 0.5), opacity: 1, offset: 0 },
        { transform: at(from, -14, 0.65), offset: 0.115 },
        { transform: at(from, -14, 0.65), offset: 0.31 },
        { transform: at(mid, 0, 1.5), offset: 0.54 },
        { transform: at(mid, 0, 1.5), offset: 0.85 },
        { transform: at(from, 0, 0.4), opacity: 0.2, offset: 1 },
      ],
      { duration: total, easing: 'steps(12, end)', fill: 'both' },
    ).onfinish = end;
    // three stepped frames: the back, the edge, the face
    const show = (sel: string, a: number, b: number): void => {
      plate.querySelector<HTMLElement>(sel)?.animate([{ opacity: 0 }, { opacity: 0, offset: a / total }, { opacity: 1, offset: a / total }, { opacity: 1, offset: b / total }, { opacity: 0 }], { duration: total, fill: 'both' });
    };
    show('.reveal__f0', 0, 200);
    show('.reveal__f1', 200, 283);
    show('.reveal__f2', 283, total);
  }

  /** the podium waits for the last beat, then shows */
  carveIn(): void {
    this.carve();
  }

  /* --------------------------------------------------------------- misc */

  static readonly BASE = { BACK, CHIP, TOTEM };
}
