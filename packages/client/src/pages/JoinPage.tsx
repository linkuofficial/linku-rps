import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useWebSocket } from '../hooks/useWebSocket';
import { useGameState } from '../hooks/useGameState';
import Game from './Game';
import Finished from './Finished';
import { motion } from 'framer-motion';

export default function JoinPage() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const { state, dispatch, handleMessage } = useGameState();
  const { send, connected } = useWebSocket(handleMessage);

  useEffect(() => {
    if (connected && code) { send({ type: 'join_room', roomId: code.toUpperCase() }); }
  }, [connected, code]);

  if (state.phase === 'playing') {
    return (<div className="min-h-screen bg-white flex items-center justify-center p-4"><div className="w-full max-w-md"><Game state={state} send={send} dispatch={dispatch} /></div></div>);
  }
  if (state.phase === 'finished') {
    return (<div className="min-h-screen bg-white flex items-center justify-center p-4"><div className="w-full max-w-md"><Finished state={state} /></div></div>);
  }

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center">
        {state.error ? (
          <div><p className="text-red-500 mb-4">{state.error}</p>
            <button onClick={() => navigate('/')} className="px-6 py-2 bg-gray-900 text-white rounded-xl font-medium">回首頁</button></div>
        ) : (<div className="text-gray-400">加入房間中...</div>)}
      </motion.div>
    </div>
  );
}