import { useState } from 'react';
import { motion } from '../lib/motion-lite';
import type { ClientMessage } from '@rps/shared';
import type { ToolId } from '@rps/shared';
import type { GameAction } from '../hooks/useGameState';
import { useI18n } from '../i18n';

const BEST_OF_OPTIONS = [1, 3, 5, 7] as const;

interface Props {
  send: (msg: ClientMessage) => void;
  connected: boolean;
  error: { code: string; message: string } | null;
  dispatch: React.Dispatch<GameAction>;
  tool: ToolId;
}

export default function Lobby({ send, connected, error, dispatch, tool }: Props) {
  const { t, toolName, toolSubtitle, translateError, locale } = useI18n();
  const isRtl = locale === 'ar';
  const [joinCode, setJoinCode] = useState('');
  const [bestOf, setBestOf] = useState(3);

  const usesBestOf = tool === 'rps';

  const createRoom = () => {
    send({ type: 'create_room', bestOf: usesBestOf ? bestOf : 1, tool });
  };
  const joinRoom = () => {
    const code = joinCode.trim();
    if (!code) return;
    send({ type: 'join_room', roomId: code });
  };

  const startNow = () => {
    send({ type: 'create_room', bestOf: 1, tool });
  };

  if (!usesBestOf) {
    return (
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <div className="text-center mb-10">
          <h1 className="text-headline-lg-mobile sm:text-headline-lg text-on-surface">{toolName(tool)}</h1>
          <p className="text-label-md text-on-surface-variant mt-1">{toolSubtitle(tool)}</p>
        </div>

        {!connected && <div className="text-center text-label-sm text-on-surface-variant mb-4">{t('app.connecting')}</div>}

        {error && (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="border-2 border-black bg-surface-alt text-on-surface text-label-md px-4 py-3 mb-4 text-center"
            onClick={() => dispatch({ type: 'CLEAR_ERROR' })}>{translateError(error.code, error.message)}</motion.div>
        )}

        <div className="bg-surface-alt border border-border p-6 mb-4">
          <p className="text-label-md text-on-surface-variant mb-4">{t('lobby.soloHint')}</p>
          <button onClick={startNow} disabled={!connected}
            className="w-full py-3 bg-black text-white font-medium hover:bg-primary-container active:bg-primary-container transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
            {t('common.startNow')}</button>
        </div>

        <div className="bg-surface-alt border border-border p-6">
          <h2 className="text-label-sm text-on-surface-variant uppercase tracking-[0.05em] mb-3">{t('common.joinRoom')}</h2>
          <input type="text" maxLength={4} inputMode="numeric" placeholder={t('lobby.joinCodePlaceholder')} value={joinCode}
            dir="ltr"
            onChange={(e) => setJoinCode(e.target.value.replace(/\D/g, ''))}
            onKeyDown={(e) => e.key === 'Enter' && joinRoom()}
            className="w-full px-4 py-3 bg-white border border-border text-center text-lg font-mono tracking-[0.4em] placeholder:text-on-surface-variant placeholder:tracking-normal placeholder:font-sans placeholder:text-sm focus:outline-none focus:border-black transition-colors mb-3" />
          <button onClick={joinRoom} disabled={!connected || !joinCode.trim()}
            className="w-full py-3 bg-white border border-black text-on-surface font-medium hover:bg-surface-alt transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
            {t('common.join')}</button>
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
          className="border-2 border-black bg-surface-alt text-on-surface text-label-md px-4 py-3 mb-4 text-center"
          onClick={() => dispatch({ type: 'CLEAR_ERROR' })}>{translateError(error.code, error.message)}</motion.div>
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
                  className={`w-9 h-9 text-label-md transition-colors ${bestOf === n ? 'bg-black text-white' : 'bg-white text-on-surface border border-border hover:border-black'
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
        <button onClick={createRoom} disabled={!connected}
          className="w-full py-3 bg-black text-white font-medium hover:bg-primary-container active:bg-primary-container transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
          {t('common.createRoom')}</button>
      </div>

      <div className="flex items-center gap-3 my-4">
        <div className="flex-1 h-px bg-border" />
        <span className="text-label-sm text-on-surface-variant uppercase tracking-[0.05em]">{t('common.or')}</span>
        <div className="flex-1 h-px bg-border" />
      </div>

      <div className="bg-surface-alt border border-border p-6">
        <h2 className="text-label-sm text-on-surface-variant uppercase tracking-[0.05em] mb-4">{t('common.joinRoom')}</h2>
        <input type="text" maxLength={4} inputMode="numeric" placeholder={t('lobby.joinCodePlaceholder')} value={joinCode}
          dir="ltr"
          onChange={(e) => setJoinCode(e.target.value.replace(/\D/g, ''))}
          onKeyDown={(e) => e.key === 'Enter' && joinRoom()}
          className="w-full px-4 py-3 bg-white border border-border text-center text-lg font-mono tracking-[0.4em] placeholder:text-on-surface-variant placeholder:tracking-normal placeholder:font-sans placeholder:text-sm focus:outline-none focus:border-black transition-colors mb-3" />
        <button onClick={joinRoom} disabled={!connected || !joinCode.trim()}
          className="w-full py-3 bg-white border border-black text-on-surface font-medium hover:bg-surface-alt transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
          {t('common.join')}</button>
      </div>
    </motion.div>
  );
}