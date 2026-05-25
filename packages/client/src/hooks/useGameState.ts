import { useReducer, useCallback } from 'react';
import type { Choice, CoinFace, DrawMode, PlayerSlot, ServerMessage, ToolId, WheelOption } from '@rps/shared';

export type GamePhase = 'tool_select' | 'lobby' | 'waiting' | 'playing' | 'finished';

export interface ChatEntry {
    from: PlayerSlot;
    text: string;
    timestamp: number;
}

export interface EmojiFloat {
    id: number;
    emoji: string;
    from: PlayerSlot;
}

export interface ResultHistoryEntry {
    roomId: string;
    tool: ToolId;
    event: 'rps_round' | 'coin_flip' | 'dice_roll' | 'wheel_spin' | 'draw_pick' | 'draw_shuffle' | 'vote_start' | 'vote_cast' | 'vote_end';
    round: number;
    actor: PlayerSlot;
    result: string;
    scoreA: number | null;
    scoreB: number | null;
    timestamp: number;
    details: string;
}

export interface GameState {
    phase: GamePhase;
    tool: ToolId | null;
    roomId: string | null;
    reconnectToken: string | null;
    mySlot: PlayerSlot | null;
    bestOf: number;
    round: number;
    score: { a: number; b: number };
    myChoice: Choice | null;
    opponentReady: boolean;
    lastResult: { choices: { a: Choice; b: Choice }; result: 'a_wins' | 'b_wins' | 'draw' } | null;
    winner: PlayerSlot | null;
    coinResult: { result: CoinFace; by: PlayerSlot; round: number; timestamp: number } | null;
    diceResult: { values: number[]; total: number; count: number; sides: number; by: PlayerSlot; round: number; timestamp: number } | null;
    wheelResult: { options: WheelOption[]; selectedIndex: number; by: PlayerSlot; round: number; timestamp: number } | null;
    drawResult: { mode: DrawMode; noRepeat: boolean; sourceNames: string[]; orderedNames: string[]; pickedName: string | null; remainingNames: string[]; by: PlayerSlot; round: number; timestamp: number } | null;
    voteState: { options: string[]; counts: number[]; votedBy: PlayerSlot[]; host: PlayerSlot; finalized: boolean; winnerIndexes: number[]; by: PlayerSlot; round: number; timestamp: number } | null;
    history: ResultHistoryEntry[];
    chat: ChatEntry[];
    emojis: EmojiFloat[];
    rematchRequestedByMe: boolean;
    rematchRequestedByOpponent: boolean;
    error: string | null;
}

type Action =
    | { type: 'SELECT_TOOL'; tool: ToolId }
    | { type: 'BACK_TO_TOOL_SELECT' }
    | { type: 'ROOM_CREATED'; roomId: string; bestOf: number; tool: ToolId; reconnectToken: string }
    | { type: 'JOINED'; roomId: string; bestOf: number; tool: ToolId; reconnectToken: string }
    | { type: 'GAME_START'; you: PlayerSlot; bestOf: number; tool: ToolId }
    | {
        type: 'RECONNECT_OK';
        roomId: string;
        bestOf: number;
        tool: ToolId;
        you: PlayerSlot;
        phase: 'waiting' | 'playing' | 'finished';
        score: { a: number; b: number };
        round: number;
        winner: PlayerSlot | null;
        opponentReady: boolean;
        myChoiceSubmitted: boolean;
        reconnectToken: string;
    }
    | { type: 'OPPONENT_READY' }
    | { type: 'CHOICE_MADE'; choice: Choice }
    | {
        type: 'ROUND_RESULT';
        choices: { a: Choice; b: Choice };
        result: 'a_wins' | 'b_wins' | 'draw';
        score: { a: number; b: number };
        round: number;
    }
    | { type: 'GAME_OVER'; winner: PlayerSlot }
    | { type: 'COIN_RESULT'; result: CoinFace; by: PlayerSlot; round: number; timestamp: number }
    | {
        type: 'DICE_RESULT';
        values: number[];
        total: number;
        count: number;
        sides: number;
        by: PlayerSlot;
        round: number;
        timestamp: number;
    }
    | {
        type: 'WHEEL_RESULT';
        options: WheelOption[];
        selectedIndex: number;
        by: PlayerSlot;
        round: number;
        timestamp: number;
    }
    | {
        type: 'DRAW_RESULT';
        mode: DrawMode;
        noRepeat: boolean;
        sourceNames: string[];
        orderedNames: string[];
        pickedName: string | null;
        remainingNames: string[];
        by: PlayerSlot;
        round: number;
        timestamp: number;
    }
    | {
        type: 'VOTE_UPDATE';
        options: string[];
        counts: number[];
        votedBy: PlayerSlot[];
        host: PlayerSlot;
        finalized: boolean;
        winnerIndexes: number[];
        by: PlayerSlot;
        round: number;
        timestamp: number;
    }
    | { type: 'CHAT'; entry: ChatEntry }
    | { type: 'EMOJI'; float: EmojiFloat }
    | { type: 'REMOVE_EMOJI'; id: number }
    | { type: 'REMATCH_REQUESTED'; from: PlayerSlot }
    | { type: 'REMATCH_STATUS'; requestedBy: PlayerSlot[] }
    | { type: 'REMATCH_STARTED'; bestOf: number }
    | { type: 'OPPONENT_LEFT' }
    | { type: 'ERROR'; message: string }
    | { type: 'CLEAR_ERROR' };

export type GameAction = Action;

const initialState: GameState = {
    phase: 'tool_select',
    tool: null,
    roomId: null,
    reconnectToken: null,
    mySlot: null,
    bestOf: 3,
    round: 1,
    score: { a: 0, b: 0 },
    myChoice: null,
    opponentReady: false,
    lastResult: null,
    winner: null,
    coinResult: null,
    diceResult: null,
    wheelResult: null,
    drawResult: null,
    voteState: null,
    history: [],
    chat: [],
    emojis: [],
    rematchRequestedByMe: false,
    rematchRequestedByOpponent: false,
    error: null,
};

function resetForNewMatch(state: GameState, bestOf: number): GameState {
    return {
        ...state,
        phase: 'playing',
        bestOf,
        round: 1,
        score: { a: 0, b: 0 },
        myChoice: null,
        opponentReady: false,
        lastResult: null,
        winner: null,
        coinResult: null,
        diceResult: null,
        wheelResult: null,
        drawResult: null,
        voteState: null,
        rematchRequestedByMe: false,
        rematchRequestedByOpponent: false,
        error: null,
    };
}

function reducer(state: GameState, action: Action): GameState {
    switch (action.type) {
        case 'SELECT_TOOL':
            return {
                ...state,
                phase: 'lobby',
                tool: action.tool,
                error: null,
            };
        case 'BACK_TO_TOOL_SELECT':
            return {
                ...initialState,
            };
        case 'ROOM_CREATED':
            return {
                ...state,
                phase: 'waiting',
                roomId: action.roomId,
                bestOf: action.bestOf,
                tool: action.tool,
                reconnectToken: action.reconnectToken,
                history: [],
                error: null,
            };
        case 'JOINED':
            return {
                ...state,
                roomId: action.roomId,
                bestOf: action.bestOf,
                tool: action.tool,
                reconnectToken: action.reconnectToken,
                history: [],
                error: null,
            };
        case 'GAME_START':
            return {
                ...resetForNewMatch(state, action.bestOf),
                mySlot: action.you,
                tool: action.tool,
            };
        case 'RECONNECT_OK':
            return {
                ...state,
                phase: action.phase,
                roomId: action.roomId,
                bestOf: action.bestOf,
                tool: action.tool,
                mySlot: action.you,
                reconnectToken: action.reconnectToken,
                score: action.score,
                round: action.round,
                winner: action.winner,
                myChoice: null,
                opponentReady: action.opponentReady,
                rematchRequestedByMe: false,
                rematchRequestedByOpponent: false,
            };
        case 'OPPONENT_READY':
            return { ...state, opponentReady: true };
        case 'CHOICE_MADE':
            return { ...state, myChoice: action.choice, opponentReady: false };
        case 'ROUND_RESULT':
            return {
                ...state,
                lastResult: { choices: action.choices, result: action.result },
                coinResult: null,
                diceResult: null,
                wheelResult: null,
                drawResult: null,
                voteState: null,
                score: action.score,
                round: action.round + 1,
                myChoice: null,
                opponentReady: false,
                history: state.roomId
                    ? [
                        ...state.history,
                        {
                            roomId: state.roomId,
                            tool: state.tool ?? 'rps',
                            event: 'rps_round',
                            round: action.round,
                            actor: state.mySlot ?? 'a',
                            result: action.result,
                            scoreA: action.score.a,
                            scoreB: action.score.b,
                            timestamp: Date.now(),
                            details: `${action.choices.a} vs ${action.choices.b}`,
                        },
                    ]
                    : state.history,
            };
        case 'GAME_OVER':
            return {
                ...state,
                phase: 'finished',
                winner: action.winner,
                rematchRequestedByMe: false,
                rematchRequestedByOpponent: false,
            };
        case 'COIN_RESULT':
            return {
                ...state,
                coinResult: {
                    result: action.result,
                    by: action.by,
                    round: action.round,
                    timestamp: action.timestamp,
                },
                diceResult: null,
                wheelResult: null,
                drawResult: null,
                voteState: null,
                lastResult: null,
                myChoice: null,
                opponentReady: false,
                round: action.round + 1,
                history: state.roomId
                    ? [
                        ...state.history,
                        {
                            roomId: state.roomId,
                            tool: state.tool ?? 'coin',
                            event: 'coin_flip',
                            round: action.round,
                            actor: action.by,
                            result: action.result,
                            scoreA: null,
                            scoreB: null,
                            timestamp: action.timestamp,
                            details: action.result,
                        },
                    ]
                    : state.history,
            };
        case 'DICE_RESULT':
            return {
                ...state,
                diceResult: {
                    values: action.values,
                    total: action.total,
                    count: action.count,
                    sides: action.sides,
                    by: action.by,
                    round: action.round,
                    timestamp: action.timestamp,
                },
                coinResult: null,
                wheelResult: null,
                drawResult: null,
                voteState: null,
                lastResult: null,
                myChoice: null,
                opponentReady: false,
                round: action.round + 1,
                history: state.roomId
                    ? [
                        ...state.history,
                        {
                            roomId: state.roomId,
                            tool: state.tool ?? 'dice',
                            event: 'dice_roll',
                            round: action.round,
                            actor: action.by,
                            result: String(action.total),
                            scoreA: null,
                            scoreB: null,
                            timestamp: action.timestamp,
                            details: `${action.count}d${action.sides} => [${action.values.join(',')}]`,
                        },
                    ]
                    : state.history,
            };
        case 'WHEEL_RESULT': {
            const selected = action.options[action.selectedIndex];
            return {
                ...state,
                wheelResult: {
                    options: action.options,
                    selectedIndex: action.selectedIndex,
                    by: action.by,
                    round: action.round,
                    timestamp: action.timestamp,
                },
                diceResult: null,
                coinResult: null,
                drawResult: null,
                voteState: null,
                lastResult: null,
                myChoice: null,
                opponentReady: false,
                round: action.round + 1,
                history: state.roomId
                    ? [
                        ...state.history,
                        {
                            roomId: state.roomId,
                            tool: state.tool ?? 'wheel',
                            event: 'wheel_spin',
                            round: action.round,
                            actor: action.by,
                            result: selected?.label ?? 'unknown',
                            scoreA: null,
                            scoreB: null,
                            timestamp: action.timestamp,
                            details: JSON.stringify(action.options),
                        },
                    ]
                    : state.history,
            };
        }
        case 'DRAW_RESULT':
            return {
                ...state,
                drawResult: {
                    mode: action.mode,
                    noRepeat: action.noRepeat,
                    sourceNames: action.sourceNames,
                    orderedNames: action.orderedNames,
                    pickedName: action.pickedName,
                    remainingNames: action.remainingNames,
                    by: action.by,
                    round: action.round,
                    timestamp: action.timestamp,
                },
                voteState: null,
                wheelResult: null,
                diceResult: null,
                coinResult: null,
                lastResult: null,
                myChoice: null,
                opponentReady: false,
                round: action.round + 1,
                history: state.roomId
                    ? [
                        ...state.history,
                        {
                            roomId: state.roomId,
                            tool: state.tool ?? 'draw',
                            event: action.mode === 'pick' ? 'draw_pick' : 'draw_shuffle',
                            round: action.round,
                            actor: action.by,
                            result: action.pickedName ?? 'shuffled',
                            scoreA: null,
                            scoreB: null,
                            timestamp: action.timestamp,
                            details: action.orderedNames.join('|'),
                        },
                    ]
                    : state.history,
            };
        case 'VOTE_UPDATE':
            return {
                ...state,
                voteState: {
                    options: action.options,
                    counts: action.counts,
                    votedBy: action.votedBy,
                    host: action.host,
                    finalized: action.finalized,
                    winnerIndexes: action.winnerIndexes,
                    by: action.by,
                    round: action.round,
                    timestamp: action.timestamp,
                },
                drawResult: null,
                wheelResult: null,
                diceResult: null,
                coinResult: null,
                lastResult: null,
                myChoice: null,
                opponentReady: false,
                round: action.round + 1,
                history: state.roomId
                    ? [
                        ...state.history,
                        {
                            roomId: state.roomId,
                            tool: state.tool ?? 'vote',
                            event: action.finalized ? 'vote_end' : action.votedBy.length === 0 ? 'vote_start' : 'vote_cast',
                            round: action.round,
                            actor: action.by,
                            result:
                                action.winnerIndexes.length > 1
                                    ? '平手'
                                    : action.winnerIndexes.length === 0
                                        ? '無票結束'
                                        : action.options[action.winnerIndexes[0]] ?? action.options[action.counts.findIndex((c) => c === Math.max(...action.counts))] ?? 'vote',
                            scoreA: null,
                            scoreB: null,
                            timestamp: action.timestamp,
                            details: `${action.options.join('|')} :: ${action.counts.join('|')}`,
                        },
                    ]
                    : state.history,
            };
        case 'CHAT':
            return { ...state, chat: [...state.chat.slice(-49), action.entry] };
        case 'EMOJI':
            return { ...state, emojis: [...state.emojis, action.float] };
        case 'REMOVE_EMOJI':
            return { ...state, emojis: state.emojis.filter((e) => e.id !== action.id) };
        case 'REMATCH_REQUESTED':
            return {
                ...state,
                rematchRequestedByOpponent: action.from !== state.mySlot,
            };
        case 'REMATCH_STATUS':
            return {
                ...state,
                rematchRequestedByMe: !!state.mySlot && action.requestedBy.includes(state.mySlot),
                rematchRequestedByOpponent:
                    !!state.mySlot && action.requestedBy.includes(state.mySlot === 'a' ? 'b' : 'a'),
            };
        case 'REMATCH_STARTED':
            return resetForNewMatch(state, action.bestOf);
        case 'OPPONENT_LEFT':
            return {
                ...state,
                error: '對手斷線，系統會等待對手重連 30 秒',
            };
        case 'ERROR':
            return { ...state, error: action.message };
        case 'CLEAR_ERROR':
            return { ...state, error: null };
        default:
            return state;
    }
}

let emojiIdCounter = 0;

export function useGameState() {
    const [state, dispatch] = useReducer(reducer, initialState);

    const handleMessage = useCallback((msg: ServerMessage) => {
        switch (msg.type) {
            case 'room_created':
                dispatch({
                    type: 'ROOM_CREATED',
                    roomId: msg.roomId,
                    bestOf: msg.bestOf,
                    tool: msg.tool,
                    reconnectToken: msg.reconnectToken,
                });
                break;
            case 'joined':
                dispatch({
                    type: 'JOINED',
                    roomId: msg.roomId,
                    bestOf: msg.bestOf,
                    tool: msg.tool,
                    reconnectToken: msg.reconnectToken,
                });
                break;
            case 'game_start':
                dispatch({ type: 'GAME_START', you: msg.you, bestOf: msg.bestOf, tool: msg.tool });
                break;
            case 'reconnect_ok':
                dispatch({
                    type: 'RECONNECT_OK',
                    roomId: msg.roomId,
                    bestOf: msg.bestOf,
                    tool: msg.tool,
                    you: msg.you,
                    phase: msg.phase,
                    score: msg.score,
                    round: msg.round,
                    winner: msg.winner,
                    opponentReady: msg.opponentReady,
                    myChoiceSubmitted: msg.myChoiceSubmitted,
                    reconnectToken: msg.reconnectToken,
                });
                break;
            case 'opponent_ready':
                dispatch({ type: 'OPPONENT_READY' });
                break;
            case 'round_result':
                dispatch({
                    type: 'ROUND_RESULT',
                    choices: msg.choices,
                    result: msg.result,
                    score: msg.score,
                    round: msg.round,
                });
                break;
            case 'game_over':
                dispatch({ type: 'GAME_OVER', winner: msg.winner });
                break;
            case 'coin_result':
                dispatch({
                    type: 'COIN_RESULT',
                    result: msg.result,
                    by: msg.by,
                    round: msg.round,
                    timestamp: msg.timestamp,
                });
                break;
            case 'dice_result':
                dispatch({
                    type: 'DICE_RESULT',
                    values: msg.values,
                    total: msg.total,
                    count: msg.count,
                    sides: msg.sides,
                    by: msg.by,
                    round: msg.round,
                    timestamp: msg.timestamp,
                });
                break;
            case 'wheel_result':
                dispatch({
                    type: 'WHEEL_RESULT',
                    options: msg.options,
                    selectedIndex: msg.selectedIndex,
                    by: msg.by,
                    round: msg.round,
                    timestamp: msg.timestamp,
                });
                break;
            case 'draw_result':
                dispatch({
                    type: 'DRAW_RESULT',
                    mode: msg.mode,
                    noRepeat: msg.noRepeat,
                    sourceNames: msg.sourceNames,
                    orderedNames: msg.orderedNames,
                    pickedName: msg.pickedName,
                    remainingNames: msg.remainingNames,
                    by: msg.by,
                    round: msg.round,
                    timestamp: msg.timestamp,
                });
                break;
            case 'vote_update':
                dispatch({
                    type: 'VOTE_UPDATE',
                    options: msg.options,
                    counts: msg.counts,
                    votedBy: msg.votedBy,
                    host: msg.host,
                    finalized: msg.finalized,
                    winnerIndexes: msg.winnerIndexes,
                    by: msg.by,
                    round: msg.round,
                    timestamp: msg.timestamp,
                });
                break;
            case 'chat_broadcast':
                dispatch({ type: 'CHAT', entry: { from: msg.from, text: msg.text, timestamp: msg.timestamp } });
                break;
            case 'emoji_broadcast': {
                const id = ++emojiIdCounter;
                dispatch({ type: 'EMOJI', float: { id, emoji: msg.emoji, from: msg.from } });
                setTimeout(() => dispatch({ type: 'REMOVE_EMOJI', id }), 2000);
                break;
            }
            case 'rematch_requested':
                dispatch({ type: 'REMATCH_REQUESTED', from: msg.from });
                break;
            case 'rematch_status':
                dispatch({ type: 'REMATCH_STATUS', requestedBy: msg.requestedBy });
                break;
            case 'rematch_started':
                dispatch({ type: 'REMATCH_STARTED', bestOf: msg.bestOf });
                break;
            case 'opponent_left':
                dispatch({ type: 'OPPONENT_LEFT' });
                break;
            case 'error':
                dispatch({ type: 'ERROR', message: msg.message });
                break;
        }
    }, []);

    return { state, dispatch, handleMessage };
}
