/** @type {import('next').NextConfig} */
const nextConfig = {
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

module.exports = nextConfig;
