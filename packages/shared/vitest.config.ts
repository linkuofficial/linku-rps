import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        coverage: {
            provider: 'v8',
            reporter: ['text', 'lcov'],
            include: ['src/index.ts'],
            thresholds: {
                lines: 95,
                functions: 95,
                branches: 95,
                statements: 95,
            },
        },
    },
});