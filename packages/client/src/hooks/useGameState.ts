import { useReducer, useCallback } from 'react';
import type { Choice, CoinFace, DrawMode, ErrorCode, InvalidGameStateReason, PlayerSlot, ReactionPhase, ServerMessage, ToolId, WheelOption } from '@rps/shared';

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
    event: 'rps_round' | 'coin_flip' | 'dice_roll' | 'wheel_spin' | 'draw_pick' | 'draw_shuffle' | 'reaction_state' | 'reaction_result';
    round: number;
    actor: PlayerSlot | 'system';
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
    myChoiceSubmitted: boolean;
    opponentReady: boolean;
    lastResult: { choices: { a: Choice; b: Choice }; result: 'a_wins' | 'b_wins' | 'draw' } | null;
    winner: PlayerSlot | null;
    coinResult: { result: CoinFace; by: PlayerSlot; round: number; timestamp: number } | null;
    diceResult: { values: number[]; total: number; count: number; sides: number; by: PlayerSlot; round: number; timestamp: number } | null;
    wheelResult: { options: WheelOption[]; selectedIndex: number; by: PlayerSlot; round: number; timestamp: number } | null;
    drawResult: { mode: DrawMode; noRepeat: boolean; sourceNames: string[]; orderedNames: string[]; pickedName: string | null; remainingNames: string[]; by: PlayerSlot; round: number; timestamp: number } | null;
    reactionState: {
        phase: ReactionPhase;
        readyBy: PlayerSlot[];
        countdownMs: number | null;
        greenAt: number | null;
        falseStartBy: PlayerSlot | null;
        winner: PlayerSlot | 'draw' | null;
        reactionMs: { a: number | null; b: number | null };
        by: PlayerSlot | 'system';
        round: number;
        timestamp: number;
    } | null;
    history: ResultHistoryEntry[];
    chat: ChatEntry[];
    emojis: EmojiFloat[];
    rematchRequestedByMe: boolean;
    rematchRequestedByOpponent: boolean;
    error: { code: ErrorCode; message: string; reason?: InvalidGameStateReason } | null;
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
        type: 'REACTION_STATE';
        phase: ReactionPhase;
        readyBy: PlayerSlot[];
        countdownMs: number | null;
        greenAt: number | null;
        by: PlayerSlot | 'system';
        round: number;
        timestamp: number;
    }
    | {
        type: 'REACTION_RESULT';
        winner: PlayerSlot | 'draw';
        falseStartBy: PlayerSlot | null;
        reactionMs: { a: number | null; b: number | null };
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
    | { type: 'ERROR'; code: ErrorCode; message: string; reason?: InvalidGameStateReason }
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
    myChoiceSubmitted: false,
    opponentReady: false,
    lastResult: null,
    winner: null,
    coinResult: null,
    diceResult: null,
    wheelResult: null,
    drawResult: null,
    reactionState: null,
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
        myChoiceSubmitted: false,
        opponentReady: false,
        lastResult: null,
        winner: null,
        coinResult: null,
        diceResult: null,
        wheelResult: null,
        drawResult: null,
        reactionState: null,
        rematchRequestedByMe: false,
        rematchRequestedByOpponent: false,
        error: null,
    };
}

function reducer(state: GameState, action: Action): GameState {
    switch (action.type) {
        case 'SELECT_TOOL':
            return { ...state, phase: 'lobby', tool: action.tool, error: null };
        case 'BACK_TO_TOOL_SELECT':
            return { ...initialState };
        case 'ROOM_CREATED':
            return {
                ...state,
                phase: 'waiting',
                roomId: action.roomId,
                bestOf: action.bestOf,
                tool: action.tool,
                reconnectToken: action.reconnectToken,
                myChoiceSubmitted: false,
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
                myChoiceSubmitted: false,
                history: [],
                error: null,
            };
        case 'GAME_START':
            return { ...resetForNewMatch(state, action.bestOf), mySlot: action.you, tool: action.tool };
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
                myChoiceSubmitted: action.myChoiceSubmitted,
                opponentReady: action.opponentReady,
                rematchRequestedByMe: false,
                rematchRequestedByOpponent: false,
            };
        case 'OPPONENT_READY':
            return { ...state, opponentReady: true };
        case 'CHOICE_MADE':
            return { ...state, myChoice: action.choice, myChoiceSubmitted: true, opponentReady: false };
        case 'ROUND_RESULT':
            return {
                ...state,
                lastResult: { choices: action.choices, result: action.result },
                coinResult: null,
                diceResult: null,
                wheelResult: null,
                drawResult: null,
                reactionState: null,
                score: action.score,
                round: action.round + 1,
                myChoice: null,
                myChoiceSubmitted: false,
                opponentReady: false,
                history: state.roomId
                    ? [...state.history, {
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
                    }]
                    : state.history,
            };
        case 'GAME_OVER':
            return { ...state, phase: 'finished', winner: action.winner, rematchRequestedByMe: false, rematchRequestedByOpponent: false };
        case 'COIN_RESULT':
            return {
                ...state,
                coinResult: { result: action.result, by: action.by, round: action.round, timestamp: action.timestamp },
                diceResult: null,
                wheelResult: null,
                drawResult: null,
                reactionState: null,
                lastResult: null,
                myChoice: null,
                myChoiceSubmitted: false,
                opponentReady: false,
                round: action.round + 1,
                history: state.roomId
                    ? [...state.history, {
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
                    }]
                    : state.history,
            };
        case 'DICE_RESULT':
            return {
                ...state,
                diceResult: { values: action.values, total: action.total, count: action.count, sides: action.sides, by: action.by, round: action.round, timestamp: action.timestamp },
                coinResult: null,
                wheelResult: null,
                drawResult: null,
                reactionState: null,
                lastResult: null,
                myChoice: null,
                myChoiceSubmitted: false,
                opponentReady: false,
                round: action.round + 1,
                history: state.roomId
                    ? [...state.history, {
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
                    }]
                    : state.history,
            };
        case 'WHEEL_RESULT': {
            const selected = action.options[action.selectedIndex];
            return {
                ...state,
                wheelResult: { options: action.options, selectedIndex: action.selectedIndex, by: action.by, round: action.round, timestamp: action.timestamp },
                diceResult: null,
                coinResult: null,
                drawResult: null,
                reactionState: null,
                lastResult: null,
                myChoice: null,
                myChoiceSubmitted: false,
                opponentReady: false,
                round: action.round + 1,
                history: state.roomId
                    ? [...state.history, {
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
                    }]
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
                reactionState: null,
                wheelResult: null,
                diceResult: null,
                coinResult: null,
                lastResult: null,
                myChoice: null,
                myChoiceSubmitted: false,
                opponentReady: false,
                round: action.round + 1,
                history: state.roomId
                    ? [...state.history, {
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
                    }]
                    : state.history,
            };
        case 'REACTION_STATE':
            return {
                ...state,
                reactionState: {
                    phase: action.phase,
                    readyBy: action.readyBy,
                    countdownMs: action.countdownMs,
                    greenAt: action.greenAt,
                    falseStartBy: state.reactionState?.falseStartBy ?? null,
                    winner: state.reactionState?.winner ?? null,
                    reactionMs: state.reactionState?.reactionMs ?? { a: null, b: null },
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
                myChoiceSubmitted: false,
                opponentReady: false,
                round: action.round + 1,
                history: state.roomId
                    ? [...state.history, {
                        roomId: state.roomId,
                        tool: state.tool ?? 'reaction',
                        event: 'reaction_state',
                        round: action.round,
                        actor: action.by,
                        result: action.phase,
                        scoreA: null,
                        scoreB: null,
                        timestamp: action.timestamp,
                        details: `ready=${action.readyBy.join('|') || 'none'}; countdownMs=${action.countdownMs ?? 'na'}`,
                    }]
                    : state.history,
            };
        case 'REACTION_RESULT':
            return {
                ...state,
                reactionState: {
                    phase: 'result',
                    readyBy: [],
                    countdownMs: null,
                    greenAt: null,
                    falseStartBy: action.falseStartBy,
                    winner: action.winner,
                    reactionMs: action.reactionMs,
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
                myChoiceSubmitted: false,
                opponentReady: false,
                round: action.round + 1,
                history: state.roomId
                    ? [...state.history, {
                        roomId: state.roomId,
                        tool: state.tool ?? 'reaction',
                        event: 'reaction_result',
                        round: action.round,
                        actor: action.by,
                        result: action.winner,
                        scoreA: null,
                        scoreB: null,
                        timestamp: action.timestamp,
                        details: `false_start=${action.falseStartBy ?? 'none'}; a=${action.reactionMs.a ?? 'na'}; b=${action.reactionMs.b ?? 'na'}`,
                    }]
                    : state.history,
            };
        case 'CHAT':
            return { ...state, chat: [...state.chat.slice(-49), action.entry] };
        case 'EMOJI':
            return { ...state, emojis: [...state.emojis, action.float] };
        case 'REMOVE_EMOJI':
            return { ...state, emojis: state.emojis.filter((e) => e.id !== action.id) };
        case 'REMATCH_REQUESTED':
            return { ...state, rematchRequestedByOpponent: action.from !== state.mySlot };
        case 'REMATCH_STATUS':
            return {
                ...state,
                rematchRequestedByMe: !!state.mySlot && action.requestedBy.includes(state.mySlot),
                rematchRequestedByOpponent: !!state.mySlot && action.requestedBy.includes(state.mySlot === 'a' ? 'b' : 'a'),
            };
        case 'REMATCH_STARTED':
            return resetForNewMatch(state, action.bestOf);
        case 'OPPONENT_LEFT':
            return { ...state, error: { code: 'opponent_disconnected', message: 'Opponent disconnected. Waiting up to 30 seconds for reconnection.' } };
        case 'ERROR':
            return { ...state, error: { code: action.code, message: action.message, reason: action.reason } };
        case 'CLEAR_ERROR':
            return { ...state, error: null };
        default:
            return state;
    }
}

export const gameReducerForTest = reducer;
export const initialGameStateForTest = initialState;

let emojiIdCounter = 0;

export function useGameState() {
    const [state, dispatch] = useReducer(reducer, initialState);

    const handleMessage = useCallback((msg: ServerMessage) => {
        switch (msg.type) {
            case 'room_created':
                dispatch({ type: 'ROOM_CREATED', roomId: msg.roomId, bestOf: msg.bestOf, tool: msg.tool, reconnectToken: msg.reconnectToken });
                break;
            case 'joined':
                dispatch({ type: 'JOINED', roomId: msg.roomId, bestOf: msg.bestOf, tool: msg.tool, reconnectToken: msg.reconnectToken });
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
                dispatch({ type: 'ROUND_RESULT', choices: msg.choices, result: msg.result, score: msg.score, round: msg.round });
                break;
            case 'game_over':
                dispatch({ type: 'GAME_OVER', winner: msg.winner });
                break;
            case 'coin_result':
                dispatch({ type: 'COIN_RESULT', result: msg.result, by: msg.by, round: msg.round, timestamp: msg.timestamp });
                break;
            case 'dice_result':
                dispatch({ type: 'DICE_RESULT', values: msg.values, total: msg.total, count: msg.count, sides: msg.sides, by: msg.by, round: msg.round, timestamp: msg.timestamp });
                break;
            case 'wheel_result':
                dispatch({ type: 'WHEEL_RESULT', options: msg.options, selectedIndex: msg.selectedIndex, by: msg.by, round: msg.round, timestamp: msg.timestamp });
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
            case 'reaction_state':
                dispatch({ type: 'REACTION_STATE', phase: msg.phase, readyBy: msg.readyBy, countdownMs: msg.countdownMs, greenAt: msg.greenAt, by: msg.by, round: msg.round, timestamp: msg.timestamp });
                break;
            case 'reaction_result':
                dispatch({ type: 'REACTION_RESULT', winner: msg.winner, falseStartBy: msg.falseStartBy, reactionMs: msg.reactionMs, by: msg.by, round: msg.round, timestamp: msg.timestamp });
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
                dispatch({ type: 'ERROR', code: msg.code, message: msg.message, reason: msg.reason });
                break;
        }
    }, []);

    return { state, dispatch, handleMessage };
}
