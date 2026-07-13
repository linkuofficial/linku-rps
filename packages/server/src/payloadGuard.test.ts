import { describe, expect, it } from 'vitest';
import { isSupportedClientMessageType, validateClientPayload } from './payloadGuard';

describe('validateClientPayload', () => {
    // The exact payload that used to crash the whole process: JSON.parse('null')
    // yields null, and reading `.type` off it threw an uncaughtException.
    it('rejects null without throwing', () => {
        expect(validateClientPayload(null)).toEqual({ ok: false });
    });

    it('rejects bare scalars', () => {
        expect(validateClientPayload('a string')).toEqual({ ok: false });
        expect(validateClientPayload(42)).toEqual({ ok: false });
        expect(validateClientPayload(true)).toEqual({ ok: false });
        expect(validateClientPayload(false)).toEqual({ ok: false });
    });

    it('rejects arrays', () => {
        expect(validateClientPayload([])).toEqual({ ok: false });
        expect(validateClientPayload([{ type: 'create_room' }])).toEqual({ ok: false });
    });

    it('rejects objects with no type', () => {
        expect(validateClientPayload({})).toEqual({ ok: false });
        expect(validateClientPayload({ foo: 1 })).toEqual({ ok: false });
    });

    it('rejects a non-string type', () => {
        expect(validateClientPayload({ type: 42 })).toEqual({ ok: false });
        expect(validateClientPayload({ type: null })).toEqual({ ok: false });
        expect(validateClientPayload({ type: { nested: true } })).toEqual({ ok: false });
    });

    it('rejects an unknown message type', () => {
        expect(validateClientPayload({ type: 'nope' })).toEqual({ ok: false });
        expect(validateClientPayload({ type: 'hasOwnProperty' })).toEqual({ ok: false });
    });

    it('accepts a supported type even when other fields are missing', () => {
        // Field-level validation is deliberately left to the handler's try/catch;
        // the envelope only has to be a plain object with a known `type`.
        const result = validateClientPayload({ type: 'join_room' });
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.message.type).toBe('join_room');
        }
    });

    it('accepts a well-formed message and returns it unchanged', () => {
        const payload = { type: 'create_room', bestOf: 3, tool: 'rps' };
        const result = validateClientPayload(payload);
        expect(result).toEqual({ ok: true, message: payload });
    });

    it('accepts every supported client message type', () => {
        const types = [
            'create_room',
            'join_room',
            'reconnect',
            'choice',
            'chat',
            'emoji',
            'rematch_request',
            'rematch_response',
            'coin_flip',
            'dice_roll',
            'wheel_spin',
            'draw_run',
            'reaction_ready',
            'reaction_press',
        ];
        for (const type of types) {
            expect(validateClientPayload({ type }).ok).toBe(true);
        }
    });
});

describe('isSupportedClientMessageType', () => {
    it('accepts known types and rejects everything else', () => {
        expect(isSupportedClientMessageType('choice')).toBe(true);
        expect(isSupportedClientMessageType('nope')).toBe(false);
        expect(isSupportedClientMessageType('')).toBe(false);
        expect(isSupportedClientMessageType(undefined)).toBe(false);
        expect(isSupportedClientMessageType(42)).toBe(false);
        // Inherited Object.prototype keys must not count as supported.
        expect(isSupportedClientMessageType('toString')).toBe(false);
        expect(isSupportedClientMessageType('constructor')).toBe(false);
    });
});
