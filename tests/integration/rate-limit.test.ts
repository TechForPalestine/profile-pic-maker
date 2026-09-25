import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it } from 'vitest';

import { clientIp, rateLimit, resetRateLimits } from '@/lib/rate-limit';

const req = (headers: Record<string, string> = {}) =>
  new NextRequest('http://localhost/api/x', { headers });

describe('clientIp', () => {
  it('prefers the platform headers over anything the client can write', () => {
    expect(
      clientIp(
        req({ 'cf-connecting-ip': '1.1.1.1', 'x-forwarded-for': '9.9.9.9' }),
      ),
    ).toBe('1.1.1.1');
    expect(
      clientIp(req({ 'x-real-ip': '2.2.2.2', 'x-forwarded-for': '9.9.9.9' })),
    ).toBe('2.2.2.2');
    // Right-most hop is the one the nearest proxy added.
    expect(clientIp(req({ 'x-forwarded-for': '6.6.6.6, 3.3.3.3' }))).toBe(
      '3.3.3.3',
    );
    expect(clientIp(req())).toBe('unknown');
  });
});

describe('rateLimit', () => {
  beforeEach(() => resetRateLimits());

  it('allows the limit, then answers 429 until the window resets', () => {
    const r = req({ 'cf-connecting-ip': '1.1.1.1' });
    const rule = { name: 't', limit: 2, windowMs: 1000 };
    expect(rateLimit(r, rule, 0)).toBeUndefined();
    expect(rateLimit(r, rule, 10)).toBeUndefined();
    const blocked = rateLimit(r, rule, 20);
    expect(blocked?.status).toBe(429);
    expect(blocked?.headers.get('retry-after')).toBe('1');
    expect(rateLimit(r, rule, 1000)).toBeUndefined();
  });

  it('keeps routes and clients in separate buckets', () => {
    const a = req({ 'cf-connecting-ip': '1.1.1.1' });
    const b = req({ 'cf-connecting-ip': '2.2.2.2' });
    expect(rateLimit(a, { name: 'one', limit: 1 }, 0)).toBeUndefined();
    expect(rateLimit(a, { name: 'two', limit: 1 }, 0)).toBeUndefined();
    expect(rateLimit(b, { name: 'one', limit: 1 }, 0)).toBeUndefined();
    expect(rateLimit(a, { name: 'one', limit: 1 }, 0)?.status).toBe(429);
  });
});
