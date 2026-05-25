import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { ClientMessage, Choice, WheelOption } from '@rps/shared';
import type { GameAction, GameState } from '../hooks/useGameState';
import ScoreBoard from '../components/ScoreBoard';
import ChoiceButton from '../components/ChoiceButton';
import Arena from '../components/Arena';
import Chat from '../components/Chat';
import EmojiBar from '../components/EmojiBar';
import EmojiFloats from '../components/EmojiFloats';

interface Props {
    state: GameState;
    send: (msg: ClientMessage) => void;
    dispatch: React.Dispatch<GameAction>;
}

const CHOICES: { choice: Choice; emoji: string; label: string }[] = [
    { choice: 'rock', emoji: '✊', label: '石頭' },
    { choice: 'paper', emoji: '✋', label: '布' },
    { choice: 'scissors', emoji: '✌️', label: '剪刀' },
];

const WHEEL_COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899'];
const SHAKE_THRESHOLD = 42;
const SHAKE_COOLDOWN_MS = 1500;

function getServerBaseUrl() {
    const wsUrl = (import.meta.env.VITE_WS_URL as string | undefined)?.trim();
    if (!wsUrl) return `${window.location.protocol}//${window.location.hostname}:3001`;
    if (wsUrl.startsWith('wss://')) return wsUrl.replace('wss://', 'https://');
    if (wsUrl.startsWith('ws://')) return wsUrl.replace('ws://', 'http://');
    if (wsUrl.startsWith('https://') || wsUrl.startsWith('http://')) return wsUrl;
    return `${window.location.protocol}//${wsUrl}`;
}

export default function Game({ state, send, dispatch }: Props) {
    const [showChat, setShowChat] = useState(false);
    const [diceCount, setDiceCount] = useState(2);
    const [diceSides, setDiceSides] = useState(6);
    const [drawNamesText, setDrawNamesText] = useState('Alice\nBob\nCharlie\nDavid');
    const [drawMode, setDrawMode] = useState<'pick' | 'shuffle'>('pick');
    const [drawNoRepeat, setDrawNoRepeat] = useState(false);
    const [voteOptionsText, setVoteOptionsText] = useState('Option A\nOption B\nOption C');
    const [myVoteIndex, setMyVoteIndex] = useState<number | null>(null);
    const [wheelOptions, setWheelOptions] = useState<WheelOption[]>([
        { id: '1', label: 'Option A', color: WHEEL_COLORS[0] },
        { id: '2', label: 'Option B', color: WHEEL_COLORS[1] },
        { id: '3', label: 'Option C', color: WHEEL_COLORS[2] },
        { id: '4', label: 'Option D', color: WHEEL_COLORS[3] },
    ]);
    const [wheelHiddenMode, setWheelHiddenMode] = useState(false);
    const [wheelRevealed, setWheelRevealed] = useState(false);
    const [wheelRevealBurst, setWheelRevealBurst] = useState(false);
    const [shakeShuffleEnabled, setShakeShuffleEnabled] = useState(false);
    const [vibrationEnabled, setVibrationEnabled] = useState(true);
    const [brokenWheelImageIds, setBrokenWheelImageIds] = useState<Record<string, true>>({});

    const wheelResultTimestampRef = useRef<number | null>(null);

    const choose = (choice: Choice) => {
        if (state.myChoice) return;
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

    const startVote = () => {
        const options = voteOptionsText
            .split(/\r?\n/)
            .map((o) => o.trim())
            .filter(Boolean);
        if (options.length < 2) return;
        setMyVoteIndex(null);
        send({ type: 'vote_start', options });
    };

    const castVote = (index: number) => {
        if (state.voteState?.finalized) return;
        setMyVoteIndex(index);
        send({ type: 'vote_cast', index });
    };

    const endVote = () => {
        if (!state.voteState) return;
        if (state.voteState.finalized) return;
        send({ type: 'vote_end' });
    };

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

    const toggleShakeShuffle = async (enabled: boolean) => {
        if (!enabled) {
            setShakeShuffleEnabled(false);
            return;
        }

        const needsPermission =
            typeof DeviceMotionEvent !== 'undefined' &&
            'requestPermission' in DeviceMotionEvent &&
            typeof (DeviceMotionEvent as unknown as { requestPermission?: () => Promise<string> }).requestPermission === 'function';

        if (needsPermission) {
            try {
                const permission = await (
                    DeviceMotionEvent as unknown as { requestPermission: () => Promise<string> }
                ).requestPermission();
                if (permission !== 'granted') {
                    setShakeShuffleEnabled(false);
                    return;
                }
            } catch {
                setShakeShuffleEnabled(false);
                return;
            }
        }

        setShakeShuffleEnabled(true);
    };

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

    useEffect(() => {
        if (!vibrationEnabled) return;
        if (typeof navigator !== 'undefined' && 'vibrate' in navigator && state.wheelResult) {
            navigator.vibrate?.([40, 60, 120]);
        }
    }, [state.wheelResult?.timestamp, vibrationEnabled]);

    useEffect(() => {
        if (state.tool !== 'wheel' || !shakeShuffleEnabled) return;

        let lastAt = 0;
        const onMotion = (event: DeviceMotionEvent) => {
            const x = Math.abs(event.accelerationIncludingGravity?.x ?? 0);
            const y = Math.abs(event.accelerationIncludingGravity?.y ?? 0);
            const z = Math.abs(event.accelerationIncludingGravity?.z ?? 0);
            const magnitude = x + y + z;
            const now = Date.now();
            if (magnitude > SHAKE_THRESHOLD && now - lastAt > SHAKE_COOLDOWN_MS) {
                lastAt = now;
                shuffleWheelOptions();
            }
        };

        window.addEventListener('devicemotion', onMotion);
        return () => window.removeEventListener('devicemotion', onMotion);
    }, [state.tool, shakeShuffleEnabled]);

    useEffect(() => {
        if (!state.voteState) return;
        if (state.voteState.votedBy.length === 0) {
            setMyVoteIndex(null);
        }
    }, [state.voteState?.timestamp]);

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
            const response = await fetch(`${baseUrl}/export/${state.roomId}.csv`);
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
            className="w-full mb-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-left text-xs text-red-700"
        >
            {state.error}
        </button>
    ) : null;

    if (state.tool === 'coin') {
        const coinEmoji = state.coinResult?.result === 'heads' ? '🪙' : state.coinResult?.result === 'tails' ? '⚪' : '❔';
        const coinLabel = state.coinResult?.result === 'heads' ? '正面' : state.coinResult?.result === 'tails' ? '反面' : '尚未丟銅板';
        const flippedByMe = state.coinResult?.by === state.mySlot;

        return (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="relative">
                {errorBanner}
                <EmojiFloats emojis={state.emojis} mySlot={state.mySlot!} />

                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 mb-4 text-center">
                    <div className="text-sm text-amber-700 mb-1">第 {Math.max(1, state.round - 1)} 次結果</div>
                    <div className="text-6xl mb-2">{coinEmoji}</div>
                    <div className="text-2xl font-extrabold text-amber-900">{coinLabel}</div>
                    {state.coinResult && (
                        <div className="text-xs text-amber-700 mt-2">
                            {flippedByMe ? '你' : '對手'} 丟出這次結果
                        </div>
                    )}
                </div>

                <button
                    onClick={flipCoin}
                    className="w-full py-3 bg-gray-900 text-white rounded-xl font-medium hover:bg-gray-800 active:scale-[0.98] transition-all mb-4"
                >
                    丟銅板
                </button>

                <button
                    onClick={exportCsv}
                    disabled={!state.roomId}
                    className="w-full py-2 border border-gray-300 text-gray-700 rounded-xl text-sm font-medium hover:border-gray-500 transition-colors mb-4 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                    匯出紀錄 CSV
                </button>

                <EmojiBar onEmoji={sendEmoji} />

                <button onClick={() => setShowChat(!showChat)} className="w-full py-2 text-sm text-gray-400 hover:text-gray-600 transition-colors mt-2">
                    {showChat ? '收起聊天' : `💬 聊天 ${state.chat.length > 0 ? `(${state.chat.length})` : ''}`}
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
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="relative">
                {errorBanner}
                <EmojiFloats emojis={state.emojis} mySlot={state.mySlot!} />

                <div className="rounded-2xl border border-sky-200 bg-sky-50 p-5 mb-4 text-center">
                    <div className="text-sm text-sky-700 mb-1">第 {Math.max(1, state.round - 1)} 次擲骰</div>
                    <div className="text-4xl font-extrabold text-sky-900 mb-2">{state.diceResult ? state.diceResult.total : '--'}</div>
                    <div className="text-sm text-sky-700">{state.diceResult ? `${state.diceResult.count}d${state.diceResult.sides}` : '尚未擲骰'}</div>
                    {state.diceResult && (
                        <div className="text-xs text-sky-700 mt-2">
                            點數 [{state.diceResult.values.join(', ')}] ・ {rolledByMe ? '你' : '對手'}擲出
                        </div>
                    )}
                </div>

                <div className="rounded-xl border border-gray-200 bg-white p-4 mb-4">
                    <div className="grid grid-cols-2 gap-3 mb-3">
                        <label className="text-sm text-gray-600">
                            顆數
                            <input
                                type="number"
                                min={1}
                                max={20}
                                value={diceCount}
                                onChange={(e) => setDiceCount(Math.min(20, Math.max(1, Number(e.target.value) || 1)))}
                                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                            />
                        </label>
                        <label className="text-sm text-gray-600">
                            面數
                            <input
                                type="number"
                                min={2}
                                max={1000}
                                value={diceSides}
                                onChange={(e) => setDiceSides(Math.min(1000, Math.max(2, Number(e.target.value) || 6)))}
                                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                            />
                        </label>
                    </div>
                    <div className="flex gap-2 mb-3">
                        <button onClick={() => setDiceSides(6)} className="px-3 py-1 rounded-lg bg-gray-100 text-sm hover:bg-gray-200">D6</button>
                        <button onClick={() => setDiceSides(20)} className="px-3 py-1 rounded-lg bg-gray-100 text-sm hover:bg-gray-200">D20</button>
                    </div>
                    <button
                        onClick={rollDice}
                        className="w-full py-3 bg-gray-900 text-white rounded-xl font-medium hover:bg-gray-800 active:scale-[0.98] transition-all"
                    >
                        擲骰
                    </button>
                </div>

                <button
                    onClick={exportCsv}
                    disabled={!state.roomId}
                    className="w-full py-2 border border-gray-300 text-gray-700 rounded-xl text-sm font-medium hover:border-gray-500 transition-colors mb-4 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                    匯出紀錄 CSV
                </button>

                <EmojiBar onEmoji={sendEmoji} />

                <button onClick={() => setShowChat(!showChat)} className="w-full py-2 text-sm text-gray-400 hover:text-gray-600 transition-colors mt-2">
                    {showChat ? '收起聊天' : `💬 聊天 ${state.chat.length > 0 ? `(${state.chat.length})` : ''}`}
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
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="relative">
                {errorBanner}
                <EmojiFloats emojis={state.emojis} mySlot={state.mySlot!} />

                <div className="rounded-2xl border border-fuchsia-200 bg-fuchsia-50 p-5 mb-4 text-center">
                    <div className="text-sm text-fuchsia-700 mb-1">第 {Math.max(1, state.round - 1)} 次輪盤</div>
                    <motion.div
                        key={`${state.wheelResult?.timestamp ?? 0}-${showLabel ? 'reveal' : 'hidden'}`}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.25 }}
                        className="text-xl font-extrabold text-fuchsia-900"
                    >
                        {showLabel ? (selected?.label ?? '尚未轉動') : '???'}
                    </motion.div>

                    <AnimatePresence>
                        {wheelRevealBurst && showLabel && selected && (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.8, y: -4 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.8, y: -10 }}
                                transition={{ duration: 0.35 }}
                                className="mx-auto mt-2 w-fit rounded-full bg-fuchsia-600 px-3 py-1 text-xs font-semibold text-white"
                            >
                                中獎揭曉
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {selected && (
                        <div className="mt-3 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium" style={{ backgroundColor: selected.color, color: '#fff' }}>
                            中獎色塊
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
                            className="mx-auto mt-3 h-24 w-24 rounded-xl object-cover border border-fuchsia-200"
                        />
                    )}

                    {selected?.imageUrl && showLabel && brokenWheelImageIds[selected.id] && (
                        <div className="mx-auto mt-3 w-fit rounded-lg border border-fuchsia-200 bg-white px-3 py-2 text-xs text-fuchsia-700">
                            圖片載入失敗，已改用文字顯示
                        </div>
                    )}

                    {state.wheelResult && (
                        <div className="text-xs text-fuchsia-700 mt-2">{spinnedByMe ? '你' : '對手'} 轉出本輪結果</div>
                    )}
                </div>

                <div className="rounded-xl border border-gray-200 bg-white p-4 mb-4">
                    <div className="text-sm font-semibold text-gray-700 mb-2">選項與顏色</div>
                    <div className="space-y-2 mb-3">
                        {wheelOptions.map((opt) => (
                            <div key={opt.id} className="grid grid-cols-[auto_1fr_1fr_auto] items-center gap-2">
                                <input
                                    type="color"
                                    value={opt.color}
                                    onChange={(e) => updateWheelOption(opt.id, { color: e.target.value })}
                                    className="h-9 w-12 rounded border border-gray-300 bg-transparent"
                                />
                                <input
                                    type="text"
                                    value={opt.label}
                                    onChange={(e) => updateWheelOption(opt.id, { label: e.target.value })}
                                    className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm"
                                    placeholder="輸入選項"
                                />
                                <input
                                    type="url"
                                    value={opt.imageUrl ?? ''}
                                    onChange={(e) => updateWheelOption(opt.id, { imageUrl: e.target.value })}
                                    className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm"
                                    placeholder="圖片 URL (選填)"
                                />
                                <button
                                    onClick={() => removeWheelOption(opt.id)}
                                    className="rounded-lg border border-gray-300 px-2 py-2 text-xs text-gray-600 hover:border-gray-500"
                                >
                                    刪除
                                </button>
                            </div>
                        ))}
                    </div>

                    <div className="grid grid-cols-2 gap-2 mb-3">
                        <label className="flex items-center gap-2 text-sm text-gray-700">
                            <input
                                type="checkbox"
                                checked={wheelHiddenMode}
                                onChange={(e) => {
                                    setWheelHiddenMode(e.target.checked);
                                    setWheelRevealed(!e.target.checked);
                                }}
                            />
                            隱藏模式
                        </label>
                        <label className="flex items-center gap-2 text-sm text-gray-700">
                            <input
                                type="checkbox"
                                checked={shakeShuffleEnabled}
                                onChange={(e) => {
                                    void toggleShakeShuffle(e.target.checked);
                                }}
                            />
                            搖動打亂
                        </label>
                    </div>

                    <label className="flex items-center gap-2 text-sm text-gray-700 mb-3">
                        <input
                            type="checkbox"
                            checked={vibrationEnabled}
                            onChange={(e) => setVibrationEnabled(e.target.checked)}
                        />
                        震動回饋
                    </label>

                    <button
                        onClick={addWheelOption}
                        className="w-full py-2 border border-gray-300 text-gray-700 rounded-xl text-sm font-medium hover:border-gray-500 transition-colors mb-3"
                    >
                        新增選項
                    </button>

                    <button
                        onClick={shuffleWheelOptions}
                        className="w-full py-2 border border-gray-300 text-gray-700 rounded-xl text-sm font-medium hover:border-gray-500 transition-colors mb-3"
                    >
                        打亂順序
                    </button>

                    <button
                        onClick={spinWheel}
                        disabled={wheelOptions.filter((opt) => opt.label.trim()).length < 2}
                        className="w-full py-3 bg-gray-900 text-white rounded-xl font-medium hover:bg-gray-800 active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        轉動輪盤
                    </button>
                </div>

                <button
                    onClick={exportCsv}
                    disabled={!state.roomId}
                    className="w-full py-2 border border-gray-300 text-gray-700 rounded-xl text-sm font-medium hover:border-gray-500 transition-colors mb-4 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                    匯出紀錄 CSV
                </button>

                <EmojiBar onEmoji={sendEmoji} />

                <button onClick={() => setShowChat(!showChat)} className="w-full py-2 text-sm text-gray-400 hover:text-gray-600 transition-colors mt-2">
                    {showChat ? '收起聊天' : `💬 聊天 ${state.chat.length > 0 ? `(${state.chat.length})` : ''}`}
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

                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 mb-4 text-center">
                    <div className="text-sm text-emerald-700 mb-1">抽籤結果</div>
                    <div className="text-2xl font-extrabold text-emerald-900">{state.drawResult?.pickedName ?? (state.drawResult ? '已完成排序' : '尚未執行')}</div>
                    {state.drawResult && (
                        <div className="text-xs text-emerald-700 mt-2">{byMe ? '你' : '對手'} 執行 {state.drawResult.mode === 'pick' ? '隨機抽取' : '隨機排序'}</div>
                    )}
                </div>

                <div className="rounded-xl border border-gray-200 bg-white p-4 mb-4">
                    <label className="text-sm text-gray-700 font-medium">名單（每行一位）</label>
                    <textarea
                        value={drawNamesText}
                        onChange={(e) => setDrawNamesText(e.target.value)}
                        rows={6}
                        className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    />
                    <div className="grid grid-cols-2 gap-2 mt-3 mb-3">
                        <button
                            onClick={() => setDrawMode('pick')}
                            className={`py-2 rounded-lg text-sm font-medium ${drawMode === 'pick' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700'}`}
                        >
                            隨機抽取
                        </button>
                        <button
                            onClick={() => setDrawMode('shuffle')}
                            className={`py-2 rounded-lg text-sm font-medium ${drawMode === 'shuffle' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700'}`}
                        >
                            隨機排序
                        </button>
                    </div>
                    <label className="mb-3 flex items-center gap-2 text-sm text-gray-700">
                        <input
                            type="checkbox"
                            checked={drawNoRepeat}
                            disabled={drawMode !== 'pick'}
                            onChange={(e) => setDrawNoRepeat(e.target.checked)}
                        />
                        不重複抽取（名單自動去重）
                    </label>
                    <button onClick={runDraw} className="w-full py-3 bg-gray-900 text-white rounded-xl font-medium hover:bg-gray-800">執行抽籤</button>
                </div>

                {state.drawResult && (
                    <div className="rounded-xl border border-gray-200 bg-white p-4 mb-4">
                        <div className="mb-2 flex items-center justify-between text-sm font-semibold text-gray-700">
                            <span>排序結果</span>
                            {state.drawResult.mode === 'pick' && state.drawResult.noRepeat && (
                                <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">
                                    剩餘 {state.drawResult.remainingNames.length} 位
                                </span>
                            )}
                        </div>
                        <div className="max-h-36 overflow-auto text-sm text-gray-700 space-y-1">
                            {state.drawResult.orderedNames.map((name, idx) => (
                                <div key={`${name}-${idx}`} className="flex items-center justify-between rounded-md bg-gray-50 px-2 py-1">
                                    <span>{name}</span>
                                    <span className="text-xs text-gray-500">#{idx + 1}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <button onClick={exportCsv} disabled={!state.roomId} className="w-full py-2 border border-gray-300 text-gray-700 rounded-xl text-sm font-medium hover:border-gray-500 transition-colors mb-4 disabled:opacity-40 disabled:cursor-not-allowed">匯出紀錄 CSV</button>
                <EmojiBar onEmoji={sendEmoji} />
            </motion.div>
        );
    }

    if (state.tool === 'vote') {
        const voteState = state.voteState;
        const voteHost = voteState?.host ?? null;
        const isVoteHost = voteHost ? voteHost === state.mySlot : true;

        return (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="relative">
                {errorBanner}
                <EmojiFloats emojis={state.emojis} mySlot={state.mySlot!} />

                <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 mb-4 text-center">
                    <div className="text-sm text-rose-700 mb-1">即時投票</div>
                    <div className="text-2xl font-extrabold text-rose-900">
                        {!voteState
                            ? '尚未開始投票'
                            : voteState.finalized && voteState.winnerIndexes.length > 1
                                ? '平手'
                                : voteState.finalized && voteState.winnerIndexes.length === 0
                                    ? '無票結束'
                                    : voteState.options[voteState.winnerIndexes[0] ?? voteState.counts.findIndex((c) => c === Math.max(...voteState.counts))] ?? '尚未有結果'}
                    </div>
                    {voteHost && <div className="text-xs text-rose-700 mt-1">主持人：{voteHost === state.mySlot ? '你' : '對手'}</div>}
                    {voteState?.finalized && (
                        <div className="text-xs text-rose-700 mt-1">投票已結束</div>
                    )}
                </div>

                <div className="rounded-xl border border-gray-200 bg-white p-4 mb-4">
                    <label className="text-sm text-gray-700 font-medium">投票選項（每行一項）</label>
                    <textarea
                        value={voteOptionsText}
                        onChange={(e) => setVoteOptionsText(e.target.value)}
                        rows={5}
                        className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    />
                    <button
                        onClick={startVote}
                        disabled={!isVoteHost}
                        className="mt-3 w-full py-3 bg-gray-900 text-white rounded-xl font-medium hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        {voteState ? '重新開票' : '開始投票'}
                    </button>
                    {!isVoteHost && (
                        <div className="mt-2 text-xs text-gray-500">只有主持人可重新開票</div>
                    )}
                    {isVoteHost && voteState && !voteState.finalized && (
                        <button
                            onClick={endVote}
                            className="mt-2 w-full rounded-xl border border-rose-300 bg-rose-50 py-2 text-sm font-medium text-rose-700 hover:bg-rose-100"
                        >
                            結束投票
                        </button>
                    )}
                </div>

                {voteState && (
                    <div className="rounded-xl border border-gray-200 bg-white p-4 mb-4 space-y-2">
                        {voteState.options.map((opt, idx) => (
                            <button
                                key={`${opt}-${idx}`}
                                onClick={() => castVote(idx)}
                                disabled={voteState.finalized}
                                className={`w-full rounded-lg border px-3 py-2 text-left ${myVoteIndex === idx ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-300 bg-white text-gray-700'} ${voteState.finalized ? 'opacity-60 cursor-not-allowed' : ''}`}
                            >
                                <div className="flex items-center justify-between">
                                    <span>{opt}</span>
                                    <span className="text-sm font-semibold">{voteState.counts[idx] ?? 0} 票</span>
                                </div>
                                {voteState.finalized && voteState.winnerIndexes.includes(idx) && (
                                    <div className="mt-1 text-xs font-medium text-emerald-600">勝出選項</div>
                                )}
                            </button>
                        ))}
                        <div className="text-xs text-gray-500 pt-1">已投票：{voteState.votedBy.length}/2</div>
                    </div>
                )}

                <button onClick={exportCsv} disabled={!state.roomId} className="w-full py-2 border border-gray-300 text-gray-700 rounded-xl text-sm font-medium hover:border-gray-500 transition-colors mb-4 disabled:opacity-40 disabled:cursor-not-allowed">匯出紀錄 CSV</button>
                <EmojiBar onEmoji={sendEmoji} />
            </motion.div>
        );
    }

    const iWon = state.lastResult && ((state.lastResult.result === 'a_wins' && state.mySlot === 'a') || (state.lastResult.result === 'b_wins' && state.mySlot === 'b'));
    const isDraw = state.lastResult?.result === 'draw';

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="relative">
            {errorBanner}
            <EmojiFloats emojis={state.emojis} mySlot={state.mySlot!} />
            <ScoreBoard score={state.score} mySlot={state.mySlot!} bestOf={state.bestOf} round={state.round} />
            <Arena myChoice={state.myChoice} lastResult={state.lastResult} mySlot={state.mySlot!} opponentReady={state.opponentReady} />

            <AnimatePresence>
                {state.lastResult && (
                    <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
                        className={`text-center py-3 rounded-xl mb-4 font-semibold text-lg ${iWon ? 'bg-emerald-50 text-emerald-600' : isDraw ? 'bg-amber-50 text-amber-600' : 'bg-red-50 text-red-500'}`}>
                        {iWon ? '🏆 你贏了！' : isDraw ? '🤝 平手' : '💀 你輸了'}
                    </motion.div>
                )}
            </AnimatePresence>

            {!state.lastResult && (
                <div className="text-center text-sm text-gray-400 mb-4">
                    {state.myChoice ? (state.opponentReady ? '雙方出拳中...' : '等待對手出拳...') : (state.opponentReady ? '對手已出拳，輪到你了！' : '選擇你的出拳')}
                </div>
            )}

            <div className="grid grid-cols-3 gap-3 mb-5">
                {CHOICES.map(({ choice, emoji, label }) => (
                    <ChoiceButton key={choice} choice={choice} emoji={emoji} label={label} selected={state.myChoice === choice} disabled={!!state.myChoice} onChoose={choose} />
                ))}
            </div>

            <button
                onClick={exportCsv}
                disabled={!state.roomId}
                className="w-full py-2 border border-gray-300 text-gray-700 rounded-xl text-sm font-medium hover:border-gray-500 transition-colors mb-4 disabled:opacity-40 disabled:cursor-not-allowed"
            >
                匯出紀錄 CSV
            </button>

            <EmojiBar onEmoji={sendEmoji} />

            <button onClick={() => setShowChat(!showChat)} className="w-full py-2 text-sm text-gray-400 hover:text-gray-600 transition-colors mt-2">
                {showChat ? '收起聊天' : `💬 聊天 ${state.chat.length > 0 ? `(${state.chat.length})` : ''}`}
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
