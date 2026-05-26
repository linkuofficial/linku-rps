import { useEffect, useRef } from 'react';
import { useLocation, useRoute } from 'wouter';
import type { ToolId } from '@rps/shared';
import { useWebSocket } from '../hooks/useWebSocket';
import { useGameState } from '../hooks/useGameState';
import { useDarkMode } from '../hooks/useDarkMode';
import Game from './Game';
import Finished from './Finished';
import { motion } from '../lib/motion-lite';
import { useI18n } from '../i18n';
import LanguageSwitcherCompact from '../components/LanguageSwitcherCompact';
import Icon from '../components/Icon';

const TOOL_PREFIXES: Record<string, ToolId> = {
  '1': 'rps', '2': 'coin', '3': 'wheel', '4': 'dice', '5': 'draw', '6': 'reaction',
};

export default function JoinPage() {
  const { t, toolName, translateError } = useI18n();
  const { isDark, toggle: toggleDark } = useDarkMode();
  const [, params] = useRoute('/join/:code');
  const code = params?.code?.toUpperCase();
  const inferredTool: ToolId | null = code ? (TOOL_PREFIXES[code.charAt(0)] ?? null) : null;
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
          <div>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
              className="border-2 border-primary bg-surface-alt text-on-surface text-label-md px-4 py-3 mb-6 text-center"
            >
              {translateError(state.error.code, state.error.message)}
            </motion.div>
            <button onClick={() => navigate('/')} className="flex items-center gap-1 mx-auto text-label-sm text-on-surface-variant hover:text-on-surface transition-colors">
              <Icon name="arrow_back" className="text-[16px]" />{t('common.backHome')}
            </button>
          </div>
        ) : (
          <div>
            {inferredTool && (
              <>
                <h1 className="text-headline-lg text-on-surface mb-3">{toolName(inferredTool)}</h1>
                <div dir="ltr" className="text-headline-md font-mono tracking-[0.35em] text-on-surface-variant mb-8">{code}</div>
              </>
            )}
            <div className="flex items-center justify-center gap-2 mb-8">
              <span className="inline-block w-3 h-3 border-2 border-on-surface-variant border-t-transparent rounded-full animate-spin" />
              <span className="text-label-md text-on-surface-variant">{t('join.joining')}</span>
            </div>
            <button onClick={() => navigate('/')} className="flex items-center gap-1 mx-auto text-label-sm text-on-surface-variant hover:text-on-surface transition-colors">
              <Icon name="arrow_back" className="text-[16px]" />{t('common.backHome')}
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}