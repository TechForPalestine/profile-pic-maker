import path from 'node:path';
import { defineConfig } from 'vitest/config';

// Live smoke test that hits the REAL upstream (api.fxtwitter.com) to verify
// the tech4palestine profile picture still resolves in production. It depends
// on a third-party service, so it runs in a dedicated, NON-BLOCKING CI job
// (continue-on-error) and is never part of the required `npm test` gate.
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/integration/**/*.live.test.ts'],
    testTimeout: 20_000,
    retry: 2,
  },
});
