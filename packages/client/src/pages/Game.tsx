import { useCallback, useRef, useState, type TouchEvent } from 'react';
import { motion } from '../lib/motion-lite';
import type { ClientMessage } from '@rps/shared';
import type { GameAction, GameState } from '../hooks/useGameState';
import EmojiFloats from '../components/EmojiFloats';
import { useI18n } from '../i18n';
import type { GameToolProps } from './tools/types';
import './game.css';

import GameRps from './tools/GameRps';
import GameCoin from './tools/GameCoin';
import GameDice from './tools/GameDice';
import GameWheel from './tools/GameWheel';
import GameDraw from './tools/GameDraw';
import GameReaction from './tools/GameReaction';

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

interface Props {
    state: GameState;
    send: (msg: ClientMessage) => void;
    dispatch: React.Dispatch<GameAction>;
}

export default function Game({ state, send, dispatch }: Props) {
    const { t, locale, translateError } = useI18n();
    const isRtl = locale === 'ar';
    const isChatSwipeEnabled = !!state.roomId && getGestureMode() === 'minimal';

    const [showChat, setShowChat] = useState(false);
    const chatSwipeStartRef = useRef<{ x: number; y: number; ts: number } | null>(null);

    const sendChat = (text: string) => send({ type: 'chat', text });
    const sendEmoji = (emoji: string) => send({ type: 'emoji', emoji });

    const handleChatSwipeStart = useCallback((event: TouchEvent<HTMLDivElement>) => {
        if (!isChatSwipeEnabled) return;
        const touch = event.changedTouches[0];
        if (!touch) return;
        chatSwipeStartRef.current = { x: touch.clientX, y: touch.clientY, ts: Date.now() };
    }, [isChatSwipeEnabled]);

    const handleChatSwipeEnd = useCallback((event: TouchEvent<HTMLDivElement>) => {
        if (!isChatSwipeEnabled) return;
        const start = chatSwipeStartRef.current;
        chatSwipeStartRef.current = null;
        if (!start) return;
        const touch = event.changedTouches[0];
        if (!touch) return;
        const dx = touch.clientX - start.x;
        const dy = touch.clientY - start.y;
        const dt = Date.now() - start.ts;
        if (dt > 700) return;
        const absDx = Math.abs(dx);
        const absDy = Math.abs(dy);
        if (absDx < 64 || absDy > 48 || absDx < absDy * 1.2) return;
        setShowChat(isRtl ? dx > 0 : dx < 0);
    }, [isChatSwipeEnabled, isRtl]);

    const exportCsvFallback = () => {
        if (!state.history.length) return;
        const headers = ['timestamp_iso', 'room_id', 'tool', 'event', 'round', 'actor', 'result', 'score_a', 'score_b', 'details'];
        const escape = (v: string | number | null) => {
            if (v === null || v === undefined) return '';
            const text = String(v).replace(/"/g, '""');
            const safe = /^[=+\-@|\t]/.test(text) ? `\t${text}` : text;
            return `"${safe}"`;
        };
        const rows = state.history.map((e) => [
            new Date(e.timestamp).toISOString(), e.roomId, e.tool, e.event,
            e.round, e.actor, e.result, e.scoreA, e.scoreB, e.details,
        ]);
        const csv = [headers, ...rows].map((row) => row.map((v) => escape(v as string | number | null)).join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${state.tool ?? 'tool'}-${state.roomId ?? 'local'}-history.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const exportCsv = async () => {
        if (!state.roomId) { exportCsvFallback(); return; }
        const baseUrl = getServerBaseUrl();
        try {
            const token = encodeURIComponent(state.reconnectToken ?? '');
            const response = await fetch(`${baseUrl}/export/${state.roomId}.csv?token=${token}`);
            if (!response.ok) throw new Error('export failed');
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${state.roomId}-history.csv`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch {
            exportCsvFallback();
        }
    };

    const errorBanner = state.error ? (
        <button
            onClick={() => dispatch({ type: 'CLEAR_ERROR' })}
            className={`w-full mb-3 border-2 border-primary bg-surface-alt px-3 py-2 ${isRtl ? 'text-right' : 'text-left'} text-label-sm text-on-surface`}
        >
            {translateError(state.error.code, state.error.message)}
        </button>
    ) : null;

    const invitePanel = state.roomId ? (
        <div className="room-status-pill mb-4 inline-flex max-w-full items-center gap-2">
            <span className="text-[11px] uppercase tracking-[0.14em] text-on-surface-variant">ROOM</span>
            <span dir="ltr" className="max-w-[128px] truncate font-mono text-xs tracking-[0.2em] text-on-surface sm:max-w-[180px]">{state.roomId}</span>
        </div>
    ) : null;

    if (!state.tool) {
        return (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="relative">
                {errorBanner}
                <div className="border border-border bg-surface-alt p-5 text-center text-label-md text-on-surface-variant">
                    {t('join.joining')}
                </div>
            </motion.div>
        );
    }

    const toolProps: GameToolProps = {
        state, send, dispatch, exportCsv, sendEmoji, sendChat, showChat, setShowChat,
    };

    const wrap = (child: React.ReactNode) => (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="relative tool-game"
            onTouchStart={isChatSwipeEnabled ? handleChatSwipeStart : undefined}
            onTouchEnd={isChatSwipeEnabled ? handleChatSwipeEnd : undefined}
            style={isChatSwipeEnabled ? { touchAction: 'pan-y' } : undefined}
        >
            {errorBanner}
            {invitePanel}
            <EmojiFloats emojis={state.emojis} mySlot={state.mySlot!} />
            <div className="tool-workspace" data-tool={state.tool}>{child}</div>
        </motion.div>
    );

    if (state.tool === 'coin') return wrap(<GameCoin {...toolProps} />);
    if (state.tool === 'dice') return wrap(<GameDice {...toolProps} />);
    if (state.tool === 'wheel') return wrap(<GameWheel {...toolProps} />);
    if (state.tool === 'draw') return wrap(<GameDraw {...toolProps} />);
    if (state.tool === 'reaction') return wrap(<GameReaction {...toolProps} />);
    return wrap(<GameRps {...toolProps} />);
}