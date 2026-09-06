import { describe, expect, it } from 'vitest';
import { inspectDrawInput, validIntegerInput } from './inputValidation';

describe('tool input validation', () => {
    it('keeps incomplete and non-integer dice input out of requests', () => {
        for (const value of ['', ' ', '1.5', '1e1', '-2', 'Infinity', '21']) {
            expect(validIntegerInput(value, 1, 20), value).toBe(false);
        }
        expect(validIntegerInput('20', 1, 20)).toBe(true);
        expect(validIntegerInput('2', 2, 1000)).toBe(true);
        expect(validIntegerInput('1000', 2, 1000)).toBe(true);
    });
    it('ignores blank lines and counts unique trimmed draw names', () => {
        expect(inspectDrawInput('\r\n Alice \r\nBob\nAlice\n')).toEqual({ names: ['Alice', 'Bob'], tooMany: false, tooLong: false, valid: true });
        expect(inspectDrawInput(' \n\t').valid).toBe(false);
    });
    it('rejects names that the protocol would silently truncate', () => {
        expect(inspectDrawInput('x'.repeat(41)).tooLong).toBe(true);
        expect(inspectDrawInput('x'.repeat(40)).valid).toBe(true);
        expect(inspectDrawInput(Array.from({ length: 201 }, (_, i) => String(i)).join('\n')).valid).toBe(false);
        expect(inspectDrawInput(Array.from({ length: 200 }, (_, i) => String(i)).join('\n')).valid).toBe(true);
    });
});
