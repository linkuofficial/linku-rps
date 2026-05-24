import { motion, AnimatePresence } from 'framer-motion';
import type { Choice, PlayerSlot } from '@rps/shared';

const EMOJI_MAP: Record<Choice, string> = { rock: '✊', paper: '✋', scissors: '✌️' };

interface Props {
  myChoice: Choice | null;
  lastResult: { choices: { a: Choice; b: Choice }; result: string } | null;
  mySlot: PlayerSlot;
  opponentReady: boolean;
}

export default function Arena({ myChoice, lastResult, mySlot, opponentReady }: Props) {
  const oppSlot = mySlot === 'a' ? 'b' : 'a';
  let myDisplay = '❓';
  let oppDisplay = '❓';

  if (lastResult) {
    myDisplay = EMOJI_MAP[lastResult.choices[mySlot]];
    oppDisplay = EMOJI_MAP[lastResult.choices[oppSlot]];
  } else if (myChoice) {
    myDisplay = EMOJI_MAP[myChoice];
    oppDisplay = opponentReady ? '🤔' : '❓';
  }

  return (
    <div className="flex items-center justify-center gap-8 py-8 mb-4">
      <div className="text-center">
        <div className="text-xs text-gray-400 font-medium mb-2 uppercase">You</div>
        <AnimatePresence mode="wait">
          <motion.div key={myDisplay} initial={{ rotateY: 90, opacity: 0 }} animate={{ rotateY: 0, opacity: 1 }} exit={{ rotateY: -90, opacity: 0 }} transition={{ duration: 0.3 }} className="text-5xl">{myDisplay}</motion.div>
        </AnimatePresence>
      </div>
      <div className="text-gray-200 text-sm font-bold">VS</div>
      <div className="text-center">
        <div className="text-xs text-gray-400 font-medium mb-2 uppercase">Opp</div>
        <AnimatePresence mode="wait">
          <motion.div key={oppDisplay} initial={{ rotateY: 90, opacity: 0 }} animate={{ rotateY: 0, opacity: 1 }} exit={{ rotateY: -90, opacity: 0 }} transition={{ duration: 0.3 }} className="text-5xl">{oppDisplay}</motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}