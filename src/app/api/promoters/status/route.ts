import { NextResponse, type NextRequest } from 'next/server';

import { constantTimeEqual } from '@/lib/admin-auth';
import { getPromoterStore, hashOwnerKey } from '@/lib/promoters';
import { LIMITS, rateLimit } from '@/lib/rate-limit';
import { isPromoterCode, leaderboardEnabled } from '@/lib/referral';

export const runtime = 'edge';

/**
 * POST /api/promoters/status  { code, ownerKey }
 *
 * Where a listing request stands, for the browser that sent it. The join page
 * and the board remember "I asked to be listed" locally; without this check
 * they would keep saying "pending review" after a rejection, a take-down, or a
 * request the server never stored.
 *
 * Only the holder of the owner key (returned once, when the request was
 * sent) gets a real answer. Anyone else, and any code without a request,
 * gets `none`, so this reveals nothing about other people's listings.
 * POST, so the key never lands in a URL or an access log. Not cached.
 */
export type ListingStatus = 'none' | 'pending' | 'approved' | 'rejected';

const answer = (status: ListingStatus) =>
  NextResponse.json({ status }, { headers: { 'Cache-Control': 'no-store' } });

export async function POST(request: NextRequest) {
  if (!leaderboardEnabled()) return new NextResponse(null, { status: 404 });
  const limited = rateLimit(request, LIMITS.status);
  if (limited) return limited;

  let body: { code?: unknown; ownerKey?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
  }
  const { code, ownerKey } = body;
  if (
    !isPromoterCode(code) ||
    typeof ownerKey !== 'string' ||
    ownerKey.length < 16 ||
    ownerKey.length > 128
  ) {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }

  const promoter = await getPromoterStore().get(code);
  if (!promoter?.ownerKeyHash) return answer('none');
  const matches = constantTimeEqual(
    await hashOwnerKey(ownerKey),
    promoter.ownerKeyHash,
  );
  return answer(matches ? promoter.status : 'none');
}
