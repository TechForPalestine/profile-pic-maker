import { kvBinding, type KvNamespaceBinding } from '@/lib/cloudflare-bindings';
import type { LeaderboardResponse } from '@/lib/leaderboard';
import type { LeaderboardWindow } from '@/lib/plausible-stats';

/**
 * Server-side cache for the leaderboard, one entry per window.
 *
 * Why it exists: Cloudflare Pages does not cache function responses on its
 * own, so without this every board view would run three Plausible Stats API
 * calls against a key with an hourly budget.
 *
 * Four layers, cheapest first:
 * 1. In memory, per isolate.
 * 2. Requests already in flight for the same window are shared, so a burst
 *    after expiry triggers one computation, not one per visitor.
 * 3. `caches.default`: shared by every isolate in a Cloudflare location.
 * 4. Workers KV (the `PROMOTERS` namespace): shared by every location, so
 *    the Stats API is called about once per window per TTL worldwide, not
 *    once per location.
 * The key is the window alone, so extra query parameters cannot bypass it.
 *
 * Ten minutes keeps both budgets comfortable: about 54 Stats API calls an
 * hour, and about 430 KV writes a day (the free plan allows 1,000, which
 * listing requests share).
 */

export const BOARD_TTL_MS = 10 * 60 * 1000;

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

const kvKey = (window: LeaderboardWindow) => `board-cache:v1:${window}`;

/** Milliseconds a cached board has left, or 0 when it is stale or unreadable. */
function remaining(board: LeaderboardResponse, ttlMs: number, now: number) {
  const age = now - Date.parse(board.generatedAt);
  return age >= 0 && age < ttlMs ? ttlMs - age : 0;
}

async function fromEdge(edge: EdgeCache, window: LeaderboardWindow) {
  const cached = await edge.match(cacheKey(window));
  return cached ? ((await cached.json()) as LeaderboardResponse) : undefined;
}

async function fromKv(kv: KvNamespaceBinding, window: LeaderboardWindow) {
  const raw = await kv.get(kvKey(window));
  return raw ? (JSON.parse(raw) as LeaderboardResponse) : undefined;
}

function toEdge(
  edge: EdgeCache,
  window: LeaderboardWindow,
  board: LeaderboardResponse,
  ttlMs: number,
) {
  return edge.put(
    cacheKey(window),
    new Response(JSON.stringify(board), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': `max-age=${Math.max(1, Math.floor(ttlMs / 1000))}`,
      },
    }),
  );
}

/** Errors from a cache layer are never a reason to fail the board. */
const quietly = async <T>(work: () => Promise<T>) => {
  try {
    return await work();
  } catch {
    return undefined;
  }
};

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
    const kv = kvBinding();

    const local = edge && (await quietly(() => fromEdge(edge, window)));
    const localLeft = local ? remaining(local, ttlMs, now()) : 0;
    if (local && localLeft) {
      memory.set(window, { board: local, expiresAt: now() + localLeft });
      return local;
    }

    const shared = kv && (await quietly(() => fromKv(kv, window)));
    const sharedLeft = shared ? remaining(shared, ttlMs, now()) : 0;
    if (shared && sharedLeft) {
      memory.set(window, { board: shared, expiresAt: now() + sharedLeft });
      if (edge) await quietly(() => toEdge(edge, window, shared, sharedLeft));
      return shared;
    }

    const board = await compute();
    memory.set(window, { board, expiresAt: now() + ttlMs });
    if (edge) await quietly(() => toEdge(edge, window, board, ttlMs));
    if (kv) {
      await quietly(() =>
        kv.put(kvKey(window), JSON.stringify(board), {
          // KV's minimum is 60 seconds; the entry is judged by generatedAt.
          expirationTtl: Math.max(60, Math.ceil((2 * ttlMs) / 1000)),
        }),
      );
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
