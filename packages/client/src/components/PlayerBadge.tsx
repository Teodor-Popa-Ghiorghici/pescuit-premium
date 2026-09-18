import type { RedactedPlayerView } from '@pescuit/engine';
import { useT } from '../i18n/useT.js';

export function PlayerBadge({
  player,
  isYou,
  isCurrent,
}: {
  player: RedactedPlayerView;
  isYou: boolean;
  isCurrent: boolean;
}) {
  const { t, rank } = useT();
  return (
    <div className={`player-badge ${isCurrent ? 'is-current' : ''} ${player.connected ? '' : 'is-offline'}`}>
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
    </div>
  );
}
