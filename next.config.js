const { withSentryConfig } = require('@sentry/nextjs');

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Required on Next.js 14 so `src/instrumentation.ts` is loaded (stable in Next 15).
  experimental: {
    instrumentationHook: true,
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
