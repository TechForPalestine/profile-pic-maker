import { NextResponse, type NextRequest } from 'next/server';

import { FunnelEvent } from '@/lib/analytics';
import { cachedBoard } from '@/lib/board-cache';
import { buildLeaderboard } from '@/lib/leaderboard';
import {
  createPlausibleClient,
  hasPlausibleEnv,
  isLeaderboardWindow,
  type PlausibleEnv,
} from '@/lib/plausible-stats';
import { getPromoterStore } from '@/lib/promoters';
import { LIMITS, rateLimit } from '@/lib/rate-limit';

export const runtime = 'edge';

const CACHE = 'public, s-maxage=300, stale-while-revalidate=600';
const SHORT_CACHE = 'public, s-maxage=60';

/**
 * GET /api/leaderboard?window=day|7d|all
 *
 * Joins Plausible's download and visit counts onto the approved promoter
 * registry. Computed at most once per window every ten minutes (see
 * `@/lib/board-cache`): Plausible's API key has an hourly budget, and the
 * board must not spend it per visitor.
 */
export async function GET(request: NextRequest) {
  const limited = rateLimit(request, LIMITS.leaderboard);
  if (limited) return limited;

  const requested = request.nextUrl.searchParams.get('window') ?? '7d';
  if (!isLeaderboardWindow(requested)) {
    return NextResponse.json(
      { error: 'window must be one of day, 7d, all' },
      { status: 400 },
    );
  }

  const env = process.env as PlausibleEnv;
  if (!hasPlausibleEnv(env)) {
    // No Stats API key configured (or no Business plan yet). The page shows
    // a friendly "not available" state rather than an empty board.
    return NextResponse.json(
      { error: 'leaderboard-unavailable' },
      { status: 503, headers: { 'Cache-Control': SHORT_CACHE } },
    );
  }

  try {
    const board = await cachedBoard(requested, async () => {
      const plausible = createPlausibleClient(env);
      const [approved, byReferrer, visitsByReferrer, bySource] =
        await Promise.all([
          getPromoterStore().listApproved(),
          plausible.downloadsBy('event:props:referrer', requested),
          plausible.countBy(
            FunnelEvent.Landed,
            'event:props:referrer',
            requested,
          ),
          plausible.downloadsBy('visit:source', requested),
        ]);
      return buildLeaderboard({
        window: requested,
        byReferrer,
        visitsByReferrer,
        bySource,
        approved,
      });
    });
    return NextResponse.json(board, { headers: { 'Cache-Control': CACHE } });
  } catch (error) {
    console.error('Leaderboard query failed', error);
    return NextResponse.json(
      { error: 'leaderboard-upstream-error' },
      { status: 502, headers: { 'Cache-Control': SHORT_CACHE } },
    );
  }
}
