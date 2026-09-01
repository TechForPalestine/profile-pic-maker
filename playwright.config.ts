import { defineConfig, devices } from '@playwright/test';

const PORT = 3000;
const baseURL = `http://localhost:${PORT}`;

// In restricted sandboxes the Playwright/Chrome download CDNs are blocked, so
// we point at an npm-provided Chromium via this env var (see
// scripts/run-e2e-local.sh). Unset in CI, where Playwright's own bundled
// browsers are used normally.
const chromiumPath = process.env.PLAYWRIGHT_CHROMIUM_PATH;

// E2E tests drive the real built app in a real browser. They mock only the
// network boundary (our API + the optimized image) so the full UI flow —
// pick platform -> fetch -> render -> rasterise -> download — is exercised
// deterministically. The CI job builds the app, then `webServer` serves it.
//
// All three engines run: the rasterisation step is where Blink, Gecko and
// WebKit disagree. CI runs one browser per job (see .github/workflows/ci.yml);
// locally `npx playwright test` runs all three.
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  // Two retries on CI: the @live spec hits real third-party upstreams, so a
  // transient failure shouldn't fail a now-required job. The mocked specs are
  // deterministic and won't need them.
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI
    ? [['github'], ['list'], ['html', { open: 'never' }]]
    : 'list',
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          executablePath: chromiumPath || undefined,
          args: chromiumPath ? ['--no-sandbox'] : [],
        },
      },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],
  webServer: {
    command: 'npm run start',
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
