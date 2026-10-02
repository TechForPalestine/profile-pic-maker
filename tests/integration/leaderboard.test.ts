import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { FunnelEvent } from '@/lib/analytics';
import {
  bucketSource,
  buildChannels,
  buildLeaderboard,
  buildPendingCounts,
  channelLabel,
  isSuspicious,
  rankPromoters,
} from '@/lib/leaderboard';
import { hashReferralCode } from '@/lib/referral';
import {
  countQuery,
  dateRange,
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
import { GET as listPromoters, POST as join } from '@/app/api/promoters/route';
import { POST as status } from '@/app/api/promoters/status/route';
import { GET as adminList } from '@/app/api/admin/promoters/route';
import { cachedBoard, resetBoardCache } from '@/lib/board-cache';
import { resetRateLimits } from '@/lib/rate-limit';

const promoter = (
  code: string,
  displayName: string,
  extra: Partial<Promoter> = {},
): Promoter => ({
  code,
  displayName,
  link: `https://x.com/${code}`,
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

const VISITS_BY_REFERRER = [
  { key: 'none', visitors: 5000, events: 6000 },
  { key: 'zaher', visitors: 400, events: 450 },
  { key: 'paul', visitors: 60, events: 61 },
  { key: 'stranger', visitors: 10, events: 10 },
  { key: 'lurker', visitors: 8, events: 8 },
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

  it('shows visits next to downloads without letting them change the rank', () => {
    const rows = rankPromoters(BY_REFERRER, APPROVED, VISITS_BY_REFERRER);
    // Zaher has ten times Paul's visits and the same downloads: still tied.
    expect(rows.map((r) => [r.code, r.rank, r.downloads, r.visits])).toEqual([
      ['paul', 1, 40, 60],
      ['zaher', 1, 40, 400],
      ['newbie', 3, 0, 0],
    ]);
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

describe('isSuspicious', () => {
  it('flags downloads that outnumber visits, with a small tolerance', () => {
    expect(isSuspicious(40, 60)).toBe(false);
    expect(isSuspicious(40, 40)).toBe(false);
    // 10 downloads on 7 visits is inside the tolerance (7 * 1.2 + 2 = 10.4);
    // on 6 visits it is not (9.2).
    expect(isSuspicious(10, 7)).toBe(false);
    expect(isSuspicious(10, 6)).toBe(true);
    expect(isSuspicious(50, 10)).toBe(true);
    expect(isSuspicious(30, 0)).toBe(true);
  });

  it('ignores tiny numbers', () => {
    expect(isSuspicious(3, 0)).toBe(false);
    expect(isSuspicious(4, 0)).toBe(false);
    expect(isSuspicious(5, 0)).toBe(true);
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
  it('ignores downloads that carry no referrer at all', async () => {
    const pending = await buildPendingCounts(
      [
        { key: '(none)', visitors: 5310, events: 5400 },
        { key: 'none', visitors: 200, events: 210 },
        { key: 'newbie-7k2q', visitors: 3, events: 3 },
      ],
      new Set(),
    );
    expect(Object.values(pending)).toEqual([{ downloads: 3, visits: 0 }]);
  });

  it('publishes unapproved codes only as fingerprints, never in the clear', async () => {
    const counts = await buildPendingCounts(
      BY_REFERRER,
      new Set(['paul', 'zaher']),
      VISITS_BY_REFERRER,
    );
    const keys = Object.keys(counts);
    // stranger, ch-newsletter, and lurker (visits only, no download yet)
    expect(keys).toHaveLength(3);
    for (const key of keys) expect(key).toMatch(/^[0-9a-f]{12}$/);
    expect(JSON.stringify(counts)).not.toContain('stranger');
    expect(counts[await hashReferralCode('stranger')]).toEqual({
      downloads: 30,
      visits: 10,
    });
    expect(counts[await hashReferralCode('ch-newsletter')]).toEqual({
      downloads: 12,
      visits: 0,
    });
    expect(counts[await hashReferralCode('lurker')]).toEqual({
      downloads: 0,
      visits: 8,
    });
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
    expect(board.promoters[0].visits).toBe(0);
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
    expect(
      countQuery('ppm.test', FunnelEvent.Landed, 'event:props:referrer', 'day')
        .filters,
    ).toEqual([['is', 'event:name', [FunnelEvent.Landed]]]);
    expect(downloadsQuery('ppm.test', 'event:props:referrer', 'all')).toEqual({
      site_id: 'ppm.test',
      metrics: ['visitors', 'events'],
      date_range: 'all',
      filters: [['is', 'event:name', [FunnelEvent.Downloaded]]],
      dimensions: ['event:props:referrer'],
      order_by: [['visitors', 'desc']],
      pagination: { limit: 500 },
    });
  });

  it('makes the 7-day window end today, not yesterday', () => {
    const now = new Date('2026-10-02T19:00:00Z');
    expect(dateRange('7d', now)).toEqual(['2026-09-26', '2026-10-02']);
    expect(dateRange('day', now)).toBe('day');
    expect(dateRange('all', now)).toBe('all');
    expect(
      countQuery('ppm.test', FunnelEvent.Downloaded, 'visit:source', '7d', now)
        .date_range,
    ).toEqual(['2026-09-26', '2026-10-02']);
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
    resetBoardCache();
    resetRateLimits();
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
        const event = body.filters[0][2][0];
        const results =
          body.dimensions[0] !== 'event:props:referrer'
            ? [
                { dimensions: ['share-whatsapp'], metrics: [120, 130] },
                { dimensions: ['stranger'], metrics: [30, 30] },
              ]
            : event === FunnelEvent.Landed
              ? [
                  { dimensions: ['paul'], metrics: [90, 95] },
                  { dimensions: ['stranger'], metrics: [10, 10] },
                ]
              : [
                  { dimensions: ['paul'], metrics: [40, 41] },
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
        link: 'https://x.com/paul',
        recruits: 0,
        rank: 1,
        downloads: 40,
        visits: 90,
      },
    ]);
    expect(board.channels).toEqual([
      { bucket: 'shared', label: 'Shared by users', downloads: 120 },
      { bucket: 'organic', label: 'Direct and organic', downloads: 30 },
    ]);
    // The pending promoter's count is there for their own browser to find,
    // under a fingerprint rather than the code itself.
    expect(board.pendingCounts).toEqual({
      [await hashReferralCode('stranger')]: { downloads: 30, visits: 10 },
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

describe('board cache', () => {
  beforeEach(() => resetBoardCache());

  const board = (window: 'day' | '7d' | 'all', at: string) => ({
    window,
    generatedAt: at,
    promoters: [],
    channels: [],
    pendingCounts: {},
  });

  it('computes once per window within the TTL, however many callers', async () => {
    let t = 0;
    const compute = vi.fn(async () => board('day', new Date(t).toISOString()));
    const opts = { ttlMs: 1000, now: () => t };

    await Promise.all(
      Array.from({ length: 20 }, () => cachedBoard('day', compute, opts)),
    );
    expect(compute).toHaveBeenCalledTimes(1);

    t = 999;
    await cachedBoard('day', compute, opts);
    expect(compute).toHaveBeenCalledTimes(1);

    t = 1000;
    await cachedBoard('day', compute, opts);
    expect(compute).toHaveBeenCalledTimes(2);
  });

  it('keeps windows apart and does not cache failures', async () => {
    const compute = vi.fn(async () => board('7d', new Date().toISOString()));
    await cachedBoard('7d', compute);
    await cachedBoard('all', compute);
    expect(compute).toHaveBeenCalledTimes(2);

    const failing = vi.fn(async () => {
      throw new Error('upstream down');
    });
    await expect(cachedBoard('day', failing)).rejects.toThrow();
    await expect(cachedBoard('day', failing)).rejects.toThrow();
    expect(failing).toHaveBeenCalledTimes(2);
  });

  it('shares entries through the Cloudflare edge cache when present', async () => {
    const store = new Map<string, Response>();
    vi.stubGlobal('caches', {
      default: {
        match: async (r: Request) => store.get(r.url)?.clone(),
        put: async (r: Request, res: Response) => {
          store.set(r.url, res);
        },
      },
    });
    try {
      const compute = vi.fn(async () => board('day', new Date().toISOString()));
      await cachedBoard('day', compute);
      expect(store.size).toBe(1);
      // A new isolate: empty memory, same edge cache.
      resetBoardCache();
      await cachedBoard('day', compute);
      expect(compute).toHaveBeenCalledTimes(1);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('shares entries across locations through KV, and refreshes stale ones', async () => {
    const kv = new Map<string, string>();
    const ttls: (number | undefined)[] = [];
    const context = Symbol.for('__cloudflare-request-context__');
    (globalThis as Record<symbol, unknown>)[context] = {
      env: {
        PROMOTERS: {
          get: async (k: string) => kv.get(k) ?? null,
          put: async (k: string, v: string, o?: { expirationTtl?: number }) => {
            kv.set(k, v);
            ttls.push(o?.expirationTtl);
          },
          delete: async () => {},
          list: async () => ({ keys: [], list_complete: true }),
        },
      },
    };
    try {
      let t = Date.parse('2026-09-14T12:00:00Z');
      const opts = { ttlMs: 60_000, now: () => t };
      const compute = vi.fn(async () =>
        board('day', new Date(t).toISOString()),
      );
      await cachedBoard('day', compute, opts);
      expect(kv.size).toBe(1);
      expect(ttls[0]).toBeGreaterThanOrEqual(60);

      // Another location: empty memory and no edge cache, same KV.
      resetBoardCache();
      t += 30_000;
      await cachedBoard('day', compute, opts);
      expect(compute).toHaveBeenCalledTimes(1);

      // Past the TTL the KV copy is stale and the board is recomputed.
      resetBoardCache();
      t += 31_000;
      await cachedBoard('day', compute, opts);
      expect(compute).toHaveBeenCalledTimes(2);
    } finally {
      delete (globalThis as Record<symbol, unknown>)[context];
    }
  });

  it('still answers when KV fails', async () => {
    const context = Symbol.for('__cloudflare-request-context__');
    const broken = async () => {
      throw new Error('KV down');
    };
    (globalThis as Record<symbol, unknown>)[context] = {
      env: {
        PROMOTERS: { get: broken, put: broken, delete: broken, list: broken },
      },
    };
    try {
      const compute = vi.fn(async () => board('7d', new Date().toISOString()));
      await expect(cachedBoard('7d', compute)).resolves.toMatchObject({
        window: '7d',
      });
    } finally {
      delete (globalThis as Record<symbol, unknown>)[context];
    }
  });
});

describe('GET /api/leaderboard under load', () => {
  beforeEach(() => {
    resetMemoryPromoterStore();
    resetBoardCache();
    resetRateLimits();
    vi.stubEnv('PLAUSIBLE_API_KEY', 'key');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('spends three Plausible calls per window, not three per visitor', async () => {
    const fetchMock = vi.fn(async () => Response.json({ results: [] }));
    vi.stubGlobal('fetch', fetchMock);
    for (let i = 0; i < 25; i++) {
      const res = await GET(
        new NextRequest(
          `http://localhost/api/leaderboard?window=day&bust=${i}`,
          { headers: { 'cf-connecting-ip': `10.0.0.${i}` } },
        ),
      );
      expect(res.status).toBe(200);
    }
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('rate limits one client hammering the board', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ results: [] })),
    );
    const hit = () =>
      GET(
        new NextRequest('http://localhost/api/leaderboard?window=day', {
          headers: { 'cf-connecting-ip': '203.0.113.5' },
        }),
      );
    for (let i = 0; i < 60; i++) expect((await hit()).status).toBe(200);
    expect((await hit()).status).toBe(429);
  });
});

describe('leaderboard switched off', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('answers 404 on every leaderboard API, before any other check', async () => {
    vi.stubEnv('NEXT_PUBLIC_LEADERBOARD', 'off');
    const post = (url: string) =>
      new NextRequest(url, { method: 'POST', body: '{}' });
    const responses = await Promise.all([
      GET(new NextRequest('http://localhost/api/leaderboard?window=day')),
      listPromoters(),
      join(post('http://localhost/api/promoters')),
      status(post('http://localhost/api/promoters/status')),
      adminList(new NextRequest('http://localhost/api/admin/promoters')),
    ]);
    expect(responses.map((r) => r.status)).toEqual([404, 404, 404, 404, 404]);
  });
});
