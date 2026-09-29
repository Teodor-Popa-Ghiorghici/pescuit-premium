import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App.js';
import { ArtDefs } from './art/defs.js';
import { GameProvider } from './state/store.js';
import './styles.css';

// `?lab=audio` opens the audio lab (§7.3); it is a separate lazy chunk, so the game never loads it.
if (new URLSearchParams(location.search).get('lab') === 'audio') void import('./audio/lab.js').then((m) => m.mountAudioLab());
else if (new URLSearchParams(location.search).get('table') === 'bots' || new URLSearchParams(location.search).get('fixture') !== null)
  // `?table=bots` and `?fixture=` (§7.1-§7.2) run the engine in this tab; a lazy chunk, so the game never loads it
  void import('./dev/mount.js').then((m) => m.mountDev(new URLSearchParams(location.search)));
else
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <ArtDefs />
      <GameProvider>
        <App />
      </GameProvider>
    </React.StrictMode>,
  );
