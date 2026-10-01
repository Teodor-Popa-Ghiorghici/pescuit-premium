/* stage.ts - the presenter's hands. Everything that touches the page lives here: finding the anchors
 * the choreography names, cloning the fliers and effects out of the flight layer's templates, flying
 * them along a quadratic arc with the Web Animations API (transform and opacity only, §4.3), masking
 * and unmasking the pixels that arrive before their flight does, and the juice - hit-stop, trauma
 * shake, the impact frame - which only ever touches the table layer.
 *
 * It knows nothing of the game: no card ranks except the seal a chip is asked to bear, no view, no
 * events. It is told where to fly and when.
 */
import type { Anchor, MaskTarget, TetherStyle, VfxKind } from './choreography.js';
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
  /** the arc's height in px (40-80 from the key when absent) */
  lift?: number;
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
      case 'between': {
        const f = this.anchor({ k: 'seat', id: a.from }, role);
        const t = this.anchor({ k: 'seat', id: a.to }, role);
        return f && t ? { cx: f.cx + (t.cx - f.cx) * a.t, cy: f.cy + (t.cy - f.cy) * a.t, w: f.w, h: f.h } : null;
      }
      case 'above': {
        const b = this.anchor(a.of, role);
        return b ? { ...b, cy: b.cy - a.dy } : null;
      }
    }
  }

  /** an opponent's fan of backs (HAND_AND_TURN_PLAN #7): where their cards come from and go to */
  fanBox(id: string): Box | null {
    if (id === this.me) return null;
    const b = box(q(`[data-player-id="${CSS.escape(id)}"] [data-fan]`));
    return b && b.w > 0 ? { cx: b.cx, cy: b.cy, w: 30, h: 45 } : null;
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
    const lift = o.straight ? 0 : (o.lift ?? 40 + r * 40);
    const flutter = (hash01(o.key + 'f') * 2 - 1) * 6;
    const tilt0 = o.tiltFrom ?? (hash01(o.key + 'a') * 2 - 1) * 4;
    const tilt1 = o.tiltTo ?? (hash01(o.key + 'b') * 2 - 1) * 3;
    const s0 = o.scaleFrom ?? 1;
    const s1 = o.scaleTo ?? 1;
    const frames: Keyframe[] = [];
    const at = (t: number, x: number, y: number, te: number, extra: Partial<Keyframe> = {}): void => {
      const rot = lerp(tilt0, tilt1, te) + flutter * Math.sin(Math.PI * te);
      // the flier rises toward the eye at the top of its arc and comes back down onto the table
      const s = lerp(s0, s1, te) * (1 + (o.straight ? 0 : 0.08) * Math.sin(Math.PI * te));
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
    if (this.reduced && kind !== 'gateDoors' && kind !== 'inkBurst') sizePx = Math.min(sizePx, 64);
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
    lastnotch: () => '[data-tally]',
    podium: () => '[data-podium]',
    stun: (r) => this.seatSel(r),
    shield: (r) => this.seatSel(r),
    crown: () => '[data-crown]',
    score: (r) => `[data-score-owner="${CSS.escape((r ?? '').split(':')[0])}"]`,
  };
  private static seatSel(r?: string): string {
    return r ? `[data-player-id="${CSS.escape(r)}"], [data-me="${CSS.escape(r)}"]` : '[data-none]';
  }
  private static TOKEN: Record<MaskTarget, string> = { totem: 'hide', plank: 'soft', set: 'hide', crack: 'crack', tally: 'tally', lastnotch: 'nolast', podium: 'hide', stun: 'nostun', shield: 'noshield', crown: 'hide', score: 'score' };

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
      // the score keeps its old number (drawn by CSS from data-was) until the set is pressed
      if (target === 'score') {
        if (on) el.setAttribute('data-was', (ref ?? '').split(':')[1] ?? '');
        else el.removeAttribute('data-was');
      }
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
  /** a lay that took two notches or more says so: a "−2" stamped beside the tally for a moment (a `data-tally-delta` slot) */
  notchDelta(n: number): void {
    const el = q('[data-tally-delta]');
    if (!el || n < 2) return;
    el.textContent = `\u2212${n}`;
    if (this.reduced || typeof el.animate !== 'function') {
      setTimeout(() => (el.textContent = ''), 1600);
      return;
    }
    el.animate([{ opacity: 1, translate: '0 0' }, { opacity: 1, translate: '0 0', offset: 0.7 }, { opacity: 0, translate: '0 -6px' }], { duration: 1700, easing: 'steps(6, end)' }).onfinish = () => (el.textContent = '');
  }

  /** the pool's last card has left: the basin drains to a dry floor (stepped, ~900 ms; instant under reduced motion) */
  drain(): void {
    const basin = q('[data-basin]');
    if (!basin || this.reduced) return;
    basin.classList.add('is-draining');
    setTimeout(() => basin.classList.remove('is-draining'), 960);
  }

  /** a card that has just landed in your hand is pressed in: it drops the last few px of its flight, squashes and settles */
  pressIn(id: string): void {
    const el = q(`[data-hand-card-id="${CSS.escape(id)}"]`);
    if (!el || this.reduced || typeof el.animate !== 'function') return;
    el.animate(
      [
        { transform: 'translateY(-34px) rotate(-6deg) scale(1.06)', filter: 'brightness(1.25)' },
        { transform: 'translateY(3px) rotate(1deg) scale(0.97)', filter: 'brightness(1.05)', offset: 0.55 },
        { transform: 'none', filter: 'none' },
      ],
      { duration: 520, easing: 'cubic-bezier(0.34,1.32,0.64,1)' },
    );
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
    // the tally is carved on the rim: one notch after another, left to right
    document.querySelectorAll<HTMLElement>('.tally__notch').forEach((n, i) => {
      if (typeof n.animate === 'function') n.animate([{ scale: '1 0', opacity: 0 }, { scale: '1 1', opacity: 1 }], { duration: 160, delay: 300 + i * 40, easing: 'steps(3, end)', fill: 'backwards' });
    });
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
    const mid = this.calloutSpot();
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
    // the plate flips on its owner's seat (0-283 ms), then flies to the pond's centre and bursts into the
    // proclamation exactly on the strike (450 ms), where the banner takes its seal
    const total = 640;
    const end = (): void => plate.remove();
    if (this.reduced || typeof plate.animate !== 'function') {
      plate.classList.add('is-face');
      plate.style.transform = at(mid, 0, 1.5);
      plate.style.opacity = '1';
      setTimeout(end, 450);
      return;
    }
    plate.animate(
      [
        { transform: at(from, 0, 0.6), opacity: 1, offset: 0 },
        { transform: at(from, -18, 0.95), offset: 0.18 },
        { transform: at(from, -18, 0.95), offset: 0.44 },
        { transform: at(mid, 0, 1.6), opacity: 1, offset: 0.7 },
        { transform: at(mid, 0, 2.4), opacity: 0, offset: 1 },
      ],
      { duration: total, easing: 'steps(10, end)', fill: 'both' },
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

  /* ------------------------------------------------------ power moments */

  private focusTimer: ReturnType<typeof setTimeout> | undefined;
  /** the table dims to the seats a power (or the score race) involves, for `ms`; the pond stays lit */
  focus(ids: readonly string[], ms: number): void {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    document.querySelectorAll('[data-spot]').forEach((el) => el.removeAttribute('data-spot'));
    for (const id of ids) this.playerEl(id)?.setAttribute('data-spot', '');
    root.setAttribute('data-focus', '');
    clearTimeout(this.focusTimer);
    this.focusTimer = setTimeout(() => this.unfocus(), Math.max(0, ms));
  }
  unfocus(): void {
    clearTimeout(this.focusTimer);
    if (typeof document === 'undefined') return;
    document.documentElement.removeAttribute('data-focus');
    document.querySelectorAll('[data-spot]').forEach((el) => el.removeAttribute('data-spot'));
  }

  /** the actor gathers itself: a ring in the power's colour closes on its seat, in stepped frames */
  charge(id: string, color: string, ms: number): void {
    const b = this.playerBox(id);
    const layer = this.layer();
    if (!b || !layer) return;
    const el = document.createElement('div');
    el.className = 'flier charge';
    el.setAttribute('aria-hidden', 'true');
    el.style.setProperty('--accent', color);
    const w = b.w + 18;
    const h = b.h + 18;
    Object.assign(el.style, { width: `${w}px`, height: `${h}px`, transform: `translate(${b.cx - w / 2}px, ${b.cy - h / 2}px)` });
    layer.appendChild(el);
    if (this.reduced || typeof el.animate !== 'function') {
      el.style.opacity = '1';
      setTimeout(() => el.remove(), ms);
      return;
    }
    const a = el.animate(
      [
        { scale: '1.9', opacity: 0, borderWidth: '2px' },
        { scale: '1.35', opacity: 0.8, offset: 0.35 },
        { scale: '1.05', opacity: 1, borderWidth: '5px', offset: 0.85 },
        { scale: '1', opacity: 1, borderWidth: '7px' },
      ],
      { duration: ms, easing: 'steps(6, end)', fill: 'forwards' },
    );
    a.onfinish = () => {
      const b2 = el.animate([{ scale: '1', opacity: 1 }, { scale: '1.5', opacity: 0 }], { duration: 180, easing: 'steps(3, end)', fill: 'forwards' });
      b2.onfinish = () => el.remove();
    };
  }

  /** a drawn connection between two anchors for `ms`: a fishing line, the lantern's beam, the whale's wake */
  tether(from: Box | null, to: Box | null, style: TetherStyle, ms: number): void {
    const layer = this.layer();
    if (!from || !to || !layer || typeof document === 'undefined') return;
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('class', `flier tether tether--${style}`);
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('width', String(window.innerWidth));
    svg.setAttribute('height', String(window.innerHeight));
    svg.style.opacity = '1';
    const dx = to.cx - from.cx;
    const dy = to.cy - from.cy;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    const path = document.createElementNS(NS, style === 'beam' ? 'polygon' : 'path');
    if (style === 'beam') {
      const w0 = 5;
      const w1 = 34;
      path.setAttribute('points', [
        [from.cx + nx * w0, from.cy + ny * w0], [to.cx + nx * w1, to.cy + ny * w1], [to.cx - nx * w1, to.cy - ny * w1], [from.cx - nx * w0, from.cy - ny * w0],
      ].map((p) => p.map((v) => v.toFixed(1)).join(',')).join(' '));
    } else if (style === 'wake') {
      const n = Math.max(4, Math.round(len / 28));
      let d = `M${from.cx.toFixed(1)},${from.cy.toFixed(1)}`;
      for (let i = 1; i <= n; i++) {
        const t = i / n;
        const side = i % 2 ? 1 : -1;
        const mx = from.cx + dx * (t - 0.5 / n) + nx * 10 * side;
        // the wake dips through the pond between the two seats
        const dip = Math.max(90, len * 0.5);
        const my = from.cy + dy * (t - 0.5 / n) + ny * 10 * side + Math.sin(Math.PI * (t - 0.5 / n)) * dip;
        d += ` Q${mx.toFixed(1)},${my.toFixed(1)} ${(from.cx + dx * t).toFixed(1)},${(from.cy + dy * t + Math.sin(Math.PI * t) * dip).toFixed(1)}`;
      }
      path.setAttribute('d', d);
    } else {
      // a line with a sag; the slack line sags twice as far
      const sag = style === 'slack' ? 46 : 18;
      path.setAttribute('d', `M${from.cx.toFixed(1)},${from.cy.toFixed(1)} Q${(from.cx + dx / 2).toFixed(1)},${(from.cy + dy / 2 + sag).toFixed(1)} ${to.cx.toFixed(1)},${to.cy.toFixed(1)}`);
    }
    svg.appendChild(path);
    layer.appendChild(svg);
    const total = Math.max(1, ms);
    if (this.reduced || typeof svg.animate !== 'function') {
      setTimeout(() => svg.remove(), Math.min(total, 600));
      return;
    }
    if (style === 'beam') {
      svg.animate([{ opacity: 0 }, { opacity: 0.9, offset: 0.12 }, { opacity: 0.55, offset: 0.2 }, { opacity: 0.9, offset: 0.28 }, { opacity: 0.8, offset: 0.8 }, { opacity: 0 }], { duration: total, easing: 'steps(10, end)', fill: 'forwards' }).onfinish = () => svg.remove();
      return;
    }
    // the line is paid out (drawn in) over the first third, held, then reeled in / let go
    const L = (path as SVGPathElement).getTotalLength?.() ?? len;
    path.setAttribute('stroke-dasharray', `${L} ${L}`);
    path.animate([{ strokeDashoffset: L }, { strokeDashoffset: 0, offset: 0.4 }, { strokeDashoffset: 0, offset: 0.75 }, { strokeDashoffset: style === 'slack' ? 0 : -L }], { duration: total, easing: 'steps(12, end)', fill: 'forwards' });
    svg.animate([{ opacity: 1 }, { opacity: 1, offset: 0.8 }, { opacity: 0 }], { duration: total, fill: 'forwards' }).onfinish = () => svg.remove();
  }

  /** where the proclamation stands: along the bottom of the pond - the seats and the pond's centre, where the
   *  action is, stay clear - never over the hand or the plank */
  private calloutSpot(h = 72): Box {
    const pond = box(q('[data-pond]')) ?? box(q('[data-basin]'));
    if (pond) return { cx: pond.cx, cy: pond.cy + pond.h / 2 - h / 2 - 6, w: pond.w, h };
    return { cx: window.innerWidth / 2, cy: window.innerHeight * 0.45, w: 300, h };
  }
  private calloutEl: HTMLElement | null = null;
  /**
   * The proclamation: a banner slams in over the pond - the power's seal, its name, and in plain words what
   * it did to whom - holds, and lifts away. Never catches a pointer; a newer one replaces it at once.
   */
  callout(o: { kind: string; title: string; line: string; seal: Element | null; via?: Element | null; accent: string; ms: number }): void {
    const layer = this.layer();
    if (!layer || typeof document === 'undefined') return;
    this.calloutEl?.remove();
    const el = document.createElement('div');
    el.className = `flier callout callout--${o.kind}`;
    el.setAttribute('aria-hidden', 'true');
    el.style.setProperty('--accent', o.accent);
    const seal = document.createElement('div');
    seal.className = 'callout__seal';
    if (o.seal) seal.appendChild(o.seal);
    if (o.via) {
      const v = document.createElement('span');
      v.className = 'callout__via';
      v.appendChild(o.via);
      seal.appendChild(v);
    }
    const text = document.createElement('div');
    text.className = 'callout__text';
    const title = document.createElement('div');
    title.className = 'callout__title';
    title.textContent = o.title;
    const line = document.createElement('div');
    line.className = 'callout__line';
    line.textContent = o.line;
    text.append(title, line);
    el.append(seal, text);
    layer.appendChild(el);
    this.calloutEl = el;
    const w = Math.min(window.innerWidth - 24, 380);
    el.style.width = `${w}px`;
    const h = el.getBoundingClientRect().height || 72;
    const spot = this.calloutSpot(h);
    const x = Math.max(12, Math.min(window.innerWidth - w - 12, spot.cx - w / 2));
    const y = Math.max(8, spot.cy - h / 2);
    el.style.transform = `translate(${x}px, ${y}px)`;
    el.style.opacity = '1';
    const done = (): void => {
      el.remove();
      if (this.calloutEl === el) this.calloutEl = null;
    };
    if (this.reduced || typeof el.animate !== 'function') {
      setTimeout(done, o.ms);
      return;
    }
    const at = (s: number, r: number, dy = 0): string => `translate(${x}px, ${y + dy}px) rotate(${r}deg) scale(${s})`;
    el.animate(
      [
        { transform: at(1.9, -7), opacity: 0, offset: 0 },
        { transform: at(0.92, 2), opacity: 1, offset: 0.06 },
        { transform: at(1.04, -1.5), offset: 0.1 },
        { transform: at(1, -1.5), offset: 0.14 },
        { transform: at(1, -1.5), opacity: 1, offset: 0.86 },
        { transform: at(0.96, -1.5, -18), opacity: 0, offset: 1 },
      ],
      { duration: o.ms, easing: 'steps(40, end)', fill: 'forwards' },
    ).onfinish = done;
  }
  clearCallout(): void {
    this.calloutEl?.remove();
    this.calloutEl = null;
    this.unfocus();
  }

  /** a seat is struck: a hard, stepped shake of that seat alone, with a flash of its border */
  jolt(el: Element | null | undefined): void {
    if (!el || this.reduced || typeof (el as HTMLElement).animate !== 'function') return;
    (el as HTMLElement).animate(
      [{ translate: '0 0' }, { translate: '-7px 2px' }, { translate: '6px -3px' }, { translate: '-4px 1px' }, { translate: '3px 0' }, { translate: '-1px 0' }, { translate: '0 0' }],
      { duration: 300, easing: 'steps(6, end)' },
    );
    el.setAttribute('data-struck', '');
    setTimeout(() => el.removeAttribute('data-struck'), 260);
  }

  /** a score ticks up: the number is stamped in, big, and bumps back */
  scorePop(owner: string): void {
    const els = document.querySelectorAll<HTMLElement>(`[data-score-owner="${CSS.escape(owner)}"]`);
    els.forEach((el) => {
      if (this.reduced || typeof el.animate !== 'function') return;
      el.animate([{ scale: '2.2', color: 'var(--ocru)' }, { scale: '0.85', offset: 0.4 }, { scale: '1.15', offset: 0.7 }, { scale: '1' }], { duration: 420, easing: 'steps(6, end)' });
    });
    const at = this.playerEl(owner)?.querySelector<HTMLElement>('[data-score-owner]') ?? els[0];
    const b = box(at);
    if (!b) return;
    const plus = this.spawn('sprite:plus');
    if (!plus) return;
    const base = { w: 44, h: 30 };
    if (this.reduced || typeof plus.animate !== 'function') {
      plus.remove();
      return;
    }
    const t = (dy: number, s: number): string => `translate(${b.cx - base.w / 2 + 14}px, ${b.cy - base.h / 2 + dy}px) scale(${s})`;
    plus.animate([{ transform: t(0, 0.4), opacity: 0 }, { transform: t(-18, 1.25), opacity: 1, offset: 0.2 }, { transform: t(-26, 1), opacity: 1, offset: 0.7 }, { transform: t(-40, 0.9), opacity: 0 }], { duration: 900, easing: 'steps(12, end)', fill: 'forwards' }).onfinish = () => plus.remove();
  }

  /* --------------------------------------------------------------- misc */

  static readonly BASE = { BACK, CHIP, TOTEM };
}
