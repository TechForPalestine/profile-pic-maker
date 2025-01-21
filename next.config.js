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
        protocol: 'https',
        // todo this does not work. is it possible to include all mastodon servers...
        hostname: '**',
        pathname: '/**/account/avatar/**',
      },
    ],
  },
};

module.exports = nextConfig;
