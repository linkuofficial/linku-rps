import { describe, expect, it } from 'vitest';
import {
    gameReducerForTest,
    inferToolFromRoomIdForTest,
    initialGameStateForTest,
    resolveIncomingToolForTest,
    shouldProcessGameStartForTest,
    shouldProcessJoinedForTest,
    shouldProcessRoomCreatedForTest,
} from './useGameState';

describe('useGameState reducer', () => {
    it('updates reaction state when reaction_state arrives', () => {
        const base = {
            ...initialGameStateForTest,
            roomId: 'ROOM01',
            tool: 'reaction' as const,
        };

        const next = gameReducerForTest(base, {
            type: 'REACTION_STATE',
            phase: 'countdown',
            mode: 'f1',
            targetCentis: null,
            readyBy: ['a', 'b'],
            pressedBy: [],
            countdownMs: 1800,
            greenAt: 123456,
            by: 'system',
            round: 3,
            timestamp: 999,
        });

        expect(next.reactionState?.phase).toBe('countdown');
        expect(next.reactionState?.readyBy).toEqual(['a', 'b']);
        expect(next.round).toBe(4);
        expect(next.history.at(-1)?.event).toBe('reaction_state');
    });

    it('stores reaction result and false start info', () => {
        const base = {
            ...initialGameStateForTest,
            roomId: 'ROOM02',
            tool: 'reaction' as const,
        };

        const next = gameReducerForTest(base, {
            type: 'REACTION_RESULT',
            mode: 'f1',
            targetCentis: null,
            deltaCentis: { a: null, b: null },
            winner: 'b',
            falseStartBy: 'a',
            reactionMs: { a: null, b: 182 },
            by: 'b',
            round: 4,
            timestamp: 1000,
        });

        expect(next.reactionState?.winner).toBe('b');
        expect(next.reactionState?.falseStartBy).toBe('a');
        expect(next.reactionState?.reactionMs.b).toBe(182);
        expect(next.history.at(-1)?.event).toBe('reaction_result');
    });

    it('stores target mode result metadata and delta values', () => {
        const base = {
            ...initialGameStateForTest,
            roomId: 'ROOM03',
            tool: 'reaction' as const,
        };

        const next = gameReducerForTest(base, {
            type: 'REACTION_RESULT',
            mode: 'target',
            targetCentis: 186,
            deltaCentis: { a: 24, b: 11 },
            winner: 'b',
            falseStartBy: null,
            reactionMs: { a: 2100, b: 1970 },
            by: 'b',
            round: 5,
            timestamp: 2000,
        });

        expect(next.reactionState?.mode).toBe('target');
        expect(next.reactionState?.targetCentis).toBe(186);
        expect(next.reactionState?.deltaCentis).toEqual({ a: 24, b: 11 });
        expect(next.history.at(-1)?.details).toContain('target=186');
        expect(next.history.at(-1)?.details).toContain('da=24');
        expect(next.history.at(-1)?.details).toContain('db=11');
    });

    it('stores server error reason for invalid game state', () => {
        const next = gameReducerForTest(initialGameStateForTest, {
            type: 'ERROR',
            code: 'invalid_game_state',
            message: 'Chat rate limit exceeded',
            reason: 'chat_rate_limited',
        });

        expect(next.error?.code).toBe('invalid_game_state');
        expect(next.error?.reason).toBe('chat_rate_limited');
    });

    it('infers tool from room id prefix for joined rooms', () => {
        expect(inferToolFromRoomIdForTest('3456')).toBe('wheel');
        expect(inferToolFromRoomIdForTest('4987')).toBe('dice');
    });

    it('prefers inferred or fallback tool when runtime payload omits tool', () => {
        expect(resolveIncomingToolForTest(undefined, '5123', null)).toBe('draw');
        expect(resolveIncomingToolForTest(undefined, null, 'reaction')).toBe('reaction');
    });
});

describe('ERROR reducer - fatal code auto-reset', () => {
    it('resets to tool_select when room_no_longer_exists arrives during playing', () => {
        const playing = { ...initialGameStateForTest, phase: 'playing' as const, tool: 'rps' as const, roomId: '1001' };
        const next = gameReducerForTest(playing, { type: 'ERROR', code: 'room_no_longer_exists', message: 'Room gone' });
        expect(next.phase).toBe('tool_select');
        expect(next.error?.code).toBe('room_no_longer_exists');
        expect(next.roomId).toBeNull();
    });

    it('resets to tool_select when reconnect_auth_failed arrives during playing', () => {
        const playing = { ...initialGameStateForTest, phase: 'playing' as const, tool: 'coin' as const, roomId: '2001' };
        const next = gameReducerForTest(playing, { type: 'ERROR', code: 'reconnect_auth_failed', message: 'Token invalid' });
        expect(next.phase).toBe('tool_select');
        expect(next.error?.code).toBe('reconnect_auth_failed');
    });

    it('resets to tool_select when room_not_found arrives during playing', () => {
        const playing = { ...initialGameStateForTest, phase: 'playing' as const, tool: 'dice' as const, roomId: '4005' };
        const next = gameReducerForTest(playing, { type: 'ERROR', code: 'room_not_found', message: 'No room' });
        expect(next.phase).toBe('tool_select');
    });

    it('does NOT auto-reset for soft errors during playing', () => {
        const playing = { ...initialGameStateForTest, phase: 'playing' as const, tool: 'rps' as const };
        const next = gameReducerForTest(playing, { type: 'ERROR', code: 'invalid_game_state', message: 'Soft error', reason: 'chat_rate_limited' as const });
        expect(next.phase).toBe('playing');
        expect(next.error?.code).toBe('invalid_game_state');
    });

    it('does NOT auto-reset for fatal errors outside playing phase', () => {
        const waiting = { ...initialGameStateForTest, phase: 'waiting' as const, tool: 'rps' as const, roomId: '1001' };
        const next = gameReducerForTest(waiting, { type: 'ERROR', code: 'room_no_longer_exists', message: 'Room gone' });
        expect(next.phase).toBe('waiting');
        expect(next.error?.code).toBe('room_no_longer_exists');
    });
});

describe('handleMessage guards', () => {
    describe('room_created guard', () => {
        it('rejects when phase is neither lobby nor tool_select', () => {
            expect(shouldProcessRoomCreatedForTest('waiting', 'rps', '1001', 'rps')).toBe(false);
            expect(shouldProcessRoomCreatedForTest('playing', 'rps', '1001', 'rps')).toBe(false);
            expect(shouldProcessRoomCreatedForTest('finished', 'rps', '1001', 'rps')).toBe(false);
        });

        it('accepts in tool_select when tool resolves', () => {
            expect(shouldProcessRoomCreatedForTest('tool_select', 'coin', '2001', null)).toBe(true);
            expect(shouldProcessRoomCreatedForTest('tool_select', undefined, '5001', null)).toBe(true); // inferred draw
        });

        it('rejects when resolved tool does not match state tool', () => {
            expect(shouldProcessRoomCreatedForTest('lobby', 'coin', '2001', 'rps')).toBe(false);
            expect(shouldProcessRoomCreatedForTest('lobby', undefined, '2001', 'rps')).toBe(false); // inferred coin ≠ rps
        });

        it('accepts when phase is lobby and tool matches', () => {
            expect(shouldProcessRoomCreatedForTest('lobby', 'rps', '1001', 'rps')).toBe(true);
            expect(shouldProcessRoomCreatedForTest('lobby', undefined, '2001', 'coin')).toBe(true); // inferred coin = coin
            expect(shouldProcessRoomCreatedForTest('lobby', 'wheel', '3042', 'wheel')).toBe(true);
        });
    });

    describe('joined guard', () => {
        it('accepts in lobby phase regardless of pendingJoinCode', () => {
            expect(shouldProcessJoinedForTest('lobby', null)).toBe(true);
            expect(shouldProcessJoinedForTest('lobby', '1234')).toBe(true);
        });

        it('accepts in tool_select phase only when pendingJoinCode is set', () => {
            expect(shouldProcessJoinedForTest('tool_select', '1234')).toBe(true);
            expect(shouldProcessJoinedForTest('tool_select', null)).toBe(false);
        });

        it('rejects in all other phases', () => {
            expect(shouldProcessJoinedForTest('playing', null)).toBe(false);
            expect(shouldProcessJoinedForTest('playing', '1234')).toBe(false);
            expect(shouldProcessJoinedForTest('waiting', null)).toBe(false);
            expect(shouldProcessJoinedForTest('finished', null)).toBe(false);
        });
    });

    describe('game_start guard', () => {
        it('rejects when state.tool is null', () => {
            expect(shouldProcessGameStartForTest(null, 'rps', null)).toBe(false);
            expect(shouldProcessGameStartForTest(null, undefined, '1001')).toBe(false);
        });

        it('rejects when resolved tool does not match state.tool', () => {
            expect(shouldProcessGameStartForTest('rps', 'coin', null)).toBe(false);
            expect(shouldProcessGameStartForTest('rps', undefined, '2001')).toBe(false); // inferred coin ≠ rps
        });

        it('accepts when tool matches state.tool', () => {
            expect(shouldProcessGameStartForTest('rps', 'rps', null)).toBe(true);
            expect(shouldProcessGameStartForTest('coin', undefined, '2001')).toBe(true); // inferred coin = coin
            expect(shouldProcessGameStartForTest('reaction', 'reaction', '6003')).toBe(true);
        });
    });
});
