/* `?lab=vfx`: every stepped effect (§5.5), frame by frame and playing, for the Codex review. A separate
 * lazy chunk: the game never loads it. */
import { useState } from 'react';
import ReactDOM from 'react-dom/client';
import { VFX_FRAMES, VFX_KINDS, VFX_STEP_MS, vfxMs } from '../art/vfx.js';
import '../styles.css';

function Frames({ kind }: { kind: (typeof VFX_KINDS)[number] }) {
  const [run, setRun] = useState(0);
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '6px 0', borderBottom: '1px solid #3b322a' }}>
      <strong style={{ width: 110 }}>{kind}</strong>
      {VFX_FRAMES[kind].map((frame, i) => (
        <svg key={i} viewBox="0 0 64 64" width={72} height={72} style={{ background: '#d9c9a6', border: '1px solid #17120e' }}>
          {frame}
        </svg>
      ))}
      <button onClick={() => setRun((n) => n + 1)}>play</button>
      <span style={{ width: 80 }}>{vfxMs(kind)} ms</span>
      <div key={run} style={{ width: 72, height: 72, background: '#0e2b38' }} data-vfx-run>
        <svg viewBox="0 0 64 64" width={72} height={72} style={{ ['--vfx-step' as string]: `${VFX_STEP_MS}ms` }}>
          {VFX_FRAMES[kind].map((frame, i) => (
            <g key={i} className="vfx__f" style={{ ['--i' as string]: i }}>
              {frame}
            </g>
          ))}
        </svg>
      </div>
    </div>
  );
}

export function mountVfxLab(): void {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <div style={{ padding: 16, color: '#efe2c8', fontFamily: 'system-ui', overflow: 'auto', height: '100vh', background: '#17120e' }}>
      <h2>Stepped VFX (12 fps, 3-4 frames, at most 2 KB each)</h2>
      {VFX_KINDS.map((k) => (
        <Frames key={k} kind={k} />
      ))}
    </div>,
  );
}
