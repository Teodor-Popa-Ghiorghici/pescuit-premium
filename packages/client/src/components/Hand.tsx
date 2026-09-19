import type { Action } from '@pescuit/engine';
import { useMemo } from 'react';
import { findLayableSets } from '../game/layable.js';
import { useT } from '../i18n/useT.js';
import { useGame } from '../state/store.js';
import { Card } from './Card.js';

export function Hand() {
  const { t, rank } = useT();
  const { view, playerId, sendAction } = useGame();

  const hand = view?.hand ?? [];
  const layable = useMemo(() => findLayableSets(hand), [hand]);

  if (!view || !playerId) return null;

  const me = view.players.find((p) => p.id === playerId);
  const isMyTurn = view.currentPlayerId === playerId;
  const canAsk = isMyTurn && view.pendingWindow === null;

  function lay(set: { rank: string; cardIds: string[] }) {
    sendAction({ type: 'LAY_SET', playerId: playerId!, rank: set.rank as any, cardIds: set.cardIds } as Action);
  }

  return (
    <div className="hand-panel">
      <h3 className="hand-panel__title">
        {t('game.yourHand')} ({me?.score ?? 0} {t('game.score').toLowerCase()})
      </h3>
      <div className="hand-panel__cards">
        {hand.map((c) => (
          <Card key={c.id} rank={c.rank} />
        ))}
        {hand.length === 0 && <p className="muted">—</p>}
      </div>

      {layable.length > 0 && (
        <div className="hand-panel__lay">
          <span>{t('game.laySet')}:</span>
          {layable.map((s) => (
            <button key={s.rank + s.eggCount} className="btn btn--small" onClick={() => lay(s)}>
              {rank(s.rank)} {s.eggCount > 0 ? `(+${s.eggCount} 🥚)` : ''}
            </button>
          ))}
        </div>
      )}

      {canAsk && <p className="hand-panel__ask-hint muted">{t('game.askHint')}</p>}
    </div>
  );
}
