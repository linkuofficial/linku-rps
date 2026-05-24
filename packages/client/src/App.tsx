import { useWebSocket } from './hooks/useWebSocket';
import { useGameState } from './hooks/useGameState';
import Lobby from './pages/Lobby';
import Waiting from './pages/Waiting';
import Game from './pages/Game';
import Finished from './pages/Finished';

export default function App() {
  const { state, dispatch, handleMessage } = useGameState();
  const { send, connected } = useWebSocket(handleMessage);

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {state.phase === 'lobby' && (
          <Lobby send={send} connected={connected} error={state.error} dispatch={dispatch} />
        )}
        {state.phase === 'waiting' && (
          <Waiting roomId={state.roomId!} bestOf={state.bestOf} />
        )}
        {state.phase === 'playing' && (
          <Game state={state} send={send} dispatch={dispatch} />
        )}
        {state.phase === 'finished' && (
          <Finished state={state} />
        )}
      </div>
    </div>
  );
}