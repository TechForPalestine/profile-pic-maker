import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { APP_URL } from '@/lib/share';
import {
  CHANNEL_PREFIX,
  REFERRER_NONE,
  REFERRER_STORAGE_KEY,
  REFERRER_TTL_MS,
  RESERVED_CODES,
  currentReferrer,
  hashReferralCode,
  isChannelCode,
  isPromoterCode,
  isReferralCode,
  readReferralCode,
  referralLink,
  referrerProp,
  rememberReferrer,
  slugifyDisplayName,
} from '@/lib/referral';

// A minimal localStorage: the referral module only needs get/set/remove, and a
// plain map keeps every test's state isolated.
function fakeStorage(throwing = false) {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => {
      if (throwing) throw new Error('blocked');
      return data.get(key) ?? null;
    },
    setItem: (key: string, value: string) => {
      if (throwing) throw new Error('blocked');
      data.set(key, value);
    },
    removeItem: (key: string) => data.delete(key),
    data,
  };
}

describe('referral code grammar', () => {
  it('accepts short lowercase slugs', () => {
    for (const code of ['paul', 'zaher-t4p', 'mighty-missions-2', 'ab1']) {
      expect(isReferralCode(code)).toBe(true);
      expect(isPromoterCode(code)).toBe(true);
    }
  });

  it('rejects anything that could not be typed off a screenshot', () => {
    for (const code of [
      'ab',
      'Paul',
      '-paul',
      'pa ul',
      'paul_t4p',
      'x'.repeat(25),
      '<b>hi</b>',
      '',
      undefined,
      42,
    ]) {
      expect(isReferralCode(code)).toBe(false);
      expect(isPromoterCode(code)).toBe(false);
    }
  });

  it('keeps the share buttons, channel links and system words out of promoter codes', () => {
    expect(isPromoterCode('share-whatsapp')).toBe(false);
    expect(isPromoterCode(`${CHANNEL_PREFIX}newsletter`)).toBe(false);
    expect(isChannelCode(`${CHANNEL_PREFIX}newsletter`)).toBe(true);
    for (const word of RESERVED_CODES) {
      expect(isPromoterCode(word)).toBe(false);
    }
  });
});

describe('hashReferralCode', () => {
  it('is a 12-hex fingerprint that does not reveal the code', async () => {
    const hash = await hashReferralCode('paul');
    expect(hash).toMatch(/^[0-9a-f]{12}$/);
    expect(hash).not.toContain('paul');
  });
});

describe('slugifyDisplayName', () => {
  it('turns a display name into a valid code', () => {
    expect(slugifyDisplayName('Paul Biggar')).toBe('paul-biggar');
    expect(slugifyDisplayName("  Zoë Ñ. O'Brien ")).toBe('zoe-n-o-brien');
    expect(isPromoterCode(slugifyDisplayName('Paul Biggar'))).toBe(true);
  });

  it('never exceeds the code length and never ends in a hyphen', () => {
    const slug = slugifyDisplayName(
      'a very long display name that keeps going',
    );
    expect(slug.length).toBeLessThanOrEqual(24);
    expect(slug.endsWith('-')).toBe(false);
    expect(isReferralCode(slug)).toBe(true);
  });

  it('comes back empty for names with no Latin letters or digits', () => {
    expect(slugifyDisplayName('فلسطين')).toBe('');
  });
});

describe('referralLink / readReferralCode', () => {
  it('builds the link on the canonical app URL', () => {
    expect(referralLink('paul')).toBe(`${APP_URL}?ref=paul`);
  });

  it('reads promoter and channel codes off a landing URL', () => {
    expect(readReferralCode('?ref=paul')).toBe('paul');
    expect(readReferralCode('?utm_medium=x&ref=ch-newsletter')).toBe(
      'ch-newsletter',
    );
  });

  it('ignores share-button refs, malformed refs and missing refs', () => {
    expect(readReferralCode('?ref=share-whatsapp')).toBeUndefined();
    expect(readReferralCode('?ref=Paul')).toBeUndefined();
    expect(readReferralCode('?ref=%3Cscript%3E')).toBeUndefined();
    expect(readReferralCode('')).toBeUndefined();
  });
});

describe('remembered referrer', () => {
  const now = 1_700_000_000_000;
  let storage: ReturnType<typeof fakeStorage>;

  beforeEach(() => {
    storage = fakeStorage();
    vi.stubGlobal('localStorage', storage);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('starts out with no referrer', () => {
    expect(currentReferrer(now)).toBeUndefined();
    expect(referrerProp(now)).toBe(REFERRER_NONE);
  });

  it('remembers the first code and reports it as the prop', () => {
    expect(rememberReferrer('paul', now)).toBe('paul');
    expect(currentReferrer(now)).toBe('paul');
    expect(referrerProp(now)).toBe('paul');
    expect(JSON.parse(storage.data.get(REFERRER_STORAGE_KEY)!)).toEqual({
      code: 'paul',
      at: now,
    });
  });

  it('keeps the first touch when a second link is opened', () => {
    rememberReferrer('paul', now);
    expect(rememberReferrer('zaher', now + 1000)).toBe('paul');
    expect(currentReferrer(now + 1000)).toBe('paul');
  });

  it('expires after the TTL and lets a new code take over', () => {
    rememberReferrer('paul', now);
    const later = now + REFERRER_TTL_MS + 1;
    expect(currentReferrer(later)).toBeUndefined();
    expect(rememberReferrer('zaher', later)).toBe('zaher');
  });

  it('never stores a share ref or a malformed code', () => {
    expect(rememberReferrer('share-whatsapp', now)).toBeUndefined();
    expect(rememberReferrer('Paul', now)).toBeUndefined();
    expect(storage.data.size).toBe(0);
  });

  it('treats a corrupt stored value as no referrer', () => {
    storage.data.set(REFERRER_STORAGE_KEY, '{not json');
    expect(currentReferrer(now)).toBeUndefined();
    storage.data.set(
      REFERRER_STORAGE_KEY,
      JSON.stringify({ code: '<img>', at: now }),
    );
    expect(currentReferrer(now)).toBeUndefined();
  });

  it('survives blocked storage without throwing', () => {
    vi.stubGlobal('localStorage', fakeStorage(true));
    expect(() => rememberReferrer('paul', now)).not.toThrow();
    expect(referrerProp(now)).toBe(REFERRER_NONE);
  });
});
