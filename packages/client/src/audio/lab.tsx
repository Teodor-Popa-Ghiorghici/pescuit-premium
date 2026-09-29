/* The audio lab (§7.3), reachable at `?lab=audio`. Loaded lazily (main.tsx imports it only when
 * that query is present), so it costs nothing in the game's bundle. It grows out of the prototype:
 *
 *   - every cue with its variations (seeds), in both profiles, before and after mastering;
 *   - the recipe of the wood family on sliders;
 *   - bus meters, the activity envelope, the voice count and the limiter;
 *   - an event -> cue trace: scripted public records through `cuesFor`, and the engine's own trace;
 *   - short-term loudness at the chain's output, against the anchor;
 *   - an ABX player for the closest pairs of the confusability check;
 *   - the profile switch.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { cuesFor, type PublicRecord, type PublicView } from './cues.js';
import { ANCHOR_CUE, ANCHOR_LUFS, BUS_NAMES, CUES, cueDef, type BusName } from './cuesheet.js';
import { getEngine, spawnVoice } from './engine.js';
import { kWeight, lufsOf, meanSquare } from './measure.js';
import { preloadRendered } from './bank.js';
import { wood, type Plank } from './live/wood.js';
import type { CueParams } from './recipes.js';
import { db } from './util.js';

const css = `
.lab{font:13px/1.4 system-ui,sans-serif;background:#0b222c;color:#efe2c8;min-height:100vh;padding:14px;box-sizing:border-box}
.lab h1{font-size:16px;margin:0 0 8px}.lab h2{font-size:13px;margin:16px 0 6px;color:#e6b85c;text-transform:uppercase;letter-spacing:.06em}
.lab button{font:inherit;background:#1d4553;color:#efe2c8;border:1px solid #3a6b7c;border-radius:3px;padding:3px 8px;cursor:pointer}
.lab button:hover{background:#26586a}.lab button.on{background:#e6b85c;color:#0b222c}
.lab table{border-collapse:collapse;width:100%}.lab td,.lab th{border-bottom:1px solid #1d4553;padding:2px 6px;text-align:left;white-space:nowrap}
.lab .row{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:4px 0}.lab .bar{height:10px;background:#1d4553;min-width:120px;position:relative}
.lab .bar i{position:absolute;left:0;top:0;bottom:0;background:#8fc36b}.lab code{color:#e6b85c}.lab input[type=range]{width:160px}
.lab .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(340px,1fr));gap:14px}.lab pre{margin:0;max-height:180px;overflow:auto;background:#08181f;padding:6px}
`;

const PARAMS: Record<string, CueParams> = {
  'table.turn': { seat: 4 }, 'table.turn.you': { seat: 0 }, 'table.ask': { seat: 1 }, 'table.bonus': { seat: 4 }, 'table.skipped': { seat: 2 },
  'ui.target': { seat: 1 }, 'power.lanternfish': { seat: 3 }, 'meta.join': { seat: 4 }, 'meta.leave': { seat: 5 }, 'meta.nudge': { seat: 0 },
  'table.give': { count: 2 }, 'table.gofish': { wet: 1 }, 'table.draw': { wet: 1 }, 'table.refill': { count: 3 }, 'ui.toggle': { on: true },
  'amb.gate': { open: false }, 'table.tally': { pip: 2 }, 'power.granted.mine': { rank: 'whale' }, 'power.clownfish.bound': { rank: 'shark' }, 'power.used.clownfish': { rank: 'shark' },
};

/** the closest same-rhythm pairs with different meanings, for the ABX player */
const ABX_PAIRS: Array<[string, string]> = [
  ['table.give', 'table.flight'], ['power.shark', 'power.stickleback.miss'], ['table.gofish.dry', 'power.tortoise'],
  ['table.turn', 'table.bonus'], ['ui.target', 'table.ask'], ['table.lay', 'power.reveal'], ['table.turn', 'table.turn.you'],
];

const PLAYERS = ['a', 'b', 'c', 'd'];
const view = (over: Partial<PublicView> = {}): PublicView => ({ players: PLAYERS, currentPlayerId: 'a', poolCount: 8, window: null, setsPossible: 12, ...over });
const RP = { type: 'RESPONSE_PENDING', askerId: 'a', targetId: 'b', deadlineAt: 0 };
const SCRIPT: Array<{ label: string; rec: PublicRecord }> = [
  { label: 'ask a → b', rec: { seq: 1, mode: 'ascuns', before: view(), after: view({ window: RP }), events: [{ type: 'REQUEST_MADE', askerId: 'a', targetId: 'b' }] } },
  { label: 'yes: give 2, bonus', rec: { seq: 2, mode: 'ascuns', before: view({ window: RP }), after: view(), events: [{ type: 'REQUEST_SUCCEEDED', askerId: 'a', targetId: 'b', count: 2 }, { type: 'BONUS_TURN', playerId: 'a' }] } },
  { label: 'no: wet go fish', rec: { seq: 3, mode: 'ascuns', before: view({ window: RP }), after: view({ currentPlayerId: 'b', poolCount: 7 }), events: [{ type: 'REQUEST_FAILED', askerId: 'a', targetId: 'b' }, { type: 'DREW_FROM_POOL', playerId: 'a' }, { type: 'TURN_STARTED', playerId: 'b' }] } },
  { label: 'no: dry go fish', rec: { seq: 4, mode: 'ascuns', before: view({ window: RP, poolCount: 0 }), after: view({ currentPlayerId: 'b', poolCount: 0 }), events: [{ type: 'REQUEST_FAILED', askerId: 'a', targetId: 'b' }, { type: 'TURN_STARTED', playerId: 'b' }] } },
  { label: 'power set laid (Ascuns)', rec: { seq: 5, mode: 'ascuns', before: view(), after: view(), events: [{ type: 'SET_LAID', playerId: 'a', isPowerSet: true }, { type: 'POWER_GRANTED', playerId: 'a' }] } },
  { label: 'whale used (Deschis)', rec: { seq: 6, mode: 'deschis', before: view(), after: view(), events: [{ type: 'POWER_USED', playerId: 'a', rank: 'whale' }, { type: 'WHALE_SHUFFLE', playerId: 'a' }] } },
  { label: 'Squid (Deschis grant)', rec: { seq: 7, mode: 'deschis', before: view(), after: view(), events: [{ type: 'POWER_GRANTED', playerId: 'a', rank: 'squid' }] } },
  { label: 'the last set', rec: { seq: 8, mode: 'ascuns', before: view({ setsPossible: 2 }), after: view({ setsPossible: 1 }), events: [{ type: 'SET_LAID', playerId: 'a', isPowerSet: false }] } },
];

function useTick(ms: number): number {
  const [n, setN] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setN((v) => v + 1), ms);
    return () => clearInterval(id);
  }, [ms]);
  return n;
}

function Lab(): React.ReactElement {
  const engine = getEngine();
  const [, force] = useState(0);
  useEffect(() => engine.subscribe(() => force((v) => v + 1)), [engine]);
  const [started, setStarted] = useState(false);
  const [seed, setSeed] = useState(3);
  const [mastered, setMastered] = useState(true);
  const [trace, setTrace] = useState<string[]>([]);
  const [wp, setWp] = useState({ plank: 'B' as Plank, f0: 1, damping: 0, gain: 1, hard: false });
  const analysers = useRef<Partial<Record<BusName | 'out', AnalyserNode>>>({});
  const kBuf = useRef<Float32Array[]>([]);
  const tick = useTick(80);

  const start = () => {
    engine.unlock();
    void engine.ensure().then(() => {
      const m = engine.mixerNode;
      if (!m) return;
      for (const b of BUS_NAMES) {
        const a = m.ctx.createAnalyser();
        a.fftSize = 2048;
        m.graph.buses[b].connect(a);
        analysers.current[b] = a;
      }
      const out = m.ctx.createAnalyser();
      out.fftSize = 4096;
      m.user.connect(out);
      analysers.current.out = out;
      setStarted(true);
      void preloadRendered(engine.settings.profile);
    });
    engine.traceOn(true);
  };

  const play = (id: string, s = seed, params: CueParams = PARAMS[id] ?? {}) => {
    const m = engine.mixerNode;
    if (!m || m.ctx.state !== 'running') return;
    spawnVoice({ ctx: m.ctx, buses: m.graph.buses, profile: engine.settings.profile, mastering: mastered, safetyFade: false, pan: false }, id, params, s, m.ctx.currentTime + 0.05);
    setTrace((t) => [`${new Date().toISOString().slice(11, 23)}  ${id}  seed ${s}  ${JSON.stringify(params)}`, ...t].slice(0, 60));
  };

  // meters
  const meters = useMemo(() => ({}) as Record<string, number>, []);
  let shortTerm = -Infinity;
  const ana = analysers.current;
  if (started) {
    for (const b of [...BUS_NAMES, 'out'] as const) {
      const a = ana[b];
      if (!a) continue;
      const buf = new Float32Array(a.fftSize);
      a.getFloatTimeDomainData(buf);
      let peak = 0;
      for (const v of buf) peak = Math.max(peak, Math.abs(v));
      meters[b] = db(peak);
      if (b === 'out') {
        kBuf.current.push(kWeight(buf, engine.context!.sampleRate));
        if (kBuf.current.length > 36) kBuf.current.shift(); // ~3 s of 85 ms frames
        const ms = kBuf.current.reduce((s, k) => s + meanSquare(k, 0, k.length), 0) / kBuf.current.length;
        shortTerm = lufsOf(ms);
      }
    }
  }
  void tick;

  const s = engine.settings;
  const ctx = engine.context;
  const stats = engine.limiterStats();
  const activity = engine.mixerNode?.graph.ambActivity.gain.value ?? 1;
  const voices = ctx ? engine.pool.count(ctx.currentTime) : 0;

  const [abx, setAbx] = useState<{ pair: number; x: 0 | 1; right: number; total: number; last?: string }>({ pair: 0, x: 0, right: 0, total: 0 });
  const abxPair = ABX_PAIRS[abx.pair];
  const abxNext = () => setAbx((a) => ({ ...a, x: Math.random() < 0.5 ? 0 : 1 }));

  return (
    <div className="lab">
      <style>{css}</style>
      <h1>Audio lab — the plan's §7.3 · engine {started ? engine.status : 'not started'} · limiter {engine.limiterKind ?? '—'}</h1>
      <div className="row">
        {!started && <button onClick={start}>Start audio</button>}
        <span>profile</span>
        {(['speaker', 'headphones'] as const).map((p) => (
          <button key={p} className={s.profile === p ? 'on' : ''} onClick={() => engine.update({ profile: p })}>{p}</button>
        ))}
        <button className={mastered ? 'on' : ''} onClick={() => setMastered(!mastered)}>mastering {mastered ? 'on' : 'off (raw)'}</button>
        <span>seed</span>
        <button onClick={() => setSeed(seed + 1)}>{seed} ↻</button>
        <button className={s.muted ? 'on' : ''} onClick={() => engine.update({ muted: !s.muted })}>mute</button>
        <button className={s.mono ? 'on' : ''} onClick={() => engine.update({ mono: !s.mono })}>mono</button>
        <button className={s.softer ? 'on' : ''} onClick={() => engine.update({ softer: !s.softer })}>softer</button>
      </div>
      <div className="row">
        {(['master', 'effects', 'interface', 'ambience', 'music'] as const).map((k) => (
          <label key={k}>{k} <input type="range" min={0} max={1} step={0.01} value={s[k]} onChange={(e) => engine.update({ [k]: Number(e.target.value) })} /></label>
        ))}
        <label>A/V offset {s.avOffsetMs} ms <input type="range" min={-100} max={400} step={10} value={s.avOffsetMs} onChange={(e) => engine.update({ avOffsetMs: Number(e.target.value) })} /></label>
      </div>

      <div className="grid">
        <section>
          <h2>Meters</h2>
          <table>
            <tbody>
              {BUS_NAMES.map((b) => (
                <tr key={b}><td>{b}</td><td><div className="bar"><i style={{ width: `${Math.max(0, Math.min(100, ((meters[b] ?? -90) + 60) * (100 / 60)))}%` }} /></div></td><td>{f(meters[b])} dBFS</td></tr>
              ))}
              <tr><td>output peak</td><td /><td>{f(meters.out)} dBFS</td></tr>
              <tr><td>short-term</td><td /><td>{f(shortTerm)} LUFS (anchor {ANCHOR_CUE} at {ANCHOR_LUFS[s.profile]})</td></tr>
              <tr><td>limiter</td><td /><td>{stats ? `GR max ${stats.grMaxDb.toFixed(1)} dB · busy ${((stats.busyFrames / Math.max(1, stats.frames)) * 100).toFixed(2)} % · clip ${stats.clipped}` : '—'}</td></tr>
              <tr><td>activity</td><td /><td>ambience {db(activity).toFixed(1)} dB (0 to −4)</td></tr>
              <tr><td>voices</td><td /><td>{voices} / 14</td></tr>
            </tbody>
          </table>
        </section>

        <section>
          <h2>Wood bench — the recipe on sliders</h2>
          <div className="row">
            {(['A', 'B', 'C', 'D'] as const).map((p) => <button key={p} className={wp.plank === p ? 'on' : ''} onClick={() => setWp({ ...wp, plank: p })}>{p}</button>)}
            <button className={wp.hard ? 'on' : ''} onClick={() => setWp({ ...wp, hard: !wp.hard })}>hard mallet</button>
          </div>
          {([['f0', 0.7, 1.4, 0.01], ['damping', 0, 1, 0.01], ['gain', 0.1, 1.5, 0.01]] as const).map(([k, lo, hi, st]) => (
            <div className="row" key={k}><label>{k} {wp[k].toFixed(2)} <input type="range" min={lo} max={hi} step={st} value={wp[k]} onChange={(e) => setWp({ ...wp, [k]: Number(e.target.value) })} /></label></div>
          ))}
          <button onClick={() => { const m = engine.mixerNode; if (m && m.ctx.state === 'running') wood(m.ctx, m.graph.buses.Table, m.ctx.currentTime + 0.05, { plank: wp.plank, f0: { A: 180, B: 320, C: 620, D: 1200 }[wp.plank] * wp.f0, damping: wp.damping, gain: wp.gain, hard: wp.hard, seed }); }}>strike</button>
        </section>

        <section>
          <h2>Event → cue trace (scripted public records, seat 0 = 'c')</h2>
          <div className="row">
            {SCRIPT.map(({ label, rec }) => (
              <button key={label} onClick={() => {
                const cues = cuesFor(rec, { playerId: 'c', headphones: s.profile === 'headphones' });
                setTrace((t) => [`▶ ${label}: ${cues.map((c) => `${c.id}@${c.at}`).join('  ') || '(silence)'}`, ...t].slice(0, 60));
                engine.playRequests(cues);
              }}>{label}</button>
            ))}
          </div>
          <pre>{trace.join('\n')}</pre>
        </section>

        <section>
          <h2>ABX — the closest pairs</h2>
          <div className="row">
            <select value={abx.pair} onChange={(e) => setAbx({ pair: Number(e.target.value), x: 0, right: 0, total: 0 })}>
              {ABX_PAIRS.map((p, i) => <option key={i} value={i}>{p[0]} / {p[1]}</option>)}
            </select>
            <button onClick={() => play(abxPair[0])}>A</button>
            <button onClick={() => play(abxPair[1])}>B</button>
            <button onClick={() => play(abxPair[abx.x])}>X</button>
            {[0, 1].map((g) => (
              <button key={g} onClick={() => { setAbx({ ...abx, right: abx.right + (g === abx.x ? 1 : 0), total: abx.total + 1, last: g === abx.x ? 'right' : 'wrong', x: Math.random() < 0.5 ? 0 : 1 }); }}>X is {g ? 'B' : 'A'}</button>
            ))}
            <button onClick={abxNext}>new X</button>
            <span>{abx.right} / {abx.total} {abx.last ?? ''}</span>
          </div>
        </section>
      </div>

      <h2>Every cue</h2>
      <table>
        <thead><tr><th>cue</th><th>bus</th><th>heard</th><th>plays</th><th>level</th><th>prio</th><th>max</th><th>variations</th><th /></tr></thead>
        <tbody>
          {CUES.map((c) => (
            <tr key={c.id}>
              <td><code>{c.id}</code></td><td>{c.bus}</td><td>{c.heard}</td><td>{c.plays ? `${c.plays[0]}–${c.plays[1]}` : '—'}</td><td>{c.levelDb}</td><td>{c.prio}</td><td>{c.maxLenMs}</td><td>{c.variation}</td>
              <td>
                <button onClick={() => play(c.id)}>▶</button>{' '}
                {[1, 2, 3, 4].map((v) => <button key={v} onClick={() => play(c.id, seed + v)}>{v}</button>)}{' '}
                <button title="the backlog variant" onClick={() => { const m = engine.mixerNode; if (m) spawnVoice({ ctx: m.ctx, buses: m.graph.buses, profile: s.profile, mastering: mastered, pan: false }, c.id, { ...(PARAMS[c.id] ?? {}), short: true }, seed, m.ctx.currentTime + 0.05); }}>short</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p>The sheet lists {CUES.length} cues; <code>{cueDef(ANCHOR_CUE)?.id}</code> is the anchor. Squid has no row: silence has no id.</p>
    </div>
  );
}

const f = (v: number | undefined): string => (v === undefined || !Number.isFinite(v) ? '—' : v.toFixed(1));

/** Mounts the lab into `el` (default #root). */
export function mountAudioLab(el: HTMLElement | null = document.getElementById('root')): void {
  if (!el) return;
  ReactDOM.createRoot(el).render(<Lab />);
}
