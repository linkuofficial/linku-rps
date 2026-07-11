import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        coverage: {
            provider: 'v8',
            reporter: ['text', 'lcov'],
            // Measure the modules that actually carry request/message logic, not just
            // the 7-line rate-limit helper. server.ts is exercised end-to-end by the
            // integration suite; the pure helpers are unit-tested directly.
            include: ['src/server.ts', 'src/messagePolicy.ts', 'src/payloadGuard.ts', 'src/rateLimit.ts'],
            // Thresholds sit just below the real measured coverage of this set
            // (server.ts ~52% lines / ~61% branches drives the floor; the helpers are
            // 100%). They are a regression floor for the server's core handlers — do
            // not lower them to go green, and do not inflate them to a number the
            // suite doesn't actually reach. Raise them only alongside new tests.
            thresholds: {
                lines: 50,
                functions: 72,
                branches: 55,
                statements: 50,
            },
        },
    },
});
