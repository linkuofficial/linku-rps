import { describe, expect, it } from 'vitest';
import {
    BEATS,
    VALID_CHOICES,
    ROOM_CODE_LENGTH,
    TOOL_CODE_PREFIX,
    createRoomCode,
    inferToolFromCode,
    isValidRoomCode,
    type InvalidGameStateReason,
    type ToolId,
} from './index';

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

describe('room codes', () => {
    const ALL_TOOLS = Object.keys(TOOL_CODE_PREFIX) as ToolId[];

    // The P0 contract: a generated code's length MUST equal the join inputs' maxLength.
    // The inputs use ROOM_CODE_LENGTH directly, so asserting against it guards both ends.
    it('generates codes whose length === ROOM_CODE_LENGTH for every tool', () => {
        for (const tool of ALL_TOOLS) {
            for (let i = 0; i < 50; i++) {
                const code = createRoomCode(tool);
                expect(code).toHaveLength(ROOM_CODE_LENGTH);
                expect(inferToolFromCode(code)).toBe(tool);
                expect(isValidRoomCode(code)).toBe(true);
            }
        }
    });

    it('rejects a code truncated to the old maxLength of 4 (the regression we fixed)', () => {
        const full = createRoomCode('rps');
        expect(full.length).toBeGreaterThan(4);
        expect(isValidRoomCode(full.slice(0, 4))).toBe(false);
    });

    it('rejects malformed codes', () => {
        expect(isValidRoomCode('')).toBe(false);
        expect(isValidRoomCode('1169')).toBe(false); // too short
        expect(isValidRoomCode('116988')).toBe(false); // too long
        expect(isValidRoomCode('91698')).toBe(false); // unknown prefix '9'
        expect(isValidRoomCode('1169a')).toBe(false); // non-digit
    });
});
