/* The Score bench of the audio lab (MUSIC_PLAN §9), development only (it is reached through lab.tsx): pick a state and
 * hear its hum on the real Score bus; type a phrase in the plan's notation, see which rules it breaks, and hear it on the
 * legato horn as a call or a far answer; audition the library. The composer works here. */

import React, { useEffect, useRef, useState } from 'react';
import { getEngine } from './engine.js';
import { SCORE_SYNTH } from './score/levels.js';
import { formatPhrase, parsePhrase, PHRASES, phraseRules, TAKES, type PhraseKind, type ScoreStage } from './score/phrases.js';
import type { SynthMessage } from './score/synth.js';
import { humGains, SCORE_STATES, ANSWER_DB, ANSWER_LP_HZ, ANSWER_REPEATS, CALL_LP_HZ, type ScoreState } from './score/voicing.js';
import { createScoreNode, type ScoreNode } from './score/worklet.js';

export function ScoreBench(): React.ReactElement {
  const engine = getEngine();
  const node = useRef<ScoreNode | null>(null);
  const [state, setState] = useState<ScoreState | null>(null);
  const [text, setText] = useState(formatPhrase(PHRASES.find((p) => p.id === 'D1')!.notes));
  const [stage, setStage] = useState<ScoreStage>('dusk');
  const [kind, setKind] = useState<PhraseKind>('call');
  const [take, setTake] = useState(0);
  const [note, setNote] = useState('');

  useEffect(() => () => node.current?.node.disconnect(), []);

  const ready = async (): Promise<ScoreNode | null> => {
    await engine.ensure();
    const m = engine.mixerNode;
    if (!m) return null;
    if (!node.current) {
      node.current = await createScoreNode(m.ctx, SCORE_SYNTH);
      if (!node.current) {
        setNote('no AudioWorklet in this browser: no score');
        return null;
      }
      node.current.node.connect(m.graph.buses.Score);
      node.current.post([{ type: 'seed', seed: 77, zero: Date.now(), salt: 3 }, { type: 'clock', frame: Math.round(m.ctx.currentTime * m.ctx.sampleRate), serverMs: Date.now() }]);
    }
    return node.current;
  };
  const now = (): number => {
    const c = engine.context!;
    return Math.round((c.currentTime + 0.05) * c.sampleRate);
  };

  const hum = async (s: ScoreState | null) => {
    const n = await ready();
    if (!n) return;
    setState(s);
    n.post([{ type: 'hum', frame: now(), partials: s ? humGains(s, engine.settings.profile) : [], rampS: 0.025 }]);
  };

  let parsed: ReturnType<typeof parsePhrase> | null = null;
  let error = '';
  try {
    parsed = parsePhrase(text);
  } catch (e) {
    error = (e as Error).message;
  }
  const broken = parsed ? phraseRules({ kind, stage, notes: parsed }) : [];

  const play = async (notes: ReturnType<typeof parsePhrase>, asAnswer: boolean) => {
    const n = await ready();
    if (!n) return;
    const tk = TAKES[take];
    const msg: SynthMessage = {
      type: 'phrase', frame: now(), notes, scoopCents: tk.scoopCents, sagScale: tk.sagScale, extraTrimMs: tk.extraTrimMs,
      gain: 10 ** ((asAnswer ? ANSWER_DB : 0) / 20), lpHz: asAnswer ? ANSWER_LP_HZ : CALL_LP_HZ, pan: 0, lipDb: -26, wobble: 0.6,
      repeats: asAnswer && engine.settings.profile === 'headphones' ? ANSWER_REPEATS.map((r) => ({ ...r })) : [], seed: (Date.now() >>> 0) & 0xffff, tag: 0,
    };
    n.post([msg]);
  };

  return (
    <section>
      <h2>Score bench — MUSIC_PLAN §9</h2>
      <div className="row">
        <span>hum</span>
        {SCORE_STATES.map((s) => <button key={s} className={state === s ? 'on' : ''} onClick={() => void hum(s)}>{s}</button>)}
        <button onClick={() => void hum(null)}>silence</button>
        <span>(the {engine.settings.profile} arrangement; the Music slider scales it)</span>
      </div>
      <div className="row">
        <input style={{ width: '100%', font: 'inherit' }} value={text} onChange={(e) => setText(e.target.value)} aria-label="phrase" />
      </div>
      <div className="row">
        {(['lobby', 'dusk', 'evening', 'night'] as const).map((s) => <button key={s} className={stage === s ? 'on' : ''} onClick={() => setStage(s)}>{s}</button>)}
        {(['call', 'answer'] as const).map((k) => <button key={k} className={kind === k ? 'on' : ''} onClick={() => setKind(k)}>{k}</button>)}
        <span>take</span>
        {TAKES.map((_, k) => <button key={k} className={take === k ? 'on' : ''} onClick={() => setTake(k)}>{k + 1}</button>)}
        <button disabled={!parsed} onClick={() => parsed && void play(parsed, false)}>▶ near</button>
        <button disabled={!parsed} onClick={() => parsed && void play(parsed, true)}>▶ far answer</button>
      </div>
      <pre>{error || (broken.length ? `breaks: ${broken.join('; ')}` : 'passes every rule of §3.4 and §3.2')}{note ? `\n${note}` : ''}</pre>
      <div className="row">
        <select onChange={(e) => { const p = PHRASES.find((x) => x.id === e.target.value); if (p) { setText(formatPhrase(p.notes)); setStage(p.stage); setKind(p.kind); } }}>
          {PHRASES.map((p) => <option key={p.id} value={p.id}>{p.id} · {p.kind}, {p.stage}</option>)}
        </select>
        <span>the library: pick one to load it above</span>
      </div>
    </section>
  );
}
