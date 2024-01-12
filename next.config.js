/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        hostname: 'pbs.twimg.com',
      },
      {
        hostname: 'avatars.githubusercontent.com'
      }
    ],
  },
};

module.exports = nextConfig
