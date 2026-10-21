/**
 * Co-branding links: `https://ppm.techforpalestine.org/?b=<code>`.
 *
 * A campaign hands one link to its audience (every T4P member gets the same
 * one). Opening it turns on that campaign's overlay by default; people can
 * still switch it off. Which code unlocks which brand, and the brand's text,
 * live only in the `BRAND_LINKS` secret, never in the repo, as JSON:
 *
 *   { "<code>": { "brand": "t4p-member", "text": { "link": "join at t4p.al/j" } } }
 *
 * `brand` is a key of BRANDS (brands.tsx). `text` is optional and overrides
 * that brand's default text, key by key (label, hint, and whatever the
 * overlay draws), so wording changes need no code change: edit the secret,
 * then retry the deployment. To end a campaign, remove its code the same way;
 * old links then fall back to the plain frame. A new design is one overlay
 * component and one BRANDS entry.
 */

const CODE_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
const MAX_TEXT_LENGTH = 120;

export interface BrandLink {
  brand: string;
  text: Record<string, string>;
}

/** What a link code unlocks, or undefined. */
export function resolveBrand(
  code: string | null,
  links: string | undefined = process.env.BRAND_LINKS,
): BrandLink | undefined {
  if (!code || !links || !CODE_PATTERN.test(code)) return undefined;
  try {
    const map: unknown = JSON.parse(links);
    if (!map || typeof map !== 'object' || !Object.hasOwn(map, code)) {
      return undefined;
    }
    const entry = (map as Record<string, unknown>)[code] as {
      brand?: unknown;
      text?: unknown;
    } | null;
    if (typeof entry?.brand !== 'string') return undefined;
    const text: Record<string, string> = {};
    if (entry.text && typeof entry.text === 'object') {
      for (const [key, value] of Object.entries(entry.text)) {
        if (typeof value === 'string' && value.length <= MAX_TEXT_LENGTH) {
          text[key] = value;
        }
      }
    }
    return { brand: entry.brand, text };
  } catch {
    // A typo in the secret disables co-branding, not the site.
    return undefined;
  }
}
