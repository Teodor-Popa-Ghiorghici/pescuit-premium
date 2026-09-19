import type { GameEvent } from '@pescuit/engine';
import { useMemo, useRef, useEffect } from 'react';
import { Seal } from '../art/seals.js';
import { useT } from '../i18n/useT.js';
import { useGame } from '../state/store.js';

/** Which seal stands at the head of a line. Every event that a power caused is
 *  marked with that power's sigil; the rest fall back to the rank in play. */
function sealFor(e: GameEvent): string | null {
  switch (e.type) {
    case 'REQUEST_MADE':
    case 'REQUEST_SUCCEEDED':
    case 'REQUEST_FAILED':
      return e.rank;
    case 'SET_LAID':
      return e.rank;
    case 'POWER_GRANTED':
      return e.unbound ? 'clownfish' : e.rank;
    case 'POWER_USED':
      return e.rank;
    case 'SHARK_JUMP':
      return 'shark';
    case 'LANTERNFISH_REFLECT':
      return 'lanternfish';
    case 'TORTOISE_BLOCK':
      return 'tortoise';
    case 'JELLYFISH_STUN':
    case 'TURN_SKIPPED_STUNNED':
      return 'jellyfish';
    case 'STICKLEBACK_STEAL':
    case 'STICKLEBACK_WASTED':
      return 'stickleback';
    case 'WHALE_SHUFFLE':
      return 'whale';
    case 'SET_DESTROYED':
      return 'mantisShrimp';
    case 'HAND_REFILLED':
      return 'eggs';
    case 'BONUS_TURN':
    case 'TURN_STARTED':
    case 'GAME_ENDED':
      return 'turn';
    default:
      return null;
  }
}

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

/** Jurnal — printed on recessed stock, each line headed by the seal of what caused it. */
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
          return { id: i, text: t(entry.key, entry.params), seal: sealFor(e) };
        })
        .filter((x): x is { id: number; text: string; seal: string | null } => x !== null),
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
            {l.seal ? <Seal rank={l.seal} size={16} color="currentColor" /> : <span style={{ width: 16, flex: 'none' }} />}
            <span>{l.text}</span>
          </div>
        ))}
        <div ref={endRef} />
      </div>
    </div>
  );
}
