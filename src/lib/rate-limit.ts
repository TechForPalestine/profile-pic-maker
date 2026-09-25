import { NextResponse, type NextRequest } from 'next/server';

/**
 * A small per-IP rate limiter, kept in the memory of the running instance.
 *
 * Where it holds and where it doesn't:
 * - Node (Railway, `next start`): one process, so the counts are exact.
 * - Cloudflare Pages: every edge location, and every isolate within it, keeps
 *   its own counts, so a determined client spread across locations gets more
 *   through. It still stops the common case, one client hammering from one
 *   place. The authoritative limit in production is a Cloudflare rate
 *   limiting rule on the zone (see the Cloudflare setup doc).
 *
 * Fixed one-minute windows: simple, predictable, and cheap to reason about
 * when an approver asks "why did I get a 429?".
 */

export interface RateLimit {
  /** A short name, so two routes never share a bucket. */
  name: string;
  /** Requests allowed per client per window. */
  limit: number;
  windowMs?: number;
}

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();
const MAX_BUCKETS = 10_000;

/**
 * The client's IP as the platform saw it. Cloudflare sets `cf-connecting-ip`;
 * Railway's edge sets `x-real-ip`. As a last resort, the right-most entry of
 * `x-forwarded-for` is the one the nearest proxy added (left-most entries can
 * be written by the client).
 */
export function clientIp(request: NextRequest): string {
  const cf = request.headers.get('cf-connecting-ip');
  if (cf) return cf.trim();
  const real = request.headers.get('x-real-ip');
  if (real) return real.trim();
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const hops = forwarded
      .split(',')
      .map((hop) => hop.trim())
      .filter(Boolean);
    if (hops.length) return hops[hops.length - 1];
  }
  return 'unknown';
}

/**
 * Count one request. Returns undefined when it is allowed, or a 429 response
 * (with Retry-After) to send back when it is not.
 */
export function rateLimit(
  request: NextRequest,
  { name, limit, windowMs = 60_000 }: RateLimit,
  now: number = Date.now(),
): NextResponse | undefined {
  const key = `${name}:${clientIp(request)}`;
  let bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    if (buckets.size >= MAX_BUCKETS) sweep(now);
    bucket = { count: 0, resetAt: now + windowMs };
    buckets.set(key, bucket);
  }
  bucket.count += 1;
  if (bucket.count <= limit) return undefined;

  const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
  return NextResponse.json(
    { error: 'Too many requests. Please wait a minute and try again.' },
    {
      status: 429,
      headers: {
        'Retry-After': String(retryAfter),
        'Cache-Control': 'no-store',
      },
    },
  );
}

function sweep(now: number) {
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
  // Still full of live buckets (a flood of distinct IPs): start over rather
  // than grow without bound. Worst case, some clients get a fresh window.
  if (buckets.size >= MAX_BUCKETS) buckets.clear();
}

/** Test hook. */
export function resetRateLimits() {
  buckets.clear();
}

/** The limits per route, in one place so the docs can quote them. */
export const LIMITS = {
  join: { name: 'join', limit: 5 },
  status: { name: 'status', limit: 30 },
  admin: { name: 'admin', limit: 30 },
  leaderboard: { name: 'leaderboard', limit: 60 },
  referralHit: { name: 'referral-hit', limit: 10 },
} as const satisfies Record<string, RateLimit>;
