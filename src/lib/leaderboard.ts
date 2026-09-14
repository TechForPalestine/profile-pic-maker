import {
  toPublicPromoter,
  type Promoter,
  type PublicPromoter,
} from '@/lib/promoters';
import { CHANNEL_PREFIX, isShareCode } from '@/lib/referral';
import type { CountRow, LeaderboardWindow } from '@/lib/plausible-stats';

/**
 * Turning Plausible's grouped counts into the leaderboard.
 *
 * Two different attributions feed the page, on purpose:
 * - The ranking uses the `referrer` prop: the first referral link this
 *   browser opened in the last 30 days. That is the promise made to
 *   promoters ("people you bring count, even if they come back later").
 * - The channel mix uses Plausible's visit source: what led to the session in
 *   which the download happened. That is the question the growth team asks
 *   ("where are downloads coming from this week?").
 * The two totals therefore need not match, and the page says so.
 *
 * Only approved promoters are ever ranked. Downloads credited to a code that
 * is pending, rejected or simply never registered are not shown under any
 * name; in the channel mix they count as direct and organic traffic.
 */

export const WINDOW_LABELS: Record<LeaderboardWindow, string> = {
  day: 'Today',
  '7d': 'Last 7 days',
  all: 'All time',
};

export interface PromoterRow extends PublicPromoter {
  rank: number;
  downloads: number;
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

export function rankPromoters(
  byReferrer: CountRow[],
  approved: Promoter[],
): PromoterRow[] {
  const downloads = new Map(
    byReferrer.map((row) => [row.key.trim().toLowerCase(), row.visitors]),
  );
  const rows = approved
    .map((promoter) => ({
      ...toPublicPromoter(promoter, approved),
      rank: 0,
      downloads: downloads.get(promoter.code) ?? 0,
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

export function buildLeaderboard({
  window,
  byReferrer,
  bySource,
  approved,
  now = new Date(),
}: {
  window: LeaderboardWindow;
  byReferrer: CountRow[];
  bySource: CountRow[];
  approved: Promoter[];
  now?: Date;
}): LeaderboardResponse {
  const approvedCodes = new Set(approved.map((p) => p.code));
  return {
    window,
    generatedAt: now.toISOString(),
    promoters: rankPromoters(byReferrer, approved),
    channels: buildChannels(bySource, approvedCodes),
  };
}
