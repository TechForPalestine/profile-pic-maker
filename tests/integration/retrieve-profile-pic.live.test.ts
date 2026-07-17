import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';

import { SocialPlatform } from '@/types';
import { GET } from '@/app/api/retrieve-profile-pic/route';

const ROUTE = 'http://localhost/api/retrieve-profile-pic';

// LIVE smoke tests — one per supported platform. Each hits the REAL provider
// API (and then the real CDN) to prove the production integration can still
// fetch a downloadable profile picture end to end. Runs via `npm run test:live`
// in its own required CI step; retries (vitest.live.config.ts) absorb transient
// upstream blips. Accounts are real and stable — Tech For Palestine's own on
// Twitter/GitHub/Bluesky, and a long-standing GitLab maintainer for GitLab.
const CASES: {
  platform: SocialPlatform;
  username: string;
  urlPattern: RegExp;
}[] = [
  {
    platform: SocialPlatform.Twitter,
    username: 'tech4palestine',
    // The route upgrades the avatar to the high-res 400x400 variant.
    urlPattern: /^https:\/\/pbs\.twimg\.com\/.+_400x400\.\w+$/,
  },
  {
    platform: SocialPlatform.Github,
    username: 'TechForPalestine',
    urlPattern: /^https:\/\/avatars\.githubusercontent\.com\//,
  },
  {
    platform: SocialPlatform.Gitlab,
    username: 'stanhu',
    // GitLab serves either an uploaded avatar or a gravatar fallback.
    urlPattern: /^https:\/\/(gitlab\.com|secure\.gravatar\.com)\//,
  },
  {
    platform: SocialPlatform.Bluesky,
    username: 'techforpalestine.org',
    urlPattern: /^https:\/\/cdn\.bsky\.app\/img\/avatar\//,
  },
];

describe.each(CASES)(
  'LIVE: GET /api/retrieve-profile-pic ($platform)',
  ({ platform, username, urlPattern }) => {
    it(`fetches a real, downloadable ${platform} avatar for ${username}`, async () => {
      const res = await GET(
        new NextRequest(`${ROUTE}?username=${username}&platform=${platform}`),
      );

      expect(res.status).toBe(200);

      const { profilePicUrl } = (await res.json()) as { profilePicUrl: string };
      expect(profilePicUrl).toMatch(urlPattern);

      // The resolved URL must actually serve image bytes — the thing the UI
      // renders and then rasterises into the downloadable PNG.
      const image = await fetch(profilePicUrl);
      expect(image.ok).toBe(true);
      expect(image.headers.get('content-type')).toMatch(/^image\//);
    });
  },
);
