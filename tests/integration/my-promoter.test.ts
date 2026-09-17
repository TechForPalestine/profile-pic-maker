import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  MY_PROMOTER_STORAGE_KEY,
  clearMyPromoter,
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
