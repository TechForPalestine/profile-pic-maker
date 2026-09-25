import type { LeaderboardResponse } from '@/lib/leaderboard';
import type { LeaderboardWindow } from '@/lib/plausible-stats';

/**
 * Server-side cache for the leaderboard, one entry per window.
 *
 * Why it exists: a `Cache-Control: s-maxage` header is only a hint. Railway
 * has no CDN, and Cloudflare Pages does not cache function responses on its
 * own, so without this every board view ran three Plausible Stats API calls.
 * The key allows 600 an hour: about 200 views would take the board down for
 * everyone, and anyone could do it on purpose by reloading.
 *
 * Three layers, cheapest first:
 * 1. In memory, per process or isolate (exact on a single Node instance).
 * 2. Requests already in flight for the same window are shared, so a burst
 *    after expiry triggers one computation, not one per visitor.
 * 3. On Cloudflare, `caches.default`: shared by every isolate in a location.
 * The key is the window alone, so extra query parameters cannot bypass it.
 */

export const BOARD_TTL_MS = 5 * 60 * 1000;

interface Entry {
  board: LeaderboardResponse;
  expiresAt: number;
}

const memory = new Map<LeaderboardWindow, Entry>();
const inFlight = new Map<LeaderboardWindow, Promise<LeaderboardResponse>>();

interface EdgeCache {
  match(request: Request): Promise<Response | undefined>;
  put(request: Request, response: Response): Promise<void>;
}

/** Cloudflare's per-location cache, when running on Cloudflare. */
function edgeCache(): EdgeCache | undefined {
  const storage = (globalThis as { caches?: { default?: EdgeCache } }).caches;
  return storage?.default;
}

const cacheKey = (window: LeaderboardWindow) =>
  new Request(`https://leaderboard-cache.internal/v1/${window}`);

export async function cachedBoard(
  window: LeaderboardWindow,
  compute: () => Promise<LeaderboardResponse>,
  { ttlMs = BOARD_TTL_MS, now = Date.now } = {},
): Promise<LeaderboardResponse> {
  const hit = memory.get(window);
  if (hit && hit.expiresAt > now()) return hit.board;

  const pending = inFlight.get(window);
  if (pending) return pending;

  const work = (async () => {
    const edge = edgeCache();
    if (edge) {
      try {
        const cached = await edge.match(cacheKey(window));
        if (cached) {
          const board = (await cached.json()) as LeaderboardResponse;
          const age = now() - Date.parse(board.generatedAt);
          if (age >= 0 && age < ttlMs) {
            memory.set(window, { board, expiresAt: now() + (ttlMs - age) });
            return board;
          }
        }
      } catch {
        // A cache miss or a cache error is never a reason to fail the board.
      }
    }

    const board = await compute();
    memory.set(window, { board, expiresAt: now() + ttlMs });
    if (edge) {
      try {
        await edge.put(
          cacheKey(window),
          new Response(JSON.stringify(board), {
            headers: {
              'Content-Type': 'application/json',
              'Cache-Control': `max-age=${Math.floor(ttlMs / 1000)}`,
            },
          }),
        );
      } catch {
        // Best effort: the in-memory copy still protects this isolate.
      }
    }
    return board;
  })();

  inFlight.set(window, work);
  try {
    return await work;
  } finally {
    inFlight.delete(window);
  }
}

/** Test hook. */
export function resetBoardCache() {
  memory.clear();
  inFlight.clear();
}
