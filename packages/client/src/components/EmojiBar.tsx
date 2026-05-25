import { motion } from '../lib/motion-lite';

const QUICK_EMOJIS = ['\uD83D\uDC4A', '\uD83C\uDF89', '\uD83D\uDE24', '\uD83E\uDD23', '\uD83D\uDC4F', '\uD83D\uDC80'] as const;

interface Props { onEmoji: (emoji: string) => void; }

export default function EmojiBar({ onEmoji }: Props) {
  return (
    <div className="flex items-center justify-center gap-2">
      {QUICK_EMOJIS.map((emoji) => (
        <motion.button key={emoji} whileTap={{ scale: 0.8 }} whileHover={{ scale: 1.2 }}
          onClick={() => onEmoji(emoji)} className="text-xl p-1 hover:bg-surface-alt transition-colors">{emoji}</motion.button>
      ))}
    </div>
  );
}