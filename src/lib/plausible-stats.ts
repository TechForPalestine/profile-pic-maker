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
 * Rate limit is 600 requests per hour per key; the leaderboard route caches
 * for ten minutes, so it uses a few dozen at most.
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

export type CountedEvent =
  typeof FunnelEvent.Landed | typeof FunnelEvent.Downloaded;

export interface PlausibleStatsClient {
  /** Unique visitors (and raw events) that fired `event`, grouped by `dimension`. */
  countBy(
    event: CountedEvent,
    dimension: CountDimension,
    window: LeaderboardWindow,
  ): Promise<CountRow[]>;
  /** Shorthand for `countBy(FunnelEvent.Downloaded, ...)`. */
  downloadsBy(
    dimension: CountDimension,
    window: LeaderboardWindow,
  ): Promise<CountRow[]>;
}

export function hasPlausibleEnv(env: PlausibleEnv): boolean {
  return Boolean(env.PLAUSIBLE_API_KEY);
}

/** The exact request body sent to Plausible, exported so tests can pin it. */
export function countQuery(
  siteId: string,
  event: CountedEvent,
  dimension: CountDimension,
  window: LeaderboardWindow,
) {
  return {
    site_id: siteId,
    metrics: ['visitors', 'events'],
    date_range: window,
    filters: [['is', 'event:name', [event]]],
    dimensions: [dimension],
    order_by: [['visitors', 'desc']],
    pagination: { limit: 500 },
  };
}

export function downloadsQuery(
  siteId: string,
  dimension: CountDimension,
  window: LeaderboardWindow,
) {
  return countQuery(siteId, FunnelEvent.Downloaded, dimension, window);
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
    downloadsBy: (dimension, window) =>
      client.countBy(FunnelEvent.Downloaded, dimension, window),
    async countBy(event, dimension, window) {
      const res = await fetch(`${host}/api/v2/query`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.PLAUSIBLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(countQuery(siteId, event, dimension, window)),
      });
      if (!res.ok) {
        throw new Error(`Plausible query failed: ${res.status}`);
      }
      const body = (await res.json()) as QueryResponse;
      return (body.results ?? [])
        .filter((row) => typeof row.dimensions?.[0] === 'string')
        .map((row) => ({
          key: row.dimensions[0],
          visitors: Number(row.metrics?.[0] ?? 0),
          events: Number(row.metrics?.[1] ?? 0),
        }));
    },
  };
  return client;
}
