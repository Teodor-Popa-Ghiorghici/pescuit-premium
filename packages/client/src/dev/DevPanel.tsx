import { useEffect, useState, useSyncExternalStore } from 'react';
import { useGame } from '../state/store.js';
import type { LocalDriver } from './driver.js';
import { FIXTURES } from './fixtures.js';

/** A collapsed tab at the screen's left edge; open it for pause, step, speed, the fixtures menu and a fake disconnect. */
export function DevPanel({ driver, fixture }: { driver: LocalDriver; fixture: string | null }) {
  const [open, setOpen] = useState(false);
  const { devSetStatus } = useGame();
  const info = useSyncExternalStore(
    (cb) => driver.subscribe(cb),
    () => JSON.stringify(driver.info()),
  );
  const i = JSON.parse(info) as ReturnType<LocalDriver['info']>;
  const [, force] = useState(0);
  useEffect(() => driver.subscribe(() => force((n) => n + 1)), [driver]);

  const go = (q: Record<string, string>) => {
    const p = new URLSearchParams(location.search);
    for (const [k, v] of Object.entries(q)) p.set(k, v);
    location.search = p.toString();
  };

  return (
    <div className="devpanel" data-devpanel style={{ position: 'fixed', left: 0, top: '38%', zIndex: 200, font: '12px system-ui', color: '#efe2c8' }}>
      <button onClick={() => setOpen(!open)} style={{ writingMode: 'vertical-rl', background: '#3b322a', color: '#efe2c8', border: '1px solid #17120e', padding: '6px 2px', fontSize: 10 }}>
        dev
      </button>
      {open && (
        <div style={{ position: 'absolute', left: 18, top: 0, width: 230, background: '#17120e', border: '1px solid #6b4a2f', padding: 8, display: 'grid', gap: 6 }}>
          {!fixture && (
            <>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                <button onClick={() => (i.paused ? driver.resume() : driver.pause())}>{i.paused ? 'play' : 'pause'}</button>
                <button onClick={() => driver.step()}>step</button>
                {[0.25, 0.5, 1, 2, 4].map((s) => (
                  <button key={s} style={{ fontWeight: i.speed === s ? 700 : 400 }} onClick={() => driver.setSpeed(s)}>
                    {s}×
                  </button>
                ))}
              </div>
              <label>
                <input type="checkbox" checked={i.auto} onChange={(e) => driver.setAuto(e.target.checked)} /> watch (bot plays my seat)
              </label>
            </>
          )}
          <div>
            turn {i.turn} · seq {i.seq} · pool {i.pool} · sets≤{i.sets} · gate {i.misses}/{i.limit} · {i.status}
          </div>
          <label>
            fixture{' '}
            <select value={fixture ?? ''} onChange={(e) => go({ fixture: e.target.value })} style={{ fontSize: 12, padding: 2, maxWidth: 150 }}>
              <option value="">(bot table)</option>
              {FIXTURES.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.id}
                </option>
              ))}
            </select>
          </label>
          <button
            onClick={() => {
              devSetStatus('closed');
              setTimeout(() => devSetStatus('open'), 3500);
            }}
          >
            drop the connection for 3.5 s
          </button>
          <button onClick={() => go({ seed: String(Math.floor(Math.random() * 9999)) })}>new seed</button>
          {driver.actionLog.length > 0 && <pre style={{ margin: 0, maxHeight: 80, overflow: 'auto' }}>{driver.actionLog.slice(-4).join('\n')}</pre>}
        </div>
      )}
    </div>
  );
}
