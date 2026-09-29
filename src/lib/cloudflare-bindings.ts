/**
 * Cloudflare bindings, as declared in `wrangler.jsonc`.
 *
 * On Cloudflare Pages, next-on-pages publishes each request's environment
 * (bindings, variables, secrets) on a well-known global symbol; this is what
 * `getRequestContext()` from `@cloudflare/next-on-pages` reads. That package
 * pins Next.js below 16, so the symbol is read directly instead of adding it.
 *
 * Bindings replace the REST API and its account-wide token: the app can reach
 * exactly the KV namespace and D1 database named in the config, nothing else.
 * Off Cloudflare (`next dev`, vitest) there are no bindings and callers fall
 * back to an in-memory store.
 */

const REQUEST_CONTEXT = Symbol.for('__cloudflare-request-context__');

/** The request's Cloudflare environment, or undefined off Cloudflare. */
export function cloudflareEnv(): Record<string, unknown> | undefined {
  const context = (globalThis as Record<symbol, unknown>)[REQUEST_CONTEXT] as
    { env?: Record<string, unknown> } | undefined;
  return context?.env;
}

/** The subset of a Workers KV namespace binding the app uses. */
export interface KvNamespaceBinding {
  get(key: string): Promise<string | null>;
  put(
    key: string,
    value: string,
    options?: { expirationTtl?: number },
  ): Promise<void>;
  delete(key: string): Promise<void>;
  list(options: { prefix?: string; cursor?: string; limit?: number }): Promise<{
    keys: { name: string }[];
    list_complete: boolean;
    cursor?: string;
  }>;
}

/** The subset of a D1 database binding the app uses. */
export interface D1DatabaseBinding {
  prepare(sql: string): {
    bind(...values: unknown[]): {
      all<T = unknown>(): Promise<{ results: T[] }>;
      run(): Promise<unknown>;
    };
  };
}

/** Binding names, shared with `wrangler.jsonc`. */
export const PROMOTERS_BINDING = 'PROMOTERS';
export const DOWNLOADS_BINDING = 'DOWNLOADS';

export function kvBinding(
  name: string = PROMOTERS_BINDING,
  env: Record<string, unknown> | undefined = cloudflareEnv(),
): KvNamespaceBinding | undefined {
  const binding = env?.[name] as KvNamespaceBinding | undefined;
  return binding && typeof binding.get === 'function' ? binding : undefined;
}

export function d1Binding(
  name: string = DOWNLOADS_BINDING,
  env: Record<string, unknown> | undefined = cloudflareEnv(),
): D1DatabaseBinding | undefined {
  const binding = env?.[name] as D1DatabaseBinding | undefined;
  return binding && typeof binding.prepare === 'function' ? binding : undefined;
}

/** What the registry needs from a key-value store. */
export interface KvClient {
  get(key: string): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
  /** Every key starting with `prefix`. */
  listKeys(prefix: string): Promise<string[]>;
}

export function createBindingKvClient(ns: KvNamespaceBinding): KvClient {
  return {
    get: (key) => ns.get(key),
    put: (key, value) => ns.put(key, value),
    delete: (key) => ns.delete(key),
    async listKeys(prefix) {
      const keys: string[] = [];
      let cursor: string | undefined;
      do {
        const page = await ns.list({ prefix, cursor, limit: 1000 });
        keys.push(...page.keys.map((k) => k.name));
        cursor = page.list_complete ? undefined : page.cursor;
      } while (cursor);
      return keys;
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
