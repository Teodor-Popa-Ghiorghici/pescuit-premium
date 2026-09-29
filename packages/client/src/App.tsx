import { lazy, Suspense } from 'react';
import { Lobby } from './components/Lobby.js';
import { SoundTab } from './components/Sheets.js';
import { WaitingRoom } from './components/WaitingRoom.js';
import { useGame } from './state/store.js';

// the table is a chunk of its own (the cards, the hand, the planks, the choreography's hands): the lobby does not
// pay for it, and it is fetched while the room fills (`preloadTable`), so the gate opens without a wait
const loadTable = () => import('./components/GameTable.js').then((m) => ({ default: m.GameTable }));
const GameTable = lazy(loadTable);
export const preloadTable = (): void => void loadTable();

export function App() {
  const { roomCode, started } = useGame();

  // "tap for sound" hangs over every screen while the audio context is suspended (§3.5)
  return (
    <>
      {!roomCode ? <Lobby /> : !started ? <WaitingRoom /> : <Suspense fallback={<div className="screen" />}><GameTable /></Suspense>}
      <SoundTab />
    </>
  );
}
