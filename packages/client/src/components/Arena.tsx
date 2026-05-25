import { motion, AnimatePresence } from '../lib/motion-lite';
import type { Choice, PlayerSlot } from '@rps/shared';
import { useI18n } from '../i18n';

const EMOJI_MAP: Record<Choice, string> = {
  rock: '\u270A',
  paper: '\u270B',
  scissors: '\u270C\uFE0F',
};

interface Props {
  myChoice: Choice | null;
  lastResult: { choices: { a: Choice; b: Choice }; result: string } | null;
  mySlot: PlayerSlot;
  opponentReady: boolean;
}

export default function Arena({ myChoice, lastResult, mySlot, opponentReady }: Props) {
  const { t } = useI18n();
  const oppSlot = mySlot === 'a' ? 'b' : 'a';
  let myDisplay = '\u2753';
  let oppDisplay = '\u2753';

  if (lastResult) {
    myDisplay = EMOJI_MAP[lastResult.choices[mySlot]];
    oppDisplay = EMOJI_MAP[lastResult.choices[oppSlot]];
  } else if (myChoice) {
    myDisplay = EMOJI_MAP[myChoice];
    oppDisplay = opponentReady ? '\uD83E\uDD14' : '\u2753';
  }

  return (
    <div className="flex items-center justify-center gap-8 py-8 mb-4">
      <div className="text-center">
        <div className="text-label-sm text-on-surface-variant mb-2 uppercase tracking-[0.05em]">{t('arena.you')}</div>
        <AnimatePresence mode="wait">
          <motion.div key={myDisplay} initial={{ rotateY: 90, opacity: 0 }} animate={{ rotateY: 0, opacity: 1 }} exit={{ rotateY: -90, opacity: 0 }} transition={{ duration: 0.3 }} className="text-5xl">{myDisplay}</motion.div>
        </AnimatePresence>
      </div>
      <div className="text-on-surface-variant text-sm font-bold">VS</div>
      <div className="text-center">
        <div className="text-label-sm text-on-surface-variant mb-2 uppercase tracking-[0.05em]">{t('arena.opp')}</div>
        <AnimatePresence mode="wait">
          <motion.div key={oppDisplay} initial={{ rotateY: 90, opacity: 0 }} animate={{ rotateY: 0, opacity: 1 }} exit={{ rotateY: -90, opacity: 0 }} transition={{ duration: 0.3 }} className="text-5xl">{oppDisplay}</motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}