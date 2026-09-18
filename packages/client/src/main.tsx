import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App.js';
import { GameProvider } from './state/store.js';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <GameProvider>
      <App />
    </GameProvider>
  </React.StrictMode>,
);
