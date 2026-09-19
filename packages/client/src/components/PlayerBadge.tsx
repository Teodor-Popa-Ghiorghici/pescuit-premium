import type { Rank, RedactedPlayerView } from '@pescuit/engine';
import { useT } from '../i18n/useT.js';

export function PlayerBadge({
  player,
  isYou,
  isCurrent,
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
  return (
    <div
      className={`player-badge ${isCurrent ? 'is-current' : ''} ${player.connected ? '' : 'is-offline'} ${
        askable ? 'is-askable' : ''
      } ${active ? 'is-ask-active' : ''}`}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      onClick={askable ? onSelect : undefined}
      role={askable ? 'button' : undefined}
      tabIndex={askable ? 0 : undefined}
    >
      <div className="player-badge__name">
        {player.name}
        {isYou && <span className="badge badge--me">you</span>}
      </div>
      <div className="player-badge__stats">
        <span title={t('game.score')}>★ {player.score}</span>
        <span title={t('game.yourHand')}>🂠 {player.handSize}</span>
      </div>
      {player.stunned && <div className="player-badge__tag player-badge__tag--stun">{t('game.stunned')}</div>}
      {player.protectedRanks.length > 0 && (
        <div className="player-badge__tag player-badge__tag--protect">
          {t('game.protected')}: {player.protectedRanks.map((r) => rank(r)).join(', ')}
        </div>
      )}
      {!player.connected && <div className="player-badge__tag player-badge__tag--offline">{t('game.disconnected')}</div>}
      {active && askableRanks && askableRanks.length > 0 && (
        <div className="player-badge__ask-ranks" onClick={(e) => e.stopPropagation()}>
          <span className="player-badge__ask-hint">{t('game.askWhat')}</span>
          <div className="player-badge__ask-chips">
            {askableRanks.map((r) => (
              <button key={r} className="rank-chip" onClick={() => onPickRank?.(r)}>
                {rank(r)}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
