import { motion, AnimatePresence } from 'framer-motion';
import type { PlayerSlot } from '@rps/shared';
import type { EmojiFloat } from '../hooks/useGameState';

interface Props { emojis: EmojiFloat[]; mySlot: PlayerSlot; }

export default function EmojiFloats({ emojis, mySlot }: Props) {
  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden z-50">
      <AnimatePresence>
        {emojis.map((e) => {
          const isMe = e.from === mySlot;
          return (
            <motion.div key={e.id} initial={{ opacity: 1, y: 0, x: isMe ? '60vw' : '30vw' }}
              animate={{ opacity: 0, y: -200 }} exit={{ opacity: 0 }}
              transition={{ duration: 2, ease: 'easeOut' }} className="absolute bottom-1/3 text-4xl">{e.emoji}</motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}