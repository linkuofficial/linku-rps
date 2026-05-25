import { describe, expect, it } from 'vitest';
import { BEATS, VALID_CHOICES, type InvalidGameStateReason, type ToolId } from './index';

describe('shared constants', () => {
    it('covers all RPS choices', () => {
        expect(VALID_CHOICES).toEqual(['rock', 'paper', 'scissors']);
    });

    it('defines the correct win mapping', () => {
        expect(BEATS.rock).toBe('scissors');
        expect(BEATS.paper).toBe('rock');
        expect(BEATS.scissors).toBe('paper');
    });

    it('supports reaction tool id', () => {
        const tool: ToolId = 'reaction';
        expect(tool).toBe('reaction');
    });

    it('supports invalid game state reason type', () => {
        const reason: InvalidGameStateReason = 'chat_rate_limited';
        expect(reason).toBe('chat_rate_limited');
    });
});
