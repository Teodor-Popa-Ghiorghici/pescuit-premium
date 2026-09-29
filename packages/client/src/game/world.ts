/* world.ts - PURE. The world arc of FEEL_VISUAL_SOUND_PLAN §3.9: one clock (the public tally of sets
 * still possible), two textures (the light follows the tally; the pool gives the water).
 *
 *   Dusk        18 -> 13   dusk light; the tally of 18 notches carved on the basin rim
 *   Evening     12 -> 7    --apa one flat step darker
 *   Night        6 -> 2    night; the notches left glow faintly; the water drains to wind if the pool is dry;
 *                          from 3 the low dobă pulse (amb.lastact)
 *   The last set     1     last light; the one notch left is inked and labelled "ultimul set"; mus.lastset
 *   Finale           0     the last lay's stamp, one held beat, the gate doors, the podium
 *
 * The stage is a function of the public count alone - never of a hand or a hidden rank (Law 1).
 * Nothing here touches the DOM: the presenter sets `data-light` / `data-stage` on the root, and
 * tokens.css turns the light into flat steps.
 */

export type WorldStage = 'dusk' | 'evening' | 'night' | 'last' | 'finale';
/** the flat step of --apa: dusk is the base */
export type Light = 'dusk' | 'evening' | 'night' | 'last';

/** the count at which each step of light begins (§5.4: "at 12, 6 and 1 sets still possible") */
export const LIGHT_AT = { evening: 12, night: 6, last: 1 } as const;
/** the last act (the low dobă pulse) starts at this count (`amb.lastact`) */
export const LAST_ACT_AT = 3;

/** `possible` is `view.sets.possible`; null when unknown (a lobby, a table not yet dealt) */
export function worldStage(possible: number | null | undefined, ended = false): WorldStage {
  if (ended) return 'finale';
  if (possible === null || possible === undefined) return 'dusk';
  if (possible <= 0) return 'finale';
  if (possible <= LIGHT_AT.last) return 'last';
  if (possible <= LIGHT_AT.night) return 'night';
  if (possible <= LIGHT_AT.evening) return 'evening';
  return 'dusk';
}

/** the finale keeps the last light: the doors close on it */
export function lightOf(stage: WorldStage): Light {
  return stage === 'finale' ? 'last' : stage;
}

/** how many notches a lay knocks out of the rim: one, or two when it also strands another set's cards */
export function notchesTaken(from: number | null, to: number | null): number {
  if (from === null || to === null) return 0;
  return Math.max(0, from - to);
}

/** the sets-still-possible count crossed into a new stage between two views (the world's announcements) */
export function stageChanged(before: number | null | undefined, after: number | null | undefined, ended = false): WorldStage | null {
  const a = worldStage(before, false);
  const b = worldStage(after, ended);
  return a !== b && b !== 'dusk' ? b : null;
}
