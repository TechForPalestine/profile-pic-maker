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
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Credentials', value: 'true' },
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET,OPTIONS,PATCH,DELETE,POST,PUT' },
          { key: 'Access-Control-Allow-Headers', value: 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version' },
        ]
      }
    ]
  },
};

module.exports = nextConfig;
