import type { RedactedPlayerView, RedactedView } from '@pescuit/engine';
import { FanIcon, HookIcon, Mark, markForSeat, PowerPips } from '../art/marks.js';
import { Seal } from '../art/seals.js';
import { HandFan, Totem } from '../art/table.js';
import { seatFacts, shortName } from '../game/seatFacts.js';
import { useT } from '../i18n/useT.js';
import { LaidRow } from './LaidSets.js';

interface SeatProps {
  view: RedactedView;
  player: RedactedPlayerView;
  current: boolean;
  /** an ask could be sent to this player right now */
  askable: boolean;
  /** the pointer (a drag) or the keyboard is on this seat */
  target: boolean;
  /** the table has SHOWN this seat's turn (the totem has landed): the ochre border follows the totem, not the view */
  hot?: boolean;
  onPick?: () => void;
  onHover?: (over: boolean) => void;
}

function useSeatLabel(view: RedactedView, p: RedactedPlayerView, current: boolean): string {
  const { t, rank } = useT();
  const bits = [p.name, `${t('game.score')} ${p.score}`, `${p.handSize} ${t('dock.cards')}`];
  if (current) bits.push(t('game.turnOf', { name: p.name }));
  if (p.stunned) bits.push(t('game.stunned'));
  if (p.protectedRanks.length) bits.push(`${t('game.protected')}: ${p.protectedRanks.map((r) => rank(r)).join(', ')}`);
  if (!p.connected) bits.push(t('game.disconnected'));
  void view;
  return bits.join(', ');
}

/** The shell of a protected player clamps over the top edge of a chip or a post. */
function Shell({ width, height, className }: { width: number; height: number; className: string }) {
  return (
    <svg className={className} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden="true">
      <path
        d={`M1,${height - 1} Q${width / 2},${-height / 2 - 1} ${width - 1},${height - 1} L${width - 1},${height} Q${width / 2},0 1,${height} Z`}
        fill="#3d7a66"
        stroke="#17120e"
        strokeWidth="1.6"
      />
    </svg>
  );
}

/** §5.2 - the 60×76 opponent chip. Stunned is branded, not tinted; protected wears the shell and the
 *  rank's seal; disconnected is dashed with the hook; the current turn is ochre with the totem. */
export function Chip({ view, player: p, current, hot, askable, target, onPick, onHover }: SeatProps) {
  const facts = seatFacts(view, p.id);
  const label = useSeatLabel(view, p, current);
  const prot = p.protectedRanks[0];
  const cls = ['chip', (hot ?? current) && 'is-current', p.stunned && 'is-stunned', !p.connected && 'is-offline', prot && 'is-protected', askable && 'is-askable', target && 'is-target']
    .filter(Boolean)
    .join(' ');
  return (
    <div
      className={cls}
      data-player-id={p.id}
      data-askable={askable}
      role="group"
      aria-label={label}
      onClick={askable ? onPick : undefined}
      onMouseEnter={() => onHover?.(true)}
      onMouseLeave={() => onHover?.(false)}
    >
      {current && (
        <div className="chip__totem" data-totem>
          <Totem size={14} />
        </div>
      )}
      {prot && <Shell className="chip__shell" width={60} height={12} />}
      <div className="chip__plate">
        <span className="chip__name">{shortName(p.name)}</span>
      </div>
      <div className="chip__row">
        <Mark id={markForSeat(view.turnOrder, p.id)} size={12} color="#e3d3b4" />
        <span className="chip__score num">{p.score}</span>
        <PowerPips unused={facts.unused} used={facts.used} />
      </div>
      <div className="chip__row chip__row--foot">
        <span className="chip__hand num">
          <FanIcon />
          {p.handSize}
        </span>
        <span className="chip__status">
          {p.stunned && <Seal rank="jellyfish" size={11} color="#efe2c8" />}
          {prot && <Seal rank={prot} size={11} color="#9fd3bf" />}
          {!p.connected && <HookIcon />}
        </span>
      </div>
    </div>
  );
}

/** §5.2 - the 150 px desktop post, standing on the arc. Same states as the chip, room for the fan. */
export function Post({ view, player: p, current, hot, askable, target, lift, onPick, onHover }: SeatProps & { lift: number }) {
  const facts = seatFacts(view, p.id);
  const label = useSeatLabel(view, p, current);
  const prot = p.protectedRanks[0];
  const cls = ['post-d', (hot ?? current) && 'is-current', p.stunned && 'is-stunned', !p.connected && 'is-offline', prot && 'is-protected', askable && 'is-askable', target && 'is-target']
    .filter(Boolean)
    .join(' ');
  return (
    <div
      className={cls}
      style={{ marginTop: lift }}
      data-player-id={p.id}
      data-askable={askable}
      role={askable ? 'button' : 'group'}
      tabIndex={askable ? 0 : undefined}
      aria-label={label}
      onClick={askable ? onPick : undefined}
      onKeyDown={askable ? (e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onPick?.()) : undefined}
      onMouseEnter={() => onHover?.(true)}
      onMouseLeave={() => onHover?.(false)}
    >
      {current && (
        <div className="post-d__totem" data-totem>
          <Totem size={18} />
        </div>
      )}
      {prot && <Shell className="post-d__shell" width={150} height={16} />}
      <div className="post-d__plate">
        {p.stunned && <Seal rank="jellyfish" size={13} color="#efe2c8" />}
        <span className="post-d__name">{p.name}</span>
      </div>
      <div className="post-d__row">
        <Mark id={markForSeat(view.turnOrder, p.id)} size={16} color="#e3d3b4" />
        <span className="post-d__score num">{p.score}</span>
        <PowerPips unused={facts.unused} used={facts.used} />
      </div>
      <div className="post-d__row post-d__row--foot">
        <span className="post-d__fan">
          <HandFan count={p.handSize} />
        </span>
        <span className="chip__status">
          {prot && <Seal rank={prot} size={13} color="#9fd3bf" />}
          {!p.connected && <HookIcon size={13} />}
        </span>
      </div>
      <LaidRow view={view} owner={p.id} className="laid--dk" />
    </div>
  );
}
