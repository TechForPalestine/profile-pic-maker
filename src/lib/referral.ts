import { APP_URL } from '@/lib/share';

/**
 * Referral links: `https://ppm.techforpalestine.org/?ref=<code>`.
 *
 * Plausible already reads `ref` as the visit's traffic source (the same field
 * `shareLandingUrl` in `@/lib/share` uses), so a promoter's link is attributed
 * the moment it is handed out, with nothing stored anywhere. Source attribution
 * only lasts for one session though: someone who saves the link and comes back
 * tomorrow to make their picture would count as organic. So the code is also
 * remembered in this browser (first touch, 30 days) and sent as the `referrer`
 * custom prop on the funnel events, which is what the leaderboard reads.
 *
 * Nothing about the visitor is stored or sent: the only value that travels is
 * the promoter's own public code.
 */

/**
 * Codes are short lowercase slugs so they survive being typed, read off a
 * screenshot, and shown in a Plausible dashboard. Uppercase is rejected rather
 * than folded, so the link a promoter shares is byte-for-byte the code that
 * gets counted.
 */
export const REFERRAL_CODE_PATTERN = /^[a-z0-9][a-z0-9-]{2,23}$/;

/**
 * `share-*` is owned by the post-download share buttons (`shareLandingUrl`);
 * those are channels, not people, and are bucketed separately on the
 * leaderboard.
 */
export const SHARE_PREFIX = 'share-';

/**
 * `ch-*` is the convention for channel-level links handed out manually (a
 * newsletter, a community group, the T4P tools page). They are attributed and
 * reported like promoter codes but never ranked as a person.
 */
export const CHANNEL_PREFIX = 'ch-';

/** Words that would read as pages or system values rather than a person. */
export const RESERVED_CODES = new Set([
  'admin',
  'api',
  'join',
  'leaderboard',
  'none',
  'other',
  'others',
  't4p',
  'techforpalestine',
  'test',
]);

/** Sent as the `referrer` prop when this browser has no remembered code. */
export const REFERRER_NONE = 'none';

/** localStorage key holding `{ code, at }` for the first referral link seen. */
export const REFERRER_STORAGE_KEY = 'ppm-referrer';

/** How long a remembered code keeps crediting the promoter, in milliseconds. */
export const REFERRER_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/** True for a well-formed code, whoever it belongs to (promoter or channel). */
export function isReferralCode(value: unknown): value is string {
  return typeof value === 'string' && REFERRAL_CODE_PATTERN.test(value);
}

export function isShareCode(code: string): boolean {
  return code.startsWith(SHARE_PREFIX);
}

export function isChannelCode(code: string): boolean {
  return isReferralCode(code) && code.startsWith(CHANNEL_PREFIX);
}

/**
 * True for a code a person may register as their own: well-formed, and not one
 * of the reserved system prefixes or words.
 */
export function isPromoterCode(value: unknown): value is string {
  return (
    isReferralCode(value) &&
    !isShareCode(value) &&
    !isChannelCode(value) &&
    !RESERVED_CODES.has(value)
  );
}

/**
 * Suggest a code from a display name: lowercase ASCII letters and digits with
 * single hyphens, trimmed to the code length limit. Accents are stripped so
 * "Zoë Ñ" becomes "zoe-n"; names with no Latin letters at all come back empty
 * and the person picks a code by hand.
 */
export function slugifyDisplayName(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 24)
    .replace(/-+$/g, '');
}

const CODE_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';

function randomSuffix(length: number, random: () => number): string {
  let out = '';
  for (let i = 0; i < length; i++) {
    out += CODE_ALPHABET[Math.floor(random() * CODE_ALPHABET.length)];
  }
  return out;
}

/**
 * Generate a promoter code from a display name: the slug of the name plus a
 * short random tail (`paul-biggar-7k2q`). The tail makes collisions between
 * two Pauls a non-issue without asking a server first, and keeps a
 * hand-picked slur out of the URL: nobody types a code, it is made for them.
 * Names with no Latin letters get a neutral prefix (`pal-x7k2qm`). The
 * result always satisfies `isPromoterCode`.
 */
export function generatePromoterCode(
  displayName: string,
  random: () => number = Math.random,
): string {
  const slug = slugifyDisplayName(displayName).slice(0, 18).replace(/-+$/, '');
  const code = slug
    ? `${slug}-${randomSuffix(4, random)}`
    : `pal-${randomSuffix(6, random)}`;
  return isPromoterCode(code) ? code : `pal-${randomSuffix(6, random)}`;
}

/** The link a promoter shares. */
export function referralLink(code: string): string {
  return `${APP_URL}?ref=${encodeURIComponent(code)}`;
}

/**
 * The referral code carried by a landing URL, or undefined. Only promoter and
 * channel codes count: `share-*` refs are the share buttons' own attribution
 * and stay out of the leaderboard.
 */
export function readReferralCode(search: string): string | undefined {
  const ref = new URLSearchParams(search).get('ref');
  if (!ref) return undefined;
  const code = ref.trim();
  return isReferralCode(code) && !isShareCode(code) ? code : undefined;
}

interface StoredReferrer {
  code: string;
  at: number;
}

function readStored(now: number): StoredReferrer | undefined {
  try {
    const raw = localStorage.getItem(REFERRER_STORAGE_KEY);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as Partial<StoredReferrer>;
    if (
      !isReferralCode(parsed.code) ||
      typeof parsed.at !== 'number' ||
      now - parsed.at > REFERRER_TTL_MS
    ) {
      return undefined;
    }
    return { code: parsed.code, at: parsed.at };
  } catch {
    // Private mode, blocked storage, or a corrupt value: treat as no referrer.
    return undefined;
  }
}

/**
 * Remember the referral code for this browser. First touch wins: the person
 * who brought someone here first keeps the credit, even if a second link is
 * opened later within the 30 days. Returns the code that is now in effect.
 */
export function rememberReferrer(
  code: string,
  now: number = Date.now(),
): string | undefined {
  if (!isReferralCode(code) || isShareCode(code)) return currentReferrer(now);
  const existing = readStored(now);
  if (existing) return existing.code;
  try {
    localStorage.setItem(
      REFERRER_STORAGE_KEY,
      JSON.stringify({ code, at: now } satisfies StoredReferrer),
    );
  } catch {
    // Storage unavailable: the code still counts for this session via
    // Plausible's own source attribution, so nothing to do.
  }
  return code;
}

/** The code currently credited in this browser, if any. */
export function currentReferrer(now: number = Date.now()): string | undefined {
  return readStored(now)?.code;
}

/** The value to send as the `referrer` analytics prop. */
export function referrerProp(now: number = Date.now()): string {
  return currentReferrer(now) ?? REFERRER_NONE;
}

/**
 * A short, stable fingerprint of a code (first 12 hex chars of SHA-256).
 *
 * The leaderboard API publishes download counts for codes that are not
 * approved yet, so a promoter can watch their own number while they wait
 * for review. Those codes are free text nobody has looked at, so they are
 * keyed by this fingerprint rather than in the clear: the promoter's browser
 * knows their code and can hash it, the public sees only numbers.
 */
export async function hashReferralCode(code: string): Promise<string> {
  const bytes = new TextEncoder().encode(code);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest).slice(0, 6))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * The leaderboard (pages, links to it and its APIs) is on unless
 * `NEXT_PUBLIC_LEADERBOARD` is `off`. On Cloudflare Pages, next.config.js
 * turns it off unless the dashboard Secret says `on`. Referral attribution
 * runs either way.
 */
export function leaderboardEnabled(): boolean {
  return process.env.NEXT_PUBLIC_LEADERBOARD !== 'off';
}
