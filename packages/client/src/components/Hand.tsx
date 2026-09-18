import type { Action } from '@pescuit/engine';
import { useMemo, useState } from 'react';
import { findLayableSets } from '../game/layable.js';
import { useT } from '../i18n/useT.js';
import { useGame } from '../state/store.js';
import { Card } from './Card.js';

export function Hand() {
  const { t, rank } = useT();
  const { view, playerId, sendAction } = useGame();
  const [askTarget, setAskTarget] = useState('');
  const [askRank, setAskRank] = useState('');

  const hand = view?.hand ?? [];
  const layable = useMemo(() => findLayableSets(hand), [hand]);

  if (!view || !playerId) return null;

  const me = view.players.find((p) => p.id === playerId);
  const isMyTurn = view.currentPlayerId === playerId;
  const canAsk = isMyTurn && view.pendingWindow === null;
  const askableRanks = [...new Set(hand.filter((c) => c.rank !== 'eggs').map((c) => c.rank))];
  const others = view.players.filter((p) => p.id !== playerId && !p.stunned);

  function lay(set: { rank: string; cardIds: string[] }) {
    sendAction({ type: 'LAY_SET', playerId: playerId!, rank: set.rank as any, cardIds: set.cardIds } as Action);
  }

  function ask() {
    if (!askTarget || !askRank) return;
    sendAction({ type: 'REQUEST', playerId: playerId!, targetId: askTarget, rank: askRank as any } as Action);
    setAskTarget('');
    setAskRank('');
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

      {canAsk && (
        <div className="ask-form">
          <select value={askTarget} onChange={(e) => setAskTarget(e.target.value)}>
            <option value="">{t('game.askWho')}</option>
            {others.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <select value={askRank} onChange={(e) => setAskRank(e.target.value)}>
            <option value="">{t('game.askWhat')}</option>
            {askableRanks.map((r) => (
              <option key={r} value={r}>
                {rank(r)}
              </option>
            ))}
          </select>
          <button className="btn btn--primary" disabled={!askTarget || !askRank} onClick={ask}>
            {t('game.askButton')}
          </button>
        </div>
      )}
    </div>
  );
}
