import { motion } from '../lib/motion-lite';
import type { Choice } from '@rps/shared';

interface Props { choice: Choice; emoji: string; label: string; selected: boolean; disabled: boolean; onChoose: (c: Choice) => void; }

export default function ChoiceButton({ choice, emoji, label, selected, disabled, onChoose }: Props) {
  return (
    <motion.button whileTap={{ scale: 0.92 }} whileHover={!disabled ? { scale: 1.03 } : undefined}
      onClick={() => onChoose(choice)} disabled={disabled}
      className={`flex flex-col items-center gap-2 py-5 border transition-colors ${selected ? 'bg-primary border-primary text-on-primary'
        : disabled ? 'bg-surface-alt border-border text-on-surface-variant cursor-not-allowed'
          : 'bg-surface-container-lowest border-border text-on-surface hover:border-on-surface cursor-pointer'
        }`}>
      <span className="text-3xl">{emoji}</span>
      <span className="text-label-sm tracking-[0.05em]">{label}</span>
    </motion.button>
  );
}