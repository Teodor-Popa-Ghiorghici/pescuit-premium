import { GameTable } from './components/GameTable.js';
import { Lobby } from './components/Lobby.js';
import { WaitingRoom } from './components/WaitingRoom.js';
import { useGame } from './state/store.js';

export function App() {
  const { roomCode, started } = useGame();

  if (!roomCode) return <Lobby />;
  if (!started) return <WaitingRoom />;
  return <GameTable />;
}
