import type { Action, Rank } from '@pescuit/engine';
import { useMemo } from 'react';
import { Seal } from '../art/seals.js';
import { findLayableSets } from '../game/layable.js';
import { useT } from '../i18n/useT.js';
import { play } from '../sound.js';
import { useGame } from '../state/store.js';
import { Card } from './Card.js';

/** A big hand overlaps harder so it still fits the panel instead of scrolling away. */
function fanBite(count: number): number {
  return Math.min(20 + Math.max(0, count - 6) * 9, 74);
}

/**
 * §5.4 — your hand is held as a hand: overlapped, fanned, lifting under the cursor.
 * Tap a post, then a card, and the ask reads as a sentence before you commit to it.
 */
export function Hand({
  askTargetId,
  askRank,
  onPickRank,
  onAsk,
}: {
  askTargetId: string | null;
  askRank: Rank | null;
  onPickRank: (rank: Rank) => void;
  onAsk: () => void;
}) {
  const { t, rank } = useT();
  const { view, playerId, sendAction } = useGame();

  const hand = view?.hand ?? [];
  const layable = useMemo(() => findLayableSets(hand), [hand]);

  if (!view || !playerId) return null;

  const isMyTurn = view.currentPlayerId === playerId;
  const canAsk = isMyTurn && view.pendingWindow === null;
  const targetName = view.players.find((p) => p.id === askTargetId)?.name ?? '';

  function lay(set: { rank: Rank; cardIds: string[] }) {
    play('stamp');
    sendAction({ type: 'LAY_SET', playerId: playerId!, rank: set.rank, cardIds: set.cardIds } as Action);
  }

  return (
    <div className="hand-panel">
      <div className="hand-panel__head">
        <h3 className="hand-panel__title">{t('game.yourHand')}</h3>
        {canAsk && <span className="hand-panel__hint">{t('game.handHint')}</span>}
      </div>

      <div className="hand-panel__cards">
        {hand.length === 0 ? (
          <p className="hand-panel__hint">—</p>
        ) : (
          <div className="hand-fan" style={{ ['--fan-bite' as string]: `-${fanBite(hand.length)}px` }}>
            {hand.map((c) => (
              <Card
                key={c.id}
                rank={c.rank}
                size="lg"
                selected={canAsk && askRank === c.rank && c.rank !== 'eggs'}
                onClick={canAsk && c.rank !== 'eggs' ? () => onPickRank(c.rank) : undefined}
              />
            ))}
          </div>
        )}
      </div>

      {layable.length > 0 && (
        <div className="hand-panel__lay">
          {layable.map((s) => (
            <button key={`${s.rank}-${s.eggCount}`} type="button" className="btn btn--primary btn--small" onClick={() => lay(s)}>
              {t('game.layButton')} · {rank(s.rank)}
              {s.eggCount > 0 && ` ${s.eggCount === 1 ? t('game.eggBonusOne') : t('game.eggBonus', { count: s.eggCount })}`}
            </button>
          ))}
        </div>
      )}

      {canAsk && (
        <div className="hand-panel__ask">
          <span className="hand-panel__ask-text">
            {askTargetId && askRank ? (
              <>
                <Seal rank={askRank} size={16} inline />{' '}
                {t('game.askingFor', { rank: rank(askRank), name: targetName })}
              </>
            ) : (
              t('game.handHint')
            )}
          </span>
          <button type="button" className="btn btn--ink" disabled={!askTargetId || !askRank} onClick={onAsk}>
            {t('game.ask')}
          </button>
        </div>
      )}
    </div>
  );
}
