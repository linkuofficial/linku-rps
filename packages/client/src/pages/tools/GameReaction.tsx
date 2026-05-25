import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence } from '../../lib/motion-lite';
import { motion } from '../../lib/motion-lite';
import EmojiBar from '../../components/EmojiBar';
import Chat from '../../components/Chat';
import { useI18n } from '../../i18n';
import type { ReactionMode } from '@rps/shared';
import type { GameToolProps } from './types';

type ReactionUiMode = ReactionMode;

const REACTION_UI_STORAGE_KEY = 'linku-reaction-ui-mode';

function normalizeReactionUiMode(value: string | null | undefined): ReactionUiMode {
    if (value === 'target') return 'target';
    return 'f1';
}

function getInitialReactionUiMode(): ReactionUiMode {
    if (typeof window === 'undefined') return 'f1';
    return normalizeReactionUiMode(window.localStorage.getItem(REACTION_UI_STORAGE_KEY));
}

export default function GameReaction({ state, send, exportCsv, sendEmoji, sendChat, showChat, setShowChat }: GameToolProps) {
    const { t, whoLabel } = useI18n();
    const [reactionUiMode, setReactionUiMode] = useState<ReactionUiMode>(() => getInitialReactionUiMode());
    const [reactionNow, setReactionNow] = useState(() => Date.now());

    const reaction = state.reactionState;
    const mySlot = state.mySlot;
    const oppSlot = mySlot === 'a' ? 'b' : 'a';

    const pressReaction = useCallback(() => {
        send({ type: 'reaction_press' });
    }, [send]);

    const toggleReactionReady = () => {
        if (!reaction || !mySlot) {
            send({ type: 'reaction_ready', ready: true, mode: reactionUiMode });
            return;
        }
        const isReady = reaction.readyBy.includes(mySlot);
        send({ type: 'reaction_ready', ready: !isReady, mode: reaction.mode });
    };

    const updateReactionMode = (nextMode: ReactionUiMode) => {
        setReactionUiMode(nextMode);
        if (state.tool !== 'reaction') return;
        if (reaction?.phase === 'countdown' || reaction?.phase === 'green') return;
        const isReady = !!(reaction && mySlot && reaction.readyBy.includes(mySlot));
        send({ type: 'reaction_ready', ready: isReady, mode: nextMode });
    };

    useEffect(() => {
        if (state.tool !== 'reaction') return;
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key !== 'F1') return;
            e.preventDefault();
            pressReaction();
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [state.tool, pressReaction]);

    useEffect(() => {
        window.localStorage.setItem(REACTION_UI_STORAGE_KEY, reactionUiMode);
    }, [reactionUiMode]);

    useEffect(() => {
        if (state.tool !== 'reaction' || !reaction?.mode) return;
        setReactionUiMode(reaction.mode);
    }, [state.tool, reaction?.mode]);

    useEffect(() => {
        if (state.tool !== 'reaction') return;
        if (reaction?.phase !== 'countdown' && reaction?.phase !== 'green') return;
        setReactionNow(Date.now());
        const timer = window.setInterval(() => setReactionNow(Date.now()), 50);
        return () => window.clearInterval(timer);
    }, [state.tool, reaction?.phase, reaction?.greenAt]);

    const reactionModes: { id: ReactionUiMode; label: string; desc: string }[] = [
        { id: 'f1', label: t('reaction.modeF1Label'), desc: t('reaction.modeF1Desc') },
        { id: 'target', label: t('reaction.modeTargetLabel'), desc: t('reaction.modeTargetDesc') },
    ];
    const syncedMode = reaction?.mode ?? reactionUiMode;
    const countdownTotalMs = reaction?.phase === 'countdown' ? (reaction.countdownMs ?? 0) : 0;
    const countdownRemainingMs = reaction?.phase === 'countdown' && reaction.greenAt
        ? Math.max(0, reaction.greenAt - reactionNow) : 0;
    const countdownProgress = reaction?.phase === 'green' ? 1
        : countdownTotalMs > 0 ? Math.min(1, Math.max(0, (countdownTotalMs - countdownRemainingMs) / countdownTotalMs)) : 0;
    const f1LightsActive = reaction?.phase === 'green' ? 5
        : reaction?.phase === 'countdown' ? Math.min(5, Math.ceil(countdownProgress * 5)) : 0;
    const isReactionLocked = reaction?.phase === 'countdown' || reaction?.phase === 'green';
    const myReady = !!(reaction && mySlot && reaction.readyBy.includes(mySlot));
    const oppReady = !!(reaction && oppSlot && reaction.readyBy.includes(oppSlot));
    const targetValueText = reaction?.targetCentis == null ? '--' : (reaction.targetCentis / 100).toFixed(2);
    const formatDelta = (d: number | null | undefined) => d == null ? '-' : (d / 100).toFixed(2);
    const runningStopwatchText = reaction?.phase === 'green' && reaction?.greenAt
        ? ((reactionNow - reaction.greenAt) / 1000).toFixed(2) : '0.00';
    const winnerLabel = reaction?.winner
        ? reaction.winner === 'draw' ? t('reaction.winnerDraw')
            : whoLabel(reaction.winner === mySlot ? 'me' : 'opp')
        : t('reaction.noResult');
    const phaseLabel = reaction?.phase === 'green' ? t('reaction.phaseGreen')
        : reaction?.phase === 'countdown' ? t('reaction.phaseCountdown')
        : reaction?.phase === 'result' ? t('reaction.phaseResult')
        : t('reaction.phaseIdle');

    return (
        <>
            <div className="mb-4 border border-black bg-white p-3 sm:p-4">
                <div className="mb-2 flex items-center justify-between gap-3">
                    <div>
                        <div className="text-label-sm text-on-surface-variant">{t('reaction.title')}</div>
                        <div className="text-sm text-on-surface-variant">{t('reaction.modePickerHint')}</div>
                    </div>
                    <div className="text-label-sm text-on-surface-variant">{phaseLabel}</div>
                </div>

                <div className="mb-3 grid grid-cols-2 gap-2">
                    {reactionModes.map((mode) => {
                        const selected = syncedMode === mode.id;
                        return (
                            <button
                                key={mode.id}
                                type="button"
                                onClick={() => updateReactionMode(mode.id)}
                                className={`border px-3 py-2 text-left transition-colors ${selected ? 'border-black bg-black text-white' : 'border-border bg-white text-on-surface hover:border-black'}`}
                            >
                                <div className="text-sm font-semibold">{mode.label}</div>
                                <div className={`mt-1 text-xs ${selected ? 'text-white/80' : 'text-on-surface-variant'}`}>{mode.desc}</div>
                            </button>
                        );
                    })}
                </div>

                <div className="border border-black p-4">
                    {reaction?.phase === 'result' ? (
                        <div className="rounded-md border border-border bg-surface-alt p-4 text-center">
                            <div className="text-label-sm text-on-surface-variant">{t('reaction.lastResult')}</div>
                            <div className="mt-1 text-2xl font-semibold text-on-surface">{winnerLabel}</div>
                            <div className="mx-auto mt-3 w-full max-w-md space-y-2 text-sm text-on-surface">
                                <div className="flex items-center justify-between border border-border bg-white px-3 py-2">
                                    <span>{t('reaction.youMs')}</span>
                                    <span className="font-semibold">{reaction?.reactionMs[(mySlot ?? 'a')] ?? '-'}</span>
                                </div>
                                <div className="flex items-center justify-between border border-border bg-white px-3 py-2">
                                    <span>{t('reaction.oppMs')}</span>
                                    <span className="font-semibold">{reaction?.reactionMs[(oppSlot ?? 'b')] ?? '-'}</span>
                                </div>
                                {syncedMode === 'target' && (
                                    <>
                                        <div className="flex items-center justify-between border border-border bg-white px-3 py-2">
                                            <span>{t('reaction.targetValue')}</span>
                                            <span className="font-semibold">{targetValueText}</span>
                                        </div>
                                        <div className="flex items-center justify-between border border-border bg-white px-3 py-2">
                                            <span>{t('reaction.deltaYou')}</span>
                                            <span className="font-semibold">{formatDelta(reaction?.deltaCentis[(mySlot ?? 'a')])}</span>
                                        </div>
                                        <div className="flex items-center justify-between border border-border bg-white px-3 py-2">
                                            <span>{t('reaction.deltaOpp')}</span>
                                            <span className="font-semibold">{formatDelta(reaction?.deltaCentis[(oppSlot ?? 'b')])}</span>
                                        </div>
                                    </>
                                )}
                            </div>
                            {reaction?.falseStartBy && (
                                <div className="mx-auto mt-3 max-w-md border border-border bg-white px-3 py-2 text-label-sm text-on-surface">
                                    {t('reaction.falseStartBy', { who: whoLabel(reaction.falseStartBy === mySlot ? 'me' : 'opp') })}
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-4 text-center">
                            {reaction?.phase === 'green' ? (
                                <>
                                    <div className="text-label-sm uppercase tracking-[0.2em] text-on-surface-variant">{t('reaction.pressNow')}</div>
                                    {syncedMode === 'f1' ? (
                                        <div className="mx-auto grid w-full max-w-[320px] grid-cols-5 gap-2 rounded-md border border-black bg-black p-3">
                                            {Array.from({ length: 5 }, (_, i) => {
                                                const active = f1LightsActive > i;
                                                return (
                                                    <div key={`f1-light-${i}`} className={`aspect-square rounded-full border ${active ? 'border-white bg-white' : 'border-white/20 bg-white/10'}`} />
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        <div className="mx-auto w-full max-w-[320px] rounded-md border border-black bg-black px-4 py-3 text-white">
                                            <div className="text-label-sm text-white/70">{t('reaction.targetValue')}</div>
                                            <div className="mt-1 text-2xl font-semibold">{targetValueText}</div>
                                            <div className="mt-2 text-label-sm text-white/70">{t('reaction.timerNow')}</div>
                                            <div className="text-3xl font-semibold tabular-nums">{runningStopwatchText}</div>
                                        </div>
                                    )}
                                    <button onClick={pressReaction} className="w-full border border-black bg-black py-6 text-2xl font-semibold text-white transition-colors hover:bg-primary-container">
                                        {t('reaction.pressButton')} (F1)
                                    </button>
                                </>
                            ) : reaction?.phase === 'countdown' ? (
                                <>
                                    <div className="mx-auto w-full max-w-[320px] rounded-md border border-black px-4 py-5">
                                        {syncedMode === 'target' && (
                                            <div className="text-label-sm text-on-surface-variant">{t('reaction.targetValue')}: ?</div>
                                        )}
                                        <div className="mt-2 text-4xl font-semibold tabular-nums text-on-surface">{(countdownRemainingMs / 1000).toFixed(2)}</div>
                                        <div className="mt-2 text-sm text-on-surface-variant">{t('reaction.phaseCountdown')}</div>
                                    </div>
                                    <button disabled className="w-full border border-border bg-surface-alt py-5 text-lg font-medium text-on-surface-variant opacity-90">
                                        {t('reaction.waitForGreen')}
                                    </button>
                                </>
                            ) : (
                                <>
                                    <div className="mx-auto w-full max-w-[320px] rounded-md border border-black px-4 py-6">
                                        <div className="text-label-sm text-on-surface-variant">{syncedMode === 'target' ? t('reaction.targetValue') : t('reaction.modeF1Label')}</div>
                                        <div className="mt-1 text-4xl font-semibold text-on-surface tabular-nums">{syncedMode === 'target' ? '?' : 'F1'}</div>
                                        <div className="mt-3 grid grid-cols-2 gap-2 text-label-sm text-on-surface-variant">
                                            <div>{t('reaction.youReady')}: {myReady ? t('reaction.ready') : t('reaction.notReady')}</div>
                                            <div>{t('reaction.oppReady')}: {oppReady ? t('reaction.ready') : t('reaction.notReady')}</div>
                                        </div>
                                    </div>
                                    <button
                                        onClick={toggleReactionReady}
                                        disabled={isReactionLocked}
                                        className="w-full border border-black bg-black py-4 text-lg font-semibold text-white transition-colors hover:bg-primary-container disabled:opacity-40 disabled:cursor-not-allowed"
                                    >
                                        {myReady ? t('reaction.cancelReady') : t('reaction.tapReady')}
                                    </button>
                                </>
                            )}
                        </div>
                    )}
                </div>
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
