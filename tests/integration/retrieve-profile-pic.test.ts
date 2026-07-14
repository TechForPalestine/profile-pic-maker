import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { GET } from '@/app/api/retrieve-profile-pic/route';

const ROUTE = 'http://localhost/api/retrieve-profile-pic';

// Shape of the api.fxtwitter.com response the route relies on.
const fxtwitterResponse = {
  user: {
    name: 'Tech For Palestine',
    screen_name: 'tech4palestine',
    avatar_url:
      'https://pbs.twimg.com/profile_images/1700000000000000000/abcdEFGH_normal.jpg',
  },
};

function mockFetch(impl: (url: string) => unknown) {
  const fetchMock = vi.fn(async (url: string | URL) => impl(String(url)));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('GET /api/retrieve-profile-pic (twitter)', () => {
  it('resolves the tech4palestine avatar to the 400x400 variant', async () => {
    const fetchMock = mockFetch(() => ({
      ok: true,
      json: async () => fxtwitterResponse,
    }));

    const res = await GET(
      new NextRequest(`${ROUTE}?username=tech4palestine&platform=twitter`),
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      profilePicUrl:
        'https://pbs.twimg.com/profile_images/1700000000000000000/abcdEFGH_400x400.jpg',
    });
    // Confirms we call the upstream proxy with the exact handle.
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.fxtwitter.com/tech4palestine',
    );
  });

  it('returns 404 when the upstream cannot resolve the user', async () => {
    mockFetch(() => ({ ok: false, json: async () => ({}) }));

    const res = await GET(
      new NextRequest(`${ROUTE}?username=tech4palestine&platform=twitter`),
    );

    expect(res.status).toBe(404);
  });

  it('returns the default image without calling upstream for bad input', async () => {
    const fetchMock = mockFetch(() => ({
      ok: true,
      json: async () => fxtwitterResponse,
    }));

    // Missing username.
    const res = await GET(new NextRequest(`${ROUTE}?platform=twitter`));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ profilePicUrl: '/user.jpg' });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
