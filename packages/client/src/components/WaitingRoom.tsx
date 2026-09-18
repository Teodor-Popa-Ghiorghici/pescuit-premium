import { useState } from 'react';
import { useT } from '../i18n/useT.js';
import { useGame } from '../state/store.js';

export function WaitingRoom() {
  const { t } = useT();
  const { roomCode, players, playerId, startGame, error, dismissError, config } = useGame();
  const [copied, setCopied] = useState(false);

  const me = players.find((p) => p.id === playerId);
  const link = `${location.origin}${location.pathname}?room=${roomCode}`;

  function copyLink() {
    navigator.clipboard?.writeText(link).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <div className="screen screen--centered">
      <div className="panel">
        <h1 className="title">{roomCode}</h1>
        <p className="muted">{t('lobby.shareLink')}</p>
        <div className="share-row">
          <input readOnly value={link} onFocus={(e) => e.currentTarget.select()} />
          <button type="button" className="btn" onClick={copyLink}>
            {copied ? t('lobby.copied') : t('lobby.copy')}
          </button>
        </div>

        <h2 className="subtitle">{t('lobby.players')}</h2>
        <ul className="player-list">
          {players.map((p) => (
            <li key={p.id} className={`player-list__item ${p.connected ? '' : 'is-offline'}`}>
              <span>{p.name}</span>
              {p.isHost && <span className="badge">host</span>}
              {p.id === playerId && <span className="badge badge--me">you</span>}
              {!p.connected && <span className="badge badge--offline">{t('game.disconnected')}</span>}
            </li>
          ))}
        </ul>

        <p className="muted">
          {t('lobby.powerVisibility')}: {t(`lobby.powerVisibility.${config.powerVisibility}`)}
        </p>

        {error && (
          <p className="error" onClick={dismissError}>
            {error}
          </p>
        )}

        {me?.isHost ? (
          <button className="btn btn--primary" disabled={players.length < 3} onClick={startGame}>
            {t('lobby.start')}
          </button>
        ) : (
          <p className="muted">{t('lobby.waitingForPlayers')}</p>
        )}
      </div>
    </div>
  );
}
