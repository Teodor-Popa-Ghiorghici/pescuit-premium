import type { Action, NormalRank, PowerRank } from '@pescuit/engine';
import { NORMAL_RANKS } from '@pescuit/engine';
import { useEffect, useState } from 'react';
import { useT } from '../i18n/useT.js';
import { useGame } from '../state/store.js';

const WINDOW_RANKS: Record<string, PowerRank[]> = {
  TURN_START: ['jellyfish', 'stickleback', 'whale'],
  REQUEST_DECLARED: ['lanternfish'],
  RESPONSE_PENDING: ['squid'],
  TRANSFER_PENDING: ['tortoise'],
  SET_COMPLETED: ['mantisShrimp'],
  TURN_END: ['shark'],
};

export function InterruptPrompt() {
  const { t, rank } = useT();
  const { view, sendAction, playerId } = useGame();
  const window_ = view?.pendingWindow;
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  const windowKey = window_ ? `${window_.type}:${JSON.stringify(window_.context)}` : null;
  useEffect(() => {
    if (!window_) {
      setSecondsLeft(null);
      return;
    }
    const totalMs = view?.config.windowTimeoutMs ?? 12000;
    const start = Date.now();
    setSecondsLeft(Math.ceil(totalMs / 1000));
    const id = setInterval(() => {
      const left = Math.max(0, Math.ceil((totalMs - (Date.now() - start)) / 1000));
      setSecondsLeft(left);
    }, 250);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [windowKey]);

  if (!window_ || !view) return null;

  const nameOf = (id: string) => view.players.find((p) => p.id === id)?.name ?? id;
  const ctx = window_.context as Record<string, string | undefined>;

  const description = describeWindow(window_.type, ctx, nameOf, rank, t);

  if (!window_.youAreEligible) {
    return (
      <div className="interrupt-banner">
        <span>{description}</span>
        {secondsLeft !== null && <span className="interrupt-banner__timer">{t('window.countdown', { seconds: secondsLeft })}</span>}
      </div>
    );
  }

  const applicableRanks = WINDOW_RANKS[window_.type] ?? [];
  const myGrants = (view.ownPowerGrants ?? []).filter((g) => !g.used && applicableRanks.includes(g.rank as PowerRank));

  return (
    <div className="interrupt-prompt">
      <div className="interrupt-prompt__header">
        <strong>{description}</strong>
        {secondsLeft !== null && <span className="interrupt-prompt__timer">{secondsLeft}s</span>}
      </div>
      <p className="muted">{t(windowHintKey(window_.type))}</p>
      <DeclareForm windowType={window_.type} context={ctx} grants={myGrants} myPlayerId={playerId!} onDeclare={sendAction} />
      <button className="btn btn--ghost" onClick={() => sendAction({ type: 'SKIP_WINDOW' } as unknown as Action)}>
        {t('window.decline')}
      </button>
    </div>
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
  t: (k: string, p?: Record<string, string | number>) => string,
): string {
  switch (type) {
    case 'TURN_START':
      return `${nameOf(ctx.playerId ?? '')}: ${t('window.turnStart')}`;
    case 'REQUEST_DECLARED':
    case 'RESPONSE_PENDING':
      return `${nameOf(ctx.askerId ?? '')} -> ${nameOf(ctx.targetId ?? '')}: ${rankLabel(ctx.rank ?? '')}?`;
    case 'TRANSFER_PENDING':
      return `${nameOf(ctx.askerId ?? '')} -> ${nameOf(ctx.targetId ?? '')}: ${rankLabel(ctx.rank ?? '')}`;
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
  const [tortoiseRank, setTortoiseRank] = useState(context.rank ?? '');
  const [squidLie, setSquidLie] = useState<'deny' | 'claim'>('deny');
  const [whaleB, setWhaleB] = useState('');

  if (grants.length === 0) return null;
  const others = (view?.players ?? []).filter((p) => p.id !== myPlayerId);

  if (windowType === 'REQUEST_DECLARED') {
    const grant = grants.find((g) => g.rank === 'lanternfish');
    if (!grant) return null;
    return (
      <button className="btn btn--primary" onClick={() => onDeclare({ type: 'DECLARE_LANTERNFISH', playerId: myPlayerId, grantId: grant.id })}>
        {t('window.declare')} {rank('lanternfish')}
      </button>
    );
  }

  if (windowType === 'RESPONSE_PENDING') {
    const grant = grants.find((g) => g.rank === 'squid');
    if (!grant) return null;
    return (
      <div className="declare-form">
        <select value={squidLie} onChange={(e) => setSquidLie(e.target.value as 'deny' | 'claim')}>
          <option value="deny">{t('power.squid.deny')}</option>
          <option value="claim">{t('power.squid.claim')}</option>
        </select>
        <button
          className="btn btn--primary"
          onClick={() => onDeclare({ type: 'DECLARE_SQUID', playerId: myPlayerId, grantId: grant.id, lie: squidLie })}
        >
          {t('window.declare')} {rank('squid')}
        </button>
      </div>
    );
  }

  if (windowType === 'TRANSFER_PENDING') {
    const grant = grants.find((g) => g.rank === 'tortoise');
    if (!grant) return null;
    return (
      <button
        className="btn btn--primary"
        onClick={() => onDeclare({ type: 'DECLARE_TORTOISE', playerId: myPlayerId, grantId: grant.id, rank: (context.rank ?? tortoiseRank) as any })}
      >
        {t('window.declare')} {rank('tortoise')}
      </button>
    );
  }

  if (windowType === 'SET_COMPLETED') {
    const grant = grants.find((g) => g.rank === 'mantisShrimp');
    if (!grant) return null;
    return (
      <button className="btn btn--primary" onClick={() => onDeclare({ type: 'DECLARE_MANTIS', playerId: myPlayerId, grantId: grant.id })}>
        {t('window.declare')} {rank('mantisShrimp')}
      </button>
    );
  }

  if (windowType === 'TURN_END') {
    const grant = grants.find((g) => g.rank === 'shark');
    if (!grant) return null;
    return (
      <button className="btn btn--primary" onClick={() => onDeclare({ type: 'DECLARE_SHARK', playerId: myPlayerId, grantId: grant.id })}>
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
                  className="btn btn--primary"
                  disabled={!targetId}
                  onClick={() => onDeclare({ type: 'USE_JELLYFISH', playerId: myPlayerId, grantId: g.id, targetId })}
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
                <select value={stickRank} onChange={(e) => setStickRank(e.target.value as (typeof NORMAL_RANKS)[number])}>
                  {NORMAL_RANKS.map((r) => (
                    <option key={r} value={r}>
                      {rank(r)}
                    </option>
                  ))}
                </select>
                <button
                  className="btn btn--primary"
                  disabled={!targetId}
                  onClick={() =>
                    onDeclare({ type: 'USE_STICKLEBACK', playerId: myPlayerId, grantId: g.id, targetId, rank: stickRank })
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
                <span>{t('power.whale.pair')}:</span>
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
                  className="btn btn--primary"
                  disabled={!targetId || !whaleB || targetId === whaleB}
                  onClick={() =>
                    onDeclare({
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
