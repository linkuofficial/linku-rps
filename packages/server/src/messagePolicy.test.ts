import { describe, expect, it } from 'vitest';
import {
    getInvalidGameStateMessage,
    getMessageRateBucket,
    getMessageRateLimitPerSecond,
    MESSAGE_RATE_LIMIT_PER_SECOND,
} from './messagePolicy';

describe('messagePolicy', () => {
    it('maps chat and emoji to chat bucket', () => {
        expect(getMessageRateBucket('chat')).toBe('chat');
        expect(getMessageRateBucket('emoji')).toBe('chat');
    });

    it('maps reaction messages to reaction bucket', () => {
        expect(getMessageRateBucket('reaction_ready')).toBe('reaction');
        expect(getMessageRateBucket('reaction_press')).toBe('reaction');
    });

    it('maps create_room to system bucket', () => {
        expect(getMessageRateBucket('create_room')).toBe('system');
    });

    it('returns configured rate limit for each bucket', () => {
        expect(getMessageRateLimitPerSecond('system')).toBe(MESSAGE_RATE_LIMIT_PER_SECOND.system);
        expect(getMessageRateLimitPerSecond('chat')).toBe(MESSAGE_RATE_LIMIT_PER_SECOND.chat);
        expect(getMessageRateLimitPerSecond('reaction')).toBe(MESSAGE_RATE_LIMIT_PER_SECOND.reaction);
    });

    it('returns stable invalid game state messages', () => {
        expect(getInvalidGameStateMessage('rate_limit_exceeded')).toBe('Rate limit exceeded');
        expect(getInvalidGameStateMessage('reaction_not_green')).toBe('Reaction press is only allowed when light is green');
        expect(getInvalidGameStateMessage('chat_empty')).toBe('Chat message cannot be empty');
    });
});