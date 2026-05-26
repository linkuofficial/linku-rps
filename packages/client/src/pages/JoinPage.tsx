import { useEffect, useRef } from 'react';
import { useLocation, useRoute } from 'wouter';
import { useWebSocket } from '../hooks/useWebSocket';
import { useGameState } from '../hooks/useGameState';
import { useDarkMode } from '../hooks/useDarkMode';
import Game from './Game';
import Finished from './Finished';
import { motion } from '../lib/motion-lite';
import { useI18n } from '../i18n';
import LanguageSwitcherCompact from '../components/LanguageSwitcherCompact';
import Icon from '../components/Icon';

export default function JoinPage() {
  const { t, translateError } = useI18n();
  const { isDark, toggle: toggleDark } = useDarkMode();
  const [, params] = useRoute('/join/:code');
  const code = params?.code;
  const [, navigate] = useLocation();
  const { state, dispatch, handleMessage } = useGameState();
  const stateRef = useRef(state);
  stateRef.current = state;
  const joinSentRef = useRef(false);
  const { send, connected, connectionState, reconnectAttempt, reconnectNow } = useWebSocket(
    handleMessage,
    () => {
      const { roomId, reconnectToken } = stateRef.current;
      if (roomId && reconnectToken) return { type: 'reconnect', roomId, reconnectToken };
      return null;
    },
  );

  useEffect(() => {
    if (connected && code && !joinSentRef.current) {
      joinSentRef.current = true;
      send({ type: 'join_room', roomId: code });
    }
  }, [connected, code, send]);

  if (state.phase === 'playing') {
    return (<div className="min-h-screen bg-surface flex items-center justify-center p-4"><div className="w-full max-w-md"><Game state={state} send={send} dispatch={dispatch} /></div></div>);
  }
  if (state.phase === 'finished') {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <Finished state={state} send={send} dispatch={dispatch} connected={connected} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-4">
      {connectionState !== 'connected' && (
        <div className="pointer-events-none fixed bottom-3 left-3 right-3 z-40">
          <div className="pointer-events-auto border border-border bg-surface-alt/95 px-3 py-2 text-label-sm text-on-surface shadow-lg backdrop-blur-sm flex items-center justify-between gap-2" aria-live="polite">
            <span className="truncate">
              {connectionState === 'connecting' && t('app.connecting')}
              {connectionState === 'reconnecting' && t('app.reconnecting', { n: reconnectAttempt })}
              {connectionState === 'disconnected' && t('app.disconnected')}
            </span>
            <button onClick={reconnectNow} className="shrink-0 px-2 py-1 font-medium text-on-surface hover:underline transition-colors">
              {t('app.reconnectNow')}
            </button>
          </div>
        </div>
      )}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center w-full max-w-md">
        <div className="mb-3 flex justify-end items-center gap-2">
          <button
            onClick={toggleDark}
            aria-label={isDark ? t('darkMode.disable') : t('darkMode.enable')}
            className="flex items-center text-on-surface-variant hover:text-on-surface transition-colors"
          >
            <Icon name={isDark ? 'light_mode' : 'dark_mode'} className="text-[20px]" />
          </button>
          <LanguageSwitcherCompact />
        </div>
        {state.error ? (
          <div><p className="text-red-500 mb-4">{translateError(state.error.code, state.error.message)}</p>
            <button onClick={() => navigate('/')} className="px-6 py-2 bg-primary text-on-primary font-medium">{t('common.backHome')}</button></div>
        ) : (<div className="text-gray-400">{t('join.joining')}</div>)}
      </motion.div>
    </div>
  );
}