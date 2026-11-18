import {
  toPublicPromoter,
  type Promoter,
  type PublicPromoter,
} from '@/lib/promoters';
import { REFERRER_NONE, hashReferralCode } from '@/lib/referral';
import type { CountRow, LeaderboardWindow } from '@/lib/plausible-stats';

/**
 * Turning Plausible's grouped counts into the leaderboard.
 *
 * The ranking uses the `referrer` prop: the first referral link this
 *   browser opened in the last 30 days. That is the promise made to
 *   promoters ("people you bring count, even if they come back later").
 *   Each row also shows visits (unique people who landed with that
 *   referrer) next to downloads. Visits never affect the rank; they tell a
 *   promoter whether their audience converts, and help approvers review
 *   entries (see `isSuspicious`).
 *
 * Only approved promoters are ever ranked. Downloads credited to a code that
 * is pending, rejected or simply never registered are not shown under any
 * name. Their counts are still published, keyed by a fingerprint of the code (see
 * `pendingCounts`), so a promoter waiting for review can see their own
 * number without any unreviewed text reaching the page.
 */

export const WINDOW_LABELS: Record<LeaderboardWindow, string> = {
  day: 'Today',
  '7d': 'Last 7 days',
  all: 'All time',
};

export interface PromoterRow extends PublicPromoter {
  rank: number;
  /** Unique people who downloaded. The ranking metric. */
  downloads: number;
  /** Unique people who landed through the link. Context only. */
  visits: number;
}

export interface PendingCount {
  downloads: number;
  visits: number;
}

export interface LeaderboardResponse {
  window: LeaderboardWindow;
  generatedAt: string;
  promoters: PromoterRow[];
  /**
   * Counts for codes that are not (yet) approved, keyed by
   * `hashReferralCode(code)`. A browser that created a code can look up its
   * own numbers here; nobody else can tell which code a key belongs to.
   */
  pendingCounts: Record<string, PendingCount>;
}

function countMap(rows: CountRow[]): Map<string, number> {
  return new Map(
    rows.map((row) => [row.key.trim().toLowerCase(), row.visitors]),
  );
}

/**
 * Flags counts an approver should look at before trusting them. The board
 * never hides a row for this; approvers see the flag and decide.
 */
export function isSuspicious(downloads: number, visits: number): boolean {
  return downloads >= 5 && downloads > visits * 1.2 + 2;
}

export function rankPromoters(
  byReferrer: CountRow[],
  approved: Promoter[],
  visitsByReferrer: CountRow[] = [],
): PromoterRow[] {
  const downloads = countMap(byReferrer);
  const visits = countMap(visitsByReferrer);
  const rows = approved
    .map((promoter) => ({
      ...toPublicPromoter(promoter, approved),
      rank: 0,
      downloads: downloads.get(promoter.code) ?? 0,
      visits: visits.get(promoter.code) ?? 0,
    }))
    .sort(
      (a, b) =>
        b.downloads - a.downloads || a.displayName.localeCompare(b.displayName),
    );
  // Competition ranking: equal counts share a rank, the next rank skips.
  rows.forEach((row, index) => {
    row.rank =
      index > 0 && rows[index - 1].downloads === row.downloads
        ? rows[index - 1].rank
        : index + 1;
  });
  return rows;
}

export async function buildPendingCounts(
  byReferrer: CountRow[],
  approvedCodes: Set<string>,
  visitsByReferrer: CountRow[] = [],
): Promise<Record<string, PendingCount>> {
  const downloads = countMap(byReferrer);
  const visits = countMap(visitsByReferrer);
  const codes = [...new Set([...downloads.keys(), ...visits.keys()])].filter(
    (code) =>
      code !== REFERRER_NONE &&
      // Plausible's bucket for events sent without the prop at all.
      code !== '(none)' &&
      code !== '' &&
      !approvedCodes.has(code) &&
      ((downloads.get(code) ?? 0) > 0 || (visits.get(code) ?? 0) > 0),
  );
  const entries = await Promise.all(
    codes.map(
      async (code) =>
        [
          await hashReferralCode(code),
          {
            downloads: downloads.get(code) ?? 0,
            visits: visits.get(code) ?? 0,
          },
        ] as const,
    ),
  );
  return Object.fromEntries(entries);
}

export async function buildLeaderboard({
  window,
  byReferrer,
  visitsByReferrer = [],
  approved,
  now = new Date(),
}: {
  window: LeaderboardWindow;
  /** Unique downloaders per referrer code. */
  byReferrer: CountRow[];
  /** Unique landings per referrer code. */
  visitsByReferrer?: CountRow[];
  approved: Promoter[];
  now?: Date;
}): Promise<LeaderboardResponse> {
  const approvedCodes = new Set(approved.map((p) => p.code));
  return {
    window,
    generatedAt: now.toISOString(),
    promoters: rankPromoters(byReferrer, approved, visitsByReferrer),
    pendingCounts: await buildPendingCounts(
      byReferrer,
      approvedCodes,
      visitsByReferrer,
    ),
  };
}
