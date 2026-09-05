import { useEffect, useRef } from 'react';
import { useSession } from './hooks/useSession';
import { useGameState } from './hooks/useGameState';
import { useDarkMode } from './hooks/useDarkMode';
import LanguageSwitcherCompact from './components/LanguageSwitcherCompact';
import Icon from './components/Icon';
import { useI18n } from './i18n';
import ToolSelector from './pages/ToolSelector';
import Game from './pages/Game';
// Lobby/Waiting/Finished are imported eagerly (not lazy): Game already pulls the bulk of
// the app into this chunk, and these three are tiny. Lazy-loading them only added a cold
// chunk eval on the first navigation to each — a one-off main-thread freeze at the page
// switch (P3). Bundling them here pays that cost once at initial load, behind the spinner.
import Lobby from './pages/Lobby';
import Waiting from './pages/Waiting';
import Finished from './pages/Finished';
import { isValidRoomCode, supportsSoloPlay } from '@rps/shared';

import { RECONNECT_STORAGE_KEY } from './lib/storage-keys';

interface ReconnectSnapshot {
  roomId: string;
  reconnectToken: string;
}

export default function App() {
  const { t } = useI18n();
  const { isDark, toggle: toggleDark } = useDarkMode();
  const { state, dispatch, handleMessage } = useGameState();
  const { send, connected, connectionState, reconnectAttempt, reconnectNow, isLocal, endLocalSession } = useSession(
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

  // P2: auto-join a room passed via ?room=CODE on first load. Captured synchronously at
  // render so the URL-sync effect below can't clear it before we read it. A reconnect
  // snapshot (restoring the creator's own session) takes precedence over joining anew.
  const initialRoomRef = useRef<string | null>(
    typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('room') : null,
  );
  const roomQueryHandledRef = useRef(false);
  useEffect(() => {
    if (roomQueryHandledRef.current) return;
    roomQueryHandledRef.current = true;
    const room = initialRoomRef.current;
    if (!room || !isValidRoomCode(room)) return;
    const raw = localStorage.getItem(RECONNECT_STORAGE_KEY);
    if (raw) {
      try {
        const snapshot = JSON.parse(raw) as ReconnectSnapshot;
        if (snapshot.roomId && snapshot.reconnectToken) return;
      } catch { /* fall through to join */ }
    }
    dispatch({ type: 'SET_PENDING_JOIN', code: room });
  }, [dispatch]);

  // P2: reflect the active room in the address bar (?room=CODE) so copying the browser URL
  // shares the room, matching the invite link. replaceState keeps wouter on "/" — App stays
  // mounted, the reconnect flow is untouched. Cleared once the user is back at tool select.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (state.roomId) {
      const target = `${window.location.pathname}?room=${state.roomId}`;
      if (`${window.location.pathname}${window.location.search}` !== target) {
        window.history.replaceState(null, '', target);
      }
      return;
    }
    if (state.phase === 'tool_select' && !state.pendingJoinCode && window.location.search) {
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, [state.roomId, state.phase, state.pendingJoinCode]);

  const isToolSelector = state.phase === 'tool_select';

  return (
    <div className="fixed inset-0 bg-surface">
      {(isLocal || connectionState !== 'connected') && (
        <div className="pointer-events-none fixed bottom-3 left-3 right-3 z-40 sm:bottom-5 sm:left-5 sm:right-auto sm:w-[min(26rem,calc(100vw-2.5rem))]">
          <div
            className="pointer-events-auto border border-border bg-surface-alt/95 px-3 py-2 text-label-sm text-on-surface shadow-lg backdrop-blur-sm flex items-center justify-between gap-2"
            aria-live="polite"
          >
            <span className="truncate">
              {isLocal && t('app.localGame')}
              {!isLocal && connectionState === 'connecting' && t('app.connecting')}
              {!isLocal && connectionState === 'reconnecting' && t('app.reconnecting', { n: reconnectAttempt })}
              {!isLocal && connectionState === 'disconnected' && t('app.disconnected')}
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

      {isToolSelector ? (
        <ToolSelector
          onSelect={(tool) => dispatch({ type: 'SELECT_TOOL', tool })}
          connected={connected}
          onJoinByCode={(code) => dispatch({ type: 'SET_PENDING_JOIN', code })}
          pendingJoinCode={state.pendingJoinCode}
          onPendingJoinTimeout={() => dispatch({ type: 'CLEAR_PENDING_JOIN' })}
          error={state.error}
          onClearError={() => dispatch({ type: 'CLEAR_ERROR' })}
        />
      ) : (
        <div className="flex h-full flex-col">
          <div className="mx-auto w-full max-w-md px-4 pt-4 sm:px-6">
            <div className="mb-3 flex items-center justify-between">
              {(state.phase === 'lobby' || state.phase === 'waiting' || state.phase === 'playing') ? (
                <button
                  onClick={() => {
                    localStorage.removeItem(RECONNECT_STORAGE_KEY);
                    endLocalSession();
                    dispatch({ type: 'BACK_TO_TOOL_SELECT' });
                  }}
                  className="flex items-center text-on-surface-variant hover:text-on-surface transition-colors"
                >
                  <Icon name="arrow_back" className="text-[20px]" />
                </button>
              ) : <div />}
              <div className="flex items-center gap-2">
                <button
                  onClick={toggleDark}
                  aria-label={isDark ? t('darkMode.disable') : t('darkMode.enable')}
                  className="flex items-center text-on-surface-variant hover:text-on-surface transition-colors"
                >
                  <Icon name={isDark ? 'light_mode' : 'dark_mode'} className="text-[20px]" />
                </button>
                <LanguageSwitcherCompact />
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            <div className="mx-auto flex min-h-full w-full max-w-md items-center px-4 pb-6 sm:px-6">
              {state.phase === 'lobby' && state.tool && (
                <Lobby
                  send={send}
                  connected={connected}
                  offlineSoloAvailable={!connected && supportsSoloPlay(state.tool)}
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
            </div>
          </div>
        </div>
      )}
    </div>
  );
}