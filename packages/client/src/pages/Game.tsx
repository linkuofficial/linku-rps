import { useCallback, useEffect, useMemo, useRef, useState, type TouchEvent } from 'react';
import { motion, AnimatePresence } from '../lib/motion-lite';
import type { ClientMessage, Choice, WheelOption } from '@rps/shared';
import type { GameAction, GameState } from '../hooks/useGameState';
import ScoreBoard from '../components/ScoreBoard';
import ChoiceButton from '../components/ChoiceButton';
import Arena from '../components/Arena';
import Chat from '../components/Chat';
import EmojiBar from '../components/EmojiBar';
import EmojiFloats from '../components/EmojiFloats';
import { useI18n } from '../i18n';

interface Props {
    state: GameState;
    send: (msg: ClientMessage) => void;
    dispatch: React.Dispatch<GameAction>;
}

const CHOICES: { choice: Choice; emoji: string }[] = [
    { choice: 'rock', emoji: '\u270A' },
    { choice: 'paper', emoji: '\u270B' },
    { choice: 'scissors', emoji: '\u270C\uFE0F' },
];

const WHEEL_COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899'];
const CHAT_SWIPE_MIN_DISTANCE = 64;
const CHAT_SWIPE_MAX_VERTICAL_DRIFT = 48;
const CHAT_SWIPE_MAX_DURATION_MS = 700;

type GestureMode = 'minimal' | 'off';

function getGestureMode(): GestureMode {
    const raw = (import.meta.env.VITE_GESTURE_MODE as string | undefined)?.trim().toLowerCase();
    return raw === 'off' ? 'off' : 'minimal';
}

function getServerBaseUrl() {
    const wsUrl = (import.meta.env.VITE_WS_URL as string | undefined)?.trim();
    if (!wsUrl) return `${window.location.protocol}//${window.location.hostname}:3001`;
    if (wsUrl.startsWith('wss://')) return wsUrl.replace('wss://', 'https://');
    if (wsUrl.startsWith('ws://')) return wsUrl.replace('ws://', 'http://');
    if (wsUrl.startsWith('https://') || wsUrl.startsWith('http://')) return wsUrl;
    return `${window.location.protocol}//${wsUrl}`;
}

export default function Game({ state, send, dispatch }: Props) {
    const { t, whoLabel, choiceLabel, translateError, locale } = useI18n();
    const isRtl = locale === 'ar';
    const isChatSwipeEnabled = getGestureMode() === 'minimal';

    const defaultDrawNames = useMemo(
        () => [t('sample.person1'), t('sample.person2'), t('sample.person3'), t('sample.person4')].join('\n'),
        [t],
    );
    const defaultWheelLabels = useMemo(
        () => [t('sample.optionA'), t('sample.optionB'), t('sample.optionC'), t('sample.optionD')],
        [t],
    );

    const [showChat, setShowChat] = useState(false);
    const [diceCount, setDiceCount] = useState(2);
    const [diceSides, setDiceSides] = useState(6);
    const [drawNamesText, setDrawNamesText] = useState(defaultDrawNames);
    const [drawMode, setDrawMode] = useState<'pick' | 'shuffle'>('pick');
    const [drawNoRepeat, setDrawNoRepeat] = useState(false);
    const [wheelOptions, setWheelOptions] = useState<WheelOption[]>([
        { id: '1', label: defaultWheelLabels[0], color: WHEEL_COLORS[0] },
        { id: '2', label: defaultWheelLabels[1], color: WHEEL_COLORS[1] },
        { id: '3', label: defaultWheelLabels[2], color: WHEEL_COLORS[2] },
        { id: '4', label: defaultWheelLabels[3], color: WHEEL_COLORS[3] },
    ]);
    const [wheelHiddenMode, setWheelHiddenMode] = useState(false);
    const [wheelRevealed, setWheelRevealed] = useState(false);
    const [wheelRevealBurst, setWheelRevealBurst] = useState(false);
    const [vibrationEnabled, setVibrationEnabled] = useState(true);
    const [brokenWheelImageIds, setBrokenWheelImageIds] = useState<Record<string, true>>({});
    const defaultSamplesRef = useRef({
        draw: defaultDrawNames,
        wheel: defaultWheelLabels,
    });
    const chatSwipeStartRef = useRef<{ x: number; y: number; ts: number } | null>(null);

    const wheelResultTimestampRef = useRef<number | null>(null);

    const choose = (choice: Choice) => {
        if (state.myChoiceSubmitted) return;
        dispatch({ type: 'CHOICE_MADE', choice });
        send({ type: 'choice', choice });
    };

    const sendChat = (text: string) => {
        send({ type: 'chat', text });
    };

    const sendEmoji = (emoji: string) => {
        send({ type: 'emoji', emoji });
    };

    const flipCoin = () => {
        send({ type: 'coin_flip' });
    };

    const rollDice = () => {
        send({ type: 'dice_roll', count: diceCount, sides: diceSides });
    };

    const spinWheel = () => {
        send({ type: 'wheel_spin', options: wheelOptions.filter((opt) => opt.label.trim()) });
    };

    const runDraw = () => {
        const names = drawNamesText
            .split(/\r?\n/)
            .map((n) => n.trim())
            .filter(Boolean);
        if (!names.length) return;
        send({ type: 'draw_run', names, mode: drawMode, noRepeat: drawMode === 'pick' ? drawNoRepeat : false });
    };

    const toggleReactionReady = () => {
        if (!state.reactionState || !state.mySlot) {
            send({ type: 'reaction_ready', ready: true });
            return;
        }
        const isReady = state.reactionState.readyBy.includes(state.mySlot);
        send({ type: 'reaction_ready', ready: !isReady });
    };

    const pressReaction = useCallback(() => {
        if (state.tool !== 'reaction') return;
        send({ type: 'reaction_press' });
    }, [send, state.tool]);

    const updateWheelOption = (id: string, patch: Partial<WheelOption>) => {
        setWheelOptions((current) => current.map((opt) => (opt.id === id ? { ...opt, ...patch } : opt)));
        if (patch.imageUrl !== undefined) {
            setBrokenWheelImageIds((current) => {
                if (!current[id]) return current;
                const next = { ...current };
                delete next[id];
                return next;
            });
        }
    };

    const addWheelOption = () => {
        setWheelOptions((current) => {
            const nextIndex = current.length;
            return [
                ...current,
                {
                    id: String(Date.now() + nextIndex),
                    label: `Option ${String.fromCharCode(65 + (nextIndex % 26))}`,
                    color: WHEEL_COLORS[nextIndex % WHEEL_COLORS.length],
                },
            ];
        });
    };

    const removeWheelOption = (id: string) => {
        setWheelOptions((current) => {
            if (current.length <= 2) return current;
            return current.filter((opt) => opt.id !== id);
        });
    };

    const shuffleWheelOptions = () => {
        setWheelOptions((current) => {
            const out = [...current];
            for (let i = out.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [out[i], out[j]] = [out[j], out[i]];
            }
            return out;
        });
    };

    const handleChatSwipeStart = useCallback((event: TouchEvent<HTMLDivElement>) => {
        if (!isChatSwipeEnabled) return;
        const touch = event.changedTouches[0];
        if (!touch) return;
        chatSwipeStartRef.current = {
            x: touch.clientX,
            y: touch.clientY,
            ts: Date.now(),
        };
    }, [isChatSwipeEnabled]);

    const handleChatSwipeEnd = useCallback(
        (event: TouchEvent<HTMLDivElement>) => {
            if (!isChatSwipeEnabled) return;
            const start = chatSwipeStartRef.current;
            chatSwipeStartRef.current = null;
            if (!start) return;

            const touch = event.changedTouches[0];
            if (!touch) return;

            const dx = touch.clientX - start.x;
            const dy = touch.clientY - start.y;
            const dt = Date.now() - start.ts;
            if (dt > CHAT_SWIPE_MAX_DURATION_MS) return;

            const absDx = Math.abs(dx);
            const absDy = Math.abs(dy);
            if (absDx < CHAT_SWIPE_MIN_DISTANCE) return;
            if (absDy > CHAT_SWIPE_MAX_VERTICAL_DRIFT) return;
            if (absDx < absDy * 1.2) return;

            const shouldOpen = isRtl ? dx > 0 : dx < 0;
            setShowChat(shouldOpen);
        },
        [isChatSwipeEnabled, isRtl],
    );

    useEffect(() => {
        const ts = state.wheelResult?.timestamp ?? null;
        if (!ts || ts === wheelResultTimestampRef.current) return;

        wheelResultTimestampRef.current = ts;
        setWheelRevealed(!wheelHiddenMode);

        if (wheelHiddenMode) {
            const revealTimer = setTimeout(() => {
                setWheelRevealed(true);
                setWheelRevealBurst(true);
            }, 850);
            const burstTimer = setTimeout(() => setWheelRevealBurst(false), 1700);
            return () => {
                clearTimeout(revealTimer);
                clearTimeout(burstTimer);
            };
        }

        setWheelRevealBurst(true);
        const burstTimer = setTimeout(() => setWheelRevealBurst(false), 900);
        return () => clearTimeout(burstTimer);
    }, [state.wheelResult?.timestamp, wheelHiddenMode]);

    const wheelResultTimestamp = state.wheelResult?.timestamp;

    useEffect(() => {
        if (!vibrationEnabled) return;
        if (typeof navigator !== 'undefined' && 'vibrate' in navigator && wheelResultTimestamp) {
            navigator.vibrate?.([40, 60, 120]);
        }
    }, [wheelResultTimestamp, vibrationEnabled]);

    useEffect(() => {
        const previous = defaultSamplesRef.current;

        setDrawNamesText((current) => (current === previous.draw ? defaultDrawNames : current));
        setWheelOptions((current) => {
            if (current.length !== previous.wheel.length) return current;
            const unchangedTemplate = current.every((opt, idx) => opt.label === previous.wheel[idx]);
            if (!unchangedTemplate) return current;
            return current.map((opt, idx) => ({ ...opt, label: defaultWheelLabels[idx] ?? opt.label }));
        });

        defaultSamplesRef.current = {
            draw: defaultDrawNames,
            wheel: defaultWheelLabels,
        };
    }, [defaultDrawNames, defaultWheelLabels]);

    useEffect(() => {
        if (state.tool !== 'reaction') return;
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key !== 'F1') return;
            event.preventDefault();
            pressReaction();
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [state.tool, pressReaction]);

    const exportCsvFallback = () => {
        if (!state.history.length || !state.roomId) return;
        const headers = ['timestamp_iso', 'room_id', 'tool', 'event', 'round', 'actor', 'result', 'score_a', 'score_b', 'details'];
        const escape = (value: string | number | null) => {
            if (value === null || value === undefined) return '';
            const text = String(value).replace(/"/g, '""');
            return `"${text}"`;
        };

        const rows = state.history.map((entry) => [
            new Date(entry.timestamp).toISOString(),
            entry.roomId,
            entry.tool,
            entry.event,
            entry.round,
            entry.actor,
            entry.result,
            entry.scoreA,
            entry.scoreB,
            entry.details,
        ]);

        const csv = [headers, ...rows].map((row) => row.map((value) => escape(value as string | number | null)).join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${state.tool ?? 'tool'}-${state.roomId ?? 'room'}-history.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const exportCsv = async () => {
        if (!state.roomId) {
            exportCsvFallback();
            return;
        }

        const baseUrl = getServerBaseUrl();
        try {
            const token = encodeURIComponent(state.reconnectToken ?? '');
            const response = await fetch(`${baseUrl}/export/${state.roomId}.csv?token=${token}`);
            if (!response.ok) throw new Error('export failed');
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `${state.roomId}-history.csv`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        } catch {
            exportCsvFallback();
        }
    };

    const errorBanner = state.error ? (
        <button
            onClick={() => dispatch({ type: 'CLEAR_ERROR' })}
            className={`w-full mb-3 border-2 border-black bg-surface-alt px-3 py-2 ${isRtl ? 'text-right' : 'text-left'} text-label-sm text-on-surface`}
        >
            {translateError(state.error.code, state.error.message)}
        </button>
    ) : null;

    if (state.tool === 'coin') {
        const coinEmoji = state.coinResult?.result === 'heads'
            ? '\uD83E\uDE99'
            : state.coinResult?.result === 'tails'
                ? '\uD83E\uDE99'
                : '\u2753';
        const coinLabel = state.coinResult?.result === 'heads' ? t('coin.heads') : state.coinResult?.result === 'tails' ? t('coin.tails') : t('coin.notYet');
        const flippedByMe = state.coinResult?.by === state.mySlot;

        return (
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="relative"
                onTouchStart={isChatSwipeEnabled ? handleChatSwipeStart : undefined}
                onTouchEnd={isChatSwipeEnabled ? handleChatSwipeEnd : undefined}
                style={isChatSwipeEnabled ? { touchAction: 'pan-y' } : undefined}
            >
                {errorBanner}
                <EmojiFloats emojis={state.emojis} mySlot={state.mySlot!} />

                <div className="border border-border bg-surface-alt p-5 mb-4 text-center">
                    <div className="text-label-sm text-on-surface-variant mb-1">{t('coin.resultRound', { round: Math.max(1, state.round - 1) })}</div>
                    <div className="text-6xl mb-2">{coinEmoji}</div>
                    <div className="text-headline-md text-on-surface">{coinLabel}</div>
                    {state.coinResult && (
                        <div className="text-label-sm text-on-surface-variant mt-2">
                            {t('coin.by', { who: whoLabel(flippedByMe ? 'me' : 'opp') })}
                        </div>
                    )}
                </div>

                <button
                    onClick={flipCoin}
                    className="w-full py-3 bg-black text-white font-medium hover:bg-primary-container transition-colors mb-4"
                >
                    {t('coin.flip')}
                </button>

                <button
                    onClick={exportCsv}
                    disabled={!state.roomId}
                    className="w-full py-2 border border-black text-on-surface text-sm font-medium hover:bg-surface-alt transition-colors mb-4 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                    {t('common.exportCsv')}
                </button>

                <EmojiBar onEmoji={sendEmoji} />

                <button onClick={() => setShowChat(!showChat)} className="w-full py-2 text-label-sm text-on-surface-variant hover:text-on-surface hover:underline transition-colors mt-2">
                    {showChat ? t('common.hideChat') : `💬 ${t('common.chat')} ${state.chat.length > 0 ? `(${state.chat.length})` : ''}`}
                </button>

                <AnimatePresence>
                    {showChat && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                            <Chat messages={state.chat} mySlot={state.mySlot!} onSend={sendChat} />
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>
        );
    }

    if (state.tool === 'dice') {
        const rolledByMe = state.diceResult?.by === state.mySlot;

        return (
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="relative"
                onTouchStart={isChatSwipeEnabled ? handleChatSwipeStart : undefined}
                onTouchEnd={isChatSwipeEnabled ? handleChatSwipeEnd : undefined}
                style={isChatSwipeEnabled ? { touchAction: 'pan-y' } : undefined}
            >
                {errorBanner}
                <EmojiFloats emojis={state.emojis} mySlot={state.mySlot!} />

                <div className="border border-border bg-surface-alt p-5 mb-4 text-center">
                    <div className="text-label-sm text-on-surface-variant mb-1">{t('dice.rollRound', { round: Math.max(1, state.round - 1) })}</div>
                    <div className="text-headline-lg text-on-surface mb-2">{state.diceResult ? state.diceResult.total : '--'}</div>
                    <div className="text-label-md text-on-surface-variant">{state.diceResult ? `${state.diceResult.count}d${state.diceResult.sides}` : t('dice.notYet')}</div>
                    {state.diceResult && (
                        <div className="text-label-sm text-on-surface-variant mt-2">
                            {t('dice.pointsBy', { values: state.diceResult.values.join(', '), who: whoLabel(rolledByMe ? 'me' : 'opp') })}
                        </div>
                    )}
                </div>

                <div className="border border-border bg-white p-4 mb-4">
                    <div className="grid grid-cols-2 gap-3 mb-3">
                        <label className="text-label-sm text-on-surface-variant">
                            {t('dice.count')}
                            <input
                                type="number"
                                min={1}
                                max={20}
                                value={diceCount}
                                onChange={(e) => setDiceCount(Math.min(20, Math.max(1, Number(e.target.value) || 1)))}
                                className="mt-1 w-full border border-border px-3 py-2 focus:outline-none focus:border-black transition-colors"
                            />
                        </label>
                        <label className="text-label-sm text-on-surface-variant">
                            {t('dice.sides')}
                            <input
                                type="number"
                                min={2}
                                max={1000}
                                value={diceSides}
                                onChange={(e) => setDiceSides(Math.min(1000, Math.max(2, Number(e.target.value) || 6)))}
                                className="mt-1 w-full border border-border px-3 py-2 focus:outline-none focus:border-black transition-colors"
                            />
                        </label>
                    </div>
                    <div className="flex gap-2 mb-3">
                        <button onClick={() => setDiceSides(6)} className="px-3 py-1 bg-surface-alt text-sm hover:bg-surface-container-high transition-colors">D6</button>
                        <button onClick={() => setDiceSides(20)} className="px-3 py-1 bg-surface-alt text-sm hover:bg-surface-container-high transition-colors">D20</button>
                    </div>
                    <button
                        onClick={rollDice}
                        className="w-full py-3 bg-black text-white font-medium hover:bg-primary-container transition-colors"
                    >
                        {t('dice.roll')}
                    </button>
                </div>

                <button
                    onClick={exportCsv}
                    disabled={!state.roomId}
                    className="w-full py-2 border border-black text-on-surface text-sm font-medium hover:bg-surface-alt transition-colors mb-4 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                    {t('common.exportCsv')}
                </button>

                <EmojiBar onEmoji={sendEmoji} />

                <button onClick={() => setShowChat(!showChat)} className="w-full py-2 text-label-sm text-on-surface-variant hover:text-on-surface hover:underline transition-colors mt-2">
                    {showChat ? t('common.hideChat') : `💬 ${t('common.chat')} ${state.chat.length > 0 ? `(${state.chat.length})` : ''}`}
                </button>

                <AnimatePresence>
                    {showChat && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                            <Chat messages={state.chat} mySlot={state.mySlot!} onSend={sendChat} />
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>
        );
    }

    if (state.tool === 'wheel') {
        const selected = state.wheelResult?.options[state.wheelResult.selectedIndex];
        const spinnedByMe = state.wheelResult?.by === state.mySlot;
        const showLabel = !wheelHiddenMode || wheelRevealed;

        return (
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="relative"
                onTouchStart={isChatSwipeEnabled ? handleChatSwipeStart : undefined}
                onTouchEnd={isChatSwipeEnabled ? handleChatSwipeEnd : undefined}
                style={isChatSwipeEnabled ? { touchAction: 'pan-y' } : undefined}
            >
                {errorBanner}
                <EmojiFloats emojis={state.emojis} mySlot={state.mySlot!} />

                <div className="border border-border bg-surface-alt p-5 mb-4 text-center">
                    <div className="text-label-sm text-on-surface-variant mb-1">{t('wheel.round', { round: Math.max(1, state.round - 1) })}</div>
                    <motion.div
                        key={`${state.wheelResult?.timestamp ?? 0}-${showLabel ? 'reveal' : 'hidden'}`}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.25 }}
                        className="text-headline-md text-on-surface"
                    >
                        {showLabel ? (selected?.label ?? t('wheel.notYet')) : t('wheel.hidden')}
                    </motion.div>

                    <AnimatePresence>
                        {wheelRevealBurst && showLabel && selected && (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.8, y: -4 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.8, y: -10 }}
                                transition={{ duration: 0.35 }}
                                className="mx-auto mt-2 w-fit bg-black px-3 py-1 text-label-sm text-white"
                            >
                                {t('wheel.reveal')}
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {selected && (
                        <div className="mt-3 inline-flex items-center gap-2 px-3 py-1 text-label-sm font-medium" style={{ backgroundColor: selected.color, color: '#fff' }}>
                            {t('wheel.winnerColor')}
                        </div>
                    )}

                    {selected?.imageUrl && showLabel && !brokenWheelImageIds[selected.id] && (
                        <motion.img
                            initial={{ opacity: 0, scale: 0.92 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ duration: 0.25 }}
                            src={selected.imageUrl}
                            alt={selected.label}
                            onError={() => setBrokenWheelImageIds((current) => ({ ...current, [selected.id]: true }))}
                            className="mx-auto mt-3 h-24 w-24 object-cover border border-border"
                        />
                    )}

                    {selected?.imageUrl && showLabel && brokenWheelImageIds[selected.id] && (
                        <div className="mx-auto mt-3 w-fit border border-border bg-white px-3 py-2 text-label-sm text-on-surface-variant">
                            {t('wheel.imageFail')}
                        </div>
                    )}

                    {state.wheelResult && (
                        <div className="text-label-sm text-on-surface-variant mt-2">{t('wheel.by', { who: whoLabel(spinnedByMe ? 'me' : 'opp') })}</div>
                    )}
                </div>

                <div className="border border-border bg-white p-4 mb-4">
                    <div className="text-label-md font-semibold text-on-surface mb-2">{t('wheel.options')}</div>
                    <div className="space-y-2 mb-3">
                        {wheelOptions.map((opt) => (
                            <div key={opt.id} className="grid grid-cols-[auto_1fr_1fr_auto] items-center gap-2">
                                <input
                                    type="color"
                                    value={opt.color}
                                    onChange={(e) => updateWheelOption(opt.id, { color: e.target.value })}
                                    className="h-9 w-12 border border-border bg-transparent"
                                />
                                <input
                                    type="text"
                                    value={opt.label}
                                    onChange={(e) => updateWheelOption(opt.id, { label: e.target.value })}
                                    className="flex-1 border border-border px-3 py-2 text-sm focus:outline-none focus:border-black transition-colors"
                                    placeholder={t('wheel.optionPlaceholder')}
                                />
                                <input
                                    type="url"
                                    value={opt.imageUrl ?? ''}
                                    onChange={(e) => updateWheelOption(opt.id, { imageUrl: e.target.value })}
                                    className="flex-1 border border-border px-3 py-2 text-sm focus:outline-none focus:border-black transition-colors"
                                    placeholder={t('wheel.imagePlaceholder')}
                                />
                                <button
                                    onClick={() => removeWheelOption(opt.id)}
                                    className="border border-border px-2 py-2 text-xs text-on-surface-variant hover:border-black transition-colors"
                                >
                                    {t('wheel.delete')}
                                </button>
                            </div>
                        ))}
                    </div>

                    <div className="mb-3">
                        <label className="flex items-center gap-2 text-label-sm text-on-surface">
                            <input
                                type="checkbox"
                                checked={wheelHiddenMode}
                                onChange={(e) => {
                                    setWheelHiddenMode(e.target.checked);
                                    setWheelRevealed(!e.target.checked);
                                }}
                            />
                            {t('wheel.hiddenMode')}
                        </label>
                    </div>

                    <label className="flex items-center gap-2 text-label-sm text-on-surface mb-3">
                        <input
                            type="checkbox"
                            checked={vibrationEnabled}
                            onChange={(e) => setVibrationEnabled(e.target.checked)}
                        />
                        {t('wheel.vibrate')}
                    </label>

                    <button
                        onClick={addWheelOption}
                        className="w-full py-2 border border-black text-on-surface text-sm font-medium hover:bg-surface-alt transition-colors mb-3"
                    >
                        {t('wheel.addOption')}
                    </button>

                    <button
                        onClick={shuffleWheelOptions}
                        className="w-full py-2 border border-black text-on-surface text-sm font-medium hover:bg-surface-alt transition-colors mb-3"
                    >
                        {t('wheel.shuffle')}
                    </button>

                    <button
                        onClick={spinWheel}
                        disabled={wheelOptions.filter((opt) => opt.label.trim()).length < 2}
                        className="w-full py-3 bg-black text-white font-medium hover:bg-primary-container transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        {t('wheel.spin')}
                    </button>
                </div>

                <button
                    onClick={exportCsv}
                    disabled={!state.roomId}
                    className="w-full py-2 border border-black text-on-surface text-sm font-medium hover:bg-surface-alt transition-colors mb-4 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                    {t('common.exportCsv')}
                </button>

                <EmojiBar onEmoji={sendEmoji} />

                <button onClick={() => setShowChat(!showChat)} className="w-full py-2 text-label-sm text-on-surface-variant hover:text-on-surface hover:underline transition-colors mt-2">
                    {showChat ? t('common.hideChat') : `💬 ${t('common.chat')} ${state.chat.length > 0 ? `(${state.chat.length})` : ''}`}
                </button>

                <AnimatePresence>
                    {showChat && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                            <Chat messages={state.chat} mySlot={state.mySlot!} onSend={sendChat} />
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>
        );
    }

    if (state.tool === 'draw') {
        const byMe = state.drawResult?.by === state.mySlot;

        return (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="relative">
                {errorBanner}
                <EmojiFloats emojis={state.emojis} mySlot={state.mySlot!} />

                <div className="border border-border bg-surface-alt p-5 mb-4 text-center">
                    <div className="text-label-sm text-on-surface-variant mb-1">{t('draw.result')}</div>
                    <div className="text-headline-md text-on-surface">{state.drawResult?.pickedName ?? (state.drawResult ? t('draw.shuffledDone') : t('draw.notYet'))}</div>
                    {state.drawResult && (
                        <div className="text-label-sm text-on-surface-variant mt-2">{t('draw.by', { who: whoLabel(byMe ? 'me' : 'opp'), mode: state.drawResult.mode === 'pick' ? t('draw.modePick') : t('draw.modeShuffle') })}</div>
                    )}
                </div>

                <div className="border border-border bg-white p-4 mb-4">
                    <label className="text-label-sm text-on-surface font-medium">{t('draw.names')}</label>
                    <textarea
                        value={drawNamesText}
                        onChange={(e) => setDrawNamesText(e.target.value)}
                        rows={6}
                        className="mt-2 w-full border border-border px-3 py-2 text-sm focus:outline-none focus:border-black transition-colors"
                    />
                    <div className="grid grid-cols-2 gap-2 mt-3 mb-3">
                        <button
                            onClick={() => setDrawMode('pick')}
                            className={`py-2 text-sm font-medium transition-colors ${drawMode === 'pick' ? 'bg-black text-white' : 'bg-surface-alt text-on-surface hover:bg-surface-container-high'}`}
                        >
                            {t('draw.modePick')}
                        </button>
                        <button
                            onClick={() => setDrawMode('shuffle')}
                            className={`py-2 text-sm font-medium transition-colors ${drawMode === 'shuffle' ? 'bg-black text-white' : 'bg-surface-alt text-on-surface hover:bg-surface-container-high'}`}
                        >
                            {t('draw.modeShuffle')}
                        </button>
                    </div>
                    <label className="mb-3 flex items-center gap-2 text-label-sm text-on-surface">
                        <input
                            type="checkbox"
                            checked={drawNoRepeat}
                            disabled={drawMode !== 'pick'}
                            onChange={(e) => setDrawNoRepeat(e.target.checked)}
                        />
                        {t('draw.noRepeat')}
                    </label>
                    <button onClick={runDraw} className="w-full py-3 bg-black text-white font-medium hover:bg-primary-container transition-colors">{t('draw.run')}</button>
                </div>

                {state.drawResult && (
                    <div className="border border-border bg-white p-4 mb-4">
                        <div className="mb-2 flex items-center justify-between text-label-md font-semibold text-on-surface">
                            <span>{t('draw.ordered')}</span>
                            {state.drawResult.mode === 'pick' && state.drawResult.noRepeat && (
                                <span className="bg-surface-alt px-2 py-1 text-label-sm text-on-surface-variant">
                                    {t('draw.remaining', { n: state.drawResult.remainingNames.length })}
                                </span>
                            )}
                        </div>
                        <div className="max-h-36 overflow-auto text-sm text-on-surface space-y-1">
                            {state.drawResult.orderedNames.map((name, idx) => (
                                <div key={`${name}-${idx}`} className="flex items-center justify-between bg-surface-alt px-2 py-1">
                                    <span>{name}</span>
                                    <span className="text-label-sm text-on-surface-variant">#{idx + 1}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <button onClick={exportCsv} disabled={!state.roomId} className="w-full py-2 border border-black text-on-surface text-sm font-medium hover:bg-surface-alt transition-colors mb-4 disabled:opacity-40 disabled:cursor-not-allowed">{t('common.exportCsv')}</button>
                <EmojiBar onEmoji={sendEmoji} />
            </motion.div>
        );
    }

    if (state.tool === 'reaction') {
        const reaction = state.reactionState;
        const mySlot = state.mySlot;
        const myReady = !!(reaction && mySlot && reaction.readyBy.includes(mySlot));
        const oppSlot = mySlot === 'a' ? 'b' : 'a';
        const oppReady = !!(reaction && oppSlot && reaction.readyBy.includes(oppSlot));

        const lightClass = reaction?.phase === 'green'
            ? 'bg-emerald-500'
            : reaction?.phase === 'countdown'
                ? 'bg-red-500'
                : 'bg-on-surface-variant';

        const winnerLabel = reaction?.winner
            ? reaction.winner === 'draw'
                ? t('reaction.winnerDraw')
                : whoLabel(reaction.winner === mySlot ? 'me' : 'opp')
            : t('reaction.noResult');

        return (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="relative">
                {errorBanner}
                <EmojiFloats emojis={state.emojis} mySlot={state.mySlot!} />

                <div className="border border-border bg-surface-alt p-5 mb-4 text-center">
                    <div className="text-label-sm text-on-surface-variant mb-2">{t('reaction.title')}</div>
                    <div className={`mx-auto mb-3 h-16 w-16 rounded-full ${lightClass} transition-all`} />
                    <div className="text-body-md font-semibold text-on-surface">
                        {reaction?.phase === 'green' ? t('reaction.phaseGreen') : reaction?.phase === 'countdown' ? t('reaction.phaseCountdown') : reaction?.phase === 'result' ? t('reaction.phaseResult') : t('reaction.phaseIdle')}
                    </div>
                    {reaction?.phase === 'countdown' && (
                        <div className="text-label-sm text-on-surface-variant mt-1">{t('reaction.waitForGreen')}</div>
                    )}
                    {reaction?.phase === 'green' && (
                        <div className="text-label-sm text-on-surface-variant mt-1">{t('reaction.pressNow')}</div>
                    )}
                </div>

                <div className="border border-border bg-white p-4 mb-4">
                    <div className="grid grid-cols-2 gap-2 mb-3 text-sm">
                        <div className="bg-surface-alt px-3 py-2">
                            {t('reaction.youReady')}: <span className="font-semibold">{myReady ? t('reaction.ready') : t('reaction.notReady')}</span>
                        </div>
                        <div className="bg-surface-alt px-3 py-2">
                            {t('reaction.oppReady')}: <span className="font-semibold">{oppReady ? t('reaction.ready') : t('reaction.notReady')}</span>
                        </div>
                    </div>

                    <button
                        onClick={toggleReactionReady}
                        disabled={reaction?.phase === 'countdown' || reaction?.phase === 'green'}
                        className="w-full py-3 bg-black text-white font-medium hover:bg-primary-container transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        {myReady ? t('reaction.cancelReady') : t('reaction.tapReady')}
                    </button>

                    <button
                        onClick={pressReaction}
                        className="mt-2 w-full border border-black bg-white py-2 text-sm font-medium text-on-surface hover:bg-surface-alt transition-colors"
                    >
                        {t('reaction.pressButton')} (F1)
                    </button>
                </div>

                <div className="border border-border bg-white p-4 mb-4">
                    <div className="text-label-md font-semibold text-on-surface mb-2">{t('reaction.lastResult')}</div>
                    <div className="text-sm text-on-surface">{t('reaction.winner')}: <span className="font-semibold">{winnerLabel}</span></div>
                    <div className="text-sm text-on-surface">{t('reaction.youMs')}: <span className="font-semibold">{reaction?.reactionMs[(mySlot ?? 'a')] ?? '-'}</span></div>
                    <div className="text-sm text-on-surface">{t('reaction.oppMs')}: <span className="font-semibold">{reaction?.reactionMs[(oppSlot ?? 'b')] ?? '-'}</span></div>
                    {reaction?.falseStartBy && (
                        <div className="mt-2 text-label-sm text-error">
                            {t('reaction.falseStartBy', { who: whoLabel(reaction.falseStartBy === mySlot ? 'me' : 'opp') })}
                        </div>
                    )}
                </div>

                <button onClick={exportCsv} disabled={!state.roomId} className="w-full py-2 border border-black text-on-surface text-sm font-medium hover:bg-surface-alt transition-colors mb-4 disabled:opacity-40 disabled:cursor-not-allowed">{t('common.exportCsv')}</button>
                <EmojiBar onEmoji={sendEmoji} />
            </motion.div>
        );
    }

    const iWon = state.lastResult && ((state.lastResult.result === 'a_wins' && state.mySlot === 'a') || (state.lastResult.result === 'b_wins' && state.mySlot === 'b'));
    const isDraw = state.lastResult?.result === 'draw';

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="relative"
            onTouchStart={isChatSwipeEnabled ? handleChatSwipeStart : undefined}
            onTouchEnd={isChatSwipeEnabled ? handleChatSwipeEnd : undefined}
            style={isChatSwipeEnabled ? { touchAction: 'pan-y' } : undefined}
        >
            {errorBanner}
            <EmojiFloats emojis={state.emojis} mySlot={state.mySlot!} />
            <ScoreBoard score={state.score} mySlot={state.mySlot!} bestOf={state.bestOf} round={state.round} />
            <Arena myChoice={state.myChoice} lastResult={state.lastResult} mySlot={state.mySlot!} opponentReady={state.opponentReady} />

            <AnimatePresence>
                {state.lastResult && (
                    <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
                        className={`text-center py-3 mb-4 font-semibold text-lg border ${iWon ? 'border-black bg-surface-alt text-on-surface' : isDraw ? 'border-border bg-surface-alt text-on-surface-variant' : 'border-black bg-white text-on-surface'}`}>
                        {iWon ? t('rps.result.win') : isDraw ? t('rps.result.draw') : t('rps.result.lose')}
                    </motion.div>
                )}
            </AnimatePresence>

            {!state.lastResult && (
                <div className="text-center text-label-md text-on-surface-variant mb-4">
                    {state.myChoiceSubmitted ? (state.opponentReady ? t('rps.prompt.bothChoosing') : t('rps.prompt.waitOpp')) : (state.opponentReady ? t('rps.prompt.yourTurn') : t('rps.prompt.choose'))}
                </div>
            )}

            <div className="grid grid-cols-3 gap-3 mb-5">
                {CHOICES.map(({ choice, emoji }) => (
                    <ChoiceButton key={choice} choice={choice} emoji={emoji} label={choiceLabel(choice)} selected={state.myChoice === choice} disabled={state.myChoiceSubmitted} onChoose={choose} />
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

            <button onClick={() => setShowChat(!showChat)} className="w-full py-2 text-label-sm text-on-surface-variant hover:text-on-surface hover:underline transition-colors mt-2">
                {showChat ? t('common.hideChat') : `💬 ${t('common.chat')} ${state.chat.length > 0 ? `(${state.chat.length})` : ''}`}
            </button>

            <AnimatePresence>
                {showChat && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                        <Chat messages={state.chat} mySlot={state.mySlot!} onSend={sendChat} />
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}
