import { useEffect, useLayoutEffect, useRef } from 'react';
import { presenter } from '../game/presenter.js';
import { Mark, markForSeat } from '../art/marks.js';
import { Totem } from '../art/table.js';
import { useT } from '../i18n/useT.js';
import { useGame } from '../state/store.js';

/** the same reasons the engine ends a game for, each with its own short copy (§5.7) */
const REASON_KEY: Record<string, string> = {
  decided: 'game.endDecided',
  streak: 'game.endStreak',
  exhausted: 'game.endExhausted',
};

/** The pips of one post: earned ones count up, one after another, from the moment the podium shows (the
 *  `table.tally` cues are placed on the same steps by the choreography). CSS does the counting: an
 *  earned pip starts empty and fills at `--i` steps once `[data-podium]` loses its mask. */
function CountPips({ score }: { score: number }) {
  const slots = Math.max(5, score);
  return (
    <div className="podium__pips" aria-hidden="true">
      {Array.from({ length: slots }, (_, i) => (
        <svg key={i} className={i < score ? 'podium__pip is-earned' : 'podium__pip'} style={{ ['--i' as string]: i }} width="16" height="16" viewBox="0 0 16 16" focusable="false">
          <circle cx="8" cy="8" r="7" />
        </svg>
      ))}
    </div>
  );
}

/**
 * §5.7 - the table is rebuilt as a podium, after the last lay's stamp, one held beat and the gate doors
 * (the presenter unmasks it). The winners' posts rise; a tie is equal totems on equal posts; the pips count
 * up with `table.tally` per pip; the reason the game ended has its own short line. Loaded when a game is
 * on, so it costs the lobby nothing.
 */
export default function Podium({ onNewGame }: { onNewGame: () => void }) {
  const { t } = useT();
  const { view, local } = useGame();
  const btn = useRef<HTMLButtonElement>(null);
  // this mounts after the table's own render (a lazy chunk): it must be masked until the podium's beat lands
  useLayoutEffect(() => {
    presenter.afterRender();
  }, []);
  // the new-game button is where the keyboard goes once the podium is up
  useEffect(() => {
    const id = window.setTimeout(() => btn.current?.focus({ preventScroll: true }), 300);
    return () => window.clearTimeout(id);
  }, []);
  if (!view) return null;

  const ranked = view.players.slice().sort((a, b) => b.score - a.score);
  const winners = ranked.filter((p) => view.winners.includes(p.id));
  const tie = winners.length > 1;
  const reason = view.endReason ? t(REASON_KEY[view.endReason] ?? 'game.gameOver') : '';
  const names = winners.map((p) => p.name).join(', ');
  const headline = winners.length === 0 ? t('game.gameOver') : tie ? t('game.winners', { names }) : t('game.winner', { name: names });
  const top = Math.max(1, ...ranked.map((p) => p.score));

  return (
    <div className="modal-overlay modal-overlay--solid" data-podium role="dialog" aria-label={t('game.gameOver')}>
      <div className="gameover">
        <h2 className="gameover__title">{tie ? t('game.tie') : t('game.gameOver')}</h2>
        <p className="gameover__reason" role="status">
          {reason}
          <span className="sr-only"> {headline}</span>
        </p>
        <div className="gameover__posts">
          {ranked.map((p, i) => {
            const isWinner = view.winners.includes(p.id);
            const label = p.score === 1 ? t('game.podiumPostOne', { name: p.name }) : t('game.podiumPost', { name: p.name, score: p.score });
            return (
              <div key={p.id} className="gameover__col" style={{ ['--n' as string]: i }} role="group" aria-label={`${label}${isWinner ? `, ${t('game.winnerTag')}` : ''}`}>
                <div className="gameover__totem">{isWinner && <Totem size={40} />}</div>
                <div
                  className={`gameover__post ${isWinner ? 'is-winner' : ''}`}
                  style={{ ['--rise' as string]: (p.score / top).toFixed(2) }}
                >
                  <div className="gameover__name">
                    <Mark id={markForSeat(view.turnOrder, p.id)} size={14} color="#17120e" /> {p.name}
                  </div>
                  <CountPips score={p.score} />
                  <div className="gameover__score num">{p.score}</div>
                  {isWinner && <div className="gameover__crown">{t('game.winnerTag')}</div>}
                </div>
              </div>
            );
          })}
        </div>
        {!local && (
          <button ref={btn} className="btn btn--primary" onClick={onNewGame}>
            {t('game.newGame')}
          </button>
        )}
      </div>
    </div>
  );
}
