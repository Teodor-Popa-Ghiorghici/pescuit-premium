import { LOCALES } from '@pescuit/shared';
import { useState } from 'react';
import { CardBack } from './Card.js';
import { useT } from '../i18n/useT.js';
import { useGame } from '../state/store.js';
import { roomCodeFromUrl } from '../net/session.js';
import { play } from '../sound.js';

/** §5.1 — the sheet of stock everything else is printed on, and the rope rule under
 *  the title that reappears at the top of every screen in the game. */
export function Lobby() {
  const { t, locale } = useT();
  const { createRoom, joinRoom, setLocale, error, dismissError, joining } = useGame();
  const [name, setName] = useState('');
  const [roomCode, setRoomCode] = useState(roomCodeFromUrl() ?? '');
  const [powerVisibility, setPowerVisibility] = useState<'ascuns' | 'deschis'>('ascuns');
  const [mode, setMode] = useState<'create' | 'join'>(roomCodeFromUrl() ? 'join' : 'create');

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    play('stamp');
    if (mode === 'create') {
      createRoom(name, { powerVisibility });
    } else {
      if (!roomCode.trim()) return;
      joinRoom(roomCode, name);
    }
  }

  return (
    <div className="screen screen--centered">
      <div className="panel">
        <div className="panel__crest">
          <h1 className="title">{t('app.title')}</h1>
          <RopeRule />
        </div>

        <div className="lang-switch" role="group" aria-label={t('lobby.language')}>
          {LOCALES.map((l) => (
            <button
              key={l}
              className={`lang-switch__btn ${l === locale ? 'is-active' : ''}`}
              onClick={() => setLocale(l)}
              type="button"
            >
              {t(`lang.${l}`)}
            </button>
          ))}
        </div>

        <div className="tabs">
          <button className={`tab ${mode === 'create' ? 'is-active' : ''}`} onClick={() => setMode('create')} type="button">
            {t('lobby.createRoom')}
          </button>
          <button className={`tab ${mode === 'join' ? 'is-active' : ''}`} onClick={() => setMode('join')} type="button">
            {t('lobby.joinRoom')}
          </button>
        </div>

        <form onSubmit={submit} className="form">
          <label className="field">
            <span>{t('lobby.yourName')}</span>
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={24} autoFocus />
          </label>

          {mode === 'join' && (
            <label className="field">
              <span>{t('lobby.roomCode')}</span>
              <input
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                maxLength={5}
                className="field__code"
              />
            </label>
          )}

          {mode === 'create' && (
            <div className="visibility">
              <span className="eyebrow">{t('lobby.powerVisibility')}</span>
              <div className="visibility__options" role="radiogroup" aria-label={t('lobby.powerVisibility')}>
                <VisibilityOption
                  active={powerVisibility === 'ascuns'}
                  onSelect={() => setPowerVisibility('ascuns')}
                  name={t('lobby.powerVisibility.ascuns')}
                  desc={t('lobby.powerVisibility.ascuns.desc')}
                  preview={<CardBack width={54} height={81} />}
                />
                <VisibilityOption
                  active={powerVisibility === 'deschis'}
                  onSelect={() => setPowerVisibility('deschis')}
                  name={t('lobby.powerVisibility.deschis')}
                  desc={t('lobby.powerVisibility.deschis.desc')}
                  preview={<FaceUpPreview />}
                />
              </div>
            </div>
          )}

          {error && (
            <p className="error" onClick={dismissError}>
              {error}
            </p>
          )}

          <button className="btn btn--ink btn--primary" type="submit" disabled={joining}>
            {mode === 'create' ? t('lobby.createRoom') : t('lobby.joinRoom')}
          </button>
        </form>
      </div>
    </div>
  );
}

function VisibilityOption({
  active,
  onSelect,
  name,
  desc,
  preview,
}: {
  active: boolean;
  onSelect: () => void;
  name: string;
  desc: string;
  preview: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      className={`btn visibility__option ${active ? 'is-active' : ''}`}
      onClick={onSelect}
    >
      {preview}
      <span>
        <span className="visibility__name">{name}</span>
        <span className="visibility__desc">{desc}</span>
      </span>
    </button>
  );
}

/** A power set laid face up: the same plate as a real card, at the pool size. */
function FaceUpPreview() {
  return (
    <svg width="54" height="81" viewBox="0 0 176 264" aria-hidden="true" focusable="false" style={{ flex: 'none' }}>
      <polygon points="19,0 157,0 176,19 176,245 157,264 19,264 0,245 0,19" fill="#efe2c8" />
      <polygon points="19,0 157,0 176,19 176,245 157,264 19,264 0,245 0,19" fill="none" stroke="#17120e" strokeWidth="13" />
      <g transform="translate(0,6)">
        <circle cx="88" cy="118" r="44" fill="none" stroke="#17120e" strokeWidth="11" />
        <g fill="#17120e">
          <polygon points="88,58 96,80 80,80" />
          <polygon points="148,118 126,126 126,110" />
          <polygon points="88,178 80,156 96,156" />
          <polygon points="28,118 50,110 50,126" />
        </g>
        <circle cx="88" cy="118" r="16" fill="#17120e" />
      </g>
      <rect x="20" y="204" width="136" height="20" fill="#3f4f8a" />
    </svg>
  );
}

/** The twisted rope, drawn flat: an ink line with the rope pattern laid over it. */
export function RopeRule() {
  return (
    <svg className="rope-rule" width="320" height="16" viewBox="0 0 320 16" aria-hidden="true" focusable="false">
      <line x1="0" y1="8" x2="320" y2="8" stroke="#17120e" strokeWidth="10" />
      <line x1="0" y1="8" x2="320" y2="8" stroke="url(#rope)" strokeWidth="10" />
    </svg>
  );
}
