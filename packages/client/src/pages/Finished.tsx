import { motion } from 'framer-motion';
import type { GameState } from '../hooks/useGameState';

interface Props { state: GameState; }

export default function Finished({ state }: Props) {
  const iWon = (state.winner === 'a' && state.mySlot === 'a') || (state.winner === 'b' && state.mySlot === 'b');
  const reload = () => window.location.reload();

  return (
    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5 }} className="text-center">
      <div className="text-6xl mb-4">{iWon ? '🏆' : '😢'}</div>
      <h1 className="text-3xl font-extrabold text-gray-900 mb-2">{iWon ? '你贏了！' : '你輸了'}</h1>
      <p className="text-gray-400 mb-8">
        最終比分 <span className="font-mono font-bold text-gray-700">{state.score[state.mySlot!]} : {state.score[state.mySlot === 'a' ? 'b' : 'a']}</span>
      </p>
      <button onClick={reload} className="px-8 py-3 bg-gray-900 text-white rounded-xl font-medium hover:bg-gray-800 active:scale-[0.98] transition-all">
        再來一局
      </button>
    </motion.div>
  );
}