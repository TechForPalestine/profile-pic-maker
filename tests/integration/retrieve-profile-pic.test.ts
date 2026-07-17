import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { SocialPlatform } from '@/types';
import { GET } from '@/app/api/retrieve-profile-pic/route';

const ROUTE = 'http://localhost/api/retrieve-profile-pic';

function mockFetch(impl: (url: string) => unknown) {
  const fetchMock = vi.fn(async (url: string | URL) => impl(String(url)));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// One case per supported platform. `upstreamBody` is the exact shape the route
// reads from each provider's API; `expected` is what the route should return
// after its per-platform massaging (e.g. Twitter's _normal -> _400x400 upgrade).
// Usernames are real accounts (Tech For Palestine's own where they exist) so the
// mocked and live suites stay in lockstep — see retrieve-profile-pic.live.test.ts.
const CASES: {
  platform: SocialPlatform;
  username: string;
  upstreamUrl: string;
  upstreamBody: unknown;
  expected: string;
}[] = [
  {
    platform: SocialPlatform.Twitter,
    username: 'tech4palestine',
    upstreamUrl: 'https://api.fxtwitter.com/tech4palestine',
    upstreamBody: {
      user: {
        avatar_url:
          'https://pbs.twimg.com/profile_images/1700000000000000000/abcdEFGH_normal.jpg',
      },
    },
    expected:
      'https://pbs.twimg.com/profile_images/1700000000000000000/abcdEFGH_400x400.jpg',
  },
  {
    platform: SocialPlatform.Github,
    username: 'TechForPalestine',
    upstreamUrl: 'https://api.github.com/users/TechForPalestine',
    upstreamBody: {
      avatar_url: 'https://avatars.githubusercontent.com/u/151086389?v=4',
    },
    expected: 'https://avatars.githubusercontent.com/u/151086389?v=4',
  },
  {
    platform: SocialPlatform.Gitlab,
    username: 'stanhu',
    upstreamUrl: 'https://gitlab.com/api/v4/users?username=stanhu',
    // GitLab's users endpoint returns an array; the route reads [0].avatar_url.
    upstreamBody: [
      {
        avatar_url:
          'https://gitlab.com/uploads/-/system/user/avatar/64248/stanhu.jpg',
      },
    ],
    expected:
      'https://gitlab.com/uploads/-/system/user/avatar/64248/stanhu.jpg',
  },
  {
    platform: SocialPlatform.Bluesky,
    username: 'techforpalestine.org',
    upstreamUrl:
      'https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile?actor=techforpalestine.org',
    upstreamBody: {
      avatar:
        'https://cdn.bsky.app/img/avatar/plain/did:plc:test/bafkreitestavatar@jpeg',
    },
    expected:
      'https://cdn.bsky.app/img/avatar/plain/did:plc:test/bafkreitestavatar@jpeg',
  },
];

describe.each(CASES)(
  'GET /api/retrieve-profile-pic ($platform)',
  ({ platform, username, upstreamUrl, upstreamBody, expected }) => {
    it(`resolves the ${platform} avatar for ${username}`, async () => {
      const fetchMock = mockFetch(() => ({
        ok: true,
        json: async () => upstreamBody,
      }));

      const res = await GET(
        new NextRequest(`${ROUTE}?username=${username}&platform=${platform}`),
      );

      expect(res.status).toBe(200);
      await expect(res.json()).resolves.toEqual({ profilePicUrl: expected });
      // Confirms we call the correct upstream provider with the exact handle.
      expect(fetchMock).toHaveBeenCalledWith(upstreamUrl);
    });

    it(`returns 404 when the ${platform} upstream cannot resolve the user`, async () => {
      mockFetch(() => ({ ok: false, json: async () => ({}) }));

      const res = await GET(
        new NextRequest(`${ROUTE}?username=${username}&platform=${platform}`),
      );

      expect(res.status).toBe(404);
    });
  },
);

describe('GET /api/retrieve-profile-pic (bad input)', () => {
  it('returns the default image without calling upstream when username is missing', async () => {
    const fetchMock = mockFetch(() => ({ ok: true, json: async () => ({}) }));

    const res = await GET(new NextRequest(`${ROUTE}?platform=twitter`));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ profilePicUrl: '/user.jpg' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns the default image without calling upstream for an unknown platform', async () => {
    const fetchMock = mockFetch(() => ({ ok: true, json: async () => ({}) }));

    const res = await GET(
      new NextRequest(`${ROUTE}?username=someone&platform=myspace`),
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ profilePicUrl: '/user.jpg' });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
