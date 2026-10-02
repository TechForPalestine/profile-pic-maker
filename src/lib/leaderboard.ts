import {
  toPublicPromoter,
  type Promoter,
  type PublicPromoter,
} from '@/lib/promoters';
import {
  CHANNEL_PREFIX,
  REFERRER_NONE,
  hashReferralCode,
  isShareCode,
} from '@/lib/referral';
import type { CountRow, LeaderboardWindow } from '@/lib/plausible-stats';

/**
 * Turning Plausible's grouped counts into the leaderboard.
 *
 * Two different attributions feed the page, on purpose:
 * - The ranking uses the `referrer` prop: the first referral link this
 *   browser opened in the last 30 days. That is the promise made to
 *   promoters ("people you bring count, even if they come back later").
 *   Each row also shows visits (unique people who landed with that
 *   referrer) next to downloads. Visits never affect the rank; they tell a
 *   promoter whether their audience converts, and help approvers review
 *   entries (see `isSuspicious`).
 * - The channel mix uses Plausible's visit source: what led to the session in
 *   which the download happened. That is the question the growth team asks
 *   ("where are downloads coming from this week?").
 * The two totals therefore need not match, and the page says so.
 *
 * Only approved promoters are ever ranked. Downloads credited to a code that
 * is pending, rejected or simply never registered are not shown under any
 * name; in the channel mix they count as direct and organic traffic. Their
 * counts are still published, keyed by a fingerprint of the code (see
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

export type ChannelBucket =
  'promoters' | 'shared' | 'organic' | `channel:${string}`;

export interface ChannelRow {
  bucket: ChannelBucket;
  label: string;
  downloads: number;
}

export interface LeaderboardResponse {
  window: LeaderboardWindow;
  generatedAt: string;
  promoters: PromoterRow[];
  channels: ChannelRow[];
  /**
   * Counts for codes that are not (yet) approved, keyed by
   * `hashReferralCode(code)`. A browser that created a code can look up its
   * own numbers here; nobody else can tell which code a key belongs to.
   */
  pendingCounts: Record<string, PendingCount>;
}

const BUCKET_LABELS: Record<
  Exclude<ChannelBucket, `channel:${string}`>,
  string
> = {
  promoters: 'Promoter links',
  shared: 'Shared by users',
  organic: 'Direct and organic',
};

/** "ch-mighty-missions" becomes "Mighty Missions". */
export function channelLabel(code: string): string {
  return code
    .slice(CHANNEL_PREFIX.length)
    .split('-')
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(' ');
}

export function bucketSource(
  source: string,
  approvedCodes: Set<string>,
): ChannelBucket {
  const key = source.trim().toLowerCase();
  if (approvedCodes.has(key)) return 'promoters';
  if (isShareCode(key)) return 'shared';
  if (key.startsWith(CHANNEL_PREFIX) && key.length > CHANNEL_PREFIX.length) {
    return `channel:${key}`;
  }
  return 'organic';
}

function bucketLabel(bucket: ChannelBucket): string {
  return bucket.startsWith('channel:')
    ? channelLabel(bucket.slice('channel:'.length))
    : BUCKET_LABELS[bucket as keyof typeof BUCKET_LABELS];
}

export function buildChannels(
  bySource: CountRow[],
  approvedCodes: Set<string>,
): ChannelRow[] {
  const totals = new Map<ChannelBucket, number>();
  for (const row of bySource) {
    const bucket = bucketSource(row.key, approvedCodes);
    totals.set(bucket, (totals.get(bucket) ?? 0) + row.visitors);
  }
  return [...totals.entries()]
    .map(([bucket, downloads]) => ({
      bucket,
      label: bucketLabel(bucket),
      downloads,
    }))
    .sort(
      (a, b) => b.downloads - a.downloads || a.label.localeCompare(b.label),
    );
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
  bySource,
  approved,
  now = new Date(),
}: {
  window: LeaderboardWindow;
  /** Unique downloaders per referrer code. */
  byReferrer: CountRow[];
  /** Unique landings per referrer code. */
  visitsByReferrer?: CountRow[];
  bySource: CountRow[];
  approved: Promoter[];
  now?: Date;
}): Promise<LeaderboardResponse> {
  const approvedCodes = new Set(approved.map((p) => p.code));
  return {
    window,
    generatedAt: now.toISOString(),
    promoters: rankPromoters(byReferrer, approved, visitsByReferrer),
    channels: buildChannels(bySource, approvedCodes),
    pendingCounts: await buildPendingCounts(
      byReferrer,
      approvedCodes,
      visitsByReferrer,
    ),
  };
}

/** Merge counts for the same keys, keeping the higher number of each. */
export function maxByKey(...lists: CountRow[][]): CountRow[] {
  const merged = new Map<string, CountRow>();
  for (const row of lists.flat()) {
    const seen = merged.get(row.key);
    merged.set(row.key, {
      key: row.key,
      visitors: Math.max(seen?.visitors ?? 0, row.visitors),
      events: Math.max(seen?.events ?? 0, row.events),
    });
  }
  return [...merged.values()];
}
