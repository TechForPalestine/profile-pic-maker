import type { LeaderboardResponse } from '@/lib/leaderboard';
import { hashReferralCode } from '@/lib/referral';

/**
 * How many people this browser's link has brought: unique downloads credited
 * to the code, all time. Read from the public leaderboard response, where an
 * approved code has its own row and any other code is published only under
 * its fingerprint (see `pendingCounts`), so nothing new is exposed.
 */
export function ownDownloads(
  board: Pick<LeaderboardResponse, 'promoters' | 'pendingCounts'>,
  code: string,
  hash: string,
): number {
  const listed = board.promoters.find((row) => row.code === code);
  return listed?.downloads ?? board.pendingCounts[hash]?.downloads ?? 0;
}

/**
 * The count for `code`, or undefined when the board cannot be read (switched
 * off, warming up, or offline). The API is cached for about ten minutes, so
 * a new download shows up with that delay.
 */
export async function fetchMyReach(code: string): Promise<number | undefined> {
  try {
    const [res, hash] = await Promise.all([
      fetch('/api/leaderboard?window=all'),
      hashReferralCode(code),
    ]);
    if (!res.ok) return undefined;
    return ownDownloads((await res.json()) as LeaderboardResponse, code, hash);
  } catch {
    return undefined;
  }
}

/** The line under the personal link; undefined when the count is unknown. */
export function reachCopy(reach: number | undefined): string {
  if (reach === undefined) {
    return 'Everyone who makes their picture through it counts for you.';
  }
  if (reach === 0) {
    return 'Nobody yet. The first person you bring shows up here.';
  }
  return `${reach} ${reach === 1 ? 'person has' : 'people have'} made their picture through your link.`;
}
