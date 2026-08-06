import { APP_URL } from './share';

/**
 * Site-wide SEO constants. `APP_URL` (from `./share`) stays the single source
 * of truth for the canonical origin; everything here derives from it so the
 * sitemap, the canonical tags and the structured data can never drift apart.
 */
export const SITE_NAME = 'Palestine Profile Pic Maker';

/** Origin without the trailing slash, for building absolute page URLs. */
export const SITE_ORIGIN = APP_URL.replace(/\/$/, '');

/**
 * Absolute URL for a route. The root is emitted without a trailing slash so
 * the sitemap matches the canonical tag Next renders for `/` byte for byte.
 */
export function pageUrl(path: string): string {
  return path === '/' ? SITE_ORIGIN : `${SITE_ORIGIN}${path}`;
}

/**
 * The intent-based landing pages. Each one targets a different way people
 * search for a Palestine profile frame and links to the others, so a visitor
 * (and a crawler) can reach every page from any page. Kept in one list so the
 * sitemap and the cross-links stay in sync with the routes on disk.
 */
export const LANDING_PAGES = [
  {
    path: '/palestine-profile-picture-frame',
    /** Short label used in the cross-page "related" links. */
    label: 'Palestine profile picture frame',
  },
  {
    path: '/palestine-flag-border',
    label: 'Palestine flag border for your profile pic',
  },
  {
    path: '/palestine-facebook-frame',
    label: 'Palestine Facebook profile frame',
  },
] as const;

export type LandingPagePath = (typeof LANDING_PAGES)[number]['path'];
