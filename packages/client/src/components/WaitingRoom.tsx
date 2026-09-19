import { useState } from 'react';
import { Totem } from '../art/table.js';
import { useT } from '../i18n/useT.js';
import { useGame } from '../state/store.js';
import { play } from '../sound.js';
import { RopeRule } from './Lobby.js';

const MIN_PLAYERS = 3;
const MAX_POSTS = 6;

/** §5.2 — the room is a row of carved posts. The ones nobody has taken yet are
 *  dashed outlines, so the table always shows how much of it is still empty. */
export function WaitingRoom() {
  const { t } = useT();
  const { roomCode, players, playerId, startGame, error, dismissError, config } = useGame();
  const [copied, setCopied] = useState(false);

  const me = players.find((p) => p.id === playerId);
  const link = `${location.origin}${location.pathname}?room=${roomCode}`;
  const empties = Math.max(0, MAX_POSTS - players.length);

  function copyLink() {
    navigator.clipboard?.writeText(link).then(() => {
      play('stamp');
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <div className="screen screen--centered">
      <div className="waiting">
        <div className="room-code">
          <div className="room-code__plate">
            <div className="room-code__label">{t('lobby.roomCode')}</div>
            <div className="room-code__value">{roomCode}</div>
          </div>
          <button type="button" className="room-code__copy" onClick={copyLink}>
            {copied ? t('lobby.copied') : t('lobby.copy')}
          </button>
        </div>

        <input className="share-link" readOnly value={link} onFocus={(e) => e.currentTarget.select()} aria-label={t('lobby.shareLink')} />

        <div className="posts">
          {players.map((p) => (
            <div key={p.id} className={`post ${p.connected ? '' : 'is-offline'} ${p.isHost ? 'post--host' : ''}`}>
              {p.isHost ? <Totem size={44} /> : <PostCap />}
              <div className="post__name">{p.name}</div>
              {p.isHost && <div className="post__role">{t('lobby.host')}</div>}
              {p.id === playerId && !p.isHost && <div className="post__role">{t('game.you')}</div>}
              {!p.connected && <div className="post__role">{t('game.disconnected')}</div>}
            </div>
          ))}
          {Array.from({ length: empties }, (_, i) => (
            <div key={`free-${i}`} className="post post--empty">
              {t('lobby.free')}
            </div>
          ))}
        </div>

        <RopeRule />

        <p className="muted">
          {t('lobby.powerVisibility')}: <strong style={{ color: 'var(--hartie)' }}>{t(`lobby.powerVisibility.${config.powerVisibility}`)}</strong>
        </p>

        {error && (
          <p className="error" onClick={dismissError}>
            {error}
          </p>
        )}

        {me?.isHost ? (
          <button className="btn btn--primary" disabled={players.length < MIN_PLAYERS} onClick={startGame}>
            {t('lobby.start')}
          </button>
        ) : (
          <p className="muted">{t('lobby.waitingForPlayers')}</p>
        )}
      </div>
    </div>
  );
}

/** A plain carved knob for a post nobody is hosting from. */
function PostCap() {
  return (
    <svg width="44" height="44" viewBox="0 0 24 24" aria-hidden="true" focusable="false" style={{ display: 'block' }}>
      <circle cx="12" cy="12" r="8" fill="#40291a" />
    </svg>
  );
}
