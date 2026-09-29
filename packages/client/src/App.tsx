import { GameTable } from './components/GameTable.js';
import { Lobby } from './components/Lobby.js';
import { SoundTab } from './components/Sheets.js';
import { WaitingRoom } from './components/WaitingRoom.js';
import { useGame } from './state/store.js';

export function App() {
  const { roomCode, started } = useGame();

  // "tap for sound" hangs over every screen while the audio context is suspended (§3.5)
  return (
    <>
      {!roomCode ? <Lobby /> : !started ? <WaitingRoom /> : <GameTable />}
      <SoundTab />
    </>
  );
}
