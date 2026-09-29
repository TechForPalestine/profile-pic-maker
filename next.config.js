const { withSentryConfig } = require('@sentry/nextjs');

// On Cloudflare Pages the promoter leaderboard is off unless the project's
// NEXT_PUBLIC_LEADERBOARD Secret says "on", so it is switched from the
// dashboard (then Retry deployment), never by a code change. Elsewhere (local,
// CI) it stays on unless set to "off".
if (
  process.env.CF_PAGES === '1' &&
  process.env.NEXT_PUBLIC_LEADERBOARD !== 'on'
) {
  process.env.NEXT_PUBLIC_LEADERBOARD = 'off';
}

// Cloudflare Pages previews (env.preview in wrangler.jsonc sets
// PAGES_PREVIEW) hand out links to themselves: CF_PAGES_URL is the address of
// the deployment being built. Set before Next.js inlines NEXT_PUBLIC_* values.
// An explicit NEXT_PUBLIC_APP_URL always wins.
if (
  process.env.PAGES_PREVIEW === '1' &&
  process.env.CF_PAGES_URL &&
  !process.env.NEXT_PUBLIC_APP_URL
) {
  process.env.NEXT_PUBLIC_APP_URL = process.env.CF_PAGES_URL;
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Required on Next.js 14 so `src/instrumentation.ts` is loaded (stable in Next 15).
  experimental: {
    instrumentationHook: true,
    // TypeScript 7 ships no programmatic compiler API, so Next.js must shell out
    // to the tsc CLI for build-time type checking instead.
    useTypeScriptCli: true,
  },
  images: {
    remotePatterns: [
      {
        hostname: '*.twimg.com',
      },
      {
        hostname: 'avatars.githubusercontent.com',
      },
      {
        hostname: 'secure.gravatar.com',
      },
      {
        hostname: 'gitlab.com',
      },
      {
        hostname: 'cdn.bsky.app',
        pathname: '/img/avatar/plain/**',
      },
    ],
  },
  // next-on-pages' chunk deduplication aborts with "A duplicated identifier has
  // been detected in the same function file" when Webpack assigns the same numeric
  // module id to different modules across edge functions (triggered here by the
  // Sentry edge SDK loaded via src/instrumentation.ts). Named module ids are
  // path-based and globally unique, which sidesteps the collision.
  // See https://github.com/cloudflare/next-on-pages/issues/931
  webpack: (config) => {
    config.optimization.moduleIds = 'named';
    return config;
  },
};

module.exports = withSentryConfig(nextConfig, {
  // For all available options, see:
  // https://www.npmjs.com/package/@sentry/webpack-plugin#options

  org: 'tech-for-palestine',
  project: 'ppm',

  // Only print logs for uploading source maps in CI.
  silent: !process.env.CI,

  // Upload a larger set of source maps for prettier stack traces (increases build time).
  widenClientFileUpload: true,

  // Route browser requests to Sentry through a Next.js rewrite to circumvent
  // ad-blockers. This can increase your server load as well as your hosting bill.
  tunnelRoute: '/monitoring',

  // Automatically tree-shake Sentry logger statements to reduce bundle size.
  disableLogger: true,
});
