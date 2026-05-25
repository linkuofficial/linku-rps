import { useState } from 'react';
import { motion } from 'framer-motion';
import type { ClientMessage } from '@rps/shared';
import { BEST_OF_OPTIONS } from '@rps/shared';
import type { ToolId } from '@rps/shared';
import type { GameAction } from '../hooks/useGameState';

interface Props {
  send: (msg: ClientMessage) => void;
  connected: boolean;
  error: string | null;
  dispatch: React.Dispatch<GameAction>;
  tool: ToolId;
  onBack: () => void;
}

const TOOL_LABELS: Record<ToolId, { title: string; subtitle: string }> = {
  rps: { title: '猜拳', subtitle: 'Rock Paper Scissors' },
  coin: { title: '丟銅板', subtitle: 'Coin Flip' },
  dice: { title: '骰子', subtitle: 'Dice' },
  wheel: { title: '輪盤', subtitle: 'Wheel' },
  draw: { title: '抽籤', subtitle: 'Draw Lots' },
  vote: { title: '投票', subtitle: 'Vote' },
};

export default function Lobby({ send, connected, error, dispatch, tool, onBack }: Props) {
  const [joinCode, setJoinCode] = useState('');
  const [bestOf, setBestOf] = useState(3);

  const labels = TOOL_LABELS[tool];
  const usesBestOf = tool === 'rps';

  const createRoom = () => {
    send({ type: 'create_room', bestOf: usesBestOf ? bestOf : 1, tool });
  };
  const joinRoom = () => {
    const code = joinCode.trim().toUpperCase();
    if (!code) return;
    send({ type: 'join_room', roomId: code });
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
      <div className="mb-4">
        <button
          onClick={onBack}
          className="text-xs font-medium text-gray-500 hover:text-gray-800 transition-colors"
        >
          返回工具列表
        </button>
      </div>
      <div className="text-center mb-10">
        <h1 className="text-4xl font-extrabold tracking-tight text-gray-900">{labels.title}</h1>
        <p className="text-sm text-gray-400 mt-1">{labels.subtitle}</p>
      </div>

      {!connected && <div className="text-center text-sm text-gray-400 mb-4">連線中...</div>}

      {error && (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
          className="bg-red-50 text-red-600 text-sm rounded-xl px-4 py-3 mb-4 text-center"
          onClick={() => dispatch({ type: 'CLEAR_ERROR' })}>{error}</motion.div>
      )}

      <div className="bg-gray-50 rounded-2xl p-6 mb-4">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">建立房間</h2>
        {usesBestOf && (
          <div className="flex items-center gap-2 mb-4">
            <span className="text-sm text-gray-500">局數</span>
            <div className="flex gap-1 ml-auto">
              {BEST_OF_OPTIONS.map((n) => (
                <button
                  key={n}
                  onClick={() => setBestOf(n)}
                  className={`w-9 h-9 rounded-lg text-sm font-medium transition-all ${bestOf === n ? 'bg-gray-900 text-white shadow-sm' : 'bg-white text-gray-600 hover:bg-gray-100'
                    }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        )}
        {!usesBestOf && (
          <p className="text-sm text-gray-500 mb-4">
            房間建立後可由任一方操作工具，結果會即時同步給所有人。
          </p>
        )}
        <button onClick={createRoom} disabled={!connected}
          className="w-full py-3 bg-gray-900 text-white rounded-xl font-medium hover:bg-gray-800 active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed">
          建立房間</button>
      </div>

      <div className="flex items-center gap-3 my-4">
        <div className="flex-1 h-px bg-gray-200" />
        <span className="text-xs text-gray-300 uppercase tracking-widest">or</span>
        <div className="flex-1 h-px bg-gray-200" />
      </div>

      <div className="bg-gray-50 rounded-2xl p-6">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">加入房間</h2>
        <input type="text" maxLength={6} placeholder="輸入房間代碼" value={joinCode}
          onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
          onKeyDown={(e) => e.key === 'Enter' && joinRoom()}
          className="w-full px-4 py-3 bg-white rounded-xl border border-gray-200 text-center text-lg font-mono tracking-[0.3em] uppercase placeholder:text-gray-300 placeholder:tracking-normal placeholder:font-sans placeholder:text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10 transition-all mb-3" />
        <button onClick={joinRoom} disabled={!connected || !joinCode.trim()}
          className="w-full py-3 bg-white border border-gray-200 text-gray-700 rounded-xl font-medium hover:border-gray-400 active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed">
          加入</button>
      </div>
    </motion.div>
  );
}