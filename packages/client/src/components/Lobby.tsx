import { LOCALES } from '@pescuit/shared';
import { useState } from 'react';
import { useT } from '../i18n/useT.js';
import { useGame } from '../state/store.js';
import { roomCodeFromUrl } from '../net/session.js';

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
        <h1 className="title">{t('app.title')}</h1>

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
            <label className="field">
              <span>{t('lobby.powerVisibility')}</span>
              <select value={powerVisibility} onChange={(e) => setPowerVisibility(e.target.value as 'ascuns' | 'deschis')}>
                <option value="ascuns">{t('lobby.powerVisibility.ascuns')}</option>
                <option value="deschis">{t('lobby.powerVisibility.deschis')}</option>
              </select>
            </label>
          )}

          {error && (
            <p className="error" onClick={dismissError}>
              {error}
            </p>
          )}

          <button className="btn btn--primary" type="submit" disabled={joining}>
            {mode === 'create' ? t('lobby.createRoom') : t('lobby.joinRoom')}
          </button>
        </form>
      </div>
    </div>
  );
}
