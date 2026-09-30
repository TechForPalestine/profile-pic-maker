import { leaderboardEnabled } from '@/lib/referral';

/**
 * Which share panel this browser sees after downloading.
 *
 * - classic: the share buttons carry `share-*` refs, credited to nobody, with
 *   a small "get your own link" prompt underneath.
 * - link-first: a personal referral link is made for the person as soon as
 *   they download (anonymous, no name asked), every share button carries it,
 *   and they can see how many people it has brought. Adding a name and
 *   joining the leaderboard comes after.
 *
 * `NEXT_PUBLIC_SHARE_VARIANT` picks the mode at build time: `classic` (the
 * default), `link-first` for everyone, or `split` for a 50/50 test where each
 * browser is assigned once and keeps its variant. The variant is sent as the
 * `variant` prop on the funnel and share events, so every step can be split
 * by it in Plausible.
 *
 * `?share=link-first` or `?share=classic` on any page forces a variant for
 * this browser (for QA and demos), whatever the mode. Link-first needs the
 * leaderboard: with it switched off everyone gets classic.
 */

export const SHARE_VARIANTS = ['classic', 'link-first'] as const;
export type ShareVariant = (typeof SHARE_VARIANTS)[number];

export type ShareVariantMode = ShareVariant | 'split';

/** localStorage key holding `{ variant, source }`. */
export const SHARE_VARIANT_STORAGE_KEY = 'ppm-share-variant';

/** Query parameter that forces a variant for this browser. */
export const SHARE_VARIANT_PARAM = 'share';

interface StoredVariant {
  variant: ShareVariant;
  /** `split`: assigned by the test. `override`: forced with `?share=`. */
  source: 'split' | 'override';
}

export function isShareVariant(value: unknown): value is ShareVariant {
  return SHARE_VARIANTS.includes(value as ShareVariant);
}

export function shareVariantMode(
  value: string | undefined = process.env.NEXT_PUBLIC_SHARE_VARIANT,
): ShareVariantMode {
  return value === 'split' || isShareVariant(value) ? value : 'classic';
}

function readStored(): StoredVariant | undefined {
  try {
    const raw = localStorage.getItem(SHARE_VARIANT_STORAGE_KEY);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as Partial<StoredVariant>;
    if (
      !isShareVariant(parsed.variant) ||
      (parsed.source !== 'split' && parsed.source !== 'override')
    ) {
      return undefined;
    }
    return { variant: parsed.variant, source: parsed.source };
  } catch {
    return undefined;
  }
}

function store(value: StoredVariant): void {
  try {
    localStorage.setItem(SHARE_VARIANT_STORAGE_KEY, JSON.stringify(value));
  } catch {
    // Blocked storage: a split assignment is redrawn on the next visit, which
    // only adds a little noise to the test.
  }
}

/**
 * Settle this browser's variant: apply a `?share=` override from `search` if
 * there is one, otherwise keep what was stored, otherwise assign. Call once
 * on landing; later reads use `shareVariant()`.
 */
export function assignShareVariant({
  search = '',
  mode = shareVariantMode(),
  enabled = leaderboardEnabled(),
  random = Math.random,
}: {
  search?: string;
  mode?: ShareVariantMode;
  enabled?: boolean;
  random?: () => number;
} = {}): ShareVariant {
  if (!enabled) return 'classic';
  const forced = new URLSearchParams(search).get(SHARE_VARIANT_PARAM);
  if (isShareVariant(forced)) {
    store({ variant: forced, source: 'override' });
    return forced;
  }
  const stored = readStored();
  if (stored?.source === 'override') return stored.variant;
  if (mode !== 'split') return mode;
  if (stored) return stored.variant;
  const variant: ShareVariant = random() < 0.5 ? 'classic' : 'link-first';
  store({ variant, source: 'split' });
  return variant;
}

/** The variant this browser is in, without assigning one. */
export function shareVariant({
  mode = shareVariantMode(),
  enabled = leaderboardEnabled(),
}: { mode?: ShareVariantMode; enabled?: boolean } = {}): ShareVariant {
  if (!enabled) return 'classic';
  const stored = readStored();
  if (stored?.source === 'override') return stored.variant;
  if (mode !== 'split') return mode;
  return stored?.variant ?? 'classic';
}
