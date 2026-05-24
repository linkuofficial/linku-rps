import { motion } from 'framer-motion';
import type { PlayerSlot } from '@rps/shared';

interface Props { score: { a: number; b: number }; mySlot: PlayerSlot; bestOf: number; round: number; }

export default function ScoreBoard({ score, mySlot, bestOf, round }: Props) {
  const oppSlot = mySlot === 'a' ? 'b' : 'a';
  const winsNeeded = Math.ceil(bestOf / 2);

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between px-2 mb-2">
        <span className="text-xs text-gray-400 uppercase tracking-wide">Round {Math.min(round - 1, bestOf)}/{bestOf}</span>
        <span className="text-xs text-gray-400">先贏 {winsNeeded} 局</span>
      </div>
      <div className="flex items-center justify-center gap-6">
        <div className="text-center">
          <motion.div key={score[mySlot]} initial={{ scale: 1.3 }} animate={{ scale: 1 }} className="text-3xl font-extrabold text-gray-900">{score[mySlot]}</motion.div>
          <div className="text-xs text-gray-400 font-medium mt-1">YOU</div>
        </div>
        <div className="text-gray-200 text-xl font-light">:</div>
        <div className="text-center">
          <motion.div key={score[oppSlot]} initial={{ scale: 1.3 }} animate={{ scale: 1 }} className="text-3xl font-extrabold text-gray-900">{score[oppSlot]}</motion.div>
          <div className="text-xs text-gray-400 font-medium mt-1">OPP</div>
        </div>
      </div>
    </div>
  );
}