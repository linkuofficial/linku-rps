import { useReducer, useCallback } from 'react';
import type { Choice, CoinFace, DrawMode, ErrorCode, InvalidGameStateReason, PlayerSlot, ReactionMode, ReactionPhase, ServerMessage, ToolId, WheelOption } from '@rps/shared';
import { inferToolFromCode } from '@rps/shared';

/** Cap retained client-side history (CSV-export source) to avoid unbounded growth in long sessions. */
const MAX_HISTORY = 300;

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
    event: 'rps_round' | 'coin_flip' | 'dice_roll' | 'dice_duel' | 'wheel_spin' | 'draw_pick' | 'draw_shuffle' | 'reaction_state' | 'reaction_result';
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
    diceDuelResult: { a: { values: number[]; total: number; count: number; sides: number }; b: { values: number[]; total: number; count: number; sides: number }; winner: PlayerSlot | 'draw'; round: number; timestamp: number } | null;
    wheelResult: { options: WheelOption[]; selectedIndex: number; by: PlayerSlot; round: number; timestamp: number } | null;
    drawResult: { mode: DrawMode; noRepeat: boolean; sourceNames: string[]; orderedNames: string[]; pickedName: string | null; remainingNames: string[]; by: PlayerSlot; round: number; timestamp: number } | null;
    reactionState: {
        phase: ReactionPhase;
        mode: ReactionMode;
        targetCentis: number | null;
        readyBy: PlayerSlot[];
        pressedBy: PlayerSlot[];
        countdownMs: number | null;
        greenAt: number | null;
        falseStartBy: PlayerSlot | null;
        winner: PlayerSlot | 'draw' | null;
        reactionMs: { a: number | null; b: number | null };
        deltaCentis: { a: number | null; b: number | null };
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
    pendingJoinCode: string | null;
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
        type: 'DICE_DUEL_RESULT';
        a: { values: number[]; total: number; count: number; sides: number };
        b: { values: number[]; total: number; count: number; sides: number };
        winner: PlayerSlot | 'draw';
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
        mode: ReactionMode;
        targetCentis: number | null;
        readyBy: PlayerSlot[];
        pressedBy: PlayerSlot[];
        countdownMs: number | null;
        greenAt: number | null;
        by: PlayerSlot | 'system';
        round: number;
        timestamp: number;
    }
    | {
        type: 'REACTION_RESULT';
        mode: ReactionMode;
        targetCentis: number | null;
        deltaCentis: { a: number | null; b: number | null };
        winner: PlayerSlot | 'draw';
        falseStartBy: PlayerSlot | null;
        reactionMs: { a: number | null; b: number | null };
        by: PlayerSlot | 'system';
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
    | { type: 'CLEAR_ERROR' }
    | { type: 'SET_PENDING_JOIN'; code: string }
    | { type: 'CLEAR_PENDING_JOIN' };

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
    diceDuelResult: null,
    wheelResult: null,
    drawResult: null,
    reactionState: null,
    history: [],
    chat: [],
    emojis: [],
    rematchRequestedByMe: false,
    rematchRequestedByOpponent: false,
    error: null,
    pendingJoinCode: null,
};

function isToolId(value: unknown): value is ToolId {
    return value === 'rps' || value === 'coin' || value === 'dice' || value === 'wheel' || value === 'draw' || value === 'reaction';
}

// Single source of truth for the tool→prefix mapping lives in @rps/shared.
function inferToolFromRoomId(roomId: string | null | undefined): ToolId | null {
    return inferToolFromCode(roomId);
}

function resolveIncomingTool(candidate: unknown, roomId: string | null | undefined, fallback: ToolId | null): ToolId | null {
    if (isToolId(candidate)) return candidate;
    return inferToolFromRoomId(roomId) ?? fallback;
}

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
        diceDuelResult: null,
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
            // If we're already playing (optimistic start from ToolSelector), just patch
            // the roomId and reconnectToken without resetting game state.
            if (state.phase === 'playing') {
                return {
                    ...state,
                    roomId: action.roomId,
                    reconnectToken: action.reconnectToken,
                    tool: action.tool,
                };
            }
            // For the tool_select path (direct create from ToolSelector), stay in
            // tool_select so the spinner stays visible until GAME_START.
            if (state.phase === 'tool_select') {
                return {
                    ...state,
                    roomId: action.roomId,
                    bestOf: action.bestOf,
                    tool: action.tool,
                    reconnectToken: action.reconnectToken,
                    error: null,
                };
            }
            // Non-RPS tools: stay in lobby (with loading state) until GAME_START arrives
            // to avoid a brief Waiting page flash.
            if (action.tool !== 'rps') {
                return {
                    ...state,
                    roomId: action.roomId,
                    bestOf: action.bestOf,
                    tool: action.tool,
                    reconnectToken: action.reconnectToken,
                    error: null,
                };
            }
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
                phase: 'waiting',
                roomId: action.roomId,
                bestOf: action.bestOf,
                tool: action.tool,
                reconnectToken: action.reconnectToken,
                myChoiceSubmitted: false,
                history: [],
                error: null,
                pendingJoinCode: null,
            };
        case 'GAME_START':
            // Idempotent guard: a second GAME_START (from server's game_start message arriving
            // after room_created already dispatched one) must not reset an in-progress game.
            if (state.phase === 'playing') return state;
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
                diceDuelResult: null,
                wheelResult: null,
                drawResult: null,
                reactionState: null,
                score: action.score,
                round: action.round + 1,
                myChoice: null,
                myChoiceSubmitted: false,
                opponentReady: false,
                history: state.roomId
                    ? [...state.history.slice(-(MAX_HISTORY - 1)), {
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
                diceDuelResult: null,
                wheelResult: null,
                drawResult: null,
                reactionState: null,
                lastResult: null,
                myChoice: null,
                myChoiceSubmitted: false,
                opponentReady: false,
                round: action.round + 1,
                history: state.roomId
                    ? [...state.history.slice(-(MAX_HISTORY - 1)), {
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
                diceDuelResult: null,
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
                    ? [...state.history.slice(-(MAX_HISTORY - 1)), {
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
        case 'DICE_DUEL_RESULT':
            return {
                ...state,
                diceDuelResult: { a: action.a, b: action.b, winner: action.winner, round: action.round, timestamp: action.timestamp },
                diceResult: null,
                coinResult: null,
                wheelResult: null,
                drawResult: null,
                reactionState: null,
                lastResult: null,
                myChoice: null,
                myChoiceSubmitted: false,
                opponentReady: false,
                score: {
                    a: state.score.a + (action.winner === 'a' ? 1 : 0),
                    b: state.score.b + (action.winner === 'b' ? 1 : 0),
                },
                round: action.round + 1,
                history: state.roomId
                    ? [...state.history.slice(-(MAX_HISTORY - 1)), {
                        roomId: state.roomId,
                        tool: state.tool ?? 'dice',
                        event: 'dice_duel',
                        round: action.round,
                        actor: 'a' as PlayerSlot,
                        result: action.winner === 'draw' ? 'draw' : `${action.winner}_wins`,
                        scoreA: state.score.a + (action.winner === 'a' ? 1 : 0),
                        scoreB: state.score.b + (action.winner === 'b' ? 1 : 0),
                        timestamp: action.timestamp,
                        details: `A:${action.a.total} B:${action.b.total}`,
                    }]
                    : state.history,
            };
        case 'WHEEL_RESULT': {
            const selected = action.options[action.selectedIndex];
            return {
                ...state,
                wheelResult: { options: action.options, selectedIndex: action.selectedIndex, by: action.by, round: action.round, timestamp: action.timestamp },
                diceResult: null,
                diceDuelResult: null,
                coinResult: null,
                drawResult: null,
                reactionState: null,
                lastResult: null,
                myChoice: null,
                myChoiceSubmitted: false,
                opponentReady: false,
                round: action.round + 1,
                history: state.roomId
                    ? [...state.history.slice(-(MAX_HISTORY - 1)), {
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
                diceDuelResult: null,
                coinResult: null,
                lastResult: null,
                myChoice: null,
                myChoiceSubmitted: false,
                opponentReady: false,
                round: action.round + 1,
                history: state.roomId
                    ? [...state.history.slice(-(MAX_HISTORY - 1)), {
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
                    mode: action.mode,
                    targetCentis: action.targetCentis,
                    readyBy: action.readyBy,
                    pressedBy: action.pressedBy,
                    countdownMs: action.countdownMs,
                    greenAt: action.greenAt,
                    falseStartBy: state.reactionState?.falseStartBy ?? null,
                    winner: state.reactionState?.winner ?? null,
                    reactionMs: state.reactionState?.reactionMs ?? { a: null, b: null },
                    deltaCentis: state.reactionState?.deltaCentis ?? { a: null, b: null },
                    by: action.by,
                    round: action.round,
                    timestamp: action.timestamp,
                },
                drawResult: null,
                wheelResult: null,
                diceResult: null,
                diceDuelResult: null,
                coinResult: null,
                lastResult: null,
                myChoice: null,
                myChoiceSubmitted: false,
                opponentReady: false,
                round: action.round + 1,
                history: state.roomId && action.phase !== state.reactionState?.phase
                    ? [...state.history.slice(-(MAX_HISTORY - 1)), {
                        roomId: state.roomId,
                        tool: state.tool ?? 'reaction',
                        event: 'reaction_state',
                        round: action.round,
                        actor: action.by,
                        result: action.phase,
                        scoreA: null,
                        scoreB: null,
                        timestamp: action.timestamp,
                        details: `mode=${action.mode}; target=${action.targetCentis ?? 'na'}; ready=${action.readyBy.join('|') || 'none'}; countdownMs=${action.countdownMs ?? 'na'}`,
                    }]
                    : state.history,
            };
        case 'REACTION_RESULT':
            return {
                ...state,
                reactionState: {
                    phase: 'result',
                    mode: action.mode,
                    targetCentis: action.targetCentis,
                    readyBy: [],
                    pressedBy: [],
                    countdownMs: null,
                    greenAt: null,
                    falseStartBy: action.falseStartBy,
                    winner: action.winner,
                    reactionMs: action.reactionMs,
                    deltaCentis: action.deltaCentis,
                    by: action.by,
                    round: action.round,
                    timestamp: action.timestamp,
                },
                drawResult: null,
                wheelResult: null,
                diceResult: null,
                diceDuelResult: null,
                coinResult: null,
                lastResult: null,
                myChoice: null,
                myChoiceSubmitted: false,
                opponentReady: false,
                round: action.round + 1,
                history: state.roomId
                    ? [...state.history.slice(-(MAX_HISTORY - 1)), {
                        roomId: state.roomId,
                        tool: state.tool ?? 'reaction',
                        event: 'reaction_result',
                        round: action.round,
                        actor: action.by,
                        result: action.winner,
                        scoreA: null,
                        scoreB: null,
                        timestamp: action.timestamp,
                        details: `mode=${action.mode}; target=${action.targetCentis ?? 'na'}; false_start=${action.falseStartBy ?? 'none'}; a=${action.reactionMs.a ?? 'na'}; b=${action.reactionMs.b ?? 'na'}; da=${action.deltaCentis.a ?? 'na'}; db=${action.deltaCentis.b ?? 'na'}`,
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
        case 'ERROR': {
            const FATAL_CODES: readonly ErrorCode[] = ['room_no_longer_exists', 'reconnect_auth_failed', 'room_not_found'];
            if (state.phase === 'playing' && FATAL_CODES.includes(action.code)) {
                return { ...initialState, error: { code: action.code, message: action.message, reason: action.reason } };
            }
            return {
                ...state,
                error: { code: action.code, message: action.message, reason: action.reason },
                ...(state.phase === 'tool_select' ? { pendingJoinCode: null } : {}),
            };
        }
        case 'CLEAR_ERROR':
            return { ...state, error: null };
        case 'SET_PENDING_JOIN':
            return { ...state, pendingJoinCode: action.code, error: null };
        case 'CLEAR_PENDING_JOIN':
            return { ...state, pendingJoinCode: null, error: null };
        default:
            return state;
    }
}

export const gameReducerForTest = reducer;
export const initialGameStateForTest = initialState;
export const inferToolFromRoomIdForTest = inferToolFromRoomId;
export const resolveIncomingToolForTest = resolveIncomingTool;

// Exported guard predicates for unit testing — mirror the conditions in handleMessage
export function shouldProcessRoomCreatedForTest(phase: GamePhase, msgTool: unknown, msgRoomId: string, stateTool: ToolId | null): boolean {
    if (phase !== 'lobby' && phase !== 'tool_select') return false;
    const tool = resolveIncomingTool(msgTool, msgRoomId, stateTool);
    if (!tool) return false;
    if (phase === 'lobby') return tool === stateTool;
    return true;
}
export function shouldProcessJoinedForTest(phase: GamePhase, pendingJoinCode: string | null): boolean {
    return phase === 'lobby' || (phase === 'tool_select' && !!pendingJoinCode);
}
export function shouldProcessGameStartForTest(stateTool: ToolId | null, msgTool: unknown, roomId: string | null): boolean {
    if (stateTool === null) return false;
    const tool = resolveIncomingTool(msgTool, roomId, stateTool);
    return tool !== null && tool === stateTool;
}

let emojiIdCounter = 0;

function safeInt(value: unknown, fallback: number): number {
    return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

export function useGameState() {
    const [state, dispatch] = useReducer(reducer, initialState);

    const handleMessage = useCallback((msg: ServerMessage) => {
        switch (msg.type) {
            case 'room_created': {
                // Accept both 'lobby' (create via Lobby page) and 'tool_select' (create directly
                // from ToolSelector, skipping the Lobby step for solo-capable tools).
                if (state.phase !== 'lobby' && state.phase !== 'tool_select') break;
                const tool = resolveIncomingTool(msg.tool, msg.roomId, state.tool);
                if (!tool) break;
                // For lobby phase, also verify the tool matches what the user selected.
                // For tool_select, the tool comes straight from the server — trust it.
                if (state.phase === 'lobby' && tool !== state.tool) break;
                dispatch({ type: 'ROOM_CREATED', roomId: msg.roomId, bestOf: safeInt(msg.bestOf, 3), tool, reconnectToken: msg.reconnectToken });
                // For non-rps tools the optimistic GAME_START was already dispatched
                // on click. The server's game_start will be ignored by the idempotent guard.
                break;
            }
            case 'joined': {
                // Guard: accept join responses only when we are in lobby (join-by-code from Lobby)
                // or in tool_select with an active pending join (join-by-code from ToolSelector).
                if (state.phase !== 'lobby' && !(state.phase === 'tool_select' && state.pendingJoinCode)) break;
                const tool = resolveIncomingTool(msg.tool, msg.roomId, state.tool);
                if (!tool) break;
                dispatch({ type: 'JOINED', roomId: msg.roomId, bestOf: safeInt(msg.bestOf, 3), tool, reconnectToken: msg.reconnectToken });
                break;
            }
            case 'game_start': {
                if (state.phase === 'playing' || state.phase === 'finished') break;
                const tool = resolveIncomingTool(msg.tool, state.roomId, state.tool);
                if (!tool) break;
                // Guard: only accept if the resolved tool matches the tool we currently have.
                // Prevents a stale game_start (from a discarded room creation or join) from
                // silently moving the user into a game for the wrong tool.
                if (state.tool === null || tool !== state.tool) break;
                dispatch({ type: 'GAME_START', you: msg.you, bestOf: safeInt(msg.bestOf, 3), tool });
                break;
            }
            case 'reconnect_ok': {
                const tool = resolveIncomingTool(msg.tool, msg.roomId, state.tool);
                if (!tool) break;
                dispatch({
                    type: 'RECONNECT_OK',
                    roomId: msg.roomId,
                    bestOf: safeInt(msg.bestOf, 3),
                    tool,
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
            }
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
            case 'dice_duel_result':
                dispatch({ type: 'DICE_DUEL_RESULT', a: msg.a, b: msg.b, winner: msg.winner, round: msg.round, timestamp: msg.timestamp });
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
                dispatch({ type: 'REACTION_STATE', phase: msg.phase, mode: msg.mode, targetCentis: msg.targetCentis, readyBy: msg.readyBy, pressedBy: msg.pressedBy ?? [], countdownMs: msg.countdownMs, greenAt: msg.greenAt, by: msg.by, round: msg.round, timestamp: msg.timestamp });
                break;
            case 'reaction_result':
                dispatch({ type: 'REACTION_RESULT', mode: msg.mode, targetCentis: msg.targetCentis, deltaCentis: msg.deltaCentis, winner: msg.winner, falseStartBy: msg.falseStartBy, reactionMs: msg.reactionMs, by: msg.by, round: msg.round, timestamp: msg.timestamp });
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
    }, [state.phase, state.pendingJoinCode, state.roomId, state.tool]);

    return { state, dispatch, handleMessage };
}
