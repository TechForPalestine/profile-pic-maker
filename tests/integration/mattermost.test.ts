import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { POST as join } from '@/app/api/promoters/route';
import {
  notifyPendingPromoter,
  pendingPromoterMessage,
} from '@/lib/mattermost';
import { resetMemoryPromoterStore } from '@/lib/promoters';
import { resetRateLimits } from '@/lib/rate-limit';

const WEBHOOK = 'https://chat.example.org/hooks/abc123';

const joinRequest = (body: unknown) =>
  new NextRequest('http://localhost/api/promoters', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

describe('pendingPromoterMessage', () => {
  it('names the request and links to the review page', () => {
    const text = pendingPromoterMessage(
      {
        code: 'paul',
        displayName: 'Paul Biggar',
        link: 'https://x.com/paulbiggar',
        referredBy: 'zaher',
      },
      3,
      'https://ppm.techforpalestine.org/',
    );
    expect(text).toContain('Paul Biggar');
    expect(text).toContain('`paul`');
    expect(text).toContain('https://x.com/paulbiggar');
    expect(text).toContain('Referred by: `zaher`');
    expect(text).toContain('Waiting for review: 3');
    expect(text).toContain('https://ppm.techforpalestine.org/admin/promoters');
  });
});

describe('notifyPendingPromoter', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('sends nothing without a webhook URL', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await expect(
      notifyPendingPromoter({ code: 'paul', displayName: 'Paul' }, 1, ''),
    ).resolves.toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('swallows errors from Mattermost', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('down')));
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    await expect(
      notifyPendingPromoter({ code: 'paul', displayName: 'Paul' }, 1, WEBHOOK),
    ).resolves.toBe(false);
  });
});

describe('join route alert', () => {
  beforeEach(() => {
    resetMemoryPromoterStore();
    resetRateLimits();
    vi.stubEnv('TURNSTILE_SECRET', '');
    vi.stubEnv('LEADERBOARD_JOIN_ENABLED', '');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('posts to the webhook once the request is saved', async () => {
    vi.stubEnv('MATTERMOST_WEBHOOK_URL', WEBHOOK);
    const fetchMock = vi.fn().mockResolvedValue(new Response('ok'));
    vi.stubGlobal('fetch', fetchMock);

    const res = await join(
      joinRequest({ code: 'paul', displayName: 'Paul Biggar' }),
    );
    expect(res.status).toBe(201);
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(WEBHOOK);
    const payload = JSON.parse(init.body as string) as { text: string };
    expect(payload.text).toContain('Paul Biggar');
    expect(payload.text).toContain('Waiting for review: 1');
  });

  it('still accepts the request when Mattermost is down', async () => {
    vi.stubEnv('MATTERMOST_WEBHOOK_URL', WEBHOOK);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('no', { status: 500 })),
    );
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    const res = await join(
      joinRequest({ code: 'paul', displayName: 'Paul Biggar' }),
    );
    expect(res.status).toBe(201);
  });
});
