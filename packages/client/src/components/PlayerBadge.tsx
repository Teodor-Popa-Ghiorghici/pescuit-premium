import type { Rank, RedactedPlayerView } from '@pescuit/engine';
import { HandFan, RoePips } from '../art/table.js';
import { Seal } from '../art/seals.js';
import { useT } from '../i18n/useT.js';

/**
 * §5.3 — a player is a carved post. Score is roe cut into it, hand size is the edge
 * of the cards they hold, and the three states that change how you play against them
 * (stunned, protected, gone) each change the post itself, not a label beside it.
 */
export function PlayerBadge({
  player,
  isYou,
  askable,
  active,
  askableRanks,
  onEnter,
  onLeave,
  onSelect,
  onPickRank,
}: {
  player: RedactedPlayerView;
  isYou: boolean;
  isCurrent: boolean;
  askable?: boolean;
  active?: boolean;
  askableRanks?: Rank[];
  onEnter?: () => void;
  onLeave?: () => void;
  onSelect?: () => void;
  onPickRank?: (rank: Rank) => void;
}) {
  const { t, rank } = useT();
  const isProtected = player.protectedRanks.length > 0;

  return (
    <div
      className={[
        'player-badge',
        isYou ? 'is-you' : '',
        player.connected ? '' : 'is-offline',
        player.stunned ? 'is-stunned' : '',
        askable ? 'is-askable' : '',
        active ? 'is-ask-active' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      onClick={askable ? onSelect : undefined}
      role={askable ? 'button' : undefined}
      tabIndex={askable ? 0 : undefined}
      onKeyDown={askable ? (e) => (e.key === 'Enter' || e.key === ' ') && onSelect?.() : undefined}
    >
      {isProtected && <ProtectionShell />}

      <div className="player-badge__name">
        {player.name}
        {isYou && <span className="player-badge__you"> ({t('game.you')})</span>}
      </div>

      <RoePips score={player.score} title={`${t('game.score')}: ${player.score}`} />
      <HandFan count={player.handSize} title={`${t('game.yourHand')}: ${player.handSize}`} />

      {player.stunned && <div className="player-badge__tag player-badge__tag--stun">{t('game.stunned')}</div>}
      {isProtected && (
        <div className="player-badge__tag player-badge__tag--protect">
          {t('game.protected')}: {player.protectedRanks.map((r) => rank(r)).join(', ')}
        </div>
      )}
      {!player.connected && <div className="player-badge__tag player-badge__tag--offline">{t('game.disconnected')}</div>}

      {active && askableRanks && askableRanks.length > 0 && (
        <div className="ask-chips" onClick={(e) => e.stopPropagation()}>
          <span className="ask-chips__hint">{t('game.askWhat')}</span>
          {askableRanks.map((r) => (
            <button key={r} type="button" className="rank-chip" onClick={() => onPickRank?.(r)}>
              <Seal rank={r} size={14} />
              {rank(r)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** The verdigris shell of §4.5, clamped over the top edge of a protected post. */
function ProtectionShell() {
  return (
    <svg
      className="player-badge__shell"
      viewBox="0 0 100 18"
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M2,16 Q50,-8 98,16 L98,18 Q50,-2 2,18 Z" fill="#3d7a66" stroke="#17120e" strokeWidth="2" />
    </svg>
  );
}
