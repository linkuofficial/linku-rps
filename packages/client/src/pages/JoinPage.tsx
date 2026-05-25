import { useEffect } from 'react';
import { useLocation, useRoute } from 'wouter';
import { useWebSocket } from '../hooks/useWebSocket';
import { useGameState } from '../hooks/useGameState';
import Game from './Game';
import Finished from './Finished';
import { motion } from '../lib/motion-lite';
import { useI18n } from '../i18n';
import LanguageSwitcherCompact from '../components/LanguageSwitcherCompact';

export default function JoinPage() {
  const { t, translateError } = useI18n();
  const [, params] = useRoute('/join/:code');
  const code = params?.code;
  const [, navigate] = useLocation();
  const { state, dispatch, handleMessage } = useGameState();
  const { send, connected } = useWebSocket(handleMessage);

  useEffect(() => {
    if (connected && code) { send({ type: 'join_room', roomId: code.toUpperCase() }); }
  }, [connected, code, send]);

  if (state.phase === 'playing') {
    return (<div className="min-h-screen bg-white flex items-center justify-center p-4"><div className="w-full max-w-md"><Game state={state} send={send} dispatch={dispatch} /></div></div>);
  }
  if (state.phase === 'finished') {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <Finished state={state} send={send} dispatch={dispatch} connected={connected} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center w-full max-w-md">
        <div className="mb-3 flex justify-end">
          <LanguageSwitcherCompact />
        </div>
        {state.error ? (
          <div><p className="text-red-500 mb-4">{translateError(state.error.code, state.error.message)}</p>
            <button onClick={() => navigate('/')} className="px-6 py-2 bg-gray-900 text-white rounded-xl font-medium">{t('common.backHome')}</button></div>
        ) : (<div className="text-gray-400">{t('join.joining')}</div>)}
      </motion.div>
    </div>
  );
}