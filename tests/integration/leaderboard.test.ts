import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { FunnelEvent } from '@/lib/analytics';
import {
  bucketSource,
  buildChannels,
  buildLeaderboard,
  buildPendingCounts,
  channelLabel,
  rankPromoters,
} from '@/lib/leaderboard';
import { hashReferralCode } from '@/lib/referral';
import {
  createPlausibleClient,
  downloadsQuery,
  isLeaderboardWindow,
} from '@/lib/plausible-stats';
import {
  getPromoterStore,
  resetMemoryPromoterStore,
  type Promoter,
} from '@/lib/promoters';
import { GET } from '@/app/api/leaderboard/route';

const promoter = (
  code: string,
  displayName: string,
  extra: Partial<Promoter> = {},
): Promoter => ({
  code,
  displayName,
  links: { x: `https://x.com/${code}` },
  status: 'approved',
  createdAt: '2026-01-01T00:00:00.000Z',
  ...extra,
});

const APPROVED: Promoter[] = [
  promoter('paul', 'Paul'),
  promoter('zaher', 'Zaher'),
  promoter('newbie', 'Newbie', { referredBy: 'zaher' }),
];

const BY_REFERRER = [
  { key: 'none', visitors: 900, events: 1200 },
  { key: 'zaher', visitors: 40, events: 55 },
  { key: 'paul', visitors: 40, events: 41 },
  { key: 'stranger', visitors: 30, events: 30 },
  { key: 'ch-newsletter', visitors: 12, events: 12 },
];

const BY_SOURCE = [
  { key: 'Direct / None', visitors: 700, events: 900 },
  { key: 'share-whatsapp', visitors: 120, events: 130 },
  { key: 'share-system-story', visitors: 60, events: 60 },
  { key: 'paul', visitors: 35, events: 36 },
  { key: 'stranger', visitors: 30, events: 30 },
  { key: 'ch-mighty-missions', visitors: 25, events: 25 },
  { key: 'twitter', visitors: 20, events: 20 },
];

describe('rankPromoters', () => {
  it('ranks approved promoters by unique downloads with shared ranks on ties', () => {
    const rows = rankPromoters(BY_REFERRER, APPROVED);
    expect(rows.map((r) => [r.code, r.rank, r.downloads])).toEqual([
      ['paul', 1, 40],
      ['zaher', 1, 40],
      ['newbie', 3, 0],
    ]);
  });

  it('never shows a code that is not approved, and shows approved ones at zero', () => {
    const rows = rankPromoters(BY_REFERRER, APPROVED);
    expect(rows.map((r) => r.code)).not.toContain('stranger');
    expect(rows.find((r) => r.code === 'newbie')?.downloads).toBe(0);
  });

  it('carries recruit counts and public links only', () => {
    const zaher = rankPromoters(BY_REFERRER, APPROVED).find(
      (r) => r.code === 'zaher',
    )!;
    expect(zaher.recruits).toBe(1);
    expect(zaher).not.toHaveProperty('status');
    expect(zaher).not.toHaveProperty('createdAt');
  });
});

describe('channel buckets', () => {
  const approvedCodes = new Set(['paul', 'zaher']);

  it('sorts sources into promoters, shared, named channels and organic', () => {
    expect(bucketSource('paul', approvedCodes)).toBe('promoters');
    expect(bucketSource('share-whatsapp', approvedCodes)).toBe('shared');
    expect(bucketSource('ch-mighty-missions', approvedCodes)).toBe(
      'channel:ch-mighty-missions',
    );
    expect(bucketSource('stranger', approvedCodes)).toBe('organic');
    expect(bucketSource('Direct / None', approvedCodes)).toBe('organic');
    expect(bucketSource('twitter', approvedCodes)).toBe('organic');
    expect(bucketSource('ch-', approvedCodes)).toBe('organic');
  });

  it('labels channels from their code', () => {
    expect(channelLabel('ch-mighty-missions')).toBe('Mighty Missions');
    expect(channelLabel('ch-t4p-tools-page')).toBe('T4p Tools Page');
  });

  it('totals unique downloads per bucket, largest first', () => {
    expect(buildChannels(BY_SOURCE, approvedCodes)).toEqual([
      { bucket: 'organic', label: 'Direct and organic', downloads: 750 },
      { bucket: 'shared', label: 'Shared by users', downloads: 180 },
      { bucket: 'promoters', label: 'Promoter links', downloads: 35 },
      {
        bucket: 'channel:ch-mighty-missions',
        label: 'Mighty Missions',
        downloads: 25,
      },
    ]);
  });
});

describe('pending counts', () => {
  it('publishes unapproved codes only as fingerprints, never in the clear', async () => {
    const counts = await buildPendingCounts(
      BY_REFERRER,
      new Set(['paul', 'zaher']),
    );
    const keys = Object.keys(counts);
    expect(keys).toHaveLength(2);
    for (const key of keys) expect(key).toMatch(/^[0-9a-f]{12}$/);
    expect(JSON.stringify(counts)).not.toContain('stranger');
    expect(counts[await hashReferralCode('stranger')]).toBe(30);
    expect(counts[await hashReferralCode('ch-newsletter')]).toBe(12);
    expect(counts[await hashReferralCode('none')]).toBeUndefined();
    expect(counts[await hashReferralCode('paul')]).toBeUndefined();
  });

  it('hashes deterministically', async () => {
    expect(await hashReferralCode('paul')).toBe(await hashReferralCode('paul'));
    expect(await hashReferralCode('paul')).not.toBe(
      await hashReferralCode('paula'),
    );
  });
});

describe('buildLeaderboard', () => {
  it('assembles the response for a window', async () => {
    const board = await buildLeaderboard({
      window: '7d',
      byReferrer: BY_REFERRER,
      bySource: BY_SOURCE,
      approved: APPROVED,
      now: new Date('2026-09-14T12:00:00Z'),
    });
    expect(board.window).toBe('7d');
    expect(board.generatedAt).toBe('2026-09-14T12:00:00.000Z');
    expect(board.promoters).toHaveLength(3);
    expect(board.channels[0].bucket).toBe('organic');
    expect(Object.keys(board.pendingCounts)).toHaveLength(2);
  });
});

describe('Plausible Stats client', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('only offers the three windows', () => {
    expect(isLeaderboardWindow('day')).toBe(true);
    expect(isLeaderboardWindow('7d')).toBe(true);
    expect(isLeaderboardWindow('all')).toBe(true);
    expect(isLeaderboardWindow('30d')).toBe(false);
    expect(isLeaderboardWindow(undefined)).toBe(false);
  });

  it('pins the query body to the Stats API v2 shape', () => {
    expect(downloadsQuery('ppm.test', 'event:props:referrer', '7d')).toEqual({
      site_id: 'ppm.test',
      metrics: ['visitors', 'events'],
      date_range: '7d',
      filters: [['is', 'event:name', [FunnelEvent.Downloaded]]],
      dimensions: ['event:props:referrer'],
      order_by: [['visitors', 'desc']],
      pagination: { limit: 500 },
    });
  });

  it('posts with the bearer key and maps rows', async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({
        results: [
          { dimensions: ['paul'], metrics: [40, 41] },
          { dimensions: ['none'], metrics: [900, 1200] },
        ],
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const client = createPlausibleClient({
      PLAUSIBLE_API_KEY: 'key',
      PLAUSIBLE_SITE_ID: 'ppm.test',
      PLAUSIBLE_API_HOST: 'https://stats.example/',
    });

    const rows = await client.downloadsBy('event:props:referrer', 'day');

    expect(rows).toEqual([
      { key: 'paul', visitors: 40, events: 41 },
      { key: 'none', visitors: 900, events: 1200 },
    ]);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe('https://stats.example/api/v2/query');
    expect((init.headers as Record<string, string>).Authorization).toBe(
      'Bearer key',
    );
    expect(JSON.parse(init.body as string).date_range).toBe('day');
  });

  it('throws on a non-2xx response so the route can answer 502', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('nope', { status: 401 })),
    );
    const client = createPlausibleClient({ PLAUSIBLE_API_KEY: 'key' });
    await expect(client.downloadsBy('visit:source', 'all')).rejects.toThrow(
      /401/,
    );
  });
});

describe('GET /api/leaderboard', () => {
  beforeEach(() => {
    resetMemoryPromoterStore();
    vi.stubEnv('CLOUDFLARE_ACCOUNT_ID', '');
    vi.stubEnv('PLAUSIBLE_API_KEY', '');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('rejects unknown windows', async () => {
    const res = await GET(
      new NextRequest('http://localhost/api/leaderboard?window=30d'),
    );
    expect(res.status).toBe(400);
  });

  it('answers 503 when no Plausible key is configured', async () => {
    const res = await GET(new NextRequest('http://localhost/api/leaderboard'));
    expect(res.status).toBe(503);
    await expect(res.json()).resolves.toEqual({
      error: 'leaderboard-unavailable',
    });
  });

  it('joins Plausible counts onto approved promoters and caches the result', async () => {
    vi.stubEnv('PLAUSIBLE_API_KEY', 'key');
    const store = getPromoterStore();
    await store.put(promoter('paul', 'Paul'));
    await store.put(promoter('stranger', 'Stranger', { status: 'pending' }));
    await store.rebuildApproved();

    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body));
        const results =
          body.dimensions[0] === 'event:props:referrer'
            ? [
                { dimensions: ['paul'], metrics: [40, 41] },
                { dimensions: ['stranger'], metrics: [30, 30] },
              ]
            : [
                { dimensions: ['share-whatsapp'], metrics: [120, 130] },
                { dimensions: ['stranger'], metrics: [30, 30] },
              ];
        return Response.json({ results });
      }),
    );

    const res = await GET(
      new NextRequest('http://localhost/api/leaderboard?window=all'),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toContain('s-maxage=300');
    const board = await res.json();
    expect(board.window).toBe('all');
    expect(board.promoters).toEqual([
      {
        code: 'paul',
        displayName: 'Paul',
        links: { x: 'https://x.com/paul' },
        recruits: 0,
        rank: 1,
        downloads: 40,
      },
    ]);
    expect(board.channels).toEqual([
      { bucket: 'shared', label: 'Shared by users', downloads: 120 },
      { bucket: 'organic', label: 'Direct and organic', downloads: 30 },
    ]);
    // The pending promoter's count is there for their own browser to find,
    // under a fingerprint rather than the code itself.
    expect(board.pendingCounts).toEqual({
      [await hashReferralCode('stranger')]: 30,
    });
  });

  it('answers 502 when Plausible fails', async () => {
    vi.stubEnv('PLAUSIBLE_API_KEY', 'key');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('down', { status: 500 })),
    );
    const res = await GET(new NextRequest('http://localhost/api/leaderboard'));
    expect(res.status).toBe(502);
  });
});
