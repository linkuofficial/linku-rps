import { useEffect } from 'react';
import { useWebSocket } from './hooks/useWebSocket';
import { useGameState } from './hooks/useGameState';
import Lobby from './pages/Lobby';
import Waiting from './pages/Waiting';
import Game from './pages/Game';
import Finished from './pages/Finished';
import ToolSelector from './pages/ToolSelector';

const RECONNECT_STORAGE_KEY = 'linku-rps-reconnect';

interface ReconnectSnapshot {
  roomId: string;
  reconnectToken: string;
}

export default function App() {
  const { state, dispatch, handleMessage } = useGameState();
  const { send, connected, connectionState, reconnectAttempt, reconnectNow } = useWebSocket(
    handleMessage,
    () => {
      const roomId = state.roomId;
      const reconnectToken = state.reconnectToken;
      if (roomId && reconnectToken) {
        return {
          type: 'reconnect',
          roomId,
          reconnectToken,
        };
      }

      const raw = localStorage.getItem(RECONNECT_STORAGE_KEY);
      if (!raw) return null;

      try {
        const snapshot = JSON.parse(raw) as ReconnectSnapshot;
        if (!snapshot.roomId || !snapshot.reconnectToken) return null;
        return {
          type: 'reconnect',
          roomId: snapshot.roomId,
          reconnectToken: snapshot.reconnectToken,
        };
      } catch {
        return null;
      }
    }
  );

  useEffect(() => {
    if (state.roomId && state.reconnectToken) {
      const snapshot: ReconnectSnapshot = {
        roomId: state.roomId,
        reconnectToken: state.reconnectToken,
      };
      localStorage.setItem(RECONNECT_STORAGE_KEY, JSON.stringify(snapshot));
      return;
    }

    if (state.phase === 'tool_select') {
      localStorage.removeItem(RECONNECT_STORAGE_KEY);
    }
  }, [state.phase, state.reconnectToken, state.roomId]);

  return (
    <div className="min-h-[100dvh] bg-white flex items-start sm:items-center justify-center p-3 sm:p-4">
      <div className="w-full max-w-md pt-2 sm:pt-0">
        {connectionState !== 'connected' && (
          <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 flex items-center justify-between gap-2">
            <span>
              {connectionState === 'connecting' && '連線中...'}
              {connectionState === 'reconnecting' && `重連中（第 ${reconnectAttempt} 次）`}
              {connectionState === 'disconnected' && '連線已中斷'}
            </span>
            <button
              onClick={reconnectNow}
              className="rounded-lg bg-amber-100 px-2 py-1 font-medium text-amber-900 hover:bg-amber-200 transition-colors"
            >
              立即重連
            </button>
          </div>
        )}

        {state.phase === 'tool_select' && (
          <ToolSelector onSelect={(tool) => dispatch({ type: 'SELECT_TOOL', tool })} />
        )}
        {state.phase === 'lobby' && state.tool && (
          <Lobby
            send={send}
            connected={connected}
            error={state.error}
            dispatch={dispatch}
            tool={state.tool}
            onBack={() => dispatch({ type: 'BACK_TO_TOOL_SELECT' })}
          />
        )}
        {state.phase === 'waiting' && (
          <Waiting roomId={state.roomId!} bestOf={state.bestOf} tool={state.tool ?? 'rps'} />
        )}
        {state.phase === 'playing' && (
          <Game state={state} send={send} dispatch={dispatch} />
        )}
        {state.phase === 'finished' && (
          <Finished state={state} send={send} dispatch={dispatch} connected={connected} />
        )}
      </div>
    </div>
  );
}