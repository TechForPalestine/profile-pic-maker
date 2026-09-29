import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  MY_PROMOTER_STORAGE_KEY,
  clearMyPromoter,
  fetchOwnListingStatus,
  forgetSubmission,
  readMyPromoter,
  saveMyPromoter,
} from '@/lib/my-promoter';

describe('my promoter record', () => {
  let data: Map<string, string>;

  beforeEach(() => {
    data = new Map();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => data.set(k, v),
      removeItem: (k: string) => data.delete(k),
    });
  });

  afterEach(() => vi.unstubAllGlobals());

  it('round-trips the link this browser created', () => {
    expect(readMyPromoter()).toBeUndefined();
    saveMyPromoter({
      code: 'paul-biggar-7k2q',
      displayName: 'Paul Biggar',
      createdAt: '2026-09-17T10:00:00.000Z',
    });
    expect(readMyPromoter()).toEqual({
      code: 'paul-biggar-7k2q',
      displayName: 'Paul Biggar',
      createdAt: '2026-09-17T10:00:00.000Z',
      submittedAt: undefined,
    });
    clearMyPromoter();
    expect(readMyPromoter()).toBeUndefined();
  });

  it('ignores a tampered record', () => {
    data.set(
      MY_PROMOTER_STORAGE_KEY,
      JSON.stringify({ code: '<img>', displayName: 'x' }),
    );
    expect(readMyPromoter()).toBeUndefined();
    data.set(MY_PROMOTER_STORAGE_KEY, 'not json');
    expect(readMyPromoter()).toBeUndefined();
  });

  it('survives blocked storage', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
      removeItem: () => {
        throw new Error('blocked');
      },
    });
    expect(() =>
      saveMyPromoter({ code: 'paul-7k2q', displayName: 'Paul', createdAt: '' }),
    ).not.toThrow();
    expect(readMyPromoter()).toBeUndefined();
    expect(() => clearMyPromoter()).not.toThrow();
  });
});

describe('fetchOwnListingStatus', () => {
  const base = {
    code: 'paul-7k2q',
    displayName: 'Paul',
    createdAt: '2026-09-25T10:00:00.000Z',
  };
  const ownerKey = 'a'.repeat(48);

  afterEach(() => vi.unstubAllGlobals());

  it('does not call the server for a link that was never submitted', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    expect(await fetchOwnListingStatus(base)).toBe('not-sent');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('treats a submission without an owner key as lost', async () => {
    expect(
      await fetchOwnListingStatus({ ...base, submittedAt: base.createdAt }),
    ).toBe('none');
  });

  it('sends the code and owner key in a POST body, never the URL', async () => {
    const fetchMock = vi.fn(async () => Response.json({ status: 'rejected' }));
    vi.stubGlobal('fetch', fetchMock);
    const status = await fetchOwnListingStatus({
      ...base,
      submittedAt: base.createdAt,
      ownerKey,
    });
    expect(status).toBe('rejected');
    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe('/api/promoters/status');
    expect(url).not.toContain(ownerKey);
    expect(init.method).toBe('POST');
    expect(JSON.parse(String(init.body))).toEqual({
      code: 'paul-7k2q',
      ownerKey,
    });
  });

  it('reports unknown when the server cannot be reached or answers oddly', async () => {
    const submitted = { ...base, submittedAt: base.createdAt, ownerKey };
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('offline');
      }),
    );
    expect(await fetchOwnListingStatus(submitted)).toBe('unknown');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('busy', { status: 429 })),
    );
    expect(await fetchOwnListingStatus(submitted)).toBe('unknown');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ status: 'weird' })),
    );
    expect(await fetchOwnListingStatus(submitted)).toBe('unknown');
  });
});

describe('forgetSubmission', () => {
  let data: Map<string, string>;
  beforeEach(() => {
    data = new Map();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => data.set(k, v),
      removeItem: (k: string) => data.delete(k),
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('keeps the link but drops the lost request and its key', () => {
    const next = forgetSubmission({
      code: 'paul-7k2q',
      displayName: 'Paul',
      createdAt: '2026-09-25T10:00:00.000Z',
      submittedAt: '2026-09-25T10:05:00.000Z',
      ownerKey: 'a'.repeat(48),
    });
    expect(next.code).toBe('paul-7k2q');
    expect(next.submittedAt).toBeUndefined();
    expect(next.ownerKey).toBeUndefined();
    expect(readMyPromoter()).toMatchObject({
      code: 'paul-7k2q',
      submittedAt: undefined,
      ownerKey: undefined,
    });
  });
});
