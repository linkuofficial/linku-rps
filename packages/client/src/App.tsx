import { Suspense, lazy, useEffect, useRef } from 'react';
import { useWebSocket } from './hooks/useWebSocket';
import { useGameState } from './hooks/useGameState';
import LanguageSwitcherCompact from './components/LanguageSwitcherCompact';
import Icon from './components/Icon';
import { useI18n } from './i18n';

const Lobby = lazy(() => import('./pages/Lobby'));
const Waiting = lazy(() => import('./pages/Waiting'));
const Game = lazy(() => import('./pages/Game'));
const Finished = lazy(() => import('./pages/Finished'));
const ToolSelector = lazy(() => import('./pages/ToolSelector'));

const RECONNECT_STORAGE_KEY = 'linku-rps-reconnect';

interface ReconnectSnapshot {
  roomId: string;
  reconnectToken: string;
}

export default function App() {
  const { t } = useI18n();
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

  const pendingJoinSentRef = useRef<string | null>(null);
  useEffect(() => {
    if (state.pendingJoinCode && connected && pendingJoinSentRef.current !== state.pendingJoinCode) {
      pendingJoinSentRef.current = state.pendingJoinCode;
      send({ type: 'join_room', roomId: state.pendingJoinCode });
    }
    if (!state.pendingJoinCode) {
      pendingJoinSentRef.current = null;
    }
  }, [state.pendingJoinCode, connected, send]);

  const pageFallback = <div className="h-48 border border-border bg-surface-alt" aria-hidden="true" />;
  const isToolSelector = state.phase === 'tool_select';
  const canGoHome = !isToolSelector;

  return (
    <div className={`min-h-[100dvh] bg-surface ${isToolSelector ? 'px-0' : 'flex items-start sm:items-center justify-center p-4 sm:p-6'}`}>
      <div className={`w-full ${isToolSelector ? 'min-h-[100dvh]' : 'max-w-md pt-2 sm:pt-0'}`}>
        {canGoHome && (
          <div className="mb-3 flex items-center justify-between">
            <button
              onClick={() => dispatch({ type: 'BACK_TO_TOOL_SELECT' })}
              className="inline-flex items-center gap-2 text-on-surface-variant hover:text-on-surface transition-colors"
            >
              <Icon name="arrow_back" className="text-[20px]" />
              <span className="text-label-sm font-medium">{t('common.backHome')}</span>
            </button>
            <LanguageSwitcherCompact />
          </div>
        )}

        {connectionState !== 'connected' && (
          <div className="pointer-events-none fixed bottom-3 left-3 right-3 z-40 sm:bottom-5 sm:left-5 sm:right-auto sm:w-[min(26rem,calc(100vw-2.5rem))]">
            <div
              className="pointer-events-auto border border-border bg-surface-alt/95 px-3 py-2 text-label-sm text-on-surface shadow-lg backdrop-blur-sm flex items-center justify-between gap-2"
              aria-live="polite"
            >
              <span className="truncate">
                {connectionState === 'connecting' && t('app.connecting')}
                {connectionState === 'reconnecting' && t('app.reconnecting', { n: reconnectAttempt })}
                {connectionState === 'disconnected' && t('app.disconnected')}
              </span>
              <button
                onClick={reconnectNow}
                className="shrink-0 px-2 py-1 font-medium text-on-surface hover:underline transition-colors"
              >
                {t('app.reconnectNow')}
              </button>
            </div>
          </div>
        )}

        <Suspense fallback={pageFallback}>
          {isToolSelector && (
            <ToolSelector
              onSelect={(tool) => dispatch({ type: 'SELECT_TOOL', tool })}
              onJoinByCode={(code) => dispatch({ type: 'SET_PENDING_JOIN', code })}
              pendingJoinCode={state.pendingJoinCode}
              error={state.error}
              onClearError={() => dispatch({ type: 'CLEAR_ERROR' })}
            />
          )}
          {state.phase === 'lobby' && state.tool && (
            <Lobby
              send={send}
              connected={connected}
              error={state.error}
              dispatch={dispatch}
              tool={state.tool}
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
        </Suspense>
      </div>
    </div>
  );
}