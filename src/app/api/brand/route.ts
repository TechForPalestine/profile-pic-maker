import { NextResponse, type NextRequest } from 'next/server';

import { resolveBrand } from '@/lib/brands';
import { LIMITS, rateLimit } from '@/lib/rate-limit';

export const runtime = 'edge';

/**
 * GET /api/brand?code=<code>
 *
 * What a co-branding link unlocks (see `@/lib/brands`): `{ brand, text }`, or
 * 404 for an unknown or retired code. Rate limited so codes can't be guessed
 * by brute force. Not cached, so retiring a code takes effect at once.
 */
export async function GET(request: NextRequest) {
  const limited = rateLimit(request, LIMITS.brand);
  if (limited) return limited;
  const link = resolveBrand(request.nextUrl.searchParams.get('code'));
  return link
    ? NextResponse.json(link, { headers: { 'Cache-Control': 'no-store' } })
    : new NextResponse(null, {
        status: 404,
        headers: { 'Cache-Control': 'no-store' },
      });
}
