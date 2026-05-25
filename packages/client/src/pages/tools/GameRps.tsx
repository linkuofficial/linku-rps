import { AnimatePresence } from '../../lib/motion-lite';
import { motion } from '../../lib/motion-lite';
import EmojiBar from '../../components/EmojiBar';
import Chat from '../../components/Chat';
import ScoreBoard from '../../components/ScoreBoard';
import Arena from '../../components/Arena';
import ChoiceButton from '../../components/ChoiceButton';
import { useI18n } from '../../i18n';
import type { Choice } from '@rps/shared';
import type { GameToolProps } from './types';

const CHOICES: { choice: Choice; emoji: string }[] = [
    { choice: 'rock', emoji: '\u270A' },
    { choice: 'paper', emoji: '\u270B' },
    { choice: 'scissors', emoji: '\u270C\uFE0F' },
];

export default function GameRps({ state, send, dispatch, exportCsv, sendEmoji, sendChat, showChat, setShowChat }: GameToolProps) {
    const { t, choiceLabel } = useI18n();

    const choose = (choice: Choice) => {
        if (state.myChoiceSubmitted) return;
        dispatch({ type: 'CHOICE_MADE', choice });
        send({ type: 'choice', choice });
    };

    const iWon = state.lastResult && (
        (state.lastResult.result === 'a_wins' && state.mySlot === 'a') ||
        (state.lastResult.result === 'b_wins' && state.mySlot === 'b')
    );
    const isDraw = state.lastResult?.result === 'draw';

    return (
        <>
            <ScoreBoard score={state.score} mySlot={state.mySlot!} bestOf={state.bestOf} round={state.round} />
            <Arena myChoice={state.myChoice} lastResult={state.lastResult} mySlot={state.mySlot!} opponentReady={state.opponentReady} />

            <AnimatePresence>
                {state.lastResult && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        className={`text-center py-3 mb-4 font-semibold text-lg border ${iWon ? 'border-black bg-surface-alt text-on-surface' : isDraw ? 'border-border bg-surface-alt text-on-surface-variant' : 'border-black bg-white text-on-surface'}`}
                    >
                        {iWon ? t('rps.result.win') : isDraw ? t('rps.result.draw') : t('rps.result.lose')}
                    </motion.div>
                )}
            </AnimatePresence>

            {!state.lastResult && (
                <div className="text-center text-label-md text-on-surface-variant mb-4">
                    {state.myChoiceSubmitted
                        ? (state.opponentReady ? t('rps.prompt.bothChoosing') : t('rps.prompt.waitOpp'))
                        : (state.opponentReady ? t('rps.prompt.yourTurn') : t('rps.prompt.choose'))}
                </div>
            )}

            <div className="grid grid-cols-3 gap-3 mb-5">
                {CHOICES.map(({ choice, emoji }) => (
                    <ChoiceButton
                        key={choice}
                        choice={choice}
                        emoji={emoji}
                        label={choiceLabel(choice)}
                        selected={state.myChoice === choice}
                        disabled={state.myChoiceSubmitted}
                        onChoose={choose}
                    />
                ))}
            </div>

            <button
                onClick={exportCsv}
                disabled={!state.roomId}
                className="w-full py-2 border border-black text-on-surface text-sm font-medium hover:bg-surface-alt transition-colors mb-4 disabled:opacity-40 disabled:cursor-not-allowed"
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
