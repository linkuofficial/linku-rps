import { useEffect, useRef, useState } from 'react';
import { AnimatePresence } from '../../lib/motion-lite';
import { motion } from '../../lib/motion-lite';
import EmojiBar from '../../components/EmojiBar';
import Chat from '../../components/Chat';
import Icon from '../../components/Icon';
import { useI18n } from '../../i18n';
import type { GameToolProps } from './types';

const DICE_FACE_MAP: Record<number, string> = {
    1: '\u2680', 2: '\u2681', 3: '\u2682', 4: '\u2683', 5: '\u2684', 6: '\u2685',
};

export default function GameDice({ state, send, exportCsv, sendEmoji, sendChat, showChat, setShowChat }: GameToolProps) {
    const { t, whoLabel } = useI18n();

    const [diceCount, setDiceCount] = useState(2);
    const [diceSides, setDiceSides] = useState(6);
    const [diceRolling, setDiceRolling] = useState(false);
    const [dicePulseKey, setDicePulseKey] = useState(0);
    const [dicePreviewValues, setDicePreviewValues] = useState<number[]>([1, 2]);
    const [diceControlsOpen, setDiceControlsOpen] = useState(false);
    const diceResultMarkerRef = useRef<string | null>(null);
    const diceRollFallbackTimerRef = useRef<number | null>(null);

    const rollDice = () => {
        if (diceRollFallbackTimerRef.current) window.clearTimeout(diceRollFallbackTimerRef.current);
        setDiceRolling(true);
        setDicePulseKey((c) => c + 1);
        setDicePreviewValues(
            Array.from({ length: Math.max(1, Math.min(diceCount, 6)) }, () =>
                Math.max(1, Math.floor(Math.random() * diceSides) + 1)
            )
        );
        send({ type: 'dice_roll', count: diceCount, sides: diceSides });
        diceRollFallbackTimerRef.current = window.setTimeout(() => setDiceRolling(false), 2200);
    };

    useEffect(() => {
        const marker = state.diceResult
            ? `${state.diceResult.total}|${state.diceResult.values.join(',')}|${state.diceResult.by}|${state.round}`
            : null;
        if (!marker || marker === diceResultMarkerRef.current) return;
        diceResultMarkerRef.current = marker;
        if (diceRollFallbackTimerRef.current) {
            window.clearTimeout(diceRollFallbackTimerRef.current);
            diceRollFallbackTimerRef.current = null;
        }
        setDiceRolling(false);
        setDicePulseKey((c) => c + 1);
    }, [state.diceResult, state.round]);

    // Clear rolling state when duel result arrives
    useEffect(() => {
        if (!state.diceDuelResult) return;
        if (diceRollFallbackTimerRef.current) {
            window.clearTimeout(diceRollFallbackTimerRef.current);
            diceRollFallbackTimerRef.current = null;
        }
        setDiceRolling(false);
        setDicePulseKey((c) => c + 1);
    }, [state.diceDuelResult]);

    useEffect(() => {
        if (!diceRolling) return;
        const timer = window.setInterval(() => {
            setDicePreviewValues(
                Array.from({ length: Math.max(1, Math.min(diceCount, 6)) }, () =>
                    Math.max(1, Math.floor(Math.random() * diceSides) + 1)
                )
            );
        }, 120);
        return () => window.clearInterval(timer);
    }, [diceRolling, diceCount, diceSides]);

    useEffect(() => {
        if (diceRolling) return;
        setDicePreviewValues(
            Array.from({ length: Math.max(1, Math.min(diceCount, 6)) }, (_, i) => (i % 6) + 1)
        );
    }, [diceCount, diceSides, diceRolling]);

    useEffect(() => {
        return () => {
            if (diceRollFallbackTimerRef.current) window.clearTimeout(diceRollFallbackTimerRef.current);
        };
    }, []);

    const diceVisualValues = diceRolling
        ? dicePreviewValues
        : state.diceResult
            ? state.diceResult.values.slice(0, 6)
            : Array.from({ length: Math.max(1, Math.min(diceCount, 6)) }, () => 0);
    const diceRollMeta = state.diceResult ? `${state.diceResult.count}d${state.diceResult.sides}` : `${diceCount}d${diceSides}`;
    const diceDisplayTotal = state.diceResult ? state.diceResult.total : '--';
    const diceHasStandardFaces = (state.diceResult?.sides ?? diceSides) === 6;
    const rolledByMe = state.diceResult?.by === state.mySlot;

    // Duel result helpers
    const duel = state.diceDuelResult;
    const myDuel = duel ? (state.mySlot === 'a' ? duel.a : duel.b) : null;
    const oppDuel = duel ? (state.mySlot === 'a' ? duel.b : duel.a) : null;
    const duelWonByMe = duel ? duel.winner === state.mySlot : false;
    const duelLost = duel ? (duel.winner !== 'draw' && duel.winner !== state.mySlot) : false;

    const renderDiceCell = (value: number, index: number) => {
        const display = value > 0 && diceHasStandardFaces
            ? (DICE_FACE_MAP[value] ?? String(value))
            : value > 0 ? String(value) : '?';
        return (
            <div
                key={`dice-cell-${index}-${value}`}
                className={`dice-cell ${diceRolling ? 'dice-cell--rolling' : ''}`}
                style={{ animationDelay: `${index * 70}ms` }}
            >
                {display}
            </div>
        );
    };

    return (
        <>
            {/* Duel result panel (multiplayer) */}
            {duel && myDuel && oppDuel && (
                <div
                    key={`duel-${duel.round}-${duel.timestamp}`}
                    className="tool-result-panel dice-result-panel dice-result-panel--settled mb-4 border border-primary px-4 py-5 text-center sm:px-6"
                >
                    <div className="mb-1 text-label-sm text-on-surface-variant">{t('dice.rollRound', { round: duel.round })}</div>
                    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 mb-3">
                        <div className={`text-center ${duelWonByMe ? 'text-primary' : ''}`}>
                            <div className="text-label-sm text-on-surface-variant mb-1">{whoLabel('me')}</div>
                            <div className="dice-total text-on-surface">{myDuel.total}</div>
                            <div className="text-label-sm text-on-surface-variant">{myDuel.count}d{myDuel.sides}</div>
                        </div>
                        <div className="text-label-md text-on-surface-variant font-medium">vs</div>
                        <div className={`text-center ${duelLost ? 'text-primary' : ''}`}>
                            <div className="text-label-sm text-on-surface-variant mb-1">{whoLabel('opp')}</div>
                            <div className="dice-total text-on-surface">{oppDuel.total}</div>
                            <div className="text-label-sm text-on-surface-variant">{oppDuel.count}d{oppDuel.sides}</div>
                        </div>
                    </div>
                    <div className="text-label-md font-medium text-on-surface">
                        {duel.winner === 'draw' ? t('dice.duelDraw') : duelWonByMe ? t('dice.duelWin') : t('dice.duelLose')}
                    </div>
                    {(state.score.a > 0 || state.score.b > 0) && (
                        <div className="mt-2 text-label-sm text-on-surface-variant">
                            {whoLabel('me')} {state.mySlot === 'a' ? state.score.a : state.score.b} – {state.mySlot === 'a' ? state.score.b : state.score.a} {whoLabel('opp')}
                        </div>
                    )}
                </div>
            )}

            {/* Solo result panel (single player or waiting for opponent roll) */}
            {!duel && (
                <div
                    key={dicePulseKey}
                    className={`tool-result-panel dice-result-panel mb-4 border border-primary px-4 py-5 text-center sm:px-6 ${diceRolling ? 'dice-result-panel--rolling' : state.diceResult ? 'dice-result-panel--settled' : ''}`}
                >
                    <div className="mb-1 text-label-sm text-on-surface-variant">{t('dice.rollRound', { round: Math.max(1, state.round - 1) })}</div>
                    <div
                        key={`dice-total-${state.diceResult?.total ?? 'pending'}-${state.round}`}
                        className="dice-total dice-total-flip text-on-surface"
                    >
                        {diceDisplayTotal}
                    </div>
                    <div className="mb-3 text-label-md text-on-surface-variant">
                        {diceRolling ? `${t('dice.roll')}...` : state.diceResult ? diceRollMeta : t('dice.notYet')}
                    </div>
                    <div className="mx-auto mb-3 grid max-w-sm grid-cols-3 gap-2 sm:max-w-md sm:grid-cols-6">
                        {diceVisualValues.map((value, index) => renderDiceCell(value, index))}
                    </div>
                    {state.diceResult && (
                        <div className="text-label-sm text-on-surface-variant">
                            {t('dice.pointsBy', { values: state.diceResult.values.join(', '), who: whoLabel(rolledByMe ? 'me' : 'opp') })}
                        </div>
                    )}
                </div>
            )}

            <div className="mb-4">
                <button
                    onClick={() => setDiceControlsOpen((o) => !o)}
                    aria-expanded={diceControlsOpen}
                    className="dice-controls-toggle mb-2 inline-flex items-center gap-2 border border-border bg-surface-container-lowest px-2.5 py-1.5 text-label-sm text-on-surface-variant transition-colors hover:border-on-surface hover:text-on-surface"
                >
                    <Icon name="casino" className="text-[14px]" />
                    <span dir="ltr">{diceCount}d{diceSides}</span>
                    <Icon name="arrow_back" className={`dice-controls-caret text-[14px] ${diceControlsOpen ? 'dice-controls-caret--open' : ''}`} />
                </button>

                <div className={`dice-controls-shell ${diceControlsOpen ? 'dice-controls-shell--open' : ''}`}>
                    <div className="dice-controls-panel border border-border bg-surface-container-lowest/90 p-3 sm:p-3.5">
                        <div className="mb-2 grid grid-cols-2 gap-2">
                            <label className="text-label-sm text-on-surface-variant">
                                {t('dice.count')}
                                <input
                                    type="number" min={1} max={20} value={diceCount}
                                    onChange={(e) => setDiceCount(Math.min(20, Math.max(1, Number(e.target.value) || 1)))}
                                    className="mt-1 w-full border border-border bg-surface-container-lowest text-on-surface px-2.5 py-1.5 text-sm focus:outline-none focus:border-on-surface transition-colors"
                                />
                            </label>
                            <label className="text-label-sm text-on-surface-variant">
                                {t('dice.sides')}
                                <input
                                    type="number" min={2} max={1000} value={diceSides}
                                    onChange={(e) => setDiceSides(Math.min(1000, Math.max(2, Number(e.target.value) || 6)))}
                                    className="mt-1 w-full border border-border bg-surface-container-lowest text-on-surface px-2.5 py-1.5 text-sm focus:outline-none focus:border-on-surface transition-colors"
                                />
                            </label>
                        </div>
                        <div className="mb-2.5 flex gap-1.5">
                            <button onClick={() => setDiceSides(6)} className="border border-border bg-surface-alt px-2.5 py-1 text-label-sm transition-colors hover:border-on-surface">D6</button>
                            <button onClick={() => setDiceSides(20)} className="border border-border bg-surface-alt px-2.5 py-1 text-label-sm transition-colors hover:border-on-surface">D20</button>
                        </div>
                        <button onClick={rollDice} className="w-full bg-primary py-2.5 text-sm font-medium text-on-primary transition-colors hover:bg-primary-container">
                            {t('dice.roll')}
                        </button>
                    </div>
                </div>
            </div>

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
