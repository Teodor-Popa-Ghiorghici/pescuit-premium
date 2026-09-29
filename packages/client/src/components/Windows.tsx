import type { NormalRank, PowerRank, Rank, RedactedPlayerView, RedactedView } from '@pescuit/engine';
import { NORMAL_RANKS } from '@pescuit/engine';
import { rankAbbr, type ClientAction } from '@pescuit/shared';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getEngine } from '../audio/engine.js';
import { localAnswerCue } from '../audio/cues.js';
import { Mark, markForSeat } from '../art/marks.js';
import { Seal } from '../art/seals.js';
import { NotchClock } from '../art/table.js';
import { shortName } from '../game/seatFacts.js';
import { useT } from '../i18n/useT.js';
import { presenter } from '../game/presenter.js';
import { useGame } from '../state/store.js';
import { Card } from './Card.js';

/* ------------------------------------------------------------------ plumbing */

const WINDOW_RANKS: Record<string, PowerRank[]> = {
  TURN_START: ['jellyfish', 'stickleback', 'whale'],
  REQUEST_DECLARED: ['lanternfish'],
  RESPONSE_PENDING: ['squid'],
  TRANSFER_PENDING: ['tortoise'],
  SET_COMPLETED: ['mantisShrimp'],
  TURN_END: ['shark'],
};

/** identifies one opening of one window: a re-render of the same window never resets what the plank holds */
export function windowKeyOf(view: RedactedView | null): string | null {
  const w = view?.pendingWindow;
  return w ? `${w.type}:${w.deadlineAt ?? ''}:${JSON.stringify(w.context)}` : null;
}

/** whole seconds left on the server's clock; null when the server sent no deadline */
export function useSecondsLeft(deadlineAt: number | null | undefined): number | null {
  const [, tick] = useState(0);
  useEffect(() => {
    if (deadlineAt == null) return;
    const id = setInterval(() => tick((n) => n + 1), 200);
    return () => clearInterval(id);
  }, [deadlineAt]);
  if (deadlineAt == null) return null;
  return Math.max(0, Math.ceil((deadlineAt - getEngine().server.serverNow(Date.now())) / 1000));
}

type Ctx = Record<string, string | undefined>;

function nameFor(view: RedactedView, id: string | undefined): string {
  return view.players.find((p) => p.id === id)?.name ?? id ?? '';
}

function describeWindow(type: string, ctx: Ctx, nameOf: (id: string) => string, rankLabel: (r: string) => string): string {
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

function hintKey(type: string): string {
  switch (type) {
    case 'TURN_START':
      return 'window.usePower';
    case 'REQUEST_DECLARED':
      return 'window.requestDeclared';
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

/* ------------------------------------------------------------------- banner */

/**
 * What everyone who cannot act in the open window sees, in the pond's ticker slot. The answer
 * window says who is answering; every other window stays neutral - "fereastră deschisă", never the
 * window's name (§6.6: a structural window's existence is the rules' own tell, its kind is not
 * ours to add).
 */
export function WindowBanner({ view }: { view: RedactedView }) {
  const { t } = useT();
  const w = view.pendingWindow;
  const left = useSecondsLeft(w?.deadlineAt);
  if (!w) return null;
  const ctx = w.context as Ctx;
  const text = w.type === 'RESPONSE_PENDING' ? t('window.answering', { name: nameFor(view, ctx.targetId) }) : t('game.windowOpen');
  const total = Math.ceil(view.config.windowTimeoutMs / 1000);
  return (
    <span className="banner" data-banner role="status">
      <span className="banner__text">{text}</span>
      {left !== null && <NotchClock secondsLeft={left} total={total} compact />}
    </span>
  );
}

/* -------------------------------------------------------------------- plank */

/** Keys the plank answers to: Space answers truthfully, D declares, Esc declines (§4.4). */
function useWindowKeys(handlers: { space?: () => void; d?: () => void; esc?: () => void }) {
  const ref = useRef(handlers);
  ref.current = handlers;
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT')) return;
      const h = ref.current;
      if (e.key === ' ' && h.space) {
        e.preventDefault();
        h.space();
      } else if ((e.key === 'd' || e.key === 'D') && h.d) {
        e.preventDefault();
        h.d();
      } else if (e.key === 'Escape' && h.esc) {
        e.preventDefault();
        h.esc();
      }
    };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, []);
}

/**
 * §5.2/§4.4 - a window you can act in: a plank rises over the dock. Its buttons are 56 px (44 px in
 * the power forms), and every one sits in the bottom 45 % of the screen, under the thumb. There is no
 * `<select>` under the clock: Jellyfish taps a target, Stickleback taps a target then one of eight
 * seals, Whale taps an adjacent pair, everything else is one button.
 *
 * The answer window's UI is identical whatever is said (Law 1, A8): two equal buttons, one plank
 * animation, one local cue. A declaration stamps and locks the plank at once (optimistic); if the
 * table was faster the GameTable says so ("Prea târziu - <name> a fost mai rapid.").
 */
export function Plank({ view, onDeclared }: { view: RedactedView; onDeclared: (key: string) => void }) {
  const { t, rank } = useT();
  const { sendAction, playerId } = useGame();
  const w = view.pendingWindow;
  const key = windowKeyOf(view);
  const [lockedKey, setLockedKey] = useState<string | null>(null);
  const locked = key !== null && lockedKey === key;

  const left = useSecondsLeft(w?.deadlineAt);
  const total = Math.ceil(view.config.windowTimeoutMs / 1000);

  // a server refusal unlocks the plank so the player can try again
  const { error } = useGame();
  useEffect(() => {
    if (error) setLockedKey(null);
  }, [error]);

  const send = useCallback(
    (action: ClientAction, opts: { cue?: boolean } = {}) => {
      if (!key || lockedKey === key) return;
      setLockedKey(key);
      onDeclared(key);
      // the answering device plays `clock.close` at its press - one cue for every answer, Squid included (§3.2).
      // A declaration or a pass in any other window is not public: no sound at all, visual only (§3.2's table)
      if (opts.cue) getEngine().playRequests([localAnswerCue(view.seq)]);
      presenter.press(view, !!opts.cue);
      sendAction(action);
    },
    [key, lockedKey, onDeclared, sendAction, view.seq],
  );

  const ctx = (w?.context ?? {}) as Ctx;
  const grants = useMemo(
    () => (view.ownPowerGrants ?? []).filter((g) => !g.used && (WINDOW_RANKS[w?.type ?? ''] ?? []).includes(g.rank as PowerRank)),
    [view.ownPowerGrants, w?.type],
  );

  /* ------ the answer window: two equal buttons, whatever is true */
  const isAnswer = w?.type === 'RESPONSE_PENDING';
  const squid = grants.find((g) => g.rank === 'squid');
  const asked = (ctx.rank ?? '') as Rank;
  const holds = view.hand.filter((c) => c.rank === asked).length;
  const truth = useCallback(() => send({ type: 'SKIP_WINDOW' } as ClientAction, { cue: true }), [send]);
  const lie = useCallback(() => {
    if (!squid) return;
    send({ type: 'DECLARE_SQUID', playerId: playerId!, grantId: squid.id, lie: holds > 0 ? 'deny' : 'claim' } as ClientAction, { cue: true });
  }, [send, squid, playerId, holds]);
  const decline = useCallback(() => send({ type: 'SKIP_WINDOW' } as ClientAction), [send]);

  // the single-button windows: D declares, Esc declines
  const single = useMemo(() => {
    if (!w || isAnswer) return null;
    const g = grants[0];
    if (!g) return null;
    if (w.type === 'REQUEST_DECLARED') return { grant: g, action: { type: 'DECLARE_LANTERNFISH', playerId, grantId: g.id } as ClientAction };
    if (w.type === 'TRANSFER_PENDING') return { grant: g, action: { type: 'DECLARE_TORTOISE', playerId, grantId: g.id, rank: ctx.rank as Rank } as ClientAction };
    if (w.type === 'SET_COMPLETED') return { grant: g, action: { type: 'DECLARE_MANTIS', playerId, grantId: g.id } as ClientAction };
    if (w.type === 'TURN_END') return { grant: g, action: { type: 'DECLARE_SHARK', playerId, grantId: g.id } as ClientAction };
    return null;
  }, [w, isAnswer, grants, playerId, ctx.rank]);

  useWindowKeys({
    space: isAnswer ? truth : undefined,
    d: isAnswer ? (squid ? lie : undefined) : single ? () => send(single.action) : undefined,
    esc: !isAnswer ? decline : undefined,
  });

  if (!w) return null;
  const nameOf = (id: string) => nameFor(view, id);
  const who = describeWindow(w.type, ctx, nameOf, rank);
  const clock = left !== null ? <NotchClock secondsLeft={left} total={total} /> : null;

  if (isAnswer) {
    const asker = view.players.find((p) => p.id === ctx.askerId);
    return (
      <div className={`plank plank--answer ${locked ? 'is-locked' : ''}`} data-plank="answer" role="dialog" aria-live="assertive" aria-label={who}>
        <div className="plank__chip" aria-hidden="true">
          <Seal rank={asked} size={18} color="#17120e" />
        </div>
        <div className="plank__top">
          <div className="plank__card">
            <Card rank={asked} size="md" />
          </div>
          <div className="plank__say">
            <div className="plank__who">
              {asker && <Mark id={markForSeat(view.turnOrder, asker.id)} size={13} color="#e3d3b4" />}
              {t('plank.asks', { name: asker?.name ?? '' })}
            </div>
            <div className="plank__rank">{rank(asked)}?</div>
            <div className="plank__sub">{holds > 0 ? t('plank.youHave', { count: holds }) : t('plank.youHaveNone')}</div>
          </div>
        </div>
        {clock}
        <div className={`plank__actions ${squid ? '' : 'is-single'}`}>
          <button type="button" className="plank__btn" disabled={locked} onClick={truth} data-answer="truth">
            {holds > 0 ? t('window.hereYouGo') : t('window.goFish')}
          </button>
          {squid && (
            <button type="button" className="plank__btn" disabled={locked} onClick={lie} data-answer="lie">
              {t('window.lie', { rank: rank('squid') })}
            </button>
          )}
        </div>
        {locked && <div className="plank__stamp" aria-hidden="true">{t('plank.sent')}</div>}
      </div>
    );
  }

  /* ------ every other window: what you may do, and to whom */
  const showCard = (single?.grant.rank ?? (ctx.rank as string | undefined)) as Rank | undefined;
  const isTurnStart = w.type === 'TURN_START';
  return (
    <div className={`plank plank--power ${locked ? 'is-locked' : ''}`} data-plank={w.type.toLowerCase()} role="dialog" aria-live="assertive" aria-label={who}>
      <div className="plank__head">
        {!isTurnStart && showCard && (
          <div className="plank__card plank__card--sm">
            <Card rank={showCard} size="md" />
          </div>
        )}
        <div className="plank__say">
          <div className="plank__rank plank__rank--sm">{isTurnStart ? t(hintKey(w.type)) : who}</div>
          {!isTurnStart && <div className="plank__sub">{t(hintKey(w.type))}</div>}
        </div>
        {clock}
      </div>
      {isTurnStart ? (
        <PowerForm view={view} grants={grants} locked={locked} send={send} decline={decline} />
      ) : (
        <div className="plank__actions">
          {single && (
            <button type="button" className="plank__btn plank__btn--go" disabled={locked} onClick={() => send(single.action)}>
              {t('window.declare')} {rank(single.grant.rank)}
            </button>
          )}
          <button type="button" className="plank__btn" disabled={locked} onClick={decline}>
            {t('window.decline')}
          </button>
        </div>
      )}
      {locked && <div className="plank__stamp" aria-hidden="true">{t('plank.sent')}</div>}
    </div>
  );
}

/* --------------------------------------------------- the active powers' forms */

function TargetChip({
  view,
  p,
  on,
  selected,
  onClick,
}: {
  view: RedactedView;
  p: RedactedPlayerView;
  on: boolean;
  selected?: boolean;
  onClick: () => void;
}) {
  return (
    <button type="button" className={`tchip ${selected ? 'is-selected' : ''}`} disabled={!on} onClick={onClick} data-target-id={p.id}>
      <Mark id={markForSeat(view.turnOrder, p.id)} size={16} color="#17120e" />
      <span className="tchip__name">{shortName(p.name)}</span>
    </button>
  );
}

/** Jellyfish, Stickleback and Whale in the TURN_START window - no `<select>` anywhere. */
function PowerForm({
  view,
  grants,
  locked,
  send,
  decline,
}: {
  view: RedactedView;
  grants: { id: string; rank: string }[];
  locked: boolean;
  send: (a: ClientAction) => void;
  decline: () => void;
}) {
  const { t, rank, locale } = useT();
  const { playerId } = useGame();
  const [which, setWhich] = useState(grants[0]?.id ?? '');
  const [target, setTarget] = useState<string | null>(null);
  const active = grants.find((g) => g.id === which) ?? grants[0];
  const others = view.players.filter((p) => p.id !== playerId);

  // adjacent seats in the turn order, around the table; the Whale takes any two neighbours
  const pairs = useMemo(() => {
    const ord = view.turnOrder;
    return ord.length < 3 ? [] : ord.map((id, i) => [id, ord[(i + 1) % ord.length]] as const);
  }, [view.turnOrder]);

  if (!active) return null;
  const me = playerId!;

  return (
    <>
      <div className="plank__form" data-form={active.rank}>
        {active.rank === 'jellyfish' && (
          <>
            <div className="plank__label">{t('power.jellyfish.target')}</div>
            <div className="tchips">
              {others.map((p) => (
                <TargetChip key={p.id} view={view} p={p} on={!locked} onClick={() => send({ type: 'USE_JELLYFISH', playerId: me, grantId: active.id, targetId: p.id } as ClientAction)} />
              ))}
            </div>
          </>
        )}
        {active.rank === 'stickleback' && (
          <>
            <div className="plank__label">{target ? t('window.pickRank') : t('power.stickleback.target')}</div>
            <div className="tchips">
              {others.map((p) => (
                <TargetChip key={p.id} view={view} p={p} on={!locked} selected={target === p.id} onClick={() => setTarget(p.id)} />
              ))}
            </div>
            <div className="seals8" aria-disabled={!target}>
              {NORMAL_RANKS.map((r) => (
                <button
                  key={r}
                  type="button"
                  className="seal8"
                  disabled={!target || locked}
                  aria-label={rank(r)}
                  onClick={() => send({ type: 'USE_STICKLEBACK', playerId: me, grantId: active.id, targetId: target!, rank: r as NormalRank } as ClientAction)}
                >
                  <Seal rank={r} size={18} color="#17120e" />
                  <span>{rankAbbr(r, locale)}</span>
                </button>
              ))}
            </div>
          </>
        )}
        {active.rank === 'whale' && (
          <>
            <div className="plank__label">{t('window.pickPair')}</div>
            <div className="pairs">
              {pairs.map(([a, b]) => {
                const pa = view.players.find((p) => p.id === a)!;
                const pb = view.players.find((p) => p.id === b)!;
                return (
                  <button
                    key={`${a}-${b}`}
                    type="button"
                    className="pair"
                    disabled={locked}
                    data-pair={`${a}:${b}`}
                    onClick={() => send({ type: 'USE_WHALE', playerId: me, grantId: active.id, targetAId: a, targetBId: b } as ClientAction)}
                  >
                    <Mark id={markForSeat(view.turnOrder, a)} size={14} color="#17120e" />
                    <span className="pair__name">{a === me ? t('window.you') : shortName(pa.name)}</span>
                    <span className="pair__link" aria-hidden="true">⇄</span>
                    <Mark id={markForSeat(view.turnOrder, b)} size={14} color="#17120e" />
                    <span className="pair__name">{b === me ? t('window.you') : shortName(pb.name)}</span>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
      <div className="plank__actions plank__actions--row">
        {grants.length > 1 &&
          grants.map((g) => (
            <button
              key={g.id}
              type="button"
              className={`plank__btn plank__btn--tab ${g.id === active.id ? 'is-on' : ''}`}
              aria-pressed={g.id === active.id}
              onClick={() => {
                setWhich(g.id);
                setTarget(null);
              }}
            >
              <Seal rank={g.rank} size={18} color="#17120e" />
              <span>{rank(g.rank)}</span>
            </button>
          ))}
        <button type="button" className="plank__btn" disabled={locked} onClick={decline}>
          {t('window.decline')}
        </button>
      </div>
    </>
  );
}

/** Small helper for the table: says the words of a lost race. */
export function tooLateText(t: (k: string, p?: Record<string, string | number>) => string, name: string | null): string {
  return name ? t('window.tooLate', { name }) : t('window.tooLateNoName');
}
