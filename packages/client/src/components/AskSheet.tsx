import type { Rank, RedactedView } from '@pescuit/engine';
import { FanIcon, HookIcon, Mark, markForSeat, PowerPips, ShellIcon } from '../art/marks.js';
import { Seal } from '../art/seals.js';
import { opponentsInOrder, seatFacts } from '../game/seatFacts.js';
import { useT } from '../i18n/useT.js';

/**
 * §4.4 - the phone's ask sheet. While it is open it takes the pond's row (never the strip above or
 * the dock below), so the hand stays in view for a re-pick. Asks are untimed, so it sits mid-screen
 * rather than in the thumb zone. It carries the facts an ask depends on: a protected target shows the
 * shell and the protected rank's seal (and warns when that is the rank being asked); unused power
 * sets are pips, face-up ones seals; stunned players are disabled; absent ones are marked "plecat".
 */
export function AskSheet({
  view,
  me,
  rank: asked,
  keyTarget,
  onAsk,
  onClose,
}: {
  view: RedactedView;
  me: string;
  rank: Rank;
  /** the target the keyboard is on */
  keyTarget: string | null;
  onAsk: (targetId: string) => void;
  onClose: () => void;
}) {
  const { t, rank } = useT();
  const opponents = opponentsInOrder(view, me);
  return (
    <div className="sheet" data-sheet role="dialog" aria-label={t('ask.title', { rank: rank(asked) })}>
      <div className="sheet__title">
        <Seal rank={asked} size={16} color="#17120e" />
        <span className="sheet__title-text">{t('ask.title', { rank: rank(asked) })}</span>
        <button type="button" className="sheet__close" aria-label={t('ask.close')} onClick={onClose}>
          ×
        </button>
      </div>
      <div className="sheet__grid">
        {opponents.map((p) => {
          const facts = seatFacts(view, p.id);
          const blocks = p.protectedRanks.includes(asked);
          const prot = p.protectedRanks[0];
          return (
            <button
              key={p.id}
              type="button"
              className={['sheet__who', p.stunned ? 'is-off' : '', blocks ? 'is-warn' : '', keyTarget === p.id ? 'is-target' : ''].filter(Boolean).join(' ')}
              disabled={p.stunned}
              data-player-id={p.id}
              data-askable={!p.stunned}
              onClick={() => onAsk(p.id)}
            >
              <Mark id={markForSeat(view.turnOrder, p.id)} size={18} color="#17120e" />
              <span className="sheet__name">{p.name}</span>
              <span className="sheet__meta">
                {p.stunned ? (
                  <>
                    <Seal rank="jellyfish" size={12} color="#3b322a" /> {t('ask.stunned')}
                  </>
                ) : (
                  <>
                    {prot && (
                      <>
                        <ShellIcon /> {blocks ? t('ask.willBlock') : t('ask.protects')} <Seal rank={prot} size={12} color="#17120e" />
                      </>
                    )}
                    {!prot && (
                      <>
                        <FanIcon /> <span className="num">{p.handSize}</span>
                        {facts.unused > 0 && (
                          <>
                            {' '}
                            · {facts.faceUpUnused.length > 0 ? facts.faceUpUnused.map((r, i) => <Seal key={i} rank={r} size={12} color="#17120e" />) : <PowerPips unused={facts.unused} used={0} />}
                          </>
                        )}
                      </>
                    )}
                    {!p.connected && (
                      <>
                        {' '}
                        · <HookIcon size={11} color="#a8392a" /> {t('ask.away')}
                      </>
                    )}
                  </>
                )}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
