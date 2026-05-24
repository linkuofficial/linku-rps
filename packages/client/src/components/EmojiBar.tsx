import { motion } from 'framer-motion';
import { QUICK_EMOJIS } from '@rps/shared';

interface Props { onEmoji: (emoji: string) => void; }

export default function EmojiBar({ onEmoji }: Props) {
  return (
    <div className="flex items-center justify-center gap-2">
      {QUICK_EMOJIS.map((emoji) => (
        <motion.button key={emoji} whileTap={{ scale: 0.8 }} whileHover={{ scale: 1.2 }}
          onClick={() => onEmoji(emoji)} className="text-xl p-1 hover:bg-gray-100 rounded-lg transition-colors">{emoji}</motion.button>
      ))}
    </div>
  );
}