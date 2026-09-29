import {
  createBindingKvClient,
  createMemoryKvClient,
  kvBinding,
  type KvClient,
  type KvNamespaceBinding,
} from '@/lib/cloudflare-bindings';
import { isPromoterCode } from '@/lib/referral';

/**
 * The promoter registry: who may appear on the public leaderboard.
 *
 * Anyone can generate a referral link and it is counted from the first click.
 * Appearing on the board with a display name and an optional link is a separate,
 * moderated step: the board renders on a Tech For Palestine domain, so every
 * name and link on it has been looked at by a person first. Requests land as
 * `pending`; an approver flips them to `approved` (or `rejected`) from the
 * admin page, and only approved entries are ever served publicly.
 *
 * Storage is the Workers KV namespace bound as `PROMOTERS` in
 * `wrangler.jsonc` (see `@/lib/cloudflare-bindings`):
 *   promoter:<code>  one JSON `Promoter` per code, the source of truth
 *   approved         the approved entries as one JSON array, rewritten by
 *                    admin actions, so the public read is a single `get`
 * Off Cloudflare an in-memory store is used, which is what `next dev` and the
 * tests run against.
 */

/**
 * Platforms recognised from a link's host, only to pick an icon. Any https
 * website is accepted; one that is not listed here shows a globe.
 */
export const LINK_PLATFORMS = [
  'x',
  'instagram',
  'tiktok',
  'linkedin',
  'bluesky',
  'facebook',
  'youtube',
  'website',
] as const;

export type LinkPlatform = (typeof LINK_PLATFORMS)[number];

export type PromoterStatus = 'pending' | 'approved' | 'rejected';

export interface Promoter {
  code: string;
  displayName: string;
  /** One optional public link (a profile or a website), always https. */
  link?: string;
  /** Code of the approved promoter whose link brought this person here. */
  referredBy?: string;
  status: PromoterStatus;
  createdAt: string;
  reviewedAt?: string;
  /**
   * SHA-256 (hex) of the private key handed to the browser that sent the
   * request. Only that browser can ask where its request stands. Never
   * leaves the server.
   */
  ownerKeyHash?: string;
}

/** What the public API serves: nothing about status or timing. */
export interface PublicPromoter {
  code: string;
  displayName: string;
  link?: string;
  /** Approved promoters who joined through this person's link. */
  recruits: number;
}

export interface JoinRequest {
  code: string;
  displayName: string;
  link?: string;
  referredBy?: string;
}

/** Hosts that identify a platform (for the icon), subdomains included. */
export const LINK_HOSTS: Record<Exclude<LinkPlatform, 'website'>, string[]> = {
  x: ['x.com', 'twitter.com'],
  instagram: ['instagram.com'],
  tiktok: ['tiktok.com'],
  linkedin: ['linkedin.com'],
  bluesky: ['bsky.app'],
  facebook: ['facebook.com', 'fb.com'],
  youtube: ['youtube.com', 'youtu.be'],
};

export const DISPLAY_NAME_MIN = 2;
export const DISPLAY_NAME_MAX = 40;
export const LINK_MAX_LENGTH = 200;

/** Hard stop on the moderation queue, so a flood can't fill the namespace. */
export const MAX_PENDING = 500;

// Letters and digits from any script, spaces, and the punctuation that shows
// up in real names. No angle brackets, slashes, or control characters.
const DISPLAY_NAME_PATTERN = /^[\p{L}\p{M}\p{N} .'’-]+$/u;

export function normalizeDisplayName(value: unknown): string {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
}

export function isValidDisplayName(name: string): boolean {
  return (
    name.length >= DISPLAY_NAME_MIN &&
    name.length <= DISPLAY_NAME_MAX &&
    DISPLAY_NAME_PATTERN.test(name) &&
    /\p{L}/u.test(name)
  );
}

function hostMatches(host: string, allowed: string): boolean {
  return host === allowed || host.endsWith(`.${allowed}`);
}

/**
 * The normalized https URL, or undefined if the link is not acceptable.
 *
 * People type links the way they read them, so the scheme is optional:
 * `x.com/paul` and `mostafazh.me` become `https://...`, and an explicit
 * `http://` is upgraded to `https://`. Anything else with a scheme
 * (`javascript:`, `ftp:`, `data:`), credentials, and hosts without a dot
 * (`localhost`) are rejected.
 */
export function normalizeLink(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  let raw = value.trim();
  if (!raw || raw.length > LINK_MAX_LENGTH) return undefined;
  if (/^http:\/\//i.test(raw)) {
    raw = `https://${raw.slice('http://'.length)}`;
  } else if (raw.startsWith('//')) {
    raw = `https:${raw}`;
  } else if (!/^[a-z][a-z0-9+.-]*:/i.test(raw)) {
    raw = `https://${raw}`;
  }
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return undefined;
  }
  if (url.protocol !== 'https:' || url.username || url.password) {
    return undefined;
  }
  const host = url.hostname.toLowerCase();
  if (!host.includes('.') || host.startsWith('.') || host.endsWith('.')) {
    return undefined;
  }
  url.hash = '';
  return url.toString();
}

/** Which platform a link belongs to, for its icon; `website` otherwise. */
export function linkPlatform(link: string): LinkPlatform {
  let host: string;
  try {
    host = new URL(link).hostname.toLowerCase();
  } catch {
    return 'website';
  }
  for (const [platform, hosts] of Object.entries(LINK_HOSTS)) {
    if (hosts.some((h) => hostMatches(host, h)))
      return platform as LinkPlatform;
  }
  return 'website';
}

export type ValidationResult =
  { ok: true; value: JoinRequest } | { ok: false; errors: string[] };

/** Validate and normalize a join request body. Never trusts a single field. */
export function validateJoinRequest(input: unknown): ValidationResult {
  const errors: string[] = [];
  const body = (input ?? {}) as Record<string, unknown>;

  const code = typeof body.code === 'string' ? body.code.trim() : '';
  if (!isPromoterCode(code)) {
    errors.push(
      'Code must be 3 to 24 lowercase letters, digits or hyphens, and not a reserved word.',
    );
  }

  const displayName = normalizeDisplayName(body.displayName);
  if (!isValidDisplayName(displayName)) {
    errors.push(
      `Display name must be ${DISPLAY_NAME_MIN} to ${DISPLAY_NAME_MAX} characters of letters, digits, spaces, dots, apostrophes or hyphens.`,
    );
  }

  // Optional: empty means no link. Anything else must be a web address.
  let link: string | undefined;
  const rawLink = typeof body.link === 'string' ? body.link.trim() : body.link;
  if (rawLink !== undefined && rawLink !== null && rawLink !== '') {
    link = normalizeLink(rawLink);
    if (!link) {
      errors.push(
        'The link must be a web address, like instagram.com/yourname or yoursite.com.',
      );
    }
  }

  let referredBy: string | undefined;
  if (body.referredBy !== undefined && body.referredBy !== '') {
    if (isPromoterCode(body.referredBy) && body.referredBy !== code) {
      referredBy = body.referredBy;
    } else {
      errors.push('The referring code is not a valid promoter code.');
    }
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, value: { code, displayName, link, referredBy } };
}

export function toPublicPromoter(
  promoter: Promoter,
  approved: Promoter[],
): PublicPromoter {
  return {
    code: promoter.code,
    displayName: promoter.displayName,
    link: promoter.link,
    recruits: approved.filter((p) => p.referredBy === promoter.code).length,
  };
}

const PROMOTER_PREFIX = 'promoter:';
const APPROVED_KEY = 'approved';

export interface PromoterStore {
  get(code: string): Promise<Promoter | undefined>;
  put(promoter: Promoter): Promise<void>;
  /** Every entry, any status. Admin only: it walks the namespace. */
  list(): Promise<Promoter[]>;
  /** The approved entries, one read. */
  listApproved(): Promise<Promoter[]>;
  /** Recompute the approved document from the entries. */
  rebuildApproved(): Promise<Promoter[]>;
}

export function createPromoterStore(kv: KvClient): PromoterStore {
  const parse = (raw: string | null): Promoter | undefined => {
    if (!raw) return undefined;
    try {
      return withSingleLink(JSON.parse(raw) as Promoter);
    } catch {
      return undefined;
    }
  };

  const store: PromoterStore = {
    async get(code) {
      return parse(await kv.get(PROMOTER_PREFIX + code));
    },
    async put(promoter) {
      await kv.put(PROMOTER_PREFIX + promoter.code, JSON.stringify(promoter));
    },
    async list() {
      const keys = await kv.listKeys(PROMOTER_PREFIX);
      const entries = await Promise.all(keys.map((key) => kv.get(key)));
      return entries
        .map(parse)
        .filter((p): p is Promoter => p !== undefined)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    },
    async listApproved() {
      const raw = await kv.get(APPROVED_KEY);
      if (!raw) return [];
      try {
        return (JSON.parse(raw) as Promoter[]).map(withSingleLink);
      } catch {
        return [];
      }
    },
    async rebuildApproved() {
      const approved = (await store.list()).filter(
        (p) => p.status === 'approved',
      );
      // The public read path only needs public fields; keep owner key hashes
      // out of the shared document.
      await kv.put(APPROVED_KEY, JSON.stringify(approved.map(toAdminPromoter)));
      return approved;
    },
  };
  return store;
}

/**
 * Entries written before one link replaced per-platform links kept a
 * `links` map; show its first value so nothing already approved goes blank.
 */
function withSingleLink(promoter: Promoter): Promoter {
  const legacy = (promoter as { links?: Record<string, string> }).links;
  if (promoter.link || !legacy) return promoter;
  const first = Object.values(legacy).find(Boolean);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { links, ...rest } = promoter as Promoter & { links?: unknown };
  return first ? { ...rest, link: first } : rest;
}

// One memory store per server process, so `next dev` keeps entries between
// requests and a join followed by an admin approval works locally.
let memoryStore: PromoterStore | undefined;

/**
 * The store for this deployment: the `PROMOTERS` KV binding on Cloudflare,
 * otherwise the in-memory store.
 */
export function getPromoterStore(
  binding: KvNamespaceBinding | undefined = kvBinding(),
): PromoterStore {
  if (binding) return createPromoterStore(createBindingKvClient(binding));
  memoryStore ??= createPromoterStore(createMemoryKvClient());
  return memoryStore;
}

/**
 * Where listing requests are kept on this deployment. `memory` means the
 * `PROMOTERS` binding is missing: requests work but vanish on the next
 * restart or deploy. The admin page and the deploy check surface it.
 */
export function promoterStorage(
  binding: KvNamespaceBinding | undefined = kvBinding(),
): 'kv' | 'memory' {
  return binding ? 'kv' : 'memory';
}

/** Test hook: forget the process-wide memory store. */
export function resetMemoryPromoterStore() {
  memoryStore = undefined;
}

/** Whether the join form accepts requests. Flip to `false` as a kill switch. */
export function isJoinEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.LEADERBOARD_JOIN_ENABLED !== 'false';
}

/** A fresh private key for the browser that sends a listing request. */
export function generateOwnerKey(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export async function hashOwnerKey(key: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(key),
  );
  return Array.from(new Uint8Array(digest), (b) =>
    b.toString(16).padStart(2, '0'),
  ).join('');
}

/** A promoter as the admin page sees it: everything but the owner key hash. */
export function toAdminPromoter(
  promoter: Promoter,
): Omit<Promoter, 'ownerKeyHash'> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { ownerKeyHash, ...rest } = promoter;
  return rest;
}
