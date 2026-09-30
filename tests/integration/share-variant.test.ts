import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ensureMyPromoter, readMyPromoter } from '@/lib/my-promoter';
import { ownDownloads, reachCopy } from '@/lib/my-reach';
import {
  hashReferralCode,
  isPromoterCode,
  personalShareUrl,
  referralLink,
} from '@/lib/referral';
import { buildShareLinks, shareCaption } from '@/lib/share';
import {
  SHARE_VARIANT_STORAGE_KEY,
  assignShareVariant,
  shareVariant,
  shareVariantMode,
} from '@/lib/share-variant';

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

describe('shareVariantMode', () => {
  it('defaults to classic for anything it does not know', () => {
    expect(shareVariantMode(undefined)).toBe('classic');
    expect(shareVariantMode('LINK-FIRST')).toBe('classic');
    expect(shareVariantMode('link-first')).toBe('link-first');
    expect(shareVariantMode('split')).toBe('split');
  });
});

describe('assignShareVariant', () => {
  it('follows a fixed mode without storing anything', () => {
    expect(assignShareVariant({ mode: 'link-first', enabled: true })).toBe(
      'link-first',
    );
    expect(assignShareVariant({ mode: 'classic', enabled: true })).toBe(
      'classic',
    );
    expect(data.has(SHARE_VARIANT_STORAGE_KEY)).toBe(false);
  });

  it('splits once per browser and keeps the assignment', () => {
    const first = assignShareVariant({
      mode: 'split',
      enabled: true,
      random: () => 0.9,
    });
    expect(first).toBe('link-first');
    // A later draw that would land on the other side changes nothing.
    expect(
      assignShareVariant({ mode: 'split', enabled: true, random: () => 0.1 }),
    ).toBe('link-first');
    expect(shareVariant({ mode: 'split', enabled: true })).toBe('link-first');
  });

  it('draws both sides of the split', () => {
    expect(
      assignShareVariant({ mode: 'split', enabled: true, random: () => 0.1 }),
    ).toBe('classic');
  });

  it('ignores a stored split assignment once the test is over', () => {
    assignShareVariant({ mode: 'split', enabled: true, random: () => 0.9 });
    expect(assignShareVariant({ mode: 'classic', enabled: true })).toBe(
      'classic',
    );
  });

  it('lets ?share= force a variant that sticks, whatever the mode', () => {
    expect(
      assignShareVariant({
        search: '?share=link-first',
        mode: 'classic',
        enabled: true,
      }),
    ).toBe('link-first');
    expect(assignShareVariant({ mode: 'classic', enabled: true })).toBe(
      'link-first',
    );
    expect(
      assignShareVariant({
        search: '?share=classic',
        mode: 'link-first',
        enabled: true,
      }),
    ).toBe('classic');
  });

  it('ignores an unknown ?share= value', () => {
    expect(
      assignShareVariant({
        search: '?share=bogus',
        mode: 'classic',
        enabled: true,
      }),
    ).toBe('classic');
  });

  it('is always classic while the leaderboard is off', () => {
    expect(
      assignShareVariant({
        search: '?share=link-first',
        mode: 'link-first',
        enabled: false,
      }),
    ).toBe('classic');
    expect(shareVariant({ mode: 'link-first', enabled: false })).toBe(
      'classic',
    );
  });

  it('survives blocked storage', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    });
    expect(
      assignShareVariant({ mode: 'split', enabled: true, random: () => 0.9 }),
    ).toBe('link-first');
  });
});

describe('ensureMyPromoter', () => {
  it('makes an anonymous link once and then returns it', () => {
    const first = ensureMyPromoter(new Date('2026-09-29T10:00:00Z'), () => 0);
    expect(first.created).toBe(true);
    expect(first.promoter.displayName).toBe('');
    expect(first.promoter.code).toMatch(/^pal-[a-z0-9]{6}$/);
    expect(isPromoterCode(first.promoter.code)).toBe(true);
    expect(readMyPromoter()?.code).toBe(first.promoter.code);

    const again = ensureMyPromoter();
    expect(again.created).toBe(false);
    expect(again.promoter.code).toBe(first.promoter.code);
  });

  it('keeps a link made on the join page', () => {
    data.set(
      'ppm-my-promoter',
      JSON.stringify({
        code: 'paul-biggar-7k2q',
        displayName: 'Paul Biggar',
        createdAt: '2026-09-17T10:00:00.000Z',
      }),
    );
    const { promoter, created } = ensureMyPromoter();
    expect(created).toBe(false);
    expect(promoter.code).toBe('paul-biggar-7k2q');
  });
});

describe('personal share links', () => {
  it('credits the code and keeps the channel as utm_medium', () => {
    expect(personalShareUrl('pal-abc123', 'whatsapp')).toBe(
      `${referralLink('pal-abc123')}&utm_medium=share-whatsapp`,
    );
    expect(personalShareUrl('pal-abc123', 'system', 'story')).toBe(
      `${referralLink('pal-abc123')}&utm_medium=share-system-story`,
    );
  });

  it('flows into every link-out and caption', () => {
    const landing = (
      channel: Parameters<typeof personalShareUrl>[1],
      format?: Parameters<typeof personalShareUrl>[2],
    ) => personalShareUrl('pal-abc123', channel, format);
    for (const { href } of buildShareLinks(landing)) {
      expect(decodeURIComponent(href)).toContain('ref=pal-abc123');
      expect(decodeURIComponent(href)).not.toContain('ref=share-');
    }
    expect(shareCaption('copy', 'link', landing)).toContain(
      'ref=pal-abc123&utm_medium=share-copy',
    );
  });
});

describe('ownDownloads', () => {
  it('reads an approved row, then the fingerprinted counts, else zero', async () => {
    const hash = await hashReferralCode('pal-abc123');
    const promoters = [
      {
        code: 'paul-biggar-7k2q',
        displayName: 'Paul Biggar',
        recruits: 0,
        rank: 1,
        downloads: 12,
        visits: 20,
      },
    ];
    expect(
      ownDownloads({ promoters, pendingCounts: {} }, 'paul-biggar-7k2q', 'x'),
    ).toBe(12);
    expect(
      ownDownloads(
        { promoters, pendingCounts: { [hash]: { downloads: 3, visits: 5 } } },
        'pal-abc123',
        hash,
      ),
    ).toBe(3);
    expect(
      ownDownloads({ promoters, pendingCounts: {} }, 'pal-abc123', hash),
    ).toBe(0);
  });
});

describe('reachCopy', () => {
  it('explains the link until there is a number, then counts people', () => {
    expect(reachCopy(undefined)).toMatch(/counts for you/);
    expect(reachCopy(0)).toMatch(/Nobody yet/);
    expect(reachCopy(1)).toBe(
      '1 person has made their picture through your link.',
    );
    expect(reachCopy(7)).toBe(
      '7 people have made their picture through your link.',
    );
  });
});
