import { describe, expect, it } from 'vitest';
import { gameReducerForTest, initialGameStateForTest } from './useGameState';

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
});
