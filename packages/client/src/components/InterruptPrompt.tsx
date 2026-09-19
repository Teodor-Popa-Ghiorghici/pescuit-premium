import type { Action, NormalRank, PowerRank, Rank } from '@pescuit/engine';
import { NORMAL_RANKS } from '@pescuit/engine';
import { useEffect, useState } from 'react';
import { NotchClock } from '../art/table.js';
import { useT } from '../i18n/useT.js';
import { play } from '../sound.js';
import { useGame } from '../state/store.js';
import { Card } from './Card.js';

const WINDOW_RANKS: Record<string, PowerRank[]> = {
  TURN_START: ['jellyfish', 'stickleback', 'whale'],
  REQUEST_DECLARED: ['lanternfish'],
  RESPONSE_PENDING: ['squid'],
  TRANSFER_PENDING: ['tortoise'],
  SET_COMPLETED: ['mantisShrimp'],
  TURN_END: ['shark'],
};

/**
 * §5.5 — a window you can act in takes over the frame of the screen, not its
 * contents: an inset ochre border burns on steps(3,end) and a plank rises from the
 * bottom edge. The table stays visible behind it, because it is still running.
 * A window you cannot act in is one thin board and a quiet clock.
 */
export function InterruptPrompt() {
  const { t, rank } = useT();
  const { view, sendAction, playerId } = useGame();
  const window_ = view?.pendingWindow;
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  const totalMs = view?.config.windowTimeoutMs ?? 12000;
  const windowKey = window_ ? `${window_.type}:${JSON.stringify(window_.context)}` : null;
  const eligible = !!window_?.youAreEligible;

  useEffect(() => {
    if (!windowKey) {
      setSecondsLeft(null);
      return;
    }
    const start = Date.now();
    setSecondsLeft(Math.ceil(totalMs / 1000));
    const id = setInterval(() => {
      setSecondsLeft(Math.max(0, Math.ceil((totalMs - (Date.now() - start)) / 1000)));
    }, 250);
    return () => clearInterval(id);
  }, [windowKey, totalMs]);

  // The window opening is one of the four beats of §6.5 — it gets a sound, once.
  useEffect(() => {
    if (windowKey && eligible) play('chime');
  }, [windowKey, eligible]);

  if (!window_ || !view) return null;

  const nameOf = (id: string) => view.players.find((p) => p.id === id)?.name ?? id;
  const ctx = window_.context as Record<string, string | undefined>;
  const who = describeWindow(window_.type, ctx, nameOf, rank);
  const total = Math.ceil(totalMs / 1000);

  if (!eligible) {
    return (
      <div className="interrupt-banner">
        <span>
          {who} — {t('game.windowOpen')}
        </span>
        {secondsLeft !== null && <NotchClock secondsLeft={secondsLeft} total={total} compact />}
      </div>
    );
  }

  const applicableRanks = WINDOW_RANKS[window_.type] ?? [];
  const myGrants = (view.ownPowerGrants ?? []).filter((g) => !g.used && applicableRanks.includes(g.rank as PowerRank));

  const clock = secondsLeft !== null ? <NotchClock secondsLeft={secondsLeft} total={total} /> : null;

  const body =
    window_.type === 'RESPONSE_PENDING' ? (
      <ResponsePendingPrompt
        who={who}
        rankAsked={ctx.rank ?? ''}
        hand={view.hand}
        squidGrant={myGrants.find((g) => g.rank === 'squid')}
        playerId={playerId!}
        clock={clock}
        onDeclare={sendAction}
      />
    ) : (
      <>
        <div className="interrupt-prompt__say">
          <div className="interrupt-prompt__headline">{t(windowHintKey(window_.type))}</div>
          <div className="interrupt-prompt__sub">{who}</div>
        </div>
        <div className="interrupt-prompt__controls">
          {clock}
          <div className="interrupt-prompt__actions">
            <DeclareForm windowType={window_.type} context={ctx} grants={myGrants} myPlayerId={playerId!} onDeclare={sendAction} />
            <button className="btn btn--ghost" onClick={() => sendAction({ type: 'SKIP_WINDOW' } as unknown as Action)}>
              {t('window.decline')}
            </button>
          </div>
        </div>
      </>
    );

  return (
    <>
      <div className="window-frame" aria-hidden="true" />
      <div className="interrupt-prompt__context">
        <div className="interrupt-prompt__who">{who}</div>
        <div className="interrupt-prompt__aside">{t('game.tableContinues')}</div>
      </div>
      <div className="interrupt-prompt" role="dialog" aria-live="assertive">
        <WindowCard grants={myGrants} fallback={(ctx.rank ?? null) as Rank | null} />
        <div className="interrupt-prompt__body">{body}</div>
      </div>
    </>
  );
}

/** The plank carries the card it is about: the power you may spend, or failing that
 *  the rank being fought over. */
function WindowCard({ grants, fallback }: { grants: { rank: string }[]; fallback: Rank | null }) {
  const shown = (grants[0]?.rank ?? fallback) as Rank | null;
  if (!shown) return null;
  return <Card rank={shown} size="md" />;
}

/**
 * The target of a REQUEST always sees this, squid or not: the player being asked is
 * the one who says "Pescuiește!" (or hands the cards over), never the engine on their
 * behalf. See DECISIONS.md ("Every response is a window, not just squid's").
 */
function ResponsePendingPrompt({
  who,
  rankAsked,
  hand,
  squidGrant,
  playerId,
  clock,
  onDeclare,
}: {
  who: string;
  rankAsked: string;
  hand: { rank: string }[];
  squidGrant: { id: string; rank: string } | undefined;
  playerId: string;
  clock: React.ReactNode;
  onDeclare: (a: Action) => void;
}) {
  const { t, rank } = useT();
  const iHaveIt = hand.some((c) => c.rank === rankAsked);

  return (
    <>
      <div className="interrupt-prompt__say">
        <div className="interrupt-prompt__headline">{who}</div>
        <div className="interrupt-prompt__sub">{t('window.responsePending')}</div>
      </div>
      <div className="interrupt-prompt__controls">
        {clock}
        <div className="interrupt-prompt__actions">
        <button
          className="btn btn--go"
          onClick={() => {
            play('stamp');
            onDeclare({ type: 'SKIP_WINDOW' } as unknown as Action);
          }}
        >
          {iHaveIt ? t('window.hereYouGo') : t('window.goFish')}
        </button>
        {squidGrant && (
          <button
            className="btn btn--ghost"
            onClick={() =>
              onDeclare({
                type: 'DECLARE_SQUID',
                playerId,
                grantId: squidGrant.id,
                lie: iHaveIt ? 'deny' : 'claim',
              })
            }
            title={t('power.squid.lieHint')}
          >
            {t('window.declare')} {rank('squid')}
          </button>
        )}
        </div>
      </div>
    </>
  );
}

function windowHintKey(type: string): string {
  switch (type) {
    case 'TURN_START':
      return 'window.turnStart';
    case 'REQUEST_DECLARED':
      return 'window.requestDeclared';
    case 'RESPONSE_PENDING':
      return 'window.responsePending';
    case 'TRANSFER_PENDING':
      return 'window.transferPending';
    case 'SET_COMPLETED':
      return 'window.setCompleted';
    case 'TURN_END':
      return 'window.turnEnd';
    default:
      return '';
  }
}

function describeWindow(
  type: string,
  ctx: Record<string, string | undefined>,
  nameOf: (id: string) => string,
  rankLabel: (r: string) => string,
): string {
  switch (type) {
    case 'TURN_START':
      return nameOf(ctx.playerId ?? '');
    case 'REQUEST_DECLARED':
    case 'RESPONSE_PENDING':
      return `${nameOf(ctx.askerId ?? '')} → ${nameOf(ctx.targetId ?? '')}: ${rankLabel(ctx.rank ?? '')}?`;
    case 'TRANSFER_PENDING':
      return `${nameOf(ctx.askerId ?? '')} → ${nameOf(ctx.targetId ?? '')}: ${rankLabel(ctx.rank ?? '')}`;
    case 'SET_COMPLETED':
      return `${nameOf(ctx.ownerId ?? '')} ${ctx.rank ? `(${rankLabel(ctx.rank)})` : ''}`;
    case 'TURN_END':
      return `${nameOf(ctx.gainerId ?? ctx.askerId ?? '')}: ${rankLabel(ctx.rank ?? '')}`;
    default:
      return '';
  }
}

function DeclareForm({
  windowType,
  context,
  grants,
  myPlayerId,
  onDeclare,
}: {
  windowType: string;
  context: Record<string, string | undefined>;
  grants: { id: string; rank: string }[];
  myPlayerId: string;
  onDeclare: (a: Action) => void;
}) {
  const { t, rank } = useT();
  const { view } = useGame();
  const [targetId, setTargetId] = useState('');
  const [stickRank, setStickRank] = useState<NormalRank>(NORMAL_RANKS[0]);
  const [tortoiseRank] = useState(context.rank ?? '');
  const [whaleB, setWhaleB] = useState('');

  if (grants.length === 0) return null;
  const others = (view?.players ?? []).filter((p) => p.id !== myPlayerId);

  function declare(action: Action) {
    play('stamp');
    onDeclare(action);
  }

  if (windowType === 'REQUEST_DECLARED') {
    const grant = grants.find((g) => g.rank === 'lanternfish');
    if (!grant) return null;
    return (
      <button
        className="btn btn--go"
        onClick={() => declare({ type: 'DECLARE_LANTERNFISH', playerId: myPlayerId, grantId: grant.id })}
      >
        {t('window.declare')} {rank('lanternfish')}
      </button>
    );
  }

  if (windowType === 'TRANSFER_PENDING') {
    const grant = grants.find((g) => g.rank === 'tortoise');
    if (!grant) return null;
    return (
      <button
        className="btn btn--go"
        onClick={() =>
          declare({
            type: 'DECLARE_TORTOISE',
            playerId: myPlayerId,
            grantId: grant.id,
            rank: (context.rank ?? tortoiseRank) as Rank,
          })
        }
      >
        {t('window.declare')} {rank('tortoise')}
      </button>
    );
  }

  if (windowType === 'SET_COMPLETED') {
    const grant = grants.find((g) => g.rank === 'mantisShrimp');
    if (!grant) return null;
    return (
      <button
        className="btn btn--go"
        onClick={() => declare({ type: 'DECLARE_MANTIS', playerId: myPlayerId, grantId: grant.id })}
      >
        {t('window.declare')} {rank('mantisShrimp')}
      </button>
    );
  }

  if (windowType === 'TURN_END') {
    const grant = grants.find((g) => g.rank === 'shark');
    if (!grant) return null;
    return (
      <button className="btn btn--go" onClick={() => declare({ type: 'DECLARE_SHARK', playerId: myPlayerId, grantId: grant.id })}>
        {t('window.declare')} {rank('shark')}
      </button>
    );
  }

  if (windowType === 'TURN_START') {
    return (
      <div className="declare-form declare-form--stack">
        {grants.map((g) => {
          if (g.rank === 'jellyfish') {
            return (
              <div key={g.id} className="declare-form__row">
                <select value={targetId} onChange={(e) => setTargetId(e.target.value)}>
                  <option value="">{t('power.jellyfish.target')}</option>
                  {others.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <button
                  className="btn btn--go"
                  disabled={!targetId}
                  onClick={() => declare({ type: 'USE_JELLYFISH', playerId: myPlayerId, grantId: g.id, targetId })}
                >
                  {t('window.declare')} {rank('jellyfish')}
                </button>
              </div>
            );
          }
          if (g.rank === 'stickleback') {
            return (
              <div key={g.id} className="declare-form__row">
                <select value={targetId} onChange={(e) => setTargetId(e.target.value)}>
                  <option value="">{t('power.stickleback.target')}</option>
                  {others.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <select value={stickRank} onChange={(e) => setStickRank(e.target.value as NormalRank)}>
                  {NORMAL_RANKS.map((r) => (
                    <option key={r} value={r}>
                      {rank(r)}
                    </option>
                  ))}
                </select>
                <button
                  className="btn btn--go"
                  disabled={!targetId}
                  onClick={() =>
                    declare({ type: 'USE_STICKLEBACK', playerId: myPlayerId, grantId: g.id, targetId, rank: stickRank })
                  }
                >
                  {t('window.declare')} {rank('stickleback')}
                </button>
              </div>
            );
          }
          if (g.rank === 'whale') {
            return (
              <div key={g.id} className="declare-form__row">
                <span className="interrupt-prompt__sub">{t('power.whale.pair')}:</span>
                <select value={targetId} onChange={(e) => setTargetId(e.target.value)}>
                  <option value="">A</option>
                  {(view?.players ?? []).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <select value={whaleB} onChange={(e) => setWhaleB(e.target.value)}>
                  <option value="">B</option>
                  {(view?.players ?? []).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <button
                  className="btn btn--go"
                  disabled={!targetId || !whaleB || targetId === whaleB}
                  onClick={() =>
                    declare({
                      type: 'USE_WHALE',
                      playerId: myPlayerId,
                      grantId: g.id,
                      targetAId: targetId,
                      targetBId: whaleB,
                    })
                  }
                >
                  {t('window.declare')} {rank('whale')}
                </button>
              </div>
            );
          }
          return null;
        })}
      </div>
    );
  }

  return null;
}
