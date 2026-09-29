/* Entry for `?table=bots` and `?fixture=` (§7.1-§7.2). Lazy-loaded by main.tsx, so none of it is in
 * the normal bundle. It builds a LocalDriver, hands it to the real GameProvider as the message
 * source, renders the real App, and adds a small control panel (pause, step, speed, fixtures). */
import { seededDeck, type GameState } from '@pescuit/engine';
import { createGame } from '@pescuit/engine';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from '../App.js';
import { ArtDefs } from '../art/defs.js';
import { GameProvider } from '../state/store.js';
import '../styles.css';
import { DevPanel } from './DevPanel.js';
import { LocalDriver, NAMES } from './driver.js';
import { FIXTURES } from './fixtures.js';

const num = (v: string | null, d: number) => (v !== null && v !== '' && Number.isFinite(Number(v)) ? Number(v) : d);

function untilPredicate(spec: string | null, human: string): ((s: GameState) => boolean) | null {
  if (!spec) return null;
  const mine = (s: GameState) => s.players[s.currentPlayerIndex].id === human && s.pendingWindow === null && s.resume.kind === 'AWAIT_REQUEST';
  if (spec === 'myturn') return mine;
  if (spec === 'answer') return (s) => s.pendingWindow?.type === 'RESPONSE_PENDING' && s.pendingWindow.eligiblePlayerIds.includes(human);
  if (spec === 'dry') return (s) => mine(s) && s.pool.length === 0;
  if (spec === 'end') return (s) => s.status === 'ENDED';
  const m = /^sets:(\d+)$/.exec(spec);
  if (m) return (s) => mine(s) && s.laidSets.length >= 18 - Number(m[1]);
  const t = /^turn:(\d+)$/.exec(spec);
  if (t) return (s) => mine(s) && s.turnCounter >= Number(t[1]);
  return null;
}

export function mountDev(params: URLSearchParams): void {
  const root = ReactDOM.createRoot(document.getElementById('root')!);
  const fixtureId = params.get('fixture');
  const n = Math.max(3, Math.min(6, num(params.get('n'), 4)));
  const seed = num(params.get('seed'), 42);
  const seat = Math.max(0, Math.min(n - 1, num(params.get('seat'), 0)));
  const panel = params.get('panel') !== '0';

  if (fixtureId !== null && (fixtureId === '' || fixtureId === 'menu' || !FIXTURES.some((f) => f.id === fixtureId))) {
    root.render(
      <div style={{ padding: 20, color: '#efe2c8', fontFamily: 'system-ui', overflow: 'auto', height: '100vh' }}>
        <h2>Fixtures</h2>
        <ul>
          {FIXTURES.map((f) => (
            <li key={f.id}>
              <a style={{ color: '#d99a2b' }} href={`?fixture=${f.id}&n=${n}`}>
                {f.id}
              </a>{' '}
              — {f.label}
            </li>
          ))}
        </ul>
      </div>,
    );
    return;
  }

  let driver: LocalDriver;
  if (fixtureId !== null) {
    const spec = FIXTURES.find((f) => f.id === fixtureId)!;
    const b = spec.build(n, seed, seat);
    driver = new LocalDriver({ ...b, humanId: `p${b.seat}`, bots: 'memory', speed: num(params.get('speed'), 0), seed });
  } else {
    const names = NAMES.slice();
    const players = Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: i === seat ? 'Tu' : (names.shift() ?? `P${i}`) }));
    const g = createGame(players, seededDeck(seed), { powerVisibility: params.get('mode') === 'deschis' ? 'deschis' : 'ascuns' });
    driver = new LocalDriver({
      state: g.state,
      events: g.events,
      humanId: `p${seat}`,
      bots: params.get('bots') === 'random' ? 'random' : 'memory',
      speed: num(params.get('speed'), 1),
      auto: params.get('auto') === '1',
      seed,
    });
    const pred = untilPredicate(params.get('until'), `p${seat}`);
    if (pred) {
      driver.fastForward(pred);
      // a state reached on purpose is held: bots move again only when asked to
      driver.paused = num(params.get('speed'), 0) === 0;
    }
  }

  root.render(
    <React.StrictMode>
      <ArtDefs />
      <GameProvider source={driver}>
        <App />
        {panel && <DevPanel driver={driver} fixture={fixtureId} />}
      </GameProvider>
    </React.StrictMode>,
  );
}
