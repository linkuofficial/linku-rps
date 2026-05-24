import { motion } from 'framer-motion';
import type { Choice } from '@rps/shared';

interface Props { choice: Choice; emoji: string; label: string; selected: boolean; disabled: boolean; onChoose: (c: Choice) => void; }

export default function ChoiceButton({ choice, emoji, label, selected, disabled, onChoose }: Props) {
  return (
    <motion.button whileTap={{ scale: 0.92 }} whileHover={!disabled ? { scale: 1.05 } : undefined}
      onClick={() => onChoose(choice)} disabled={disabled}
      className={`flex flex-col items-center gap-2 py-5 rounded-2xl border transition-all ${
        selected ? 'bg-gray-900 border-gray-900 text-white shadow-lg'
        : disabled ? 'bg-gray-50 border-gray-100 text-gray-300 cursor-not-allowed'
        : 'bg-white border-gray-200 text-gray-700 hover:border-gray-400 hover:shadow-sm cursor-pointer'
      }`}>
      <span className="text-3xl">{emoji}</span>
      <span className="text-xs font-medium tracking-wide">{label}</span>
    </motion.button>
  );
}