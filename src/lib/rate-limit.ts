import { NextResponse, type NextRequest } from 'next/server';

/**
 * A small per-IP rate limiter, kept in the memory of the running instance,
 * with fixed one-minute windows. In production a Cloudflare rate limiting
 * rule sits in front of `/api/*` as well.
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
 * The client's IP as Cloudflare saw it. Other forwarding headers are ignored:
 * a client can write them.
 */
export function clientIp(request: NextRequest): string {
  return request.headers.get('cf-connecting-ip')?.trim() || 'unknown';
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
