import { FunnelEvent } from '@/lib/analytics';

/**
 * Read side of Plausible: the Stats API v2 (`POST /api/v2/query`).
 *
 * The site sends every landing as `Funnel: 1 Landed` and every download as
 * `Funnel: 6 Downloaded`, both with a `referrer` prop (see `@/lib/referral`),
 * and Plausible records the visit's source from the `ref` query param. This
 * client asks Plausible how many people did either, grouped by referrer or
 * by source, for one of the leaderboard windows.
 *
 * Requirements on the Plausible side:
 * - Stats API access (a Business plan feature at the time of writing) and an
 *   API key, kept in `PLAUSIBLE_API_KEY` as a server-side secret.
 * - `referrer` listed under the site's allowed custom properties.
 * The leaderboard route makes two requests per window and caches for ten
 * minutes, so it stays far inside the key's hourly budget.
 */

export const DEFAULT_PLAUSIBLE_HOST = 'https://plausible.io';
export const DEFAULT_SITE_ID = 'ppm.techforpalestine.org';

export interface PlausibleEnv {
  PLAUSIBLE_API_KEY?: string;
  PLAUSIBLE_SITE_ID?: string;
  PLAUSIBLE_API_HOST?: string;
}

/** Plausible date_range presets the leaderboard offers. */
export const LEADERBOARD_WINDOWS = ['day', '7d', 'all'] as const;
export type LeaderboardWindow = (typeof LEADERBOARD_WINDOWS)[number];

export function isLeaderboardWindow(
  value: unknown,
): value is LeaderboardWindow {
  return (
    typeof value === 'string' &&
    (LEADERBOARD_WINDOWS as readonly string[]).includes(value)
  );
}

export type CountDimension = 'event:props:referrer' | 'visit:source';

/** One grouped row: who or what, and how many people downloaded. */
export interface CountRow {
  key: string;
  /** Unique visitors who downloaded. The number the leaderboard ranks by. */
  visitors: number;
  /** Download events, for context (one person can download several times). */
  events: number;
}

/** Plausible's built-in event for page views (sent by its own script). */
export const PAGEVIEW = 'pageview';

export type CountedEvent =
  typeof FunnelEvent.Landed | typeof FunnelEvent.Downloaded | typeof PAGEVIEW;

/** Rows per event name: every requested event is present, possibly empty. */
export type CountsByEvent = Record<CountedEvent, CountRow[]>;

export interface PlausibleStatsClient {
  /**
   * Unique visitors (and raw events) for each of `events`, grouped by
   * `dimension`, in one request.
   */
  count(
    events: CountedEvent[],
    dimension: CountDimension,
    window: LeaderboardWindow,
  ): Promise<CountsByEvent>;
}

export function hasPlausibleEnv(env: PlausibleEnv): boolean {
  return Boolean(env.PLAUSIBLE_API_KEY);
}

/**
 * Plausible's `7d` preset ends yesterday, so a board that only shows the last
 * seven days would miss today. Ask for the seven days ending today instead.
 */
export function dateRange(
  window: LeaderboardWindow,
  now: Date = new Date(),
): LeaderboardWindow | [string, string] {
  if (window !== '7d') return window;
  const day = (d: Date) => d.toISOString().slice(0, 10);
  const start = new Date(now);
  start.setUTCDate(start.getUTCDate() - 6);
  return [day(start), day(now)];
}

/** The exact request body sent to Plausible, exported so tests can pin it. */
export function countQuery(
  siteId: string,
  events: CountedEvent[],
  dimension: CountDimension,
  window: LeaderboardWindow,
  now: Date = new Date(),
) {
  return {
    site_id: siteId,
    metrics: ['visitors', 'events'],
    date_range: dateRange(window, now),
    filters: [['is', 'event:name', events]],
    // Grouped by event first, so one request answers for several events.
    dimensions: ['event:name', dimension],
    order_by: [['visitors', 'desc']],
    pagination: { limit: 1000 },
  };
}

interface QueryResponse {
  results?: { dimensions: string[]; metrics: number[] }[];
}

export function createPlausibleClient(env: PlausibleEnv): PlausibleStatsClient {
  const host = (env.PLAUSIBLE_API_HOST || DEFAULT_PLAUSIBLE_HOST).replace(
    /\/$/,
    '',
  );
  const siteId = env.PLAUSIBLE_SITE_ID || DEFAULT_SITE_ID;

  const client: PlausibleStatsClient = {
    async count(events, dimension, window) {
      const res = await fetch(`${host}/api/v2/query`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.PLAUSIBLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(countQuery(siteId, events, dimension, window)),
      });
      if (!res.ok) {
        throw new Error(`Plausible query failed: ${res.status}`);
      }
      const body = (await res.json()) as QueryResponse;
      const counts = Object.fromEntries(
        events.map((event) => [event, [] as CountRow[]]),
      ) as CountsByEvent;
      for (const row of body.results ?? []) {
        const [event, key] = row.dimensions ?? [];
        if (typeof key !== 'string' || !(event in counts)) continue;
        counts[event as CountedEvent].push({
          key,
          visitors: Number(row.metrics?.[0] ?? 0),
          events: Number(row.metrics?.[1] ?? 0),
        });
      }
      return counts;
    },
  };
  return client;
}
