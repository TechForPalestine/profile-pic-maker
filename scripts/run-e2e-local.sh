#!/usr/bin/env bash
#
# Run the (mocked) Playwright e2e suite locally — including in sandboxes where
# Playwright's own browser-download CDN is blocked. It installs an npm-hosted
# Chromium and points Playwright at it via PLAYWRIGHT_CHROMIUM_PATH.
#
# Usage: ./scripts/run-e2e-local.sh [extra playwright args]
#
# Note: the @live suite (real tech4palestine pic) is NOT run here — it needs
# the real Twitter upstreams, which are typically unreachable from sandboxes.
# It runs in the non-blocking `e2e-live` CI job instead.
set -euo pipefail
cd "$(dirname "$0")/.."

# Chromium's OS libraries (no-op if already installed).
npx playwright install-deps chromium >/dev/null 2>&1 || true

# npm-hosted Chromium (npm registry is reachable where the browser CDNs aren't).
if ! node -e "require('@sparticuz/chromium')" >/dev/null 2>&1; then
  echo "Installing @sparticuz/chromium (npm-hosted browser)…"
  npm install --no-save @sparticuz/chromium
fi

PLAYWRIGHT_CHROMIUM_PATH="$(node -e "require('@sparticuz/chromium').default.executablePath().then(p=>console.log(p))")"
export PLAYWRIGHT_CHROMIUM_PATH
echo "Using Chromium at ${PLAYWRIGHT_CHROMIUM_PATH}"

npm run build
npm run test:e2e -- "$@"
