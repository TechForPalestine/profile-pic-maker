import path from 'node:path';
import { defineConfig } from 'vitest/config';

// Deterministic integration tests. The upstream profile-pic providers
// (e.g. api.fxtwitter.com) are mocked, so this suite is fast, offline, and
// safe to run as a required CI gate. Live network tests live in
// `*.live.test.ts` and are excluded here — see `vitest.live.config.ts`.
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/integration/**/*.test.ts'],
    exclude: ['**/*.live.test.ts', 'node_modules/**', 'e2e/**'],
  },
});
