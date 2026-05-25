import { motion } from '../lib/motion-lite';
import type { ToolId } from '@rps/shared';
import { useI18n } from '../i18n';

interface Props {
  roomId: string;
  bestOf: number;
  tool: ToolId;
}

export default function Waiting({ roomId, bestOf, tool }: Props) {
  const { t, toolName } = useI18n();
  const inviteUrl = `${window.location.origin}/join/${roomId}`;
  const copyLink = async () => { await navigator.clipboard.writeText(inviteUrl); };
  const usesBestOf = tool === 'rps';

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="text-center">
      <h1 className="text-headline-lg-mobile sm:text-headline-lg text-on-surface mb-2">{toolName(tool)}</h1>
      <p className="text-label-md text-on-surface-variant mb-10">{t('waiting.waitingOpponent')}</p>
      <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }}
        className="bg-surface-alt border border-border p-8 mb-4 cursor-pointer hover:border-black transition-colors" onClick={copyLink}>
        <div dir="ltr" className="text-headline-lg font-mono tracking-[0.4em] text-on-surface mb-2">{roomId}</div>
        <div className="text-label-sm text-on-surface-variant">{t('waiting.copyInvite')}</div>
      </motion.div>
      {usesBestOf ? (
        <div className="text-label-md text-on-surface-variant">{t('waiting.bestOfHint', { bestOf, wins: Math.ceil(bestOf / 2) })}</div>
      ) : (
        <div className="text-label-md text-on-surface-variant">{t('waiting.toolHint')}</div>
      )}
      <div className="flex items-center justify-center gap-2 mt-8">
        <motion.div animate={{ scale: [1, 1.2, 1], opacity: [1, 0.5, 1] }} transition={{ duration: 1.5, repeat: Infinity }}
          className="w-2 h-2 bg-on-surface-variant" />
        <span className="text-label-sm text-on-surface-variant">{t('waiting.waiting')}</span>
      </div>
    </motion.div>
  );
}