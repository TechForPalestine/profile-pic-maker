import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { constantTimeEqual, isAuthorized } from '@/lib/admin-auth';
import {
  createBindingKvClient,
  createMemoryKvClient,
  kvBinding,
  type KvNamespaceBinding,
} from '@/lib/cloudflare-bindings';
import {
  MAX_PENDING,
  createPromoterStore,
  getPromoterStore,
  isValidDisplayName,
  linkPlatform,
  normalizeLink,
  promoterStorage,
  resetMemoryPromoterStore,
  toPublicPromoter,
  validateJoinRequest,
  type Promoter,
} from '@/lib/promoters';
import {
  GET as adminGet,
  POST as adminPost,
} from '@/app/api/admin/promoters/route';
import { GET as publicGet, POST as join } from '@/app/api/promoters/route';
import { POST as statusPost } from '@/app/api/promoters/status/route';
import { resetRateLimits } from '@/lib/rate-limit';

const ADMIN_TOKEN = 'a-very-long-admin-token-for-tests';

const validBody = {
  code: 'paul',
  displayName: 'Paul Biggar',
  link: 'x.com/paulbiggar',
};

const jsonRequest = (
  url: string,
  body: unknown,
  headers: Record<string, string> = {},
) =>
  new NextRequest(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });

const adminHeaders = { authorization: `Bearer ${ADMIN_TOKEN}` };

async function approve(code: string) {
  const res = await adminPost(
    jsonRequest(
      'http://localhost/api/admin/promoters',
      { action: 'approve', code },
      adminHeaders,
    ),
  );
  expect(res.status).toBe(200);
}

describe('validateJoinRequest', () => {
  it('accepts a well-formed request and normalizes it', () => {
    const result = validateJoinRequest({
      ...validBody,
      displayName: '  Paul   Biggar ',
      link: ' x.com/paulbiggar#top ',
      referredBy: 'zaher',
    });
    expect(result).toEqual({
      ok: true,
      value: {
        code: 'paul',
        displayName: 'Paul Biggar',
        link: 'https://x.com/paulbiggar',
        referredBy: 'zaher',
      },
    });
  });

  it('treats the link as optional', () => {
    for (const link of [undefined, '', '   ', null]) {
      const result = validateJoinRequest({ ...validBody, link });
      expect(result).toMatchObject({ ok: true });
      expect(result.ok && result.value.link).toBeUndefined();
    }
  });

  it('rejects a link that is not a web address', () => {
    for (const link of [
      'javascript:alert(1)',
      'ftp://x.com/paul',
      'not a url',
      'localhost',
    ]) {
      expect(validateJoinRequest({ ...validBody, link }).ok).toBe(false);
    }
  });

  it('rejects reserved and malformed codes', () => {
    for (const code of ['share-x', 'ch-news', 'admin', 'Paul', 'ab']) {
      const result = validateJoinRequest({ ...validBody, code });
      expect(result.ok).toBe(false);
    }
  });

  it('rejects display names with markup or nothing but punctuation', () => {
    expect(isValidDisplayName('Zoë Ñ. O’Brien')).toBe(true);
    expect(isValidDisplayName('محمد')).toBe(true);
    expect(isValidDisplayName('<b>Paul</b>')).toBe(false);
    expect(isValidDisplayName('...')).toBe(false);
    expect(isValidDisplayName('P')).toBe(false);
    expect(isValidDisplayName('x'.repeat(41))).toBe(false);
  });

  it('will not let a person refer themselves', () => {
    expect(validateJoinRequest({ ...validBody, referredBy: 'paul' }).ok).toBe(
      false,
    );
  });
});

describe('normalizeLink', () => {
  it('accepts any https website', () => {
    expect(normalizeLink('https://www.twitter.com/paul')).toBe(
      'https://www.twitter.com/paul',
    );
    expect(normalizeLink('https://paulbiggar.com/')).toBe(
      'https://paulbiggar.com/',
    );
  });

  it('fills in https:// when it is left out, and upgrades http://', () => {
    expect(normalizeLink('mostafazh.me')).toBe('https://mostafazh.me/');
    expect(normalizeLink('x.com/paul')).toBe('https://x.com/paul');
    expect(normalizeLink('//instagram.com/paul')).toBe(
      'https://instagram.com/paul',
    );
    expect(normalizeLink('http://x.com/paul')).toBe('https://x.com/paul');
    expect(normalizeLink('HTTP://x.com/paul')).toBe('https://x.com/paul');
  });

  it('rejects other schemes, credentials, bare hosts and oversized values', () => {
    expect(normalizeLink('javascript:alert(1)')).toBeUndefined();
    expect(normalizeLink('data:text/html,hi')).toBeUndefined();
    expect(normalizeLink('https://user:pw@x.com/paul')).toBeUndefined();
    expect(normalizeLink('localhost')).toBeUndefined();
    expect(normalizeLink('https://localhost/')).toBeUndefined();
    expect(normalizeLink(`https://a.com/${'x'.repeat(300)}`)).toBeUndefined();
  });
});

describe('linkPlatform', () => {
  it('recognises platforms by host, subdomains included, for the icon', () => {
    expect(linkPlatform('https://x.com/paul')).toBe('x');
    expect(linkPlatform('https://twitter.com/paul')).toBe('x');
    expect(linkPlatform('https://www.instagram.com/paul')).toBe('instagram');
    expect(linkPlatform('https://youtu.be/abc')).toBe('youtube');
    expect(linkPlatform('https://mostafazh.me/')).toBe('website');
    // A lookalike host is just a website.
    expect(linkPlatform('https://x.com.evil.example/paul')).toBe('website');
  });
});

describe('promoter store', () => {
  it('serves approved entries from one document and rebuilds it', async () => {
    const kv = createMemoryKvClient();
    const store = createPromoterStore(kv);
    const base = { createdAt: '2026-01-01T00:00:00.000Z' };
    await store.put({
      ...base,
      code: 'a',
      displayName: 'A',
      status: 'approved',
    });
    await store.put({
      ...base,
      code: 'b',
      displayName: 'B',
      status: 'pending',
    });
    expect(await store.listApproved()).toEqual([]);
    const approved = await store.rebuildApproved();
    expect(approved.map((p) => p.code)).toEqual(['a']);
    expect((await store.listApproved()).map((p) => p.code)).toEqual(['a']);
    expect((await store.list()).map((p) => p.code)).toEqual(['a', 'b']);
  });

  it('counts recruits for the public shape', () => {
    const approved: Promoter[] = [
      {
        code: 'a',
        displayName: 'A',
        link: 'https://a.example/',
        status: 'approved',
        createdAt: '',
      },
      {
        code: 'b',
        displayName: 'B',
        status: 'approved',
        createdAt: '',
        referredBy: 'a',
      },
    ];
    expect(toPublicPromoter(approved[0], approved)).toEqual({
      code: 'a',
      displayName: 'A',
      link: 'https://a.example/',
      recruits: 1,
    });
  });

  it('reads entries saved with per-platform links as a single link', async () => {
    const kv = createMemoryKvClient({
      'promoter:old': JSON.stringify({
        code: 'old',
        displayName: 'Old',
        links: { instagram: 'https://instagram.com/old' },
        status: 'approved',
        createdAt: '',
      }),
    });
    const entry = await createPromoterStore(kv).get('old');
    expect(entry?.link).toBe('https://instagram.com/old');
    expect(entry).not.toHaveProperty('links');
  });
});

describe('KV binding', () => {
  /** A fake of the Workers KV binding with paginated list(). */
  const fakeNamespace = (): KvNamespaceBinding & {
    data: Map<string, string>;
  } => {
    const data = new Map<string, string>();
    return {
      data,
      get: async (key) => data.get(key) ?? null,
      put: async (key, value) => {
        data.set(key, value);
      },
      delete: async (key) => {
        data.delete(key);
      },
      list: async ({ prefix = '', cursor, limit = 1000 }) => {
        const keys = [...data.keys()]
          .filter((k) => k.startsWith(prefix))
          .sort();
        const start = cursor ? Number(cursor) : 0;
        const page = keys.slice(start, start + Math.min(limit, 2));
        const next = start + page.length;
        return {
          keys: page.map((name) => ({ name })),
          list_complete: next >= keys.length,
          cursor: next >= keys.length ? undefined : String(next),
        };
      },
    };
  };

  afterEach(() => {
    delete (globalThis as Record<symbol, unknown>)[
      Symbol.for('__cloudflare-request-context__')
    ];
  });

  it('reads and writes through the binding, following list pagination', async () => {
    const ns = fakeNamespace();
    const kv = createBindingKvClient(ns);
    for (const code of ['a', 'b', 'c', 'd', 'e']) {
      await kv.put(`promoter:${code}`, code);
    }
    await kv.put('approved', '[]');
    expect(await kv.get('promoter:c')).toBe('c');
    expect(await kv.listKeys('promoter:')).toEqual([
      'promoter:a',
      'promoter:b',
      'promoter:c',
      'promoter:d',
      'promoter:e',
    ]);
    await kv.delete('promoter:a');
    expect(await kv.get('promoter:a')).toBeNull();
  });

  it('uses the PROMOTERS binding from the Pages request context', async () => {
    expect(kvBinding()).toBeUndefined();
    expect(promoterStorage()).toBe('memory');

    const ns = fakeNamespace();
    (globalThis as Record<symbol, unknown>)[
      Symbol.for('__cloudflare-request-context__')
    ] = { env: { PROMOTERS: ns } };
    expect(kvBinding()).toBe(ns);
    expect(promoterStorage()).toBe('kv');

    await getPromoterStore().put({
      code: 'paul',
      displayName: 'Paul',
      status: 'pending',
      createdAt: '',
    });
    expect(ns.data.has('promoter:paul')).toBe(true);
  });
});

describe('admin auth', () => {
  it('compares in constant time and needs a real token', () => {
    expect(constantTimeEqual('abc', 'abc')).toBe(true);
    expect(constantTimeEqual('abc', 'abd')).toBe(false);
    expect(constantTimeEqual('abc', 'abcd')).toBe(false);
    expect(isAuthorized(`Bearer ${ADMIN_TOKEN}`, ADMIN_TOKEN)).toBe(true);
    expect(isAuthorized(`Bearer nope`, ADMIN_TOKEN)).toBe(false);
    expect(isAuthorized(ADMIN_TOKEN, ADMIN_TOKEN)).toBe(false);
    expect(isAuthorized(`Bearer short`, 'short')).toBe(false);
    expect(isAuthorized(`Bearer `, undefined)).toBe(false);
  });
});

describe('join and approval flow (memory store)', () => {
  beforeEach(() => {
    resetMemoryPromoterStore();
    resetRateLimits();
    vi.stubEnv('ADMIN_TOKEN', ADMIN_TOKEN);
    vi.stubEnv('TURNSTILE_SECRET', '');
    vi.stubEnv('LEADERBOARD_JOIN_ENABLED', '');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('lands a request as pending, hides it publicly, and publishes it once approved', async () => {
    const created = await join(
      jsonRequest('http://localhost/api/promoters', validBody),
    );
    expect(created.status).toBe(201);

    const before = await publicGet();
    await expect(before.json()).resolves.toEqual({ promoters: [] });

    const listed = await adminGet(
      new NextRequest('http://localhost/api/admin/promoters', {
        headers: adminHeaders,
      }),
    );
    const registry = (await listed.json()) as { pending: Promoter[] };
    expect(registry.pending.map((p) => p.code)).toEqual(['paul']);

    await approve('paul');

    const after = await publicGet();
    expect(after.headers.get('cache-control')).toContain('s-maxage=300');
    await expect(after.json()).resolves.toEqual({
      promoters: [
        {
          code: 'paul',
          displayName: 'Paul Biggar',
          link: 'https://x.com/paulbiggar',
          recruits: 0,
        },
      ],
    });
  });

  it('credits a recruit whatever order the two are approved in', async () => {
    await join(jsonRequest('http://localhost/api/promoters', validBody));
    await join(
      jsonRequest('http://localhost/api/promoters', {
        code: 'zaher',
        displayName: 'Zaher',
        link: 'instagram.com/zaher',
        referredBy: 'paul',
      }),
    );
    // Zaher is approved while Paul is still pending: nothing public yet.
    await approve('zaher');
    const before = (await (await publicGet()).json()) as {
      promoters: { code: string; recruits: number }[];
    };
    expect(before.promoters.map((p) => p.code)).toEqual(['zaher']);

    // Once Paul is approved too, the credit shows up.
    await approve('paul');
    const after = (await (await publicGet()).json()) as {
      promoters: { code: string; recruits: number }[];
    };
    expect(after.promoters.find((p) => p.code === 'paul')?.recruits).toBe(1);
  });

  it('rejects duplicates, bad bodies, and unauthorized admin calls', async () => {
    await join(jsonRequest('http://localhost/api/promoters', validBody));
    const dup = await join(
      jsonRequest('http://localhost/api/promoters', validBody),
    );
    expect(dup.status).toBe(409);

    const bad = await join(
      jsonRequest('http://localhost/api/promoters', { code: 'x' }),
    );
    expect(bad.status).toBe(400);

    const noAuth = await adminGet(
      new NextRequest('http://localhost/api/admin/promoters'),
    );
    expect(noAuth.status).toBe(401);

    const unknown = await adminPost(
      jsonRequest(
        'http://localhost/api/admin/promoters',
        { action: 'approve', code: 'ghost' },
        adminHeaders,
      ),
    );
    expect(unknown.status).toBe(404);
  });

  it('pulls an approved entry back into review without losing it', async () => {
    await join(jsonRequest('http://localhost/api/promoters', validBody));
    await approve('paul');
    const res = await adminPost(
      jsonRequest(
        'http://localhost/api/admin/promoters',
        { action: 'unapprove', code: 'paul' },
        adminHeaders,
      ),
    );
    expect(res.status).toBe(200);
    await expect((await publicGet()).json()).resolves.toEqual({
      promoters: [],
    });
    const listed = await adminGet(
      new NextRequest('http://localhost/api/admin/promoters', {
        headers: adminHeaders,
      }),
    );
    const registry = (await listed.json()) as { pending: Promoter[] };
    expect(registry.pending.map((p) => p.code)).toEqual(['paul']);
    // And it can go straight back up.
    await approve('paul');
    const { promoters } = (await (await publicGet()).json()) as {
      promoters: { code: string }[];
    };
    expect(promoters.map((p) => p.code)).toEqual(['paul']);
  });

  it('edits an approved entry in place and the public read follows', async () => {
    await join(jsonRequest('http://localhost/api/promoters', validBody));
    await approve('paul');
    const res = await adminPost(
      jsonRequest(
        'http://localhost/api/admin/promoters',
        {
          action: 'edit',
          code: 'paul',
          displayName: '  Paul  B. ',
          link: 'paul.example',
        },
        adminHeaders,
      ),
    );
    expect(res.status).toBe(200);
    const { promoter } = (await res.json()) as { promoter: Promoter };
    expect(promoter.status).toBe('approved');
    expect(promoter.displayName).toBe('Paul B.');
    await expect((await publicGet()).json()).resolves.toEqual({
      promoters: [
        {
          code: 'paul',
          displayName: 'Paul B.',
          link: 'https://paul.example/',
          recruits: 0,
        },
      ],
    });
  });

  it('removes the link when an approver clears it', async () => {
    await join(jsonRequest('http://localhost/api/promoters', validBody));
    const res = await adminPost(
      jsonRequest(
        'http://localhost/api/admin/promoters',
        { action: 'edit', code: 'paul', link: '' },
        adminHeaders,
      ),
    );
    expect(res.status).toBe(200);
    const { promoter } = (await res.json()) as { promoter: Promoter };
    expect(promoter).not.toHaveProperty('link');
  });

  it('refuses an edit with a bad name or a link that is not a web address', async () => {
    await join(jsonRequest('http://localhost/api/promoters', validBody));
    const badName = await adminPost(
      jsonRequest(
        'http://localhost/api/admin/promoters',
        { action: 'edit', code: 'paul', displayName: '<b>x</b>' },
        adminHeaders,
      ),
    );
    expect(badName.status).toBe(400);
    const badLink = await adminPost(
      jsonRequest(
        'http://localhost/api/admin/promoters',
        { action: 'edit', code: 'paul', link: 'javascript:alert(1)' },
        adminHeaders,
      ),
    );
    expect(badLink.status).toBe(400);
    // Nothing changed.
    const listed = await adminGet(
      new NextRequest('http://localhost/api/admin/promoters', {
        headers: adminHeaders,
      }),
    );
    const registry = (await listed.json()) as { pending: Promoter[] };
    expect(registry.pending[0].displayName).toBe('Paul Biggar');
  });

  it('tells only the browser that sent a request where it stands', async () => {
    const status = async (code: string, ownerKey: string) => {
      const res = await statusPost(
        jsonRequest('http://localhost/api/promoters/status', {
          code,
          ownerKey,
        }),
      );
      expect(res.headers.get('cache-control')).toBe('no-store');
      return ((await res.json()) as { status: string }).status;
    };
    const stranger = 'f'.repeat(48);

    expect(await status('paul', stranger)).toBe('none');

    const created = await join(
      jsonRequest('http://localhost/api/promoters', validBody),
    );
    const { ownerKey } = (await created.json()) as { ownerKey: string };
    expect(ownerKey).toMatch(/^[0-9a-f]{48}$/);

    expect(await status('paul', ownerKey)).toBe('pending');
    // Someone who only knows the public code learns nothing.
    expect(await status('paul', stranger)).toBe('none');

    await approve('paul');
    expect(await status('paul', ownerKey)).toBe('approved');
    await adminPost(
      jsonRequest(
        'http://localhost/api/admin/promoters',
        { action: 'reject', code: 'paul' },
        adminHeaders,
      ),
    );
    expect(await status('paul', ownerKey)).toBe('rejected');

    const bad = await statusPost(
      jsonRequest('http://localhost/api/promoters/status', {
        code: '<b>',
        ownerKey,
      }),
    );
    expect(bad.status).toBe(400);
  });

  it('tells approvers which storage the deployment is using', async () => {
    const listed = await adminGet(
      new NextRequest('http://localhost/api/admin/promoters', {
        headers: adminHeaders,
      }),
    );
    expect(((await listed.json()) as { storage: string }).storage).toBe(
      'memory',
    );
  });

  it('never shows the owner key hash to approvers or the public', async () => {
    await join(jsonRequest('http://localhost/api/promoters', validBody));
    const listed = await adminGet(
      new NextRequest('http://localhost/api/admin/promoters', {
        headers: adminHeaders,
      }),
    );
    expect(JSON.stringify(await listed.json())).not.toContain('ownerKeyHash');
    await approve('paul');
    expect(JSON.stringify(await (await publicGet()).json())).not.toContain(
      'ownerKeyHash',
    );
  });

  it('rate limits join requests per IP', async () => {
    const from = (ip: string, i: number) =>
      join(
        jsonRequest(
          'http://localhost/api/promoters',
          { ...validBody, code: `limit-${ip.split('.').join('')}-${i}` },
          { 'cf-connecting-ip': ip },
        ),
      );
    for (let i = 0; i < 5; i++) {
      expect((await from('203.0.113.9', i)).status).toBe(201);
    }
    const sixth = await from('203.0.113.9', 5);
    expect(sixth.status).toBe(429);
    expect(Number(sixth.headers.get('retry-after'))).toBeGreaterThan(0);
    // A different client is unaffected.
    expect((await from('198.51.100.7', 0)).status).toBe(201);
  });

  it('takes an approved entry down again', async () => {
    await join(jsonRequest('http://localhost/api/promoters', validBody));
    await approve('paul');
    const res = await adminPost(
      jsonRequest(
        'http://localhost/api/admin/promoters',
        { action: 'reject', code: 'paul' },
        adminHeaders,
      ),
    );
    expect(res.status).toBe(200);
    await expect((await publicGet()).json()).resolves.toEqual({
      promoters: [],
    });
  });

  it('enforces the bot check when a Turnstile secret is configured', async () => {
    vi.stubEnv('TURNSTILE_SECRET', 'secret');
    const fetchMock = vi.fn(async () => Response.json({ success: false }));
    vi.stubGlobal('fetch', fetchMock);
    const res = await join(
      jsonRequest('http://localhost/api/promoters', {
        ...validBody,
        turnstileToken: 'bad',
      }),
    );
    expect(res.status).toBe(403);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('can be paused with the kill switch', async () => {
    vi.stubEnv('LEADERBOARD_JOIN_ENABLED', 'false');
    const res = await join(
      jsonRequest('http://localhost/api/promoters', validBody),
    );
    expect(res.status).toBe(503);
  });

  it('stops accepting requests once the queue is full', async () => {
    // One client per request, so the per-IP rate limit stays out of the way
    // and this exercises the queue cap alone.
    const ip = (i: number) =>
      `10.${(i >> 16) & 255}.${(i >> 8) & 255}.${i & 255}`;
    for (let i = 0; i < MAX_PENDING; i++) {
      const res = await join(
        jsonRequest(
          'http://localhost/api/promoters',
          { ...validBody, code: `promoter-${i}` },
          { 'cf-connecting-ip': ip(i) },
        ),
      );
      expect(res.status).toBe(201);
    }
    const res = await join(
      jsonRequest('http://localhost/api/promoters', validBody, {
        'cf-connecting-ip': ip(MAX_PENDING),
      }),
    );
    expect(res.status).toBe(429);
    expect(JSON.stringify(await res.json())).toContain('waiting for review');
  });
});
