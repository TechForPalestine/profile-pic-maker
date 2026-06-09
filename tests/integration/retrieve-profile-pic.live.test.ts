import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';

import { GET } from '@/app/api/retrieve-profile-pic/route';

// LIVE smoke test — hits the real api.fxtwitter.com and the real Twitter CDN.
// Verifies the production integration can still fetch the profile picture for
// https://x.com/tech4palestine end to end. Runs via `npm run test:live` in its
// own required CI job; retries (vitest.live.config.ts) absorb transient blips.
describe('LIVE: GET /api/retrieve-profile-pic for tech4palestine', () => {
  it('fetches a real, downloadable 400x400 avatar from x.com/tech4palestine', async () => {
    const res = await GET(
      new NextRequest(
        'http://localhost/api/retrieve-profile-pic?username=tech4palestine&platform=twitter',
      ),
    );

    expect(res.status).toBe(200);

    const { profilePicUrl } = (await res.json()) as { profilePicUrl: string };

    // The route upgrades the avatar to the high-res 400x400 variant.
    expect(profilePicUrl).toMatch(
      /^https:\/\/pbs\.twimg\.com\/.+_400x400\.\w+$/,
    );

    // The resolved URL must actually serve image bytes (the thing the UI
    // renders and then rasterises into the downloadable PNG).
    const image = await fetch(profilePicUrl);
    expect(image.ok).toBe(true);
    expect(image.headers.get('content-type')).toMatch(/^image\//);
  });
});
