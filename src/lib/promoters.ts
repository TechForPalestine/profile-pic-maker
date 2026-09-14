import {
  createKvClient,
  createMemoryKvClient,
  hasKvEnv,
  type KvClient,
  type KvEnv,
} from '@/lib/cloudflare-kv';
import { isPromoterCode } from '@/lib/referral';

/**
 * The promoter registry: who may appear on the public leaderboard.
 *
 * Anyone can generate a referral link and it is counted from the first click.
 * Appearing on the board with a display name and social links is a separate,
 * moderated step: the board renders on a Tech For Palestine domain, so every
 * name and link on it has been looked at by a person first. Requests land as
 * `pending`; an approver flips them to `approved` (or `rejected`) from the
 * admin page, and only approved entries are ever served publicly.
 *
 * Storage is Workers KV over the REST API (see `@/lib/cloudflare-kv`):
 *   promoter:<code>  one JSON `Promoter` per code, the source of truth
 *   approved         the approved entries as one JSON array, rewritten by
 *                    admin actions, so the public read is a single `get`
 * Without Cloudflare credentials an in-memory store is used, which is what
 * `next dev` and the tests run against.
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

export type PromoterLinks = Partial<Record<LinkPlatform, string>>;

export type PromoterStatus = 'pending' | 'approved' | 'rejected';

export interface Promoter {
  code: string;
  displayName: string;
  links: PromoterLinks;
  /** Code of the approved promoter whose link brought this person here. */
  referredBy?: string;
  status: PromoterStatus;
  createdAt: string;
  reviewedAt?: string;
}

/** What the public API serves: nothing about status or timing. */
export interface PublicPromoter {
  code: string;
  displayName: string;
  links: PromoterLinks;
  /** Approved promoters who joined through this person's link. */
  recruits: number;
}

export interface JoinRequest {
  code: string;
  displayName: string;
  links: PromoterLinks;
  referredBy?: string;
}

/**
 * Hosts each social link may point at. A link is accepted when its host is
 * one of these or a subdomain of one, over https only. `website` is any https
 * host and is rendered with rel="nofollow".
 */
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

/** The normalized https URL, or undefined if the link is not acceptable. */
export function normalizeLink(
  platform: LinkPlatform,
  value: unknown,
): string | undefined {
  if (typeof value !== 'string') return undefined;
  const raw = value.trim();
  if (!raw || raw.length > LINK_MAX_LENGTH) return undefined;
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
  if (platform !== 'website') {
    const allowed = LINK_HOSTS[platform].some((h) => hostMatches(host, h));
    if (!allowed) return undefined;
  } else if (!host.includes('.')) {
    return undefined;
  }
  url.hash = '';
  return url.toString();
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

  const links: PromoterLinks = {};
  const rawLinks =
    body.links && typeof body.links === 'object'
      ? (body.links as Record<string, unknown>)
      : {};
  for (const platform of LINK_PLATFORMS) {
    const raw = rawLinks[platform];
    if (raw === undefined || raw === null || raw === '') continue;
    const normalized = normalizeLink(platform, raw);
    if (normalized) {
      links[platform] = normalized;
    } else {
      errors.push(`The ${platform} link must be an https link on ${platform}.`);
    }
  }
  if (Object.keys(links).length === 0) {
    errors.push('Add at least one social link so people can find you.');
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
  return { ok: true, value: { code, displayName, links, referredBy } };
}

export function toPublicPromoter(
  promoter: Promoter,
  approved: Promoter[],
): PublicPromoter {
  return {
    code: promoter.code,
    displayName: promoter.displayName,
    links: promoter.links,
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
      return JSON.parse(raw) as Promoter;
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
        return JSON.parse(raw) as Promoter[];
      } catch {
        return [];
      }
    },
    async rebuildApproved() {
      const approved = (await store.list()).filter(
        (p) => p.status === 'approved',
      );
      await kv.put(APPROVED_KEY, JSON.stringify(approved));
      return approved;
    },
  };
  return store;
}

// One memory store per server process, so `next dev` keeps entries between
// requests and a join followed by an admin approval works locally.
let memoryStore: PromoterStore | undefined;

/**
 * The store for this deployment: KV when the Cloudflare credentials are set,
 * otherwise the in-memory store.
 */
export function getPromoterStore(
  env: KvEnv = process.env as KvEnv,
): PromoterStore {
  if (hasKvEnv(env)) return createPromoterStore(createKvClient(env));
  memoryStore ??= createPromoterStore(createMemoryKvClient());
  return memoryStore;
}

/** Test hook: forget the process-wide memory store. */
export function resetMemoryPromoterStore() {
  memoryStore = undefined;
}

/** Whether the join form accepts requests. Flip to `false` as a kill switch. */
export function isJoinEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.LEADERBOARD_JOIN_ENABLED !== 'false';
}
