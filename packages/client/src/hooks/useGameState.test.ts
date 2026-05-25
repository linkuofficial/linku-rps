import { describe, expect, it } from 'vitest';
import { gameReducerForTest, inferToolFromRoomIdForTest, initialGameStateForTest, resolveIncomingToolForTest } from './useGameState';

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
