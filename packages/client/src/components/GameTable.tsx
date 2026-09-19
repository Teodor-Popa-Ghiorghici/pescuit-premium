import type { Action, Rank } from '@pescuit/engine';
import { LOCALES } from '@pescuit/shared';
import { useState } from 'react';
import { useT } from '../i18n/useT.js';
import { useGame } from '../state/store.js';
import { EventLog } from './EventLog.js';
import { Hand } from './Hand.js';
import { InterruptPrompt } from './InterruptPrompt.js';
import { LaidSets } from './LaidSets.js';
import { PlayerBadge } from './PlayerBadge.js';
import { RulesPanel } from './RulesPanel.js';

export function GameTable() {
  const { t, locale } = useT();
  const { view, playerId, setLocale, leaveRoom, status, sendAction } = useGame();
  const [showRules, setShowRules] = useState(false);
  const [hoverTargetId, setHoverTargetId] = useState<string | null>(null);
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null);

  if (!view) {
    return (
      <div className="screen screen--centered">
        <p>{t('game.reconnecting')}</p>
      </div>
    );
  }

  const isGameOver = view.status === 'ENDED';
  const canAsk = view.currentPlayerId === playerId && view.pendingWindow === null;
  const askableRanks = [...new Set(view.hand.filter((c) => c.rank !== 'eggs').map((c) => c.rank))] as Rank[];
  const activeTargetId = hoverTargetId ?? selectedTargetId;

  function askPlayer(targetId: string, rank: Rank) {
    sendAction({ type: 'REQUEST', playerId: playerId!, targetId, rank } as Action);
    setSelectedTargetId(null);
    setHoverTargetId(null);
  }

  return (
    <div className="game-screen">
      <header className="game-header">
        <div className="game-header__turn">
          {isGameOver
            ? t('game.gameOver')
            : view.currentPlayerId === playerId
              ? t('game.yourTurn')
              : t('game.turnOf', { name: view.players.find((p) => p.id === view.currentPlayerId)?.name ?? '' })}
        </div>
        <div className="game-header__controls">
          <span className="pool-count" title={t('game.pool')}>
            🂠 {t('game.cardsLeft', { count: view.poolCount })}
          </span>
          <div className="lang-switch lang-switch--compact">
            {LOCALES.map((l) => (
              <button key={l} className={`lang-switch__btn ${l === locale ? 'is-active' : ''}`} onClick={() => setLocale(l)}>
                {l.toUpperCase()}
              </button>
            ))}
          </div>
          <button className="btn btn--small" onClick={() => setShowRules(true)}>
            {t('lobby.rules')}
          </button>
        </div>
      </header>

      <div className="player-row">
        {view.players.map((p) => {
          const isYou = p.id === playerId;
          const askable = canAsk && !isYou && !p.stunned;
          const active = askable && activeTargetId === p.id;
          return (
            <div key={p.id} className="player-row__item">
              <PlayerBadge
                player={p}
                isYou={isYou}
                isCurrent={p.id === view.currentPlayerId}
                askable={askable}
                active={active}
                askableRanks={askableRanks}
                onEnter={() => askable && setHoverTargetId(p.id)}
                onLeave={() => setHoverTargetId((h) => (h === p.id ? null : h))}
                onSelect={() => setSelectedTargetId((t) => (t === p.id ? null : p.id))}
                onPickRank={(rank) => askPlayer(p.id, rank)}
              />
              <LaidSets ownerId={p.id} />
            </div>
          );
        })}
      </div>

      <InterruptPrompt />

      <div className="game-main">
        <EventLog />
        <Hand />
      </div>

      {status === 'closed' && <div className="reconnect-banner">{t('game.reconnecting')}</div>}

      {isGameOver && <GameOverOverlay onNewGame={leaveRoom} />}

      {showRules && <RulesPanel onClose={() => setShowRules(false)} />}
    </div>
  );
}

function GameOverOverlay({ onNewGame }: { onNewGame: () => void }) {
  const { t } = useT();
  const { view } = useGame();
  if (!view) return null;
  const winnerNames = view.winners.map((id) => view.players.find((p) => p.id === id)?.name ?? id);

  return (
    <div className="modal-overlay">
      <div className="modal">
        <h2>{t('game.gameOver')}</h2>
        <p>{winnerNames.length > 1 ? t('game.winners', { names: winnerNames.join(', ') }) : t('game.winner', { name: winnerNames[0] })}</p>
        <h3>{t('game.finalScores')}</h3>
        <ul className="score-list">
          {view.players
            .slice()
            .sort((a, b) => b.score - a.score)
            .map((p) => (
              <li key={p.id}>
                {p.name}: {p.score}
              </li>
            ))}
        </ul>
        <button className="btn btn--primary" onClick={onNewGame}>
          {t('game.newGame')}
        </button>
      </div>
    </div>
  );
}
