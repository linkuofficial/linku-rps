import { motion } from 'framer-motion';
import type { ClientMessage } from '@rps/shared';
import type { GameAction, GameState } from '../hooks/useGameState';

interface Props {
  state: GameState;
  send: (msg: ClientMessage) => void;
  dispatch: React.Dispatch<GameAction>;
  connected: boolean;
}

export default function Finished({ state, send, dispatch, connected }: Props) {
  const iWon = (state.winner === 'a' && state.mySlot === 'a') || (state.winner === 'b' && state.mySlot === 'b');

  const requestRematch = () => {
    send({ type: 'rematch_request' });
  };

  const rematchHint =
    state.rematchRequestedByMe && state.rematchRequestedByOpponent
      ? '雙方已同意，準備開始'
      : state.rematchRequestedByMe
        ? '等待對手同意...'
        : state.rematchRequestedByOpponent
          ? '對手想再來一局'
          : null;

  return (
    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5 }} className="text-center">
      <div className="text-6xl mb-4">{iWon ? '🏆' : '😢'}</div>
      <h1 className="text-3xl font-extrabold text-gray-900 mb-2">{iWon ? '你贏了！' : '你輸了'}</h1>
      <p className="text-gray-400 mb-8">
        最終比分 <span className="font-mono font-bold text-gray-700">{state.score[state.mySlot!]} : {state.score[state.mySlot === 'a' ? 'b' : 'a']}</span>
      </p>

      {rematchHint && <p className="text-sm text-gray-500 mb-4">{rematchHint}</p>}

      <div className="flex gap-3 justify-center">
        <button
          onClick={requestRematch}
          disabled={!connected || state.rematchRequestedByMe}
          className="px-8 py-3 bg-gray-900 text-white rounded-xl font-medium hover:bg-gray-800 active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {state.rematchRequestedByMe ? '已送出要求' : '重新挑戰'}
        </button>
        <button
          onClick={() => dispatch({ type: 'BACK_TO_TOOL_SELECT' })}
          className="px-6 py-3 border border-gray-300 text-gray-700 rounded-xl font-medium hover:border-gray-500 transition-colors"
        >
          回工具列表
        </button>
      </div>
    </motion.div>
  );
}