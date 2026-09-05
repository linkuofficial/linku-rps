import { useState, useEffect } from 'react';
import { motion } from '../lib/motion-lite';
import type { ClientMessage } from '@rps/shared';
import type { ToolId } from '@rps/shared';
import { ROOM_CODE_LENGTH } from '@rps/shared';
import type { GameAction } from '../hooks/useGameState';
import { useI18n } from '../i18n';

const BEST_OF_OPTIONS = [1, 3, 5, 7] as const;

interface Props {
  send: (msg: ClientMessage) => boolean;
  connected: boolean;
  error: { code: string; message: string } | null;
  dispatch: React.Dispatch<GameAction>;
  tool: ToolId;
  /**
   * True when there is no server but this tool can still be played alone in the browser.
   * Keeps the start button live instead of leaving a dead control on a dead backend.
   */
  offlineSoloAvailable?: boolean;
}

export default function Lobby({ send, connected, error, dispatch, tool, offlineSoloAvailable = false }: Props) {
  const { t, toolName, toolSubtitle, translateError, locale } = useI18n();
  const isRtl = locale === 'ar';
  const canAct = connected || offlineSoloAvailable;
  const [joinCode, setJoinCode] = useState('');
  const [bestOf, setBestOf] = useState(3);
  const [sending, setSending] = useState(false);
  const [lastAction, setLastAction] = useState<'create' | 'join' | 'start' | null>(null);
  const [requestTimedOut, setRequestTimedOut] = useState(false);

  const usesBestOf = tool === 'rps';

  useEffect(() => {
    if (error) {
      setSending(false);
      setRequestTimedOut(false);
    }
  }, [error]);

  useEffect(() => {
    if (!connected) setSending(false);
  }, [connected]);

  useEffect(() => {
    if (!sending) return;
    const timer = window.setTimeout(() => {
      setSending(false);
      setRequestTimedOut(true);
    }, 12000);
    return () => window.clearTimeout(timer);
  }, [sending]);

  const runAction = (action: 'create' | 'join' | 'start') => {
    if (sending) return;
    setLastAction(action);
    setRequestTimedOut(false);
    setSending(true);
    let sent = false;
    if (action === 'create') {
      sent = send({ type: 'create_room', bestOf: usesBestOf ? bestOf : 1, tool });
    } else if (action === 'join') {
      sent = send({ type: 'join_room', roomId: joinCode.trim() });
    } else {
      sent = send({ type: 'create_room', bestOf: 1, tool });
    }
    if (!sent) {
      setSending(false);
      setRequestTimedOut(true);
    }
  };

  const createRoom = () => {
    runAction('create');
  };

  const joinRoom = () => {
    const code = joinCode.trim();
    if (code.length !== ROOM_CODE_LENGTH || sending) return;
    runAction('join');
  };

  const startNow = () => {
    runAction('start');
  };

  const retryLastAction = () => {
    if (!canAct || !lastAction || sending) return;
    if (lastAction === 'join' && !joinCode.trim()) return;
    runAction(lastAction);
  };

  if (!usesBestOf) {
    return (
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <div className="text-center mb-10">
          <h1 className="text-headline-lg-mobile sm:text-headline-lg text-on-surface">{toolName(tool)}</h1>
          <p className="text-label-md text-on-surface-variant mt-1">{toolSubtitle(tool)}</p>
        </div>

        {!connected && (
          <div className="text-center text-label-sm text-on-surface-variant mb-4">
            {offlineSoloAvailable ? t('lobby.offlineSoloHint') : t('app.connecting')}
          </div>
        )}

        {error && (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="border-2 border-primary bg-surface-alt text-on-surface text-label-md px-4 py-3 mb-4 text-center"
            onClick={() => dispatch({ type: 'CLEAR_ERROR' })}>{translateError(error.code, error.message)}</motion.div>
        )}

        {!error && requestTimedOut && (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="border-2 border-primary bg-surface-alt text-on-surface text-label-md px-4 py-3 mb-4 text-center"
          >
            <p>{translateError('connection_timeout', 'Connection timed out. Please try again.')}</p>
            <button
              onClick={retryLastAction}
              disabled={!canAct}
              className="mt-2 px-3 py-1 border border-primary text-on-surface hover:bg-surface transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {t('app.reconnectNow')}
            </button>
          </motion.div>
        )}

        <div className="bg-surface-alt border border-border p-6">
          <p className="text-label-md text-on-surface-variant mb-4">
            {offlineSoloAvailable ? t('lobby.offlineSoloShareHint') : t('lobby.soloHint')}
          </p>
          <button onClick={startNow} disabled={!canAct || sending}
            className="w-full py-3 bg-primary text-on-primary font-medium hover:bg-primary-container active:bg-primary-container transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
            {sending ? t('toolSelector.joining') : t('common.startNow')}</button>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
      <div className="text-center mb-10">
        <h1 className="text-headline-lg-mobile sm:text-headline-lg text-on-surface">{toolName(tool)}</h1>
        <p className="text-label-md text-on-surface-variant mt-1">{toolSubtitle(tool)}</p>
      </div>

      {!connected && <div className="text-center text-label-sm text-on-surface-variant mb-4">{t('app.connecting')}</div>}

      {error && (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
          className="border-2 border-primary bg-surface-alt text-on-surface text-label-md px-4 py-3 mb-4 text-center"
          onClick={() => dispatch({ type: 'CLEAR_ERROR' })}>{translateError(error.code, error.message)}</motion.div>
      )}

      {!error && requestTimedOut && (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
          className="border-2 border-primary bg-surface-alt text-on-surface text-label-md px-4 py-3 mb-4 text-center"
        >
          <p>{translateError('connection_timeout', 'Connection timed out. Please try again.')}</p>
          <button
            onClick={retryLastAction}
            disabled={!connected}
            className="mt-2 px-3 py-1 border border-primary text-on-surface hover:bg-surface transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {t('app.reconnectNow')}
          </button>
        </motion.div>
      )}

      <div className="bg-surface-alt border border-border p-6 mb-4">
        <h2 className="text-label-sm text-on-surface-variant uppercase tracking-[0.05em] mb-4">{t('common.createRoom')}</h2>
        {usesBestOf && (
          <div className="flex items-center gap-2 mb-4">
            <span className="text-label-md text-on-surface-variant">{t('lobby.bestOf')}</span>
            <div className={`flex gap-1 ${isRtl ? 'mr-auto' : 'ml-auto'}`}>
              {BEST_OF_OPTIONS.map((n) => (
                <button
                  key={n}
                  onClick={() => setBestOf(n)}
                  className={`w-9 h-9 text-label-md transition-colors ${bestOf === n ? 'bg-primary text-on-primary' : 'bg-surface-container-lowest text-on-surface border border-border hover:border-on-surface'
                    }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        )}
        {!usesBestOf && (
          <p className="text-label-md text-on-surface-variant mb-4">
            {t('lobby.toolSyncHint')}
          </p>
        )}
        <button onClick={createRoom} disabled={!connected || sending}
          className="w-full py-3 bg-primary text-on-primary font-medium hover:bg-primary-container active:bg-primary-container transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
          {sending ? t('toolSelector.joining') : t('common.createRoom')}</button>
      </div>

      <div className="flex items-center gap-3 my-4">
        <div className="flex-1 h-px bg-border" />
        <span className="text-label-sm text-on-surface-variant uppercase tracking-[0.05em]">{t('common.or')}</span>
        <div className="flex-1 h-px bg-border" />
      </div>

      <div className="bg-surface-alt border border-border p-6">
        <h2 className="text-label-sm text-on-surface-variant uppercase tracking-[0.05em] mb-4">{t('common.joinRoom')}</h2>
        <input type="text" maxLength={ROOM_CODE_LENGTH} inputMode="numeric" placeholder={t('lobby.joinCodePlaceholder')} value={joinCode}
          dir="ltr"
          onChange={(e) => setJoinCode(e.target.value.replace(/\D/g, '').slice(0, ROOM_CODE_LENGTH))}
          onKeyDown={(e) => e.key === 'Enter' && joinRoom()}
          className="w-full px-4 py-3 bg-surface-container-lowest border border-border text-on-surface text-center text-lg font-mono tracking-[0.4em] placeholder:text-on-surface-variant placeholder:tracking-normal placeholder:font-sans placeholder:text-sm focus:outline-none focus:border-on-surface transition-colors mb-3" />
        {joinCode.length > 0 && joinCode.length !== ROOM_CODE_LENGTH && (
          <p className="text-label-sm text-on-surface-variant mb-2 text-center">{t('lobby.joinCodeLength', { n: ROOM_CODE_LENGTH })}</p>
        )}
        <button onClick={joinRoom} disabled={!connected || joinCode.trim().length !== ROOM_CODE_LENGTH}
          className="w-full py-3 bg-surface-container-lowest border border-primary text-on-surface font-medium hover:bg-surface-alt transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
          {t('common.join')}</button>
      </div>
    </motion.div>
  );
}