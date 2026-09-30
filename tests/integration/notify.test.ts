import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { POST as join } from '@/app/api/promoters/route';
import { listingMessage, notifyNewListing, webhookUrl } from '@/lib/notify';
import { resetMemoryPromoterStore } from '@/lib/promoters';
import { resetRateLimits } from '@/lib/rate-limit';
import { APP_URL } from '@/lib/share';

const HOOK = 'https://chat.example.org/hooks/test-hook-id';

const joinRequest = (body: unknown) =>
  new NextRequest('http://localhost/api/promoters', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('webhookUrl', () => {
  it('accepts https only', () => {
    expect(webhookUrl(HOOK)).toBe(HOOK);
    expect(webhookUrl(` ${HOOK} `)).toBe(HOOK);
    expect(webhookUrl('http://chat.example.org/hooks/x')).toBeUndefined();
    expect(webhookUrl('not a url')).toBeUndefined();
    expect(webhookUrl('')).toBeUndefined();
    expect(webhookUrl(undefined)).toBeUndefined();
  });
});

describe('listingMessage', () => {
  it('names the request and points to the admin page', () => {
    const text = listingMessage(
      {
        code: 'layla-7k2q',
        displayName: 'Layla',
        link: 'https://x.com/layla',
        referredBy: 'zaher',
      },
      3,
    );
    expect(text).toContain('Layla');
    expect(text).toContain('`layla-7k2q`');
    expect(text).toContain('`https://x.com/layla`');
    expect(text).toContain('Referred by: `zaher`');
    expect(text).toContain(
      `3 waiting in total. Review at ${APP_URL}admin/promoters`,
    );
  });

  it('cannot format the post or mention anyone', () => {
    const text = listingMessage(
      { code: 'x-1234', displayName: '@channel [click](https://evil) `x`' },
      1,
    );
    expect(text).not.toContain('@channel');
    expect(text).not.toContain('](');
    expect(text).not.toMatch(/`x`/);
  });
});

describe('notifyNewListing', () => {
  it('posts the message as JSON to the webhook', async () => {
    const fetchMock = vi.fn(async () => new Response('ok'));
    vi.stubGlobal('fetch', fetchMock);
    await expect(
      notifyNewListing({ code: 'paul', displayName: 'Paul Biggar' }, 1, HOOK),
    ).resolves.toBe(true);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe(HOOK);
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toMatchObject({
      text: expect.stringContaining('Paul Biggar'),
    });
  });

  it('sends nothing without a webhook, and reports failures as false', async () => {
    const fetchMock = vi.fn(async () => new Response('no', { status: 500 }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(
      notifyNewListing({ code: 'paul', displayName: 'Paul' }, 1, undefined),
    ).resolves.toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
    await expect(
      notifyNewListing({ code: 'paul', displayName: 'Paul' }, 1, HOOK),
    ).resolves.toBe(false);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Promise.reject(new Error('down'))),
    );
    await expect(
      notifyNewListing({ code: 'paul', displayName: 'Paul' }, 1, HOOK),
    ).resolves.toBe(false);
  });
});

describe('POST /api/promoters notifies approvers', () => {
  beforeEach(() => {
    resetMemoryPromoterStore();
    resetRateLimits();
    vi.stubEnv('TURNSTILE_SECRET', '');
    vi.stubEnv('LEADERBOARD_JOIN_ENABLED', '');
  });

  it('posts once per new request when the webhook is set', async () => {
    vi.stubEnv('MATTERMOST_WEBHOOK_URL', HOOK);
    const fetchMock = vi.fn(async () => new Response('ok'));
    vi.stubGlobal('fetch', fetchMock);
    const res = await join(
      joinRequest({ code: 'paul', displayName: 'Paul Biggar' }),
    );
    expect(res.status).toBe(201);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse(
      (fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1]
        .body as string,
    );
    expect(body.text).toContain('1 waiting in total');

    // A refused request (code taken) posts nothing.
    await join(joinRequest({ code: 'paul', displayName: 'Paul Biggar' }));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('still accepts the request when Mattermost is down', async () => {
    vi.stubEnv('MATTERMOST_WEBHOOK_URL', HOOK);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Promise.reject(new Error('down'))),
    );
    const res = await join(
      joinRequest({ code: 'paul', displayName: 'Paul Biggar' }),
    );
    expect(res.status).toBe(201);
  });

  it('sends nothing when the webhook is not set', async () => {
    vi.stubEnv('MATTERMOST_WEBHOOK_URL', '');
    const fetchMock = vi.fn(async () => new Response('ok'));
    vi.stubGlobal('fetch', fetchMock);
    const res = await join(
      joinRequest({ code: 'paul', displayName: 'Paul Biggar' }),
    );
    expect(res.status).toBe(201);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
