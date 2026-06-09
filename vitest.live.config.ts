import path from 'node:path';
import { defineConfig } from 'vitest/config';

// Live smoke test that hits the REAL upstream (api.fxtwitter.com) to verify
// the tech4palestine profile picture still resolves in production. It depends
// on a third-party service, so it runs in its own CI job (`npm run test:live`)
// separate from the deterministic `npm test` gate. `retry` below absorbs
// transient upstream blips so the required job stays stable.
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
