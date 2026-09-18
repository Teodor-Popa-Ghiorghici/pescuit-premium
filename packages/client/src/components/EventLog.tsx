import type { GameEvent } from '@pescuit/engine';
import { useMemo, useRef, useEffect } from 'react';
import { useT } from '../i18n/useT.js';
import { useGame } from '../state/store.js';

function entryFor(
  e: GameEvent,
  nameOf: (id: string) => string,
  rankLabel: (r: string) => string,
): { key: string; params: Record<string, string | number> } | null {
  switch (e.type) {
    case 'REQUEST_MADE':
      return { key: 'log.requestMade', params: { asker: nameOf(e.askerId), target: nameOf(e.targetId), rank: rankLabel(e.rank) } };
    case 'REQUEST_SUCCEEDED':
      return {
        key: 'log.requestSucceeded',
        params: { target: nameOf(e.targetId), count: e.count, rank: rankLabel(e.rank), asker: nameOf(e.askerId) },
      };
    case 'REQUEST_FAILED':
      return { key: 'log.requestFailed', params: { asker: nameOf(e.askerId) } };
    case 'HAND_REFILLED':
      return { key: 'log.handRefilled', params: { player: nameOf(e.playerId), count: e.count } };
    case 'SET_LAID':
      return { key: 'log.setLaid', params: { player: nameOf(e.playerId), rank: rankLabel(e.rank) } };
    case 'SET_DESTROYED':
      return { key: 'log.setDestroyed', params: {} };
    case 'POWER_GRANTED':
      return e.unbound
        ? { key: 'log.powerGrantedHidden', params: { player: nameOf(e.playerId) } }
        : { key: 'log.powerGranted', params: { player: nameOf(e.playerId), rank: rankLabel(e.rank) } };
    case 'POWER_USED':
      return { key: 'log.powerUsed', params: { player: nameOf(e.playerId), rank: rankLabel(e.rank) } };
    case 'SHARK_JUMP':
      return { key: 'log.sharkJump', params: { player: nameOf(e.playerId), count: e.count, from: nameOf(e.fromId) } };
    case 'LANTERNFISH_REFLECT':
      return {
        key: 'log.lanternfishReflect',
        params: { player: nameOf(e.playerId), count: e.count, rank: rankLabel(e.rank), from: nameOf(e.fromId) },
      };
    case 'TORTOISE_BLOCK':
      return { key: 'log.tortoiseBlock', params: { player: nameOf(e.playerId), rank: rankLabel(e.rank) } };
    case 'JELLYFISH_STUN':
      return { key: 'log.jellyfishStun', params: { player: nameOf(e.playerId), target: nameOf(e.targetId) } };
    case 'STICKLEBACK_STEAL':
      return {
        key: 'log.sticklebackSteal',
        params: { player: nameOf(e.playerId), count: e.count, rank: rankLabel(e.rank), target: nameOf(e.targetId) },
      };
    case 'STICKLEBACK_WASTED':
      return {
        key: 'log.sticklebackWasted',
        params: { player: nameOf(e.playerId), rank: rankLabel(e.rank), target: nameOf(e.targetId) },
      };
    case 'WHALE_SHUFFLE':
      return {
        key: 'log.whaleShuffle',
        params: { player: nameOf(e.playerId), targetA: nameOf(e.targetAId), targetB: nameOf(e.targetBId) },
      };
    case 'BONUS_TURN':
      return { key: 'log.bonusTurn', params: { player: nameOf(e.playerId) } };
    case 'TURN_SKIPPED_STUNNED':
      return { key: 'log.turnSkippedStunned', params: { player: nameOf(e.playerId) } };
    case 'GAME_ENDED':
      return { key: 'log.gameEnded', params: {} };
    default:
      return null;
  }
}

export function EventLog() {
  const { t, rank } = useT();
  const { events, view } = useGame();
  const endRef = useRef<HTMLDivElement>(null);

  const nameOf = useMemo(() => {
    const map = new Map((view?.players ?? []).map((p) => [p.id, p.name]));
    return (id: string) => map.get(id) ?? id;
  }, [view]);

  const lines = useMemo(
    () =>
      events
        .map((e, i) => {
          const entry = entryFor(e, nameOf, rank);
          if (!entry) return null;
          return { id: i, text: t(entry.key, entry.params) };
        })
        .filter((x): x is { id: number; text: string } => x !== null),
    [events, t, rank, nameOf],
  );

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [lines.length]);

  return (
    <div className="event-log">
      <h3 className="event-log__title">{t('game.eventLog')}</h3>
      <div className="event-log__lines">
        {lines.map((l) => (
          <div key={l.id} className="event-log__line">
            {l.text}
          </div>
        ))}
        <div ref={endRef} />
      </div>
    </div>
  );
}
