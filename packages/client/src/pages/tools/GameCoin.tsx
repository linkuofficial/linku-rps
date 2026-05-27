import { AnimatePresence } from '../../lib/motion-lite';
import { motion } from '../../lib/motion-lite';
import EmojiBar from '../../components/EmojiBar';
import Chat from '../../components/Chat';
import { useI18n } from '../../i18n';
import type { GameToolProps } from './types';

export default function GameCoin({ state, send, exportCsv, sendEmoji, sendChat, showChat, setShowChat }: GameToolProps) {
    const { t, whoLabel } = useI18n();

    const coinEmoji = state.coinResult?.result === 'heads'
        ? '\uD83E\uDE99'
        : state.coinResult?.result === 'tails'
            ? '\uD83C\uDF11'
            : '\u2753';
    const coinLabel = state.coinResult?.result === 'heads'
        ? t('coin.heads')
        : state.coinResult?.result === 'tails'
            ? t('coin.tails')
            : t('coin.notYet');
    const flippedByMe = state.coinResult?.by === state.mySlot;

    return (
        <>
            <div
                key={`coin-result-${state.coinResult?.timestamp ?? 'idle'}`}
                className={`tool-result-panel mb-4 border border-border p-5 text-center ${state.coinResult ? 'tool-result-panel--reveal' : ''}`}
            >
                <div className="text-label-sm text-on-surface-variant mb-1">{t('coin.resultRound', { round: Math.max(1, state.round - 1) })}</div>
                <div className={`text-6xl mb-2 ${state.coinResult ? 'result-emoji-pop' : ''}`}>{coinEmoji}</div>
                <div className="text-headline-md text-on-surface">{coinLabel}</div>
                {state.coinResult && (
                    <div className="text-label-sm text-on-surface-variant mt-2">
                        {t('coin.by', { who: whoLabel(flippedByMe ? 'me' : 'opp') })}
                    </div>
                )}
            </div>

            <button
                onClick={() => send({ type: 'coin_flip' })}
                className="w-full py-3 bg-primary text-on-primary font-medium hover:bg-primary-container transition-colors mb-4"
            >
                {t('coin.flip')}
            </button>

            <button
                onClick={exportCsv}
                disabled={!state.roomId}
                className="w-full py-2 border border-primary text-on-surface text-sm font-medium hover:bg-surface-alt transition-colors mb-4 disabled:opacity-40 disabled:cursor-not-allowed"
            >
                {t('common.exportCsv')}
            </button>

            <EmojiBar onEmoji={sendEmoji} />

            <button
                onClick={() => setShowChat(!showChat)}
                className="w-full py-2 text-label-sm text-on-surface-variant hover:text-on-surface hover:underline transition-colors mt-2"
            >
                {showChat ? t('common.hideChat') : `\uD83D\uDCAC ${t('common.chat')}${state.chat.length > 0 ? ` (${state.chat.length})` : ''}`}
            </button>

            <AnimatePresence>
                {showChat && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                    >
                        <Chat messages={state.chat} mySlot={state.mySlot!} onSend={sendChat} />
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}
