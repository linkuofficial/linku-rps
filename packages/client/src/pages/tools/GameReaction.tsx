import { useCallback, useEffect, useState } from 'react';
import ToolSocial from './ToolSocial';
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
        if (state.tool !== 'reaction' || reaction?.phase === 'countdown' || reaction?.phase === 'green') return;
        setReactionUiMode(nextMode);
        const isReady = !!(reaction && mySlot && reaction.readyBy.includes(mySlot));
        send({ type: 'reaction_ready', ready: isReady, mode: nextMode });
    };

    useEffect(() => {
        if (state.tool !== 'reaction') return;
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key !== 'F1' || e.repeat || (e.target instanceof HTMLElement && (e.target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)))) return;
            if (reaction?.phase !== 'countdown' && reaction?.phase !== 'green') return;
            if (reaction.mode === 'target' && reaction.phase !== 'green') return;
            if (mySlot && reaction.pressedBy.includes(mySlot)) return;
            e.preventDefault();
            pressReaction();
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [state.tool, pressReaction, reaction, mySlot]);

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
    const countdownElapsedMs = reaction?.phase === 'countdown'
        ? Math.max(0, countdownTotalMs - countdownRemainingMs)
        : 0;
    const countdownProgress = reaction?.phase === 'green' ? 1
        : countdownTotalMs > 0 ? Math.min(1, Math.max(0, (countdownTotalMs - countdownRemainingMs) / countdownTotalMs)) : 0;
    const f1LightsActive = reaction?.phase === 'countdown'
        ? syncedMode === 'f1'
            ? Math.min(5, Math.floor(countdownElapsedMs / 1000) + 1)
            : Math.min(5, Math.ceil(countdownProgress * 5))
        : 0;
    const isReactionLocked = reaction?.phase === 'countdown' || reaction?.phase === 'green';
    const myReady = !!(reaction && mySlot && reaction.readyBy.includes(mySlot));
    const oppReady = !!(reaction && oppSlot && reaction.readyBy.includes(oppSlot));
    const iAlreadyPressed = !!(reaction?.pressedBy && mySlot && reaction.pressedBy.includes(mySlot));
    const isIdlePhase = !reaction || reaction.phase === 'idle';
    const isCountdownPhase = reaction?.phase === 'countdown';
    const isGreenPhase = reaction?.phase === 'green';
    const isTargetMode = syncedMode === 'target';
    const f1LightVisualActive = isCountdownPhase ? f1LightsActive : 0;
    const primaryActionDisabled = isIdlePhase ? false : iAlreadyPressed || (isTargetMode && !isGreenPhase);
    const primaryActionLabel = isIdlePhase
        ? (myReady ? t('reaction.cancelReady') : t('reaction.tapReady'))
        : (isTargetMode ? t('reaction.pressButton') : `${t('reaction.pressButton')} (F1)`);
    const stageHint = isIdlePhase
        ? `${t('reaction.youReady')}: ${myReady ? t('reaction.ready') : t('reaction.notReady')} ${state.roomId ? `| ${t('reaction.oppReady')}: ${oppReady ? t('reaction.ready') : t('reaction.notReady')}` : ''}`
        : isCountdownPhase ? t('reaction.phaseCountdown')
            : isGreenPhase ? t('reaction.phaseGreen')
                : t('reaction.phaseIdle');
    const targetValueText = reaction?.targetCentis == null ? '--' : (reaction.targetCentis / 100).toFixed(2);
    const formatDelta = (d: number | null | undefined) => d == null ? '-' : (d / 100).toFixed(2);
    const myReactionMs = reaction?.reactionMs[(mySlot ?? 'a')] ?? null;
    const oppReactionMs = reaction?.reactionMs[(oppSlot ?? 'b')] ?? null;
    const myDeltaCentis = reaction?.deltaCentis[(mySlot ?? 'a')] ?? null;
    const oppDeltaCentis = reaction?.deltaCentis[(oppSlot ?? 'b')] ?? null;
    const myReactionText = myReactionMs == null ? '-' : String(myReactionMs);
    const oppReactionText = oppReactionMs == null ? '-' : String(oppReactionMs);
    const runningStopwatchText = reaction?.phase === 'green' && reaction?.greenAt
        ? ((reactionNow - reaction.greenAt) / 1000).toFixed(2) : '0.00';
    const winnerLabel = reaction?.winner
        ? reaction.winner === 'draw' ? t('reaction.winnerDraw')
            : whoLabel(reaction.winner === mySlot ? 'me' : 'opp')
        : t('reaction.noResult');
    return (
        <>
            <div className="reaction-panel mb-4 border border-primary bg-surface-container-lowest p-3 sm:p-4">
                <div className="mb-2">
                    <div>
                        <div className="text-label-sm text-on-surface-variant">{t('reaction.title')}</div>
                        <div className="text-sm text-on-surface-variant">{state.roomId ? t('reaction.modePickerHint') : t('reaction.soloHint')}</div>
                    </div>
                </div>

                <div className="mb-3 grid grid-cols-2 gap-2">
                    {reactionModes.map((mode) => {
                        const selected = syncedMode === mode.id;
                        return (
                            <button
                                key={mode.id}
                                type="button"
                                onClick={() => updateReactionMode(mode.id)} disabled={isReactionLocked} aria-pressed={selected}
                                className={`border px-3 py-2 text-left transition-colors ${selected ? 'border-primary bg-primary text-on-primary' : 'border-border bg-surface-container-lowest text-on-surface hover:border-on-surface'}`}
                            >
                                <div className="text-sm font-semibold">{mode.label}</div>
                                <div className={`mt-1 text-xs ${selected ? 'text-on-primary/80' : 'text-on-surface-variant'}`}>{mode.desc}</div>
                            </button>
                        );
                    })}
                </div>

                <div className="p-4">
                    {reaction?.phase === 'result' ? (
                        <div role="status" aria-live="polite" className="rounded-md border border-border bg-surface-alt p-4 text-center">
                            <div className="text-label-sm text-on-surface-variant">{t('reaction.lastResult')}</div>
                            {state.roomId && <div className="mt-1 text-2xl font-semibold text-on-surface">{winnerLabel}</div>}
                            <div className={`mx-auto mt-3 grid w-full max-w-md grid-cols-1 gap-2 text-sm text-on-surface ${state.roomId || syncedMode === 'target' ? 'sm:grid-cols-2' : ''}`}>
                                <div className="border border-border bg-surface-container-lowest px-3 py-2 text-left">
                                    <div className="text-label-sm text-on-surface-variant">{t('reaction.youMs')}</div>
                                    <div className="mt-1 text-xl font-semibold tabular-nums">{myReactionText}</div>
                                </div>
                                {state.roomId && <div className="border border-border bg-surface-container-lowest px-3 py-2 text-left">
                                    <div className="text-label-sm text-on-surface-variant">{t('reaction.oppMs')}</div>
                                    <div className="mt-1 text-xl font-semibold tabular-nums">{oppReactionText}</div>
                                </div>}
                                {syncedMode === 'target' && (
                                    <>
                                        <div className="border border-border bg-surface-container-lowest px-3 py-2 text-left sm:col-span-2">
                                            <div className="text-label-sm text-on-surface-variant">{t('reaction.targetValue')}</div>
                                            <div className="mt-1 text-xl font-semibold tabular-nums">{targetValueText}</div>
                                        </div>
                                        <div className="border border-border bg-surface-container-lowest px-3 py-2 text-left">
                                            <div className="text-label-sm text-on-surface-variant">{t('reaction.deltaYou')}</div>
                                            <div className="mt-1 text-xl font-semibold tabular-nums">{formatDelta(myDeltaCentis)}</div>
                                        </div>
                                        {state.roomId && <div className="border border-border bg-surface-container-lowest px-3 py-2 text-left">
                                            <div className="text-label-sm text-on-surface-variant">{t('reaction.deltaOpp')}</div>
                                            <div className="mt-1 text-xl font-semibold tabular-nums">{formatDelta(oppDeltaCentis)}</div>
                                        </div>}
                                    </>
                                )}
                            </div>
                            {reaction?.falseStartBy && (
                                <div className="mx-auto mt-3 max-w-md border border-border bg-surface-container-lowest px-3 py-2 text-label-sm text-on-surface">
                                    {t('reaction.falseStartBy', { who: whoLabel(reaction.falseStartBy === mySlot ? 'me' : 'opp') })}
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-4 text-center">
                            <div className="mx-auto w-full max-w-[360px] px-4 py-5">
                                {isTargetMode ? (
                                    <div className="mx-auto w-full max-w-[320px] rounded-md border border-primary bg-primary px-4 py-3 text-on-primary">
                                        <div className="text-label-sm text-on-primary/70">{t('reaction.targetValue')}</div>
                                        <div className="mt-1 text-2xl font-semibold">{targetValueText}</div>
                                        <div className="mt-2 text-label-sm text-on-primary/70">{t('reaction.timerNow')}</div>
                                        <div className="text-3xl font-semibold tabular-nums">{isGreenPhase ? runningStopwatchText : '0.00'}</div>
                                    </div>
                                ) : (
                                    <div className="mx-auto grid w-full max-w-[320px] grid-cols-5 gap-2 rounded-md border border-primary bg-primary p-3">
                                        {Array.from({ length: 5 }, (_, i) => {
                                            const active = f1LightVisualActive > i;
                                            return (
                                                <div
                                                    key={`stage-f1-light-${i}`}
                                                    className={`aspect-square rounded-full border ${active ? 'border-red-300 bg-red-500' : 'border-on-primary/20 bg-on-primary/10'}`}
                                                />
                                            );
                                        })}
                                    </div>
                                )}
                                <div className="mt-3 text-label-sm uppercase tracking-[0.15em] text-on-surface-variant">{stageHint}</div>
                            </div>

                            <button
                                onClick={isIdlePhase ? toggleReactionReady : pressReaction}
                                disabled={primaryActionDisabled}
                                className="w-full border border-primary bg-primary py-6 text-2xl font-semibold text-on-primary transition-colors hover:bg-primary-container disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                {primaryActionLabel}
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {reaction?.phase === 'result' && <button onClick={() => send({ type: 'reaction_ready', ready: true, mode: syncedMode })} className="tool-primary-action mb-4 min-h-11 w-full bg-primary py-3 font-medium text-on-primary hover:bg-primary-container">{t('reaction.tryAgain')}</button>}

            <button
                onClick={exportCsv}
                disabled={!state.history.length}
                className="tool-export w-full py-2 border border-primary text-on-surface text-sm font-medium hover:bg-surface-alt transition-colors mb-4 disabled:opacity-40 disabled:cursor-not-allowed"
            >
                {t('common.exportCsv')}
            </button>

            <ToolSocial {...{ state, sendEmoji, sendChat, showChat, setShowChat }} />
        </>
    );
}
