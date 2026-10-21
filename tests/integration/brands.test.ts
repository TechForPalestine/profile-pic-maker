import { describe, expect, it } from 'vitest';

import { resolveBrand } from '@/lib/brands';

const LINKS = JSON.stringify({
  'x7Kq-members': { brand: 't4p-member', text: { link: 'join at t4p.al/j' } },
  plain: { brand: 't4p-member' },
  messy: {
    brand: 't4p-member',
    text: { ok: 'yes', n: 1, long: 'x'.repeat(121) },
  },
  broken: { text: { link: 'no brand' } },
});

describe('resolveBrand', () => {
  it('maps a known code to its brand and text', () => {
    expect(resolveBrand('x7Kq-members', LINKS)).toEqual({
      brand: 't4p-member',
      text: { link: 'join at t4p.al/j' },
    });
    expect(resolveBrand('plain', LINKS)).toEqual({
      brand: 't4p-member',
      text: {},
    });
  });

  it('keeps only short string text', () => {
    expect(resolveBrand('messy', LINKS)?.text).toEqual({ ok: 'yes' });
  });

  it('rejects unknown, malformed and inherited keys', () => {
    for (const code of [
      'nope',
      'broken',
      '',
      null,
      'a/b',
      'constructor',
      '__proto__',
    ]) {
      expect(resolveBrand(code, LINKS)).toBeUndefined();
    }
  });

  it('is off when the secret is unset or broken', () => {
    expect(resolveBrand('plain', undefined)).toBeUndefined();
    expect(resolveBrand('plain', '{oops')).toBeUndefined();
    expect(resolveBrand('plain', '{"plain": "t4p-member"}')).toBeUndefined();
  });
});
