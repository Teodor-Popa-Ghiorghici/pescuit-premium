import { NORMAL_RANKS, POWER_RANKS } from '@pescuit/engine';
import { Seal } from '../art/seals.js';
import { Totem } from '../art/table.js';
import { VFX_KINDS, Vfx } from '../art/vfx.js';
import { CardBack } from './Card.js';

const CHIP_RANKS: readonly string[] = ['', ...POWER_RANKS, ...NORMAL_RANKS, 'eggs'];

/**
 * The layer everything that travels lives in (§4.3): fixed over the table, never in the layout, never
 * catching a pointer. It carries no state of its own: the presenter clones a template out of the hidden
 * shelf - a card back, the totem, an arrow-chip bearing each rank's seal, and every stepped effect -
 * places it, flies it with the Web Animations API and removes it. A carved token bearing the rank's
 * seal is the arrow-chip; one back, one seed, is every card in the air.
 */
export function FlightLayer() {
  return (
    <div className="flight-layer" data-flight-layer aria-hidden="true">
      <div className="flight-layer__shelf" hidden data-templates>
        <div data-tpl="back" className="flier__card">
          <span className="flier__lift" />
          <CardBack width={60} height={90} />
        </div>
        <div data-tpl="totem" className="flier__totem">
          <Totem size={20} />
        </div>
        {CHIP_RANKS.map((r) => (
          <div key={r} data-tpl={`chip:${r}`} className="chip-token">
            <span className="flier__lift" />
            <div className="chip-token__in">{r ? <Seal rank={r} size={20} color="#efe2c8" /> : <span className="chip-token__blank" />}</div>
          </div>
        ))}
        {VFX_KINDS.map((k) => (
          <div key={k} data-tpl={`vfx:${k}`} className="vfx-host">
            <Vfx kind={k} />
          </div>
        ))}
      </div>
      <div className="flight-layer__stage" data-fliers />
    </div>
  );
}
