import type { Action, Rank } from '@pescuit/engine';
import { LOCALES } from '@pescuit/shared';
import { useLayoutEffect, useRef, useState } from 'react';
import { useEventBeats } from '../game/beats.js';
import { PoolStack, RoePips, Totem } from '../art/table.js';
import { useT } from '../i18n/useT.js';
import { DUR, EASE, prefersReducedMotion } from '../motion.js';
import { play, setSoundEnabled, soundEnabled } from '../sound.js';
import { useGame } from '../state/store.js';
import { EventLog } from './EventLog.js';
import { Hand } from './Hand.js';
import { InterruptPrompt } from './InterruptPrompt.js';
import { LaidSets } from './LaidSets.js';
import { PlayerBadge } from './PlayerBadge.js';
import { RulesPanel } from './RulesPanel.js';

export function GameTable() {
  const { t, locale } = useT();
  const { view, playerId, setLocale, leaveRoom, status, sendAction, events } = useGame();
  const [showRules, setShowRules] = useState(false);
  const [sound, setSound] = useState(soundEnabled);
  const [hoverTargetId, setHoverTargetId] = useState<string | null>(null);
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null);
  const [askRank, setAskRank] = useState<Rank | null>(null);

  const totemRef = useRef<HTMLDivElement>(null);
  const totemRect = useRef<DOMRect | null>(null);
  const tableRef = useRef<HTMLDivElement>(null);

  // §6.3/§6.5 — each event that arrived gets its beat, in order, against the table.
  useEventBeats(events, tableRef);

  // §6.4 — the totem travels to the post whose turn it is, and lands with a knock.
  // A FLIP: the slot moves it instantly, then we animate it back from where it was.
  const currentPlayerId = view?.currentPlayerId;
  useLayoutEffect(() => {
    const el = totemRef.current;
    if (!el) {
      totemRect.current = null;
      return;
    }
    const next = el.getBoundingClientRect();
    const prev = totemRect.current;
    totemRect.current = next;
    if (!prev || prefersReducedMotion()) return;
    const dx = prev.left - next.left;
    const dy = prev.top - next.top;
    if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
    el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'translate(0,0)' }], {
      duration: DUR.heavy,
      easing: EASE.settle,
    });
    play('knock');
  }, [currentPlayerId]);

  if (!view) {
    return (
      <div className="screen screen--centered">
        <p className="muted">{t('game.reconnecting')}</p>
      </div>
    );
  }

  const isGameOver = view.status === 'ENDED';
  const isMyTurn = view.currentPlayerId === playerId;
  const canAsk = isMyTurn && view.pendingWindow === null;
  const askableRanks = [...new Set(view.hand.filter((c) => c.rank !== 'eggs').map((c) => c.rank))] as Rank[];
  const activeTargetId = hoverTargetId ?? selectedTargetId;

  function askPlayer(targetId: string, rank: Rank) {
    play('stamp');
    sendAction({ type: 'REQUEST', playerId: playerId!, targetId, rank } as Action);
    setSelectedTargetId(null);
    setHoverTargetId(null);
    setAskRank(null);
  }

  function toggleSound() {
    const next = !sound;
    setSound(next);
    setSoundEnabled(next);
    if (next) play('knock');
  }

  return (
    <div className={`game-screen ${status === 'closed' ? 'is-desaturated' : ''}`}>
      <header className="game-header">
        <div className={`game-header__turn ${isMyTurn ? '' : 'is-theirs'}`}>
          {isGameOver
            ? t('game.gameOver')
            : isMyTurn
              ? t('game.yourTurn')
              : t('game.turnOf', { name: view.players.find((p) => p.id === view.currentPlayerId)?.name ?? '' })}
        </div>
        <div className="game-header__controls">
          {LOCALES.map((l) => (
            <button
              key={l}
              type="button"
              className={`btn btn--chip ${l === locale ? 'is-active' : ''}`}
              onClick={() => setLocale(l)}
            >
              {l.toUpperCase()}
            </button>
          ))}
          <button
            type="button"
            className="btn btn--small"
            onClick={toggleSound}
            aria-pressed={sound}
            title={sound ? t('game.sound') : t('game.soundOff')}
          >
            {sound ? t('game.sound') : t('game.soundOff')}
          </button>
          <button type="button" className="btn btn--small" onClick={() => setShowRules(true)}>
            {t('lobby.rules')}
          </button>
        </div>
      </header>

      <InterruptPrompt />

      {/* The shake lands here, not on the screen: a transform on an ancestor would
          re-anchor the fixed window frame and plank and make them jump with it. */}
      <div className="table-row" ref={tableRef}>
        <PoolStack count={view.poolCount} label={t('game.inPool')} />

        <div className="player-row">
          {view.players.map((p) => {
            const isYou = p.id === playerId;
            const askable = canAsk && !isYou && !p.stunned;
            const active = askable && activeTargetId === p.id;
            const hasTotem = p.id === view.currentPlayerId;
            return (
              <div key={p.id} className="player-row__item">
                <div className="totem-slot">{hasTotem && <div ref={totemRef}><Totem /></div>}</div>
                <PlayerBadge
                  player={p}
                  isYou={isYou}
                  isCurrent={hasTotem}
                  askable={askable}
                  active={active}
                  askableRanks={askableRanks}
                  onEnter={() => askable && setHoverTargetId(p.id)}
                  onLeave={() => setHoverTargetId((h) => (h === p.id ? null : h))}
                  onSelect={() => setSelectedTargetId((cur) => (cur === p.id ? null : p.id))}
                  onPickRank={(rank) => askPlayer(p.id, rank)}
                />
                <LaidSets ownerId={p.id} />
              </div>
            );
          })}
        </div>
      </div>

      <div className="game-main">
        <EventLog />
        <Hand
          askTargetId={selectedTargetId}
          askRank={askRank}
          onPickRank={setAskRank}
          onAsk={() => selectedTargetId && askRank && askPlayer(selectedTargetId, askRank)}
        />
      </div>

      {status === 'closed' && <div className="reconnect-banner">{t('game.reconnecting')}</div>}

      {isGameOver && <GameOverOverlay onNewGame={leaveRoom} />}

      {showRules && <RulesPanel onClose={() => setShowRules(false)} />}
    </div>
  );
}

/** §5.7 — the table is rebuilt as a podium. The winner's post stands taller and keeps
 *  the totem; everyone else keeps their roe. */
function GameOverOverlay({ onNewGame }: { onNewGame: () => void }) {
  const { t } = useT();
  const { view } = useGame();
  if (!view) return null;

  const ranked = view.players.slice().sort((a, b) => b.score - a.score);

  return (
    <div className="modal-overlay">
      <div className="gameover">
        <h2 className="gameover__title">{t('game.gameOver')}</h2>
        <div className="gameover__posts">
          {ranked.map((p) => {
            const isWinner = view.winners.includes(p.id);
            return (
              <div key={p.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                {isWinner && <Totem size={40} />}
                <div className={`gameover__post ${isWinner ? 'is-winner' : ''}`}>
                  <div className="gameover__name">{p.name}</div>
                  <RoePips score={p.score} title={`${t('game.score')}: ${p.score}`} />
                  {isWinner && <div className="gameover__crown">{t('game.winnerTag')}</div>}
                </div>
              </div>
            );
          })}
        </div>
        <button className="btn btn--primary" onClick={onNewGame}>
          {t('game.newGame')}
        </button>
      </div>
    </div>
  );
}
