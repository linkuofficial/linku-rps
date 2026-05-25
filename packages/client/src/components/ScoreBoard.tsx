import { motion } from '../lib/motion-lite';
import type { PlayerSlot } from '@rps/shared';
import { useI18n } from '../i18n';

interface Props { score: { a: number; b: number }; mySlot: PlayerSlot; bestOf: number; round: number; }

export default function ScoreBoard({ score, mySlot, bestOf, round }: Props) {
  const { t } = useI18n();
  const oppSlot = mySlot === 'a' ? 'b' : 'a';
  const winsNeeded = Math.ceil(bestOf / 2);

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between px-2 mb-2">
        <span className="text-label-sm text-on-surface-variant uppercase tracking-[0.05em]">{t('score.round', { round: Math.min(round - 1, bestOf), bestOf })}</span>
        <span className="text-label-sm text-on-surface-variant">{t('score.firstTo', { wins: winsNeeded })}</span>
      </div>
      <div className="flex items-center justify-center gap-6">
        <div className="text-center">
          <motion.div key={score[mySlot]} initial={{ scale: 1.3 }} animate={{ scale: 1 }} className="text-3xl font-bold text-on-surface">{score[mySlot]}</motion.div>
          <div className="text-label-sm text-on-surface-variant mt-1">{t('score.you')}</div>
        </div>
        <div className="text-on-surface-variant text-xl font-light">:</div>
        <div className="text-center">
          <motion.div key={score[oppSlot]} initial={{ scale: 1.3 }} animate={{ scale: 1 }} className="text-3xl font-bold text-on-surface">{score[oppSlot]}</motion.div>
          <div className="text-label-sm text-on-surface-variant mt-1">{t('score.opp')}</div>
        </div>
      </div>
    </div>
  );
}