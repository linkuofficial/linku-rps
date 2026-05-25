import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-dom/client'],
          'router-vendor': ['wouter'],
        },
      },
    },
  },
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/hooks/useGameState.ts'],
      thresholds: {
        lines: 25,
        functions: 30,
        branches: 5,
        statements: 25,
      },
    },
  },
});