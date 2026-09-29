import { useEffect, useMemo, useRef, useState } from 'react';
import { logLines } from '../game/logLines.js';
import { onAnnounce } from '../game/announce.js';
import { useT } from '../i18n/useT.js';
import { useGame } from '../state/store.js';

/**
 * The screen-reader channel (§3.12, §5.9): two aria-live regions outside the flow. What the table says
 * out loud is also said here, in words, and none of it depends on sound: that you were asked
 * (assertive: it is the one thing you must act on), each public line of the log as it is written, and the
 * world's stages (evening, night, the last set, the pool running dry, the gate). Your turn is the top bar's
 * own live region, which follows the totem. Only public facts and the
 * viewer's own public facts are read - the same words a spectator's caption would carry (Law 1).
 */
export function Announcer() {
  const { t, rank } = useT();
  const { view, playerId, events } = useGame();
  const [polite, setPolite] = useState('');
  const [assertive, setAssertive] = useState('');
  const flip = useRef(false);
  // an identical sentence twice in a row is not re-read unless the text really changes: alternate a trailing space
  const say = (set: (s: string) => void, text: string) => {
    flip.current = !flip.current;
    set(flip.current ? text : `${text} `);
  };

  // the presenter's own words: stages, the pool running dry, the gate
  useEffect(() => onAnnounce((a) => say(a.assertive ? setAssertive : setPolite, t(a.key, a.params))), [t]); // eslint-disable-line react-hooks/exhaustive-deps

  // you were asked: the plank rises with the words, whether or not sound is on
  const askedKey = useRef<string | null>(null);
  useEffect(() => {
    const w = view?.pendingWindow;
    const c = w?.context as { askerId?: string; targetId?: string; rank?: string } | undefined;
    const key = w && w.type === 'RESPONSE_PENDING' && c?.targetId === playerId ? `${c.askerId}>${c.targetId}:${c.rank}` : null;
    if (key && key !== askedKey.current && view && c?.askerId && c.rank) {
      const name = view.players.find((p) => p.id === c.askerId)?.name ?? '';
      say(setAssertive, t('a11y.youAreAsked', { name, rank: rank(c.rank) }));
    }
    askedKey.current = key;
  }, [view, playerId, t, rank]); // eslint-disable-line react-hooks/exhaustive-deps

  // every public line of the log as it is written: asks, answers, gives, go fish, lays, powers, the end
  const nameOf = useMemo(() => {
    const map = new Map((view?.players ?? []).map((p) => [p.id, p.name]));
    return (id: string) => map.get(id) ?? id;
  }, [view?.players]);
  const lastId = useRef<number | null>(null);
  useEffect(() => {
    const lines = logLines(events.slice(-6), nameOf, rank, t);
    const last = lines[lines.length - 1];
    if (!last) return;
    if (lastId.current === null) {
      lastId.current = last.id; // the first look at a table already in progress: nothing to read
      return;
    }
    if (last.id === lastId.current) return;
    lastId.current = last.id;
    const id = window.setTimeout(() => say(setPolite, last.text), 350); // let the presenter's own words go first
    return () => window.clearTimeout(id);
  }, [events, nameOf, rank, t]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="sr-only" aria-label={t('a11y.announcements')}>
      <div role="status" aria-live="polite" aria-atomic="true">
        {polite}
      </div>
      <div role="alert" aria-live="assertive" aria-atomic="true">
        {assertive}
      </div>
    </div>
  );
}
