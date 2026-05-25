import { describe, expect, it } from 'vitest';
import { isRateLimited } from './rateLimit';

describe('isRateLimited', () => {
    it('returns true once max messages per second is reached', () => {
        const now = Date.now();
        const timestamps = [now - 100, now - 200, now - 300];
        expect(isRateLimited(timestamps, 3)).toBe(true);
    });

    it('drops stale timestamps older than one second', () => {
        const now = Date.now();
        const timestamps = [now - 1500, now - 2000, now - 100];
        expect(isRateLimited(timestamps, 3)).toBe(false);
        expect(timestamps.length).toBe(1);
    });
});
