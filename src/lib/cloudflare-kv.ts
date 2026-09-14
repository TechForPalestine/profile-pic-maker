/**
 * Minimal Cloudflare Workers KV client over the REST API.
 *
 * The app deploys to Cloudflare Pages, but how bindings reach the edge
 * runtime depends on the Pages build adapter, which lives outside this repo.
 * Talking to KV over HTTPS with a scoped API token works the same in the edge
 * runtime, in `next dev`, and in vitest with a mocked `fetch`, and adds no
 * dependency. Latency is a few tens of milliseconds per call, which the
 * public routes hide behind a five-minute cache.
 *
 * Token scope needed: Account > Workers KV Storage > Edit, for one namespace.
 */

export interface KvEnv {
  CLOUDFLARE_ACCOUNT_ID?: string;
  CLOUDFLARE_KV_NAMESPACE_ID?: string;
  CLOUDFLARE_API_TOKEN?: string;
}

export interface KvClient {
  get(key: string): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
  /** Keys starting with `prefix` (first 1000; the registry is far smaller). */
  listKeys(prefix: string): Promise<string[]>;
}

export const KV_API_BASE = 'https://api.cloudflare.com/client/v4';

export function hasKvEnv(env: KvEnv): env is Required<KvEnv> {
  return Boolean(
    env.CLOUDFLARE_ACCOUNT_ID &&
    env.CLOUDFLARE_KV_NAMESPACE_ID &&
    env.CLOUDFLARE_API_TOKEN,
  );
}

export function createKvClient(env: Required<KvEnv>): KvClient {
  const namespace = `${KV_API_BASE}/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/storage/kv/namespaces/${env.CLOUDFLARE_KV_NAMESPACE_ID}`;
  const headers = { Authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}` };
  const valueUrl = (key: string) =>
    `${namespace}/values/${encodeURIComponent(key)}`;

  return {
    async get(key) {
      const res = await fetch(valueUrl(key), { headers });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`KV get failed: ${res.status}`);
      return res.text();
    },
    async put(key, value) {
      const res = await fetch(valueUrl(key), {
        method: 'PUT',
        headers: { ...headers, 'Content-Type': 'text/plain' },
        body: value,
      });
      if (!res.ok) throw new Error(`KV put failed: ${res.status}`);
    },
    async delete(key) {
      const res = await fetch(valueUrl(key), { method: 'DELETE', headers });
      if (!res.ok && res.status !== 404) {
        throw new Error(`KV delete failed: ${res.status}`);
      }
    },
    async listKeys(prefix) {
      const res = await fetch(
        `${namespace}/keys?prefix=${encodeURIComponent(prefix)}&limit=1000`,
        { headers },
      );
      if (!res.ok) throw new Error(`KV list failed: ${res.status}`);
      const body = (await res.json()) as { result?: { name: string }[] };
      return (body.result ?? []).map((entry) => entry.name);
    },
  };
}

/** In-memory stand-in for local development and tests. */
export function createMemoryKvClient(
  seed: Record<string, string> = {},
): KvClient & { data: Map<string, string> } {
  const data = new Map(Object.entries(seed));
  return {
    data,
    async get(key) {
      return data.get(key) ?? null;
    },
    async put(key, value) {
      data.set(key, value);
    },
    async delete(key) {
      data.delete(key);
    },
    async listKeys(prefix) {
      return [...data.keys()].filter((key) => key.startsWith(prefix)).sort();
    },
  };
}
